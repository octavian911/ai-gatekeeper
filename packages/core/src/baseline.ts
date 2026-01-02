import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { BaselineMetadata } from './types.js';

export class BaselineManager {
  constructor(private baselineDir: string) {}

  async add(
    route: string,
    screenshotPath: string,
    metadata: Omit<BaselineMetadata, 'hash'>
  ): Promise<void> {
    const baselinePath = this.getBaselinePath(route);
    await fs.mkdir(path.dirname(baselinePath), { recursive: true });
    await fs.copyFile(screenshotPath, baselinePath);

    const hash = await this.computeHash(baselinePath);
    const metadataPath = this.getMetadataPath(route);
    await fs.writeFile(
      metadataPath,
      JSON.stringify({ ...metadata, hash }, null, 2)
    );
  }

  async list(): Promise<BaselineMetadata[]> {
    try {
      const files = await fs.readdir(this.baselineDir);
      const metadataFiles = files.filter((f) => f.endsWith('.meta.json'));

      const metadata = await Promise.all(
        metadataFiles.map(async (file) => {
          const content = await fs.readFile(
            path.join(this.baselineDir, file),
            'utf-8'
          );
          return JSON.parse(content) as BaselineMetadata;
        })
      );

      return metadata;
    } catch (error) {
      return [];
    }
  }

  async validate(route: string): Promise<boolean> {
    const baselinePath = this.getBaselinePath(route);
    const metadataPath = this.getMetadataPath(route);

    try {
      await Promise.all([
        fs.access(baselinePath),
        fs.access(metadataPath),
      ]);

      const metadata = await this.getMetadata(route);
      const currentHash = await this.computeHash(baselinePath);

      return metadata.hash === currentHash;
    } catch {
      return false;
    }
  }

  async update(route: string, screenshotPath: string): Promise<void> {
    const metadata = await this.getMetadata(route);
    await this.add(route, screenshotPath, metadata);
  }

  getBaselinePath(route: string): string {
    const safeName = route.replace(/\//g, '_').replace(/^_/, 'root');
    return path.join(this.baselineDir, `${safeName}.png`);
  }

  private getMetadataPath(route: string): string {
    const safeName = route.replace(/\//g, '_').replace(/^_/, 'root');
    return path.join(this.baselineDir, `${safeName}.meta.json`);
  }

  private async getMetadata(route: string): Promise<BaselineMetadata> {
    const metadataPath = this.getMetadataPath(route);
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  }

  private async computeHash(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
