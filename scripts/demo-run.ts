#!/usr/bin/env tsx
import { spawn } from 'child_process';
import { join } from 'path';

const DEMO_DIR = join(process.cwd(), 'examples/demo-app');

function runCommand(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: DEMO_DIR,
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      resolve(code || 0);
    });
  });
}

async function main() {
  console.log('🚀 AI Output Gate - Demo Run\n');
  console.log('Running visual regression gate...\n');

  const exitCode = await runCommand('pnpm', [
    '--filter=@ai-gate/cli',
    'cli',
    'run',
    '--baseURL',
    'http://localhost:5173'
  ]);

  console.log('\n' + '='.repeat(60));
  
  if (exitCode === 0) {
    console.log('✅ Gate PASSED - No visual regressions detected');
    console.log('\n💡 Try `pnpm demo:break-ui` to see a failure');
  } else {
    console.log('❌ Gate FAILED - Visual regressions detected!');
    console.log('\n📦 Evidence pack generated in examples/demo-app/.ai-gate/');
    console.log('   - screenshots/ - Current screenshots');
    console.log('   - diffs/ - Visual diff images');
    console.log('   - report.html - Interactive comparison');
    console.log('\n🔧 To approve these changes:');
    console.log('   1. Review the diff images');
    console.log('   2. Run `pnpm gate baseline --update` to accept');
    console.log('   3. Or run `pnpm demo:fix-ui` to restore original');
  }
  
  console.log('='.repeat(60) + '\n');

  process.exit(exitCode);
}

main().catch(error => {
  console.error('❌ Demo run failed:', error);
  process.exit(1);
});
