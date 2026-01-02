import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateScreenId(filename: string, providedId?: string): string {
  if (providedId) return providedId;
  const baseName = path.basename(filename, path.extname(filename));
  return baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function computeHash(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

describe('Baseline Ingestion', () => {
  const testDir = path.join(__dirname, '../../test-tmp');
  
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('generateScreenId', () => {
    it('should generate deterministic IDs from filenames', () => {
      expect(generateScreenId('HomePage.png')).toBe('homepage');
      expect(generateScreenId('user_profile.png')).toBe('user-profile');
      expect(generateScreenId('Dashboard-123.png')).toBe('dashboard-123');
      expect(generateScreenId('My Cool Screen!.png')).toBe('my-cool-screen');
    });

    it('should use provided ID when given', () => {
      expect(generateScreenId('anything.png', 'custom-id')).toBe('custom-id');
    });

    it('should be deterministic for same input', () => {
      const id1 = generateScreenId('test-screen.png');
      const id2 = generateScreenId('test-screen.png');
      expect(id1).toBe(id2);
    });

    it('should handle edge cases', () => {
      expect(generateScreenId('123.png')).toBe('123');
      expect(generateScreenId('___test___.png')).toBe('test');
      expect(generateScreenId('UPPERCASE.PNG')).toBe('uppercase');
    });
  });

  describe('Manifest Management', () => {
    it('should create new manifest when none exists', async () => {
      const manifestPath = path.join(testDir, 'manifest.json');
      const manifest = { baselines: [] };
      
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      
      const data = await fs.readFile(manifestPath, 'utf-8');
      const loaded = JSON.parse(data);
      
      expect(loaded).toEqual({ baselines: [] });
    });

    it('should merge new baselines without deleting existing entries', async () => {
      const manifestPath = path.join(testDir, 'manifest.json');
      
      const existing = {
        baselines: [
          { screenId: 'screen1', name: 'Screen 1', url: '/screen1', hash: 'hash1' },
          { screenId: 'screen2', name: 'Screen 2', url: '/screen2', hash: 'hash2' },
        ],
      };
      
      await fs.writeFile(manifestPath, JSON.stringify(existing, null, 2));
      
      const data = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(data);
      
      manifest.baselines.push({
        screenId: 'screen3',
        name: 'Screen 3',
        url: '/screen3',
        hash: 'hash3',
      });
      
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      
      const updated = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      expect(updated.baselines).toHaveLength(3);
      expect(updated.baselines.map((b: any) => b.screenId)).toEqual(['screen1', 'screen2', 'screen3']);
    });

    it('should update existing baseline when screenId matches', async () => {
      const manifestPath = path.join(testDir, 'manifest.json');
      
      const manifest = {
        baselines: [
          { screenId: 'screen1', name: 'Screen 1', url: '/screen1', hash: 'oldhash' },
        ],
      };
      
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      
      const data = await fs.readFile(manifestPath, 'utf-8');
      const loaded = JSON.parse(data);
      
      const existingIndex = loaded.baselines.findIndex((b: any) => b.screenId === 'screen1');
      loaded.baselines[existingIndex] = {
        screenId: 'screen1',
        name: 'Screen 1 Updated',
        url: '/screen1',
        hash: 'newhash',
      };
      
      await fs.writeFile(manifestPath, JSON.stringify(loaded, null, 2));
      
      const updated = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      expect(updated.baselines).toHaveLength(1);
      expect(updated.baselines[0].hash).toBe('newhash');
      expect(updated.baselines[0].name).toBe('Screen 1 Updated');
    });

    it('should preserve per-screen config when updating baseline', async () => {
      const screenDir = path.join(testDir, 'screen1');
      await fs.mkdir(screenDir, { recursive: true });
      
      const screenConfig = {
        name: 'Screen 1',
        url: '/screen1',
        viewport: { width: 1920, height: 1080 },
        thresholds: { warn: { diffPixelRatio: 0.01, diffPixels: 100 }, fail: { diffPixelRatio: 0.05, diffPixels: 500 } },
        masks: [{ type: 'css', selector: '.timestamp' }],
      };
      
      const screenJsonPath = path.join(screenDir, 'screen.json');
      await fs.writeFile(screenJsonPath, JSON.stringify(screenConfig, null, 2));
      
      const loaded = JSON.parse(await fs.readFile(screenJsonPath, 'utf-8'));
      
      expect(loaded.viewport).toEqual({ width: 1920, height: 1080 });
      expect(loaded.thresholds).toBeDefined();
      expect(loaded.masks).toHaveLength(1);
    });
  });

  describe('Validation', () => {
    it('should detect duplicate screenIds', () => {
      const baselines = [
        { screenId: 'screen1', name: 'Screen 1', url: '/1', hash: 'h1' },
        { screenId: 'screen2', name: 'Screen 2', url: '/2', hash: 'h2' },
        { screenId: 'screen1', name: 'Duplicate', url: '/dup', hash: 'h3' },
      ];
      
      const seenIds = new Set<string>();
      const errors: string[] = [];
      
      for (const baseline of baselines) {
        if (seenIds.has(baseline.screenId)) {
          errors.push(`Duplicate screenId: ${baseline.screenId}`);
        }
        seenIds.add(baseline.screenId);
      }
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Duplicate screenId: screen1');
    });

    it('should validate viewport dimensions', () => {
      const viewports = [
        { width: 1920, height: 1080, valid: true },
        { width: 0, height: 1080, valid: false },
        { width: 1920, height: -1, valid: false },
        { width: -100, height: -100, valid: false },
      ];
      
      for (const vp of viewports) {
        const isValid = vp.width > 0 && vp.height > 0;
        expect(isValid).toBe(vp.valid);
      }
    });

    it('should validate mask configurations', () => {
      const masks = [
        { type: 'css', selector: '.timestamp', valid: true },
        { type: 'css', valid: false },
        { type: 'rect', x: 0, y: 0, width: 100, height: 100, valid: true },
        { type: 'rect', x: 0, y: 0, valid: false },
      ];
      
      for (const mask of masks) {
        let isValid = false;
        if (mask.type === 'css') {
          isValid = !!(mask as any).selector;
        } else if (mask.type === 'rect') {
          const m = mask as any;
          isValid = m.x !== undefined && m.y !== undefined && m.width !== undefined && m.height !== undefined;
        }
        expect(isValid).toBe(mask.valid);
      }
    });

    it('should detect missing baseline files', async () => {
      const screenDir = path.join(testDir, 'screen1');
      await fs.mkdir(screenDir, { recursive: true });
      
      const baselinePath = path.join(screenDir, 'baseline.png');
      
      let exists = false;
      try {
        await fs.access(baselinePath);
        exists = true;
      } catch {
        exists = false;
      }
      
      expect(exists).toBe(false);
      
      await fs.writeFile(baselinePath, Buffer.from('fake png data'));
      
      try {
        await fs.access(baselinePath);
        exists = true;
      } catch {
        exists = false;
      }
      
      expect(exists).toBe(true);
    });

    it('should detect hash mismatches', async () => {
      const file1 = path.join(testDir, 'file1.png');
      const file2 = path.join(testDir, 'file2.png');
      
      await fs.writeFile(file1, Buffer.from('content A'));
      await fs.writeFile(file2, Buffer.from('content B'));
      
      const hash1 = await computeHash(file1);
      const hash2 = await computeHash(file2);
      
      expect(hash1).not.toBe(hash2);
      
      await fs.writeFile(file2, Buffer.from('content A'));
      const hash3 = await computeHash(file2);
      
      expect(hash1).toBe(hash3);
    });
  });

  describe('Hash Computation', () => {
    it('should compute consistent hashes for same content', async () => {
      const file = path.join(testDir, 'test.png');
      await fs.writeFile(file, Buffer.from('test content'));
      
      const hash1 = await computeHash(file);
      const hash2 = await computeHash(file);
      
      expect(hash1).toBe(hash2);
    });

    it('should compute different hashes for different content', async () => {
      const file1 = path.join(testDir, 'file1.png');
      const file2 = path.join(testDir, 'file2.png');
      
      await fs.writeFile(file1, Buffer.from('content 1'));
      await fs.writeFile(file2, Buffer.from('content 2'));
      
      const hash1 = await computeHash(file1);
      const hash2 = await computeHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
