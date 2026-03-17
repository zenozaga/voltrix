#!/usr/bin/env node

/**
 * Voltrix Project Reset
 * Complete project reset with fresh installation
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';

class ProjectReset {
  constructor() {
    this.steps = [];
    this.currentStep = 0;
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: options.silent ? 'pipe' : 'inherit',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (options.silent) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || 'Unknown error'}`));
        }
      });

      child.on('error', reject);
    });
  }

  async executeStep(description, command, args = [], options = {}) {
    this.currentStep++;
    const stepInfo = `(${this.currentStep}/${this.steps.length})`;
    
    const spinner = ora(`${stepInfo} ${description}...`).start();
    
    try {
      await this.runCommand(command, args, options);
      spinner.succeed(chalk.green(`${stepInfo} ${description}`));
    } catch (error) {
      spinner.fail(chalk.red(`${stepInfo} ${description} - ${error.message}`));
      throw error;
    }
  }

  async reset(options = {}) {
    console.log(chalk.bold.cyan('🔄 Voltrix Project Reset\\n'));
    
    this.steps = [
      'Clean build artifacts',
      'Clean dependencies', 
      'Clean cache files',
      'Install root dependencies',
      'Install workspace dependencies',
      'Build all packages',
      'Run type checking'
    ];

    try {
      // Step 1: Clean build artifacts
      await this.executeStep(
        'Clean build artifacts',
        'node',
        ['scripts/clean.js', '--dist'],
        { cwd: process.cwd() }
      );

      // Step 2: Clean dependencies
      if (options.full) {
        await this.executeStep(
          'Clean dependencies',
          'node', 
          ['scripts/clean.js', '--node-modules'],
          { cwd: process.cwd() }
        );
      }

      // Step 3: Clean cache
      await this.executeStep(
        'Clean cache files',
        'node',
        ['scripts/clean.js', '--cache'],
        { cwd: process.cwd() }
      );

      // Step 4: Install root dependencies
      await this.executeStep(
        'Install root dependencies',
        'pnpm',
        ['install'],
        { cwd: '../../' }
      );

      // Step 5: Install workspace dependencies  
      await this.executeStep(
        'Install workspace dependencies',
        'pnpm',
        ['install', '-r'],
        { cwd: '../../' }
      );

      // Step 6: Build all packages
      await this.executeStep(
        'Build all packages',
        'pnpm',
        ['run', 'build'],
        { cwd: '../../' }
      );

      // Step 7: Type checking
      if (options.typeCheck) {
        await this.executeStep(
          'Run type checking',
          'pnpm',
          ['run', 'type-check'],
          { cwd: '../../' }
        );
      }

      console.log(chalk.bold.green('\\n✅ Project reset completed successfully!'));
      console.log(chalk.gray('\\n📋 Next steps:'));
      console.log(chalk.gray('  - Run tests: pnpm test'));
      console.log(chalk.gray('  - Start development: pnpm dev'));
      console.log(chalk.gray('  - Run benchmarks: npm run bench'));

    } catch (error) {
      console.log(chalk.bold.red('\\n❌ Reset failed!'));
      console.log(chalk.red(`Error: ${error.message}`));
      console.log(chalk.gray('\\nYou may need to manually fix the issue and run the reset again.'));
      process.exit(1);
    }
  }

  async quickReset() {
    console.log(chalk.bold.cyan('⚡ Voltrix Quick Reset\\n'));
    
    this.steps = [
      'Clean build artifacts',
      'Build all packages'
    ];

    try {
      await this.executeStep(
        'Clean build artifacts',
        'node',
        ['scripts/clean.js', '--dist'],
        { cwd: process.cwd() }
      );

      await this.executeStep(
        'Build all packages',
        'pnpm',
        ['run', 'build'],
        { cwd: '../../' }
      );

      console.log(chalk.bold.green('\\n⚡ Quick reset completed!'));

    } catch (error) {
      console.log(chalk.bold.red('\\n❌ Quick reset failed!'));
      console.log(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  }
}

// CLI Setup
program
  .name('reset')
  .description('Reset the Voltrix project to a clean state')
  .version('1.0.0');

program
  .option('--full', 'Full reset including node_modules removal')
  .option('--quick', 'Quick reset (clean + build only)')
  .option('--no-type-check', 'Skip type checking step')
  .parse();

const options = program.opts();

async function main() {
  const reset = new ProjectReset();
  
  if (options.quick) {
    await reset.quickReset();
  } else {
    await reset.reset({
      full: options.full,
      typeCheck: options.typeCheck !== false
    });
  }
}

main().catch(console.error);