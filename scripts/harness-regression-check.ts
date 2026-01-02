#!/usr/bin/env tsx

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

interface RegressionCase {
  name: string;
  envVar: string;
  expectedFailScreen: string;
  description: string;
}

const REGRESSION_CASES: RegressionCase[] = [
  {
    name: 'button-padding',
    envVar: 'VITE_REGRESSION_CASE=button-padding',
    expectedFailScreen: 'screen-03',
    description: 'Increased button padding on screen 03',
  },
  {
    name: 'missing-banner',
    envVar: 'VITE_REGRESSION_CASE=missing-banner',
    expectedFailScreen: 'screen-07',
    description: 'Hidden banner component on screen 07',
  },
  {
    name: 'font-size',
    envVar: 'VITE_REGRESSION_CASE=font-size',
    expectedFailScreen: 'screen-10',
    description: 'Increased heading font size on screen 10',
  },
];

const DEMO_APP_DIR = join(process.cwd(), 'examples', 'demo-app');
const BASE_URL = 'http://localhost:5173';

async function log(message: string, type: 'info' | 'success' | 'error' | 'step' = 'info') {
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    error: '❌',
    step: '▶️ ',
  }[type];
  console.log(`${prefix} ${message}`);
}

async function runGate(envVars: Record<string, string> = {}): Promise<{ success: boolean; output: string; json?: any }> {
  const env = { ...process.env, ...envVars };
  
  try {
    const { stdout, stderr } = await execAsync(
      'pnpm gate run --baseURL http://localhost:5173 --outputFormat json',
      {
        cwd: DEMO_APP_DIR,
        env,
      }
    );
    
    const output = stdout + stderr;
    
    // Try to parse JSON output
    let jsonResult;
    try {
      const jsonMatch = output.match(/\{[\s\S]*"status"[\s\S]*\}/);
      if (jsonMatch) {
        jsonResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // JSON parsing failed, continue without it
    }
    
    return { success: true, output, json: jsonResult };
  } catch (error: any) {
    const output = (error.stdout || '') + (error.stderr || '');
    
    // Try to parse JSON output even on failure
    let jsonResult;
    try {
      const jsonMatch = output.match(/\{[\s\S]*"status"[\s\S]*\}/);
      if (jsonMatch) {
        jsonResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // JSON parsing failed
    }
    
    return { success: false, output, json: jsonResult };
  }
}

async function checkBaselinePass(): Promise<boolean> {
  await log('Step 1: Running gate without regressions (should PASS)', 'step');
  
  const result = await runGate();
  
  if (!result.success || result.json?.status !== 'PASS') {
    await log('FAILED: Baseline gate check did not PASS', 'error');
    console.log('Output:', result.output);
    return false;
  }
  
  await log('Baseline gate check PASSED', 'success');
  return true;
}

async function checkRegressionCase(regressionCase: RegressionCase): Promise<boolean> {
  await log(`\nStep: Testing regression case "${regressionCase.name}" - ${regressionCase.description}`, 'step');
  
  const result = await runGate({ [regressionCase.envVar.split('=')[0]]: regressionCase.envVar.split('=')[1] });
  
  if (result.success || result.json?.status === 'PASS') {
    await log(`FAILED: Gate should have failed for regression case "${regressionCase.name}" but PASSED`, 'error');
    console.log('Output:', result.output);
    return false;
  }
  
  // Check if the expected screen failed
  const expectedScreenFailed = result.output.includes(regressionCase.expectedFailScreen) ||
    (result.json?.screens?.some((s: any) => 
      s.id === regressionCase.expectedFailScreen && s.status === 'FAIL'
    ));
  
  if (!expectedScreenFailed) {
    await log(
      `FAILED: Expected screen "${regressionCase.expectedFailScreen}" to fail but it did not`,
      'error'
    );
    console.log('Output:', result.output);
    return false;
  }
  
  await log(`Regression case "${regressionCase.name}" correctly detected on ${regressionCase.expectedFailScreen}`, 'success');
  return true;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  AI Output Gate - Harness Regression Validation               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  await log('Starting regression validation checks...', 'info');
  await log(`Demo app directory: ${DEMO_APP_DIR}`, 'info');
  await log(`Base URL: ${BASE_URL}\n`, 'info');
  
  let allPassed = true;
  
  // Step 1: Check baseline passes
  const baselinePassed = await checkBaselinePass();
  if (!baselinePassed) {
    allPassed = false;
  }
  
  // Step 2-4: Check each regression case
  for (const regressionCase of REGRESSION_CASES) {
    const casePassed = await checkRegressionCase(regressionCase);
    if (!casePassed) {
      allPassed = false;
    }
  }
  
  console.log('\n' + '═'.repeat(64));
  if (allPassed) {
    await log('All regression validation checks PASSED! 🎉', 'success');
    console.log('═'.repeat(64));
    process.exit(0);
  } else {
    await log('Some regression validation checks FAILED', 'error');
    console.log('═'.repeat(64));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
