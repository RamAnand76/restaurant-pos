'use client';

import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Hourglass,
  LayoutGrid,
  Lock,
  Minus,
  ReceiptText,
  RotateCcw,
  Tags,
  Timer,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations, useLocale, type AppConfig } from 'use-intl';
import { Ltr } from '@/components/layout/Ltr';
import { CashCloseModal } from '@/components/dashboard/CashCloseModal';
import { useCashClose } from '@/hooks/useCashClose';
import toast from 'react-hot-toast';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useFormatDate } from '@/hooks/useFormatDate';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PAYMENT_METHODS } from '@/lib/payment-methods';
import { ORDER_STATUS_LABEL_KEYS } from '@/lib/i18n-enums';
import { splitHoursMinutes } from '@/lib/table-timing';
import { tenantCan } from '@/lib/permissions';
import { businessDateForInstant } from '@shared/business-date';
import { downloadBlob } from '@/lib/download';

interface PaymentMethodBreakdown {
  method: string | null;
  count: number;
  total: number;
}

interface DailyStats {
  sales: number;
  runningOrders: number;
  pendingOrders: number;
  tablesOccupied: number;
  avgTableTurnMinutes?: number | null;
  paymentMethods: PaymentMethodBreakdown[];
}

interface DaySummary {
  date: string;
  orders: { count: number; total: number };
  bills: { count: number; total: number; collected: number };
  customers: { new: number };
  paymentMethods: PaymentMethodBreakdown[];
}

interface RefundActivity {
  id: number;
  amount: number;
  method: string;
  reason: string | null;
  created_at: string;
  bill_number: string;
  paid_at: string;
  order_number: string;
  approved_by_name: string;
}

interface FinancialSummary {
  startDate: string;
  endDate: string;
  grossCollected: number;
  refunded: number;
  netCollected: number;
  billCount: number;
  refundCount: number;
  averageOrderValue: number;
  paymentMethods: PaymentMethodBreakdown[];
  refunds: RefundActivity[];
}

interface TopProduct {
  product_id: number;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

interface RecentOrder {
  id: number;
  order_number: string;
  status: string;
  total: number;
  customer_name: string | null;
  table_name: string | null;
  created_at: string;
}

interface TopStaff {
  user_id: string;
  name: string;
  role: string;
  revenue: number;
  orderCount: number;
}

interface TopCategory {
  category_id: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

interface HourBucket {
  hour: number;
  orderCount: number;
}

interface DayBucket {
  dayIndex: number;
  orderCount: number;
}

interface Insights {
  windowDays: number;
  aov: number;
  avgPrepTimeMinutes: number | null;
  topStaff: TopStaff[];
  topCategories: TopCategory[];
  busiestHour: HourBucket | null;
  idlestHour: HourBucket | null;
  busiestDayOfWeek: DayBucket | null;
  idlestDayOfWeek: DayBucket | null;
}

interface WeeklyComparison {
  sales: number;
  averageOrderValue: number;
}

interface DashboardTile {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  iconBg: string;
  href: string;
  comparison?: ReactNode;
  meta?: string;
}

interface DashboardMetric {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  comparison?: ReactNode;
}

function getMonthRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Formats a 0-23 local hour index as a locale-appropriate time label (e.g. "2 PM"). */
function formatHourLabel(hour: number, locale: string): string {
  const reference = new Date(Date.UTC(2000, 0, 1, hour));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' }).format(reference);
}

/** Formats a 0=Sunday..6=Saturday index as a locale-appropriate weekday name. */
function formatWeekdayLabel(dayIndex: number, locale: string): string {
  // Reference Sunday date for locale weekday formatting.
  const reference = new Date(2000, 0, 2 + dayIndex);
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(reference);
}

const orderStatusColor: Record<string, string> = {
  pending: 'text-yellow-600 dark:text-yellow-400',
  preparing: 'text-blue-600 dark:text-blue-400',
  ready: 'text-green-600 dark:text-green-400',
  served: 'text-purple-600 dark:text-purple-400',
  completed: 'text-muted-foreground',
  cancelled: 'text-red-500 dark:text-red-400',
};

type OrdersKey = keyof AppConfig['Messages']['orders'];
type PosKey = keyof AppConfig['Messages']['pos'];

// Built-in payment method label keys mapped to typed `pos` leaf keys.
const BUILT_IN_PAYMENT_KEYS = {
  cash: 'methodCash',
  card: 'methodCard',
} as const satisfies Record<'cash' | 'card', PosKey>;

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { currentTenant } = useAuthStore();
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tPos = useTranslations('pos');
  const tOrders = useTranslations('orders');
  const router = useRouter();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [weeklyComparison, setWeeklyComparison] = useState<WeeklyComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const isOwner = tenantCan(currentTenant, 'dashboard.view');
  const canViewFinancials = tenantCan(currentTenant, 'reports.financial.view');
  const fmt = useFormatCurrency();
  // Financial figures require `reports.financial.view`, independently of `dashboard.view`;
  // mask them instead of showing a misleading zero when that permission isn't granted.
  const fmtFinancial = (value: number): string => (canViewFinancials ? fmt(value) : '—');
  const numFinancial = (value: number): string | number => (canViewFinancials ? value : '—');
  const { formatDateTime } = useFormatDate();
  const locale = useLocale();
  const timeZone = currentTenant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The store's business day starts at its configured time, not at midnight, so
  // the day picker and its upper bound follow the same rule the cash-close modal
  // and the drawer movements use instead of the plain tenant-local date.
  const todayLocal = businessDateForInstant({
    instant: new Date(),
    timezone: timeZone,
    startTime: currentTenant?.business_day_start_time || '00:00',
  });
  const [selectedDate, setSelectedDate] = useState(todayLocal);
  const [selectedMonth, setSelectedMonth] = useState(todayLocal.slice(0, 7));
  const [periodMode, setPeriodMode] = useState<'day' | 'month'>('day');
  const dayInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const isToday = periodMode === 'day' && selectedDate === todayLocal;
  const range =
    periodMode === 'month'
      ? getMonthRange(selectedMonth)
      : { startDate: selectedDate, endDate: selectedDate };

