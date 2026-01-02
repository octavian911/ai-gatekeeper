import { Page } from 'playwright';
import type { DeterministicOptions, DebugInfo } from './types.js';
import { DETERMINISTIC_DEFAULTS } from './types.js';
import {
  injectAnimationBlockingCSS,
  freezeTime,
  blockExternalRequests,
  setupDebugListeners,
} from './helpers.js';

export async function prepareDeterministicPage(
  page: Page,
  options: DeterministicOptions = {}
): Promise<void> {
  const config = { ...DETERMINISTIC_DEFAULTS, ...options };
  const debugMode = process.env.GATE_DEBUG === '1';
  const debugInfo: DebugInfo = {
    consoleErrors: [],
    requestFailures: [],
  };

  if (debugMode) {
    setupDebugListeners(page, debugInfo);
  }

  if (config.disableAnimations) {
    await injectAnimationBlockingCSS(page);
  }

  if (config.fixedDate) {
    await freezeTime(page, config.fixedDate);
  }

  if (config.blockExternalNetwork) {
    await blockExternalRequests(page, config.allowedDomains);
  }
}
