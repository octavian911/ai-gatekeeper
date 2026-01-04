import { test, expect } from "@playwright/test";

test.describe("SPA Routing", () => {
  test("hard refresh on /baselines should stay on /baselines", async ({ page }) => {
    await page.goto("/baselines");
    
    await expect(page).toHaveURL("/baselines");
    await expect(page.locator("h1")).toContainText("Baseline Management");
    
    await page.reload();
    
    await expect(page).toHaveURL("/baselines");
    await expect(page.locator("h1")).toContainText("Baseline Management");
  });

  test("hard refresh on /docs/install should stay on /docs/install", async ({ page }) => {
    await page.goto("/docs/install");
    
    await expect(page).toHaveURL("/docs/install");
    
    await page.reload();
    
    await expect(page).toHaveURL("/docs/install");
  });

  test("hard refresh on /docs/reviewers should stay on /docs/reviewers", async ({ page }) => {
    await page.goto("/docs/reviewers");
    
    await expect(page).toHaveURL("/docs/reviewers");
    
    await page.reload();
    
    await expect(page).toHaveURL("/docs/reviewers");
  });

  test("root / should show landing page", async ({ page }) => {
    await page.goto("/");
    
    await expect(page).toHaveURL("/");
    
    await page.reload();
    
    await expect(page).toHaveURL("/");
  });

  test("unknown routes like /asdf redirect to landing page", async ({ page }) => {
    await page.goto("/asdf");
    
    await expect(page).toHaveURL("/");
    
    const response = await page.request.get("/asdf");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toMatch(/text\/html/);
    
    const body = await response.text();
    expect(body).toContain("<!doctype html>");
  });

  test("API routes should not be affected by SPA fallback", async ({ page }) => {
    const response = await page.request.get("/baselines.list");
    
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
  });

  test("direct navigation to /reviews should work", async ({ page }) => {
    await page.goto("/reviews");
    
    await expect(page).toHaveURL("/reviews");
    await expect(page.locator("h1")).toContainText("QA Reviews");
  });

  test("browser back/forward navigation should work correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");

    await page.goto("/baselines");
    await expect(page).toHaveURL("/baselines");

    await page.goto("/reviews");
    await expect(page).toHaveURL("/reviews");

    await page.goBack();
    await expect(page).toHaveURL("/baselines");

    await page.goBack();
    await expect(page).toHaveURL("/");

    await page.goForward();
    await expect(page).toHaveURL("/baselines");
  });

  test("static assets should load normally without rewrite", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    
    const cssRequests = page.waitForResponse(response => 
      response.url().includes(".css") && response.status() === 200
    );
    
    await cssRequests;
  });
});
