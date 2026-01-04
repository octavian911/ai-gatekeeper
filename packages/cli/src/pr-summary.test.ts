import { describe, it, expect } from 'vitest';
import { formatPRSummary, computeRunStatus, computeWorstSimilarity, type PRSummaryData } from './pr-summary.js';

describe('PR Summary Utilities', () => {
  describe('formatPRSummary', () => {
    it('should include run information when provided', () => {
      const data: PRSummaryData = {
        status: 'PASS',
        totalScreens: 5,
        passedScreens: 5,
        warnedScreens: 0,
        failedScreens: 0,
        worstSimilarity: 1.0,
        runId: 'run-1234567890',
        commitSha: 'abc123def456ghi789',
      };

      const result = formatPRSummary(data);

      expect(result).toContain('Run Information');
      expect(result).toContain('Run ID');
      expect(result).toContain('run-1234567890');
      expect(result).toContain('Commit');
      expect(result).toContain('abc123d');
      expect(result).not.toContain('abc123def456ghi789');
    });

    it('should include artifact download instructions', () => {
      const data: PRSummaryData = {
        status: 'FAIL',
        totalScreens: 3,
        passedScreens: 2,
        warnedScreens: 0,
        failedScreens: 1,
        worstSimilarity: 0.95,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('Where to Find Evidence Artifacts');
      expect(result).toContain('Checks tab');
      expect(result).toContain('Workflow job');
      expect(result).toContain('Artifacts');
      expect(result).toContain('ai-gate-evidence');
      expect(result).toContain('report.html');
    });

    it('should show correct status emoji for PASS', () => {
      const data: PRSummaryData = {
        status: 'PASS',
        totalScreens: 3,
        passedScreens: 3,
        warnedScreens: 0,
        failedScreens: 0,
        worstSimilarity: 1.0,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('✅');
      expect(result).toContain('Passed');
    });

    it('should show correct status emoji for WARN', () => {
      const data: PRSummaryData = {
        status: 'WARN',
        totalScreens: 3,
        passedScreens: 2,
        warnedScreens: 1,
        failedScreens: 0,
        worstSimilarity: 0.98,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('⚠️');
      expect(result).toContain('Warning');
    });

    it('should show correct status emoji for FAIL', () => {
      const data: PRSummaryData = {
        status: 'FAIL',
        totalScreens: 3,
        passedScreens: 2,
        warnedScreens: 0,
        failedScreens: 1,
        worstSimilarity: 0.85,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('❌');
      expect(result).toContain('Failed');
    });

    it('should omit sections with zero counts', () => {
      const data: PRSummaryData = {
        status: 'PASS',
        totalScreens: 3,
        passedScreens: 3,
        warnedScreens: 0,
        failedScreens: 0,
        worstSimilarity: 1.0,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('Passed: 3');
      expect(result).not.toContain('Warned:');
      expect(result).not.toContain('Failed:');
    });

    it('should format similarity percentage correctly', () => {
      const data: PRSummaryData = {
        status: 'FAIL',
        totalScreens: 1,
        passedScreens: 0,
        warnedScreens: 0,
        failedScreens: 1,
        worstSimilarity: 0.8765,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('87.65%');
    });

    it('should work without optional fields', () => {
      const data: PRSummaryData = {
        status: 'PASS',
        totalScreens: 5,
        passedScreens: 5,
        warnedScreens: 0,
        failedScreens: 0,
        worstSimilarity: 1.0,
      };

      const result = formatPRSummary(data);

      expect(result).toContain('Summary');
      expect(result).toContain('Status: PASS');
      expect(result).toContain('Total Screens: 5');
      expect(result).not.toContain('Run Information');
    });
  });

  describe('computeRunStatus', () => {
    it('should return FAIL when failures exist', () => {
      expect(computeRunStatus(5, 0, 1)).toBe('FAIL');
      expect(computeRunStatus(0, 2, 3)).toBe('FAIL');
      expect(computeRunStatus(10, 5, 1)).toBe('FAIL');
    });

    it('should return WARN when warnings exist but no failures', () => {
      expect(computeRunStatus(5, 2, 0)).toBe('WARN');
      expect(computeRunStatus(0, 3, 0)).toBe('WARN');
    });

    it('should return PASS when no failures or warnings', () => {
      expect(computeRunStatus(10, 0, 0)).toBe('PASS');
      expect(computeRunStatus(1, 0, 0)).toBe('PASS');
    });

    it('should prioritize FAIL over WARN', () => {
      expect(computeRunStatus(3, 2, 1)).toBe('FAIL');
    });
  });

  describe('computeWorstSimilarity', () => {
    it('should return 1.0 for empty comparisons', () => {
      expect(computeWorstSimilarity([])).toBe(1.0);
    });

    it('should return worst similarity from comparisons', () => {
      const comparisons = [
        { percentDiff: 0.01 },
        { percentDiff: 0.15 },
        { percentDiff: 0.05 },
      ];

      expect(computeWorstSimilarity(comparisons)).toBe(0.85);
    });

    it('should handle perfect matches', () => {
      const comparisons = [
        { percentDiff: 0.0 },
        { percentDiff: 0.0 },
      ];

      expect(computeWorstSimilarity(comparisons)).toBe(1.0);
    });

    it('should handle single comparison', () => {
      const comparisons = [{ percentDiff: 0.2 }];

      expect(computeWorstSimilarity(comparisons)).toBe(0.8);
    });
  });
});
