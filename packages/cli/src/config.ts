import fs from 'fs/promises';
import path from 'path';
import type { GateConfig } from '@ai-gate/core';
import { DEFAULT_POLICY } from '@ai-gate/core';

export async function loadConfig(): Promise<GateConfig> {
  const configPath = path.join(process.cwd(), 'ai-gate.config.json');

  try {
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);

    return {
      ...config,
      policy: { ...DEFAULT_POLICY, ...config.policy },
    };
  } catch {
    throw new Error(
      'ai-gate.config.json not found. Create one with baseUrl, routes, etc.'
    );
  }
}
