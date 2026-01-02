import fs from 'fs/promises';
import path from 'path';

const PLACEHOLDER_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000009077' +
  '53de0000000c49444154089963606060000000040001276fb067000000004945' +
  '4e44ae426082',
  'hex'
);

async function createPlaceholders() {
  console.log('📝 Creating placeholder baseline.png files...');
  
  const baselinesDir = path.join(process.cwd(), 'baselines');
  
  for (let i = 1; i <= 20; i++) {
    const screenId = `screen-${String(i).padStart(2, '0')}`;
    const screenDir = path.join(baselinesDir, screenId);
    const baselinePath = path.join(screenDir, 'baseline.png');
    
    await fs.mkdir(screenDir, { recursive: true });
    
    try {
      await fs.access(baselinePath);
      console.log(`  ⏭️  Skipped ${screenId}/baseline.png (already exists)`);
    } catch {
      await fs.writeFile(baselinePath, PLACEHOLDER_PNG);
      console.log(`  ✓ Created ${screenId}/baseline.png`);
    }
  }
  
  console.log('✅ All placeholder baseline.png files created');
  console.log('📌 Run \'pnpm generate:baselines\' to capture actual screenshots');
}

createPlaceholders().catch((error) => {
  console.error('❌ Error creating placeholders:', error);
  process.exit(1);
});
