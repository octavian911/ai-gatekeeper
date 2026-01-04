#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import { join } from 'path';

const DEMO_DIR = join(process.cwd(), 'examples/demo-app');
const HOME_PAGE = join(DEMO_DIR, 'src/pages/HomePage.tsx');

const ORIGINAL_CODE = `      <div className="grid gap-6 md:grid-cols-3">`;
const BROKEN_CODE = `      <div className="grid gap-8 md:grid-cols-3 mt-4">`;

async function main() {
  console.log('💥 AI Output Gate - Break UI Demo\n');
  console.log('Introducing intentional visual drift to HomePage...\n');

  const content = await fs.readFile(HOME_PAGE, 'utf-8');

  if (content.includes(BROKEN_CODE)) {
    console.log('⚠️  UI is already broken. Run `pnpm demo:fix-ui` to restore.');
    return;
  }

  if (!content.includes(ORIGINAL_CODE)) {
    console.error('❌ Could not find expected code pattern in HomePage.tsx');
    process.exit(1);
  }

  const updated = content.replace(ORIGINAL_CODE, BROKEN_CODE);
  await fs.writeFile(HOME_PAGE, updated);

  console.log('✅ Changes applied:');
  console.log('   - Increased gap from 6 to 8');
  console.log('   - Added mt-4 margin-top\n');
  console.log('These changes will cause visual regression failures.\n');
  console.log('💡 Next: Run `pnpm demo:run` to see the gate fail with diff evidence');
}

main().catch(error => {
  console.error('❌ Break failed:', error);
  process.exit(1);
});
