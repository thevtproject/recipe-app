"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Displays an update banner when a new service worker is available.
 * The user can click to activate the update immediately.
 */
export default function PWAUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Check for existing waiting worker at registration time
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
      }
    });

    // Poll for waiting worker state (covers updates triggered by PWARegister)
    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
        if (reg?.waiting) {
          setWaitingWorker(reg.waiting);
        }
      });
    };

    checkForUpdate();
    const interval = setInterval(checkForUpdate, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;

    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    // The controllerchange listener will reload the page
  }, [waitingWorker]);

  if (!waitingWorker || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-lg border border-[#D6CEC4] bg-[#F5F0EB] px-4 py-3 shadow-lg">
        <p className="text-sm text-stone-700">
          📦 Update available
        </p>
        <button
          onClick={handleUpdate}
          className="rounded-md bg-[#A8956A] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#8f7d58]"
        >
          Refresh
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
