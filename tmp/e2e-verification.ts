#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

const API_BASE = 'https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev';
const BASELINES_DIR = '/baselines';
const MANIFEST_PATH = '/baselines/manifest.json';

interface TestResult {
  test: string;
  passed: boolean;
  evidence: string[];
  errors: string[];
}

const results: TestResult[] = [];

async function readManifest() {
  const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
  return JSON.parse(data);
}

async function imageToBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

async function verifyFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// TEST 1: Upload Images (Happy Path)
async function test1_uploadHappyPath() {
  const test: TestResult = {
    test: 'Test 1: Upload Images (happy path)',
    passed: false,
    evidence: [],
    errors: []
  };

  try {
    const manifestBefore = await readManifest();
    const countBefore = manifestBefore.baselines.length;
    test.evidence.push(`BEFORE: manifest has ${countBefore} baselines`);

    const loginBase64 = await imageToBase64('/tmp/login.png');
    const dashboardBase64 = await imageToBase64('/tmp/dashboard.png');
    const pricingBase64 = await imageToBase64('/tmp/pricing.png');

    const response = await fetch(`${API_BASE}/baselines/upload-multi-fs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselines: [
          {
            screenId: 'login',
            name: 'Login',
            route: '/login',
            viewportWidth: 1280,
            viewportHeight: 720,
            imageData: loginBase64
          },
          {
            screenId: 'dashboard',
            name: 'Dashboard',
            route: '/dashboard',
            viewportWidth: 1280,
            viewportHeight: 720,
            imageData: dashboardBase64
          },
          {
            screenId: 'pricing',
            name: 'Pricing',
            route: '/pricing',
            viewportWidth: 1280,
            viewportHeight: 720,
            imageData: pricingBase64
          }
        ]
      })
    });

    const result = await response.json();
    test.evidence.push(`HTTP Status: ${response.status}`);
    test.evidence.push(`Response: ${JSON.stringify(result, null, 2)}`);

    const manifestAfter = await readManifest();
    test.evidence.push(`AFTER: manifest has ${manifestAfter.baselines.length} baselines`);

    // Verify files exist
    const loginExists = await verifyFileExists('/baselines/login/baseline.png');
    const dashboardExists = await verifyFileExists('/baselines/dashboard/baseline.png');
    const pricingExists = await verifyFileExists('/baselines/pricing/baseline.png');

    test.evidence.push(`/baselines/login/baseline.png exists: ${loginExists}`);
    test.evidence.push(`/baselines/dashboard/baseline.png exists: ${dashboardExists}`);
    test.evidence.push(`/baselines/pricing/baseline.png exists: ${pricingExists}`);

    // Verify manifest entries
    const loginEntry = manifestAfter.baselines.find((b: any) => b.screenId === 'login');
    const dashboardEntry = manifestAfter.baselines.find((b: any) => b.screenId === 'dashboard');
    const pricingEntry = manifestAfter.baselines.find((b: any) => b.screenId === 'pricing');

    test.evidence.push(`Manifest login entry: ${JSON.stringify(loginEntry)}`);
    test.evidence.push(`Manifest dashboard entry: ${JSON.stringify(dashboardEntry)}`);
    test.evidence.push(`Manifest pricing entry: ${JSON.stringify(pricingEntry)}`);

    test.passed = 
      response.status === 200 &&
      result.success === true &&
      result.uploaded.length === 3 &&
      loginExists && dashboardExists && pricingExists &&
      loginEntry && dashboardEntry && pricingEntry;

    if (!test.passed) {
      test.errors.push('Not all conditions met for happy path upload');
    }
  } catch (error) {
    test.errors.push(`Exception: ${error}`);
  }

  results.push(test);
}

// TEST 2: Upload Validation (Negative Tests)
async function test2_uploadValidation() {
  const test: TestResult = {
    test: 'Test 2: Upload validation (negative tests)',
    passed: false,
    evidence: [],
    errors: []
  };

  try {
    const manifestBefore = await readManifest();

    // Create bad.txt
    await fs.writeFile('/tmp/bad.txt', 'This is not an image');
    const badTxtBase64 = await imageToBase64('/tmp/bad.txt');

    const response1 = await fetch(`${API_BASE}/baselines/upload-multi-fs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselines: [{
          screenId: 'bad-txt',
          name: 'Bad TXT',
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: badTxtBase64
        }]
      })
    });

    const result1 = await response1.json();
    test.evidence.push(`bad.txt upload - Status: ${response1.status}`);
    test.evidence.push(`bad.txt upload - Response: ${JSON.stringify(result1)}`);

    // Create fake PNG (text file renamed)
    await fs.writeFile('/tmp/bad_renamed_to_png.png', 'FAKE PNG DATA');
    const fakePngBase64 = await imageToBase64('/tmp/bad_renamed_to_png.png');

    const response2 = await fetch(`${API_BASE}/baselines/upload-multi-fs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselines: [{
          screenId: 'fake-png',
          name: 'Fake PNG',
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: fakePngBase64
        }]
      })
    });

    const result2 = await response2.json();
    test.evidence.push(`fake PNG upload - Status: ${response2.status}`);
    test.evidence.push(`fake PNG upload - Response: ${JSON.stringify(result2)}`);

    // Create oversized file (>5MB)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    largeBuffer.fill(0x89); // PNG magic number start
    await fs.writeFile('/tmp/large_over_5mb.png', largeBuffer);
    const largePngBase64 = largeBuffer.toString('base64');

    const response3 = await fetch(`${API_BASE}/baselines/upload-multi-fs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselines: [{
          screenId: 'large-file',
          name: 'Large File',
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: largePngBase64
        }]
      })
    });

    const result3 = await response3.json();
    test.evidence.push(`large file upload - Status: ${response3.status}`);
    test.evidence.push(`large file upload - Response: ${JSON.stringify(result3)}`);

    const manifestAfter = await readManifest();
    const badTxtExists = await verifyFileExists('/baselines/bad-txt/baseline.png');
    const fakePngExists = await verifyFileExists('/baselines/fake-png/baseline.png');
    const largeFileExists = await verifyFileExists('/baselines/large-file/baseline.png');

    test.evidence.push(`Filesystem unchanged: bad-txt exists=${badTxtExists}, fake-png exists=${fakePngExists}, large-file exists=${largeFileExists}`);
    test.evidence.push(`Manifest count unchanged: ${manifestBefore.baselines.length} -> ${manifestAfter.baselines.length}`);

    test.passed = 
      result1.errors.length > 0 &&
      result2.errors.length > 0 &&
      result3.errors.length > 0 &&
      !badTxtExists && !fakePngExists && !largeFileExists;

    if (!test.passed) {
      test.errors.push('Validation did not reject all invalid files');
    }
  } catch (error) {
    test.errors.push(`Exception: ${error}`);
  }

  results.push(test);
}

