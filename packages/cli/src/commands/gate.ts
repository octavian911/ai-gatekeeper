import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import {
  ScreenshotEngine,
  BaselineManager,
  compareScreenshots,
  generateHTMLReport,
  generateJSONSummary,
  createEvidencePack,
  type GateResult,
  type ComparisonResult,
} from '@ai-gate/core';
import { loadConfig } from '../config.js';
import { runCommand } from './run.js';

export const gateCommand = new Command('gate')
  .description('Run visual regression gate');

gateCommand.addCommand(runCommand);

gateCommand
  .command('run')
  .description('Run visual regression tests')
  .option('-r, --route <route...>', 'Test specific routes only')
  .option('-t, --threshold <threshold>', 'Override threshold', parseFloat)
  .action(async (options) => {
    const spinner = ora('Initializing gate...').start();

    try {
      const config = await loadConfig();
      const baselineManager = new BaselineManager(
        path.join(process.cwd(), 'baselines')
      );
      const engine = new ScreenshotEngine();

      const runId = `run-${Date.now()}`;
      const runDir = path.join(process.cwd(), 'runs', runId);
      await fs.mkdir(runDir, { recursive: true });

      await engine.initialize();
      spinner.succeed('Gate initialized');

      const routes = options.route
        ? config.routes.filter((r) => options.route.includes(r.path))
        : config.routes;

      const comparisons: ComparisonResult[] = [];

      for (const route of routes) {
        spinner.start(`Testing ${route.path}...`);

        const actualPath = path.join(runDir, 'actual', `${route.name}.png`);
        const diffPath = path.join(runDir, 'diff', `${route.name}.png`);

        await fs.mkdir(path.dirname(actualPath), { recursive: true });
        await fs.mkdir(path.dirname(diffPath), { recursive: true });

        await engine.captureRoute(
          config.baseUrl,
          route,
          config.viewport,
          actualPath
        );

        const baselinePath = baselineManager.getBaselinePath(route.path);
        const comparison = await compareScreenshots(
          baselinePath,
          actualPath,
          diffPath,
          route.path,
          config.policy,
          options.threshold ?? route.threshold
        );

        comparisons.push(comparison);

        if (comparison.passed) {
          spinner.succeed(`${chalk.green('✓')} ${route.path}`);
        } else {
          spinner.fail(
            `${chalk.red('✗')} ${route.path} - ${(comparison.percentDiff * 100).toFixed(4)}% diff`
          );
        }
      }

      await engine.close();

      const result: GateResult = {
        passed: comparisons.every((c) => c.passed),
        timestamp: new Date().toISOString(),
        totalRoutes: comparisons.length,
        passedRoutes: comparisons.filter((c) => c.passed).length,
        failedRoutes: comparisons.filter((c) => !c.passed).length,
        comparisons,
      };

      // Generate reports
      await generateJSONSummary(result, path.join(runDir, 'summary.json'));
      await generateHTMLReport(result, path.join(runDir, 'report.html'));

      // Create symlink to latest
      const latestLink = path.join(process.cwd(), 'runs', 'latest');
      try {
        await fs.unlink(latestLink);
      } catch {}
      await fs.symlink(runDir, latestLink, 'dir');

      console.log(chalk.bold('\n📊 Gate Results:'));
      console.log(`  Total: ${result.totalRoutes}`);
      console.log(`  ${chalk.green('Passed')}: ${result.passedRoutes}`);
      console.log(`  ${chalk.red('Failed')}: ${result.failedRoutes}`);
      console.log(`\n  Report: ${chalk.cyan(path.join(runDir, 'report.html'))}`);

      if (!result.passed) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Gate failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

gateCommand
  .command('pack')
  .description('Generate evidence pack')
  .option('-r, --run <runId>', 'Pack specific run (default: latest)')
  .action(async (options) => {
    const spinner = ora('Creating evidence pack...').start();

    try {
      const runId = options.run || 'latest';
      const runDir = path.join(process.cwd(), 'runs', runId);
      const outputPath = path.join(runDir, 'evidence.zip');

      const pack = await createEvidencePack(runDir, outputPath);

      spinner.succeed(`Evidence pack created: ${chalk.cyan(outputPath)}`);
      console.log(`\n  Files: ${pack.manifest.actuals.length} screenshots`);
      console.log(`  Diffs: ${pack.manifest.diffs.length} differences`);
    } catch (error) {
      spinner.fail('Failed to create evidence pack');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });
