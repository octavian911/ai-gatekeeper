import { chromium, Browser, Page } from 'playwright';
import type { RouteConfig, Mask, ViewportConfig, ScreenBaseline } from './types.js';
import {
  prepareDeterministicPage,
  waitForLayoutStability,
  saveDebugInfo,
  DETERMINISTIC_DEFAULTS,
  type DebugInfo,
} from './deterministic.js';
import { applyMasks } from './masks.js';

export interface CaptureResult {
  success: boolean;
  error?: string;
  debugInfo?: DebugInfo;
}

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

  async captureScreen(
    baseUrl: string,
    screen: ScreenBaseline,
    viewport: ViewportConfig,
    outputPath: string
  ): Promise<CaptureResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const finalViewport = {
      width: screen.viewport?.width ?? viewport.width,
      height: screen.viewport?.height ?? viewport.height,
    };

    const context = await this.browser.newContext({
      viewport: finalViewport,
      deviceScaleFactor: screen.viewport?.deviceScaleFactor ?? viewport.deviceScaleFactor,
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

      await page.goto(`${baseUrl}${screen.url}`, {
        waitUntil: DETERMINISTIC_DEFAULTS.waitUntil,
        timeout: 30000,
      });

      await waitForLayoutStability(page, DETERMINISTIC_DEFAULTS.layoutStabilityMs);

      if (screen.masks) {
        await applyMasks(page, screen.masks);
      }

      await page.screenshot({
        path: outputPath,
        fullPage: true,
        animations: 'disabled',
      });

      if (process.env.GATE_DEBUG === '1') {
        await saveDebugInfo(page, outputPath);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      try {
        await page.screenshot({
          path: outputPath,
          fullPage: true,
          animations: 'disabled',
        });
      } catch {
      }

      const debugInfo = process.env.GATE_DEBUG === '1' 
        ? ((page as any)._debugInfo || null)
        : null;

      return {
        success: false,
        error: errorMessage,
        debugInfo: debugInfo || undefined,
      };
    } finally {
      await context.close();
    }
  }
}