// TEST 3: Duplicate/Upsert Test
async function test3_duplicateUpsert() {
  const test: TestResult = {
    test: 'Test 3: Duplicate/Upsert test (critical)',
    passed: false,
    evidence: [],
    errors: []
  };

  try {
    const manifestBefore = await readManifest();
    const loginBefore = manifestBefore.baselines.find((b: any) => b.screenId === 'login');
    test.evidence.push(`BEFORE: login hash=${loginBefore?.hash}`);

    // Modify the login image slightly
    const loginBuffer = await fs.readFile('/tmp/login.png');
    const modifiedBuffer = Buffer.concat([loginBuffer, Buffer.from([0xFF])]);
    await fs.writeFile('/tmp/login_modified.png', modifiedBuffer);

    const modifiedBase64 = modifiedBuffer.toString('base64');

    const response = await fetch(`${API_BASE}/baselines/upload-multi-fs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselines: [{
          screenId: 'login',
          name: 'Login Updated',
          route: '/login',
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: modifiedBase64
        }]
      })
    });

    const result = await response.json();
    test.evidence.push(`Upsert response: ${JSON.stringify(result)}`);

    const manifestAfter = await readManifest();
    const loginAfter = manifestAfter.baselines.filter((b: any) => b.screenId === 'login');
    test.evidence.push(`AFTER: found ${loginAfter.length} login entries`);
    test.evidence.push(`AFTER: login hash=${loginAfter[0]?.hash}`);

    // Re-upload identical file
    const response2 = await fetch(`${API_BASE}/baselines/upload-multi-fs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baselines: [{
          screenId: 'login',
          name: 'Login Again',
          route: '/login',
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: modifiedBase64
        }]
      })
    });

    const result2 = await response2.json();
    test.evidence.push(`Identical re-upload response: ${JSON.stringify(result2)}`);

    test.passed = 
      loginAfter.length === 1 &&
      loginAfter[0].hash !== loginBefore?.hash &&
      result.uploaded[0].status === 'updated' &&
      result2.uploaded[0].status === 'no_change';

    if (!test.passed) {
      test.errors.push('Upsert semantics not working correctly');
    }
  } catch (error) {
    test.errors.push(`Exception: ${error}`);
  }

  results.push(test);
}

