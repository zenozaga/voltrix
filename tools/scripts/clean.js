#!/usr/bin/env node

/**
 * Voltrix Project Cleaner
 * Removes build artifacts, dependencies, and cache files from the monorepo
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import glob from 'fast-glob';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';
import { filesize } from 'filesize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Configuration for what to clean
const CLEAN_TARGETS = {
  dist: {
    patterns: [
      '**/dist/**',
      '**/build/**',
      '**/.tsbuildinfo',
      '**/tsconfig.tsbuildinfo'
    ],
    description: 'Build artifacts (dist/, build/, .tsbuildinfo)'
  },
  nodeModules: {
    patterns: [
      '**/node_modules/**'
    ],
    description: 'Node.js dependencies (node_modules/)'
  },
  cache: {
    patterns: [
      '**/.turbo/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.vite/**',
      '**/.vitest/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/junit.xml',
      '**/.eslintcache'
    ],
    description: 'Cache files and test coverage'
  },
  logs: {
    patterns: [
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/lerna-debug.log*',
      '**/*.log'
    ],
    description: 'Log files'
  }
};

class ProjectCleaner {
  constructor() {
    this.totalSize = 0;
    this.deletedFiles = 0;
    this.deletedDirs = 0;
  }

  async calculateSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        const files = await fs.readdir(filePath);
        let size = 0;
        for (const file of files) {
          const fullPath = path.join(filePath, file);
          size += await this.calculateSize(fullPath);
        }
        return size;
      } else {
        return stats.size;
      }
    } catch (error) {
      return 0;
    }
  }

  async removeRecursively(targetPath) {
    try {
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(targetPath);
        
        // Remove all contents first
        for (const file of files) {
          const fullPath = path.join(targetPath, file);
          await this.removeRecursively(fullPath);
        }
        
        // Then remove the directory itself
        await fs.rmdir(targetPath);
        this.deletedDirs++;
      } else {
        await fs.unlink(targetPath);
        this.deletedFiles++;
      }
    } catch (error) {
      // Ignore errors for files that don't exist or can't be deleted
    }
  }

  async cleanByPatterns(patterns, description) {
    console.log(chalk.blue(`\\n🧹 Cleaning: ${description}`));
    
    const spinner = ora('Scanning for files...').start();
    
    try {
      let allMatches = [];
      
      for (const pattern of patterns) {
        const matches = await glob(pattern, {
          cwd: rootDir,
          absolute: true,
          ignore: [
            '**/node_modules/**/node_modules/**', // Avoid deep node_modules
            '**/.git/**'
          ]
        });
        allMatches = [...allMatches, ...matches];
      }

      // Remove duplicates and sort
      const uniqueMatches = [...new Set(allMatches)].sort();
      
      if (uniqueMatches.length === 0) {
        spinner.succeed(chalk.green('No files found to clean'));
        return;
      }

      spinner.text = `Calculating size of ${uniqueMatches.length} items...`;
      
      // Calculate total size before deletion
      let totalSize = 0;
      for (const match of uniqueMatches) {
        totalSize += await this.calculateSize(match);
      }

      spinner.text = `Removing ${uniqueMatches.length} items (${filesize(totalSize)})...`;

      // Remove files/directories
      const beforeFiles = this.deletedFiles;
      const beforeDirs = this.deletedDirs;
      
      for (const match of uniqueMatches) {
        await this.removeRecursively(match);
      }
      
      const filesRemoved = this.deletedFiles - beforeFiles;
      const dirsRemoved = this.deletedDirs - beforeDirs;
      
      this.totalSize += totalSize;
      
      spinner.succeed(chalk.green(
        `Cleaned ${filesRemoved} files and ${dirsRemoved} directories (${filesize(totalSize)} freed)`
      ));

    } catch (error) {
      spinner.fail(chalk.red(`Error cleaning: ${error.message}`));
    }
  }

  async clean(targets = ['dist', 'cache', 'logs']) {
    console.log(chalk.bold.cyan('🚀 Voltrix Project Cleaner\\n'));
    console.log(chalk.gray(`Working directory: ${rootDir}`));
    
    const startTime = Date.now();
    
    for (const target of targets) {
      if (CLEAN_TARGETS[target]) {
        await this.cleanByPatterns(
          CLEAN_TARGETS[target].patterns,
          CLEAN_TARGETS[target].description
        );
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(chalk.bold.green('\\n✨ Cleaning completed!'));
    console.log(chalk.gray(`📊 Summary:`));
    console.log(chalk.gray(`   Files removed: ${this.deletedFiles}`));
    console.log(chalk.gray(`   Directories removed: ${this.deletedDirs}`));
    console.log(chalk.gray(`   Space freed: ${filesize(this.totalSize)}`));
    console.log(chalk.gray(`   Time taken: ${duration}ms`));
  }

  async analyze() {
    console.log(chalk.bold.cyan('📊 Project Size Analysis\\n'));
    
    const spinner = ora('Analyzing project structure...').start();
    
    try {
      const analysis = {};
      
      for (const [key, config] of Object.entries(CLEAN_TARGETS)) {
        spinner.text = `Analyzing ${config.description}...`;
        
        let totalSize = 0;
        let fileCount = 0;
        
        for (const pattern of config.patterns) {
          const matches = await glob(pattern, {
            cwd: rootDir,
            absolute: true,
            ignore: ['**/.git/**']
          });
          
          for (const match of matches) {
            const size = await this.calculateSize(match);
            totalSize += size;
            
            try {
              const stats = await fs.stat(match);
              if (stats.isFile()) {
                fileCount++;
              }
            } catch (error) {
              // Ignore
            }
          }
        }
        
        analysis[key] = {
          description: config.description,
          size: totalSize,
          files: fileCount,
          readable: filesize(totalSize)
        };
      }
      
      spinner.succeed('Analysis completed');
      
      console.log(chalk.bold('\\n📈 Size Breakdown:'));
      console.log('─'.repeat(70));
      console.log(chalk.gray('| Category          | Files     | Size        | Description'));
      console.log('─'.repeat(70));
      
      for (const [key, data] of Object.entries(analysis)) {
        const category = key.padEnd(16);
        const files = data.files.toString().padEnd(8);
        const size = data.readable.padEnd(10);
        
        console.log(`| ${category} | ${files} | ${size} | ${data.description}`);
      }
      console.log('─'.repeat(70));
      
      const totalSize = Object.values(analysis).reduce((sum, item) => sum + item.size, 0);
      const totalFiles = Object.values(analysis).reduce((sum, item) => sum + item.files, 0);
      
      console.log(chalk.bold(`\\nTotal reclaimable space: ${filesize(totalSize)} (${totalFiles} files)`));
      
    } catch (error) {
      spinner.fail(chalk.red(`Analysis failed: ${error.message}`));
    }
  }
}

// CLI Setup
program
  .name('clean')
  .description('Clean build artifacts, dependencies, and cache files from Voltrix monorepo')
  .version('1.0.0');

program
  .option('--dist', 'Clean only build artifacts (dist, build)')
  .option('--node-modules', 'Clean only node_modules directories')
  .option('--cache', 'Clean only cache files')
  .option('--logs', 'Clean only log files')
  .option('--all', 'Clean everything (dist, node_modules, cache, logs)')
  .option('--analyze', 'Show size analysis without cleaning')
  .parse();

const options = program.opts();

async function main() {
  const cleaner = new ProjectCleaner();
  
  if (options.analyze) {
    await cleaner.analyze();
    return;
  }
  
  let targets = [];
  
  if (options.all) {
    targets = ['dist', 'nodeModules', 'cache', 'logs'];
  } else {
    if (options.dist) targets.push('dist');
    if (options.nodeModules) targets.push('nodeModules');
    if (options.cache) targets.push('cache');
    if (options.logs) targets.push('logs');
    
    // Default behavior if no specific options
    if (targets.length === 0) {
      targets = ['dist', 'cache', 'logs']; // Don't remove node_modules by default
    }
  }
  
  await cleaner.clean(targets);
}

main().catch(console.error);