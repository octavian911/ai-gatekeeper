#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DEMO_DIR = join(process.cwd(), 'examples/demo-app');
const BASELINE_DIR = join(DEMO_DIR, 'baselines');

interface Checkpoint {
  name: string;
  check: () => Promise<boolean>;
  error: string;
}

const checkpoints: Checkpoint[] = [
  {
    name: 'Demo app package.json exists',
    check: async () => {
      try {
        await fs.access(join(DEMO_DIR, 'package.json'));
        return true;
      } catch {
        return false;
      }
    },
    error: 'Demo app not found at examples/demo-app'
  },
  {
    name: 'Baselines directory exists',
    check: async () => {
      try {
        const stat = await fs.stat(BASELINE_DIR);
        return stat.isDirectory();
      } catch {
        return false;
      }
    },
    error: 'No baselines directory. Run `pnpm demo:seed` first'
  },
  {
    name: '3 baseline screenshots exist',
    check: async () => {
      try {
        const entries = await fs.readdir(BASELINE_DIR);
        const dirs = await Promise.all(
          entries.map(async e => {
            const stat = await fs.stat(join(BASELINE_DIR, e));
            return stat.isDirectory();
          })
        );
        return dirs.filter(Boolean).length >= 3;
      } catch {
        return false;
      }
    },
    error: 'Less than 3 baselines found. Run `pnpm demo:seed`'
  },
  {
    name: 'Manifest.json exists',
    check: async () => {
      try {
        await fs.access(join(BASELINE_DIR, 'manifest.json'));
        return true;
      } catch {
        return false;
      }
    },
    error: 'Manifest.json missing from baselines'
  },
  {
    name: 'CLI package is built',
    check: async () => {
      try {
        execSync('pnpm --filter=@ai-gate/cli cli --version', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
    error: 'CLI not built. Run `pnpm build`'
  }
];

async function main() {
  console.log('🔍 AI Output Gate - Demo Verification\n');

  let passed = 0;
  let failed = 0;

  for (const checkpoint of checkpoints) {
    process.stdout.write(`Checking: ${checkpoint.name}... `);
    const result = await checkpoint.check();
    
    if (result) {
      console.log('✅');
      passed++;
    } else {
      console.log('❌');
      console.log(`   Error: ${checkpoint.error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  if (failed === 0) {
    console.log('✨ Demo environment is ready!');
    console.log('\n💡 Next steps:');
    console.log('   pnpm demo:break-ui  # Introduce UI drift');
    console.log('   pnpm demo:run       # Run the gate');
    process.exit(0);
  } else {
    console.log('⚠️  Demo environment needs setup');
    console.log('\n🔧 Quick fix:');
    console.log('   pnpm install');
    console.log('   pnpm demo:seed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
