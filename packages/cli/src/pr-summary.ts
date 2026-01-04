import type { GateResult, RunStatus } from '@ai-gate/core';

export interface PRSummaryData {
  status: RunStatus;
  totalScreens: number;
  passedScreens: number;
  warnedScreens: number;
  failedScreens: number;
  worstSimilarity: number;
  artifactPath?: string;
  runId?: string;
  commitSha?: string;
}

export function formatPRSummary(data: PRSummaryData): string {
  const statusEmoji = {
    PASS: '✅',
    WARN: '⚠️',
    FAIL: '❌',
  }[data.status];

  const statusText = data.status === 'PASS' ? 'Passed' : data.status === 'WARN' ? 'Warning' : 'Failed';

  const lines: string[] = [
    `## ${statusEmoji} Visual Regression Gate: ${statusText}`,
    '',
  ];

  if (data.runId || data.commitSha) {
    lines.push('### Run Information');
    lines.push('');
    if (data.runId) {
      lines.push(`- **Run ID**: \`${data.runId}\``);
    }
    if (data.commitSha) {
      const shortSha = data.commitSha.substring(0, 7);
      lines.push(`- **Commit**: \`${shortSha}\``);
    }
    lines.push('');
  }

  lines.push('### Summary');
  lines.push('');
  lines.push(`- **Status**: ${data.status}`);
  lines.push(`- **Total Screens**: ${data.totalScreens}`);
  
  if (data.passedScreens > 0) {
    lines.push(`- **Passed**: ${data.passedScreens}`);
  }
  
  if (data.warnedScreens > 0) {
    lines.push(`- **Warned**: ${data.warnedScreens}`);
  }
  
  if (data.failedScreens > 0) {
    lines.push(`- **Failed**: ${data.failedScreens}`);
  }

  if (data.worstSimilarity < 1.0) {
    const similarityPercent = (data.worstSimilarity * 100).toFixed(2);
    lines.push(`- **Worst Similarity**: ${similarityPercent}%`);
  }

  lines.push('');
  lines.push('### How to Download Evidence');
  lines.push('');
  lines.push('The evidence bundle includes side-by-side comparison images and an interactive HTML report:');
  lines.push('');
  lines.push('1. Go to the **Checks** tab on this PR');
  lines.push('2. Click on the workflow run that executed the visual tests');
  lines.push('3. Scroll to the **Artifacts** section at the bottom');
  lines.push('4. Download the `ai-gate-evidence` artifact (ZIP file)');
  lines.push('5. Unzip and open `index.html` or `report.html` in a browser');
  lines.push('');
  lines.push('The report works offline and shows:');
  lines.push('- Run summary with commit SHA and status counts');
  lines.push('- Per-screen comparisons: Baseline / Current / Diff overlay');
  lines.push('- Originality % and detailed pixel metrics');
  lines.push('');
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
    const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
    lines.push(`📎 [View workflow run and download artifacts](${runUrl})`);
    lines.push('');
  }

  return lines.join('\n');
}

export function computeRunStatus(
  passedCount: number,
  warnedCount: number,
  failedCount: number
): RunStatus {
  if (failedCount > 0) return 'FAIL';
  if (warnedCount > 0) return 'WARN';
  return 'PASS';
}

export function computeWorstSimilarity(comparisons: Array<{ percentDiff: number }>): number {
  if (comparisons.length === 0) return 1.0;
  const maxDiff = Math.max(...comparisons.map((c) => c.percentDiff));
  return 1.0 - maxDiff;
}
