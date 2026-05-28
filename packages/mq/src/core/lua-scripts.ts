import type { Redis } from 'ioredis';

export const SCRIPTS = {
  pushJob: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local jobId = ARGV[1]
local groupId = ARGV[2]
local payload = ARGV[3]
local score = tonumber(ARGV[4])
local delay = tonumber(ARGV[5])
local jobName = ARGV[6]
local maxAttempts = ARGV[7]
local backoffType = ARGV[8]
local backoffDelay = ARGV[9]
local uniqueId = ARGV[10]

local jobKey = 'voltrix:mq:' .. queueName .. ':job:' .. jobId
local limitsKey = 'voltrix:mq:' .. queueName .. ':group_limits'
local rulesKey = 'voltrix:mq:' .. queueName .. ':concurrency_rules'

-- 1. Store Job Hash with top-level metadata fields
redis.call('HSET', jobKey, 
    'id', jobId, 
    'group', groupId, 
    'payload', payload,
    'name', jobName,
    'attempts', '0',
    'maxAttempts', maxAttempts,
    'backoffType', backoffType,
    'backoffDelay', backoffDelay,
    'uniqueId', uniqueId
)

-- 2. Resolve pattern-based subject concurrency limit from centralized rules if not cached yet
local exists = redis.call('HEXISTS', limitsKey, groupId)
if exists == 0 then
    local rules = redis.call('ZREVRANGE', rulesKey, 0, -1)
    local resolvedLimit = -1 -- Default: Unlimited
    
    for _, ruleStr in ipairs(rules) do
        local colonIdx = string.find(ruleStr, ":")
        if colonIdx then
            local pattern = string.sub(ruleStr, 1, colonIdx - 1)
            local limit = tonumber(string.sub(ruleStr, colonIdx + 1))
            
            -- Translate Glob pattern to Lua pattern matching regex
            local luaPattern = string.gsub(pattern, "%.", "%%.")
            luaPattern = string.gsub(luaPattern, "%*", ".*")
            luaPattern = "^" .. luaPattern .. "$"
            
            if string.match(groupId, luaPattern) then
                resolvedLimit = limit
                break
            end
        end
    end
    redis.call('HSET', limitsKey, groupId, resolvedLimit)
end

if delay > 0 then
    -- Delayed flow
    redis.call('HSET', jobKey, 'state', 'delayed', 'runAt', tostring(score))
    redis.call('ZADD', 'voltrix:mq:' .. queueName .. ':delayed', score, jobId)
else
    -- Immediate flow
    redis.call('HSET', jobKey, 'state', 'waiting')
    redis.call('RPUSH', 'voltrix:mq:' .. queueName .. ':group:' .. groupId, jobId)
    redis.call('ZADD', 'voltrix:mq:' .. queueName .. ':groups', score, groupId)
end

return true
    `
  },
  acquireJob: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local workerId = ARGV[1]
local defaultConcurrency = tonumber(ARGV[2])
local now = ARGV[3]

local groupsKey = 'voltrix:mq:' .. queueName .. ':groups'
local activeKey = 'voltrix:mq:' .. queueName .. ':active_count'
local heartbeatsKey = 'voltrix:mq:' .. queueName .. ':heartbeats'
local limitsKey = 'voltrix:mq:' .. queueName .. ':group_limits'

-- 1. Get waiting groups sorted by oldest job score
local groups = redis.call('ZRANGE', groupsKey, 0, -1)

for _, groupId in ipairs(groups) do
    local active = tonumber(redis.call('HGET', activeKey, groupId) or "0")
    
    -- 2. Fetch pre-calculated dynamic subject limit
    local maxLimit = tonumber(redis.call('HGET', limitsKey, groupId) or defaultConcurrency)
    
    -- -1 represents unlimited concurrency for this specific subject
    if maxLimit == -1 or active < maxLimit then
        local groupQueueKey = 'voltrix:mq:' .. queueName .. ':group:' .. groupId
        local jobId = redis.call('LPOP', groupQueueKey)
        
        if jobId then
            -- Set states
            redis.call('HSET', 'voltrix:mq:' .. queueName .. ':job:' .. jobId, 'state', 'active')
            redis.call('HINCRBY', activeKey, groupId, 1)
            redis.call('HSET', heartbeatsKey, jobId, workerId .. ':' .. now)
            
            -- If group queue is now empty, remove from active groups list
            local len = redis.call('LLEN', groupQueueKey)
            if len == 0 then
                redis.call('ZREM', groupsKey, groupId)
            end
            
            local jobMeta = redis.call('HMGET', 'voltrix:mq:' .. queueName .. ':job:' .. jobId, 'payload', 'name')
            return { jobId, groupId, jobMeta[1], jobMeta[2] }
        else
            -- Clean stale group reference
            redis.call('ZREM', groupsKey, groupId)
        end
    end
end

return nil
    `
  },
  acquireJobsBatch: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local workerId = ARGV[1]
