# Voltrix Framework - Consolidated AI Context

This directory contains the consolidated AI context configuration for the entire Voltrix monorepo, unifying information from all packages in a centralized and organized location.

## 📁 Consolidated Context Structure

### Main Files

- **`.ai-context.yaml`** - Main consolidated configuration with all package information
- **`PACKAGES-OVERVIEW.md`** - Detailed overview of all packages and their specific contexts
- **`CONSOLIDATED-TASKS.md`** - All implementation tasks organized by priority and package
- **`CONSOLIDATED-RULES.md`** - Unified development rules for all packages
- **`README.md`** - This documentation file

### Existing Directories
- **`tasks/`** - General monorepo tasks
- **`goals/`** - Project objectives and goals
- **`knowledge/`** - Shared technical knowledge
- **`templates/`** - Reusable code templates
- **`apis/`** - API documentation

## 🎯 Package Information

### @voltrix/express (Core Framework)
**Location:** `./packages/express/`  
**Status:** Initial Setup  
**Specific Context:** `./.ai-context/packages/express/`

**Main Features:**
- Express-compatible framework based on uWebSockets.js
- Performance targets: 50%+ faster than Fastify
- Core classes: App, Request, Response, Router, Middleware
- Critical safety rules for uWS integration

### @voltrix/decorator (Decorator System)  
**Location:** `./packages/decorator/`  
**Status:** Active Development  
**Specific Context:** `./.ai-context/packages/decorator/`

**Main Features:**
- Extensible decorator system with .extend() pattern
- Architecture: App → Module → Controller → Function
- High-performance dependency injection container
- 7 decorator categories (HTTP, Security, Middleware, etc.)

### @voltrix/tools (Development Tools)
**Location:** `./tools/`  
**Status:** Operational  

**Available Utilities:**
- `pnpm clean` - Build artifacts cleanup
- `pnpm analyze` - Project structure analysis
- `pnpm size:report` - Size and optimization report
- `pnpm deps:check` - Dependency audit

### @voltrix/benchs (Benchmarks)
**Location:** `./benchmarks/`  
**Status:** Maintenance  

**Purpose:**
- Performance regression detection
- Comparison with other frameworks
- Load testing utilities
- Memory usage profiling

## 🚀 Current High Priority Tasks

### Current Sprint: Core Framework Foundation

1. **Core Application Class** (@voltrix/express)
   - Implement Express method chaining
   - HTTP handlers: GET, POST, PUT, DELETE, PATCH, OPTIONS
   - Middleware registration and server listening

2. **Request Wrapper Class** (@voltrix/express)
   - Express-compatible properties
   - Header access methods and query parsing
   - Performance optimizations

3. **Extensible Decorator System** (@voltrix/decorator)
   - Base decorator class with .extend() method
   - Factory functions for custom decorators
   - Type-safe reflection system

## 📋 Unified Development Rules

### Universal Principles
1. **Performance First** - Every design decision prioritizes performance
2. **Type Safety** - Strict TypeScript with comprehensive type definitions
3. **Zero Overhead Abstractions** - Compile-time optimizations
4. **Express Compatibility** - Maintain familiar APIs where applicable
5. **Modular Architecture** - Clear separation of responsibilities

### Critical Rules by Package

#### Express Package
- **NEVER access uWS response after end()** - Will cause segmentation fault
- **Always handle onAborted()** - To prevent crashes in async operations
- **Zero allocations in hot paths** - Reuse objects, avoid `new`

#### Decorator Package  
- **Extensibility First** - Every decorator must support extension patterns
- **Metadata Driven** - Use reflect-metadata for storage
- **Performance Optimized** - Zero overhead in hot paths, lazy initialization

## 🔍 How to Use This Context

### For AI Agents
1. **Read `.ai-context.yaml`** - Main configuration and package information
2. **Consult `PACKAGES-OVERVIEW.md`** - For package-specific context
3. **Review `CONSOLIDATED-TASKS.md`** - For current implementation tasks
4. **Follow `CONSOLIDATED-RULES.md`** - For specific development rules

### For Developers
1. **Specific contexts** - Consult `./.ai-context/packages/{package}/` for details
2. **Active tasks** - See `CONSOLIDATED-TASKS.md` for current sprint
3. **Code rules** - Follow `CONSOLIDATED-RULES.md` for standards
4. **Tools** - Use `pnpm analyze` and other utilities for maintenance

## 🔄 Context Maintenance

### Information Updates
- **Synchronize contexts** - Maintain consistency between package and consolidated contexts
- **Update tasks** - Reflect progress in `CONSOLIDATED-TASKS.md`
- **Review rules** - Update rules based on development learnings
- **Document changes** - Maintain history of architectural changes

### Prefix Structure
To facilitate file identification by package:
- **`EXPRESS:`** - Files related to @voltrix/express
- **`DECORATOR:`** - Files related to @voltrix/decorator  
- **`TOOLS:`** - Files related to @voltrix/tools
- **`BENCHS:`** - Files related to @voltrix/benchs
- **`GLOBAL:`** - Files that affect the entire monorepo

## 📊 Performance Metrics

### Global Objectives
- **Framework-level:** 50%+ faster than Fastify
- **Latency:** Sub-millisecond P95 for cached responses  
- **Memory:** Zero allocations in hot paths
- **Throughput:** Handle 100k+ req/sec on modern hardware
- **Bundle size:** Minimal runtime overhead

### Current Status
- **Version:** 0.1.0
- **Milestone:** Core Framework Foundation  
- **Active Packages:** express, decorator
- **Maintenance Packages:** benchmarks, tools
- **Last Update:** 2025-10-10

---

## 🤝 Contributions

When working on the Voltrix project:
1. **Read relevant context** before making changes
2. **Follow development rules** specific to the package
3. **Update context** if you introduce architectural changes
4. **Maintain benchmarks** for changes affecting performance
5. **Document technical decisions** that are important

This consolidated context system facilitates coherent and efficient development across the entire monorepo, keeping information organized and accessible for developers and AI agents.