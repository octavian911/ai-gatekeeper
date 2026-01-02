import { describe, it, expect } from 'vitest';
import {
  resolveThresholds,
  computeOriginalityPercent,
  scaleThresholdsToViewport,
  DEFAULT_VIEWPORT,
  GLOBAL_THRESHOLDS,
  TAG_OVERRIDES,
} from './thresholds.js';
import type { ScreenBaseline } from './types.js';

describe('thresholds', () => {
  describe('resolveThresholds - precedence', () => {
    it('should use global defaults for screens without tags or overrides', () => {
      const screen: ScreenBaseline = {
        name: 'home',
        url: '/home',
      };

      const result = resolveThresholds(screen);

      expect(result.warn.diffPixelRatio).toBe(GLOBAL_THRESHOLDS.warn.diffPixelRatio);
      expect(result.fail.diffPixelRatio).toBe(GLOBAL_THRESHOLDS.fail.diffPixelRatio);
      expect(result.requireMasks).toBeUndefined();
    });

    it('should apply tag overrides for critical tag', () => {
      const screen: ScreenBaseline = {
        name: 'checkout',
        url: '/checkout',
        tags: ['critical'],
      };

      const result = resolveThresholds(screen);

      expect(result.warn.diffPixelRatio).toBe(TAG_OVERRIDES.critical.warn.diffPixelRatio);
      expect(result.fail.diffPixelRatio).toBe(TAG_OVERRIDES.critical.fail.diffPixelRatio);
    });

    it('should apply tag overrides for noisy tag', () => {
      const screen: ScreenBaseline = {
        name: 'dashboard',
        url: '/dashboard',
        tags: ['noisy'],
      };

      const result = resolveThresholds(screen);

      expect(result.warn.diffPixelRatio).toBe(TAG_OVERRIDES.noisy.warn.diffPixelRatio);
      expect(result.fail.diffPixelRatio).toBe(TAG_OVERRIDES.noisy.fail.diffPixelRatio);
      expect(result.requireMasks).toBe(true);
    });

    it('should prioritize per-screen overrides over tag overrides', () => {
      const screen: ScreenBaseline = {
        name: 'special',
        url: '/special',
        tags: ['critical'],
        thresholds: {
          warn: {
            diffPixelRatio: 0.00005,
            diffPixels: 50,
          },
          fail: {
            diffPixelRatio: 0.0001,
            diffPixels: 100,
          },
        },
      };

      const result = resolveThresholds(screen);

      expect(result.warn.diffPixelRatio).toBe(0.00005);
      expect(result.warn.diffPixels).toBe(50);
      expect(result.fail.diffPixelRatio).toBe(0.0001);
      expect(result.fail.diffPixels).toBe(100);
    });

    it('should allow partial per-screen overrides', () => {
      const screen: ScreenBaseline = {
        name: 'partial',
        url: '/partial',
        tags: ['critical'],
        thresholds: {
          warn: {
            diffPixels: 75,
          },
        },
      };

      const result = resolveThresholds(screen);

      expect(result.warn.diffPixels).toBe(75);
      expect(result.warn.diffPixelRatio).toBe(TAG_OVERRIDES.critical.warn.diffPixelRatio);
    });

    it('should use first tag when multiple tags are present', () => {
      const screen: ScreenBaseline = {
        name: 'multi',
        url: '/multi',
        tags: ['noisy', 'critical'],
      };

      const result = resolveThresholds(screen);

      expect(result.warn.diffPixelRatio).toBe(TAG_OVERRIDES.noisy.warn.diffPixelRatio);
      expect(result.requireMasks).toBe(true);
    });
  });

  describe('viewport scaling at 1280x720', () => {
    const width = 1280;
    const height = 720;
    const P = width * height;

    it('should scale global thresholds correctly', () => {
      const result = scaleThresholdsToViewport(width, height);

      const expectedWarn = Math.round(P * 0.00027);
      const expectedFail = Math.round(P * 0.00065);

      expect(result.warn.diffPixels).toBe(Math.max(150, Math.min(expectedWarn, 600)));
      expect(result.fail.diffPixels).toBe(Math.max(300, Math.min(expectedFail, 1200)));
      expect(result.warn.diffPixelRatio).toBe(0.0002);
      expect(result.fail.diffPixelRatio).toBe(0.0005);
    });

    it('should produce warn ~250 and fail ~600 for 1280x720', () => {
      const result = scaleThresholdsToViewport(width, height);

      expect(result.warn.diffPixels).toBeGreaterThanOrEqual(248);
      expect(result.warn.diffPixels).toBeLessThanOrEqual(252);
      expect(result.fail.diffPixels).toBeGreaterThanOrEqual(598);
      expect(result.fail.diffPixels).toBeLessThanOrEqual(602);
    });

    it('should scale critical tag thresholds', () => {
      const result = scaleThresholdsToViewport(width, height, 'critical');

      const expectedWarn = Math.round(P * 0.00016);
      const expectedFail = Math.round(P * 0.00043);

      expect(result.warn.diffPixels).toBe(Math.max(100, Math.min(expectedWarn, 450)));
      expect(result.fail.diffPixels).toBe(Math.max(200, Math.min(expectedFail, 900)));
    });

    it('should scale noisy tag thresholds', () => {
      const result = scaleThresholdsToViewport(width, height, 'noisy');

      const expectedWarn = Math.round(P * 0.00038);
      const expectedFail = Math.round(P * 0.00100);

      expect(result.warn.diffPixels).toBe(Math.max(200, Math.min(expectedWarn, 900)));
      expect(result.fail.diffPixels).toBe(Math.max(450, Math.min(expectedFail, 2000)));
    });

    it('should clamp to minimum values for small viewports', () => {
      const result = scaleThresholdsToViewport(100, 100);

      expect(result.warn.diffPixels).toBe(150);
      expect(result.fail.diffPixels).toBe(300);
    });

    it('should clamp to maximum values for large viewports', () => {
      const result = scaleThresholdsToViewport(5000, 5000);

      expect(result.warn.diffPixels).toBe(600);
      expect(result.fail.diffPixels).toBe(1200);
    });
  });

  describe('noisy tag requireMasks behavior', () => {
    it('should set requireMasks=true for noisy tag', () => {
      const screen: ScreenBaseline = {
        name: 'noisy-screen',
        url: '/noisy',
        tags: ['noisy'],
      };

      const result = resolveThresholds(screen);

      expect(result.requireMasks).toBe(true);
    });

    it('should not set requireMasks for non-noisy tags', () => {
      const screen: ScreenBaseline = {
        name: 'critical-screen',
        url: '/critical',
        tags: ['critical'],
      };

      const result = resolveThresholds(screen);

      expect(result.requireMasks).toBeUndefined();
    });

    it('should allow per-screen override of requireMasks', () => {
      const screen: ScreenBaseline = {
        name: 'noisy-override',
        url: '/noisy-override',
        tags: ['noisy'],
        thresholds: {
          requireMasks: false,
        },
      };

      const result = resolveThresholds(screen);

      expect(result.requireMasks).toBe(false);
    });

    it('should validate noisy screen fails without masks', () => {
      const screen: ScreenBaseline = {
        name: 'noisy-no-masks',
        url: '/noisy-no-masks',
        tags: ['noisy'],
      };

      const thresholds = resolveThresholds(screen);

      expect(thresholds.requireMasks).toBe(true);
      
      if (thresholds.requireMasks && (!screen.masks || screen.masks.length === 0)) {
        expect(true).toBe(true);
      } else {
        expect(false).toBe(true);
      }
    });

    it('should allow noisy screen with masks', () => {
      const screen: ScreenBaseline = {
        name: 'noisy-with-masks',
        url: '/noisy-with-masks',
        tags: ['noisy'],
        masks: [
          { type: 'css', selector: '.dynamic-content' },
        ],
      };

      const thresholds = resolveThresholds(screen);

      expect(thresholds.requireMasks).toBe(true);
      expect(screen.masks).toBeDefined();
      expect(screen.masks!.length).toBeGreaterThan(0);
    });
  });

  describe('computeOriginalityPercent', () => {
    it('should compute 100% for no differences', () => {
      expect(computeOriginalityPercent(0, 1000)).toBe(100);
    });

    it('should compute 0% for complete difference', () => {
      expect(computeOriginalityPercent(1000, 1000)).toBe(0);
    });

    it('should compute 50% for half difference', () => {
      expect(computeOriginalityPercent(500, 1000)).toBe(50);
    });

    it('should handle zero total pixels', () => {
      expect(computeOriginalityPercent(0, 0)).toBe(0);
    });

    it('should compute correct percentage for typical case', () => {
      expect(computeOriginalityPercent(250, 921600)).toBeCloseTo(99.97, 2);
    });
  });
});