local defaultConcurrency = tonumber(ARGV[2])
local now = ARGV[3]
local batchSize = tonumber(ARGV[4] or "1")

local groupsKey = 'voltrix:mq:' .. queueName .. ':groups'
local activeKey = 'voltrix:mq:' .. queueName .. ':active_count'
local heartbeatsKey = 'voltrix:mq:' .. queueName .. ':heartbeats'
local limitsKey = 'voltrix:mq:' .. queueName .. ':group_limits'
local globalWaitingKey = 'voltrix:mq:' .. queueName .. ':waiting'

local results = {}
local acquiredCount = 0

-- 1. TRY FAST-PATH FIRST: Pop up to batchSize jobs from the global queue
for i = 1, batchSize do
    local jobId = redis.call('LPOP', globalWaitingKey)
    if jobId then
        redis.call('HSET', 'voltrix:mq:' .. queueName .. ':job:' .. jobId, 'state', 'active')
        redis.call('HSET', heartbeatsKey, jobId, workerId .. ':' .. now)
        local jobMeta = redis.call('HMGET', 'voltrix:mq:' .. queueName .. ':job:' .. jobId, 'payload', 'name')
        
        acquiredCount = acquiredCount + 1
        results[acquiredCount] = { jobId, "global", jobMeta[1], jobMeta[2] }
    else
        break
    end
end

-- 2. TRY SLOW-PATH (Fallback): If budget remains, scan limited groups in ZSET
if acquiredCount < batchSize then
    local groups = redis.call('ZRANGE', groupsKey, 0, -1)
    
    for _, groupId in ipairs(groups) do
        if acquiredCount >= batchSize then
            break
        end
        
        local active = tonumber(redis.call('HGET', activeKey, groupId) or "0")
        local maxLimit = tonumber(redis.call('HGET', limitsKey, groupId) or defaultConcurrency)
        
        -- Acquire multiple jobs from this group up to its limit or our remaining batch budget
        while (maxLimit == -1 or active < maxLimit) and (acquiredCount < batchSize) do
            local groupQueueKey = 'voltrix:mq:' .. queueName .. ':group:' .. groupId
            local jobId = redis.call('LPOP', groupQueueKey)
            
            if jobId then
                redis.call('HSET', 'voltrix:mq:' .. queueName .. ':job:' .. jobId, 'state', 'active')
                redis.call('HINCRBY', activeKey, groupId, 1)
                active = active + 1
                redis.call('HSET', heartbeatsKey, jobId, workerId .. ':' .. now)
                
                local len = redis.call('LLEN', groupQueueKey)
                if len == 0 then
                    redis.call('ZREM', groupsKey, groupId)
                end
                
                local jobMeta = redis.call('HMGET', 'voltrix:mq:' .. queueName .. ':job:' .. jobId, 'payload', 'name')
                acquiredCount = acquiredCount + 1
                results[acquiredCount] = { jobId, groupId, jobMeta[1], jobMeta[2] }
            else
                redis.call('ZREM', groupsKey, groupId)
                break
            end
        end
    end
end

return results
    `
  },
  completeJob: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local jobId = ARGV[1]
local groupId = ARGV[2]
local removeOnComplete = tonumber(ARGV[3]) -- 1 = delete, 0 = keep state
local now = ARGV[4]

local activeKey = 'voltrix:mq:' .. queueName .. ':active_count'
local heartbeatsKey = 'voltrix:mq:' .. queueName .. ':heartbeats'
local jobKey = 'voltrix:mq:' .. queueName .. ':job:' .. jobId
local completedSet = 'voltrix:mq:' .. queueName .. ':completed'
local limitsKey = 'voltrix:mq:' .. queueName .. ':group_limits'

-- 1. Decrement active count
local active = tonumber(redis.call('HGET', activeKey, groupId) or "0")
if active > 0 then
    active = redis.call('HINCRBY', activeKey, groupId, -1)
end

-- 2. Remove Heartbeat
redis.call('HDEL', heartbeatsKey, jobId)

-- 3. Manage unique lock
local uniqueId = redis.call('HGET', jobKey, 'uniqueId')
if uniqueId then
    redis.call('DEL', 'voltrix:mq:' .. queueName .. ':unique:' .. uniqueId)
end

-- 4. Clean dynamic limit if group becomes empty and active is 0 to avoid memory leaks
local pending = redis.call('LLEN', 'voltrix:mq:' .. queueName .. ':group:' .. groupId)
if pending == 0 and active == 0 then
    redis.call('HDEL', limitsKey, groupId)
    redis.call('HDEL', activeKey, groupId)
end

-- 5. Clean job data & index
if removeOnComplete == 1 then
    redis.call('DEL', jobKey)
else
    redis.call('HSET', jobKey, 'state', 'completed', 'completedAt', now)
    redis.call('SADD', completedSet, jobId)
end

return true
    `
  },
  failJob: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local jobId = ARGV[1]
