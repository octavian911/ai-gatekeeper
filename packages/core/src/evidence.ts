import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { createHash } from 'crypto';
import archiver from 'archiver';
import type { GateResult, RunSummary, ScreenResult, EvidencePackResult } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getGitInfo(): Promise<{ sha?: string; branch?: string }> {
  try {
    const { stdout: sha } = await execAsync('git rev-parse HEAD');
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD');
    return {
      sha: sha.trim(),
      branch: branch.trim(),
    };
  } catch {
    return {};
  }
}

async function hashFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function generateDecisionMd(
  runId: string,
  summaryPath: string,
  gitInfo: { sha?: string; branch?: string }
): Promise<string> {
  const summaryData = await fs.readFile(summaryPath, 'utf-8');
  const summary: GateResult | RunSummary = JSON.parse(summaryData);

  let results: ScreenResult[] = [];
  let timestamp = '';
  let globalThresholds: any = {};

  if ('results' in summary) {
    results = summary.results;
    timestamp = summary.timestamp;
  } else if ('comparisons' in summary) {
    results = summary.comparisons.map(comp => ({
      screenId: comp.route,
      name: comp.route,
      url: comp.route,
      status: comp.passed ? 'PASS' : 'FAIL',
      diffPixels: comp.pixelsDiff,
      diffPixelRatio: comp.percentDiff,
      totalPixels: 0,
      originalityPercent: (1 - comp.percentDiff) * 100,
      thresholds: {
        warn: { diffPixelRatio: 0, diffPixels: 0 },
        fail: { diffPixelRatio: comp.threshold, diffPixels: comp.pixelsDiff },
      },
      expectedPath: comp.baselinePath,
      actualPath: comp.actualPath,
      diffPath: comp.diffPath,
    }));
    timestamp = summary.timestamp;
  }

  const hasErrors = results.some(r => r.error);

  let md = `# Gate Run Decision\n\n`;
  md += `## Run Metadata\n\n`;
  md += `- **Run ID**: ${runId}\n`;
  md += `- **Timestamp**: ${timestamp}\n`;
  if (gitInfo.sha) {
    md += `- **Git SHA**: ${gitInfo.sha}\n`;
  }
  if (gitInfo.branch) {
    md += `- **Git Branch**: ${gitInfo.branch}\n`;
  }
  md += `\n`;

  md += `## Thresholds\n\n`;
  if ('policy' in summary) {
    md += `**Global Policy**:\n`;
    md += `- Pixel Diff Threshold: ${summary.policy.pixelDiffThreshold}\n`;
    md += `- Anti-Aliasing Tolerance: ${summary.policy.antiAliasingTolerance}\n`;
    md += `- Max Diff Pixels: ${summary.policy.maxDiffPixels}\n`;
  } else {
    md += `Per-screen thresholds applied (see table below)\n`;
  }
  md += `\n`;

  md += `## Screen Results\n\n`;
  md += `| Screen ID | Route | Originality % | Status |\n`;
  md += `|-----------|-------|---------------|--------|\n`;
  for (const result of results) {
    const originality = result.originalityPercent.toFixed(2);
    md += `| ${result.screenId} | ${result.url} | ${originality}% | ${result.status} |\n`;
  }
  md += `\n`;

  if (hasErrors) {
    md += `## Notes\n\n`;
    md += `### Errors\n\n`;
    for (const result of results) {
      if (result.error) {
        md += `- **${result.screenId}**: ${result.error}\n`;
      }
    }
    md += `\n`;
  }

  return md;
}

async function generateManifestSha256(files: Array<{ path: string; hash: string }>): Promise<string> {
  const lines = files.map(f => `${f.hash}  ${f.path}`).sort();
  return lines.join('\n') + '\n';
}

