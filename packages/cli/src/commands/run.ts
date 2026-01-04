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
  type ResolvedScreenConfig,
  resolveThresholds,
  computeOriginalityPercent,
  evaluateStatus,
  DEFAULT_VIEWPORT,
  loadOrgPolicy,
  resolveScreen,
  computePolicyHash,
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
  .description('Run visual regression gate against baselines')
  .requiredOption('--baseURL <url>', 'Base URL of running application (e.g., http://localhost:5173)')
  .option('--ci', 'CI mode: exit code 1 on any FAIL status')
  .option('--outDir <dir>', 'Output directory for run results (default: runs/run-TIMESTAMP)')
  .option('--screens <ids>', 'Comma-separated screen IDs to test (e.g., screen-01,screen-03)')
  .addHelpText('after', `
Examples:
  Run all screens:
    $ pnpm gate run --baseURL http://localhost:5173

  Run in CI mode (fail build on any FAIL):
    $ pnpm gate run --baseURL http://localhost:5173 --ci

  Test specific screens only:
    $ pnpm gate run --baseURL http://localhost:5173 --screens screen-01,screen-05

  Custom output directory:
    $ pnpm gate run --baseURL http://localhost:5173 --outDir ./custom-runs

Troubleshooting:
  - Ensure baselines exist: pnpm gate baseline list
  - Enable debug mode: GATE_DEBUG=1 pnpm gate run --baseURL <url>
  - Check report: open runs/latest/report.html`)
  .action(async (options) => {
    const spinner = ora('Initializing gate run...').start();

    try {
      const baseURL = options.baseURL;
      const isCi = options.ci || false;
      const runId = `run-${Date.now()}`;
      const outDir = options.outDir || path.join(process.cwd(), '.ai-gate', 'evidence', runId);
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
      } catch (error) {
        spinner.fail('No baselines/manifest.json found');
        console.error(chalk.red('\nError: Baselines not found. You must create baselines before running the gate.'));
        console.error(chalk.dim('\nCreate baselines:'));
        console.error(chalk.dim('  $ pnpm gate baseline add --from /path/to/screenshots'));
        console.error(chalk.dim('\nOr generate fresh baselines:'));
        console.error(chalk.dim('  $ pnpm generate:baselines  # Requires demo app running'));
        process.exit(1);
      }

      let screens = manifest.baselines;
      if (screensFilter) {
        screens = screens.filter((s) => screensFilter.includes(s.screenId));
      }

      if (screens.length === 0) {
        spinner.fail('No screens to test');
        console.error(chalk.red('\nError: No matching screens found.'));
        if (screensFilter) {
          console.error(chalk.dim(`\nRequested: ${screensFilter.join(', ')}`));
          console.error(chalk.dim('\nAvailable screens:'));
          manifest.baselines.forEach(b => console.error(chalk.dim(`  - ${b.screenId}`)));
        } else {
          console.error(chalk.dim('\nThe manifest.json file contains no baseline entries.'));
        }
        process.exit(1);
      }

      const orgPolicy = await loadOrgPolicy();
      const policyHash = computePolicyHash(orgPolicy);
      
      const looseningJustifications: Array<{ screenId: string; justification: string }> = [];
      let anyLooseningOccurred = false;
      
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
        } catch (error) {
          console.log(chalk.yellow(`  ⚠ Missing screen.json for ${screenEntry.screenId}, using manifest data`));
          screenConfig = {
            name: screenEntry.name,
            url: screenEntry.url,
            tags: screenEntry.tags,
          };
        }

        let resolvedConfig: ResolvedScreenConfig;
        try {
          resolvedConfig = resolveScreen(screenConfig, orgPolicy);
          
          if (resolvedConfig.looseningApplied && resolvedConfig.overrideJustification) {
            anyLooseningOccurred = true;
            looseningJustifications.push({
              screenId: screenEntry.screenId,
              justification: resolvedConfig.overrideJustification,
            });
          }
        } catch (error) {
          spinner.fail(
            `${chalk.red('✗ POLICY VIOLATION')} ${screenEntry.screenId} - ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          
          results.push({
            screenId: screenEntry.screenId,
            name: screenConfig.name,
            url: screenConfig.url,
            status: 'FAIL',
            diffPixels: 0,
            diffPixelRatio: 0,
            totalPixels: 0,
            originalityPercent: 0,
            thresholds: resolveThresholds(screenConfig),
            error: `Policy violation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          continue;
        }

        const viewport = resolvedConfig.resolvedViewport;
        const thresholds = resolvedConfig.resolvedThresholds;

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

      const resultsWithRelativePaths = results.map((r) => ({
        ...r,
        expectedPath: r.expectedPath ? path.relative(outDir, r.expectedPath) : undefined,
        actualPath: r.actualPath ? path.relative(outDir, r.actualPath) : undefined,
        diffPath: r.diffPath ? path.relative(outDir, r.diffPath) : undefined,
      }));

      const summary: RunSummary = {
        runId,
        timestamp: new Date().toISOString(),
        ...(sha && { sha }),
        ...(branch && { branch }),
        total: results.length,
        passed: results.filter((r) => r.status === 'PASS').length,
        warned: results.filter((r) => r.status === 'WARN').length,
        failed: results.filter((r) => r.status === 'FAIL').length,
        results: resultsWithRelativePaths,
        policyHash,
        looseningOccurred: anyLooseningOccurred,
        ...(looseningJustifications.length > 0 && { looseningJustifications }),
      };

      await fs.writeFile(
        path.join(outDir, 'summary.json'),
        JSON.stringify(summary, null, 2)
      );

      await generateHTMLReport(summary, outDir);
      await generateIndexHTML(summary, outDir);

      console.log(chalk.bold('\n📊 Run Summary:'));
      console.log(`  Total:  ${summary.total}`);
      console.log(`  ${chalk.green('PASS')}: ${summary.passed}`);
      console.log(`  ${chalk.yellow('WARN')}: ${summary.warned}`);
      console.log(`  ${chalk.red('FAIL')}: ${summary.failed}`);
      console.log(`\n  Report: ${chalk.cyan(path.join(outDir, 'report.html'))}`);

      if (summary.failed > 0) {
        console.log(chalk.red('\n❌ Gate failed: Exiting with code 1 due to failures'));
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
  const evidenceZipPath = path.join(outDir, 'evidence.zip');
  let hasEvidenceZip = false;
  try {
    await fs.access(evidenceZipPath);
    hasEvidenceZip = true;
  } catch {}

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Gatekeeper Evidence Report</title>
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
    h1 { color: #fff; margin-bottom: 0.5rem; font-size: 2rem; }
    .subtitle { color: #9ca3af; font-size: 0.95rem; margin-bottom: 1rem; }
    .header-badges {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
    }
    .badge.pass { background: #059669; color: white; }
    .badge.warn { background: #f59e0b; color: white; }
    .badge.fail { background: #dc2626; color: white; }
    .meta {
      margin-top: 1rem;
      color: #9ca3af;
      font-size: 0.875rem;
    }
    .download-link {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .download-link:hover { background: #2563eb; }
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
    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 0.5rem 1rem;
      border: 2px solid #2a2a3e;
      background: #1a1a2e;
      color: #9ca3af;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .filter-btn:hover { border-color: #60a5fa; }
    .filter-btn.active { border-color: #60a5fa; color: #60a5fa; background: #1e3a5f; }
    .results { margin-top: 2rem; }
    .result-item {
      background: #1a1a2e;
      margin-bottom: 1rem;
      border-radius: 8px;
      border-left: 4px solid #2a2a3e;
      overflow: hidden;
    }
    .result-item.pass { border-left-color: #059669; }
    .result-item.warn { border-left-color: #f59e0b; }
    .result-item.fail { border-left-color: #dc2626; }
    .result-item.hidden { display: none; }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      cursor: pointer;
      user-select: none;
    }
    .result-header:hover { background: #1e1e30; }
    .header-left { display: flex; align-items: center; gap: 1rem; }
    .expand-icon {
      color: #60a5fa;
      font-size: 1.2rem;
      transition: transform 0.2s;
    }
    .result-item.expanded .expand-icon { transform: rotate(90deg); }
    .screen-name { font-size: 1.1rem; font-weight: 600; }
    .screen-url { color: #9ca3af; font-size: 0.875rem; margin-top: 0.25rem; }
    .stats {
      font-family: 'Courier New', monospace;
      color: #9ca3af;
      font-size: 0.875rem;
    }
    .result-details {
      padding: 0 1.5rem 1.5rem 1.5rem;
      display: none;
    }
    .result-item.expanded .result-details { display: block; }
    .detail-stats {
      background: #0a0a0a;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }
    .detail-stats div { margin-bottom: 0.5rem; }
    .detail-stats div:last-child { margin-bottom: 0; }
    .error {
      background: #450a0a;
      color: #fca5a5;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-family: monospace;
      font-size: 0.875rem;
    }
    .images {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
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
    .image-link {
      display: block;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .image-link:hover { opacity: 0.8; }
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
      <h1>🛡️ AI Gatekeeper Evidence Report</h1>
      <p class="subtitle">Visual regression detection for AI-generated code changes</p>
      <div class="header-badges">
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
      ${hasEvidenceZip ? '<a href="evidence.zip" class="download-link" download>📦 Download evidence.zip</a>' : ''}
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
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All (${summary.total})</button>
        <button class="filter-btn" data-filter="PASS">Pass (${summary.passed})</button>
        <button class="filter-btn" data-filter="WARN">Warn (${summary.warned})</button>
        <button class="filter-btn" data-filter="FAIL">Fail (${summary.failed})</button>
      </div>
      <div id="results-container">
        ${summary.results.map((r) => generateResultItem(r)).join('\n')}
      </div>
    </div>
  </div>
  <script>
    const filterBtns = document.querySelectorAll('.filter-btn');
    const resultItems = document.querySelectorAll('.result-item');
    
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        resultItems.forEach(item => {
          if (filter === 'all' || item.dataset.status === filter) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      });
    });
    
    document.querySelectorAll('.result-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.result-item').classList.toggle('expanded');
      });
    });
  </script>
</body>
</html>
  `;

  await fs.writeFile(path.join(outDir, 'report.html'), html);
}

async function generateIndexHTML(summary: RunSummary, outDir: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Gatekeeper Evidence - ${summary.runId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      border: 1px solid #2a2a3e;
      text-align: center;
    }
    h1 { color: #fff; margin-bottom: 0.75rem; font-size: 2.5rem; }
    .subtitle { color: #9ca3af; margin-bottom: 1.5rem; }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .meta-item {
      background: #0a0a0a;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #2a2a3e;
    }
    .meta-label { color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.25rem; }
    .meta-value { color: #fff; font-weight: 600; font-family: monospace; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    .summary-card {
      background: #1a1a2e;
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid #2a2a3e;
      text-align: center;
    }
    .summary-value {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .summary-value.pass { color: #10b981; }
    .summary-value.warn { color: #f59e0b; }
    .summary-value.fail { color: #ef4444; }
    .summary-value.total { color: #60a5fa; }
    .summary-label { color: #9ca3af; text-transform: uppercase; font-size: 0.875rem; }
    .screens {
      background: #1a1a2e;
      border-radius: 8px;
      border: 1px solid #2a2a3e;
      padding: 2rem;
    }
    .screens h2 { color: #fff; margin-bottom: 1.5rem; }
    .screen-table {
      width: 100%;
      border-collapse: collapse;
    }
    .screen-table th {
      background: #0a0a0a;
      color: #9ca3af;
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      border-bottom: 2px solid #2a2a3e;
    }
    .screen-table td {
      padding: 1rem;
      border-bottom: 1px solid #2a2a3e;
    }
    .screen-table tr:hover {
      background: #16213e;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-badge.pass { background: #10b981; color: white; }
    .status-badge.warn { background: #f59e0b; color: white; }
    .status-badge.fail { background: #ef4444; color: white; }
    .screen-name { color: #fff; font-weight: 600; }
    .screen-url { color: #9ca3af; font-size: 0.875rem; font-family: monospace; }
    .originality { color: #60a5fa; font-family: monospace; font-weight: 600; }
    .view-link {
      color: #60a5fa;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    .view-link:hover { color: #3b82f6; }
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #2a2a3e;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ AI Gatekeeper</h1>
      <p class="subtitle">Visual Regression Evidence Report</p>
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">Run ID</div>
          <div class="meta-value">${summary.runId}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Timestamp</div>
          <div class="meta-value">${new Date(summary.timestamp).toLocaleString()}</div>
        </div>
        ${summary.sha ? `
        <div class="meta-item">
          <div class="meta-label">Commit SHA</div>
          <div class="meta-value">${summary.sha.substring(0, 8)}</div>
        </div>
        ` : ''}
        ${summary.branch ? `
        <div class="meta-item">
          <div class="meta-label">Branch</div>
          <div class="meta-value">${summary.branch}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-value total">${summary.total}</div>
        <div class="summary-label">Total Screens</div>
      </div>
      <div class="summary-card">
        <div class="summary-value pass">${summary.passed}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-card">
        <div class="summary-value warn">${summary.warned}</div>
        <div class="summary-label">Warned</div>
      </div>
      <div class="summary-card">
        <div class="summary-value fail">${summary.failed}</div>
        <div class="summary-label">Failed</div>
      </div>
    </div>

    <div class="screens">
      <h2>Screen Results</h2>
      <table class="screen-table">
        <thead>
          <tr>
            <th>Screen</th>
            <th>URL</th>
            <th>Status</th>
            <th>Originality</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${summary.results.map((r) => `
            <tr>
              <td>
                <div class="screen-name">${r.screenId}</div>
                <div class="screen-url" style="margin-top: 0.25rem;">${r.name}</div>
              </td>
              <td class="screen-url">${r.url}</td>
              <td>
                <span class="status-badge ${r.status.toLowerCase()}">${r.status}</span>
              </td>
              <td class="originality">${r.originalityPercent.toFixed(2)}%</td>
              <td>
                <a href="report.html#${r.screenId}" class="view-link">View →</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This report works offline. All assets are bundled.</p>
      <p style="margin-top: 0.5rem;">Generated by AI Gatekeeper - Visual regression testing for AI-generated code</p>
    </div>
  </div>
</body>
</html>
  `;

  await fs.writeFile(path.join(outDir, 'index.html'), html);
}

function generateResultItem(result: ScreenResult): string {
  const statusClass = result.status.toLowerCase();

  let detailStats = '';
  if (!result.error) {
    detailStats = `
      <div class="detail-stats">
        <div class="stats">Originality: ${result.originalityPercent.toFixed(2)}%</div>
        <div class="stats">Diff Pixels: ${result.diffPixels} / ${result.totalPixels}</div>
        <div class="stats">Diff Ratio: ${(result.diffPixelRatio * 100).toFixed(4)}%</div>
        <div class="stats">Thresholds: WARN ${(result.thresholds.warn.diffPixelRatio * 100).toFixed(4)}% / ${result.thresholds.warn.diffPixels}px | FAIL ${(result.thresholds.fail.diffPixelRatio * 100).toFixed(4)}% / ${result.thresholds.fail.diffPixels}px</div>
        ${result.thresholds.requireMasks ? '<div class="stats">⚠️ Masks required</div>' : ''}
      </div>
    `;
  }

  let images = '';
  if (result.status !== 'PASS' && !result.error) {
    images = `
      <div class="images">
        <div class="image-box">
          <div class="image-label">Expected</div>
          <a href="${result.expectedPath}" target="_blank" class="image-link">
            <img src="${result.expectedPath}" alt="Expected">
          </a>
        </div>
        <div class="image-box">
          <div class="image-label">Actual</div>
          <a href="${result.actualPath}" target="_blank" class="image-link">
            <img src="${result.actualPath}" alt="Actual">
          </a>
        </div>
        ${
          result.diffPath
            ? `
        <div class="image-box">
          <div class="image-label">Diff</div>
          <a href="${result.diffPath}" target="_blank" class="image-link">
            <img src="${result.diffPath}" alt="Diff">
          </a>
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  const summaryStats = !result.error 
    ? `${result.originalityPercent.toFixed(2)}% match • ${result.diffPixels}px diff` 
    : 'Navigation failed';

  return `
    <div class="result-item ${statusClass}" data-status="${result.status}">
      <div class="result-header">
        <div class="header-left">
          <span class="expand-icon">▶</span>
          <div>
            <div class="screen-name">${result.screenId} - ${result.name}</div>
            <div class="screen-url">${result.url}</div>
          </div>
        </div>
        <div>
          <div class="badge ${statusClass}">${result.status}</div>
          <div class="stats" style="margin-top: 0.25rem; text-align: right;">${summaryStats}</div>
        </div>
      </div>
      <div class="result-details">
        ${result.error ? `<div class="error">Error: ${result.error}</div>` : detailStats}
        ${images}
      </div>
    </div>
  `;
}
