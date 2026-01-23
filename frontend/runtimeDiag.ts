/* AIGK_RUNTIME_DIAG: show runtime crashes instead of blank white screen */
(() => {
  if (typeof window === "undefined") return;
  const esc = (s: string) => s.replace(/</g, "&lt;");
  const render = (label: string, err: any) => {
    try {
      const raw = err && (err.stack || err.message) ? (err.stack || err.message) : String(err || "Unknown error");
      const safe = esc(raw);
      const preOpen = "<pre style=\"white-space:pre-wrap;word-break:break-word;padding:16px;margin:0;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;background:#0b0b0b;color:#eaeaea\">";
      const preClose = "</pre>";
      const body = preOpen + String(label) + "\n\n" + String(safe) + preClose;
      document.body.innerHTML = body;
    } catch (_e) {}
  };
  window.addEventListener("error", (e: any) => render("WINDOW.ERROR", (e && (e.error || e.message))));
  window.addEventListener("unhandledrejection", (e: any) => render("UNHANDLED.REJECTION", (e && e.reason)));
})();
