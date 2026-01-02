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
