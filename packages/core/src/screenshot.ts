import { chromium, Browser, Page } from 'playwright';
import type { RouteConfig } from './types.js';
import {
  prepareDeterministicPage,
  waitForLayoutStability,
  saveDebugInfo,
  DETERMINISTIC_DEFAULTS,
} from './deterministic.js';

export class ScreenshotEngine {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--font-render-hinting=none', '--disable-skia-runtime-opts'],
    });
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  async captureRoute(
    baseUrl: string,
    route: RouteConfig,
    viewport: { width: number; height: number },
    outputPath: string
  ): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      viewport,
      deviceScaleFactor: DETERMINISTIC_DEFAULTS.deviceScaleFactor,
      userAgent: 'AI-Gate/1.0 Deterministic',
      locale: DETERMINISTIC_DEFAULTS.locale,
      timezoneId: DETERMINISTIC_DEFAULTS.timezoneId,
      colorScheme: DETERMINISTIC_DEFAULTS.colorScheme,
      reducedMotion: DETERMINISTIC_DEFAULTS.reduceMotion,
    });

    const page = await context.newPage();

    try {
      await prepareDeterministicPage(page, {
        allowedDomains: [
          ...DETERMINISTIC_DEFAULTS.allowedDomains,
          new URL(baseUrl).hostname,
        ],
      });

      await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: DETERMINISTIC_DEFAULTS.waitUntil,
        timeout: 30000,
      });

      if (route.waitForSelector) {
        await page.waitForSelector(route.waitForSelector, { timeout: 10000 });
      }

      await waitForLayoutStability(page, DETERMINISTIC_DEFAULTS.layoutStabilityMs);

      if (route.masks) {
        for (const mask of route.masks) {
          await page.evaluate((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
              if (el instanceof HTMLElement) {
                el.style.opacity = '0';
              }
            });
          }, mask.selector);
        }
      }

      await page.screenshot({
        path: outputPath,
        fullPage: true,
        animations: 'disabled',
      });

      if (process.env.GATE_DEBUG === '1') {
        await saveDebugInfo(page, outputPath);
      }
    } finally {
      await context.close();
    }
  }


}
