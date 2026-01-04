import { test, expect } from "@playwright/test";

test.describe("Server Response Diagnosis", () => {
  test("GET /baselines with Accept: text/html should return 200 HTML", async ({ request }) => {
    const response = await request.get("/baselines", {
      headers: { "Accept": "text/html" }
    });
    
    console.log("GET /baselines status:", response.status());
    console.log("GET /baselines content-type:", response.headers()["content-type"]);
    
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  });

  test("GET /docs/install with Accept: text/html should return 200 HTML", async ({ request }) => {
    const response = await request.get("/docs/install", {
      headers: { "Accept": "text/html" }
    });
    
    console.log("GET /docs/install status:", response.status());
    console.log("GET /docs/install content-type:", response.headers()["content-type"]);
    
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  });

  test("GET /baselines.list API endpoint should return JSON", async ({ request }) => {
    const response = await request.get("/baselines.list");
    
    console.log("GET /baselines.list status:", response.status());
    console.log("GET /baselines.list content-type:", response.headers()["content-type"]);
    
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
  });

  test("GET /random with Accept: text/html should return 200 HTML (SPA fallback)", async ({ request }) => {
    const response = await request.get("/random", {
      headers: { "Accept": "text/html" }
    });
    
    console.log("GET /random status:", response.status());
    console.log("GET /random content-type:", response.headers()["content-type"]);
    
    // Should serve index.html (200), not 404
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  });
});
