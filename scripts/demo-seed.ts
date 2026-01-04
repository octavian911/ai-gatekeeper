#!/usr/bin/env tsx
import { chromium, type Browser, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';

const DEMO_DIR = join(process.cwd(), 'examples/demo-app');
const BASELINE_DIR = join(DEMO_DIR, 'baselines');
const BASE_URL = 'http://localhost:5173';

const DEMO_SCREENS = [
  { route: '/', name: 'home', label: 'Home Page' },
  { route: '/pricing', name: 'pricing', label: 'Pricing Page' },
  { route: '/dashboard', name: 'dashboard', label: 'Dashboard' }
];

async function waitForStability(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function captureBaseline(browser: Browser, screen: typeof DEMO_SCREENS[0]) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }
  });

  console.log(`📸 Capturing baseline for ${screen.label}...`);
  
  await page.goto(`${BASE_URL}${screen.route}`);
  await waitForStability(page);

  const screenDir = join(BASELINE_DIR, screen.name);
  await fs.mkdir(screenDir, { recursive: true });

  const screenshotPath = join(screenDir, 'baseline.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const screenConfig = {
    name: screen.label,
    route: screen.route,
    viewport: { width: 1280, height: 720 },
    capturedAt: new Date().toISOString()
  };

  await fs.writeFile(
    join(screenDir, 'screen.json'),
    JSON.stringify(screenConfig, null, 2)
  );

  await page.close();
  console.log(`✅ Saved baseline: ${screen.name}`);
}

async function main() {
  console.log('🌱 AI Output Gate - Demo Seed\n');
  console.log('This will generate 3 baseline screenshots for the demo.\n');

  await fs.rm(BASELINE_DIR, { recursive: true, force: true });
  await fs.mkdir(BASELINE_DIR, { recursive: true });

  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    screens: DEMO_SCREENS.map(s => s.name),
    description: 'Demo baselines for quickstart flow'
  };

  await fs.writeFile(
    join(BASELINE_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  const browser = await chromium.launch();

  try {
    for (const screen of DEMO_SCREENS) {
      await captureBaseline(browser, screen);
    }

    console.log('\n✨ Seed complete! Generated 3 baselines:');
    DEMO_SCREENS.forEach(s => console.log(`   - ${s.label} (${s.route})`));
    console.log('\n💡 Next: Run `pnpm demo:break-ui` to introduce a visual change');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
