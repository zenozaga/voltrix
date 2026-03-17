# @voltrix/tools

Development tools and utilities for maintaining the Voltrix monorepo. This package provides command-line tools for cleaning, analyzing, and maintaining the project structure.

## 🛠️ Available Tools

### 🧹 Project Cleaner
```bash
npm run clean              # Clean build artifacts and cache (default)
npm run clean:dist         # Clean only build outputs (dist/, build/)  
npm run clean:node-modules # Clean all node_modules directories
npm run clean:cache        # Clean cache files and test coverage
npm run clean:all          # Clean everything (nuclear option)
```

**What gets cleaned:**
- **Build artifacts**: `dist/`, `build/`, `.tsbuildinfo`
- **Dependencies**: `node_modules/` directories  
- **Cache files**: `.turbo/`, `.vite/`, `coverage/`, `.eslintcache`
- **Log files**: `*.log`, `npm-debug.log*`, `yarn-error.log*`

### 🔄 Project Reset
```bash
npm run reset              # Full project reset with rebuild
npm run reset --quick      # Quick reset (clean + build only)
npm run reset --full       # Nuclear reset (includes node_modules)
```

**Reset process:**
1. Clean build artifacts and cache
2. Optionally remove node_modules (with `--full`)
3. Install root dependencies
4. Install workspace dependencies  
5. Build all packages
6. Run type checking (unless `--no-type-check`)

### 📊 Project Analyzer
```bash
npm run analyze            # Analyze project structure and health
npm run analyze --detailed # Detailed per-package breakdown
```

**Analysis includes:**
- Package overview with file counts and sizes
- Dependency analysis and inconsistencies
- Health check for missing tests, large builds
- Recommendations for optimization

### 🔍 Dependency Checker
```bash
npm run deps:check         # Check dependencies for issues
```

**Checks for:**
- Outdated dependencies
- Security vulnerabilities  
- Version inconsistencies across packages
- Duplicate dependencies (prod vs dev)
- Missing `workspace:` protocol usage

### 📏 Size Reporter
```bash
npm run size:report        # Generate detailed size analysis
```

**Size analysis:**
- Per-package size breakdown (source, built, dependencies)
- Largest files and packages identification
- Optimization suggestions
- Total project size distribution

## 🚀 Quick Start

```bash
# Install dependencies
cd tools && pnpm install

# Clean the project
npm run clean

# Analyze project health  
npm run analyze

# Check for dependency issues
npm run deps:check

# Get size report
npm run size:report

# Nuclear reset (when things go wrong)
npm run reset --full
```

## 📋 Use Cases

### 🔧 Daily Development
```bash
npm run clean              # Before committing
npm run analyze            # Weekly health check
```

### 🚨 When Things Break
```bash
npm run reset --full       # Nuclear option
npm run deps:check         # Find dependency issues
```

### 📦 Before Release
```bash
npm run clean:all          # Clean everything
npm run size:report        # Check bundle sizes
npm run deps:check         # Security audit
```

### 🧹 Regular Maintenance  
```bash
npm run clean:node-modules # Free up disk space
npm run analyze --detailed # Deep project review
```

## 🎛️ Configuration

### Environment Variables
- `DEBUG=voltrix:tools` - Enable debug logging
- `CLEAN_TIMEOUT=30000` - Timeout for cleanup operations

### Ignored Patterns
The tools automatically ignore:
- `.git/` directories
- Deep `node_modules` nesting
- Binary files and images
- Editor temporary files

## 📊 Output Examples

### Clean Operation
```
🧹 Cleaning: Build artifacts (dist/, build/, .tsbuildinfo)
✅ Cleaned 45 files and 12 directories (23.4 MB freed)

🧹 Cleaning: Cache files and test coverage  
✅ Cleaned 156 files and 8 directories (67.8 MB freed)

✨ Cleaning completed!
📊 Summary:
   Files removed: 201
   Directories removed: 20  
   Space freed: 91.2 MB
   Time taken: 1,247ms
```

### Analysis Report
```
📦 Package Overview:
| @voltrix/express          | 0.1.0   | 42   | 15   | 2.3 MB   | Public |
| @voltrix/decorator        | 0.1.0   | 28   | 12   | 1.8 MB   | Public |
| @voltrix/benchs           | 0.1.0   | 15   | 0    | 45.2 MB  | Private|

📈 Project Summary:
   Total packages: 3
   Source files: 85
   Test files: 27
   Unique dependencies: 42
   Total project size: 156.7 MB

🔍 Health Check:
   ✅ No issues found
```

## 🔧 Extending the Tools

### Adding New Clean Targets
Edit `scripts/clean.js` and add to `CLEAN_TARGETS`:

```javascript
const CLEAN_TARGETS = {
  myCustom: {
    patterns: ['**/my-files/**', '**/*.tmp'],
    description: 'My custom files'  
  }
};
```

### Custom Analysis
Extend `ProjectAnalyzer` class in `scripts/analyze.js`:

```javascript
async customCheck(packages) {
  // Your custom analysis logic
}
```

### New Tools
Create new scripts in `scripts/` directory following the existing patterns:
- Use `ora` for spinners
- Use `chalk` for colors  
- Use `commander` for CLI parsing
- Handle errors gracefully

## 🚨 Safety Features

- **Confirmation prompts** for destructive operations
- **Backup recommendations** before major changes
- **Graceful error handling** with partial cleanup
- **Timeout protection** for long operations
- **Dry-run modes** for testing (where applicable)

## 📚 Dependencies

- **chalk** - Terminal colors and styling
- **ora** - Elegant terminal spinners  
- **commander** - CLI argument parsing
- **glob** - File pattern matching
- **filesize** - Human-readable file sizes

## 🤝 Contributing

1. Add new tools in `scripts/` directory
2. Update `package.json` scripts section
3. Add documentation to this README
4. Test thoroughly with various project states
5. Handle edge cases and errors gracefully

## 📄 License

MIT - See LICENSE file for details