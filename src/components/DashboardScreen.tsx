import React from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquareWarning,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { AppScreen, Complaint, Deduction, MoveInPhoto, PgStay } from "../types";
import { daysElapsed, formatDate, formatDateTime, formatINR } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface DashboardScreenProps {
  tenantName: string;
  pg: PgStay;
  photos: MoveInPhoto[];
  complaints: Complaint[];
  deductions: Deduction[];
  onNavigate: (screen: AppScreen) => void;
}

export function DashboardScreen({
  tenantName,
  pg,
  photos,
  complaints,
  deductions,
  onNavigate,
}: DashboardScreenProps) {
  const firstName = tenantName.trim().split(/\s+/)[0] || "there";

  const totalDeducted = deductions.reduce((sum, d) => sum + d.amount, 0);
  const disputableAmount = deductions
    .filter((d) => d.aiVerdict === "unfair")
    .reduce((sum, d) => sum + d.amount, 0);
  const depositAtRisk = totalDeducted > 0 ? totalDeducted : pg.depositAmount;

  const openComplaints = complaints.filter((c) => c.status === "open");
  const longestUnfixedDays =
    openComplaints.length > 0
      ? Math.max(...openComplaints.map((c) => daysElapsed(c.reportedAtMs)))
      : 0;

  const lockedPhotos = photos.filter((p) => p.locked);
  const unlockedPhotos = photos.filter((p) => !p.locked);
  const latestLockedAt =
    lockedPhotos.length > 0 ? Math.max(...lockedPhotos.map((p) => p.capturedAtMs)) : null;

  const recentComplaints = complaints.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Namaste, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {pg.roomNumber} · {pg.pgName} · Moved in {formatDate(pg.moveInDate)}
          </p>
        </div>

        <Button size="lg" onClick={() => onNavigate("claim")}>
          Start deposit claim
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">
            {totalDeducted > 0 ? "Deposit at risk" : "Protected deposit"}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
            {formatINR(depositAtRisk)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {totalDeducted > 0
              ? `Out of ${formatINR(pg.depositAmount)} paid`
              : "No move-out deductions logged"}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Open complaints</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
            {openComplaints.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {complaints.length} total logged
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Longest unfixed issue</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-amber-700 tabular-nums">
            {longestUnfixedDays} {longestUnfixedDays === 1 ? "day" : "days"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {openComplaints.length > 0 ? "Active unresolved timer" : "All logged issues resolved"}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Disputable amount</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-indigo-900 tabular-nums">
            {formatINR(disputableAmount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {disputableAmount > 0 ? "Flagged unfair by AI audit" : "Add deductions to audit"}
          </p>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Move-in Record Status */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Move-in record status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lockedPhotos.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">
                      Locked on {formatDateTime(latestLockedAt || undefined)}
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      {lockedPhotos.length} timestamped photo(s) protected as read-only proof.
                      {unlockedPhotos.length > 0
                        ? ` ${unlockedPhotos.length} additional photo(s) still unlocked.`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
            ) : photos.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-3">
                  <Unlock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-semibold text-amber-950">
                      {photos.length} photo(s) scanned — not locked yet
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Lock your move-in record to stamp server time and prevent future edits.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <Camera className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">No move-in scan yet</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Upload photos of the wall, bathroom, wardrobe, bed, and floor first.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" size="sm" onClick={() => onNavigate("scan")}>
                <Camera className="h-4 w-4" />
                {photos.length > 0 ? "Open move-in scan" : "Scan room now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("pg-setup")}>
                Edit PG details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Complaints */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>Recent complaints</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("complaints")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {recentComplaints.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <MessageSquareWarning className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-900">
                  No complaints logged yet
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Keep a dated trail whenever Wi-Fi, water, food, or hygiene breaks down.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onNavigate("complaints")}
                >
                  Log first complaint
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentComplaints.map((c) => {
                  const days = daysElapsed(c.reportedAtMs, c.fixedAtMs ?? Date.now());
                  return (
                    <div key={c.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold capitalize text-slate-900">
                          {c.category}
                        </span>
                        {c.status === "open" ? (
                          <span className="inline-flex items-center gap-1 font-mono font-medium text-amber-800 tabular-nums">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            Unfixed for {days}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Fixed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-700 line-clamp-2">{c.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claim Callout */}
      <Card className="p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-indigo-900" />
            <div>
              <h3 className="font-display text-base font-semibold text-slate-950">
                Moving out of {pg.pgName}?
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                Audit any owner deductions against your move-in photos and export a WhatsApp or PDF
                refund notice.
              </p>
            </div>
          </div>
          <Button variant="accent" onClick={() => onNavigate("claim")}>
            Start deposit claim
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