  /** Opens Chromium's native calendar UI while preserving keyboard fallback. */
  const openPicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Older embedded Chromium builds may not expose showPicker. Focusing the
      // native input still leaves keyboard date entry available.
      input.focus();
    }
  };

  useEffect(() => {
    if (currentTenant && !isOwner) {
      router.replace('/pos');
    }
  }, [currentTenant, isOwner, router]);

  // Reset loading state during render when query parameters change.
  const syncKey = `${isOwner}:${periodMode}:${range.startDate}:${range.endDate}`;
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    if (isOwner) setLoading(true);
  }

  useEffect(() => {
    if (!isOwner) return;
    const controller = new AbortController();
    const dailyStatsRequest = isToday
      ? api.get('/reports/daily-stats', { signal: controller.signal })
      : Promise.resolve(null);
    const scopedSummary =
      periodMode === 'month'
        ? Promise.resolve(null)
        : api.get('/reports/summary', {
            params: { date: selectedDate },
            signal: controller.signal,
          });
    const previousWeekDate = shiftDate(selectedDate, -7);
    const comparisonRequest =
      periodMode === 'day' && canViewFinancials
        ? api
            .get('/reports/financial-summary', {
              params: { start_date: previousWeekDate, end_date: previousWeekDate },
              signal: controller.signal,
            })
            .then((res) => ({
              sales: Number(res.data.financialSummary?.netCollected ?? 0),
              averageOrderValue: Number(res.data.financialSummary?.averageOrderValue ?? 0),
            }))
            .catch((err: unknown) => {
              if (
                err instanceof Error &&
                (err.name === 'CanceledError' || err.name === 'AbortError')
              )
                throw err;
              return null;
            })
        : Promise.resolve(null);
    // `dashboard.view` and `reports.financial.view` are independently configurable, so an
    // owner may grant one without the other. Skip the financial-summary call entirely in
    // that case rather than letting its 403 reject the whole Promise.all and blank the tiles
    // (running orders, tables, top products, ...) that only need `dashboard.view`.
    const financialSummaryRequest = canViewFinancials
      ? api.get('/reports/financial-summary', {
          params: { start_date: range.startDate, end_date: range.endDate },
          signal: controller.signal,
        })
      : Promise.resolve(null);
    Promise.all([
      dailyStatsRequest,
      scopedSummary,
      financialSummaryRequest,
      api.get('/reports/topProducts', {
        params: { start_date: range.startDate, end_date: range.endDate, limit: 5 },
        signal: controller.signal,
      }),
      api.get('/reports/recentOrders', {
        params:
          periodMode === 'month'
            ? { start_date: range.startDate, end_date: range.endDate, limit: 6 }
            : { date: selectedDate, limit: 6 },
        signal: controller.signal,
      }),
      api.get('/reports/insights', { params: { days: 30 }, signal: controller.signal }),
      comparisonRequest,
    ])
      .then(
        ([statsRes, summaryRes, financialRes, topRes, recentRes, insightsRes, comparisonRes]) => {
          setStats(statsRes?.data ?? null);
          setDaySummary(summaryRes?.data?.summary ?? null);
          setFinancialSummary(financialRes?.data.financialSummary ?? null);
          setTopProducts(topRes.data.topProducts || []);
          setRecentOrders(recentRes.data.recentOrders || []);
          setInsights(insightsRes.data);
          setWeeklyComparison(comparisonRes);
        },
      )
      .catch((err: unknown) => {
        if (err instanceof Error && (err.name === 'CanceledError' || err.name === 'AbortError'))
          return;
        toast.error(tCommon('somethingWrong'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, canViewFinancials, periodMode, selectedDate, selectedMonth]);

  // Day-close wizard lives in useCashClose + CashCloseModal; the page
  // only opens it and mounts it.
  const cashClose = useCashClose();
  const { openCloseModal } = cashClose;
  const cashCloseAction = searchParams.get('action');
  const requestedCashCloseView = searchParams.get('view');
  const cashCloseView =
    requestedCashCloseView === 'x-report' || requestedCashCloseView === 'z-report'
      ? requestedCashCloseView
      : null;
  useEffect(() => {
    if (cashCloseAction !== 'cash-close') return;
    openCloseModal(cashCloseView);
    router.replace('/dashboard', { scroll: false });
  }, [cashCloseAction, cashCloseView, openCloseModal, router]);

  const exportDailySales = async (format: 'xlsx' | 'csv') => {
    if (periodMode !== 'day' || isExporting) return;
    setIsExporting(true);
    try {
      if (format === 'xlsx') {
        const res = await api.get('/reports/daily-sales/export', {
          params: { date: selectedDate, format: 'xlsx' },
          responseType: 'blob',
        });
        downloadBlob(res.data as Blob, `daily-sales-${selectedDate}.xlsx`);
        return;
      }
      toast(t('exportCsvStarted'));
      for (const part of ['summary', 'items'] as const) {
        const res = await api.get('/reports/daily-sales/export', {
          params: { date: selectedDate, format: 'csv', part },
          responseType: 'blob',
        });
        downloadBlob(res.data as Blob, `daily-sales-${selectedDate}-${part}.csv`);
      }
    } catch {
      toast.error(tCommon('downloadFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOwner) return null;

  const paymentMethods = financialSummary?.paymentMethods ?? [];
  const paymentMethodsTotal = paymentMethods.reduce((sum, pm) => sum + Number(pm.total), 0);

  const getComparisonBadge = (current: number, previous: number) => {
    const difference = current - previous;
    const direction = difference === 0 ? 'flat' : difference > 0 ? 'up' : 'down';
    const percent =
      previous === 0 ? null : Math.round((Math.abs(difference) / Math.abs(previous)) * 100);
    const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
    const label =
      difference === 0
        ? t('kpiNoChangeVsSameDayLastWeek')
        : previous === 0
          ? t('kpiNewVsSameDayLastWeek')
          : t('kpiChangeVsSameDayLastWeek', {
              percent: `${direction === 'down' ? '-' : direction === 'up' ? '+' : ''}${percent}`,
            });
    const tone =
      direction === 'up'
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        : direction === 'down'
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          : 'bg-muted text-muted-foreground border border-border/60';
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${tone}`}
      >
        <Icon size={12} />
        {label}
      </span>
    );
  };

  const salesComparison = weeklyComparison
    ? getComparisonBadge(financialSummary?.netCollected ?? 0, weeklyComparison.sales)
    : null;
  const aovComparison = weeklyComparison
    ? getComparisonBadge(
        financialSummary?.averageOrderValue ?? 0,
        weeklyComparison.averageOrderValue,
      )
    : null;
  const primaryTiles: DashboardTile[] =
    periodMode === 'month'
      ? [
          {
            label: t('netCollections'),
            value: fmtFinancial(financialSummary?.netCollected ?? 0),
            icon: Banknote,
            color:
              'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/30',
            iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
            href: '/orders',
          },
          {
            label: t('grossCollections'),
            value: fmtFinancial(financialSummary?.grossCollected ?? 0),
            icon: TrendingUp,
            color: 'border-blue-200 bg-blue-50/80 dark:border-blue-800/50 dark:bg-blue-950/30',
            iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
            href: '/orders',
          },
          {
            label: t('billsCollected'),
            value: numFinancial(financialSummary?.billCount ?? 0),
            icon: ReceiptText,
            color:
              'border-violet-200 bg-violet-50/80 dark:border-violet-800/50 dark:bg-violet-950/30',
            iconBg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
            href: '/orders',
          },
          {
            label: t('refunds'),
            value: fmtFinancial(financialSummary?.refunded ?? 0),
            icon: RotateCcw,
            color: 'border-red-200 bg-red-50/80 dark:border-red-800/50 dark:bg-red-950/30',
            iconBg: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
            href: '/orders',
          },
        ]
      : isToday
        ? [
            {
              label: t('todaySales'),
              value: fmtFinancial(financialSummary?.netCollected ?? 0),
              comparison: salesComparison,
              icon: Banknote,
              color:
                'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/30',
              iconBg:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
              href: '/orders',
            },
            {
              label: t('runningOrders'),
              value: stats?.runningOrders ?? 0,
              meta: t('liveNow'),
              icon: ChefHat,
              color: 'border-blue-200 bg-blue-50/80 dark:border-blue-800/50 dark:bg-blue-950/30',
              iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
              href: '/orders',
            },
            {
              label: t('pendingOrders'),
              value: stats?.pendingOrders ?? 0,
              meta: t('liveNow'),
              icon: Clock,
              color:
                'border-amber-200 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/30',
              iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
              href: '/orders',
            },
            {
              label: t('tablesOccupied'),
              value: stats?.tablesOccupied ?? 0,
              meta: t('liveNow'),
              icon: LayoutGrid,
              color:
                'border-violet-200 bg-violet-50/80 dark:border-violet-800/50 dark:bg-violet-950/30',
              iconBg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
              href: '/tables',
            },
          ]
        : [
            {
              label: t('sales'),
              value: fmtFinancial(financialSummary?.netCollected ?? 0),
              comparison: salesComparison,
              icon: Banknote,
              color:
                'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/30',
              iconBg:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
              href: '/orders',
            },
            {
              label: t('orders'),
              value: daySummary?.orders.count ?? 0,
              icon: ClipboardList,
              color: 'border-blue-200 bg-blue-50/80 dark:border-blue-800/50 dark:bg-blue-950/30',
              iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
              href: '/orders',
            },
            {
              label: t('newCustomers'),
              value: daySummary?.customers.new ?? 0,
              icon: Trophy,
              color:
                'border-amber-200 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/30',
              iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
              href: '/customers',
            },
            {
              label: t('billsCollected'),
              value: numFinancial(financialSummary?.billCount ?? 0),
              icon: ReceiptText,
              color:
                'border-violet-200 bg-violet-50/80 dark:border-violet-800/50 dark:bg-violet-950/30',
              iconBg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
              href: '/orders',
            },
          ];

  const secondaryMetrics: DashboardMetric[] =
    periodMode === 'day' && isToday
      ? [
          {
            label: t('avgTableTurn'),
            value:
              stats?.avgTableTurnMinutes != null
                ? (() => {
                    const { h, m } = splitHoursMinutes(stats.avgTableTurnMinutes);
                    return h > 0
                      ? tCommon('timeHoursMinutes', { h, m })
                      : tCommon('timeMinutes', { m });
                  })()
                : '—',
            icon: Hourglass,
            iconBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
          },
          {
            label: t('aov'),
            value: fmtFinancial(financialSummary?.averageOrderValue ?? 0),
            comparison: aovComparison,
            icon: TrendingUp,
            iconBg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
          },
          {
            label: t('avgPrepTime'),
            value:
              insights?.avgPrepTimeMinutes != null
                ? t('minutesValue', { minutes: insights.avgPrepTimeMinutes })
                : '—',
            icon: Timer,
            iconBg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
          },
        ]
      : [];

  return (
    <div className="min-h-full bg-background flex flex-col">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {periodMode === 'month'
              ? t('selectMonth')
              : 'Restaurant operations, shift status & sales performance'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2.5 xl:justify-end">
          {periodMode === 'day' ? (
            <div className="relative">
              <input
                ref={dayInputRef}
                type="date"
                value={selectedDate}
                max={todayLocal}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-border/80 bg-card ps-3 pe-9 text-xs font-medium text-foreground shadow-2xs [color-scheme:light] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:pointer-events-none [&::-webkit-calendar-picker-indicator]:opacity-0 font-mono"
                aria-label={t('selectDate')}
              />
              <button
                type="button"
                onClick={() => openPicker(dayInputRef.current)}
                className="absolute inset-y-0 end-0 z-10 flex w-8 items-center justify-center rounded-e-xl text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                aria-label={t('openDatePicker')}
              >
                <CalendarDays size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                ref={monthInputRef}
                type="month"
                value={selectedMonth}
                max={todayLocal.slice(0, 7)}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-border/80 bg-card ps-3 pe-9 text-xs font-medium text-foreground shadow-2xs [color-scheme:light] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:pointer-events-none [&::-webkit-calendar-picker-indicator]:opacity-0 font-mono"
                aria-label={t('selectMonth')}
              />
              <button
                type="button"
                onClick={() => openPicker(monthInputRef.current)}
                className="absolute inset-y-0 end-0 z-10 flex w-8 items-center justify-center rounded-e-xl text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                aria-label={t('openMonthPicker')}
              >
                <CalendarDays size={14} />
              </button>
            </div>
          )}

          {/* Segmented view mode toggle */}
          <div
            className="flex h-9 rounded-xl border border-border/80 bg-muted/60 p-0.5 shadow-2xs"
            role="group"
            aria-label={t('periodView')}
          >
            {(['day', 'month'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPeriodMode(mode)}
                className={`min-w-14 rounded-lg px-3 text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                  periodMode === mode
                    ? 'bg-card text-foreground shadow-xs border border-border/70'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={periodMode === mode}
              >
                {t(mode)}
              </button>
            ))}
          </div>

          <span className="mx-1 hidden h-5 w-px bg-border/80 xl:block" aria-hidden="true" />

          {/* Action buttons */}
          <Button
            type="button"
            onClick={() => cashClose.openCloseModal()}
            className="h-9 rounded-xl px-4 text-xs font-semibold tracking-tight shadow-sm cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Lock size={13} className="me-1" />
            {t('closeShift')}
          </Button>
          {periodMode === 'day' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isExporting}
                  className="h-9 rounded-xl px-3.5 text-xs font-semibold tracking-tight bg-card border-border/80 shadow-2xs cursor-pointer hover:bg-muted/60"
                  title={t('exportSales')}
                >
                  <Download size={13} className="me-1" />
                  {t('exportSales')}
                  <ChevronDown size={13} className="ms-1 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-xl border-border/80 shadow-md"
              >
                <DropdownMenuItem
                  onSelect={() => exportDailySales('xlsx')}
                  className="text-xs font-medium cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="me-2 text-emerald-500" />
                  {t('exportXlsx')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => exportDailySales('csv')}
                  className="text-xs font-medium cursor-pointer"
                >
                  <FileText size={14} className="me-2 text-blue-500" />
                  {t('exportCsv')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <CashCloseModal model={cashClose} />

      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">{tCommon('loading')}</span>
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              aria-hidden="true"
              className="h-36 animate-pulse rounded-2xl border border-border bg-card/70"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Financial Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {primaryTiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs p-5 shadow-xs transition-all hover:border-border hover:bg-card/90 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {tile.label}
                  </span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/60 shadow-2xs group-hover:border-primary/40 group-hover:text-primary transition-all">
                    <tile.icon size={16} />
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                    {tile.value}
                  </p>
                  <div className="mt-3 flex items-center min-h-5">
                    {tile.comparison ? (
                      tile.comparison
                    ) : tile.meta ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {tile.meta}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {secondaryMetrics.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {secondaryMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs p-4.5 shadow-xs hover:border-border hover:bg-card/90 transition-all"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                    <metric.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {metric.label}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xl font-bold text-foreground font-mono">{metric.value}</p>
                      {metric.comparison}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Recent Orders */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                    <ClipboardList size={15} />
                  </span>
                  <h2 className="font-semibold text-foreground text-sm">
                    {isToday
                      ? t('recentOrders')
                      : periodMode === 'month'
                        ? t('monthOrders')
                        : t('orders')}
                  </h2>
                </div>
                <Link
                  href="/orders"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                >
                  {t('viewAll')} <ArrowRight size={12} className="rtl-flip" />
                </Link>
              </div>
              {recentOrders.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <ClipboardList size={23} />
                  </span>
                  <p className="text-sm font-medium text-foreground">{t('noOrdersYet')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href="/orders"
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            #<Ltr>{order.order_number}</Ltr>
                          </span>
                          <span
                            className={`text-xs font-medium ${orderStatusColor[order.status] || 'text-muted-foreground'}`}
                          >
                            {(() => {
                              const k = (
                                ORDER_STATUS_LABEL_KEYS as Record<string, OrdersKey | undefined>
                              )[order.status];
                              return k ? tOrders(k) : order.status;
                            })()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.customer_name || order.table_name || t('walkIn')}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {fmt(Number(order.total))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Top Products Today */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                    <TrendingUp size={15} />
                  </span>
                  <h2 className="font-semibold text-foreground text-sm">
                    {periodMode === 'month'
                      ? t('topProductsMonth')
                      : isToday
                        ? t('topProductsToday')
                        : t('topProducts')}
                  </h2>
                </div>
                <Link
                  href="/products"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                >
                  {t('viewAll')} <ArrowRight size={12} className="rtl-flip" />
                </Link>
              </div>
              {topProducts.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                  <span className="mb-2.5 flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground/70 border border-border/40">
                    <TrendingUp size={18} />
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">{t('noSalesYet')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {topProducts.map((product) => (
                    <div
                      key={product.product_id}
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">
                          {product.product_name}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {t('productSoldOrders', {
                            quantity: product.total_quantity,
                            orders: product.order_count,
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground font-mono shrink-0">
                        {fmt(Number(product.total_revenue))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Top Staff */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                    <Trophy size={15} />
                  </span>
                  <h2 className="font-semibold text-foreground text-sm">{t('topStaff')}</h2>
                </div>
                <Link
                  href="/staff"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                >
                  {t('viewAll')} <ArrowRight size={12} className="rtl-flip" />
                </Link>
              </div>
              {(insights?.topStaff.length ?? 0) === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                  <span className="mb-2.5 flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground/70 border border-border/40">
                    <Trophy size={18} />
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">{t('noSalesYet')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {insights!.topStaff.map((staff) => (
                    <div
                      key={staff.user_id}
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">{staff.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {t('staffOrderCount', { orders: staff.orderCount })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground font-mono shrink-0">
                        {fmt(Number(staff.revenue))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Categories */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                    <Tags size={15} />
                  </span>
                  <h2 className="font-semibold text-foreground text-sm">{t('topCategories')}</h2>
                </div>
                <Link
                  href="/products"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                >
                  {t('viewAll')} <ArrowRight size={12} className="rtl-flip" />
                </Link>
              </div>
              {(insights?.topCategories.length ?? 0) === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                  <span className="mb-2.5 flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground/70 border border-border/40">
                    <Tags size={18} />
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">{t('noSalesYet')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {insights!.topCategories.map((category) => (
                    <div
                      key={category.category_id ?? category.name}
                      className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">{category.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {t('categoryQuantitySold', { quantity: category.quantity })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground font-mono shrink-0">
                        {fmt(Number(category.revenue))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {periodMode === 'month' && canViewFinancials && (
            <section className="mt-5 overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="flex items-center gap-2.5 font-semibold text-foreground text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-2xs">
                      <RotateCcw size={15} />
                    </span>
                    {t('refundActivity')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">{t('refundActivityHint')}</p>
                </div>
                <span className="text-sm font-semibold text-rose-500 font-mono">
                  {fmt(financialSummary?.refunded ?? 0)}
                </span>
              </div>
              {(financialSummary?.refunds.length ?? 0) === 0 ? (
                <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{t('noRefunds')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {financialSummary!.refunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold text-foreground">
                            {t('refundReference', {
                              bill: refund.bill_number,
                              order: refund.order_number,
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground">{refund.method}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('refundApproved', { name: refund.approved_by_name })}
                          {' · '}
                          {t('refundedAt', { date: formatDateTime(refund.created_at) })}
                          {' · '}
                          {t('collectedAt', { date: formatDateTime(refund.paid_at) })}
                        </p>
                        {refund.reason && (
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            {refund.reason}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-rose-500 font-mono sm:text-end">
                        {fmt(-Number(refund.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Payment Methods */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                  <Wallet size={15} />
                </span>
                <h2 className="font-semibold text-foreground text-sm">{t('paymentMethods')}</h2>
              </div>
              <div className="p-5">
                {paymentMethods.length === 0 ? (
                  <div className="flex min-h-36 flex-col items-center justify-center text-center">
                    <span className="mb-2.5 flex size-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground/70 border border-border/40">
                      <Wallet size={18} />
                    </span>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('noPaymentsYet')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentMethods.map((pm) => {
                      const meta = PAYMENT_METHODS.find((m) => m.key === pm.method);
                      const Icon = meta?.icon ?? Wallet;
                      const label = meta
                        ? tPos(BUILT_IN_PAYMENT_KEYS[meta.key])
                        : pm.method === 'wallet'
                          ? tPos('methodWallet')
                          : String(pm.method || tCommon('unknown'));
                      const percent =
                        paymentMethodsTotal > 0
                          ? Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round((Number(pm.total) / paymentMethodsTotal) * 100),
                              ),
                            )
                          : 0;
                      return (
                        <div key={pm.method ?? 'unknown'}>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <Icon size={14} className="text-muted-foreground" />
                              <span className="truncate text-sm font-medium text-foreground">
                                {label}
                              </span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-foreground font-mono">
                              {fmt(Number(pm.total))}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground font-mono">
                              {t('paymentMethodCount', { count: pm.count, percent })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Business Patterns */}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xs shadow-xs">
              <div className="border-b border-border/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted/80 text-foreground border border-border/60 shadow-2xs">
                    <BarChart3 size={15} />
                  </span>
                  <div>
                    <h2 className="font-semibold text-foreground text-sm">
                      {t('businessPatterns')}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('businessPatternsHint', { days: insights?.windowDays ?? 30 })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
                <div className="bg-card/70 p-4 transition-colors hover:bg-card/90">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('busiestHour')}
                  </p>
                  <p className="mt-2 text-base font-bold text-foreground font-mono">
                    {insights?.busiestHour
                      ? formatHourLabel(insights.busiestHour.hour, locale)
                      : t('notEnoughData')}
                  </p>
                  {insights?.busiestHour && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('ordersCount', { count: insights.busiestHour.orderCount })}
                    </p>
                  )}
                </div>
                <div className="bg-card/70 p-4 transition-colors hover:bg-card/90">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('idlestHour')}
                  </p>
                  <p className="mt-2 text-base font-bold text-foreground font-mono">
                    {insights?.idlestHour
                      ? formatHourLabel(insights.idlestHour.hour, locale)
                      : t('notEnoughData')}
                  </p>
                  {insights?.idlestHour && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('ordersCount', { count: insights.idlestHour.orderCount })}
                    </p>
                  )}
                </div>
                <div className="bg-card/70 p-4 transition-colors hover:bg-card/90">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('busiestDay')}
                  </p>
                  <p className="mt-2 text-base font-bold text-foreground font-mono">
                    {insights?.busiestDayOfWeek
                      ? formatWeekdayLabel(insights.busiestDayOfWeek.dayIndex, locale)
                      : t('notEnoughData')}
                  </p>
                  {insights?.busiestDayOfWeek && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('ordersCount', { count: insights.busiestDayOfWeek.orderCount })}
                    </p>
                  )}
                </div>
                <div className="bg-card/70 p-4 transition-colors hover:bg-card/90">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('idlestDay')}
                  </p>
                  <p className="mt-2 text-base font-bold text-foreground font-mono">
                    {insights?.idlestDayOfWeek
                      ? formatWeekdayLabel(insights.idlestDayOfWeek.dayIndex, locale)
                      : t('notEnoughData')}
                  </p>
                  {insights?.idlestDayOfWeek && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('ordersCount', { count: insights.idlestDayOfWeek.orderCount })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
