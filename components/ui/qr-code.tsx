'use client';

import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

type QrCodeProps = {
  value: string;
  size?: number;
  className?: string;
  /** Optional caption shown beneath the QR */
  caption?: string;
};

/**
 * Static QR code display. SVG output — no canvas, no client-side JS to generate,
 * just inline SVG that scales cleanly. Background is forced white for max
 * scanner reliability (dark modules on light = best contrast).
 */
export function QrCode({ value, size = 192, className, caption }: QrCodeProps) {
  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-border">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#1c1917" /* stone-900 */
        />
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
