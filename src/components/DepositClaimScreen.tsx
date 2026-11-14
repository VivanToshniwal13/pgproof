import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { AppScreen, Deduction, MoveInPhoto, PgStay } from "../types";
import { formatDateTime, formatINR } from "../lib/utils";
import { evaluateDeductionsAI, EvaluatedDeductionResult } from "../lib/ai";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface DepositClaimScreenProps {
  pg: PgStay;
  photos: MoveInPhoto[];
  deductions: Deduction[];
  onAddEvaluatedDeduction: (result: EvaluatedDeductionResult) => Promise<void>;
  onUpdateEvaluatedDeduction: (
    deductionId: string,
    result: EvaluatedDeductionResult
  ) => Promise<void>;
  onDeleteDeduction: (deductionId: string) => Promise<void>;
  onNavigate: (screen: AppScreen) => void;
}

export function DepositClaimScreen({
  pg,
  photos,
  deductions,
  onAddEvaluatedDeduction,
  onUpdateEvaluatedDeduction,
  onDeleteDeduction,
  onNavigate,
}: DepositClaimScreenProps) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedPending, setFailedPending] = useState<{ reason: string; amount: number } | null>(
    null
  );
  const [zoomPhoto, setZoomPhoto] = useState<MoveInPhoto | null>(null);

  const totalDeducted = deductions.reduce((sum, d) => sum + d.amount, 0);
  const disputableAmount = deductions
    .filter((d) => d.aiVerdict === "unfair")
    .reduce((sum, d) => sum + d.amount, 0);
  const lockedCount = photos.filter((p) => p.locked).length;

  async function runAddDeduction(dedReason: string, dedAmount: number) {
    setError(null);
    setFailedPending(null);
    setAnalyzing(true);
    try {
      const results = await evaluateDeductionsAI({
        deductions: [{ reason: dedReason, amount: dedAmount }],
        moveInPhotos: photos,
      });
      const first = results[0];
      if (!first) {
        throw new Error("Gemini did not return an evaluation result. Please retry.");
      }
      await onAddEvaluatedDeduction({
        reason: dedReason,
        amount: dedAmount,
        aiVerdict: first.aiVerdict,
        aiReason: first.aiReason,
        matchedPhotoId: first.matchedPhotoId || "",
      });
      setReason("");
      setAmount("");
    } catch (err) {
      setFailedPending({ reason: dedReason, amount: dedAmount });
      setError(err instanceof Error ? err.message : "Could not evaluate deduction with Gemini.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 2) {
      setError("Please enter the deduction reason claimed by the owner.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 5000000) {
      setError("Please enter a valid positive deduction amount in ₹.");
      return;
    }

    await runAddDeduction(reason.trim(), amt);
  }

  async function handleReEvaluateAll() {
    if (deductions.length === 0) return;
    setError(null);
    setReEvaluating(true);
    try {
      const results = await evaluateDeductionsAI({
        deductions: deductions.map((d) => ({ id: d.id, reason: d.reason, amount: d.amount })),
        moveInPhotos: photos,
      });

      for (let i = 0; i < deductions.length; i++) {
        const res = results[i];
        if (res) {
          await onUpdateEvaluatedDeduction(deductions[i].id, res);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-evaluation failed. Please retry.");
    } finally {
      setReEvaluating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await onDeleteDeduction(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete deduction.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Deposit claim audit
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {pg.pgName} · {pg.roomNumber} · Cross-checking owner deductions against{" "}
            {photos.length} move-in {photos.length === 1 ? "photo" : "photos"} ({lockedCount} locked).
          </p>
        </div>

        {deductions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={reEvaluating || analyzing}
            onClick={handleReEvaluateAll}
          >
            {reEvaluating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-audit all with AI
          </Button>
        )}
      </div>

      {/* Big Summary Card */}
      <Card className="bg-indigo-950 text-white border-indigo-900">
        <CardContent className="p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-indigo-200">Total security deposit</p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                {formatINR(pg.depositAmount)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-indigo-200">Total owner deducted</p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                {formatINR(totalDeducted)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-amber-300">Amount you can dispute</p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight text-amber-300 tabular-nums sm:text-4xl">
                {formatINR(disputableAmount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Deduction Form */}
      <Card>
        <CardHeader>
          <CardTitle>Enter an owner deduction</CardTitle>
          <CardDescription>
            Gemini compares each charge against your move-in photos and damage tags to flag unfair
            or vague claims.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                  <span>{error}</span>
                </div>
                {failedPending && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runAddDeduction(failedPending.reason, failedPending.amount)}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Retry AI audit
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="space-y-1.5 sm:col-span-7">
                <Label htmlFor="deduction-reason">Deduction reason</Label>
                <Input
                  id="deduction-reason"
                  placeholder="e.g. Wall repainting for stain near switchboard"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="deduction-amount">Amount (₹)</Label>
                <Input
                  id="deduction-amount"
                  type="number"
                  min={1}
                  step="1"
                  placeholder="e.g. 4500"
                  className="tabular-nums"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button type="submit" className="w-full" disabled={analyzing}>
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {analyzing ? "Auditing..." : "Audit"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Deductions List */}
      {deductions.length === 0 ? (
        <Card className="p-10 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
            No deductions entered yet
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Add each deduction your PG owner listed at move-out to see which ones contradict your
            locked move-in photos.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {deductions.map((ded) => {
            const matchedPhoto = ded.matchedPhotoId
              ? photos.find((p) => p.id === ded.matchedPhotoId)
              : undefined;

            return (
              <Card key={ded.id} className="overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                  {/* Left: Deduction & Verdict */}
                  <div
                    className={`p-5 sm:p-6 flex flex-col justify-between gap-4 ${
                      matchedPhoto ? "lg:col-span-7" : "lg:col-span-12"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <VerdictBadge verdict={ded.aiVerdict} />
                        <span className="font-mono text-xl font-bold text-slate-950 tabular-nums">
                          {formatINR(ded.amount)}
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-slate-950">
                        {ded.reason}
                      </h3>

                      <p className="text-sm leading-relaxed text-slate-700">{ded.aiReason}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500">
                        {matchedPhoto
                          ? `Matched to ${matchedPhoto.roomArea} move-in photo`
                          : "No matching pre-existing move-in defect cited"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-500 hover:text-red-700"
                        disabled={deletingId === ded.id}
                        onClick={() => void handleDelete(ded.id)}
                      >
                        {deletingId === ded.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>

                  {/* Right: Side-by-side Matched Move-in Photo */}
                  {matchedPhoto && (
                    <div className="border-t border-slate-200 bg-slate-50/70 p-5 lg:col-span-5 lg:border-t-0 lg:border-l">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600 mb-3">
                        <span className="font-semibold capitalize text-slate-900">
                          Move-in proof · {matchedPhoto.roomArea}
                        </span>
                        {matchedPhoto.locked && (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setZoomPhoto(matchedPhoto)}
                        className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white cursor-pointer"
                      >
                        <img
                          src={matchedPhoto.photoUrl}
                          alt={`Move-in ${matchedPhoto.roomArea} evidence`}
                          referrerPolicy="no-referrer"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      </button>

                      <p className="mt-2.5 text-xs text-slate-500 tabular-nums">
                        {matchedPhoto.locked
                          ? `Locked on ${formatDateTime(matchedPhoto.capturedAtMs)}`
                          : `Captured ${formatDateTime(matchedPhoto.capturedAtMs)}`}
                      </p>

                      {matchedPhoto.aiDamageTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {matchedPhoto.aiDamageTags.map((tag, idx) => (
                            <span
                              key={`${ded.id}-tag-${idx}`}
                              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {deductions.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button size="lg" onClick={() => onNavigate("notices")}>
            Generate refund notices
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={Boolean(zoomPhoto)} onOpenChange={(o) => !o && setZoomPhoto(null)}>
        <DialogContent className="max-w-2xl">
          {zoomPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize">
                  Move-in proof · {zoomPhoto.roomArea}
                </DialogTitle>
                <DialogDescription>
                  {zoomPhoto.locked
                    ? `Locked on ${formatDateTime(zoomPhoto.capturedAtMs)}`
                    : `Captured ${formatDateTime(zoomPhoto.capturedAtMs)}`}
                </DialogDescription>
              </DialogHeader>
              <img
                src={zoomPhoto.photoUrl}
                alt={zoomPhoto.roomArea}
                referrerPolicy="no-referrer"
                className="w-full rounded-xl border border-slate-200 object-cover"
              />
              <p className="text-sm text-slate-700">{zoomPhoto.aiSummary}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Deduction["aiVerdict"] }) {
  if (verdict === "unfair") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
        <ShieldAlert className="h-3.5 w-3.5 text-red-700" />
        Unfair deduction
      </span>
    );
  }
  if (verdict === "fair") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
        Fair deduction
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      <HelpCircle className="h-3.5 w-3.5 text-amber-700" />
      Unclear — needs proof
    </span>
  );
}
