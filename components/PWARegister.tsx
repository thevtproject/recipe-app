"use client";

import { useEffect, useState, useCallback } from "react";

type SWRegistrationState = {
  /** Whether SW is supported in this browser */
  supported: boolean;
  /** Whether registration has completed (success or failure) */
  registered: boolean;
  /** Whether a new SW is waiting to activate */
  waiting: boolean;
  /** The waiting registration, if any */
  waitingRegistration: ServiceWorkerRegistration | null;
};

/**
 * Registers the service worker and exposes update state for PWAUpdatePrompt.
 * Renders nothing itself — children should consume the state or we expose via
 * a shared event mechanism.
 */
export default function PWARegister({ onUpdate }: { onUpdate?: () => void }) {
  const [state, setState] = useState<SWRegistrationState>({
    supported: false,
    registered: false,
    waiting: false,
    waitingRegistration: null,
  });

  const onUpdateCallback = useCallback(() => {
    onUpdate?.();
  }, [onUpdate]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setState((prev) => ({ ...prev, supported: false }));
      return;
    }

    setState((prev) => ({ ...prev, supported: true }));

    // Listen for controller change (SW activated after update)
    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        setState((prev) => ({
          ...prev,
          registered: true,
        }));

        // Check if there's already a waiting worker
        if (registration.waiting) {
          setState((prev) => ({
            ...prev,
            waiting: true,
            waitingRegistration: registration,
          }));
          onUpdateCallback();
        }

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New SW installed and waiting
              setState((prev) => ({
                ...prev,
                waiting: true,
                waitingRegistration: registration,
              }));
              onUpdateCallback();
            }
          });
        });
      })
      .catch((err) => {
        console.error("SW registration failed:", err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [onUpdateCallback]);

  // Store the waiting registration globally for PWAUpdatePrompt to access
  useEffect(() => {
    if (state.waitingRegistration) {
      (window as unknown as Record<string, unknown>)["__SW_WAITING_REGISTRATION"] = state.waitingRegistration;
    }
  }, [state.waitingRegistration]);

  return null;
}
