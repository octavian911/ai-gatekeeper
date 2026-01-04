import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Offline Report Correctness', () => {
  const testDir = path.join(process.cwd(), '.test-offline-report');
  const evidenceDir = path.join(testDir, '.ai-gate', 'evidence');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('gate run produces offline-compatible index.html', async () => {
    const indexPath = path.join(evidenceDir, 'index.html');
    
    const exists = await fs.access(indexPath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`index.html not found at ${indexPath}. Run gate first.`);
    }

    const html = await fs.readFile(indexPath, 'utf-8');

    const externalUrlPattern = /https?:\/\/(?!localhost|127\.0\.0\.1)/gi;
    const externalUrls = html.match(externalUrlPattern) || [];
    
    expect(externalUrls.length).toBe(0);
    if (externalUrls.length > 0) {
      console.error('Found external URLs in index.html:', externalUrls);
    }
  });

  it('index.html references only local files that exist', async () => {
    const indexPath = path.join(evidenceDir, 'index.html');
    const html = await fs.readFile(indexPath, 'utf-8');

    const srcPattern = /src="([^"]+)"/g;
    const hrefPattern = /href="([^"]+\.(?:css|js|png|jpg|jpeg|gif|svg))"/g;
    
    const srcMatches = [...html.matchAll(srcPattern)].map(m => m[1]);
    const hrefMatches = [...html.matchAll(hrefPattern)].map(m => m[1]);
    const allReferences = [...srcMatches, ...hrefMatches];

    for (const ref of allReferences) {
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        if (!ref.includes('localhost') && !ref.includes('127.0.0.1')) {
          throw new Error(`External reference found: ${ref}`);
        }
        continue;
      }

      if (ref.startsWith('data:')) {
        continue;
      }

      const refPath = path.join(evidenceDir, ref);
      const exists = await fs.access(refPath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      if (!exists) {
        console.error(`Referenced file not found: ${ref} (resolved to ${refPath})`);
      }
    }
  });

  it('report.html is self-contained with inline CSS', async () => {
    const reportPath = path.join(evidenceDir, 'report.html');
    const html = await fs.readFile(reportPath, 'utf-8');

    expect(html).toContain('<style>');

    const externalStylesheets = html.match(/<link[^>]+rel="stylesheet"[^>]*>/g) || [];
    const cdnStylesheets = externalStylesheets.filter(link => 
      link.includes('http://') || link.includes('https://')
    );
    
    expect(cdnStylesheets.length).toBe(0);
  });

  it('all referenced images in report.html exist on disk', async () => {
    const reportPath = path.join(evidenceDir, 'report.html');
    const html = await fs.readFile(reportPath, 'utf-8');

    const imgPattern = /<img[^>]+src="([^"]+)"/g;
    const images = [...html.matchAll(imgPattern)].map(m => m[1]);

    for (const img of images) {
      if (img.startsWith('data:')) {
        continue;
      }

      if (img.startsWith('http://') || img.startsWith('https://')) {
        throw new Error(`External image reference found in report.html: ${img}`);
      }

      const imgPath = path.join(path.dirname(reportPath), img);
      const exists = await fs.access(imgPath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      if (!exists) {
        console.error(`Image not found: ${img} (resolved to ${imgPath})`);
      }
    }
  });

  it('evidence pack contains all required files', async () => {
    const requiredFiles = [
      'index.html',
      'report.html',
      'summary.json'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(evidenceDir, file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      if (!exists) {
        console.error(`Required file missing: ${file}`);
      }
    }
  });

  it('for each failed screen, baseline/actual/diff images exist', async () => {
    const summaryPath = path.join(evidenceDir, 'summary.json');
    const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
    
    if (!summaryExists) {
      return;
    }

    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
    
    if (!summary.comparisons) {
      return;
    }

    const failedComparisons = summary.comparisons.filter((c: any) => !c.passed);

    for (const comparison of failedComparisons) {
      if (comparison.baselinePath) {
        const exists = await fs.access(comparison.baselinePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        if (!exists) {
          console.error(`Baseline missing for ${comparison.route}: ${comparison.baselinePath}`);
        }
      }

      if (comparison.actualPath) {
        const exists = await fs.access(comparison.actualPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        if (!exists) {
          console.error(`Actual missing for ${comparison.route}: ${comparison.actualPath}`);
        }
      }

      if (comparison.diffPath) {
        const exists = await fs.access(comparison.diffPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        if (!exists) {
          console.error(`Diff missing for ${comparison.route}: ${comparison.diffPath}`);
        }
      }
    }
  });

  it('no broken symlinks in evidence directory', async () => {
    async function checkSymlinks(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isSymbolicLink()) {
          try {
            await fs.stat(fullPath);
          } catch (error) {
            throw new Error(`Broken symlink found: ${fullPath}`);
          }
        }
        
        if (entry.isDirectory()) {
          await checkSymlinks(fullPath);
        }
      }
    }

    const exists = await fs.access(evidenceDir).then(() => true).catch(() => false);
    if (exists) {
      await checkSymlinks(evidenceDir);
    }
  });
});
