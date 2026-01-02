export interface DeterministicOptions {
  browser?: 'chromium' | 'firefox' | 'webkit';
  deviceScaleFactor?: number;
  locale?: string;
  timezoneId?: string;
  colorScheme?: 'light' | 'dark';
  reduceMotion?: 'reduce' | 'no-preference';
  disableAnimations?: boolean;
  blockExternalNetwork?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  layoutStabilityMs?: number;
  screenshotAfterSettledOnly?: boolean;
  fixedDate?: Date;
  allowedDomains?: string[];
}

export interface DeterministicDefaults {
  browser: 'chromium';
  deviceScaleFactor: 1;
  locale: 'en-US';
  timezoneId: 'UTC';
  colorScheme: 'light';
  reduceMotion: 'reduce';
  disableAnimations: true;
  blockExternalNetwork: true;
  waitUntil: 'networkidle';
  layoutStabilityMs: 300;
  screenshotAfterSettledOnly: true;
  fixedDate: Date;
  allowedDomains: string[];
}

export const DETERMINISTIC_DEFAULTS: DeterministicDefaults = {
  browser: 'chromium',
  deviceScaleFactor: 1,
  locale: 'en-US',
  timezoneId: 'UTC',
  colorScheme: 'light',
  reduceMotion: 'reduce',
  disableAnimations: true,
  blockExternalNetwork: true,
  waitUntil: 'networkidle',
  layoutStabilityMs: 300,
  screenshotAfterSettledOnly: true,
  fixedDate: new Date('2024-01-15T12:00:00Z'),
  allowedDomains: ['localhost', '127.0.0.1', '[::1]'],
};

export interface DebugInfo {
  consoleErrors: string[];
  requestFailures: Array<{ url: string; error: string }>;
  screenshotPath?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
