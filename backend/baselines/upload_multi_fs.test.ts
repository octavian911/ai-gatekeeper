import { describe, it, expect, beforeEach } from "vitest";
import { uploadMultiFs } from "./upload_multi_fs";
import {
  readManifest,
  writeManifest,
  writeBaselineImage,
  getImageHash,
} from "./filesystem";

const createMockImageBuffer = (content: string): string => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const contentBuffer = Buffer.from(content);
  const fullBuffer = Buffer.concat([pngHeader, contentBuffer]);
  return fullBuffer.toString("base64");
};

describe("upload_multi_fs upsert behavior", () => {
  beforeEach(async () => {
    const emptyManifest = { baselines: [] };
    await writeManifest(emptyManifest);
  });

  it("creates new baseline on first upload", async () => {
    const imageData = createMockImageBuffer("login-v1");

    const response = await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login",
          route: "/login",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData,
        },
      ],
    });

    expect(response.success).toBe(true);
    expect(response.uploaded).toHaveLength(1);
    expect(response.uploaded[0].status).toBe("created");
    expect(response.uploaded[0].screenId).toBe("login");

    const manifest = await readManifest();
    expect(manifest.baselines).toHaveLength(1);
    expect(manifest.baselines[0].screenId).toBe("login");
  });

  it("updates existing baseline when uploading same screenId with different content", async () => {
    const imageData1 = createMockImageBuffer("login-v1");
    const imageData2 = createMockImageBuffer("login-v2-different");

    await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login",
          route: "/login",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: imageData1,
        },
      ],
    });

    const manifest1 = await readManifest();
    const initialHash = manifest1.baselines[0].hash;

    const response = await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login Updated",
          route: "/login",
          tags: ["critical"],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: imageData2,
        },
      ],
    });

    expect(response.success).toBe(true);
    expect(response.uploaded).toHaveLength(1);
    expect(response.uploaded[0].status).toBe("updated");
    expect(response.uploaded[0].screenId).toBe("login");

    const manifest2 = await readManifest();
    expect(manifest2.baselines).toHaveLength(1);
    expect(manifest2.baselines[0].screenId).toBe("login");
    expect(manifest2.baselines[0].name).toBe("Login Updated");
    expect(manifest2.baselines[0].tags).toEqual(["critical"]);
    expect(manifest2.baselines[0].hash).not.toBe(initialHash);
  });

  it("returns no_change when uploading identical content", async () => {
    const imageData = createMockImageBuffer("login-v1");

    await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login",
          route: "/login",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData,
        },
      ],
    });

    const manifest1 = await readManifest();
    const initialHash = manifest1.baselines[0].hash;

    const response = await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login",
          route: "/login",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData,
        },
      ],
    });

    expect(response.success).toBe(true);
    expect(response.uploaded).toHaveLength(1);
    expect(response.uploaded[0].status).toBe("no_change");
    expect(response.uploaded[0].screenId).toBe("login");

    const manifest2 = await readManifest();
    expect(manifest2.baselines).toHaveLength(1);
    expect(manifest2.baselines[0].hash).toBe(initialHash);
  });

  it("prevents duplicate entries in manifest when uploading same screenId twice", async () => {
    const imageData1 = createMockImageBuffer("dashboard-v1");
    const imageData2 = createMockImageBuffer("dashboard-v2");

    await uploadMultiFs({
      baselines: [
        {
          screenId: "dashboard",
          name: "Dashboard",
          route: "/dashboard",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: imageData1,
        },
      ],
    });

    await uploadMultiFs({
      baselines: [
        {
          screenId: "dashboard",
          name: "Dashboard Updated",
          route: "/dashboard",
          tags: ["standard"],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: imageData2,
        },
      ],
    });

    const manifest = await readManifest();
    expect(manifest.baselines).toHaveLength(1);
    expect(manifest.baselines[0].screenId).toBe("dashboard");
    expect(manifest.baselines[0].name).toBe("Dashboard Updated");
  });

  it("handles mixed batch with new and existing baselines", async () => {
    const loginData = createMockImageBuffer("login-v1");
    const dashboardData = createMockImageBuffer("dashboard-v1");
    const pricingData = createMockImageBuffer("pricing-v1");

    await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login",
          route: "/login",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: loginData,
        },
      ],
    });

    const response = await uploadMultiFs({
      baselines: [
        {
          screenId: "login",
          name: "Login",
          route: "/login",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: loginData,
        },
        {
          screenId: "dashboard",
          name: "Dashboard",
          route: "/dashboard",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: dashboardData,
        },
        {
          screenId: "pricing",
          name: "Pricing",
          route: "/pricing",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: pricingData,
        },
      ],
    });

    expect(response.success).toBe(true);
    expect(response.uploaded).toHaveLength(3);
    expect(response.uploaded.find(u => u.screenId === "login")?.status).toBe("no_change");
    expect(response.uploaded.find(u => u.screenId === "dashboard")?.status).toBe("created");
    expect(response.uploaded.find(u => u.screenId === "pricing")?.status).toBe("created");

    const manifest = await readManifest();
    expect(manifest.baselines).toHaveLength(3);
    expect(manifest.baselines.map(b => b.screenId).sort()).toEqual(["dashboard", "login", "pricing"]);
  });

  it("rejects duplicate screenId in same batch", async () => {
    const imageData1 = createMockImageBuffer("settings-v1");
    const imageData2 = createMockImageBuffer("settings-v2");

    const response = await uploadMultiFs({
      baselines: [
        {
          screenId: "settings",
          name: "Settings",
          route: "/settings",
          tags: [],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: imageData1,
        },
        {
          screenId: "settings",
          name: "Settings Updated",
          route: "/settings",
          tags: ["critical"],
          viewportWidth: 1280,
          viewportHeight: 720,
          imageData: imageData2,
        },
      ],
    });

    expect(response.success).toBe(false);
    expect(response.uploaded).toHaveLength(1);
    expect(response.errors).toHaveLength(1);
    expect(response.errors[0].screenId).toBe("settings");
    expect(response.errors[0].message).toBe("Duplicate screen ID in upload batch");

    const manifest = await readManifest();
    expect(manifest.baselines).toHaveLength(1);
    expect(manifest.baselines[0].screenId).toBe("settings");
  });
});
