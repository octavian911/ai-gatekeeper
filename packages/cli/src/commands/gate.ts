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
  createReviewPack,
  type GateResult,
  type ComparisonResult,
} from '@ai-gate/core';
import { loadConfig } from '../config.js';
import { runCommand } from './run.js';
import { detectGitHubContext, postOrUpdatePRComment } from '../github.js';
import { formatPRSummary, computeRunStatus, computeWorstSimilarity, type PRSummaryData } from '../pr-summary.js';

export const gateCommand = new Command('gate')
  .description('Run visual regression gate and generate evidence packs')
  .addHelpText('after', `
Commands:
  run    Run visual regression gate against baselines
  pack   Generate evidence pack (ZIP) from run results

Examples:
  $ pnpm gate run --baseURL http://localhost:5173
  $ pnpm gate pack
  $ pnpm gate pack --runId run-1234567890 --out ./evidence.zip`);

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

      const githubContext = detectGitHubContext();
      if (githubContext) {
        try {
          const worstSimilarity = computeWorstSimilarity(comparisons);
          const status = computeRunStatus(result.passedRoutes, 0, result.failedRoutes);

          const summaryData: PRSummaryData = {
            status,
            totalScreens: result.totalRoutes,
            passedScreens: result.passedRoutes,
            warnedScreens: 0,
            failedScreens: result.failedRoutes,
            worstSimilarity,
            artifactPath: runDir,
            runId,
            commitSha: githubContext.sha,
          };

          const markdown = formatPRSummary(summaryData);
          await postOrUpdatePRComment(githubContext, markdown);
          console.log(chalk.green('\n✓ Posted summary to PR comment'));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const isForkOrPermissionError = errorMessage.includes('Permission denied') || 
                                          errorMessage.includes('fork') ||
                                          errorMessage.includes('not found');
          
          if (isForkOrPermissionError) {
            console.log(chalk.yellow('\n⚠ Unable to post PR comment'));
            console.log(chalk.yellow('  Reason: PR may be from a fork or workflow lacks comment permissions'));
            console.log(chalk.yellow('  Tip: Grant write permissions to GITHUB_TOKEN in workflow file'));
            console.log(chalk.yellow('  Gate will continue - check Artifacts for evidence\n'));
          } else {
            console.log(chalk.yellow('\n⚠ Could not post PR comment (continuing):'));
            console.log(chalk.yellow(`  ${errorMessage}`));
          }
          
          const worstSimilarity = computeWorstSimilarity(comparisons);
          const status = computeRunStatus(result.passedRoutes, 0, result.failedRoutes);
          
          console.log(chalk.bold('\n📊 Summary (for CI logs):'));
          console.log(`  Run ID: ${runId}`);
          console.log(`  Commit: ${githubContext.sha.substring(0, 7)}`);
          console.log(`  Status: ${status}`);
          console.log(`  Total: ${result.totalRoutes}`);
          console.log(`  Passed: ${result.passedRoutes}`);
          console.log(`  Failed: ${result.failedRoutes}`);
          console.log(`  Worst Similarity: ${(worstSimilarity * 100).toFixed(2)}%`);
          console.log(chalk.bold('\n📦 Evidence Location:'));
          console.log('  Checks tab → Workflow job → Artifacts → Download ai-gate-evidence');
        }
      }

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
  .description('Generate evidence pack (ZIP) from run results')
  .option('--runId <id>', 'Pack specific run ID (default: latest)')
  .option('--out <path>', 'Output ZIP file path (default: <runDir>/evidence.zip)')
  .addHelpText('after', `
Examples:
  Pack latest run:
    $ pnpm gate pack

  Pack specific run:
    $ pnpm gate pack --runId run-1234567890

  Custom output path:
    $ pnpm gate pack --out ./artifacts/evidence.zip`)
  .action(async (options) => {
    const spinner = ora('Creating evidence pack...').start();

    try {
      const runId = options.runId || 'latest';
      const runDir = path.join(process.cwd(), 'runs', runId);
      const outputPath = options.out || path.join(runDir, 'evidence.zip');

      const pack = await createEvidencePack(runDir, outputPath);

      spinner.succeed(`Evidence pack created: ${chalk.cyan(pack.outputPath)}`);
      console.log(`\n  Files: ${pack.fileCount}`);
      console.log(`  Location: ${chalk.cyan(pack.outputPath)}`);
    } catch (error) {
      spinner.fail('Failed to create evidence pack');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

gateCommand
  .command('review-pack')
  .description('Generate reviewer-friendly pack with index.html (one-file download for non-technical reviewers)')
  .option('--runId <id>', 'Pack specific run ID (default: latest)')
  .option('--out <path>', 'Output ZIP file path (default: ai-gate-review-pack.zip)')
  .option('--baselines <dir>', 'Include baseline images from directory (default: ./baselines)')
  .addHelpText('after', `
The review pack includes:
  - index.html (interactive visual report)
  - report.html (detailed technical report)
  - summary.json (machine-readable results)
  - baselines/ (expected screenshots)
  - actual/ (current screenshots)
  - diff/ (visual differences)
  - README.md (instructions for reviewers)

This pack is optimized for non-technical reviewers:
  ✓ Works 100% offline (no internet needed)
  ✓ Single file to download
  ✓ Just open index.html in a browser
  ✓ Side-by-side visual comparisons

Examples:
  Create review pack for latest run:
    $ pnpm gate review-pack

  Pack specific run:
    $ pnpm gate review-pack --runId run-1234567890

  Custom output path:
    $ pnpm gate review-pack --out ./review.zip

  Custom baselines directory:
    $ pnpm gate review-pack --baselines ./my-baselines`)
  .action(async (options) => {
    const spinner = ora('Creating review pack...').start();

    try {
      const runId = options.runId || 'latest';
      const runDir = path.join(process.cwd(), 'runs', runId);
      const outputPath = options.out || path.join(process.cwd(), 'ai-gate-review-pack.zip');
      const baselinesDir = options.baselines || path.join(process.cwd(), 'baselines');

      const pack = await createReviewPack(runDir, outputPath, baselinesDir);

      spinner.succeed(`Review pack created: ${chalk.cyan(pack.outputPath)}`);
      console.log(chalk.bold('\n📦 Review Pack Ready'));
      console.log(`  Files: ${pack.fileCount}`);
      console.log(`  Location: ${chalk.cyan(pack.outputPath)}`);
      console.log(chalk.bold('\n📖 How to Use:'));
      console.log('  1. Send the ZIP file to reviewers');
      console.log('  2. They unzip it anywhere on their computer');
      console.log('  3. They open index.html in their browser');
      console.log('  4. No internet connection needed!');
    } catch (error) {
      spinner.fail('Failed to create review pack');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });
