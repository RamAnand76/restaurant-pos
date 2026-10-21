'use client';

import { usePathname } from 'next/navigation';
import AppSidebar from '@/components/layout/Sidebar';
import AuthGuard from '@/components/layout/AuthGuard';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import StatusBar from '@/components/layout/StatusBar';
import GlobalNotifications from '@/components/layout/GlobalNotifications';
import TitleBar from '@/components/layout/TitleBar';
import { usePrinterStatusSync } from '@/hooks/usePrinter';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Cloud, CloudOff } from 'lucide-react';

const subscribeOnline = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

const getOnlineSnapshot = () => !navigator.onLine;
const getServerSnapshot = () => false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The desktop export sets `trailingSlash`, so a direct load resolves to
  // '/pos/'. Normalize it or those routes fall back to page scrolling.
  const route = pathname?.replace(/\/+$/, '');
  const isPos = route === '/pos' || route === '/kds';
  const isSettings = route === '/settings';
  // Sync printer status early so hardware and WebUSB reconnect before first print.
  usePrinterStatusSync();

  const isOffline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <AuthGuard>
      <SidebarProvider
        defaultOpen
        className="flex h-screen min-h-0 flex-col w-full"
        style={{ minHeight: 0 }}
      >
        <TitleBar />
        <div className="flex min-h-0 flex-1 w-full overflow-hidden">
          <AppSidebar />
          <SidebarInset className="h-full min-h-0 overflow-hidden flex flex-col">
            {/* Consistent top header with permanent collapse trigger & offline/online indicators */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/80 bg-card/60 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger
                  className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Toggle navigation"
                />
                <img src="/tavroq-logo.png" alt="TAVROQ" className="size-5 object-contain" />
                <span className="text-xs font-bold text-foreground tracking-tight">TAVROQ</span>
                <span className="text-xs text-muted-foreground/40 font-light">/</span>
                <span className="text-xs font-medium text-muted-foreground">Terminal</span>
              </div>
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700/80 text-white text-xs font-medium tracking-tight shadow-sm transition-all">
                    <CloudOff className="size-3.5 text-neutral-300 stroke-[1.75]" />
                    <span>You&apos;re offline.</span>
                  </div>
                ) : showBackOnline ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium tracking-tight shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
                    <Cloud className="size-3.5 text-emerald-400 stroke-[2] drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    <span className="text-emerald-200">Welcome back online</span>
                  </div>
                ) : null}
              </div>
            </div>
            {!isPos && <GlobalNotifications />}
            <div
              className={
                isPos
                  ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-4'
                  : isSettings
                    ? 'flex-1 min-h-0 p-4 overflow-auto md:overflow-hidden min-w-0'
                    : 'flex-1 p-4 overflow-auto min-w-0'
              }
            >
              {children}
            </div>
            <StatusBar showUpdateBadge={false} />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
