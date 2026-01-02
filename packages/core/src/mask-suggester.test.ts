import { describe, it, expect } from 'vitest';
import {
  detectVolatileElements,
  rankSelector,
  isSafeToMask,
  generateMaskSuggestions,
  detectContainerVolatility,
  convertToMask,
  type ElementSnapshot,
  type VolatileElement,
} from './mask-suggester.js';

describe('mask-suggester', () => {
  describe('detectVolatileElements', () => {
    it('should detect text changes', () => {
      const snapshotA: ElementSnapshot[] = [
        {
          selector: '.timestamp',
          text: '2024-01-15 12:00:00',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const snapshotB: ElementSnapshot[] = [
        {
          selector: '.timestamp',
          text: '2024-01-15 12:01:00',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const volatile = detectVolatileElements(snapshotA, snapshotB);

      expect(volatile).toHaveLength(1);
      expect(volatile[0].changes).toContain('text_changed');
    });

    it('should detect element appearance', () => {
      const snapshotA: ElementSnapshot[] = [];

      const snapshotB: ElementSnapshot[] = [
        {
          selector: '.new-element',
          text: 'New',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const volatile = detectVolatileElements(snapshotA, snapshotB);

      expect(volatile).toHaveLength(1);
      expect(volatile[0].changes).toContain('appeared');
    });

    it('should detect element disappearance', () => {
      const snapshotA: ElementSnapshot[] = [
        {
          selector: '.old-element',
          text: 'Old',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const snapshotB: ElementSnapshot[] = [];

      const volatile = detectVolatileElements(snapshotA, snapshotB);

      expect(volatile).toHaveLength(1);
      expect(volatile[0].changes).toContain('disappeared');
    });

    it('should detect bounding box changes', () => {
      const snapshotA: ElementSnapshot[] = [
        {
          selector: '.movable',
          text: 'Content',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const snapshotB: ElementSnapshot[] = [
        {
          selector: '.movable',
          text: 'Content',
          bbox: { x: 15, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const volatile = detectVolatileElements(snapshotA, snapshotB);

      expect(volatile).toHaveLength(1);
      expect(volatile[0].changes).toContain('bbox_changed');
    });

    it('should detect visibility changes', () => {
      const snapshotA: ElementSnapshot[] = [
        {
          selector: '.toggle',
          text: 'Content',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const snapshotB: ElementSnapshot[] = [
        {
          selector: '.toggle',
          text: 'Content',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: false,
        },
      ];

      const volatile = detectVolatileElements(snapshotA, snapshotB);

      expect(volatile).toHaveLength(1);
      expect(volatile[0].changes).toContain('visibility_changed');
    });

    it('should ignore changes within tolerance', () => {
      const snapshotA: ElementSnapshot[] = [
        {
          selector: '.stable',
          text: 'Content',
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          visible: true,
        },
      ];

      const snapshotB: ElementSnapshot[] = [
        {
          selector: '.stable',
          text: 'Content',
          bbox: { x: 10, y: 11, width: 100, height: 20 },
          visible: true,
        },
      ];

      const volatile = detectVolatileElements(snapshotA, snapshotB);

      expect(volatile).toHaveLength(0);
    });
  });

  describe('rankSelector', () => {
    it('should rank data-testid highest', () => {
      const element: ElementSnapshot = {
        selector: '.element',
        text: 'Content',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
        testId: 'my-test-id',
      };

      const ranked = rankSelector(element);

      expect(ranked.selector).toBe('[data-testid="my-test-id"]');
      expect(ranked.confidence).toBe(0.95);
      expect(ranked.type).toBe('css');
    });

    it('should rank stable id second', () => {
      const element: ElementSnapshot = {
        selector: '.element',
        text: 'Content',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
        id: 'header-logo',
      };

      const ranked = rankSelector(element);

      expect(ranked.selector).toBe('#header-logo');
      expect(ranked.confidence).toBe(0.9);
      expect(ranked.type).toBe('css');
    });

    it('should reject unstable hashed ids', () => {
      const element: ElementSnapshot = {
        selector: '.element',
        text: 'Content',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
        id: 'abc123def456',
      };

      const ranked = rankSelector(element);

      expect(ranked.selector).not.toBe('#abc123def456');
      expect(ranked.confidence).toBeLessThan(0.9);
    });

    it('should rank aria-label third', () => {
      const element: ElementSnapshot = {
        selector: '.element',
        text: 'Content',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
        ariaLabel: 'Main navigation',
      };

      const ranked = rankSelector(element);

      expect(ranked.selector).toBe('[aria-label="Main navigation"]');
      expect(ranked.confidence).toBe(0.85);
      expect(ranked.type).toBe('css');
    });

    it('should fallback to rect mask', () => {
      const element: ElementSnapshot = {
        selector: '.element',
        text: 'Content',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
      };

      const ranked = rankSelector(element);

      expect(ranked.type).toBe('rect');
      expect(ranked.confidence).toBe(0.5);
    });
  });

  describe('isSafeToMask', () => {
    it('should allow safe elements', () => {
      const element: ElementSnapshot = {
        selector: '.timestamp',
        text: '2024-01-15 12:00:00',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
      };

      expect(isSafeToMask(element)).toBe(true);
    });

    it('should reject error messages', () => {
      const element: ElementSnapshot = {
        selector: '.message',
        text: 'Error: Failed to load',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
      };

      expect(isSafeToMask(element)).toBe(false);
    });

    it('should reject warning messages', () => {
      const element: ElementSnapshot = {
        selector: '.message',
        text: 'Warning: Check your input',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
      };

      expect(isSafeToMask(element)).toBe(false);
    });

    it('should reject unauthorized messages', () => {
      const element: ElementSnapshot = {
        selector: '.message',
        text: 'Unauthorized access',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
      };

      expect(isSafeToMask(element)).toBe(false);
    });

    it('should reject blocked messages', () => {
      const element: ElementSnapshot = {
        selector: '.message',
        text: 'Request blocked',
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        visible: true,
      };

      expect(isSafeToMask(element)).toBe(false);
    });
  });

  describe('detectContainerVolatility', () => {
    it('should suggest container mask for clustered volatile elements', () => {
      const volatileElements: VolatileElement[] = [];

      for (let i = 0; i < 6; i++) {
        volatileElements.push({
          element: {
            selector: `.item-${i}`,
            text: `Item ${i}`,
            bbox: { x: 10, y: 10 + i * 30, width: 100, height: 20 },
            visible: true,
          },
          snapshotA: {
            selector: `.item-${i}`,
            text: `Item ${i}`,
            bbox: { x: 10, y: 10 + i * 30, width: 100, height: 20 },
            visible: true,
          },
          snapshotB: {
            selector: `.item-${i}`,
            text: `Item ${i + 1}`,
            bbox: { x: 10, y: 10 + i * 30, width: 100, height: 20 },
            visible: true,
          },
          changes: ['text_changed'],
        });
      }

      const containers = detectContainerVolatility(volatileElements);

      expect(containers.length).toBeGreaterThan(0);
      expect(containers[0].type).toBe('rect');
      expect(containers[0].bbox).toBeDefined();
    });

    it('should not suggest container for scattered elements', () => {
      const volatileElements: VolatileElement[] = [];

      for (let i = 0; i < 3; i++) {
        volatileElements.push({
          element: {
            selector: `.item-${i}`,
            text: `Item ${i}`,
            bbox: { x: i * 500, y: i * 500, width: 100, height: 20 },
            visible: true,
          },
          snapshotA: {
            selector: `.item-${i}`,
            text: `Item ${i}`,
            bbox: { x: i * 500, y: i * 500, width: 100, height: 20 },
            visible: true,
          },
          snapshotB: {
            selector: `.item-${i}`,
            text: `Item ${i + 1}`,
            bbox: { x: i * 500, y: i * 500, width: 100, height: 20 },
            visible: true,
          },
          changes: ['text_changed'],
        });
      }

      const containers = detectContainerVolatility(volatileElements);

      expect(containers).toHaveLength(0);
    });
  });

  describe('generateMaskSuggestions', () => {
    it('should limit suggestions to maxSuggestions', () => {
      const volatileElements: VolatileElement[] = [];

      for (let i = 0; i < 20; i++) {
        volatileElements.push({
          element: {
            selector: `.item-${i}`,
            text: `Item ${i}`,
            bbox: { x: i * 500, y: i * 500, width: 100, height: 20 },
            visible: true,
            testId: `item-${i}`,
          },
          snapshotA: {
            selector: `.item-${i}`,
            text: `Item ${i}`,
            bbox: { x: i * 500, y: i * 500, width: 100, height: 20 },
            visible: true,
            testId: `item-${i}`,
          },
          snapshotB: {
            selector: `.item-${i}`,
            text: `Item ${i + 1}`,
            bbox: { x: i * 500, y: i * 500, width: 100, height: 20 },
            visible: true,
            testId: `item-${i}`,
          },
          changes: ['text_changed'],
        });
      }

      const suggestions = generateMaskSuggestions(
        volatileElements,
        'screen-01',
        5
      );

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should sort by confidence descending', () => {
      const volatileElements: VolatileElement[] = [
        {
          element: {
            selector: '.low',
            text: 'Low',
            bbox: { x: 10, y: 10, width: 100, height: 20 },
            visible: true,
          },
          snapshotA: {
            selector: '.low',
            text: 'Low',
            bbox: { x: 10, y: 10, width: 100, height: 20 },
            visible: true,
          },
          snapshotB: {
            selector: '.low',
            text: 'Changed',
            bbox: { x: 10, y: 10, width: 100, height: 20 },
            visible: true,
          },
          changes: ['text_changed'],
        },
        {
          element: {
            selector: '.high',
            text: 'High',
            bbox: { x: 10, y: 40, width: 100, height: 20 },
            visible: true,
            testId: 'high-priority',
          },
          snapshotA: {
            selector: '.high',
            text: 'High',
            bbox: { x: 10, y: 40, width: 100, height: 20 },
            visible: true,
            testId: 'high-priority',
          },
          snapshotB: {
            selector: '.high',
            text: 'Changed',
            bbox: { x: 10, y: 40, width: 100, height: 20 },
            visible: true,
            testId: 'high-priority',
          },
          changes: ['text_changed'],
        },
      ];

      const suggestions = generateMaskSuggestions(
        volatileElements,
        'screen-01',
        10
      );

      expect(suggestions[0].confidence).toBeGreaterThan(
        suggestions[suggestions.length - 1].confidence
      );
    });

    it('should filter unsafe elements', () => {
      const volatileElements: VolatileElement[] = [
        {
          element: {
            selector: '.error',
            text: 'Error occurred',
            bbox: { x: 10, y: 10, width: 100, height: 20 },
            visible: true,
            testId: 'error-message',
          },
          snapshotA: {
            selector: '.error',
            text: 'Error occurred',
            bbox: { x: 10, y: 10, width: 100, height: 20 },
            visible: true,
            testId: 'error-message',
          },
          snapshotB: {
            selector: '.error',
            text: 'Different error',
            bbox: { x: 10, y: 10, width: 100, height: 20 },
            visible: true,
            testId: 'error-message',
          },
          changes: ['text_changed'],
        },
      ];

      const suggestions = generateMaskSuggestions(
        volatileElements,
        'screen-01',
        10
      );

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('convertToMask', () => {
    it('should convert CSS suggestion to mask', () => {
      const suggestion = {
        screenId: 'screen-01',
        route: '/home',
        selector: '[data-testid="timestamp"]',
        reason: 'Element text_changed',
        confidence: 0.95,
        examples: ['2024-01-15 12:00:00'],
        type: 'css' as const,
      };

      const mask = convertToMask(suggestion);

      expect(mask.type).toBe('css');
      expect(mask.selector).toBe('[data-testid="timestamp"]');
    });

    it('should convert rect suggestion to mask', () => {
      const suggestion = {
        screenId: 'screen-01',
        route: '/home',
        selector: '.element',
        reason: 'Element text_changed',
        confidence: 0.5,
        examples: ['Content'],
        type: 'rect' as const,
        bbox: { x: 10, y: 20, width: 100, height: 50 },
      };

      const mask = convertToMask(suggestion);

      expect(mask.type).toBe('rect');
      expect(mask.x).toBe(10);
      expect(mask.y).toBe(20);
      expect(mask.width).toBe(100);
      expect(mask.height).toBe(50);
    });
  });
});
