import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import {
  ScreenshotEngine,
  BaselineManager,
  type RouteConfig,
} from '@ai-gate/core';
import { loadConfig } from '../config.js';

export const baselineCommand = new Command('baseline')
  .description('Manage baseline screenshots');

baselineCommand
  .command('add')
  .description('Capture new baseline screenshots')
  .option('-r, --route <route>', 'Capture specific route only')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const config = await loadConfig();
      const baselineManager = new BaselineManager(
        path.join(process.cwd(), 'baselines')
      );
      const engine = new ScreenshotEngine();

      await engine.initialize();
      spinner.succeed('Configuration loaded');

      const routes = options.route
        ? config.routes.filter((r) => r.path === options.route)
        : config.routes;

      if (routes.length === 0) {
        throw new Error(`Route ${options.route} not found`);
      }

      for (const route of routes) {
        spinner.start(`Capturing ${route.path}...`);

        const tempPath = path.join(
          process.cwd(),
          'runs',
          'temp',
          `${route.name}.png`
        );
        await fs.mkdir(path.dirname(tempPath), { recursive: true });

        await engine.captureRoute(
          config.baseUrl,
          route,
          config.viewport,
          tempPath
        );

        await baselineManager.add(route.path, tempPath, {
          route: route.path,
          timestamp: new Date().toISOString(),
          viewport: config.viewport,
          userAgent: 'AI-Gate/1.0 Deterministic',
        });

        spinner.succeed(`Captured ${chalk.cyan(route.path)}`);
      }

      await engine.close();
      console.log(chalk.green('\n✓ Baselines updated successfully'));
    } catch (error) {
      spinner.fail('Failed to capture baselines');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

baselineCommand
  .command('list')
  .description('List all baseline screenshots')
  .action(async () => {
    try {
      const baselineManager = new BaselineManager(
        path.join(process.cwd(), 'baselines')
      );
      const baselines = await baselineManager.list();

      if (baselines.length === 0) {
        console.log(chalk.yellow('No baselines found'));
        return;
      }

      console.log(chalk.bold('\nBaselines:'));
      for (const baseline of baselines) {
        console.log(`  ${chalk.cyan(baseline.route)} - ${baseline.timestamp}`);
      }
      console.log();
    } catch (error) {
      console.error(chalk.red('Failed to list baselines'));
      process.exit(1);
    }
  });

baselineCommand
  .command('validate')
  .description('Validate baseline integrity')
  .action(async () => {
    const spinner = ora('Validating baselines...').start();

    try {
      const config = await loadConfig();
      const baselineManager = new BaselineManager(
        path.join(process.cwd(), 'baselines')
      );

      let valid = 0;
      let invalid = 0;

      for (const route of config.routes) {
        const isValid = await baselineManager.validate(route.path);
        if (isValid) {
          valid++;
        } else {
          invalid++;
          spinner.warn(`Invalid baseline for ${route.path}`);
        }
      }

      if (invalid === 0) {
        spinner.succeed(
          `All ${valid} baselines are valid`
        );
      } else {
        spinner.fail(
          `${invalid} invalid baselines (${valid} valid)`
        );
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

baselineCommand
  .command('update')
  .description('Update existing baselines')
  .option('-r, --route <route>', 'Update specific route only')
  .action(async (options) => {
    // Similar to 'add' but updates existing baselines
    await baselineCommand.commands.find((c) => c.name() === 'add')?.parseAsync(
      ['add', ...(options.route ? ['-r', options.route] : [])],
      { from: 'user' }
    );
  });
