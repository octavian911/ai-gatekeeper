import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_CLASSES = [
  /text-gray-[0-9]+/,
  /text-slate-[0-9]+/,
  /opacity-[56]0(?!\d)/,
];

const BASELINE_UI_COMPONENTS = [
  'pages/BaselinesPage.tsx',
  'components/BaselineCard.tsx',
  'components/BaselinePreviewDrawer.tsx',
  'components/BaselineUploadModal.tsx',
  'components/ImportZipModal.tsx',
  'components/ReviewerGuidancePanel.tsx',
  'components/ui/badge.tsx',
  'components/ui/input.tsx',
];

describe('Theme Contrast Guard', () => {
  BASELINE_UI_COMPONENTS.forEach((componentPath) => {
    it(`${componentPath} should not contain forbidden low-contrast classes`, () => {
      const fullPath = join(__dirname, componentPath);
      let content: string;
      
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch (error) {
        throw new Error(`Failed to read ${componentPath}: ${error}`);
      }

      const violations: string[] = [];

      FORBIDDEN_CLASSES.forEach((pattern) => {
        const matches = content.match(new RegExp(pattern, 'g'));
        if (matches) {
          violations.push(`Found forbidden pattern ${pattern.source}: ${matches.join(', ')}`);
        }
      });

      if (violations.length > 0) {
        throw new Error(
          `${componentPath} contains forbidden low-contrast classes:\n${violations.join('\n')}\n\n` +
          `Use semantic classes instead:\n` +
          `- text-primary (white/near-white for titles and key content)\n` +
          `- text-secondary (light gray for labels)\n` +
          `- text-muted (readable gray for hints only)\n` +
          `- text-icon-muted (for muted icons)`
        );
      }
    });
  });
});
