import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { exportZips } from "./storage";
import log from "encore.dev/log";

export const cleanupExpiredExportsEndpoint = api(
  { expose: false, method: "POST", path: "/baselines/cleanup-exports" },
  async (): Promise<{ deletedCount: number }> => {
    const cutoffTime = new Date(Date.now() - 15 * 60 * 1000);
    let deletedCount = 0;
    
    try {
      for await (const entry of exportZips.list({})) {
        const attrs = await exportZips.attrs(entry.name);
        
        if (attrs.name.endsWith(".zip")) {
          try {
            const uploadTimeStr = attrs.name.split('-').slice(0, 5).join('-');
            const uploadTime = new Date(uploadTimeStr);
            
            if (uploadTime < cutoffTime) {
              await exportZips.remove(entry.name);
              deletedCount++;
              log.info("Deleted expired export", { name: entry.name });
            }
          } catch (e) {
            log.warn("Failed to parse export timestamp", { name: entry.name, error: e });
          }
        }
      }
      
      if (deletedCount > 0) {
        log.info("Cleanup completed", { deletedCount });
      }
    } catch (error) {
      log.error("Export cleanup failed", { error });
    }
    
    return { deletedCount };
  }
);

export const cleanupExpiredExports = new CronJob("cleanup-expired-exports", {
  title: "Cleanup expired export ZIPs",
  schedule: "*/10 * * * *",
  endpoint: cleanupExpiredExportsEndpoint,
});
