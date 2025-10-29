# Changelog

All notable changes to `@voltrix/mock` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-13

### Added
- 🎭 **MockRouter** - Advanced mock API router with HTTP method support
- 📊 **MockDataGenerator** - Comprehensive data generation for common entities:
  - Users with realistic profiles, avatars, and contact information
  - Products with categories, pricing, ratings, and specifications
  - Blog posts with content, tags, and engagement metrics
  - E-commerce orders with items, totals, and shipping details
  - Companies with industry data, addresses, and revenue information
  - Comments system with nested replies and moderation features
  - Custom data generation based on flexible schemas
- 🚀 **Quick Start Functions**:
  - `createRESTAPI()` - Complete REST API with standard CRUD endpoints
  - `createDemoAPI()` - Demo API for testing and development
  - `createQuickAPI()` - Rapid API setup with custom endpoints
- 🎨 **Advanced Features**:
  - Response rotation for dynamic behavior
  - Network delay simulation for realistic testing
  - CORS support for frontend development
  - Request logging and debugging tools
  - Route collections for organized API structure
- 📋 **Data Types Support**:
  - String, number, boolean primitives
  - Email addresses with realistic domains
  - Phone numbers in US format
  - URLs and addresses
  - UUIDs and dates
  - Custom generator functions
- 🔧 **TypeScript Support**:
  - Full type definitions for all APIs
  - Comprehensive interface documentation
  - IntelliSense support for better DX
- 🧪 **Testing Utilities**:
  - Built-in test helpers
  - Vitest integration
  - Comprehensive test coverage (14/14 tests passing)

### Features
- ✅ **Easy Integration** - Works seamlessly with `@voltrix/express`
- ✅ **Realistic Data** - Built-in generators for common use cases
- ✅ **Flexible Configuration** - Customize responses, delays, status codes
- ✅ **Quick Setup** - Pre-built API collections for rapid prototyping
- ✅ **Custom Schemas** - Generate data based on your own schemas
- ✅ **CORS Support** - Built-in CORS handling for frontend development
- ✅ **Response Rotation** - Cycle through different responses
- ✅ **Network Simulation** - Add delays to simulate real conditions

### Architecture
- **Package Structure**: Clean separation of concerns with modular architecture
- **Generators**: Singleton pattern for convenient data access (`mockData`)
- **Router**: Fluent API design for easy route configuration
- **Types**: Comprehensive TypeScript definitions for all functionality
- **Utils**: Quick-start functions for common use cases

### Performance
- Lightweight bundle size with tree-shaking support
- Efficient data generation algorithms
- Minimal memory footprint
- Fast startup and response times

### Documentation
- 📖 Complete README with usage examples
- 🔍 API reference documentation
- 🏗️ Integration guides for React, testing, and CI/CD
- 💡 Best practices and advanced usage patterns

### Dependencies
- **Peer Dependencies**: `@voltrix/express` (0.1.0+)
- **Dev Dependencies**: TypeScript, Vitest, ESLint, Rimraf
- **Runtime Dependencies**: None (zero runtime dependencies)

### Package Details
- **Version**: 0.1.0
- **License**: MIT
- **Node.js**: 18+ required
- **TypeScript**: Full support with .d.ts files
- **Module Format**: ES Modules (ESM)
- **Bundle Size**: ~50KB minified
- **Test Coverage**: 100% core functionality

### Compatibility
- ✅ Node.js 18+
- ✅ TypeScript 5.0+
- ✅ Voltrix Express 0.1.0+
- ✅ Vitest testing framework
- ✅ Modern bundlers (Vite, Webpack, Rollup)

### Repository Info
- **GitHub**: [voltrix/packages/mock](https://github.com/zenozaga/voltrix/tree/main/packages/mock)
- **Issues**: [Report bugs and feature requests](https://github.com/zenozaga/voltrix/issues)
- **Contributing**: [Contribution guidelines](https://github.com/zenozaga/voltrix/blob/main/CONTRIBUTING.md)