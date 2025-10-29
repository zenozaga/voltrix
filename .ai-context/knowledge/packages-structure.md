# Package-Specific AI Context

This folder contains AI-specific contexts for each package in the Voltrix monorepo, centralized from their original locations to facilitate global access.

## 📁 Structure

### 📦 express/
**Package:** `@voltrix/express` (Core Framework)  
**Code:** `./packages/express/`  
**Status:** Initial Setup

**Available files:**
- `.aicontext.yaml` - Express framework specific configuration
- `tasks.md` - Core framework implementation tasks
- `rules.md` - Express/uWebSockets specific development rules

**Description:** Express-compatible framework built on uWebSockets.js for maximum performance.

---

### 🎯 decorator/
**Package:** `@voltrix/decorator` (Decorator System)  
**Code:** `./packages/decorator/`  
**Status:** Active Development

**Available files:**
- `.aicontext.yaml` - Decorator system configuration
- `rules.md` - Decorator development rules and patterns
- `framework-architecture.md` - App→Module→Controller→Function framework architecture
- `framework-knowledge.md` - Framework technical knowledge

**Subdirectories:**
- `tasks/` - Decorator implementation specific tasks
- `knowledge/` - Technical knowledge base
- `templates/` - Code templates for decorators
- `apis/` - Specific API documentation

**Description:** Extensible decorator system with dependency injection and modular patterns.

---

## 🔄 Migration Completed

**Before:** Contexts were scattered in `./packages/{package}/.ai-context/`  
**Now:** Centralized in `./.ai-context/packages/{package}/`

### Centralization Benefits

1. **Global Access** - AI agents can access all information from a central point
2. **Coherent Organization** - Unified structure for all packages
3. **Simplified Maintenance** - Single location to manage contexts
4. **Complete Visibility** - Project overview from the root

### For AI Agents

**Main Context:** `./.ai-context.yaml` (consolidated information)  
**Specific Contexts:** `./.ai-context/packages/{package}/`  
**Global Tasks:** `./.ai-context/CONSOLIDATED-TASKS.md`  
**Global Rules:** `./.ai-context/CONSOLIDATED-RULES.md`

### For Developers

When working on a specific package:
1. **Consult the specific context** in `./.ai-context/packages/{package}/`
2. **Review global rules** in `./.ai-context/CONSOLIDATED-RULES.md`
3. **Check active tasks** in `./.ai-context/CONSOLIDATED-TASKS.md`
4. **Keep updated** the context when making architectural changes

---

## 📋 File Structure by Package

### Express Package
```
.ai-context/packages/express/
├── .aicontext.yaml          # Specific configuration
├── tasks.md                 # Implementation tasks
└── rules.md                 # Development rules
```

### Decorator Package  
```
.ai-context/packages/decorator/
├── .aicontext.yaml          # Specific configuration
├── rules.md                 # Decorator rules
├── framework-architecture.md # Framework architecture
├── framework-knowledge.md   # Technical knowledge
├── tasks/                   # Specific tasks
│   ├── README.md
│   ├── decorator-system-setup.md
│   ├── dependency-injection.md
│   └── extensibility-implementation.md
├── knowledge/               # Knowledge base
│   ├── README.md
│   ├── controller-decorator.md
│   └── decorator-patterns.md
├── templates/               # Code templates
│   ├── README.md
│   └── extensible-decorator.md
└── apis/                    # API documentation
```

This centralized structure maintains the specific organization of each package while providing global access for AI agents and developers.