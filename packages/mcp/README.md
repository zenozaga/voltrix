# @voltrix/mcp

Ultra-lightweight Model Context Protocol (MCP) implementation with tree-shaking support and extensible plugin architecture.

## Features

- 🪶 **Ultra-lightweight**: Zero dependencies, optimal tree-shaking
- 🔧 **Type-safe**: 100% TypeScript with strict typing
- 🧩 **Plugin System**: Extensible with configurable IDs
- 🏗️ **Builder Pattern**: Fluent, validated configuration API
- 🌳 **Tree-shakable**: Import only what you need
- 🚀 **Performance-first**: Sub-millisecond response times

## Installation

```bash
npm install @voltrix/mcp
```

## Quick Start

### Types Only (Zero Runtime)

```typescript
import type { 
  McpServerInfo, 
  McpTool, 
  ChatGptPluginConfig 
} from '@voltrix/mcp';

// Use types without any runtime impact
const serverInfo: McpServerInfo = {
  name: 'my-server',
  version: '1.0.0'
};
```

### Protocol Utilities

```typescript
import { 
  isJsonRpcRequest, 
  MCP_ERROR_CODES 
} from '@voltrix/mcp';

// Tree-shakable utilities
if (isJsonRpcRequest(message)) {
  // Handle request
}
```

### Plugin System

```typescript
import type { 
  McpPlugin, 
  ChatGptPluginConfig 
} from '@voltrix/mcp/plugins';

// Define plugin with optional ID override
const plugin: McpPlugin<ChatGptPluginConfig> = {
  id: 'my-chatgpt-plugin', // Optional override
  name: 'ChatGPT Integration',
  version: '1.0.0'
  // ... plugin implementation
};
```

### Builder Pattern (Future)

```typescript
import type { 
  McpBuilder, 
  QuickConfig 
} from '@voltrix/mcp/builder';

// Type-safe builder configuration
const config: QuickConfig = {
  name: 'my-server',
  transport: { type: 'stdio' },
  plugins: [
    { name: 'chatgpt', id: 'custom-chatgpt-id' }
  ]
};
```

## Tree-shaking Examples

### Import Only What You Need

```typescript
// Protocol types only
import type { McpTool, McpResource } from '@voltrix/mcp';

// Specific utilities only
import { isJsonRpcRequest } from '@voltrix/mcp';

// Plugin types only
import type { ChatGptPluginConfig } from '@voltrix/mcp/plugins';

// Builder types only
import type { QuickConfig } from '@voltrix/mcp/builder';
```

### Modular Imports

```typescript
// All types (tree-shakable)
import { Types } from '@voltrix/mcp';

// All plugin utilities (tree-shakable)
import { Plugins } from '@voltrix/mcp';

// All builder utilities (tree-shakable)
import { Builder } from '@voltrix/mcp';
```

## Package Structure

```
@voltrix/mcp/
├── types/          # Core protocol types
├── plugins/        # Plugin system types
├── builder/        # Builder pattern types
└── index           # Main exports (tree-shakable)
```

## Bundle Size

- **Types only**: 0 bytes (compile-time only)
- **Minimal utilities**: <1KB gzipped
- **Full package**: <5KB gzipped
- **Tree-shaking**: Import only what you use

## Development Status

⚠️ **Early Development**: This package contains interfaces and types only. Implementations will be added in future releases.

Current status:
- ✅ TypeScript interfaces and types
- ✅ Tree-shakable architecture
- ✅ Plugin system design
- ⏳ Builder pattern implementation
- ⏳ Protocol implementations
- ⏳ Runtime server

## License

MIT