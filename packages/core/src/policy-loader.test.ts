import { describe, it, expect } from 'vitest';
import {
  mergeDefaults,
  mergeEnforcement,
  applyTagRules,
  getTagThresholds,
  isThresholdLoosening,
  validateThresholdOverride,
  validateDeterminismOverride,
  computeMaskCoverageRatio,
  resolveScreen,
  CORE_DEFAULTS,
  DEFAULT_ENFORCEMENT,
} from './policy-loader.js';
import type { OrgPolicy, ScreenBaseline, Mask } from './types.js';

describe('Policy Loader', () => {
  describe('mergeDefaults', () => {
    it('returns core defaults when no org policy exists', () => {
      const result = mergeDefaults(null);
      expect(result).toEqual(CORE_DEFAULTS);
    });

    it('merges org policy with core defaults', () => {
      const orgPolicy: OrgPolicy = {
        schemaVersion: 1,
        defaults: {
          viewport: { width: 1920, height: 1080 },
          determinism: {
            browser: 'chromium',
            deviceScaleFactor: 2,
            locale: 'en-GB',
            timezoneId: 'Europe/London',
            colorScheme: 'dark',
            reduceMotion: 'reduce',
            disableAnimations: true,
            blockExternalNetwork: true,
            waitUntil: 'load',
            layoutStabilityMs: 500,
            screenshotAfterSettledOnly: true,
          },
          thresholds: {
            standard: {
              warn: { diffPixelRatio: 0.0001, diffPixels: 100 },
              fail: { diffPixelRatio: 0.0002, diffPixels: 200 },
            },
            critical: {
              warn: { diffPixelRatio: 0.00005, diffPixels: 50 },
              fail: { diffPixelRatio: 0.0001, diffPixels: 100 },
            },
            noisy: {
              warn: { diffPixelRatio: 0.0005, diffPixels: 500 },
              fail: { diffPixelRatio: 0.001, diffPixels: 1000 },
              requireMasks: true,
            },
          },
        },
        enforcement: DEFAULT_ENFORCEMENT,
      };

      const result = mergeDefaults(orgPolicy);
      
      expect(result.viewport).toEqual({ width: 1920, height: 1080 });
      expect(result.determinism.deviceScaleFactor).toBe(2);
      expect(result.determinism.locale).toBe('en-GB');
      expect(result.thresholds.standard.warn.diffPixelRatio).toBe(0.0001);
    });
  });

  describe('applyTagRules', () => {
    it('returns existing screen tags if present', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        tags: ['custom'],
      };

      const result = applyTagRules(screen, null);
      expect(result).toEqual(['custom']);
    });

    it('applies critical tag for matching routes', () => {
      const screen: ScreenBaseline = {
        name: 'Login',
        url: '/login',
      };

      const policy: OrgPolicy = {
        schemaVersion: 1,
        defaults: CORE_DEFAULTS,
        tagRules: {
          criticalRoutes: ['/login', '/checkout'],
        },
        enforcement: DEFAULT_ENFORCEMENT,
      };

      const result = applyTagRules(screen, policy);
      expect(result).toEqual(['critical']);
    });

    it('applies noisy tag for matching routes when no critical match', () => {
      const screen: ScreenBaseline = {
        name: 'Dashboard',
        url: '/dashboard',
      };

      const policy: OrgPolicy = {
        schemaVersion: 1,
        defaults: CORE_DEFAULTS,
        tagRules: {
          criticalRoutes: ['/login'],
          noisyRoutes: ['/dashboard'],
        },
        enforcement: DEFAULT_ENFORCEMENT,
      };

      const result = applyTagRules(screen, policy);
      expect(result).toEqual(['noisy']);
    });

    it('returns empty array when no tags match', () => {
      const screen: ScreenBaseline = {
        name: 'About',
        url: '/about',
      };

      const policy: OrgPolicy = {
        schemaVersion: 1,
        defaults: CORE_DEFAULTS,
        tagRules: {
          criticalRoutes: ['/login'],
        },
        enforcement: DEFAULT_ENFORCEMENT,
      };

      const result = applyTagRules(screen, policy);
      expect(result).toEqual([]);
    });
  });

  describe('getTagThresholds', () => {
    it('returns standard thresholds for undefined tag', () => {
      const result = getTagThresholds(undefined, CORE_DEFAULTS);
      expect(result).toEqual(CORE_DEFAULTS.thresholds.standard);
    });

    it('returns critical thresholds for critical tag', () => {
      const result = getTagThresholds('critical', CORE_DEFAULTS);
      expect(result).toEqual(CORE_DEFAULTS.thresholds.critical);
    });

    it('returns noisy thresholds for noisy tag', () => {
      const result = getTagThresholds('noisy', CORE_DEFAULTS);
      expect(result).toEqual(CORE_DEFAULTS.thresholds.noisy);
    });

    it('returns standard thresholds for unknown tag', () => {
      const result = getTagThresholds('unknown', CORE_DEFAULTS);
      expect(result).toEqual(CORE_DEFAULTS.thresholds.standard);
    });
  });

  describe('isThresholdLoosening', () => {
    const baseThresholds = {
      warn: { diffPixelRatio: 0.0002, diffPixels: 250 },
      fail: { diffPixelRatio: 0.0005, diffPixels: 600 },
    };

    it('returns false when no per-screen thresholds', () => {
      expect(isThresholdLoosening(undefined, baseThresholds)).toBe(false);
    });

    it('returns false when tightening warn ratio', () => {
      const perScreen = {
        warn: { diffPixelRatio: 0.0001, diffPixels: 250 },
      };
      expect(isThresholdLoosening(perScreen, baseThresholds)).toBe(false);
    });

    it('returns true when loosening warn ratio', () => {
      const perScreen = {
        warn: { diffPixelRatio: 0.0003, diffPixels: 250 },
      };
      expect(isThresholdLoosening(perScreen, baseThresholds)).toBe(true);
    });

    it('returns true when loosening warn pixels', () => {
      const perScreen = {
        warn: { diffPixelRatio: 0.0002, diffPixels: 300 },
      };
      expect(isThresholdLoosening(perScreen, baseThresholds)).toBe(true);
    });

    it('returns true when loosening fail ratio', () => {
      const perScreen = {
        fail: { diffPixelRatio: 0.0006, diffPixels: 600 },
      };
      expect(isThresholdLoosening(perScreen, baseThresholds)).toBe(true);
    });

    it('returns true when loosening fail pixels', () => {
      const perScreen = {
        fail: { diffPixelRatio: 0.0005, diffPixels: 700 },
      };
      expect(isThresholdLoosening(perScreen, baseThresholds)).toBe(true);
    });

    it('returns true when removing requireMasks', () => {
      const baseWithMasks = { ...baseThresholds, requireMasks: true };
      const perScreen = { requireMasks: false };
      expect(isThresholdLoosening(perScreen, baseWithMasks)).toBe(true);
    });
  });

  describe('validateThresholdOverride', () => {
    const baseThresholds = {
      warn: { diffPixelRatio: 0.0002, diffPixels: 250 },
      fail: { diffPixelRatio: 0.0005, diffPixels: 600 },
    };

    it('allows no override', () => {
      const screen: ScreenBaseline = { name: 'Test', url: '/test' };
      const result = validateThresholdOverride(screen, baseThresholds, DEFAULT_ENFORCEMENT);
      expect(result.allowed).toBe(true);
    });

    it('allows tightening thresholds', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        thresholds: {
          warn: { diffPixelRatio: 0.0001, diffPixels: 100 },
        },
      };
      const result = validateThresholdOverride(screen, baseThresholds, DEFAULT_ENFORCEMENT);
      expect(result.allowed).toBe(true);
    });

    it('rejects loosening when enforcement disallows it', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        thresholds: {
          warn: { diffPixelRatio: 0.0003, diffPixels: 250 },
        },
      };
      const result = validateThresholdOverride(screen, baseThresholds, DEFAULT_ENFORCEMENT);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not allow loosening');
    });

    it('rejects loosening without justification when allowed', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        thresholds: {
          warn: { diffPixelRatio: 0.0003, diffPixels: 250 },
        },
      };
      const enforcement = { ...DEFAULT_ENFORCEMENT, allowLoosening: true };
      const result = validateThresholdOverride(screen, baseThresholds, enforcement);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires overrideJustification');
    });

    it('allows loosening with justification when enforcement allows', () => {
      const screen: ScreenBaseline & { overrideJustification: string } = {
        name: 'Test',
        url: '/test',
        thresholds: {
          warn: { diffPixelRatio: 0.0003, diffPixels: 250 },
        },
        overrideJustification: 'Dynamic content requires higher tolerance',
      };
      const enforcement = { ...DEFAULT_ENFORCEMENT, allowLoosening: true };
      const result = validateThresholdOverride(screen, baseThresholds, enforcement);
      expect(result.allowed).toBe(true);
    });
  });

  describe('validateDeterminismOverride', () => {
    it('allows no override', () => {
      const result = validateDeterminismOverride(undefined, DEFAULT_ENFORCEMENT, false);
      expect(result.allowed).toBe(true);
    });

    it('rejects disabling animations without allowLoosening', () => {
      const perScreen = { disableAnimations: false };
      const result = validateDeterminismOverride(perScreen, DEFAULT_ENFORCEMENT, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('disableAnimations');
    });

    it('rejects disabling animations without justification', () => {
      const perScreen = { disableAnimations: false };
      const enforcement = { ...DEFAULT_ENFORCEMENT, allowLoosening: true };
      const result = validateDeterminismOverride(perScreen, enforcement, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires overrideJustification');
    });

    it('allows disabling animations with justification and allowLoosening', () => {
      const perScreen = { disableAnimations: false };
      const enforcement = { ...DEFAULT_ENFORCEMENT, allowLoosening: true };
      const result = validateDeterminismOverride(perScreen, enforcement, true);
      expect(result.allowed).toBe(true);
    });

    it('rejects disabling network blocking without allowLoosening', () => {
      const perScreen = { blockExternalNetwork: false };
      const result = validateDeterminismOverride(perScreen, DEFAULT_ENFORCEMENT, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blockExternalNetwork');
    });
  });

  describe('computeMaskCoverageRatio', () => {
    const viewport = { width: 1280, height: 720, deviceScaleFactor: 1, browser: 'chromium' as const };

    it('returns 0 for no masks', () => {
      const result = computeMaskCoverageRatio([], viewport);
      expect(result).toBe(0);
    });

    it('calculates coverage for rect masks', () => {
      const masks: Mask[] = [
        { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
        { type: 'rect', x: 0, y: 0, width: 200, height: 200 },
      ];
      const totalArea = viewport.width * viewport.height;
      const maskArea = 100 * 100 + 200 * 200;
      const expected = maskArea / totalArea;
      
      const result = computeMaskCoverageRatio(masks, viewport);
      expect(result).toBeCloseTo(expected, 5);
    });

    it('ignores css masks in coverage calculation', () => {
      const masks: Mask[] = [
        { type: 'css', selector: '.dynamic' },
        { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
      ];
      const totalArea = viewport.width * viewport.height;
      const maskArea = 100 * 100;
      const expected = maskArea / totalArea;
      
      const result = computeMaskCoverageRatio(masks, viewport);
      expect(result).toBeCloseTo(expected, 5);
    });
  });

  describe('resolveScreen', () => {
    it('resolves screen with core defaults when no policy', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
      };

      const result = resolveScreen(screen, null);
      
      expect(result.resolvedViewport.width).toBe(CORE_DEFAULTS.viewport.width);
      expect(result.resolvedViewport.height).toBe(CORE_DEFAULTS.viewport.height);
      expect(result.resolvedThresholds.warn.diffPixelRatio).toBe(
        CORE_DEFAULTS.thresholds.standard.warn.diffPixelRatio
      );
      expect(result.appliedTags).toEqual([]);
      expect(result.looseningApplied).toBe(false);
    });

    it('applies tag rules and uses appropriate thresholds', () => {
      const screen: ScreenBaseline = {
        name: 'Login',
        url: '/login',
      };

      const policy: OrgPolicy = {
        schemaVersion: 1,
        defaults: CORE_DEFAULTS,
        tagRules: {
          criticalRoutes: ['/login'],
        },
        enforcement: DEFAULT_ENFORCEMENT,
      };

      const result = resolveScreen(screen, policy);
      
      expect(result.appliedTags).toEqual(['critical']);
      expect(result.resolvedThresholds.warn.diffPixelRatio).toBe(
        CORE_DEFAULTS.thresholds.critical.warn.diffPixelRatio
      );
    });

    it('throws error when loosening without allowLoosening', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        thresholds: {
          warn: { diffPixelRatio: 0.001, diffPixels: 1000 },
        },
      };

      expect(() => resolveScreen(screen, null)).toThrow('threshold override rejected');
    });

    it('throws error when mask coverage exceeds limit', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        masks: [
          { type: 'rect', x: 0, y: 0, width: 1000, height: 600 },
        ],
      };

      expect(() => resolveScreen(screen, null)).toThrow('mask coverage');
      expect(() => resolveScreen(screen, null)).toThrow('exceeds policy limit');
    });

    it('allows loosening with justification when enforcement allows', () => {
      const screen: ScreenBaseline & { overrideJustification: string } = {
        name: 'Test',
        url: '/test',
        thresholds: {
          warn: { diffPixelRatio: 0.001, diffPixels: 1000 },
        },
        overrideJustification: 'Lots of dynamic content',
      };

      const policy: OrgPolicy = {
        schemaVersion: 1,
        defaults: CORE_DEFAULTS,
        enforcement: {
          ...DEFAULT_ENFORCEMENT,
          allowLoosening: true,
        },
      };

      const result = resolveScreen(screen, policy);
      
      expect(result.looseningApplied).toBe(true);
      expect(result.overrideJustification).toBe('Lots of dynamic content');
      expect(result.resolvedThresholds.warn.diffPixelRatio).toBe(0.001);
    });

    it('merges per-screen viewport with policy defaults', () => {
      const screen: ScreenBaseline = {
        name: 'Test',
        url: '/test',
        viewport: {
          width: 1920,
          height: 1080,
        },
      };

      const result = resolveScreen(screen, null);
      
      expect(result.resolvedViewport.width).toBe(1920);
      expect(result.resolvedViewport.height).toBe(1080);
      expect(result.resolvedViewport.deviceScaleFactor).toBe(
        CORE_DEFAULTS.determinism.deviceScaleFactor
      );
    });

    it('uses explicit screen tags over tag rules', () => {
      const screen: ScreenBaseline = {
        name: 'Login',
        url: '/login',
        tags: ['noisy'],
      };

      const policy: OrgPolicy = {
        schemaVersion: 1,
        defaults: CORE_DEFAULTS,
        tagRules: {
          criticalRoutes: ['/login'],
        },
        enforcement: DEFAULT_ENFORCEMENT,
      };

      const result = resolveScreen(screen, policy);
      
      expect(result.appliedTags).toEqual(['noisy']);
      expect(result.resolvedThresholds.warn.diffPixelRatio).toBe(
        CORE_DEFAULTS.thresholds.noisy.warn.diffPixelRatio
      );
    });
  });
});
