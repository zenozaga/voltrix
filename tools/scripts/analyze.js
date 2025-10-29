#!/usr/bin/env node

/**
 * Voltrix Project Analyzer
 * Analyzes project structure, dependencies, and health
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

class ProjectAnalyzer {
  constructor() {
    this.packages = new Map();
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      typeScriptFiles: 0,
      testFiles: 0,
      configFiles: 0
    };
  }

  async analyzePackage(packagePath) {
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const relativePath = path.relative(rootDir, packagePath);
      
      // Analyze package structure
      const srcFiles = await this.countFiles(packagePath, '**/*.{ts,js,tsx,jsx}');
      const testFiles = await this.countFiles(packagePath, '**/*.{test,spec}.{ts,js,tsx,jsx}');
      const distSize = await this.getDirectorySize(path.join(packagePath, 'dist'));
      const nodeModulesSize = await this.getDirectorySize(path.join(packagePath, 'node_modules'));
      
      const packageInfo = {
        name: packageJson.name || path.basename(packagePath),
        version: packageJson.version || '0.0.0',
        description: packageJson.description || '',
        private: packageJson.private || false,
        path: relativePath,
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        scripts: Object.keys(packageJson.scripts || {}),
        srcFiles: srcFiles.count,
        testFiles: testFiles.count,
        distSize,
        nodeModulesSize,
        totalSize: distSize + nodeModulesSize
      };
      
      this.packages.set(packageInfo.name, packageInfo);
      return packageInfo;
      
    } catch (error) {
      return null;
    }
  }

  async countFiles(dir, pattern) {
    try {
      const files = await glob(pattern, {
        cwd: dir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
      });
      
      let totalSize = 0;
      for (const file of files) {
        try {
          const stats = await fs.stat(path.join(dir, file));
          totalSize += stats.size;
        } catch (error) {
          // Ignore
        }
      }
      
      return { count: files.length, size: totalSize };
    } catch (error) {
      return { count: 0, size: 0 };
    }
  }

  async getDirectorySize(dir) {
    try {
      const stats = await fs.stat(dir);
      if (!stats.isDirectory()) return 0;
      
      return await this.calculateDirSize(dir);
    } catch (error) {
      return 0;
    }
  }

  async calculateDirSize(dir) {
    let size = 0;
    
    try {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          size += await this.calculateDirSize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return size;
  }

  async findPackages() {
    const packagePaths = await glob('**/package.json', {
      cwd: rootDir,
      ignore: ['**/node_modules/**']
    });
    
    const packages = [];
    
    for (const packagePath of packagePaths) {
      const fullPath = path.dirname(path.join(rootDir, packagePath));
      const packageInfo = await this.analyzePackage(fullPath);
      
      if (packageInfo) {
        packages.push(packageInfo);
      }
    }
    
    return packages;
  }

  async analyzeProject() {
    console.log(chalk.bold.cyan('📊 Voltrix Project Analysis\\n'));
    
    const spinner = ora('Scanning packages...').start();
    
    try {
      const packages = await this.findPackages();
      
      spinner.text = 'Analyzing package structures...';
      
      // Calculate totals
      let totalDeps = new Set();
      let totalDevDeps = new Set();
      let totalScripts = new Set();
      let totalSrcFiles = 0;
      let totalTestFiles = 0;
      let totalDistSize = 0;
      let totalNodeModulesSize = 0;
      
      for (const pkg of packages) {
        pkg.dependencies.forEach(dep => totalDeps.add(dep));
        pkg.devDependencies.forEach(dep => totalDevDeps.add(dep));
        pkg.scripts.forEach(script => totalScripts.add(script));
        totalSrcFiles += pkg.srcFiles;
        totalTestFiles += pkg.testFiles;
        totalDistSize += pkg.distSize;
        totalNodeModulesSize += pkg.nodeModulesSize;
      }
      
      spinner.succeed(chalk.green(`Found ${packages.length} packages`));
      
      // Display overview
      console.log(chalk.bold('\\n📦 Package Overview:'));
      console.log('─'.repeat(100));
      console.log(chalk.gray('| Package Name              | Version  | Files | Tests | Dist Size | Type    |'));
      console.log('─'.repeat(100));
      
      for (const pkg of packages.sort((a, b) => a.name.localeCompare(b.name))) {
        const name = pkg.name.padEnd(24);
        const version = pkg.version.padEnd(7);
        const files = pkg.srcFiles.toString().padEnd(4);
        const tests = pkg.testFiles.toString().padEnd(4);
        const distSize = filesize(pkg.distSize).padEnd(8);
        const type = (pkg.private ? 'Private' : 'Public').padEnd(6);
        
        console.log(`| ${name} | ${version} | ${files} | ${tests} | ${distSize} | ${type} |`);
      }
      console.log('─'.repeat(100));
      
      // Display summary
      console.log(chalk.bold('\\n📈 Project Summary:'));
      console.log(`   Total packages: ${chalk.cyan(packages.length)}`);
      console.log(`   Source files: ${chalk.cyan(totalSrcFiles)}`);
      console.log(`   Test files: ${chalk.cyan(totalTestFiles)}`);
      console.log(`   Unique dependencies: ${chalk.cyan(totalDeps.size)}`);
      console.log(`   Unique dev dependencies: ${chalk.cyan(totalDevDeps.size)}`);
      console.log(`   Total scripts: ${chalk.cyan(totalScripts.size)}`);
      
      // Display size analysis
      console.log(chalk.bold('\\n💾 Size Analysis:'));
      console.log(`   Built artifacts (dist/): ${chalk.yellow(filesize(totalDistSize))}`);
      console.log(`   Dependencies (node_modules/): ${chalk.red(filesize(totalNodeModulesSize))}`);
      console.log(`   Total project size: ${chalk.cyan(filesize(totalDistSize + totalNodeModulesSize))}`);
      
      // Find potential issues
      console.log(chalk.bold('\\n🔍 Health Check:'));
      
      const issues = [];
      
      // Check for packages without tests
      const packagesWithoutTests = packages.filter(p => p.testFiles === 0 && !p.private);
      if (packagesWithoutTests.length > 0) {
        issues.push(`${packagesWithoutTests.length} public packages without tests`);
      }
      
      // Check for large dist directories
      const largeDistPackages = packages.filter(p => p.distSize > 10 * 1024 * 1024); // 10MB
      if (largeDistPackages.length > 0) {
        issues.push(`${largeDistPackages.length} packages with large dist/ directories`);
      }
      
      // Check for outdated versions
      const versionPattern = /^0\\.0\\./;
      const preReleasePackages = packages.filter(p => versionPattern.test(p.version));
      if (preReleasePackages.length > 0) {
        issues.push(`${preReleasePackages.length} packages still in pre-release (0.0.x)`);
      }
      
      if (issues.length === 0) {
        console.log(chalk.green('   ✅ No issues found'));
      } else {
        issues.forEach(issue => {
          console.log(chalk.yellow(`   ⚠️  ${issue}`));
        });
      }
      
      // Recommendations
      console.log(chalk.bold('\\n💡 Recommendations:'));
      
      if (totalNodeModulesSize > 500 * 1024 * 1024) { // 500MB
        console.log(chalk.gray('   🧹 Consider running clean:node-modules to free up space'));
      }
      
      if (totalDistSize > 100 * 1024 * 1024) { // 100MB
        console.log(chalk.gray('   🏗️  Large build artifacts detected, consider clean:dist'));
      }
      
      const testCoverage = totalTestFiles / Math.max(totalSrcFiles, 1);
      if (testCoverage < 0.3) {
        console.log(chalk.gray('   🧪 Consider adding more tests (current coverage appears low)'));
      }
      
      console.log(chalk.gray('   📊 Run with --detailed for per-package breakdown'));
      
    } catch (error) {
      spinner.fail(chalk.red(`Analysis failed: ${error.message}`));
      throw error;
    }
  }

  async detailedAnalysis() {
    console.log(chalk.bold.cyan('🔬 Detailed Package Analysis\\n'));
    
    const packages = await this.findPackages();
    
    for (const pkg of packages) {
      console.log(chalk.bold(`\\n📦 ${pkg.name} v${pkg.version}`));
      console.log(chalk.gray(`   Path: ${pkg.path}`));
      console.log(chalk.gray(`   Description: ${pkg.description || 'No description'}`));
      console.log(`   Files: ${pkg.srcFiles} source, ${pkg.testFiles} tests`);
      console.log(`   Size: ${filesize(pkg.totalSize)} (dist: ${filesize(pkg.distSize)}, deps: ${filesize(pkg.nodeModulesSize)})`);
      
      if (pkg.dependencies.length > 0) {
        console.log(`   Dependencies (${pkg.dependencies.length}): ${pkg.dependencies.slice(0, 5).join(', ')}${pkg.dependencies.length > 5 ? '...' : ''}`);
      }
      
      if (pkg.scripts.length > 0) {
        console.log(`   Scripts: ${pkg.scripts.join(', ')}`);
      }
    }
  }
}

// CLI handling
const args = process.argv.slice(2);
const detailed = args.includes('--detailed');

async function main() {
  const analyzer = new ProjectAnalyzer();
  
  if (detailed) {
    await analyzer.detailedAnalysis();
  } else {
    await analyzer.analyzeProject();
  }
}

main().catch(console.error);