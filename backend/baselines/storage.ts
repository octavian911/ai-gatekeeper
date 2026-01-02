import { Bucket } from "encore.dev/storage/objects";

export const baselineImages = new Bucket("baseline-images", {
  public: true,
  versioned: true,
});
