import fs from "fs/promises";
import path from "path";
import { PNG } from "pngjs";
import AdmZip from "adm-zip";

const FIXTURES_DIR = path.join(__dirname);

async function createTestImage(name: string, width: number, height: number, color: [number, number, number]) {
  const png = new PNG({ width, height });
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = 255;
    }
  }
  
  const buffer = PNG.sync.write(png);
  await fs.writeFile(path.join(FIXTURES_DIR, name), buffer);
}

async function createValidImage() {
  await createTestImage("valid-test-1.png", 100, 100, [255, 0, 0]);
}

async function createValidImage2() {
  await createTestImage("valid-test-2.png", 100, 100, [0, 255, 0]);
}

async function createValidImage3() {
  await createTestImage("valid-test-3.png", 100, 100, [0, 0, 255]);
}

async function createInvalidTextFile() {
  await fs.writeFile(path.join(FIXTURES_DIR, "bad.txt"), "This is not an image");
}

async function createOversizeImage() {
  await createTestImage("oversized.png", 3000, 3000, [128, 128, 128]);
}

async function createTestZip() {
  const zip = new AdmZip();
  
  const manifest = {
    baselines: [
      {
        screenId: "zip-test-1",
        name: "Zip Test 1",
        url: "/test-1",
      },
      {
        screenId: "zip-test-2",
        name: "Zip Test 2",
        url: "/test-2",
      },
    ],
  };
  
  zip.addFile("baselines/manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  
  const png1 = new PNG({ width: 50, height: 50 });
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const idx = (50 * y + x) << 2;
      png1.data[idx] = 255;
      png1.data[idx + 1] = 100;
      png1.data[idx + 2] = 0;
      png1.data[idx + 3] = 255;
    }
  }
  zip.addFile("baselines/zip-test-1/baseline.png", PNG.sync.write(png1));
  
  const png2 = new PNG({ width: 50, height: 50 });
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const idx = (50 * y + x) << 2;
      png2.data[idx] = 0;
      png2.data[idx + 1] = 200;
      png2.data[idx + 2] = 255;
      png2.data[idx + 3] = 255;
    }
  }
  zip.addFile("baselines/zip-test-2/baseline.png", PNG.sync.write(png2));
  
  await fs.writeFile(path.join(FIXTURES_DIR, "test-baselines.zip"), zip.toBuffer());
}

async function main() {
  await createValidImage();
  await createValidImage2();
  await createValidImage3();
  await createInvalidTextFile();
  await createOversizeImage();
  await createTestZip();
  console.log("Test fixtures created successfully");
}

main().catch(console.error);