export async function createEvidencePack(
  runDir: string,
  outputPath: string
): Promise<EvidencePackResult> {
  const runId = path.basename(runDir);
  const gitInfo = await getGitInfo();

  const files: Array<{ path: string; hash: string }> = [];

  const summaryPath = path.join(runDir, 'summary.json');
  const reportPath = path.join(runDir, 'report.html');
  const actualDir = path.join(runDir, 'actual');
  const diffDir = path.join(runDir, 'diff');

  const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
  const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);

  if (!summaryExists) {
    throw new Error(`Summary file not found: ${summaryPath}`);
  }

  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  const summaryHash = await hashFile(summaryPath);
  files.push({ path: 'summary.json', hash: summaryHash });
  archive.file(summaryPath, { name: 'summary.json' });

  if (reportExists) {
    const reportHash = await hashFile(reportPath);
    files.push({ path: 'report.html', hash: reportHash });
    archive.file(reportPath, { name: 'report.html' });
  }

  const actualExists = await fs.access(actualDir).then(() => true).catch(() => false);
  if (actualExists) {
    const actualFiles = await fs.readdir(actualDir);
    for (const file of actualFiles) {
      const filePath = path.join(actualDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const hash = await hashFile(filePath);
        const archivePath = `actual/${file}`;
        files.push({ path: archivePath, hash });
        archive.file(filePath, { name: archivePath });

        const resultJsonPath = path.join(actualDir, `${path.parse(file).name}.result.json`);
        const resultExists = await fs.access(resultJsonPath).then(() => true).catch(() => false);
        if (resultExists) {
          const resultHash = await hashFile(resultJsonPath);
          const resultArchivePath = `actual/${path.parse(file).name}.result.json`;
          files.push({ path: resultArchivePath, hash: resultHash });
          archive.file(resultJsonPath, { name: resultArchivePath });
        }
      }
    }
  }

  const diffExists = await fs.access(diffDir).then(() => true).catch(() => false);
  if (diffExists) {
    const diffFiles = await fs.readdir(diffDir);
    for (const file of diffFiles) {
      const filePath = path.join(diffDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const hash = await hashFile(filePath);
        const archivePath = `diff/${file}`;
        files.push({ path: archivePath, hash });
        archive.file(filePath, { name: archivePath });

        const resultJsonPath = path.join(diffDir, `${path.parse(file).name}.result.json`);
        const resultExists = await fs.access(resultJsonPath).then(() => true).catch(() => false);
        if (resultExists) {
          const resultHash = await hashFile(resultJsonPath);
          const resultArchivePath = `diff/${path.parse(file).name}.result.json`;
          files.push({ path: resultArchivePath, hash: resultHash });
          archive.file(resultJsonPath, { name: resultArchivePath });
        }
      }
    }
  }

  const manifestContent = await generateManifestSha256(files);
  archive.append(manifestContent, { name: 'MANIFEST.sha256' });

  const decisionMd = await generateDecisionMd(runId, summaryPath, gitInfo);
  archive.append(decisionMd, { name: 'DECISION.md' });

  await archive.finalize();

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });

  return {
    outputPath,
    manifest: { files },
    fileCount: files.length,
  };
}

export async function createReviewPack(
  runDir: string,
  outputPath: string,
  baselinesDir?: string
): Promise<EvidencePackResult> {
  const runId = path.basename(runDir);
  const gitInfo = await getGitInfo();

  const files: Array<{ path: string; hash: string }> = [];

  const summaryPath = path.join(runDir, 'summary.json');
  const reportPath = path.join(runDir, 'report.html');
  const actualDir = path.join(runDir, 'actual');
  const diffDir = path.join(runDir, 'diff');

  const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
  const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);

  if (!summaryExists) {
    throw new Error(`Summary file not found: ${summaryPath}`);
  }

  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  const summaryHash = await hashFile(summaryPath);
  files.push({ path: 'summary.json', hash: summaryHash });
  archive.file(summaryPath, { name: 'summary.json' });

  if (reportExists) {
    const reportHash = await hashFile(reportPath);
    files.push({ path: 'report.html', hash: reportHash });
    archive.file(reportPath, { name: 'report.html' });
  }

  const actualExists = await fs.access(actualDir).then(() => true).catch(() => false);
  if (actualExists) {
    const actualFiles = await fs.readdir(actualDir);
    for (const file of actualFiles) {
      const filePath = path.join(actualDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && /\.(png|jpg|jpeg)$/i.test(file)) {
        const hash = await hashFile(filePath);
        const archivePath = `actual/${file}`;
        files.push({ path: archivePath, hash });
        archive.file(filePath, { name: archivePath });
      }
    }
  }

  const diffExists = await fs.access(diffDir).then(() => true).catch(() => false);
  if (diffExists) {
    const diffFiles = await fs.readdir(diffDir);
    for (const file of diffFiles) {
      const filePath = path.join(diffDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && /\.(png|jpg|jpeg)$/i.test(file)) {
        const hash = await hashFile(filePath);
        const archivePath = `diff/${file}`;
        files.push({ path: archivePath, hash });
        archive.file(filePath, { name: archivePath });
      }
    }
  }

  if (baselinesDir) {
    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
    const baselines: Set<string> = new Set();

    if (summary.comparisons) {
      for (const comparison of summary.comparisons) {
        if (comparison.baselinePath) {
          baselines.add(comparison.baselinePath);
        }
      }
    }

    for (const baselinePath of baselines) {
      const exists = await fs.access(baselinePath).then(() => true).catch(() => false);
      if (exists) {
        const hash = await hashFile(baselinePath);
        const fileName = path.basename(baselinePath);
        const archivePath = `baselines/${fileName}`;
        files.push({ path: archivePath, hash });
        archive.file(baselinePath, { name: archivePath });
      }
    }
  }

  const indexHtml = await generateIndexHtml(runId, summaryPath, gitInfo);
  archive.append(indexHtml, { name: 'index.html' });
  files.push({ path: 'index.html', hash: 'generated' });

  const readmeMd = generateReviewPackReadme(runId, gitInfo);
  archive.append(readmeMd, { name: 'README.md' });

  const manifestContent = await generateManifestSha256(files);
  archive.append(manifestContent, { name: 'MANIFEST.sha256' });

  await archive.finalize();

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });

  return {
    outputPath,
    manifest: { files },
    fileCount: files.length,
  };
}

