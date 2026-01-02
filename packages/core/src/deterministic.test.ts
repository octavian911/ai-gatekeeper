import { describe, it, expect } from 'vitest';
import {
  isAllowedDomain,
  isLayoutStable,
  DETERMINISTIC_DEFAULTS,
  type BoundingBox,
} from './deterministic.js';

describe('deterministic helpers', () => {
  describe('DETERMINISTIC_DEFAULTS', () => {
    it('should have expected default values', () => {
      expect(DETERMINISTIC_DEFAULTS.browser).toBe('chromium');
      expect(DETERMINISTIC_DEFAULTS.deviceScaleFactor).toBe(1);
      expect(DETERMINISTIC_DEFAULTS.locale).toBe('en-US');
      expect(DETERMINISTIC_DEFAULTS.timezoneId).toBe('UTC');
      expect(DETERMINISTIC_DEFAULTS.colorScheme).toBe('light');
      expect(DETERMINISTIC_DEFAULTS.reduceMotion).toBe('reduce');
      expect(DETERMINISTIC_DEFAULTS.disableAnimations).toBe(true);
      expect(DETERMINISTIC_DEFAULTS.blockExternalNetwork).toBe(true);
      expect(DETERMINISTIC_DEFAULTS.waitUntil).toBe('networkidle');
      expect(DETERMINISTIC_DEFAULTS.layoutStabilityMs).toBe(300);
      expect(DETERMINISTIC_DEFAULTS.screenshotAfterSettledOnly).toBe(true);
      expect(DETERMINISTIC_DEFAULTS.allowedDomains).toEqual([
        'localhost',
        '127.0.0.1',
        '[::1]',
      ]);
    });

    it('should have a fixed date', () => {
      expect(DETERMINISTIC_DEFAULTS.fixedDate).toBeInstanceOf(Date);
      expect(DETERMINISTIC_DEFAULTS.fixedDate.toISOString()).toBe(
        '2024-01-15T12:00:00.000Z'
      );
    });
  });

  describe('isAllowedDomain', () => {
    it('should allow exact localhost match', () => {
      expect(isAllowedDomain('http://localhost:3000/test', ['localhost'])).toBe(
        true
      );
    });

    it('should allow exact IP match', () => {
      expect(isAllowedDomain('http://127.0.0.1:8080/api', ['127.0.0.1'])).toBe(
        true
      );
    });

    it('should allow subdomain match', () => {
      expect(
        isAllowedDomain('http://api.example.com/test', ['example.com'])
      ).toBe(true);
    });

    it('should block external domains', () => {
      expect(
        isAllowedDomain('https://cdn.example.com/script.js', ['localhost'])
      ).toBe(false);
    });

    it('should block when no domains allowed', () => {
      expect(isAllowedDomain('http://localhost:3000/test', [])).toBe(false);
    });

    it('should handle multiple allowed domains', () => {
      const allowed = ['localhost', '127.0.0.1', 'example.com'];
      expect(isAllowedDomain('http://localhost:3000/test', allowed)).toBe(true);
      expect(isAllowedDomain('http://127.0.0.1:8080/test', allowed)).toBe(true);
      expect(isAllowedDomain('http://api.example.com/test', allowed)).toBe(
        true
      );
      expect(isAllowedDomain('http://evil.com/test', allowed)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isAllowedDomain('http://LOCALHOST:3000/test', ['localhost'])).toBe(
        true
      );
      expect(
        isAllowedDomain('http://api.EXAMPLE.COM/test', ['example.com'])
      ).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isAllowedDomain('not-a-url', ['localhost'])).toBe(false);
      expect(isAllowedDomain('', ['localhost'])).toBe(false);
    });

    it('should not allow partial hostname matches', () => {
      expect(isAllowedDomain('http://notlocalhost.com/test', ['localhost'])).toBe(
        false
      );
      expect(
        isAllowedDomain('http://example.com.evil.com/test', ['example.com'])
      ).toBe(false);
    });

    it('should handle IPv6 localhost', () => {
      expect(isAllowedDomain('http://[::1]:3000/test', ['[::1]'])).toBe(true);
    });
  });

  describe('isLayoutStable', () => {
    it('should return true when boxes are identical', () => {
      const box: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      expect(isLayoutStable(box, box)).toBe(true);
    });

    it('should return true when changes are within tolerance', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const box2: BoundingBox = { x: 0.5, y: 0.5, width: 100.5, height: 100.5 };
      expect(isLayoutStable(box1, box2, 1)).toBe(true);
    });

    it('should return false when changes exceed tolerance', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const box2: BoundingBox = { x: 0, y: 0, width: 100, height: 105 };
      expect(isLayoutStable(box1, box2, 1)).toBe(false);
    });

    it('should return false when either box is null', () => {
      const box: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      expect(isLayoutStable(null, box)).toBe(false);
      expect(isLayoutStable(box, null)).toBe(false);
      expect(isLayoutStable(null, null)).toBe(false);
    });

    it('should use default tolerance of 1px', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const box2: BoundingBox = { x: 1, y: 1, width: 101, height: 101 };
      expect(isLayoutStable(box1, box2)).toBe(true);
      
      const box3: BoundingBox = { x: 2, y: 0, width: 100, height: 100 };
      expect(isLayoutStable(box1, box3)).toBe(false);
    });

    it('should check all dimensions', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      
      const xChanged: BoundingBox = { x: 5, y: 0, width: 100, height: 100 };
      expect(isLayoutStable(box1, xChanged, 1)).toBe(false);
      
      const yChanged: BoundingBox = { x: 0, y: 5, width: 100, height: 100 };
      expect(isLayoutStable(box1, yChanged, 1)).toBe(false);
      
      const widthChanged: BoundingBox = { x: 0, y: 0, width: 110, height: 100 };
      expect(isLayoutStable(box1, widthChanged, 1)).toBe(false);
      
      const heightChanged: BoundingBox = { x: 0, y: 0, width: 100, height: 110 };
      expect(isLayoutStable(box1, heightChanged, 1)).toBe(false);
    });

    it('should handle negative coordinates', () => {
      const box1: BoundingBox = { x: -10, y: -10, width: 100, height: 100 };
      const box2: BoundingBox = { x: -10, y: -10, width: 100, height: 100 };
      expect(isLayoutStable(box1, box2)).toBe(true);
    });

    it('should handle custom tolerance values', () => {
      const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      const box2: BoundingBox = { x: 5, y: 5, width: 105, height: 105 };
      
      expect(isLayoutStable(box1, box2, 5)).toBe(true);
      expect(isLayoutStable(box1, box2, 4)).toBe(false);
    });
  });
});
