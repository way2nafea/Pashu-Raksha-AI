"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing (e.g. unsupported browser, dev-mode quirks)
        // should never break the app — it just means no offline app-shell
        // caching this session. The rest of the app (offline queue,
        // connectivity badge) works independently of this.
      });
    }
  }, []);
  return null;
}
