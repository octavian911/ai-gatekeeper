import type { Page } from 'playwright';
import type { Mask, MaskSuggestion } from './types.js';

export interface ElementSnapshot {
  selector: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  visible: boolean;
  testId?: string;
  id?: string;
  ariaLabel?: string;
}

export interface VolatileElement {
  element: ElementSnapshot;
  snapshotA: ElementSnapshot;
  snapshotB: ElementSnapshot;
  changes: string[];
}

export interface MaskSuggestionWithMetadata extends MaskSuggestion {
  screenId: string;
  type: 'css' | 'rect';
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface SuggestionOptions {
  maxSuggestions?: number;
  reload?: boolean;
  layoutStabilityMs?: number;
}

const UNSAFE_KEYWORDS = [
  'error',
  'failed',
  'failure',
  'warning',
  'warn',
  'unauthorized',
  'blocked',
  'denied',
  'forbidden',
  'invalid',
];

export async function captureElementSnapshot(page: Page): Promise<ElementSnapshot[]> {
  return await page.evaluate(() => {
    const elements: ElementSnapshot[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node as Element;
      if (!(el instanceof HTMLElement)) continue;

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        parseFloat(style.opacity) > 0;

      if (!visible && !el.textContent?.trim()) continue;

      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');

      elements.push({
        selector: generateSelector(el),
        text,
        bbox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        visible,
        testId: el.getAttribute('data-testid') || undefined,
        id: el.id || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
      });
    }

    function generateSelector(el: Element): string {
      if (el.hasAttribute('data-testid')) {
        return `[data-testid="${el.getAttribute('data-testid')}"]`;
      }
      if (el.id && !/^[a-z0-9-]+$/i.test(el.id)) {
        return `#${el.id}`;
      }
      if (el.hasAttribute('aria-label')) {
        return `[aria-label="${el.getAttribute('aria-label')}"]`;
      }

      const path: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(c => c);
          if (classes.length > 0) {
            selector += `.${classes[0]}`;
          }
        }
        path.unshift(selector);
        current = current.parentElement;
        if (path.length > 3) break;
      }
      return path.join(' > ');
    }

    return elements;
  });
}

export function detectVolatileElements(
  snapshotA: ElementSnapshot[],
  snapshotB: ElementSnapshot[]
): VolatileElement[] {
  const volatileElements: VolatileElement[] = [];
  const mapB = new Map(snapshotB.map((el) => [el.selector, el]));

  for (const elA of snapshotA) {
    const elB = mapB.get(elA.selector);
    const changes: string[] = [];

    if (!elB) {
      changes.push('disappeared');
    } else {
      if (normalizeText(elA.text) !== normalizeText(elB.text)) {
        changes.push('text_changed');
      }
      if (elA.visible !== elB.visible) {
        changes.push('visibility_changed');
      }
      if (bboxChanged(elA.bbox, elB.bbox)) {
        changes.push('bbox_changed');
      }
    }

    if (changes.length > 0) {
      volatileElements.push({
        element: elA,
        snapshotA: elA,
        snapshotB: elB || elA,
        changes,
      });
    }
  }

  for (const elB of snapshotB) {
    if (!snapshotA.find((a) => a.selector === elB.selector)) {
      volatileElements.push({
        element: elB,
        snapshotA: elB,
        snapshotB: elB,
        changes: ['appeared'],
      });
    }
  }

  return volatileElements;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[0-9]+/g, 'N')
    .trim();
}

function bboxChanged(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    Math.abs(a.x - b.x) > 1 ||
    Math.abs(a.y - b.y) > 1 ||
    Math.abs(a.width - b.width) > 1 ||
    Math.abs(a.height - b.height) > 1
  );
}

export function rankSelector(element: ElementSnapshot): {
  selector: string;
  confidence: number;
  type: 'css' | 'rect';
} {
  if (element.testId) {
    return {
      selector: `[data-testid="${element.testId}"]`,
      confidence: 0.95,
      type: 'css',
    };
  }

  if (element.id && isStableId(element.id)) {
    return {
      selector: `#${element.id}`,
      confidence: 0.9,
      type: 'css',
    };
  }

  if (element.ariaLabel) {
    return {
      selector: `[aria-label="${element.ariaLabel}"]`,
      confidence: 0.85,
      type: 'css',
    };
  }

  const ancestorSelector = findStableAncestor(element);
  if (ancestorSelector) {
    return {
      selector: ancestorSelector,
      confidence: 0.7,
      type: 'css',
    };
  }

  return {
    selector: element.selector,
    confidence: 0.5,
    type: 'rect',
  };
}

