#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VerificationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

async function verifyOfflineReport(evidenceDir: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    passed: true,
    errors: [],
    warnings: [],
  };

  console.log(`\n🔍 Verifying offline report in: ${evidenceDir}\n`);

  const indexPath = path.join(evidenceDir, 'index.html');
  const reportPath = path.join(evidenceDir, 'report.html');
  const summaryPath = path.join(evidenceDir, 'summary.json');

  const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
  if (!indexExists) {
    result.errors.push('❌ index.html not found');
    result.passed = false;
  } else {
    console.log('✅ index.html exists');
    
    const html = await fs.readFile(indexPath, 'utf-8');
    const externalUrlPattern = /https?:\/\/(?!localhost|127\.0\.0\.1)/gi;
    const externalUrls = html.match(externalUrlPattern) || [];
    
    if (externalUrls.length > 0) {
      result.errors.push(`❌ index.html contains ${externalUrls.length} external URLs`);
      result.passed = false;
      externalUrls.slice(0, 5).forEach(url => {
        console.error(`   - ${url}`);
      });
    } else {
      console.log('✅ No external URLs in index.html');
    }

    const srcPattern = /src="([^"]+)"/g;
    const hrefPattern = /href="([^"]+\.(?:css|js|png|jpg|jpeg|gif|svg))"/g;
    
    const srcMatches = [...html.matchAll(srcPattern)].map(m => m[1]);
    const hrefMatches = [...html.matchAll(hrefPattern)].map(m => m[1]);
    const allReferences = [...srcMatches, ...hrefMatches];

    let missingFiles = 0;
    for (const ref of allReferences) {
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        continue;
      }
      if (ref.startsWith('data:')) {
        continue;
      }

      const refPath = path.join(evidenceDir, ref);
      const exists = await fs.access(refPath).then(() => true).catch(() => false);
      
      if (!exists) {
        missingFiles++;
        if (missingFiles <= 5) {
          result.errors.push(`❌ Referenced file missing: ${ref}`);
        }
        result.passed = false;
      }
    }

    if (missingFiles === 0) {
      console.log('✅ All referenced files exist');
    } else {
      console.error(`❌ ${missingFiles} referenced file(s) missing`);
    }
  }

  const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
  if (!reportExists) {
    result.warnings.push('⚠️  report.html not found');
  } else {
    console.log('✅ report.html exists');
    
    const html = await fs.readFile(reportPath, 'utf-8');
    
    if (!html.includes('<style>')) {
      result.warnings.push('⚠️  report.html missing inline styles');
    } else {
      console.log('✅ report.html has inline CSS');
    }

    const imgPattern = /<img[^>]+src="([^"]+)"/g;
    const images = [...html.matchAll(imgPattern)].map(m => m[1]);

    let missingImages = 0;
    for (const img of images) {
      if (img.startsWith('data:')) continue;
      if (img.startsWith('http://') || img.startsWith('https://')) {
        result.errors.push(`❌ External image in report.html: ${img}`);
        result.passed = false;
        continue;
      }

      const imgPath = path.join(path.dirname(reportPath), img);
      const exists = await fs.access(imgPath).then(() => true).catch(() => false);
      
      if (!exists) {
        missingImages++;
        if (missingImages <= 5) {
          result.errors.push(`❌ Image missing: ${img}`);
        }
        result.passed = false;
      }
    }

    if (missingImages === 0 && images.length > 0) {
      console.log('✅ All images in report.html exist');
    }
  }

  const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
  if (!summaryExists) {
    result.errors.push('❌ summary.json not found');
    result.passed = false;
  } else {
    console.log('✅ summary.json exists');
    
    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
    
    if (summary.comparisons) {
      const failedComparisons = summary.comparisons.filter((c: any) => !c.passed);
      
      for (const comparison of failedComparisons) {
        const checks = [
          { path: comparison.baselinePath, label: 'baseline' },
          { path: comparison.actualPath, label: 'actual' },
          { path: comparison.diffPath, label: 'diff' },
        ];

        for (const check of checks) {
          if (check.path) {
            const exists = await fs.access(check.path).then(() => true).catch(() => false);
            if (!exists) {
              result.errors.push(`❌ ${check.label} missing for ${comparison.route}: ${check.path}`);
              result.passed = false;
            }
          }
        }
      }

      if (failedComparisons.length > 0) {
        console.log(`✅ Evidence verified for ${failedComparisons.length} failed screen(s)`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  
  if (result.errors.length > 0) {
    console.log('\n❌ VERIFICATION FAILED\n');
    result.errors.forEach(err => console.error(err));
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS\n');
    result.warnings.forEach(warn => console.warn(warn));
  }

  if (result.passed) {
    console.log('\n✅ OFFLINE REPORT VERIFICATION PASSED\n');
    console.log('Report is fully self-contained and works offline.');
  }

  console.log('='.repeat(60) + '\n');

  return result;
}

const evidenceDir = process.argv[2] || path.join(process.cwd(), '.ai-gate', 'evidence');

verifyOfflineReport(evidenceDir)
  .then(result => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Verification script error:', error);
    process.exit(1);
  });
