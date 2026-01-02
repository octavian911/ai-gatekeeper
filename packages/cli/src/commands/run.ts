import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { execSync } from 'child_process';
import {
  ScreenshotEngine,
  type ScreenBaseline,
  type ScreenResult,
  type RunSummary,
  type ViewportConfig,
  resolveThresholds,
  computeOriginalityPercent,
  evaluateStatus,
  DEFAULT_VIEWPORT,
} from '@ai-gate/core';

interface ManifestEntry {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
}

interface Manifest {
  baselines: ManifestEntry[];
}

export const runCommand = new Command('run')
  .description('Run visual regression gate')
  .requiredOption('--baseURL <url>', 'Base URL to test against')
  .option('--ci', 'CI mode: exit 1 on any FAIL')
  .option('--outDir <dir>', 'Output directory for run results')
  .option('--screens <ids>', 'Comma-separated screen IDs to test')
  .action(async (options) => {
    const spinner = ora('Initializing gate run...').start();

    try {
      const baseURL = options.baseURL;
      const isCi = options.ci || false;
      const runId = `run-${Date.now()}`;
      const outDir = options.outDir || path.join(process.cwd(), 'runs', runId);
      const screensFilter = options.screens
        ? options.screens.split(',').map((s: string) => s.trim())
        : null;

      await fs.mkdir(outDir, { recursive: true });

      const baselinesDir = path.join(process.cwd(), 'baselines');
      const manifestPath = path.join(baselinesDir, 'manifest.json');

      let manifest: Manifest;
      try {
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(manifestData);
      } catch {
        spinner.fail('No baselines/manifest.json found');
        process.exit(1);
      }

      let screens = manifest.baselines;
      if (screensFilter) {
        screens = screens.filter((s) => screensFilter.includes(s.screenId));
      }

      if (screens.length === 0) {
        spinner.fail('No screens to test');
        process.exit(1);
      }

      const engine = new ScreenshotEngine();
      await engine.initialize();
      spinner.succeed(`Initialized - testing ${screens.length} screen(s)`);

      const results: ScreenResult[] = [];

      for (const screenEntry of screens) {
        spinner.start(`Testing ${chalk.cyan(screenEntry.screenId)}...`);

        const screenDir = path.join(baselinesDir, screenEntry.screenId);
        const screenJsonPath = path.join(screenDir, 'screen.json');
        const baselinePath = path.join(screenDir, 'baseline.png');

        let screenConfig: ScreenBaseline;
        try {
          const screenData = await fs.readFile(screenJsonPath, 'utf-8');
          screenConfig = JSON.parse(screenData);
        } catch {
          screenConfig = {
            name: screenEntry.name,
            url: screenEntry.url,
            tags: screenEntry.tags,
          };
        }

        const viewport: ViewportConfig = {
          ...DEFAULT_VIEWPORT,
          ...screenConfig.viewport,
        };

        const thresholds = resolveThresholds(screenConfig);

        const perScreenDir = path.join(outDir, 'per-screen', screenEntry.screenId);
        await fs.mkdir(perScreenDir, { recursive: true });

        const expectedPath = path.join(perScreenDir, 'expected.png');
        const actualPath = path.join(perScreenDir, 'actual.png');
        const diffPath = path.join(perScreenDir, 'diff.png');
        const resultJsonPath = path.join(perScreenDir, 'result.json');

        await fs.copyFile(baselinePath, expectedPath);

        const captureResult = await engine.captureScreen(
          baseURL,
          screenConfig,
          viewport,
          actualPath
        );

        let result: ScreenResult;

        if (!captureResult.success) {
          result = {
            screenId: screenEntry.screenId,
            name: screenConfig.name,
            url: screenConfig.url,
            status: 'FAIL',
            diffPixels: 0,
            diffPixelRatio: 0,
            totalPixels: 0,
            originalityPercent: 0,
            thresholds,
            error: captureResult.error,
            expectedPath,
            actualPath,
          };

          if (captureResult.debugInfo) {
            await fs.writeFile(
              path.join(perScreenDir, 'debug.json'),
              JSON.stringify(captureResult.debugInfo, null, 2)
            );
          }
        } else {
          const [expectedData, actualData] = await Promise.all([
            fs.readFile(expectedPath),
            fs.readFile(actualPath),
          ]);

          const expected = PNG.sync.read(expectedData);
          const actual = PNG.sync.read(actualData);

          if (
            expected.width !== actual.width ||
            expected.height !== actual.height
          ) {
            result = {
              screenId: screenEntry.screenId,
              name: screenConfig.name,
              url: screenConfig.url,
              status: 'FAIL',
              diffPixels: 0,
              diffPixelRatio: 0,
              totalPixels: expected.width * expected.height,
              originalityPercent: 0,
              thresholds,
              error: `Image dimensions mismatch: expected(${expected.width}x${expected.height}) vs actual(${actual.width}x${actual.height})`,
              expectedPath,
              actualPath,
            };
          } else {
            const diff = new PNG({
              width: expected.width,
              height: expected.height,
            });

            const diffPixels = pixelmatch(
              expected.data,
              actual.data,
              diff.data,
              expected.width,
              expected.height,
              {
                threshold: 0.02,
                includeAA: false,
              }
            );

            const totalPixels = expected.width * expected.height;
            const diffPixelRatio = diffPixels / totalPixels;
            const originalityPercent = computeOriginalityPercent(
              diffPixels,
              totalPixels
            );

            const status = evaluateStatus({
              diffPixels,
              diffPixelRatio,
              thresholds,
              masks: screenConfig.masks,
            });

            if (status !== 'PASS') {
              await fs.writeFile(diffPath, PNG.sync.write(diff));
            }

            result = {
              screenId: screenEntry.screenId,
              name: screenConfig.name,
              url: screenConfig.url,
              status,
              diffPixels,
              diffPixelRatio,
              totalPixels,
              originalityPercent,
              thresholds,
              expectedPath,
              actualPath,
              ...(status !== 'PASS' && { diffPath }),
            };
          }
        }

        await fs.writeFile(resultJsonPath, JSON.stringify(result, null, 2));
        results.push(result);

        if (result.status === 'PASS') {
          spinner.succeed(
            `${chalk.green('✓ PASS')} ${screenEntry.screenId} - ${result.originalityPercent.toFixed(2)}% match`
          );
        } else if (result.status === 'WARN') {
          spinner.warn(
            `${chalk.yellow('⚠ WARN')} ${screenEntry.screenId} - ${result.diffPixels} diff pixels (${(result.diffPixelRatio * 100).toFixed(4)}%)`
          );
        } else {
          spinner.fail(
            `${chalk.red('✗ FAIL')} ${screenEntry.screenId}${result.error ? ` - ${result.error}` : ` - ${result.diffPixels} diff pixels (${(result.diffPixelRatio * 100).toFixed(4)}%)`}`
          );
        }
      }

      await engine.close();

      let sha: string | undefined;
      let branch: string | undefined;

      try {
        sha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      } catch {}

      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf-8',
        }).trim();
      } catch {}

      const summary: RunSummary = {
        runId,
        timestamp: new Date().toISOString(),
        ...(sha && { sha }),
        ...(branch && { branch }),
        total: results.length,
        passed: results.filter((r) => r.status === 'PASS').length,
        warned: results.filter((r) => r.status === 'WARN').length,
        failed: results.filter((r) => r.status === 'FAIL').length,
        results,
      };

      await fs.writeFile(
        path.join(outDir, 'summary.json'),
        JSON.stringify(summary, null, 2)
      );

      await generateHTMLReport(summary, outDir);

      console.log(chalk.bold('\n📊 Run Summary:'));
      console.log(`  Total:  ${summary.total}`);
      console.log(`  ${chalk.green('PASS')}: ${summary.passed}`);
      console.log(`  ${chalk.yellow('WARN')}: ${summary.warned}`);
      console.log(`  ${chalk.red('FAIL')}: ${summary.failed}`);
      console.log(`\n  Report: ${chalk.cyan(path.join(outDir, 'report.html'))}`);

      if (isCi && summary.failed > 0) {
        console.log(chalk.red('\n❌ CI mode: Exiting with code 1 due to failures'));
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      spinner.fail('Gate run failed');
      console.error(
        chalk.red(error instanceof Error ? error.message : 'Unknown error')
      );
      process.exit(1);
    }
  });

