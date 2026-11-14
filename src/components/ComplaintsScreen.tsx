import React, { useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquareWarning,
  Plus,
  X,
} from "lucide-react";
import { Complaint, ComplaintCategory, ComplaintStatus, PgStay } from "../types";
import { daysElapsed, formatDate, validateAndPrepareImage } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const CATEGORIES: Array<{ value: ComplaintCategory; label: string }> = [
  { value: "food", label: "Food" },
  { value: "hygiene", label: "Hygiene" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "water", label: "Water" },
  { value: "power", label: "Power" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
];

interface ComplaintsScreenProps {
  pg: PgStay;
  complaints: Complaint[];
  onAddComplaint: (params: {
    complaintId: string;
    category: ComplaintCategory;
    description: string;
    photo?: { blob: Blob; mimeType: string; previewUrl: string };
  }) => Promise<void>;
  onMarkFixed: (complaintId: string) => Promise<void>;
}

export function ComplaintsScreen({
  pg,
  complaints,
  onAddComplaint,
  onMarkFixed,
}: ComplaintsScreenProps) {
  const [category, setCategory] = useState<ComplaintCategory>("wifi");
  const [description, setDescription] = useState("");
  const [photoState, setPhotoState] = useState<{
    blob: Blob;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | ComplaintStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ComplaintCategory>("all");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const prepared = await validateAndPrepareImage(file);
      const previewUrl = URL.createObjectURL(prepared.blob);
      setPhotoState({ blob: prepared.blob, mimeType: prepared.mimeType, previewUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid image file.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (description.trim().length < 5) {
      setError("Please describe the issue in at least 5 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const complaintId = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await onAddComplaint({
        complaintId,
        category,
        description: description.trim(),
        photo: photoState || undefined,
      });
      setDescription("");
      setPhotoState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFix(id: string) {
    setFixingId(id);
    setError(null);
    try {
      await onMarkFixed(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update complaint.");
    } finally {
      setFixingId(null);
    }
  }

  const filtered = complaints.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
    return true;
  });

  const openCount = complaints.filter((c) => c.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Complaint log
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {pg.pgName} · {pg.roomNumber} · {openCount} open issue(s) tracked with live day counters.
        </p>
      </div>

      {/* Add Complaint Form */}
      <Card>
        <CardHeader>
          <CardTitle>Log a PG issue</CardTitle>
          <CardDescription>
            Create a dated record whenever food, hygiene, Wi-Fi, water, or power issues go
            unresolved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="complaint-category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(val) => setCategory(val as ComplaintCategory)}
                >
                  <SelectTrigger id="complaint-category">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="complaint-desc">What happened?</Label>
                <Textarea
                  id="complaint-desc"
                  placeholder="e.g. Floor 2 Wi-Fi drops every evening after 7 PM; informed warden twice."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[84px]"
                  required
                />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoPick}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {photoState ? "Change photo" : "Attach photo (optional)"}
                </Button>
                {photoState && (
                  <div className="flex items-center gap-2">
                    <img
                      src={photoState.previewUrl}
                      alt="Complaint attachment"
                      className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove attached photo"
                      onClick={() => setPhotoState(null)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Log complaint
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start">
          {(["all", "open", "fixed"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === status
                  ? "bg-white text-indigo-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={categoryFilter}
            onValueChange={(val) => setCategoryFilter(val as "all" | ComplaintCategory)}
          >
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Complaint List */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <MessageSquareWarning className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
            {complaints.length === 0 ? "No complaints logged yet" : "No matching complaints"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            {complaints.length === 0
              ? "Whenever food, Wi-Fi, water, power, or hygiene issues happen, log them here to build a dated history."
              : "Try clearing your status or category filter above."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const categoryLabel =
              CATEGORIES.find((item) => item.value === c.category)?.label || c.category;
            const days = daysElapsed(c.reportedAtMs, c.fixedAtMs ?? Date.now());
            const isOpen = c.status === "open";

            return (
              <Card key={c.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{categoryLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>Reported {formatDate(c.reportedAtMs)}</span>
                      <span aria-hidden="true">·</span>
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-800 tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          Unfixed for {days} {days === 1 ? "day" : "days"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Fixed on {formatDate(c.fixedAtMs)} ({days}d)
                        </span>
                      )}
                    </div>

                    <p className="text-sm leading-relaxed text-slate-800">{c.description}</p>

                    {c.photoUrl && (
                      <div className="pt-2">
                        <img
                          src={c.photoUrl}
                          alt={`${categoryLabel} complaint`}
                          referrerPolicy="no-referrer"
                          className="h-32 w-44 rounded-xl border border-slate-200 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {isOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fixingId === c.id}
                      onClick={() => void handleFix(c.id)}
                    >
                      {fixingId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      )}
                      Mark fixed
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
