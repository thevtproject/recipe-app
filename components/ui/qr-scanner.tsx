'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, CameraOff, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type QrScannerProps = {
  /** Called with the decoded string. Parent should handle navigation/submit. */
  onResult: (text: string) => void;
  /** Called when the user dismisses the scanner. */
  onClose?: () => void;
  className?: string;
};

/**
 * Camera-based QR scanner. Uses native BarcodeDetector where available,
 * falls back to WASM otherwise (qr-scanner handles this internally).
 *
 * UX states:
 *  - idle:    shows "Start camera" button
 *  - starting: spinner while requesting camera
 *  - denied:  clear message + browser-permission instructions
 *  - error:   generic error with retry
 *  - active:  live video feed with viewfinder overlay
 */
export function QrScannerView({ onResult, onClose, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  type Status = 'idle' | 'starting' | 'active' | 'denied' | 'unsupported' | 'error';
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Stop the camera stream on unmount so the LED doesn't stay on
  useEffect(() => {
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  async function start() {
    setStatus('starting');
    setErrMsg(null);

    // Quick capability check — BarcodeDetector not in all browsers
    const hasNative = await QrScanner.hasCamera();
    if (!hasNative) {
      setStatus('unsupported');
      return;
    }

    try {
      const scanner = new QrScanner(
        videoRef.current!,
        (result) => {
          // Got a hit — stop + bubble up
          scanner.stop();
          onResult(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // back camera on mobile
          returnDetailedScanResult: true,
        }
      );
      scannerRef.current = scanner;
      await scanner.start();
      setStatus('active');
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setStatus('denied');
      } else {
        setErrMsg(err instanceof Error ? err.message : 'Camera failed to start');
        setStatus('error');
      }
    }
  }

  function stop() {
    scannerRef.current?.stop();
    setStatus('idle');
  }

  // -------- render branches --------

  if (status === 'unsupported') {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-5 text-center space-y-2', className)}>
        <CameraOff className="mx-auto text-muted-foreground" size={32} />
        <p className="text-sm font-medium">Camera not available</p>
        <p className="text-xs text-muted-foreground">
          Your device or browser doesn't support camera scanning. Use the code entry
          option instead.
        </p>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
        )}
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-5 text-center space-y-2', className)}>
        <CameraOff className="mx-auto text-muted-foreground" size={32} />
        <p className="text-sm font-medium">Camera permission blocked</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Allow camera access in your browser settings, then tap "Start camera" again.
          On iOS Safari: Settings → Safari → Camera.
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <Button size="sm" onClick={start}>Start camera</Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={cn('rounded-lg border border-destructive/30 bg-card p-5 text-center space-y-2', className)}>
        <AlertCircle className="mx-auto text-destructive" size={32} />
        <p className="text-sm font-medium">Camera error</p>
        <p className="text-xs text-muted-foreground">{errMsg ?? 'Unknown error'}</p>
        <div className="flex gap-2 justify-center pt-1">
          <Button size="sm" onClick={start}>Try again</Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Back
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'active' || status === 'starting') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="relative overflow-hidden rounded-lg border border-border bg-black aspect-square max-w-sm mx-auto">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
              Starting camera…
            </div>
          )}
          {/* Viewfinder overlay — gives user a target to aim at */}
          {status === 'active' && (
            <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-lg" />
          )}
        </div>
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <p className="text-xs text-muted-foreground">
            Point your camera at the QR code.
          </p>
          <Button variant="outline" size="sm" onClick={onClose ?? stop} className="gap-1">
            <X size={14} />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className={cn('rounded-lg border border-border bg-card p-5 text-center space-y-3', className)}>
      <Camera className="mx-auto text-muted-foreground" size={32} />
      <div>
        <p className="text-sm font-medium">Scan a household QR code</p>
        <p className="text-xs text-muted-foreground mt-1">
          We'll use your camera to read the code. Nothing is uploaded.
        </p>
      </div>
      <div className="flex gap-2 justify-center">
        <Button size="sm" onClick={start} className="gap-1.5">
          <Camera size={14} />
          Start camera
        </Button>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
