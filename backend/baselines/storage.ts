import { Bucket } from "encore.dev/storage/objects";

export const baselineImages = new Bucket("baseline-images", {
  public: true,
  versioned: true,
});

export const exportZips = new Bucket("export-zips", {
  public: false,
  versioned: false,
});
