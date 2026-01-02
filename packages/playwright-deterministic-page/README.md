# @ai-output-gate/playwright-deterministic-page

A Playwright plugin that provides deterministic page preparation and visual testing capabilities. This plugin ensures consistent, reproducible screenshots by controlling time, animations, network requests, and layout stability.

## Features

- **Time Freezing**: Mock `Date.now()` and `performance.now()` to a fixed timestamp
- **Animation Blocking**: Disable CSS animations and transitions for stable screenshots
- **Network Control**: Block external requests and allow only specified domains
- **Layout Stability**: Wait for layout to stabilize before taking screenshots
- **Debug Support**: Capture console errors and request failures for debugging
- **Playwright Test Fixtures**: Easy integration with `@playwright/test`

## Installation

```bash
npm install @ai-output-gate/playwright-deterministic-page
# or
pnpm add @ai-output-gate/playwright-deterministic-page
# or
yarn add @ai-output-gate/playwright-deterministic-page
```

## Quick Start

### Using with Playwright Test (Recommended)

```typescript
import { test, expect } from '@ai-output-gate/playwright-deterministic-page';

test('visual regression test', async ({ deterministicPage }) => {
  await deterministicPage.goto('https://example.com');
  await expect(deterministicPage).toHaveScreenshot();
});
```

### Using with Vanilla Playwright

```typescript
import { chromium } from 'playwright';
import { prepareDeterministicPage, DETERMINISTIC_DEFAULTS } from '@ai-output-gate/playwright-deterministic-page';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  locale: DETERMINISTIC_DEFAULTS.locale,
  timezoneId: DETERMINISTIC_DEFAULTS.timezoneId,
});

const page = await context.newPage();
await prepareDeterministicPage(page);
await page.goto('https://example.com');
await page.screenshot({ path: 'screenshot.png' });
```

## API Reference

### Fixtures

#### `deterministicPage`

A pre-configured Playwright page with deterministic settings applied.

```typescript
test('example', async ({ deterministicPage }) => {
  await deterministicPage.goto('https://example.com');
});
```

#### `deterministicOptions`

Configure deterministic options for the test.

```typescript
test.use({
  deterministicOptions: {
    fixedDate: new Date('2025-01-01T00:00:00Z'),
    allowedDomains: ['example.com', 'cdn.example.com'],
  },
});
```

### Helper Functions

#### `deterministicGoto(page, url, options?)`

Navigate to a URL and wait for layout stability.

```typescript
import { deterministicGoto } from '@ai-output-gate/playwright-deterministic-page';

await deterministicGoto(page, 'https://example.com', {
  waitUntil: 'networkidle',
  layoutStabilityMs: 300,
});
```

#### `deterministicScreenshot(page, options?)`

Take a screenshot with animations disabled.

```typescript
import { deterministicScreenshot } from '@ai-output-gate/playwright-deterministic-page';

const buffer = await deterministicScreenshot(page, {
  fullPage: true,
  path: 'screenshot.png',
});
```

#### `prepareDeterministicPage(page, options?)`

Apply deterministic configuration to a page.

```typescript
import { prepareDeterministicPage } from '@ai-output-gate/playwright-deterministic-page';

await prepareDeterministicPage(page, {
  disableAnimations: true,
  fixedDate: new Date('2024-01-15T12:00:00Z'),
  blockExternalNetwork: true,
  allowedDomains: ['localhost'],
});
```

### Configuration Options

```typescript
interface DeterministicOptions {
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
```

### Default Values

```typescript
const DETERMINISTIC_DEFAULTS = {
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
```

## Advanced Usage

### Custom Time

```typescript
test.use({
  deterministicOptions: {
    fixedDate: new Date('2025-06-01T10:30:00Z'),
  },
});

test('time-based test', async ({ deterministicPage }) => {
  await deterministicPage.goto('https://example.com');
  const time = await deterministicPage.evaluate(() => new Date().toISOString());
  expect(time).toBe('2025-06-01T10:30:00.000Z');
});
```

### Network Control

```typescript
test.use({
  deterministicOptions: {
    blockExternalNetwork: true,
    allowedDomains: ['example.com', 'api.example.com'],
  },
});

test('network test', async ({ deterministicPage }) => {
  await deterministicPage.goto('https://example.com');
});
```

### Layout Stability

```typescript
import { waitForLayoutStability } from '@ai-output-gate/playwright-deterministic-page';

await page.goto('https://example.com');
const isStable = await waitForLayoutStability(page, 300, 10);
expect(isStable).toBe(true);
```

### Debug Mode

Enable debug mode to capture console errors and request failures:

```bash
GATE_DEBUG=1 npx playwright test
```

```typescript
import { getDebugInfo, saveDebugInfo } from '@ai-output-gate/playwright-deterministic-page';

const debugInfo = await getDebugInfo(page);
console.log(debugInfo?.consoleErrors);
console.log(debugInfo?.requestFailures);

await saveDebugInfo(page, 'screenshot.png');
```

## Utility Functions

### `isAllowedDomain(url, allowedDomains)`

Check if a URL is in the allowed domains list.

```typescript
import { isAllowedDomain } from '@ai-output-gate/playwright-deterministic-page';

const allowed = isAllowedDomain('https://api.example.com/data', ['example.com']);
console.log(allowed); // true
```

### `isLayoutStable(box1, box2, tolerance?)`

Check if two bounding boxes are stable within a tolerance.

```typescript
import { isLayoutStable } from '@ai-output-gate/playwright-deterministic-page';

const stable = isLayoutStable(
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 0, y: 0, width: 100, height: 101 },
  1
);
console.log(stable); // true
```

## Best Practices

1. **Use Fixtures**: Always prefer `deterministicPage` fixture over manual setup
2. **Consistent Viewport**: Set a consistent viewport size for all tests
3. **Layout Stability**: Always wait for layout stability before screenshots
4. **Network Control**: Block external requests to avoid flaky tests
5. **Debug Mode**: Use `GATE_DEBUG=1` to troubleshoot issues

## Use Cases

- Visual regression testing
- Screenshot comparison
- Deterministic E2E testing
- Cross-browser testing
- Accessibility testing with frozen states

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT - See [LICENSE](../../LICENSE) for details.

## Credits

This plugin was extracted from the [AI Output Gate](https://github.com/ai-output-gate) project to make deterministic page preparation available to the broader Playwright community.
