import { PNG } from 'pngjs';

export interface DetectedChange {
  type: 'position' | 'size' | 'color' | 'added' | 'removed' | 'text';
  selector?: string;
  description: string;
  confidence: number;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    deltaX?: number;
    deltaY?: number;
    deltaWidth?: number;
    deltaHeight?: number;
  };
}

export interface ChangeRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  diffPixels: number;
}

export function detectChanges(
  baselineData: Buffer,
  actualData: Buffer,
  diffMask: Uint8Array,
  width: number,
  height: number
): DetectedChange[] {
  const changes: DetectedChange[] = [];
  const regions = findChangeRegions(diffMask, width, height);

  for (const region of regions) {
    const change = analyzeRegion(region, baselineData, actualData, width, height);
    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

function findChangeRegions(
  diffMask: Uint8Array,
  width: number,
  height: number,
  minSize: number = 10
): ChangeRegion[] {
  const visited = new Set<number>();
  const regions: ChangeRegion[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const key = y * width + x;

      if (visited.has(key)) continue;
      if (diffMask[idx] === 0) continue;

      const region = floodFill(diffMask, width, height, x, y, visited);
      if (region.width >= minSize || region.height >= minSize) {
        regions.push(region);
      }
    }
  }

  return regions;
}

function floodFill(
  diffMask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<number>
): ChangeRegion {
  const queue: Array<[number, number]> = [[startX, startY]];
  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;
  let diffPixels = 0;

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = y * width + x;

    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = (y * width + x) * 4;
    if (diffMask[idx] === 0) continue;

    visited.add(key);
    diffPixels++;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    diffPixels,
  };
}

function analyzeRegion(
  region: ChangeRegion,
  baselineData: Buffer,
  actualData: Buffer,
  imgWidth: number,
  imgHeight: number
): DetectedChange | null {
  const baselinePng = PNG.sync.read(baselineData);
  const actualPng = PNG.sync.read(actualData);

  const baselineColor = getAverageColor(baselinePng.data, region, imgWidth);
  const actualColor = getAverageColor(actualPng.data, region, imgWidth);

  const colorDiff = Math.sqrt(
    Math.pow(baselineColor.r - actualColor.r, 2) +
    Math.pow(baselineColor.g - actualColor.g, 2) +
    Math.pow(baselineColor.b - actualColor.b, 2)
  );

  const areaRatio = (region.width * region.height) / (imgWidth * imgHeight);

  if (colorDiff > 50) {
    return {
      type: 'color',
      description: `Color changed in ${region.width}×${region.height}px area at (${region.x}, ${region.y})`,
      confidence: Math.min(0.95, colorDiff / 255),
      metadata: {
        oldValue: `rgb(${baselineColor.r}, ${baselineColor.g}, ${baselineColor.b})`,
        newValue: `rgb(${actualColor.r}, ${actualColor.g}, ${actualColor.b})`,
      },
    };
  }

  if (region.width > 50 && region.height > 50) {
    const similarRegion = findSimilarRegion(
      baselinePng.data,
      actualPng.data,
      region,
      imgWidth,
      imgHeight
    );

    if (similarRegion) {
      const deltaX = similarRegion.x - region.x;
      const deltaY = similarRegion.y - region.y;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        return {
          type: 'position',
          description: `Element moved ${Math.abs(deltaX)}px ${deltaX > 0 ? 'right' : 'left'}, ${Math.abs(deltaY)}px ${deltaY > 0 ? 'down' : 'up'}`,
          confidence: 0.85,
          metadata: { deltaX, deltaY },
        };
      }
    }
  }

  if (areaRatio > 0.01) {
    return {
      type: 'size',
      description: `Element size changed: ${region.width}×${region.height}px`,
      confidence: 0.75,
      metadata: {
        deltaWidth: region.width,
        deltaHeight: region.height,
      },
    };
  }

  return {
    type: 'color',
    description: `Visual change in ${region.width}×${region.height}px area`,
    confidence: 0.6,
  };
}

function getAverageColor(
  data: Uint8Array,
  region: ChangeRegion,
  imgWidth: number
): { r: number; g: number; b: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const idx = (y * imgWidth + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

function findSimilarRegion(
  baselineData: Uint8Array,
  actualData: Uint8Array,
  region: ChangeRegion,
  imgWidth: number,
  imgHeight: number
): ChangeRegion | null {
  const searchRadius = 100;
  let bestMatch: ChangeRegion | null = null;
  let bestSimilarity = 0;

  for (let dy = -searchRadius; dy <= searchRadius; dy += 10) {
    for (let dx = -searchRadius; dx <= searchRadius; dx += 10) {
      const newX = region.x + dx;
      const newY = region.y + dy;

      if (
        newX < 0 ||
        newY < 0 ||
        newX + region.width >= imgWidth ||
        newY + region.height >= imgHeight
      ) {
        continue;
      }

      const similarity = calculateRegionSimilarity(
        baselineData,
        actualData,
        region,
        { x: newX, y: newY, width: region.width, height: region.height, diffPixels: 0 },
        imgWidth
      );

      if (similarity > bestSimilarity && similarity > 0.8) {
        bestSimilarity = similarity;
        bestMatch = { x: newX, y: newY, width: region.width, height: region.height, diffPixels: 0 };
      }
    }
  }

  return bestMatch;
}

function calculateRegionSimilarity(
  baselineData: Uint8Array,
  actualData: Uint8Array,
  region1: ChangeRegion,
  region2: ChangeRegion,
  imgWidth: number
): number {
  let similarPixels = 0;
  let totalPixels = 0;

  for (let y = 0; y < region1.height; y++) {
    for (let x = 0; x < region1.width; x++) {
      const idx1 = ((region1.y + y) * imgWidth + (region1.x + x)) * 4;
      const idx2 = ((region2.y + y) * imgWidth + (region2.x + x)) * 4;

      const rDiff = Math.abs(baselineData[idx1] - actualData[idx2]);
      const gDiff = Math.abs(baselineData[idx1 + 1] - actualData[idx2 + 1]);
      const bDiff = Math.abs(baselineData[idx1 + 2] - actualData[idx2 + 2]);

      if (rDiff < 10 && gDiff < 10 && bDiff < 10) {
        similarPixels++;
      }
      totalPixels++;
    }
  }

  return similarPixels / totalPixels;
}
