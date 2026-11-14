import React from "react";
import {
  Building2,
  Camera,
  FileText,
  Home,
  LogOut,
  MessageSquareWarning,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { AppScreen, PgStay } from "../types";
import { Button } from "./ui/button";

const NAV_ITEMS: Array<{ screen: AppScreen; label: string; mobileLabel: string; icon: React.ElementType }> = [
  { screen: "dashboard", label: "Home", mobileLabel: "Home", icon: Home },
  { screen: "scan", label: "Move-in Scan", mobileLabel: "Scan", icon: Camera },
  { screen: "complaints", label: "Complaints", mobileLabel: "Complaints", icon: MessageSquareWarning },
  { screen: "claim", label: "Deposit Claim", mobileLabel: "Claim", icon: ShieldCheck },
  { screen: "notices", label: "Notices", mobileLabel: "Notices", icon: FileText },
];

interface AppShellProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  pg: PgStay | null;
  tenantName: string;
  isDemo: boolean;
  isOffline: boolean;
  onSignOutOrExitDemo: () => void;
  children: React.ReactNode;
}

export function AppShell({
  activeScreen,
  onNavigate,
  pg,
  tenantName,
  isDemo,
  isOffline,
  onSignOutOrExitDemo,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <button
            type="button"
            onClick={() => onNavigate(pg ? "dashboard" : "pg-setup")}
            className="font-display text-xl font-bold tracking-tight text-indigo-950 cursor-pointer"
          >
            PGProof
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.screen;
            const disabled = !pg && item.screen !== "pg-setup";
            return (
              <button
                key={item.screen}
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(item.screen)}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? "bg-indigo-900 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate("pg-setup")}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                activeScreen === "pg-setup"
                  ? "bg-indigo-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{pg ? "PG details" : "Add your PG"}</span>
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="px-2">
            <p className="text-sm font-semibold text-slate-900 truncate">{tenantName}</p>
            {pg && (
              <p className="text-xs text-slate-500 truncate">
                {pg.roomNumber} · {pg.pgName}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onSignOutOrExitDemo}
          >
            <LogOut className="h-4 w-4" />
            {isDemo ? "Exit demo & sign up" : "Log out"}
          </Button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Compact Mobile Top Header (<= 52px) */}
        <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => onNavigate(pg ? "dashboard" : "pg-setup")}
            className="font-display text-lg font-bold tracking-tight text-indigo-950 whitespace-nowrap shrink-0 cursor-pointer"
          >
            PGProof
          </button>

          <div className="flex items-center gap-2">
            {pg && (
              <button
                type="button"
                onClick={() => onNavigate("pg-setup")}
                className="min-h-[40px] px-2.5 text-xs font-medium text-slate-600 hover:text-slate-950 cursor-pointer truncate max-w-[140px]"
              >
                {pg.pgName}
              </button>
            )}
            <button
              type="button"
              onClick={onSignOutOrExitDemo}
              aria-label={isDemo ? "Exit demo" : "Log out"}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Demo Mode & Offline Banners */}
        {isDemo && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-600 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                  DEMO DATA
                </span>
                <span>
                  Synthetic record for Riya Sharma · Room 204, Sunrise PG, Koramangala (separate
                  from real user accounts)
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOutOrExitDemo}
                className="font-semibold text-indigo-950 underline underline-offset-2 hover:text-indigo-800 cursor-pointer whitespace-nowrap"
              >
                Create real account
              </button>
            </div>
          </div>
        )}

        {isOffline && (
          <div
            role="status"
            className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900 sm:px-8"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-2">
              <WifiOff className="h-4 w-4 shrink-0 text-red-700" />
              <span>
                You appear to be offline. Photo uploads and Gemini analysis require an active
                connection.
              </span>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-12">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (5 tabs, 64px height, >=44px touch targets) */}
      {pg && (
        <nav
          aria-label="Mobile bottom navigation"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden pb-safe"
        >
          <div className="grid h-16 grid-cols-5 items-center">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeScreen === item.screen;
              return (
                <button
                  key={item.screen}
                  type="button"
                  onClick={() => onNavigate(item.screen)}
                  className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    active ? "text-indigo-900" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.25]" : "stroke-[1.75]"}`} />
                  <span className="text-[11px] font-medium leading-none tracking-tight">
                    {item.mobileLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
