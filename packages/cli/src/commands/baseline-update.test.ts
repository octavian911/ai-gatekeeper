import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

interface ManifestEntry {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
}

interface Manifest {
  baselines: ManifestEntry[];
}

interface UpdateResult {
  screenId: string;
  success: boolean;
  oldHash: string;
  newHash?: string;
  error?: string;
}

function computeHashSync(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function updateManifestHash(
  manifest: Manifest,
  screenId: string,
  newHash: string
): Manifest {
  const manifestCopy = JSON.parse(JSON.stringify(manifest));
  const entry = manifestCopy.baselines.find((b: ManifestEntry) => b.screenId === screenId);
  if (entry) {
    entry.hash = newHash;
  }
  return manifestCopy;
}

function selectChangedScreens(
  summary: { results: Array<{ screenId: string; status: string }> }
): string[] {
  return summary.results
    .filter(r => r.status === 'WARN' || r.status === 'FAIL')
    .map(r => r.screenId);
}

describe('baseline update - manifest hash updates', () => {
  it('should update hash in manifest for a single screen', () => {
    const manifest: Manifest = {
      baselines: [
        {
          screenId: 'screen-01',
          name: 'Home',
          url: '/',
          hash: 'abc123',
        },
        {
          screenId: 'screen-02',
          name: 'About',
          url: '/about',
          hash: 'def456',
        },
      ],
    };

    const updated = updateManifestHash(manifest, 'screen-01', 'xyz789');

    expect(updated.baselines[0].hash).toBe('xyz789');
    expect(updated.baselines[1].hash).toBe('def456');
  });

  it('should not modify other manifest fields', () => {
    const manifest: Manifest = {
      baselines: [
        {
          screenId: 'screen-01',
          name: 'Home',
          url: '/',
          hash: 'abc123',
          tags: ['critical'],
        },
      ],
    };

    const updated = updateManifestHash(manifest, 'screen-01', 'newHash');

    expect(updated.baselines[0].screenId).toBe('screen-01');
    expect(updated.baselines[0].name).toBe('Home');
    expect(updated.baselines[0].url).toBe('/');
    expect(updated.baselines[0].tags).toEqual(['critical']);
    expect(updated.baselines[0].hash).toBe('newHash');
  });

  it('should update multiple screens independently', () => {
    const manifest: Manifest = {
      baselines: [
        { screenId: 'screen-01', name: 'Home', url: '/', hash: 'hash1' },
        { screenId: 'screen-02', name: 'About', url: '/about', hash: 'hash2' },
        { screenId: 'screen-03', name: 'Contact', url: '/contact', hash: 'hash3' },
      ],
    };

    let updated = updateManifestHash(manifest, 'screen-01', 'newhash1');
    updated = updateManifestHash(updated, 'screen-03', 'newhash3');

    expect(updated.baselines[0].hash).toBe('newhash1');
    expect(updated.baselines[1].hash).toBe('hash2');
    expect(updated.baselines[2].hash).toBe('newhash3');
  });

  it('should compute SHA-256 hash correctly', () => {
    const data = Buffer.from('test data');
    const hash = computeHashSync(data);

    expect(hash).toBe('916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
    expect(hash).toHaveLength(64);
  });

  it('should produce different hashes for different data', () => {
    const data1 = Buffer.from('image1');
    const data2 = Buffer.from('image2');

    const hash1 = computeHashSync(data1);
    const hash2 = computeHashSync(data2);

    expect(hash1).not.toBe(hash2);
  });
});

describe('baseline update - changedOnly selection logic', () => {
  it('should select screens with WARN status', () => {
    const summary = {
      results: [
        { screenId: 'screen-01', status: 'PASS' },
        { screenId: 'screen-02', status: 'WARN' },
        { screenId: 'screen-03', status: 'PASS' },
      ],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual(['screen-02']);
  });

  it('should select screens with FAIL status', () => {
    const summary = {
      results: [
        { screenId: 'screen-01', status: 'PASS' },
        { screenId: 'screen-02', status: 'FAIL' },
        { screenId: 'screen-03', status: 'PASS' },
      ],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual(['screen-02']);
  });

  it('should select both WARN and FAIL screens', () => {
    const summary = {
      results: [
        { screenId: 'screen-01', status: 'PASS' },
        { screenId: 'screen-02', status: 'WARN' },
        { screenId: 'screen-03', status: 'FAIL' },
        { screenId: 'screen-04', status: 'PASS' },
        { screenId: 'screen-05', status: 'WARN' },
      ],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual(['screen-02', 'screen-03', 'screen-05']);
  });

  it('should return empty array when all screens pass', () => {
    const summary = {
      results: [
        { screenId: 'screen-01', status: 'PASS' },
        { screenId: 'screen-02', status: 'PASS' },
      ],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual([]);
  });

  it('should return all screens when all fail', () => {
    const summary = {
      results: [
        { screenId: 'screen-01', status: 'FAIL' },
        { screenId: 'screen-02', status: 'WARN' },
        { screenId: 'screen-03', status: 'FAIL' },
      ],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual(['screen-01', 'screen-02', 'screen-03']);
  });

  it('should handle empty results', () => {
    const summary = {
      results: [],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual([]);
  });

  it('should preserve screen order', () => {
    const summary = {
      results: [
        { screenId: 'screen-05', status: 'WARN' },
        { screenId: 'screen-01', status: 'PASS' },
        { screenId: 'screen-03', status: 'FAIL' },
        { screenId: 'screen-02', status: 'WARN' },
      ],
    };

    const changed = selectChangedScreens(summary);

    expect(changed).toEqual(['screen-05', 'screen-03', 'screen-02']);
  });
});

describe('baseline update - update results structure', () => {
  it('should track successful updates', () => {
    const result: UpdateResult = {
      screenId: 'screen-01',
      success: true,
      oldHash: 'oldhash123',
      newHash: 'newhash456',
    };

    expect(result.success).toBe(true);
    expect(result.oldHash).toBe('oldhash123');
    expect(result.newHash).toBe('newhash456');
    expect(result.error).toBeUndefined();
  });

  it('should track failed updates with error', () => {
    const result: UpdateResult = {
      screenId: 'screen-01',
      success: false,
      oldHash: 'oldhash123',
      error: 'Navigation timeout',
    };

    expect(result.success).toBe(false);
    expect(result.oldHash).toBe('oldhash123');
    expect(result.newHash).toBeUndefined();
    expect(result.error).toBe('Navigation timeout');
  });

  it('should aggregate update results', () => {
    const results: UpdateResult[] = [
      { screenId: 'screen-01', success: true, oldHash: 'hash1', newHash: 'newhash1' },
      { screenId: 'screen-02', success: false, oldHash: 'hash2', error: 'Failed' },
      { screenId: 'screen-03', success: true, oldHash: 'hash3', newHash: 'newhash3' },
    ];

    const totalUpdated = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;

    expect(totalUpdated).toBe(2);
    expect(totalFailed).toBe(1);
  });
});
