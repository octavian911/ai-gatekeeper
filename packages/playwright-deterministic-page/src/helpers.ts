import { Page } from 'playwright';
import type { BoundingBox, DebugInfo, DeterministicOptions, DETERMINISTIC_DEFAULTS } from './types.js';

export async function injectAnimationBlockingCSS(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        animation-iteration-count: 1 !important;
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
          transition: none !important;
        }
      }
      
      * {
        caret-color: transparent !important;
      }
    `,
  });
}

export async function freezeTime(page: Page, fixedDate: Date): Promise<void> {
  await page.addInitScript(`
    (function() {
      const fixedTime = ${fixedDate.getTime()};
      
      const OriginalDate = Date;
      
      class MockDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(fixedTime);
          } else {
            super(...args);
          }
        }
        
        static now() {
          return fixedTime;
        }
      }
      
      MockDate.parse = OriginalDate.parse;
      MockDate.UTC = OriginalDate.UTC;
      MockDate.prototype = OriginalDate.prototype;
      
      globalThis.Date = MockDate;
      
      if (typeof performance !== 'undefined' && performance.now) {
        const startTime = performance.now();
        const originalPerformanceNow = performance.now.bind(performance);
        performance.now = function() {
          return startTime;
        };
      }
    })();
  `);
}

export async function blockExternalRequests(
  page: Page,
  allowedDomains: string[]
): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const isAllowed = isAllowedDomain(url, allowedDomains);
    
    if (isAllowed) {
      route.continue();
    } else {
      route.abort('blockedbyclient');
    }
  });
}

export function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return allowedDomains.some((domain) => {
      const normalizedDomain = domain.toLowerCase();
      return (
        hostname === normalizedDomain ||
        hostname.endsWith(`.${normalizedDomain}`)
      );
    });
  } catch {
    return false;
  }
}

export async function waitForLayoutStability(
  page: Page,
  stabilityMs: number = 300,
  maxAttempts: number = 10
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const box1 = await getLayoutBox(page);
    await page.waitForTimeout(stabilityMs);
    const box2 = await getLayoutBox(page);
    
    if (isLayoutStable(box1, box2)) {
      return true;
    }
  }
  
  return false;
}

export async function getLayoutBox(page: Page): Promise<BoundingBox | null> {
  return page.evaluate(() => {
    const root = document.body || document.documentElement;
    if (!root) return null;
    
    const rect = root.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
}

export function isLayoutStable(
  box1: BoundingBox | null,
  box2: BoundingBox | null,
  tolerance: number = 1
): boolean {
  if (!box1 || !box2) return false;
  
  const changes = [
    Math.abs(box1.x - box2.x),
    Math.abs(box1.y - box2.y),
    Math.abs(box1.width - box2.width),
    Math.abs(box1.height - box2.height),
  ];
  
  return changes.every((change) => change <= tolerance);
}

export async function getDebugInfo(page: Page): Promise<DebugInfo | null> {
  return (page as any)._debugInfo || null;
}

export async function saveDebugInfo(
  page: Page,
  outputPath: string
): Promise<void> {
  const debugInfo = await getDebugInfo(page);
  if (!debugInfo) return;
  
  const debugOutput = {
    ...debugInfo,
    timestamp: new Date().toISOString(),
  };
  
  const fs = await import('fs/promises');
  await fs.writeFile(
    outputPath.replace(/\.png$/, '.debug.json'),
    JSON.stringify(debugOutput, null, 2)
  );
}

export function setupDebugListeners(page: Page, debugInfo: DebugInfo): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      debugInfo.consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (request) => {
    debugInfo.requestFailures.push({
      url: request.url(),
      error: request.failure()?.errorText || 'Unknown error',
    });
  });

  (page as any)._debugInfo = debugInfo;
}
