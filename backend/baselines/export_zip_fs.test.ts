import { describe, it, expect, beforeEach } from "vitest";
import { exportZipFs } from "./export_zip_fs";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

const BASELINES_DIR = "/baselines";

describe("exportZipFs", () => {
  beforeEach(async () => {
    await fs.mkdir(BASELINES_DIR, { recursive: true });
    await fs.mkdir(path.join(BASELINES_DIR, "screen-01"), { recursive: true });

    const manifest = {
      version: 1,
      baselines: [
        {
          screenId: "screen-01",
          name: "Test Screen",
          url: "https://example.com",
        },
      ],
    };

    await fs.writeFile(
      path.join(BASELINES_DIR, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    await fs.writeFile(
      path.join(BASELINES_DIR, "screen-01", "baseline.png"),
      Buffer.from("fake-image-data")
    );

    const screenConfig = {
      viewportWidth: 1920,
      viewportHeight: 1080,
    };

    await fs.writeFile(
      path.join(BASELINES_DIR, "screen-01", "screen.json"),
      JSON.stringify(screenConfig, null, 2)
    );
  });

  it("returns base64-encoded ZIP data", async () => {
    const response = await exportZipFs({});

    expect(response.zipData).toBeTruthy();
    expect(typeof response.zipData).toBe("string");
    
    const binaryString = atob(response.zipData);
    expect(binaryString.length).toBeGreaterThan(0);
  });

  it("returns filename with timestamp", async () => {
    const response = await exportZipFs({});

    expect(response.filename).toMatch(/^baselines-export-\d{8}-\d{4}\.zip$/);
  });

  it("returns valid ZIP with manifest.json", async () => {
    const response = await exportZipFs({});

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const manifestEntry = zip.getEntry("baselines/manifest.json");
    expect(manifestEntry).toBeTruthy();

    const manifestContent = JSON.parse(manifestEntry!.getData().toString("utf8"));
    expect(manifestContent.baselines).toHaveLength(1);
    expect(manifestContent.baselines[0].screenId).toBe("screen-01");
  });

  it("returns valid ZIP with baseline image", async () => {
    const response = await exportZipFs({});

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const imageEntry = zip.getEntry("baselines/screen-01/baseline.png");
    expect(imageEntry).toBeTruthy();
  });

  it("returns valid ZIP with README.txt", async () => {
    const response = await exportZipFs({});

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const readmeEntry = zip.getEntry("README.txt");
    expect(readmeEntry).toBeTruthy();
    
    const readmeContent = readmeEntry!.getData().toString("utf8");
    expect(readmeContent).toContain("# Baseline Export");
    expect(readmeContent).toContain("Baselines exported: 1");
  });

  it("filters baselines when filter=validated", async () => {
    await fs.mkdir(path.join(BASELINES_DIR, "screen-02"), { recursive: true });

    const manifest = {
      version: 1,
      baselines: [
        {
          screenId: "screen-01",
          name: "Validated",
        },
        {
          screenId: "screen-02",
          name: "Invalid",
          tags: ["noisy"],
        },
      ],
    };

    await fs.writeFile(
      path.join(BASELINES_DIR, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    await fs.writeFile(
      path.join(BASELINES_DIR, "screen-02", "baseline.png"),
      Buffer.from("fake-image-data")
    );

    const response = await exportZipFs({ filter: "validated" });

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const manifestEntry = zip.getEntry("baselines/manifest.json");
    const manifestContent = JSON.parse(manifestEntry!.getData().toString("utf8"));

    expect(manifestContent.baselines).toHaveLength(1);
    expect(manifestContent.baselines[0].screenId).toBe("screen-01");
  });

  it("filters baselines when filter=invalid", async () => {
    await fs.mkdir(path.join(BASELINES_DIR, "screen-02"), { recursive: true });

    const manifest = {
      version: 1,
      baselines: [
        {
          screenId: "screen-01",
          name: "Validated",
        },
        {
          screenId: "screen-02",
          name: "Invalid",
          tags: ["noisy"],
        },
      ],
    };

    await fs.writeFile(
      path.join(BASELINES_DIR, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    await fs.writeFile(
      path.join(BASELINES_DIR, "screen-02", "baseline.png"),
      Buffer.from("fake-image-data")
    );

    const response = await exportZipFs({ filter: "invalid" });

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const manifestEntry = zip.getEntry("baselines/manifest.json");
    const manifestContent = JSON.parse(manifestEntry!.getData().toString("utf8"));

    expect(manifestContent.baselines).toHaveLength(1);
    expect(manifestContent.baselines[0].screenId).toBe("screen-02");
  });

  it("filters baselines when search query provided", async () => {
    await fs.mkdir(path.join(BASELINES_DIR, "screen-02"), { recursive: true });

    const manifest = {
      version: 1,
      baselines: [
        {
          screenId: "screen-01",
          name: "Homepage",
        },
        {
          screenId: "screen-02",
          name: "Dashboard",
        },
      ],
    };

    await fs.writeFile(
      path.join(BASELINES_DIR, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );

    const response = await exportZipFs({ search: "Home" });

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const manifestEntry = zip.getEntry("baselines/manifest.json");
    const manifestContent = JSON.parse(manifestEntry!.getData().toString("utf8"));

    expect(manifestContent.baselines).toHaveLength(1);
    expect(manifestContent.baselines[0].name).toBe("Homepage");
  });

  it("includes filter and search info in README", async () => {
    const response = await exportZipFs({ filter: "validated", search: "test" });

    const buffer = Buffer.from(response.zipData, "base64");
    const zip = new AdmZip(buffer);

    const readmeEntry = zip.getEntry("README.txt");
    const readmeContent = readmeEntry!.getData().toString("utf8");

    expect(readmeContent).toContain("Filter: validated");
    expect(readmeContent).toContain('Search: "test"');
  });
});
