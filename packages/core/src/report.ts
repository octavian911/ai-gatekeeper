import fs from 'fs/promises';
import path from 'path';
import type { GateResult, ComparisonResult } from './types.js';

export async function generateHTMLReport(
  result: GateResult,
  outputPath: string
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Output Gate Report</title>
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
    .status {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 1rem;
    }
    .status.passed { background: #059669; color: white; }
    .status.failed { background: #dc2626; color: white; }
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
    .result-item.passed { border-left-color: #059669; }
    .result-item.failed { border-left-color: #dc2626; }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .route-name { font-size: 1.1rem; font-weight: 600; }
    .diff-percent {
      font-family: 'Courier New', monospace;
      color: #9ca3af;
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
      <h1>🛡️ AI Output Gate Report</h1>
      <div class="status ${result.passed ? 'passed' : 'failed'}">
        ${result.passed ? '✓ PASSED' : '✗ FAILED'}
      </div>
      <p style="margin-top: 1rem; color: #9ca3af;">
        Generated: ${new Date(result.timestamp).toLocaleString()}
      </p>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${result.totalRoutes}</div>
        <div class="metric-label">Total Routes</div>
      </div>
      <div class="metric">
        <div class="metric-value">${result.passedRoutes}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric">
        <div class="metric-value">${result.failedRoutes}</div>
        <div class="metric-label">Failed</div>
      </div>
      ${result.flakeRate !== undefined ? `
      <div class="metric">
        <div class="metric-value">${(result.flakeRate * 100).toFixed(2)}%</div>
        <div class="metric-label">Flake Rate</div>
      </div>
      ` : ''}
    </div>

    <div class="results">
      <h2 style="margin-bottom: 1rem;">Route Comparisons</h2>
      ${result.comparisons.map(comp => generateResultItem(comp)).join('\n')}
    </div>
  </div>
</body>
</html>
  `;

  await fs.writeFile(outputPath, html);
}

function generateResultItem(comp: ComparisonResult): string {
  const relativeBaseline = path.relative(path.dirname(comp.actualPath), comp.baselinePath);
  const relativeActual = path.basename(comp.actualPath);
  const relativeDiff = comp.diffPath ? path.basename(comp.diffPath) : null;

  return `
    <div class="result-item ${comp.passed ? 'passed' : 'failed'}">
      <div class="result-header">
        <div class="route-name">${comp.route}</div>
        <div class="diff-percent">
          ${(comp.percentDiff * 100).toFixed(4)}% diff
          (threshold: ${(comp.threshold * 100).toFixed(2)}%)
        </div>
      </div>
      ${!comp.passed ? `
      <div class="images">
        <div class="image-box">
          <div class="image-label">Baseline</div>
          <img src="${relativeBaseline}" alt="Baseline">
        </div>
        <div class="image-box">
          <div class="image-label">Actual</div>
          <img src="${relativeActual}" alt="Actual">
        </div>
        ${relativeDiff ? `
        <div class="image-box">
          <div class="image-label">Diff</div>
          <img src="${relativeDiff}" alt="Diff">
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
}

export async function generateJSONSummary(
  result: GateResult,
  outputPath: string
): Promise<void> {
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
}
