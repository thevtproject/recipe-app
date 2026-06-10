"use client";

import { useEffect, useState } from "react";

/**
 * Displays a subtle banner when the user goes offline.
 * Auto-hides when connectivity returns.
 */
export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 border-b border-amber-200">
        <span className="text-base" role="img" aria-label="offline">
          📡
        </span>
        <span>
          You&apos;re offline — showing cached content
        </span>
      </div>
    </div>
  );
}
