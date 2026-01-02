import { Page } from 'playwright';
import type { Mask } from './types.js';

export async function applyMasks(page: Page, masks: Mask[]): Promise<void> {
  if (!masks || masks.length === 0) return;

  for (const mask of masks) {
    if (mask.type === 'css') {
      await applyCSSMask(page, mask.selector!);
    } else if (mask.type === 'rect') {
      await applyRectMask(page, mask.x!, mask.y!, mask.width!, mask.height!);
    }
  }
}

export async function applyCSSMask(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.opacity = '0';
      }
    });
  }, selector);
}

export async function applyRectMask(
  page: Page,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await page.evaluate(
    ({ x, y, width, height }) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = `${x}px`;
      overlay.style.top = `${y}px`;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
      overlay.style.backgroundColor = '#000000';
      overlay.style.zIndex = '999999';
      overlay.setAttribute('data-ai-gate-mask', 'true');
      document.body.appendChild(overlay);
    },
    { x, y, width, height }
  );
}
