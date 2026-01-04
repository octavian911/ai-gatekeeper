import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let server: http.Server | null = null;
let testUrl: string = '';

export async function startTestServer(): Promise<string> {
  if (testUrl) {
    return testUrl;
  }

  const htmlContent = await fs.readFile(
    path.join(__dirname, 'fixtures', 'index.html'),
    'utf-8'
  );

  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  });

  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        testUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  return testUrl;
}

export async function stopTestServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    server = null;
    testUrl = '';
  }
}

export function getTestUrl(): string {
  if (!testUrl) {
    throw new Error('Test server not started. Call startTestServer() first.');
  }
  return testUrl;
}