async function generateHTMLReport(
  summary: RunSummary,
  outDir: string
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Output Gate Run Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      border: 1px solid #2a2a3e;
    }
    h1 { color: #fff; margin-bottom: 0.5rem; }
    .badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 1rem;
      margin-right: 0.5rem;
    }
    .badge.pass { background: #059669; color: white; }
    .badge.warn { background: #f59e0b; color: white; }
    .badge.fail { background: #dc2626; color: white; }
    .meta {
      margin-top: 1rem;
      color: #9ca3af;
      font-size: 0.875rem;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    .metric {
      background: #1a1a2e;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #2a2a3e;
    }
    .metric-value { font-size: 2rem; font-weight: 700; color: #60a5fa; }
    .metric-label { color: #9ca3af; margin-top: 0.5rem; }
    .results { margin-top: 2rem; }
    .result-item {
      background: #1a1a2e;
      padding: 1.5rem;
      margin-bottom: 1rem;
      border-radius: 8px;
      border-left: 4px solid #2a2a3e;
    }
    .result-item.pass { border-left-color: #059669; }
    .result-item.warn { border-left-color: #f59e0b; }
    .result-item.fail { border-left-color: #dc2626; }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .screen-name { font-size: 1.1rem; font-weight: 600; }
    .stats {
      font-family: 'Courier New', monospace;
      color: #9ca3af;
      font-size: 0.875rem;
    }
    .error {
      background: #450a0a;
      color: #fca5a5;
      padding: 1rem;
      border-radius: 6px;
      margin-top: 1rem;
      font-family: monospace;
      font-size: 0.875rem;
    }
    .images {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .image-box {
      background: #0a0a0a;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #2a2a3e;
    }
    .image-label {
      color: #9ca3af;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      text-transform: uppercase;
    }
    img {
      width: 100%;
      border-radius: 4px;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ AI Output Gate Run Report</h1>
      <div>
        <span class="badge pass">PASS: ${summary.passed}</span>
        <span class="badge warn">WARN: ${summary.warned}</span>
        <span class="badge fail">FAIL: ${summary.failed}</span>
      </div>
      <div class="meta">
        <div>Run ID: ${summary.runId}</div>
        <div>Timestamp: ${new Date(summary.timestamp).toLocaleString()}</div>
        ${summary.sha ? `<div>SHA: ${summary.sha.substring(0, 8)}</div>` : ''}
        ${summary.branch ? `<div>Branch: ${summary.branch}</div>` : ''}
      </div>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${summary.total}</div>
        <div class="metric-label">Total Screens</div>
      </div>
      <div class="metric">
        <div class="metric-value">${summary.passed}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric">
        <div class="metric-value">${summary.warned}</div>
        <div class="metric-label">Warned</div>
      </div>
      <div class="metric">
        <div class="metric-value">${summary.failed}</div>
        <div class="metric-label">Failed</div>
      </div>
    </div>

    <div class="results">
      <h2 style="margin-bottom: 1rem;">Screen Results</h2>
      ${summary.results.map((r) => generateResultItem(r, outDir)).join('\n')}
    </div>
  </div>
</body>
</html>
  `;

  await fs.writeFile(path.join(outDir, 'report.html'), html);
}

function generateResultItem(result: ScreenResult, outDir: string): string {
  const statusClass = result.status.toLowerCase();

  let stats = '';
  if (!result.error) {
    stats = `
      <div class="stats">
        Diff: ${result.diffPixels} pixels (${(result.diffPixelRatio * 100).toFixed(4)}%) | 
        Match: ${result.originalityPercent.toFixed(2)}%
      </div>
      <div class="stats">
        Thresholds: WARN ${(result.thresholds.warn.diffPixelRatio * 100).toFixed(4)}% / ${result.thresholds.warn.diffPixels}px | 
        FAIL ${(result.thresholds.fail.diffPixelRatio * 100).toFixed(4)}% / ${result.thresholds.fail.diffPixels}px
        ${result.thresholds.requireMasks ? ' | Masks required' : ''}
      </div>
    `;
  }

  let images = '';
  if (result.status !== 'PASS' && !result.error) {
    const relativeExpected = path.relative(
      outDir,
      result.expectedPath || ''
    );
    const relativeActual = path.relative(outDir, result.actualPath || '');
    const relativeDiff = result.diffPath
      ? path.relative(outDir, result.diffPath)
      : null;

    images = `
      <div class="images">
        <div class="image-box">
          <div class="image-label">Expected</div>
          <img src="${relativeExpected}" alt="Expected">
        </div>
        <div class="image-box">
          <div class="image-label">Actual</div>
          <img src="${relativeActual}" alt="Actual">
        </div>
        ${
          relativeDiff
            ? `
        <div class="image-box">
          <div class="image-label">Diff</div>
          <img src="${relativeDiff}" alt="Diff">
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  return `
    <div class="result-item ${statusClass}">
      <div class="result-header">
        <div class="screen-name">${result.screenId} - ${result.name}</div>
        <div class="badge ${statusClass}">${result.status}</div>
      </div>
      <div class="stats">URL: ${result.url}</div>
      ${stats}
      ${result.error ? `<div class="error">Error: ${result.error}</div>` : ''}
      ${images}
    </div>
  `;
}
