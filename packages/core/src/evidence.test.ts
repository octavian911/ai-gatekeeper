import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEvidencePack } from './evidence.js';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import type { GateResult } from './types.js';

const TEST_DIR = path.join(process.cwd(), '.test-evidence');

async function createTestRun(runId: string): Promise<string> {
  const runDir = path.join(TEST_DIR, 'runs', runId);
  await fs.mkdir(path.join(runDir, 'actual'), { recursive: true });
  await fs.mkdir(path.join(runDir, 'diff'), { recursive: true });

  const summary: GateResult = {
    passed: false,
    timestamp: new Date().toISOString(),
    totalRoutes: 2,
    passedRoutes: 1,
    failedRoutes: 1,
    comparisons: [
      {
        route: '/home',
        passed: true,
        pixelsDiff: 0,
        percentDiff: 0,
        threshold: 0.01,
        baselinePath: 'baselines/home.png',
        actualPath: path.join(runDir, 'actual', 'home.png'),
      },
      {
        route: '/about',
        passed: false,
        pixelsDiff: 500,
        percentDiff: 0.05,
        threshold: 0.01,
        baselinePath: 'baselines/about.png',
        actualPath: path.join(runDir, 'actual', 'about.png'),
        diffPath: path.join(runDir, 'diff', 'about.png'),
      },
    ],
  };

  await fs.writeFile(
    path.join(runDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  await fs.writeFile(
    path.join(runDir, 'report.html'),
    '<html><body>Test Report</body></html>'
  );

  await fs.writeFile(
    path.join(runDir, 'actual', 'home.png'),
    Buffer.from('fake-home-image')
  );

  await fs.writeFile(
    path.join(runDir, 'actual', 'about.png'),
    Buffer.from('fake-about-image')
  );

  await fs.writeFile(
    path.join(runDir, 'diff', 'about.png'),
    Buffer.from('fake-diff-image')
  );

  return runDir;
}

async function hashFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

describe('createEvidencePack', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('creates zip with all required files', async () => {
    const runDir = await createTestRun('test-run-1');
    const outputPath = path.join(runDir, 'evidence.zip');

    const result = await createEvidencePack(runDir, outputPath);

    expect(result.outputPath).toBe(outputPath);
    expect(result.fileCount).toBeGreaterThan(0);

    const zipExists = await fs.access(outputPath).then(() => true).catch(() => false);
    expect(zipExists).toBe(true);

    const zip = new AdmZip(outputPath);
    const entries = zip.getEntries();
    const entryNames = entries.map(e => e.entryName);

    expect(entryNames).toContain('summary.json');
    expect(entryNames).toContain('report.html');
    expect(entryNames).toContain('MANIFEST.sha256');
    expect(entryNames).toContain('DECISION.md');
  });

  it('includes all actual and diff images', async () => {
    const runDir = await createTestRun('test-run-2');
    const outputPath = path.join(runDir, 'evidence.zip');

    await createEvidencePack(runDir, outputPath);

    const zip = new AdmZip(outputPath);
    const entries = zip.getEntries();
    const entryNames = entries.map(e => e.entryName);

    expect(entryNames).toContain('actual/home.png');
    expect(entryNames).toContain('actual/about.png');
    expect(entryNames).toContain('diff/about.png');
  });

  it('MANIFEST.sha256 lines match actual hashes', async () => {
    const runDir = await createTestRun('test-run-3');
    const outputPath = path.join(runDir, 'evidence.zip');

    await createEvidencePack(runDir, outputPath);

    const zip = new AdmZip(outputPath);
    const manifestEntry = zip.getEntry('MANIFEST.sha256');
    expect(manifestEntry).toBeTruthy();

    const manifestContent = manifestEntry!.getData().toString('utf-8');
    const manifestLines = manifestContent.trim().split('\n');

    expect(manifestLines.length).toBeGreaterThan(0);

    for (const line of manifestLines) {
      const [hash, filePath] = line.split(/\s+/);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(filePath).toBeTruthy();

      const fileEntry = zip.getEntry(filePath);
      expect(fileEntry).toBeTruthy();

      const fileData = fileEntry!.getData();
      const actualHash = createHash('sha256').update(fileData).digest('hex');
      expect(actualHash).toBe(hash);
    }
  });

  it('DECISION.md contains run metadata', async () => {
    const runDir = await createTestRun('test-run-4');
    const outputPath = path.join(runDir, 'evidence.zip');

    await createEvidencePack(runDir, outputPath);

    const zip = new AdmZip(outputPath);
    const decisionEntry = zip.getEntry('DECISION.md');
    expect(decisionEntry).toBeTruthy();

    const decisionContent = decisionEntry!.getData().toString('utf-8');

    expect(decisionContent).toContain('# Gate Run Decision');
    expect(decisionContent).toContain('## Run Metadata');
    expect(decisionContent).toContain('Run ID');
    expect(decisionContent).toContain('Timestamp');
  });

  it('DECISION.md contains thresholds section', async () => {
    const runDir = await createTestRun('test-run-5');
    const outputPath = path.join(runDir, 'evidence.zip');

    await createEvidencePack(runDir, outputPath);

    const zip = new AdmZip(outputPath);
    const decisionEntry = zip.getEntry('DECISION.md');
    const decisionContent = decisionEntry!.getData().toString('utf-8');

    expect(decisionContent).toContain('## Thresholds');
  });

  it('DECISION.md contains table of screens with status', async () => {
    const runDir = await createTestRun('test-run-6');
    const outputPath = path.join(runDir, 'evidence.zip');

    await createEvidencePack(runDir, outputPath);

    const zip = new AdmZip(outputPath);
    const decisionEntry = zip.getEntry('DECISION.md');
    const decisionContent = decisionEntry!.getData().toString('utf-8');

    expect(decisionContent).toContain('## Screen Results');
    expect(decisionContent).toContain('| Screen ID | Route | Originality % | Status |');
    expect(decisionContent).toContain('/home');
    expect(decisionContent).toContain('/about');
    expect(decisionContent).toContain('PASS');
    expect(decisionContent).toContain('FAIL');
  });

  it('throws error when summary.json is missing', async () => {
    const runDir = path.join(TEST_DIR, 'runs', 'empty-run');
    await fs.mkdir(runDir, { recursive: true });
    const outputPath = path.join(runDir, 'evidence.zip');

    await expect(createEvidencePack(runDir, outputPath)).rejects.toThrow(
      'Summary file not found'
    );
  });

  it('handles runs without diff images', async () => {
    const runDir = path.join(TEST_DIR, 'runs', 'no-diff-run');
    await fs.mkdir(path.join(runDir, 'actual'), { recursive: true });

    const summary: GateResult = {
      passed: true,
      timestamp: new Date().toISOString(),
      totalRoutes: 1,
      passedRoutes: 1,
      failedRoutes: 0,
      comparisons: [
        {
          route: '/home',
          passed: true,
          pixelsDiff: 0,
          percentDiff: 0,
          threshold: 0.01,
          baselinePath: 'baselines/home.png',
          actualPath: path.join(runDir, 'actual', 'home.png'),
        },
      ],
    };

    await fs.writeFile(
      path.join(runDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    await fs.writeFile(
      path.join(runDir, 'report.html'),
      '<html><body>All Passed</body></html>'
    );

    await fs.writeFile(
      path.join(runDir, 'actual', 'home.png'),
      Buffer.from('fake-image')
    );

    const outputPath = path.join(runDir, 'evidence.zip');
    const result = await createEvidencePack(runDir, outputPath);

    expect(result.fileCount).toBeGreaterThan(0);

    const zip = new AdmZip(outputPath);
    const entries = zip.getEntries();
    const entryNames = entries.map(e => e.entryName);

    expect(entryNames).toContain('summary.json');
    expect(entryNames).toContain('report.html');
    expect(entryNames).toContain('actual/home.png');
  });
});
