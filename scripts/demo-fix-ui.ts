#!/usr/bin/env tsx
import { promises as fs } from 'fs';
import { join } from 'path';

const DEMO_DIR = join(process.cwd(), 'examples/demo-app');
const HOME_PAGE = join(DEMO_DIR, 'src/pages/HomePage.tsx');

const BROKEN_CODE = `      <div className="grid gap-8 md:grid-cols-3 mt-4">`;
const ORIGINAL_CODE = `      <div className="grid gap-6 md:grid-cols-3">`;

async function main() {
  console.log('🔧 AI Output Gate - Fix UI Demo\n');
  console.log('Restoring original HomePage...\n');

  const content = await fs.readFile(HOME_PAGE, 'utf-8');

  if (content.includes(ORIGINAL_CODE) && !content.includes(BROKEN_CODE)) {
    console.log('✅ UI is already in original state.');
    return;
  }

  if (!content.includes(BROKEN_CODE)) {
    console.error('❌ Could not find broken code pattern in HomePage.tsx');
    process.exit(1);
  }

  const updated = content.replace(BROKEN_CODE, ORIGINAL_CODE);
  await fs.writeFile(HOME_PAGE, updated);

  console.log('✅ Restored to original state');
  console.log('💡 Run `pnpm demo:run` to verify tests pass');
}

main().catch(error => {
  console.error('❌ Fix failed:', error);
  process.exit(1);
});