function isStableId(id: string): boolean {
  if (/^[a-f0-9]{8,}$/i.test(id)) return false;
  if (/^[a-z0-9-_]{1,3}$/i.test(id)) return false;
  if (/\d{4,}/.test(id)) return false;
  if (/random|uuid|guid|tmp|temp/i.test(id)) return false;
  return true;
}

function findStableAncestor(element: ElementSnapshot): string | null {
  return null;
}

export function detectContainerVolatility(
  volatileElements: VolatileElement[]
): MaskSuggestionWithMetadata[] {
  const clusters: Map<string, VolatileElement[]> = new Map();

  for (const vol of volatileElements) {
    const regionKey = getRegionKey(vol.element.bbox);
    if (!clusters.has(regionKey)) {
      clusters.set(regionKey, []);
    }
    clusters.get(regionKey)!.push(vol);
  }

  const containerSuggestions: MaskSuggestionWithMetadata[] = [];

  for (const [regionKey, elements] of clusters) {
    if (elements.length >= 5) {
      const bbox = calculateBoundingBox(elements.map((e) => e.element.bbox));
      const padding = 8;

      containerSuggestions.push({
        screenId: '',
        route: '',
        selector: `region-${regionKey}`,
        reason: `Container with ${elements.length} volatile elements`,
        confidence: 0.8,
        examples: elements.slice(0, 3).map((e) => e.element.selector),
        type: 'rect',
        bbox: {
          x: bbox.x - padding,
          y: bbox.y - padding,
          width: bbox.width + padding * 2,
          height: bbox.height + padding * 2,
        },
      });
    }
  }

  return containerSuggestions;
}

function getRegionKey(bbox: {
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  const gridSize = 100;
  const gridX = Math.floor(bbox.x / gridSize);
  const gridY = Math.floor(bbox.y / gridSize);
  return `${gridX},${gridY}`;
}

function calculateBoundingBox(
  boxes: { x: number; y: number; width: number; height: number }[]
): { x: number; y: number; width: number; height: number } {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function generateMaskSuggestions(
  volatileElements: VolatileElement[],
  screenId: string,
  maxSuggestions: number = 8
): MaskSuggestionWithMetadata[] {
  const containerSuggestions = detectContainerVolatility(volatileElements);

  const volatileInContainers = new Set<string>();
  for (const container of containerSuggestions) {
    for (const example of container.examples) {
      volatileInContainers.add(example);
    }
  }

  const individualSuggestions: MaskSuggestionWithMetadata[] = [];

  for (const vol of volatileElements) {
    if (volatileInContainers.has(vol.element.selector)) {
      continue;
    }

    if (isSafeToMask(vol.element)) {
      const ranked = rankSelector(vol.element);
      const padding = 8;

      individualSuggestions.push({
        screenId,
        route: '',
        selector: ranked.selector,
        reason: `Element ${vol.changes.join(', ')}`,
        confidence: ranked.confidence,
        examples: [vol.element.text.substring(0, 50)],
        type: ranked.type,
        bbox:
          ranked.type === 'rect'
            ? {
                x: vol.element.bbox.x - padding,
                y: vol.element.bbox.y - padding,
                width: vol.element.bbox.width + padding * 2,
                height: vol.element.bbox.height + padding * 2,
              }
            : undefined,
      });
    }
  }

  const allSuggestions = [...containerSuggestions, ...individualSuggestions];

  allSuggestions.sort((a, b) => b.confidence - a.confidence);

  return allSuggestions.slice(0, maxSuggestions);
}

export function isSafeToMask(element: ElementSnapshot): boolean {
  const textLower = element.text.toLowerCase();
  return !UNSAFE_KEYWORDS.some((keyword) => textLower.includes(keyword));
}

export function convertToMask(
  suggestion: MaskSuggestionWithMetadata
): Mask {
  if (suggestion.type === 'rect' && suggestion.bbox) {
    return {
      type: 'rect',
      x: suggestion.bbox.x,
      y: suggestion.bbox.y,
      width: suggestion.bbox.width,
      height: suggestion.bbox.height,
    };
  }

  return {
    type: 'css',
    selector: suggestion.selector,
  };
}

export async function suggestMasksForScreen(
  page: Page,
  screenId: string,
  options: SuggestionOptions = {}
): Promise<MaskSuggestionWithMetadata[]> {
  const { maxSuggestions = 8, reload = false, layoutStabilityMs = 300 } = options;

  await page.waitForTimeout(layoutStabilityMs);
  const snapshotA = await captureElementSnapshot(page);

  if (reload) {
    await page.reload({ waitUntil: 'networkidle' });
  }

  await page.waitForTimeout(layoutStabilityMs);
  const snapshotB = await captureElementSnapshot(page);

  const volatileElements = detectVolatileElements(snapshotA, snapshotB);

  return generateMaskSuggestions(volatileElements, screenId, maxSuggestions);
}
