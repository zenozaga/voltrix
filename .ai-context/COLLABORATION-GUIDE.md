# Project Collaboration Guide - Current State

## 🎯 **Quick Start for New Contributors**

### What This Project Does
**MCP Annotations** is an enterprise-grade TypeScript system for managing Model Context Protocol (MCP) server collections. It provides advanced features like direct class references, health monitoring, auto-restart, and graceful shutdown - making it perfect for production MCP server deployments.

### Key Innovation: Direct Class References
Instead of managing servers by string names, you use actual class constructors:

```typescript
// OLD: String-based (error-prone)
servers: ['calculator-server', 'text-processor']

// NEW: Direct classes (type-safe, refactor-friendly)
servers: [CalculatorServer, TextProcessorServer]
```

## 🏆 **Current Achievement Status**

### ✅ **Fully Implemented & Working**
- **82/82 tests passing** across 4 comprehensive test suites
- Direct class reference system with automatic fallback
- Real-time health monitoring (configurable intervals)
- Auto-restart with exponential backoff strategies
- Graceful shutdown with proper resource cleanup
- Server intercommunication and shared context
- Complete middleware system (22 tests)
- Zod schema integration (31 tests)
- Official MCP SDK compatibility (14 tests)

### 🔧 **Areas for Future Enhancement**
- Advanced monitoring dashboards
- Horizontal scaling features
- Enhanced security for server-to-server communication
- Visual management interface

## 📁 **Project Structure Guide**

```
src/
├── decorators/
│   ├── collection.decorator.ts   # 🎯 Main innovation: direct class refs
│   ├── server.decorator.ts       # @MCPServer decorator
│   ├── tool.decorator.ts         # @MCPTool decorator
│   └── ...
├── server/
│   ├── server-collection.ts      # 🏢 Enterprise collection management
│   └── server-runner.ts          # Individual server execution
├── middleware/                   # Complete middleware system
├── types/                        # TypeScript definitions
└── utils/                        # Reflection and utilities

tests/                            # 82 tests (4 test suites)
├── collection-features.test.ts   # 15 tests for direct class refs
├── middleware.test.ts            # 22 tests for middleware
├── zod-schemas.test.ts          # 31 tests for schemas
└── decorators-official-types.test.ts # 14 tests for MCP SDK

examples/
└── enhanced-collection-demo.ts   # Working example of new features
```

## 🚀 **How to Get Started Contributing**

### 1. Understand the Current System
```bash
# Run tests to see everything working
npm test  # Should show 82/82 passing

# Try the example
cd examples
npx tsx enhanced-collection-demo.ts
```

### 2. Key Files to Understand
1. **`src/decorators/collection.decorator.ts`** - The main innovation
2. **`src/server/server-collection.ts`** - Enterprise features
3. **`tests/collection-features.test.ts`** - How it all works
4. **`examples/enhanced-collection-demo.ts`** - Real usage

### 3. Follow the Rules
- **Always use direct class references** in collections
- Enable enterprise features (health monitoring, auto-restart, etc.)
- Write tests for any new features
- Follow TypeScript strict mode
- Use the existing middleware patterns

### 4. Current Development Priorities
1. **High**: Advanced monitoring and alerting integration
2. **Medium**: Scalability features for enterprise deployment
3. **Low**: Visual management interfaces and dashboards

## 💡 **Tips for Contributors**

### Before Making Changes
```bash
# Always run tests first
npm test

# Check current build
npm run build

# Review the examples
cat examples/enhanced-collection-demo.ts
```

### When Adding Features
- Follow the patterns in `collection-features.test.ts`
- Add enterprise configuration options to interfaces
- Test with both decorated and non-decorated classes
- Update the example file with new capabilities

### Testing Strategy
- Test direct class references thoroughly
- Test enterprise features (health, restart, shutdown)
- Test edge cases (missing decorators, invalid configs)
- Maintain 100% test pass rate

## 🔍 **Understanding the Architecture**

### The Collection System
```typescript
// The collection manages multiple servers as a unit
@CollectionDecorator({
  servers: [ServerA, ServerB, ServerC],  // Direct classes!
  healthCheck: { enabled: true },
  autoRestart: { enabled: true },
  gracefulShutdown: { enabled: true }
})
class MyCollection extends MCPServerCollection {}
```

### Enterprise Features
- **Health Monitoring**: Periodic checks with configurable intervals
- **Auto-Restart**: Exponential backoff with failure limits
- **Graceful Shutdown**: Clean termination with proper cleanup
- **Intercommunication**: Server-to-server messaging with shared context

### Middleware Integration
Full pipeline execution with before/after/error hooks, supporting:
- Logging, performance monitoring, authentication
- Rate limiting, validation, retry logic
- Custom middleware development

## 📞 **Need Help?**

1. **Check the tests**: `tests/collection-features.test.ts` shows every feature
2. **Run the example**: `examples/enhanced-collection-demo.ts` 
3. **Read the rules**: `.ai-context/rules.md` for coding standards
4. **Check goals**: `.ai-context/goals/` for future directions

The system is production-ready with 82 passing tests. Focus on understanding the direct class reference innovation and enterprise features - that's the core value proposition.