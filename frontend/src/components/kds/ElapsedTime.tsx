'use client';

import { useEffect, useState } from 'react';
import { parseDbTimestamp } from '@/lib/utils';

export interface ElapsedInfo {
  formatted: string;
  totalMinutes: number;
  urgency: 'normal' | 'warning' | 'urgent';
}

export function getElapsedInfo(dateStr: string): ElapsedInfo {
  const timestamp = parseDbTimestamp(dateStr).getTime();
  if (!Number.isFinite(timestamp)) {
    return { formatted: '—', totalMinutes: 0, urgency: 'normal' };
  }
  const totalSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const formatted = hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;

  let urgency: 'normal' | 'warning' | 'urgent' = 'normal';
  if (totalMinutes >= 15) {
    urgency = 'urgent';
  } else if (totalMinutes >= 7) {
    urgency = 'warning';
  }

  return { formatted, totalMinutes, urgency };
}

/** Renders elapsed time for an order with a local 1-second tick,
 * avoiding parent re-renders every second. */
export function ElapsedTime({ dateStr }: { dateStr: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{getElapsedInfo(dateStr).formatted}</span>;
}

export function ElapsedBadge({ dateStr }: { dateStr: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const info = getElapsedInfo(dateStr);
  const styleMap = {
    normal: 'text-muted-foreground/80 bg-muted/40 border-border/60',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/30 font-medium',
    urgent: 'text-rose-500 bg-rose-500/15 border-rose-500/40 font-bold animate-pulse',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono border ${styleMap[info.urgency]}`}>
      {info.formatted}
    </span>
  );
}
