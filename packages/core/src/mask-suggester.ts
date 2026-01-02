import type { ComparisonResult, MaskSuggestion } from './types.js';

export function suggestMasks(
  comparisons: ComparisonResult[]
): MaskSuggestion[] {
  const suggestions: MaskSuggestion[] = [];

  for (const comp of comparisons) {
    if (!comp.passed) {
      // Analyze diff patterns and suggest masks
      // This is a simplified version - real implementation would analyze actual diff images

      // Common patterns to detect
      const patterns = [
        {
          selector: '[data-timestamp]',
          reason: 'Timestamp elements frequently change',
          confidence: 0.9,
        },
        {
          selector: '[data-random-id]',
          reason: 'Random ID elements are non-deterministic',
          confidence: 0.85,
        },
        {
          selector: 'canvas',
          reason: 'Canvas elements may have rendering differences',
          confidence: 0.7,
        },
        {
          selector: '.avatar img',
          reason: 'User avatars may vary',
          confidence: 0.6,
        },
      ];

      suggestions.push(
        ...patterns.map((p) => ({
          route: comp.route,
          selector: p.selector,
          reason: p.reason,
          confidence: p.confidence,
          examples: [`${comp.route}: ${p.reason}`],
        }))
      );
    }
  }

  // Deduplicate and sort by confidence
  const unique = suggestions.reduce((acc, s) => {
    const key = `${s.route}:${s.selector}`;
    if (!acc.has(key) || acc.get(key)!.confidence < s.confidence) {
      acc.set(key, s);
    }
    return acc;
  }, new Map<string, MaskSuggestion>());

  return Array.from(unique.values()).sort((a, b) => b.confidence - a.confidence);
}
