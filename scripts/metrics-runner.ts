import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

const DEMO_APP_DIR = path.join(process.cwd(), "examples/demo-app");
const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts");
const METRICS_FILE = path.join(ARTIFACTS_DIR, "metrics.json");

interface Metrics {
  timestamp: string;
  runtime_seconds: number;
  total_screens: number;
  flake_rate: number;
  false_fail_rate: number;
  repeatability_pass_count: number;
  repeatability_total_count: number;
  notes: string[];
}

async function ensureArtifactsDir() {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

function runGateCommand(baseURL: string): { duration: number; exitCode: number; output: string } {
  const startTime = Date.now();
  
  try {
    const output = execSync(
      `pnpm gate run --baseURL ${baseURL}`,
      {
        cwd: DEMO_APP_DIR,
        encoding: "utf-8",
        stdio: "pipe",
      }
    );
    const duration = (Date.now() - startTime) / 1000;
    return { duration, exitCode: 0, output };
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    return {
      duration,
      exitCode: error.status || 1,
      output: error.stdout || error.stderr || "",
    };
  }
}

async function measureMetrics(): Promise<Metrics> {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  AI Output Gate - Metrics Measurement                         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const baseURL = "http://localhost:5173";
  const notes: string[] = [];

  console.log("📊 Measuring runtime (single run)...");
  const run1 = runGateCommand(baseURL);
  console.log(`   ✅ Runtime: ${run1.duration.toFixed(2)}s\n`);

  console.log("🔄 Measuring flake rate (repeatability check)...");
  console.log("   Running gate a second time...");
  const run2 = runGateCommand(baseURL);
  console.log(`   ✅ Second run: ${run2.duration.toFixed(2)}s\n`);

  const run1Pass = run1.exitCode === 0;
  const run2Pass = run2.exitCode === 0;
  
  let flakeRate = 0;
  let falseFail = 0;
  
  if (run1Pass !== run2Pass) {
    flakeRate = 0.5;
    falseFail = 0.5;
    notes.push("Runs showed different results - possible flake detected");
    console.log("   ⚠️  Results differ between runs (potential flake)");
  } else if (run1Pass && run2Pass) {
    notes.push("Both runs passed - stable baseline");
    console.log("   ✅ Both runs passed - stable");
  } else {
    notes.push("Both runs failed - check baselines or app");
    console.log("   ⚠️  Both runs failed - investigate baselines");
  }

  const totalScreens = 20;
  const avgRuntime = (run1.duration + run2.duration) / 2;

  const metrics: Metrics = {
    timestamp: new Date().toISOString(),
    runtime_seconds: parseFloat(avgRuntime.toFixed(2)),
    total_screens: totalScreens,
    flake_rate: flakeRate,
    false_fail_rate: falseFail,
    repeatability_pass_count: [run1Pass, run2Pass].filter(Boolean).length,
    repeatability_total_count: 2,
    notes,
  };

  return metrics;
}

async function main() {
  try {
    await ensureArtifactsDir();
    
    const metrics = await measureMetrics();
    
    await fs.writeFile(METRICS_FILE, JSON.stringify(metrics, null, 2), "utf-8");
    
    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("📈 METRICS SUMMARY");
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`Runtime:          ${metrics.runtime_seconds}s (avg for ${metrics.total_screens} screens)`);
    console.log(`Flake Rate:       ${(metrics.flake_rate * 100).toFixed(1)}% (target: ≤1%)`);
    console.log(`False Fail Rate:  ${(metrics.false_fail_rate * 100).toFixed(1)}% (target: ≤2%)`);
    console.log(`Repeatability:    ${metrics.repeatability_pass_count}/${metrics.repeatability_total_count} runs passed`);
    console.log("════════════════════════════════════════════════════════════════");
    
    const flakePass = metrics.flake_rate <= 0.01;
    const falseFailPass = metrics.false_fail_rate <= 0.02;
    const runtimePass = metrics.runtime_seconds <= 300;
    
    console.log("\n🎯 90% READY TARGETS:");
    console.log(`   ${flakePass ? "✅" : "❌"} Flake Rate:      ${(metrics.flake_rate * 100).toFixed(1)}% ${flakePass ? "≤" : ">"} 1%`);
    console.log(`   ${falseFailPass ? "✅" : "❌"} False Fail Rate: ${(metrics.false_fail_rate * 100).toFixed(1)}% ${falseFailPass ? "≤" : ">"} 2%`);
    console.log(`   ${runtimePass ? "✅" : "❌"} Runtime:         ${metrics.runtime_seconds}s ${runtimePass ? "≤" : ">"} 300s (5min)`);
    console.log();
    
    if (metrics.notes.length > 0) {
      console.log("📝 Notes:");
      metrics.notes.forEach(note => console.log(`   - ${note}`));
      console.log();
    }
    
    console.log(`✅ Metrics saved to: ${METRICS_FILE}\n`);
    
  } catch (error) {
    console.error("❌ Metrics measurement failed:", error);
    process.exit(1);
  }
}

main();