local groupId = ARGV[2]
local errorMsg = ARGV[3]
local now = tonumber(ARGV[4])
local removeOnFail = tonumber(ARGV[5])

local activeKey = 'voltrix:mq:' .. queueName .. ':active_count'
local heartbeatsKey = 'voltrix:mq:' .. queueName .. ':heartbeats'
local jobKey = 'voltrix:mq:' .. queueName .. ':job:' .. jobId
local failedSet = 'voltrix:mq:' .. queueName .. ':failed'
local limitsKey = 'voltrix:mq:' .. queueName .. ':group_limits'

-- Decrement active count
local active = tonumber(redis.call('HGET', activeKey, groupId) or "0")
if active > 0 then
    active = redis.call('HINCRBY', activeKey, groupId, -1)
end

redis.call('HDEL', heartbeatsKey, jobId)

local attempts = tonumber(redis.call('HGET', jobKey, 'attempts') or "0") + 1
local maxAttempts = tonumber(redis.call('HGET', jobKey, 'maxAttempts') or "1")

redis.call('HSET', jobKey, 'attempts', attempts, 'error', errorMsg)

if attempts < maxAttempts then
    -- Calculate backoff
    local backoffType = redis.call('HGET', jobKey, 'backoffType') or 'linear'
    local delay = tonumber(redis.call('HGET', jobKey, 'backoffDelay') or "1000")
    
    local sleepTime = delay
    if backoffType == 'exponential' then
        sleepTime = math.pow(2, attempts - 1) * delay
    end
    
    local runAt = now + sleepTime
    redis.call('HSET', jobKey, 'state', 'delayed', 'runAt', tostring(runAt))
    redis.call('ZADD', 'voltrix:mq:' .. queueName .. ':delayed', runAt, jobId)
else
    -- Clean dynamic limit if group becomes empty and active is 0 to avoid memory leaks
    local pending = redis.call('LLEN', 'voltrix:mq:' .. queueName .. ':group:' .. groupId)
    if pending == 0 and active == 0 then
        redis.call('HDEL', limitsKey, groupId)
        redis.call('HDEL', activeKey, groupId)
    end

    -- DLQ Transition
    redis.call('HSET', jobKey, 'state', 'failed')
    if removeOnFail == 1 then
        redis.call('DEL', jobKey)
    else
        redis.call('SADD', 'voltrix:mq:' .. queueName .. ':dlq', jobId)
        redis.call('SADD', failedSet, jobId)
    end
end

