import { chromium, Browser, Page } from 'playwright';
import type { RouteConfig } from './types.js';

export class ScreenshotEngine {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
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
      userAgent: 'AI-Gate/1.0 Deterministic',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // Block external resources for determinism
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(baseUrl)) {
        route.continue();
      } else {
        route.abort();
      }
    });

    const page = await context.newPage();

    try {
      // Inject deterministic CSS
      await this.setupDeterministicRendering(page);

      // Navigate and wait
      await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for custom selector if specified
      if (route.waitForSelector) {
        await page.waitForSelector(route.waitForSelector, { timeout: 10000 });
      }

      // Apply masks
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

      // Additional stability wait
      await page.waitForTimeout(500);

      // Capture screenshot
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      });
    } finally {
      await context.close();
    }
  }

  private async setupDeterministicRendering(page: Page): Promise<void> {
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `,
    });

    // Mock Date for determinism
    await page.addInitScript(() => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      // @ts-ignore
      Date = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(fixedDate);
          } else {
            super(...args);
          }
        }
        
        static now() {
          return fixedDate.getTime();
        }
      };
    });
  }
}
