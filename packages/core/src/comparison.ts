import fs from 'fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { ComparisonResult, PolicyConfig } from './types.js';
import { evaluateThreshold } from './policy.js';
import { detectChanges, type DetectedChange } from './change-detector.js';

export interface ComparisonResultExtended extends ComparisonResult {
  detectedChanges?: DetectedChange[];
  originalityPercent?: number;
}

export async function compareScreenshots(
  baselinePath: string,
  actualPath: string,
  diffPath: string,
  route: string,
  policy: PolicyConfig,
  threshold?: number
): Promise<ComparisonResultExtended> {
  const [baselineData, actualData] = await Promise.all([
    fs.readFile(baselinePath),
    fs.readFile(actualPath),
  ]);

  const baseline = PNG.sync.read(baselineData);
  const actual = PNG.sync.read(actualData);

  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    throw new Error(
      `Image dimensions mismatch for ${route}: baseline(${baseline.width}x${baseline.height}) vs actual(${actual.width}x${actual.height})`
    );
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });

  const pixelsDiff = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    {
      threshold: policy.antiAliasingTolerance / 255,
      includeAA: false,
    }
  );

  const totalPixels = baseline.width * baseline.height;
  const percentDiff = pixelsDiff / totalPixels;
  const originalityPercent = ((totalPixels - pixelsDiff) / totalPixels) * 100;

  const effectiveThreshold = threshold ?? policy.pixelDiffThreshold;
  const passed = evaluateThreshold(pixelsDiff, totalPixels, {
    ...policy,
    pixelDiffThreshold: effectiveThreshold,
  });

  let detectedChanges: DetectedChange[] | undefined;

  if (!passed) {
    await fs.writeFile(diffPath, PNG.sync.write(diff));
    
    detectedChanges = detectChanges(
      baselineData,
      actualData,
      diff.data,
      baseline.width,
      baseline.height
    );
  }

  return {
    route,
    passed,
    pixelsDiff,
    percentDiff,
    threshold: effectiveThreshold,
    baselinePath,
    actualPath,
    diffPath: passed ? undefined : diffPath,
    detectedChanges,
    originalityPercent,
  };
}
