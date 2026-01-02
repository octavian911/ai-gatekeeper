import { describe, it, expect } from 'vitest';
import { evaluateThreshold, getPolicyForTag, DEFAULT_POLICY } from './policy.js';

describe('Policy', () => {
  describe('evaluateThreshold', () => {
    it('should pass when diff is below threshold', () => {
      const result = evaluateThreshold(50, 100000, DEFAULT_POLICY);
      expect(result).toBe(true);
    });

    it('should fail when diff exceeds threshold percentage', () => {
      const result = evaluateThreshold(200, 100000, DEFAULT_POLICY);
      expect(result).toBe(false);
    });

    it('should fail when diff exceeds max pixels', () => {
      const result = evaluateThreshold(150, 1000000, DEFAULT_POLICY);
      expect(result).toBe(false);
    });
  });

  describe('getPolicyForTag', () => {
    it('should return base policy when no tag', () => {
      const policy = getPolicyForTag(DEFAULT_POLICY);
      expect(policy).toEqual(DEFAULT_POLICY);
    });

    it('should merge tag overrides', () => {
      const basePolicy = {
        ...DEFAULT_POLICY,
        tagOverrides: {
          chart: { pixelDiffThreshold: 0.005 },
        },
      };

      const policy = getPolicyForTag(basePolicy, 'chart');
      expect(policy.pixelDiffThreshold).toBe(0.005);
      expect(policy.antiAliasingTolerance).toBe(DEFAULT_POLICY.antiAliasingTolerance);
    });
  });
});
