#!/usr/bin/env node

/**
 * Voltrix Size Report
 * Generates detailed size reports for built packages
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'fast-glob';
import chalk from 'chalk';
import ora from 'ora';
import { filesize } from 'filesize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

class SizeReporter {
  constructor() {
    this.packages = [];
    this.totalSizes = {
      source: 0,
      built: 0,
      dependencies: 0,
      total: 0
    };
  }

  async getFileStats(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      return { size: 0, isDirectory: false, isFile: false };
    }
  }

  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const { size, files } = await this.calculateDirectorySize(fullPath);
          totalSize += size;
          fileCount += files;
        } else if (entry.isFile()) {
          const stats = await this.getFileStats(fullPath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return { size: totalSize, files: fileCount };
  }

  async analyzePackageSize(packagePath) {
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const packageName = packageJson.name || path.basename(packagePath);
      
      // Analyze different directories
      const srcSize = await this.calculateDirectorySize(path.join(packagePath, 'src'));
      const distSize = await this.calculateDirectorySize(path.join(packagePath, 'dist'));
      const buildSize = await this.calculateDirectorySize(path.join(packagePath, 'build'));
      const nodeModulesSize = await this.calculateDirectorySize(path.join(packagePath, 'node_modules'));
      const testsSize = await this.calculateDirectorySize(path.join(packagePath, 'tests'));
      
      // Find largest files in dist
      const distFiles = await this.getLargestFiles(path.join(packagePath, 'dist'));
      
      const packageInfo = {
        name: packageName,
        version: packageJson.version || '0.0.0',
        path: path.relative(rootDir, packagePath),
        sizes: {
          source: srcSize,
          dist: distSize,
          build: buildSize,
          nodeModules: nodeModulesSize,
          tests: testsSize,
          total: srcSize.size + distSize.size + buildSize.size + nodeModulesSize.size
        },
        largestFiles: distFiles,
        scripts: Object.keys(packageJson.scripts || {}),
        hasTypings: !!packageJson.types || !!packageJson.typings
      };
      
      // Update totals
      this.totalSizes.source += srcSize.size;
      this.totalSizes.built += distSize.size + buildSize.size;
      this.totalSizes.dependencies += nodeModulesSize.size;
      this.totalSizes.total += packageInfo.sizes.total;
      
      return packageInfo;
      
    } catch (error) {
      return null;
    }
  }

  async getLargestFiles(dirPath, limit = 5) {
    const files = [];
    
    try {
      const allFiles = await glob('**/*', {
        cwd: dirPath,
        nodir: true,
        absolute: false
      });
      
      for (const file of allFiles) {
        const fullPath = path.join(dirPath, file);
        const stats = await this.getFileStats(fullPath);
        
        if (stats.isFile) {
          files.push({
            path: file,
            size: stats.size,
            readable: filesize(stats.size)
          });
        }
      }
      
      // Sort by size and take top N
      return files
        .sort((a, b) => b.size - a.size)
        .slice(0, limit);
        
    } catch (error) {
      return [];
    }
  }

  async findAllPackages() {
    const packagePaths = await glob('**/package.json', {
      cwd: rootDir,
      ignore: ['**/node_modules/**']
    });

    const packages = [];
    
    for (const packagePath of packagePaths) {
      const fullPath = path.dirname(path.join(rootDir, packagePath));
      const packageInfo = await this.analyzePackageSize(fullPath);
      
      if (packageInfo) {
        packages.push(packageInfo);
      }
    }
    
    return packages.sort((a, b) => b.sizes.total - a.sizes.total);
  }

  displayPackageTable(packages) {
    console.log(chalk.bold('\\n📦 Package Size Breakdown:'));
    console.log('─'.repeat(120));
    console.log(chalk.gray('| Package Name              | Source    | Built     | Deps      | Total     | Files |'));
    console.log('─'.repeat(120));
    
    for (const pkg of packages) {
      const name = pkg.name.substring(0, 24).padEnd(24);
      const source = filesize(pkg.sizes.source.size).padEnd(8);
      const built = filesize(pkg.sizes.dist.size + pkg.sizes.build.size).padEnd(8);
      const deps = filesize(pkg.sizes.nodeModules.size).padEnd(8);
      const total = filesize(pkg.sizes.total).padEnd(8);
      const files = (pkg.sizes.source.files + pkg.sizes.dist.files).toString().padEnd(4);
      
      console.log(`| ${name} | ${source} | ${built} | ${deps} | ${total} | ${files} |`);
    }
    console.log('─'.repeat(120));
  }

  displaySizeSummary() {
    console.log(chalk.bold('\\n📊 Size Summary:'));
    console.log(`   Source code: ${chalk.cyan(filesize(this.totalSizes.source))}`);
    console.log(`   Built artifacts: ${chalk.yellow(filesize(this.totalSizes.built))}`);
    console.log(`   Dependencies: ${chalk.red(filesize(this.totalSizes.dependencies))}`);
    console.log(`   ${chalk.bold('Total project size:')} ${chalk.bold.cyan(filesize(this.totalSizes.total))}`);
    
    // Calculate percentages
    const sourcePercent = ((this.totalSizes.source / this.totalSizes.total) * 100).toFixed(1);
    const builtPercent = ((this.totalSizes.built / this.totalSizes.total) * 100).toFixed(1);
    const depsPercent = ((this.totalSizes.dependencies / this.totalSizes.total) * 100).toFixed(1);
    
    console.log(chalk.gray(`\\n   Distribution: ${sourcePercent}% source, ${builtPercent}% built, ${depsPercent}% dependencies`));
  }

  displayLargestPackages(packages) {
    console.log(chalk.bold('\\n🏆 Largest Packages:'));
    
    const top5 = packages.slice(0, 5);
    
    top5.forEach((pkg, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      console.log(`${medal} ${index + 1}. ${chalk.cyan(pkg.name)} - ${chalk.bold(filesize(pkg.sizes.total))}`);
      
      if (pkg.largestFiles.length > 0) {
        console.log(chalk.gray(`     Largest files:`));
        pkg.largestFiles.slice(0, 3).forEach(file => {
          console.log(chalk.gray(`       ${file.path} (${file.readable})`));
        });
      }
    });
  }

  displayOptimizationSuggestions(packages) {
    console.log(chalk.bold('\\n💡 Optimization Suggestions:'));
    
    const suggestions = [];
    
    // Large dependencies
    const heavyDepPackages = packages.filter(p => p.sizes.nodeModules.size > 100 * 1024 * 1024); // 100MB
    if (heavyDepPackages.length > 0) {
      suggestions.push(`Consider dependency cleanup for: ${heavyDepPackages.map(p => p.name).join(', ')}`);
    }
    
    // Large build outputs
    const largeBuildPackages = packages.filter(p => (p.sizes.dist.size + p.sizes.build.size) > 10 * 1024 * 1024); // 10MB
    if (largeBuildPackages.length > 0) {
      suggestions.push(`Review build output size for: ${largeBuildPackages.map(p => p.name).join(', ')}`);
    }
    
    // Packages without built artifacts
    const unbuildPackages = packages.filter(p => p.sizes.dist.size === 0 && p.sizes.build.size === 0 && p.sizes.source.size > 0);
    if (unbuildPackages.length > 0) {
      suggestions.push(`Consider building: ${unbuildPackages.map(p => p.name).join(', ')}`);
    }
    
    // Total size warnings
    if (this.totalSizes.total > 1024 * 1024 * 1024) { // 1GB
      suggestions.push('Project size is very large (>1GB), consider cleanup');
    }
    
    if (this.totalSizes.dependencies > 500 * 1024 * 1024) { // 500MB
      suggestions.push('Dependencies are heavy (>500MB), consider pruning');
    }
    
    if (suggestions.length === 0) {
      console.log(chalk.green('   ✅ No obvious optimization opportunities found'));
    } else {
      suggestions.forEach(suggestion => {
        console.log(`   🔧 ${suggestion}`);
      });
    }
    
    console.log(chalk.gray('\\n   🧹 Run tools/clean.js to free up space'));
    console.log(chalk.gray('   📊 Use bundle analyzers for detailed build analysis'));
  }

  async generateReport() {
    console.log(chalk.bold.cyan('📏 Voltrix Size Report\\n'));
    
    const spinner = ora('Analyzing package sizes...').start();
    
    try {
      const packages = await this.findAllPackages();
      
      spinner.succeed(`Analyzed ${packages.length} packages`);
      
      this.displayPackageTable(packages);
      this.displaySizeSummary();
      this.displayLargestPackages(packages);
      this.displayOptimizationSuggestions(packages);
      
      console.log(chalk.bold.green('\\n✅ Size analysis completed!'));
      
    } catch (error) {
      spinner.fail(chalk.red(`Size analysis failed: ${error.message}`));
      throw error;
    }
  }
}

async function main() {
  const reporter = new SizeReporter();
  await reporter.generateReport();
}

main().catch(console.error);