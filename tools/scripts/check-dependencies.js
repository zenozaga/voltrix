#!/usr/bin/env node

/**
 * Voltrix Dependency Checker
 * Checks for outdated dependencies, security issues, and inconsistencies
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import glob from 'fast-glob';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

class DependencyChecker {
  constructor() {
    this.packages = new Map();
    this.issues = [];
  }

  async runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });

      child.on('error', reject);
    });
  }

  async loadPackageInfo(packagePath) {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      return {
        name: packageJson.name,
        version: packageJson.version,
        path: path.relative(rootDir, packagePath),
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {}
      };
    } catch (error) {
      return null;
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
      const packageInfo = await this.loadPackageInfo(fullPath);
      
      if (packageInfo) {
        packages.push(packageInfo);
        this.packages.set(packageInfo.name, packageInfo);
      }
    }
    
    return packages;
  }

  async checkOutdatedDependencies() {
    console.log(chalk.blue('🔍 Checking for outdated dependencies...'));
    
    try {
      const { stdout } = await this.runCommand('pnpm', ['outdated', '--format', 'json'], {
        cwd: rootDir
      });
      
      if (stdout.trim()) {
        try {
          const outdated = JSON.parse(stdout);
          
          if (Object.keys(outdated).length > 0) {
            console.log(chalk.yellow('\\n⚠️  Outdated dependencies found:'));
            
            Object.entries(outdated).forEach(([pkg, info]) => {
              console.log(`   ${chalk.cyan(pkg)}: ${chalk.red(info.current)} → ${chalk.green(info.latest)}`);
            });
            
            this.issues.push(`${Object.keys(outdated).length} outdated dependencies`);
          } else {
            console.log(chalk.green('   ✅ All dependencies are up to date'));
          }
        } catch (parseError) {
          console.log(chalk.gray('   📊 Dependency status check completed'));
        }
      } else {
        console.log(chalk.green('   ✅ All dependencies are up to date'));
      }
      
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Could not check outdated dependencies'));
    }
  }

  async checkSecurityIssues() {
    console.log(chalk.blue('\\n🔒 Checking for security vulnerabilities...'));
    
    try {
      const { stdout, code } = await this.runCommand('pnpm', ['audit', '--format', 'json'], {
        cwd: rootDir
      });
      
      if (code === 0) {
        console.log(chalk.green('   ✅ No security vulnerabilities found'));
      } else if (stdout.trim()) {
        try {
          const auditResult = JSON.parse(stdout);
          
          if (auditResult.vulnerabilities && Object.keys(auditResult.vulnerabilities).length > 0) {
            const vulnCount = Object.keys(auditResult.vulnerabilities).length;
            console.log(chalk.red(`   🚨 ${vulnCount} security vulnerabilities found`));
            
            // Show high/critical vulnerabilities
            Object.entries(auditResult.vulnerabilities).forEach(([pkg, vuln]) => {
              if (vuln.severity === 'high' || vuln.severity === 'critical') {
                console.log(`   ${chalk.red('●')} ${pkg}: ${chalk.red(vuln.severity)} - ${vuln.title}`);
              }
            });
            
            this.issues.push(`${vulnCount} security vulnerabilities`);
            console.log(chalk.gray('   💡 Run: pnpm audit --fix'));
          }
        } catch (parseError) {
          console.log(chalk.yellow('   ⚠️  Could not parse audit results'));
        }
      } else {
        console.log(chalk.green('   ✅ No security vulnerabilities found'));
      }
      
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Could not run security audit'));
    }
  }

  checkVersionConsistency(packages) {
    console.log(chalk.blue('\\n🔄 Checking version consistency across packages...'));
    
    const dependencyVersions = new Map();
    
    // Collect all dependency versions
    packages.forEach(pkg => {
      Object.entries({...pkg.dependencies, ...pkg.devDependencies}).forEach(([dep, version]) => {
        if (!dependencyVersions.has(dep)) {
          dependencyVersions.set(dep, new Map());
        }
        
        const versionMap = dependencyVersions.get(dep);
        if (!versionMap.has(version)) {
          versionMap.set(version, []);
        }
        versionMap.get(version).push(pkg.name);
      });
    });
    
    // Find inconsistencies
    const inconsistencies = [];
    
    dependencyVersions.forEach((versions, dep) => {
      if (versions.size > 1) {
        inconsistencies.push({
          dependency: dep,
          versions: Array.from(versions.entries())
        });
      }
    });
    
    if (inconsistencies.length > 0) {
      console.log(chalk.yellow(`   ⚠️  ${inconsistencies.length} dependencies have version inconsistencies:`));
      
      inconsistencies.slice(0, 10).forEach(({ dependency, versions }) => {
        console.log(`\\n   ${chalk.cyan(dependency)}:`);
        versions.forEach(([version, packages]) => {
          console.log(`     ${chalk.gray(version)} used by: ${packages.join(', ')}`);
        });
      });
      
      if (inconsistencies.length > 10) {
        console.log(chalk.gray(`   ... and ${inconsistencies.length - 10} more`));
      }
      
      this.issues.push(`${inconsistencies.length} version inconsistencies`);
    } else {
      console.log(chalk.green('   ✅ All dependency versions are consistent'));
    }
  }

  checkWorkspaceDependencies(packages) {
    console.log(chalk.blue('\\n🏢 Checking workspace dependencies...'));
    
    const workspacePackageNames = new Set(packages.map(p => p.name));
    const externalDeps = [];
    const missingWorkspaceDeps = [];
    
    packages.forEach(pkg => {
      Object.entries(pkg.dependencies).forEach(([dep, version]) => {
        if (workspacePackageNames.has(dep)) {
          if (!version.startsWith('workspace:')) {
            missingWorkspaceDeps.push({
              package: pkg.name,
              dependency: dep,
              version
            });
          }
        } else {
          externalDeps.push(dep);
        }
      });
    });
    
    if (missingWorkspaceDeps.length > 0) {
      console.log(chalk.yellow(`   ⚠️  ${missingWorkspaceDeps.length} internal dependencies not using workspace: protocol:`));
      
      missingWorkspaceDeps.forEach(({ package: pkg, dependency, version }) => {
        console.log(`     ${chalk.cyan(pkg)} → ${dependency}@${version}`);
      });
      
      this.issues.push(`${missingWorkspaceDeps.length} missing workspace: dependencies`);
    } else {
      console.log(chalk.green('   ✅ All workspace dependencies use workspace: protocol'));
    }
    
    const uniqueExternalDeps = [...new Set(externalDeps)];
    console.log(chalk.gray(`   📊 Using ${uniqueExternalDeps.length} unique external dependencies`));
  }

  checkDuplicateDependencies(packages) {
    console.log(chalk.blue('\\n🔍 Checking for duplicate dependencies...'));
    
    const duplicates = [];
    
    packages.forEach(pkg => {
      const allDeps = {...pkg.dependencies, ...pkg.devDependencies};
      
      Object.keys(pkg.dependencies).forEach(dep => {
        if (pkg.devDependencies[dep]) {
          duplicates.push({
            package: pkg.name,
            dependency: dep,
            prod: pkg.dependencies[dep],
            dev: pkg.devDependencies[dep]
          });
        }
      });
    });
    
    if (duplicates.length > 0) {
      console.log(chalk.yellow(`   ⚠️  ${duplicates.length} dependencies appear in both prod and dev:`));
      
      duplicates.forEach(({ package: pkg, dependency, prod, dev }) => {
        console.log(`     ${chalk.cyan(pkg)}: ${dependency} (prod: ${prod}, dev: ${dev})`);
      });
      
      this.issues.push(`${duplicates.length} duplicate dependencies`);
    } else {
      console.log(chalk.green('   ✅ No duplicate dependencies found'));
    }
  }

  async generateReport() {
    console.log(chalk.bold.cyan('\\n📋 Dependency Check Summary'));
    console.log('═'.repeat(50));
    
    if (this.issues.length === 0) {
      console.log(chalk.bold.green('🎉 All dependency checks passed!'));
    } else {
      console.log(chalk.bold.yellow(`⚠️  Found ${this.issues.length} issues:`));
      this.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
      
      console.log(chalk.bold('\\n💡 Recommended actions:'));
      console.log(chalk.gray('   1. Run: pnpm update to update dependencies'));
      console.log(chalk.gray('   2. Run: pnpm audit --fix to fix security issues'));
      console.log(chalk.gray('   3. Review and standardize dependency versions'));
      console.log(chalk.gray('   4. Use workspace: protocol for internal dependencies'));
    }
  }

  async check() {
    console.log(chalk.bold.cyan('🔍 Voltrix Dependency Check\\n'));
    
    const spinner = ora('Loading packages...').start();
    
    try {
      const packages = await this.findAllPackages();
      spinner.succeed(`Found ${packages.length} packages`);
      
      // Run all checks
      await this.checkOutdatedDependencies();
      await this.checkSecurityIssues();
      this.checkVersionConsistency(packages);
      this.checkWorkspaceDependencies(packages);
      this.checkDuplicateDependencies(packages);
      
      await this.generateReport();
      
    } catch (error) {
      spinner.fail(chalk.red(`Dependency check failed: ${error.message}`));
      throw error;
    }
  }
}

async function main() {
  const checker = new DependencyChecker();
  await checker.check();
}

main().catch(console.error);