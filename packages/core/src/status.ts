import type { RunStatus, ScreenThresholds, Mask } from './types.js';

export interface StatusEvaluationInput {
  diffPixels: number;
  diffPixelRatio: number;
  thresholds: ScreenThresholds;
  masks?: Mask[];
  error?: string;
}

export function evaluateStatus(input: StatusEvaluationInput): RunStatus {
  if (input.error) {
    return 'FAIL';
  }

  if (input.thresholds.requireMasks && (!input.masks || input.masks.length === 0)) {
    return 'FAIL';
  }

  const { diffPixels, diffPixelRatio, thresholds } = input;

  const isFailThreshold =
    diffPixelRatio > thresholds.fail.diffPixelRatio ||
    diffPixels > thresholds.fail.diffPixels;

  if (isFailThreshold) {
    return 'FAIL';
  }

  const isWarnThreshold =
    diffPixelRatio > thresholds.warn.diffPixelRatio ||
    diffPixels > thresholds.warn.diffPixels;

  if (isWarnThreshold) {
    return 'WARN';
  }

  return 'PASS';
}
