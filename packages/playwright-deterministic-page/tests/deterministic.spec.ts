import { test, expect } from '../src/index.js';
import { deterministicGoto, deterministicScreenshot } from '../src/index.js';

test.describe('Deterministic Page Plugin', () => {
  test('should freeze time to a fixed date', async ({ deterministicPage }) => {
    await deterministicGoto(deterministicPage, 'http://localhost:8765');
    
    const timeText = await deterministicPage.locator('#time').textContent();
    expect(timeText).toBe('2024-01-15T12:00:00.000Z');
    
    await deterministicPage.waitForTimeout(2000);
    
    const timeTextAfterWait = await deterministicPage.locator('#time').textContent();
    expect(timeTextAfterWait).toBe('2024-01-15T12:00:00.000Z');
  });

  test('should disable animations', async ({ deterministicPage }) => {
    await deterministicGoto(deterministicPage, 'http://localhost:8765');
    
    const animatedBox = deterministicPage.locator('.animated-box');
    await expect(animatedBox).toBeVisible();
    
    const screenshot1 = await deterministicScreenshot(deterministicPage);
    await deterministicPage.waitForTimeout(1000);
    const screenshot2 = await deterministicScreenshot(deterministicPage);
    
    expect(screenshot1.equals(screenshot2)).toBe(true);
  });

  test('should produce identical screenshots on multiple runs', async ({ deterministicPage }) => {
    const screenshots: Buffer[] = [];
    
    for (let i = 0; i < 3; i++) {
      await deterministicGoto(deterministicPage, 'http://localhost:8765');
      const screenshot = await deterministicScreenshot(deterministicPage);
      screenshots.push(screenshot);
      
      if (i < 2) {
        await deterministicPage.close();
        await deterministicPage.context().newPage();
      }
    }
    
    expect(screenshots[0].equals(screenshots[1])).toBe(true);
    expect(screenshots[1].equals(screenshots[2])).toBe(true);
  });

  test('should wait for layout stability', async ({ deterministicPage }) => {
    await deterministicGoto(deterministicPage, 'http://localhost:8765');
    
    const content = deterministicPage.locator('#content');
    await expect(content).toHaveClass(/loaded/);
  });

  test('should support custom options', async ({ page, deterministicOptions }) => {
    test.use({
      deterministicOptions: {
        fixedDate: new Date('2025-06-01T10:30:00Z'),
        disableAnimations: true,
      },
    });
  });
});

test.describe('Custom allowed domains', () => {
  test.use({
    deterministicOptions: {
      allowedDomains: ['localhost', '127.0.0.1'],
      blockExternalNetwork: true,
    },
  });

  test('should allow requests to localhost', async ({ deterministicPage }) => {
    await deterministicGoto(deterministicPage, 'http://localhost:8765');
    await expect(deterministicPage.locator('h1')).toHaveText('Deterministic Test Page');
  });
});
