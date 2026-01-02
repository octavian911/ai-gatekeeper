import { PolicyConfig } from './types.js';

export const DEFAULT_POLICY: PolicyConfig = {
  pixelDiffThreshold: 0.001, // 0.1% pixel difference
  antiAliasingTolerance: 5,
  maxDiffPixels: 100,
};

export function getPolicyForTag(
  basePolicy: PolicyConfig,
  tag?: string
): PolicyConfig {
  if (!tag || !basePolicy.tagOverrides?.[tag]) {
    return basePolicy;
  }

  return {
    ...basePolicy,
    ...basePolicy.tagOverrides[tag],
  };
}

export function evaluateThreshold(
  pixelsDiff: number,
  totalPixels: number,
  policy: PolicyConfig
): boolean {
  const percentDiff = pixelsDiff / totalPixels;

  if (pixelsDiff > policy.maxDiffPixels) {
    return false;
  }

  if (percentDiff > policy.pixelDiffThreshold) {
    return false;
  }

  return true;
}