// TEST 6: Export ZIP
async function test6_exportZip() {
  const test: TestResult = {
    test: 'Test 6: Export ZIP end-to-end validation',
    passed: false,
    evidence: [],
    errors: []
  };

  try {
    const response = await fetch(`${API_BASE}/baselines/export-zip-fs`);
    
    test.evidence.push(`HTTP Status: ${response.status}`);
    test.evidence.push(`Content-Type: ${response.headers.get('content-type')}`);
    
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      test.evidence.push(`Response type: JSON (base64 encoded ZIP)`);
      test.evidence.push(`Filename: ${json.filename}`);
      
      if (json.zipData) {
        const zipBuffer = Buffer.from(json.zipData, 'base64');
        await fs.writeFile('/tmp/export.zip', zipBuffer);
        
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries();
        
        test.evidence.push(`ZIP contains ${entries.length} entries:`);
        entries.forEach(entry => {
          test.evidence.push(`  - ${entry.entryName}`);
        });
        
        const hasManifest = entries.some(e => e.entryName.includes('manifest.json'));
        const hasBaselines = entries.some(e => e.entryName.includes('baseline.png'));
        
        test.passed = hasManifest && hasBaselines && entries.length > 0;
      }
    } else if (contentType?.includes('application/zip')) {
      test.evidence.push(`Response type: Direct ZIP download`);
      test.evidence.push(`Content-Disposition: ${response.headers.get('content-disposition')}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);
      await fs.writeFile('/tmp/export.zip', zipBuffer);
      
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      
      test.evidence.push(`ZIP contains ${entries.length} entries:`);
      entries.forEach(entry => {
        test.evidence.push(`  - ${entry.entryName}`);
      });
      
      const hasManifest = entries.some(e => e.entryName.includes('manifest.json'));
      const hasBaselines = entries.some(e => e.entryName.includes('baseline.png'));
      
      test.passed = hasManifest && hasBaselines && entries.length > 0;
    }

    if (!test.passed) {
      test.errors.push('Export ZIP does not contain expected structure');
    }
  } catch (error) {
    test.errors.push(`Exception: ${error}`);
  }

  results.push(test);
}

// Run all tests
async function runAllTests() {
  console.log('Starting Phase 1 E2E Verification...\n');
  
  await test1_uploadHappyPath();
  await test2_uploadValidation();
  await test3_duplicateUpsert();
  await test6_exportZip();
  
  // Generate report
  let report = '# PHASE 1 E2E VERIFICATION REPORT\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## TEST RESULTS SUMMARY\n\n';
  
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  
  report += `✅ PASSED: ${passCount}\n`;
  report += `❌ FAILED: ${failCount}\n\n`;
  
  report += '## DETAILED RESULTS\n\n';
  
  results.forEach((result, idx) => {
    report += `### ${result.test}\n\n`;
    report += `**Status:** ${result.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    if (result.evidence.length > 0) {
      report += '**Evidence:**\n\n';
      result.evidence.forEach(e => {
        report += `- ${e}\n`;
      });
      report += '\n';
    }
    
    if (result.errors.length > 0) {
      report += '**Errors:**\n\n';
      result.errors.forEach(e => {
        report += `- ${e}\n`;
      });
      report += '\n';
    }
    
    report += '---\n\n';
  });
  
  await fs.writeFile('/tmp/verification-results.md', report);
  console.log(report);
  console.log('\nReport saved to /tmp/verification-results.md');
}

runAllTests().catch(console.error);
