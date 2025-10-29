/**
 * Configuración estándar del benchmark
 */
export const BENCHMARK_CONFIG = {
  requests: process.env.BENCHMARK_REQUESTS ? parseInt(process.env.BENCHMARK_REQUESTS) : 1000,
  timeout: process.env.BENCHMARK_TIMEOUT ? parseInt(process.env.BENCHMARK_TIMEOUT) : 3000,
  concurrency: process.env.BENCHMARK_CONCURRENCY ? parseInt(process.env.BENCHMARK_CONCURRENCY) : 1,
  warmupRequests: process.env.BENCHMARK_WARMUP_REQUESTS ? parseInt(process.env.BENCHMARK_WARMUP_REQUESTS) : 10,
};
 