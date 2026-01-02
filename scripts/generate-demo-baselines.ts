import { chromium, Browser, Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface ScreenMetadata {
  name: string;
  url: string;
  tags?: string[];
  masks?: Array<{
    type: string;
    selector?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
}

interface Manifest {
  baselines: Array<{
    screenId: string;
    name: string;
    url: string;
    hash: string;
    tags?: string[];
  }>;
}

async function computeHash(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function generateBaselines() {
  const baseUrl = 'http://localhost:5173';
  const baselineDir = path.join(process.cwd(), 'baselines');
  const screensJsonPath = path.join(process.cwd(), 'examples/demo-app/screens.json');
  
  console.log('📦 Loading screen metadata...');
  const screensData = JSON.parse(await fs.readFile(screensJsonPath, 'utf-8'));
  const screens = screensData.screens as Record<string, ScreenMetadata>;
  
  await fs.mkdir(baselineDir, { recursive: true });
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    console.log('🌐 Launching browser...');
    browser = await chromium.launch();
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    
    const manifest: Manifest = { baselines: [] };
    
    for (const [screenId, metadata] of Object.entries(screens)) {
      console.log(`📸 Capturing ${screenId}...`);
      
      const screenDir = path.join(baselineDir, screenId);
      await fs.mkdir(screenDir, { recursive: true });
      
      await page.goto(`${baseUrl}${metadata.url}`, { waitUntil: 'networkidle' });
      
      await page.waitForTimeout(500);
      
      const baselinePath = path.join(screenDir, 'baseline.png');
      await page.screenshot({ path: baselinePath, fullPage: false });
      
      const hash = await computeHash(baselinePath);
      
      const screenConfig = {
        name: metadata.name,
        url: metadata.url,
        ...(metadata.tags && { tags: metadata.tags }),
        ...(metadata.masks && { masks: metadata.masks }),
      };
      
      const screenJsonPath = path.join(screenDir, 'screen.json');
      await fs.writeFile(screenJsonPath, JSON.stringify(screenConfig, null, 2));
      
      manifest.baselines.push({
        screenId,
        name: metadata.name,
        url: metadata.url,
        hash,
        ...(metadata.tags && { tags: metadata.tags }),
      });
      
      console.log(`  ✓ ${screenId} captured (hash: ${hash.substring(0, 12)}...)`);
    }
    
    const manifestPath = path.join(baselineDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`\n✅ Generated ${manifest.baselines.length} baselines`);
    console.log(`📁 Baselines saved to: ${baselineDir}`);
    
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

generateBaselines().catch((error) => {
  console.error('❌ Error generating baselines:', error);
  process.exit(1);
});
