import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import type { EvidencePack } from './types.js';

export async function createEvidencePack(
  runDir: string,
  outputPath: string
): Promise<EvidencePack> {
  const runId = path.basename(runDir);
  const timestamp = new Date().toISOString();

  // Collect all files
  const baselines = await collectFiles(path.join(runDir, '../..', 'baselines'));
  const actuals = await collectFiles(path.join(runDir, 'actual'));
  const diffs = await collectFiles(path.join(runDir, 'diff'));

  // Hash summary.json
  const summaryPath = path.join(runDir, 'summary.json');
  const summaryHash = await hashFile(summaryPath);

  const manifest: EvidencePack['manifest'] = {
    baselines: await Promise.all(
      baselines.map(async (p) => ({
        path: p,
        hash: await hashFile(p),
      }))
    ),
    actuals: await Promise.all(
      actuals.map(async (p) => ({
        path: p,
        hash: await hashFile(p),
      }))
    ),
    diffs: await Promise.all(
      diffs.map(async (p) => ({
        path: p,
        hash: await hashFile(p),
      }))
    ),
    summary: {
      path: 'summary.json',
      hash: summaryHash,
    },
  };

  // Create zip archive
  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  // Add manifest
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // Add all files
  for (const file of [...baselines, ...actuals, ...diffs]) {
    const relativePath = path.relative(runDir, file);
    archive.file(file, { name: relativePath });
  }

  archive.file(summaryPath, { name: 'summary.json' });

  await archive.finalize();

  return {
    runId,
    timestamp,
    manifest,
  };
}

async function collectFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return collectFiles(fullPath);
        }
        return [fullPath];
      })
    );
    return files.flat();
  } catch {
    return [];
  }
}

async function hashFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}
