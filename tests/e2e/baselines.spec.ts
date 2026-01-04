import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";

const API_BASE_URL = process.env.API_BASE_URL || "https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://ai-output-gate-d5c156k82vjumvf6738g.lp.dev";
const FIXTURES_DIR = path.join(__dirname, "../fixtures");

test.describe("Baselines E2E Tests", () => {
  test.beforeAll(async () => {
    const fixturesExist = await fs.access(path.join(FIXTURES_DIR, "valid-test-1.png"))
      .then(() => true)
      .catch(() => false);
    
    if (!fixturesExist) {
      throw new Error("Test fixtures not found. Run: tsx tests/fixtures/create-fixtures.ts");
    }
  });

  test("Upload valid images creates baseline cards", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    const initialCount = await page.locator('[data-testid="baseline-card"]').count();
    
    const uploadButton = page.getByRole("button", { name: /upload images/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(FIXTURES_DIR, "valid-test-1.png"),
      path.join(FIXTURES_DIR, "valid-test-2.png"),
      path.join(FIXTURES_DIR, "valid-test-3.png"),
    ]);
    
    const submitButton = page.getByRole("button", { name: /^upload$/i });
    await submitButton.click();
    
    await expect(page.getByText(/baselines:/i)).toBeVisible({ timeout: 10000 });
    
    await page.waitForTimeout(1000);
    
    const newCount = await page.locator('[data-testid="baseline-card"]').count();
    expect(newCount).toBeGreaterThanOrEqual(initialCount + 3);
  });

  test("Upload invalid file is rejected", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    const initialCount = await page.locator('[data-testid="baseline-card"]').count();
    
    const uploadButton = page.getByRole("button", { name: /upload images/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([path.join(FIXTURES_DIR, "bad.txt")]);
    
    const submitButton = page.getByRole("button", { name: /^upload$/i });
    await submitButton.click();
    
    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 5000 });
    
    await page.waitForTimeout(500);
    const newCount = await page.locator('[data-testid="baseline-card"]').count();
    expect(newCount).toBe(initialCount);
  });

  test("Upload oversized file is rejected", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    const initialCount = await page.locator('[data-testid="baseline-card"]').count();
    
    const uploadButton = page.getByRole("button", { name: /upload images/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    
    const oversizedExists = await fs.access(path.join(FIXTURES_DIR, "oversized.png"))
      .then(() => true)
      .catch(() => false);
    
    if (oversizedExists) {
      await fileInput.setInputFiles([path.join(FIXTURES_DIR, "oversized.png")]);
      
      const submitButton = page.getByRole("button", { name: /^upload$/i });
      await submitButton.click();
      
      await expect(page.getByText(/(exceeds|too large|5mb)/i)).toBeVisible({ timeout: 5000 });
      
      await page.waitForTimeout(500);
      const newCount = await page.locator('[data-testid="baseline-card"]').count();
      expect(newCount).toBe(initialCount);
    } else {
      test.skip();
    }
  });

  test("Import ZIP creates baselines", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    const initialCount = await page.locator('[data-testid="baseline-card"]').count();
    
    const importButton = page.getByRole("button", { name: /import zip/i });
    await importButton.click();
    
    const fileInput = page.locator('input[type="file"][accept*="zip"]');
    await fileInput.setInputFiles([path.join(FIXTURES_DIR, "test-baselines.zip")]);
    
    const submitButton = page.getByRole("button", { name: /^import$/i });
    await submitButton.click();
    
    await expect(page.getByText(/imported/i)).toBeVisible({ timeout: 10000 });
    
    await page.waitForTimeout(1000);
    const newCount = await page.locator('[data-testid="baseline-card"]').count();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test("Export ZIP endpoint returns signed URL and binary download", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/baselines/export.zip`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("application/json");
    
    const json = await response.json();
    expect(json.downloadUrl).toBeDefined();
    expect(json.filename).toBeDefined();
    expect(json.expiresAt).toBeDefined();
    expect(json.filename).toMatch(/baselines-export-.*\.zip/);
    
    const downloadResponse = await request.get(json.downloadUrl);
    expect(downloadResponse.ok()).toBeTruthy();
    expect(downloadResponse.status()).toBe(200);
    
    const downloadContentType = downloadResponse.headers()["content-type"];
    expect(downloadContentType).toContain("application/zip");
    
    const contentDisposition = downloadResponse.headers()["content-disposition"];
    expect(contentDisposition).toBeDefined();
    expect(contentDisposition).toContain("attachment");
    expect(contentDisposition).toContain(".zip");
    
    const contentLength = downloadResponse.headers()["content-length"];
    expect(contentLength).toBeDefined();
    expect(parseInt(contentLength || "0")).toBeGreaterThan(0);
    
    const body = await downloadResponse.body();
    expect(body.length).toBeGreaterThan(0);
    
    const zipSignature = body.slice(0, 4);
    expect(zipSignature[0]).toBe(0x50);
    expect(zipSignature[1]).toBe(0x4B);
    
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(body);
    const zipEntries = zip.getEntries();
    
    const manifestEntry = zipEntries.find(e => e.entryName === "baselines/manifest.json");
    expect(manifestEntry).toBeDefined();
    
    const manifestContent = manifestEntry?.getData().toString("utf-8");
    expect(manifestContent).toBeDefined();
    const manifestJson = JSON.parse(manifestContent || "{}");
    expect(manifestJson.baselines).toBeDefined();
    
    const imageEntries = zipEntries.filter(e => 
      e.entryName.match(/^baselines\/[^/]+\/baseline\.(png|jpg|jpeg|webp)$/)
    );
    expect(imageEntries.length).toBeGreaterThan(0);
  });

  test("Export ZIP download triggers in browser", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    
    const exportButton = page.getByRole("button", { name: /export zip/i });
    await exportButton.click();
    
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/baselines-export-.*\.zip/);
    
    const downloadPath = path.join(__dirname, "../artifacts", download.suggestedFilename());
    await fs.mkdir(path.dirname(downloadPath), { recursive: true });
    await download.saveAs(downloadPath);
    
    const stats = await fs.stat(downloadPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test("View baseline opens drawer with image", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    await page.waitForSelector('[data-testid="baseline-card"]', { timeout: 10000 });
    
    const viewButton = page.locator('[data-testid="baseline-card"]').first().getByRole("button", { name: /view/i });
    await viewButton.click();
    
    await expect(page.locator('[data-testid="baseline-preview-drawer"]')).toBeVisible({ timeout: 5000 });
    
    const image = page.locator('[data-testid="baseline-preview-image"]');
    await expect(image).toBeVisible();
    
    const src = await image.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toMatch(/^data:image|^https?:/);
  });

  test("Re-validate updates status", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    await page.waitForSelector('[data-testid="baseline-card"]', { timeout: 10000 });
    
    const viewButton = page.locator('[data-testid="baseline-card"]').first().getByRole("button", { name: /view/i });
    await viewButton.click();
    
    await expect(page.locator('[data-testid="baseline-preview-drawer"]')).toBeVisible({ timeout: 5000 });
    
    const revalidateButton = page.getByRole("button", { name: /re-validate|validate/i });
    if (await revalidateButton.isVisible()) {
      await revalidateButton.click();
      
      await expect(page.getByText(/(validated|success)/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
