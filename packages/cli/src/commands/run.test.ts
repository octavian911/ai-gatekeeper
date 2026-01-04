import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('CLI exit codes', () => {
  const CLI_PATH = path.join(__dirname, '../../dist/index.js');
  const FIXTURES_DIR = path.join(__dirname, '../../test-fixtures');
  
  beforeAll(async () => {
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    
    const baselinesDir = path.join(FIXTURES_DIR, 'baselines');
    await fs.mkdir(baselinesDir, { recursive: true });
    
    const manifest = {
      baselines: [
        {
          screenId: 'test-screen',
          name: 'Test Screen',
          url: '/test',
          hash: 'abc123',
        },
      ],
    };
    
    await fs.writeFile(
      path.join(baselinesDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    const screenDir = path.join(baselinesDir, 'test-screen');
    await fs.mkdir(screenDir, { recursive: true });
    
    const screenJson = {
      name: 'Test Screen',
      url: '/test',
    };
    
    await fs.writeFile(
      path.join(screenDir, 'screen.json'),
      JSON.stringify(screenJson, null, 2)
    );
    
    const baselinePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    await fs.writeFile(path.join(screenDir, 'baseline.png'), baselinePng);
  });
  
  afterAll(async () => {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  });
  
  it('should exit with code 1 when baseURL is invalid', async () => {
    const exitCode = await runCLI(['run', '--baseURL', 'http://invalid-url-12345.local'], FIXTURES_DIR);
    expect(exitCode).toBe(1);
  });
  
  it('should exit with code 1 when baselines are missing', async () => {
    const emptyDir = path.join(FIXTURES_DIR, 'empty');
    await fs.mkdir(emptyDir, { recursive: true });
    
    const exitCode = await runCLI(['run', '--baseURL', 'http://localhost:3000'], emptyDir);
    expect(exitCode).toBe(1);
    
    await fs.rm(emptyDir, { recursive: true });
  });
  
  it('should show help without error', async () => {
    const exitCode = await runCLI(['--help']);
    expect(exitCode).toBe(0);
  });
});

function runCLI(args: string[], cwd?: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      stdio: 'pipe',
    });
    
    child.on('close', (code) => {
      resolve(code || 0);
    });
    
    child.on('error', () => {
      resolve(1);
    });
  });
}
