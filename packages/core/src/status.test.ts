import { describe, it, expect } from 'vitest';
import { evaluateStatus } from './status.js';
import type { ScreenThresholds } from './types.js';

const defaultThresholds: ScreenThresholds = {
  warn: {
    diffPixelRatio: 0.0002,
    diffPixels: 250,
  },
  fail: {
    diffPixelRatio: 0.0005,
    diffPixels: 600,
  },
};

const noisyThresholds: ScreenThresholds = {
  warn: {
    diffPixelRatio: 0.0003,
    diffPixels: 350,
  },
  fail: {
    diffPixelRatio: 0.0008,
    diffPixels: 900,
  },
  requireMasks: true,
};

describe('evaluateStatus', () => {
  describe('PASS status', () => {
    it('should return PASS when diff is below warn thresholds', () => {
      const result = evaluateStatus({
        diffPixels: 100,
        diffPixelRatio: 0.0001,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('PASS');
    });

    it('should return PASS when diff is exactly at warn threshold', () => {
      const result = evaluateStatus({
        diffPixels: 250,
        diffPixelRatio: 0.0002,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('PASS');
    });

    it('should return PASS for zero diff', () => {
      const result = evaluateStatus({
        diffPixels: 0,
        diffPixelRatio: 0,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('PASS');
    });
  });

  describe('WARN status', () => {
    it('should return WARN when diffPixelRatio exceeds warn threshold but not fail', () => {
      const result = evaluateStatus({
        diffPixels: 200,
        diffPixelRatio: 0.0003,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('WARN');
    });

    it('should return WARN when diffPixels exceeds warn threshold but not fail', () => {
      const result = evaluateStatus({
        diffPixels: 400,
        diffPixelRatio: 0.0001,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('WARN');
    });

    it('should return WARN when either threshold is exceeded', () => {
      const result = evaluateStatus({
        diffPixels: 300,
        diffPixelRatio: 0.0004,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('WARN');
    });
  });

  describe('FAIL status', () => {
    it('should return FAIL when diffPixelRatio exceeds fail threshold', () => {
      const result = evaluateStatus({
        diffPixels: 100,
        diffPixelRatio: 0.0006,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('FAIL');
    });

    it('should return FAIL when diffPixels exceeds fail threshold', () => {
      const result = evaluateStatus({
        diffPixels: 700,
        diffPixelRatio: 0.0001,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('FAIL');
    });

    it('should return FAIL when both fail thresholds are exceeded', () => {
      const result = evaluateStatus({
        diffPixels: 800,
        diffPixelRatio: 0.001,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('FAIL');
    });

    it('should return FAIL when error is present', () => {
      const result = evaluateStatus({
        diffPixels: 0,
        diffPixelRatio: 0,
        thresholds: defaultThresholds,
        error: 'Navigation timeout',
      });

      expect(result).toBe('FAIL');
    });

    it('should return FAIL when error is present even with good diff values', () => {
      const result = evaluateStatus({
        diffPixels: 10,
        diffPixelRatio: 0.00001,
        thresholds: defaultThresholds,
        error: '404 Not Found',
      });

      expect(result).toBe('FAIL');
    });
  });

  describe('requireMasks rule', () => {
    it('should return FAIL when requireMasks is true and no masks provided', () => {
      const result = evaluateStatus({
        diffPixels: 100,
        diffPixelRatio: 0.0001,
        thresholds: noisyThresholds,
      });

      expect(result).toBe('FAIL');
    });

    it('should return FAIL when requireMasks is true and masks array is empty', () => {
      const result = evaluateStatus({
        diffPixels: 100,
        diffPixelRatio: 0.0001,
        thresholds: noisyThresholds,
        masks: [],
      });

      expect(result).toBe('FAIL');
    });

    it('should evaluate normally when requireMasks is true and masks are provided', () => {
      const result = evaluateStatus({
        diffPixels: 100,
        diffPixelRatio: 0.0001,
        thresholds: noisyThresholds,
        masks: [{ type: 'css', selector: '.dynamic-content' }],
      });

      expect(result).toBe('PASS');
    });

    it('should return WARN when requireMasks is satisfied but warn threshold exceeded', () => {
      const result = evaluateStatus({
        diffPixels: 400,
        diffPixelRatio: 0.0004,
        thresholds: noisyThresholds,
        masks: [{ type: 'rect', x: 0, y: 0, width: 100, height: 100 }],
      });

      expect(result).toBe('WARN');
    });

    it('should return FAIL when requireMasks is satisfied but fail threshold exceeded', () => {
      const result = evaluateStatus({
        diffPixels: 1000,
        diffPixelRatio: 0.001,
        thresholds: noisyThresholds,
        masks: [{ type: 'css', selector: '.ads' }],
      });

      expect(result).toBe('FAIL');
    });
  });

  describe('edge cases', () => {
    it('should handle very small diff ratios correctly', () => {
      const result = evaluateStatus({
        diffPixels: 1,
        diffPixelRatio: 0.00000001,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('PASS');
    });

    it('should handle very large diff values correctly', () => {
      const result = evaluateStatus({
        diffPixels: 1000000,
        diffPixelRatio: 0.5,
        thresholds: defaultThresholds,
      });

      expect(result).toBe('FAIL');
    });

    it('should prioritize error over threshold checks', () => {
      const result = evaluateStatus({
        diffPixels: 0,
        diffPixelRatio: 0,
        thresholds: defaultThresholds,
        error: 'Some error',
      });

      expect(result).toBe('FAIL');
    });

    it('should prioritize requireMasks over good diff values', () => {
      const result = evaluateStatus({
        diffPixels: 0,
        diffPixelRatio: 0,
        thresholds: noisyThresholds,
      });

      expect(result).toBe('FAIL');
    });
  });
});