return true
    `
  },
  cleanStalledJobs: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local threshold = tonumber(ARGV[1])
local now = ARGV[2]
local maxStalledCount = tonumber(ARGV[3])

local heartbeatsKey = 'voltrix:mq:' .. queueName .. ':heartbeats'
local activeKey = 'voltrix:mq:' .. queueName .. ':active_count'
local groupsKey = 'voltrix:mq:' .. queueName .. ':groups'
local failedSet = 'voltrix:mq:' .. queueName .. ':failed'
local limitsKey = 'voltrix:mq:' .. queueName .. ':group_limits'

local heartbeats = redis.call('HGETALL', heartbeatsKey)
local stalledJobs = {}

for i = 1, #heartbeats, 2 do
    local jobId = heartbeats[i]
    local val = heartbeats[i+1]
    
    -- Split workerId:timestamp
    local colonIdx = string.find(val, ":")
    local timestamp = tonumber(string.sub(val, colonIdx + 1))
    
    if timestamp < threshold then
        local jobKey = 'voltrix:mq:' .. queueName .. ':job:' .. jobId
        local groupId = redis.call('HGET', jobKey, 'group')
        local stalledCount = tonumber(redis.call('HGET', jobKey, 'stalledCount') or "0") + 1
        
        redis.call('HSET', jobKey, 'stalledCount', stalledCount)
        redis.call('HDEL', heartbeatsKey, jobId)
        
        -- Decrement active count
        local active = 0
        if groupId then
            active = tonumber(redis.call('HGET', activeKey, groupId) or "0")
            if active > 0 then
                active = redis.call('HINCRBY', activeKey, groupId, -1)
            end
        end
        
        if stalledCount >= maxStalledCount then
            -- Exceeded limits -> Fail to DLQ
            redis.call('HSET', jobKey, 'state', 'failed', 'error', 'Job stalled too many times')
            redis.call('SADD', 'voltrix:mq:' .. queueName .. ':dlq', jobId)
            redis.call('SADD', failedSet, jobId)

            -- Clean dynamic limit if group becomes empty and active is 0 to avoid memory leaks
            local pending = redis.call('LLEN', 'voltrix:mq:' .. queueName .. ':group:' .. groupId)
            if pending == 0 and active == 0 then
                redis.call('HDEL', limitsKey, groupId)
                redis.call('HDEL', activeKey, groupId)
            end
        else
            -- Recover to wait queue
            redis.call('HSET', jobKey, 'state', 'waiting')
            redis.call('LPUSH', 'voltrix:mq:' .. queueName .. ':group:' .. groupId, jobId)
            redis.call('ZADD', groupsKey, tonumber(now), groupId)
            table.insert(stalledJobs, jobId)
        end
    end
end

return stalledJobs
    `
  },
  moveDelayedToWaiting: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]
local now = tonumber(ARGV[1])

local delayedKey = 'voltrix:mq:' .. queueName .. ':delayed'
local groupsKey = 'voltrix:mq:' .. queueName .. ':groups'

-- Get delayed jobs ready to run
local jobs = redis.call('ZRANGEBYSCORE', delayedKey, 0, now)

for _, jobId in ipairs(jobs) do
    local jobKey = 'voltrix:mq:' .. queueName .. ':job:' .. jobId
    local groupId = redis.call('HGET', jobKey, 'group')
    
    if groupId then
        redis.call('HSET', jobKey, 'state', 'waiting')
        redis.call('RPUSH', 'voltrix:mq:' .. queueName .. ':group:' .. groupId, jobId)
        redis.call('ZADD', groupsKey, now, groupId)
    end
    
    redis.call('ZREM', delayedKey, jobId)
end

return #jobs
    `
  },
  getQueueMetrics: {
    numberOfKeys: 1,
    lua: `
local queueName = KEYS[1]

local groupsKey = 'voltrix:mq:' .. queueName .. ':groups'
local activeKey = 'voltrix:mq:' .. queueName .. ':active_count'
local delayedKey = 'voltrix:mq:' .. queueName .. ':delayed'
local completedSet = 'voltrix:mq:' .. queueName .. ':completed'
local failedSet = 'voltrix:mq:' .. queueName .. ':failed'
local dlqSet = 'voltrix:mq:' .. queueName .. ':dlq'

-- 1. Compute total waiting jobs across all groups
local waitingCount = 0
local groups = redis.call('ZRANGE', groupsKey, 0, -1)
for _, groupId in ipairs(groups) do
    local len = redis.call('LLEN', 'voltrix:mq:' .. queueName .. ':group:' .. groupId)
    waitingCount = waitingCount + len
end

-- 2. Compute total active jobs
local activeCount = 0
local activeCounts = redis.call('HVALS', activeKey)
for _, count in ipairs(activeCounts) do
    activeCount = activeCount + tonumber(count)
end

-- 3. Cardinalities
local delayedCount = redis.call('ZCARD', delayedKey)
local completedCount = redis.call('SCARD', completedSet)
local failedCount = redis.call('SCARD', failedSet)
local dlqCount = redis.call('SCARD', dlqSet)
local groupsCount = #groups

return {
    waitingCount,
    activeCount,
    delayedCount,
    completedCount,
    failedCount,
    dlqCount,
    groupsCount
}
    `
  }
};

import type { VoltrixRedis } from '../types/index.js';

export function registerCommands(redis: Redis): VoltrixRedis {
  const redisRecord = redis as unknown as Record<string, unknown>;
  for (const [name, config] of Object.entries(SCRIPTS)) {
    const cmdName = 'voltrix' + name.charAt(0).toUpperCase() + name.slice(1);
    if (typeof redisRecord[cmdName] !== 'function') {
      redis.defineCommand(cmdName, {
        numberOfKeys: config.numberOfKeys,
        lua: config.lua
      });
    }
  }
  return redis as unknown as VoltrixRedis;
}