async function generateIndexHtml(
  runId: string,
  summaryPath: string,
  gitInfo: { sha?: string; branch?: string }
): Promise<string> {
  const summaryData = await fs.readFile(summaryPath, 'utf-8');
  const summary: GateResult | RunSummary = JSON.parse(summaryData);

  let results: ScreenResult[] = [];
  let timestamp = '';

  if ('results' in summary) {
    results = summary.results;
    timestamp = summary.timestamp;
  } else if ('comparisons' in summary) {
    results = summary.comparisons.map(comp => ({
      screenId: comp.route,
      name: comp.route,
      url: comp.route,
      status: comp.passed ? 'PASS' : 'FAIL',
      diffPixels: comp.pixelsDiff,
      diffPixelRatio: comp.percentDiff,
      totalPixels: 0,
      originalityPercent: (1 - comp.percentDiff) * 100,
      thresholds: {
        warn: { diffPixelRatio: 0, diffPixels: 0 },
        fail: { diffPixelRatio: comp.threshold, diffPixels: comp.pixelsDiff },
      },
      expectedPath: comp.baselinePath,
      actualPath: comp.actualPath,
      diffPath: comp.diffPath,
    }));
    timestamp = summary.timestamp;
  }

  const passed = results.every(r => r.status === 'PASS');
  const failedCount = results.filter(r => r.status === 'FAIL').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Gatekeeper Review Pack - ${runId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 2rem;
      line-height: 1.6;
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
    .status {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 700;
      margin-top: 1rem;
      font-size: 1.1rem;
    }
    .status.passed { background: #059669; color: white; }
    .status.failed { background: #dc2626; color: white; }
    .meta {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #2a2a3e;
      color: #9ca3af;
      font-size: 0.9rem;
    }
    .meta-row { display: flex; gap: 2rem; flex-wrap: wrap; }
    .meta-item { display: flex; gap: 0.5rem; }
    .meta-label { font-weight: 600; color: #60a5fa; }
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
    .metric-value { font-size: 2.5rem; font-weight: 700; color: #60a5fa; }
    .metric-label { color: #9ca3af; margin-top: 0.5rem; font-size: 0.9rem; }
    .results { margin-top: 2rem; }
    .section-header {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #fff;
      font-weight: 600;
    }
    .result-item {
      background: #1a1a2e;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-radius: 8px;
      border-left: 4px solid #2a2a3e;
    }
    .result-item.passed { border-left-color: #059669; }
    .result-item.failed { border-left-color: #dc2626; }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .route-name {
      font-size: 1.2rem;
      font-weight: 600;
      color: #fff;
    }
    .diff-info {
      display: flex;
      gap: 1.5rem;
      font-family: 'Courier New', monospace;
      color: #9ca3af;
      font-size: 0.9rem;
    }
    .images {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .image-box {
      background: #0a0a0a;
      padding: 1rem;
      border-radius: 6px;
      border: 1px solid #2a2a3e;
    }
    .image-label {
      color: #9ca3af;
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    img {
      width: 100%;
      border-radius: 4px;
      display: block;
      border: 1px solid #2a2a3e;
    }
    .pass-only {
      color: #059669;
      font-weight: 600;
      font-size: 1.1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ AI Gatekeeper Review Pack</h1>
      <div class="status ${passed ? 'passed' : 'failed'}">
        ${passed ? '✓ ALL SCREENS PASSED' : `✗ ${failedCount} SCREEN${failedCount === 1 ? '' : 'S'} FAILED`}
      </div>
      <div class="meta">
        <div class="meta-row">
          <div class="meta-item">
            <span class="meta-label">Run ID:</span>
            <span>${runId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Generated:</span>
            <span>${new Date(timestamp).toLocaleString()}</span>
          </div>
          ${gitInfo.sha ? `
          <div class="meta-item">
            <span class="meta-label">Commit:</span>
            <span>${gitInfo.sha.substring(0, 8)}</span>
          </div>
          ` : ''}
          ${gitInfo.branch ? `
          <div class="meta-item">
            <span class="meta-label">Branch:</span>
            <span>${gitInfo.branch}</span>
          </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${results.length}</div>
        <div class="metric-label">Total Screens</div>
      </div>
      <div class="metric">
        <div class="metric-value">${results.filter(r => r.status === 'PASS').length}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric">
        <div class="metric-value">${failedCount}</div>
        <div class="metric-label">Failed</div>
      </div>
    </div>

    <div class="results">
      <h2 class="section-header">Screen-by-Screen Results</h2>
      ${results.map(result => {
        const isPassed = result.status === 'PASS';
        const baselineImg = result.expectedPath ? `baselines/${path.basename(result.expectedPath)}` : null;
        const actualImg = result.actualPath ? `actual/${path.basename(result.actualPath)}` : null;
        const diffImg = result.diffPath ? `diff/${path.basename(result.diffPath)}` : null;

        return `
        <div class="result-item ${isPassed ? 'passed' : 'failed'}">
          <div class="result-header">
            <div class="route-name">${result.name || result.screenId}</div>
            <div class="diff-info">
              <span>Diff: ${(result.diffPixelRatio * 100).toFixed(4)}%</span>
              ${result.thresholds ? `<span>Threshold: ${(result.thresholds.fail.diffPixelRatio * 100).toFixed(2)}%</span>` : ''}
            </div>
          </div>
          ${isPassed ? `
            <div class="pass-only">✓ No visual changes detected</div>
          ` : `
          <div class="images">
            ${baselineImg ? `
            <div class="image-box">
              <div class="image-label">Baseline (Expected)</div>
              <img src="${baselineImg}" alt="Baseline">
            </div>
            ` : ''}
            ${actualImg ? `
            <div class="image-box">
              <div class="image-label">Current (Actual)</div>
              <img src="${actualImg}" alt="Current">
            </div>
            ` : ''}
            ${diffImg ? `
            <div class="image-box">
              <div class="image-label">Difference (Highlighted)</div>
              <img src="${diffImg}" alt="Diff">
            </div>
            ` : ''}
          </div>
          `}
        </div>
        `;
      }).join('\n')}
    </div>
  </div>
</body>
</html>`;
}

function generateReviewPackReadme(runId: string, gitInfo: { sha?: string; branch?: string }): string {
  return `# AI Gatekeeper Review Pack

This package contains visual regression test results for review.

## Contents

- \`index.html\` - Interactive review report (open this file)
- \`report.html\` - Detailed technical report
- \`summary.json\` - Machine-readable test results
- \`baselines/\` - Expected baseline screenshots
- \`actual/\` - Current screenshots from this run
- \`diff/\` - Visual diff highlighting changes

## How to Review

1. Open \`index.html\` in your web browser
2. Review each screen marked as "FAILED"
3. Compare the baseline vs current screenshots
4. Check if changes are intentional or regressions

## This Package Works Offline

All files are self-contained. No internet connection required.

## Run Information

- Run ID: ${runId}
${gitInfo.sha ? `- Commit: ${gitInfo.sha}\n` : ''}${gitInfo.branch ? `- Branch: ${gitInfo.branch}\n` : ''}

## Questions?

See the full AI Gatekeeper documentation in your repository.
`;
}
