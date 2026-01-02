import { test as base, Page } from '@playwright/test';
import type { DeterministicOptions } from './types.js';
import { DETERMINISTIC_DEFAULTS } from './types.js';
import { prepareDeterministicPage } from './core.js';
import { waitForLayoutStability } from './helpers.js';

export interface DeterministicPageFixtures {
  deterministicPage: Page;
  deterministicOptions: DeterministicOptions;
}

export const test = base.extend<DeterministicPageFixtures>({
  deterministicOptions: async ({}, use) => {
    await use({});
  },

  context: async ({ browser, deterministicOptions }, use) => {
    const config = { ...DETERMINISTIC_DEFAULTS, ...deterministicOptions };
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: config.deviceScaleFactor,
      userAgent: 'Playwright-Deterministic/1.0',
      locale: config.locale,
      timezoneId: config.timezoneId,
      colorScheme: config.colorScheme,
      reducedMotion: config.reduceMotion,
    });

    await use(context);
    await context.close();
  },

  deterministicPage: async ({ context, deterministicOptions }, use) => {
    const page = await context.newPage();
    await prepareDeterministicPage(page, deterministicOptions);
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';

export async function deterministicGoto(
  page: Page,
  url: string,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    layoutStabilityMs?: number;
  } = {}
): Promise<void> {
  const config = {
    waitUntil: options.waitUntil || DETERMINISTIC_DEFAULTS.waitUntil,
    layoutStabilityMs: options.layoutStabilityMs || DETERMINISTIC_DEFAULTS.layoutStabilityMs,
  };

  await page.goto(url, {
    waitUntil: config.waitUntil,
    timeout: 30000,
  });

  await waitForLayoutStability(page, config.layoutStabilityMs);
}

export async function deterministicScreenshot(
  page: Page,
  options: {
    path?: string;
    fullPage?: boolean;
  } = {}
): Promise<Buffer> {
  return page.screenshot({
    ...options,
    animations: 'disabled',
    fullPage: options.fullPage ?? true,
  });
}
