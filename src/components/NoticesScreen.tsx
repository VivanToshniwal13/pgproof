import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileText,
  Info,
  Loader2,
  MessageCircle,
  RotateCw,
  Save,
  Sparkles,
} from "lucide-react";
import { Complaint, Deduction, MoveInPhoto, NoticeDraft, NoticeStage, PgStay } from "../types";
import { generateNoticesAI } from "../lib/ai";
import {
  downloadNoticePdf,
  formatDateTime,
  formatINR,
  sanitizeWhatsAppPhone,
} from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

const STAGES: Array<{ stage: NoticeStage; tabLabel: string; title: string; subtitle: string }> = [
  {
    stage: "reminder",
    tabLabel: "1. WhatsApp reminder",
    title: "Friendly WhatsApp reminder",
    subtitle: "Polite first message referencing your move-in photos and refund amount.",
  },
  {
    stage: "formal_notice",
    tabLabel: "2. Formal notice (7d)",
    title: "Formal refund notice (7-day deadline)",
    subtitle: "Structured written notice listing disputed items, timestamps, and unfixed issues.",
  },
  {
    stage: "consumer_complaint_draft",
    tabLabel: "3. Consumer draft",
    title: "Consumer complaint summary draft",
    subtitle: "Factual timeline and evidence checklist ready for grievance submission.",
  },
];

interface NoticesScreenProps {
  tenantName: string;
  pg: PgStay;
  photos: MoveInPhoto[];
  complaints: Complaint[];
  deductions: Deduction[];
  notices: NoticeDraft[];
  onSaveGeneratedNotices: (drafts: Record<NoticeStage, string>) => Promise<void>;
  onSaveEditedNotice: (stage: NoticeStage, content: string) => Promise<void>;
}

export function NoticesScreen({
  tenantName,
  pg,
  photos,
  complaints,
  deductions,
  notices,
  onSaveGeneratedNotices,
  onSaveEditedNotice,
}: NoticesScreenProps) {
  const [activeStage, setActiveStage] = useState<NoticeStage>("reminder");
  const [draftTexts, setDraftTexts] = useState<Record<NoticeStage, string>>({
    reminder: "",
    formal_notice: "",
    consumer_complaint_draft: "",
  });
  const [generating, setGenerating] = useState(false);
  const [savingStage, setSavingStage] = useState<NoticeStage | null>(null);
  const [copiedStage, setCopiedStage] = useState<NoticeStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<NoticeStage, string> = {
      reminder: "",
      formal_notice: "",
      consumer_complaint_draft: "",
    };
    for (const n of notices) {
      next[n.stage] = n.content;
    }
    setDraftTexts(next);
  }, [notices]);

  const unfairOrUnclear = deductions.filter(
    (d) => d.aiVerdict === "unfair" || d.aiVerdict === "unclear"
  );
  const unfairOnly = deductions.filter((d) => d.aiVerdict === "unfair");
  const hasAnyDraft = Boolean(
    draftTexts.reminder || draftTexts.formal_notice || draftTexts.consumer_complaint_draft
  );

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const disputed = (unfairOnly.length > 0 ? unfairOnly : unfairOrUnclear).map((d) => {
        const matched = d.matchedPhotoId
          ? photos.find((p) => p.id === d.matchedPhotoId)
          : undefined;
        return {
          reason: d.reason,
          amount: d.amount,
          aiReason: d.aiReason,
          matchedPhotoArea: matched?.roomArea,
          matchedPhotoDate: matched ? formatDateTime(matched.capturedAtMs) : undefined,
        };
      });

      const generated = await generateNoticesAI({
        tenantName,
        pg,
        unfairDeductions: disputed,
        matchedPhotos: photos,
        complaints,
      });

      setDraftTexts(generated);
      await onSaveGeneratedNotices(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate drafts with Gemini.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(stage: NoticeStage) {
    const text = draftTexts[stage];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStage(stage);
      setTimeout(() => setCopiedStage(null), 2000);
    } catch {
      setError("Could not access clipboard. You can select and copy the text manually.");
    }
  }

  async function handleSaveEdit(stage: NoticeStage) {
    const text = draftTexts[stage].trim();
    if (text.length < 10) {
      setError("Draft cannot be shorter than 10 characters.");
      return;
    }
    setSavingStage(stage);
    setError(null);
    try {
      await onSaveEditedNotice(stage, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edited draft.");
    } finally {
      setSavingStage(null);
    }
  }

  const disputedSum = unfairOnly.reduce((sum, d) => sum + d.amount, 0);
  const openComplaintsCount = complaints.filter((c) => c.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Notice generator
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {pg.pgName} · Disputable amount{" "}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatINR(disputedSum)}
            </span>{" "}
            · {openComplaintsCount} open complaint(s)
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {hasAnyDraft ? "Regenerate all 3 drafts" : "Generate 3 escalating drafts"}
        </Button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-900" />
        <span>
          This is a draft to help you communicate, not legal advice. Every draft uses only the
          facts, dates, and photo records you logged.
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
            <RotateCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {!hasAnyDraft && !generating ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">
            Ready to build your refund notices
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Click “Generate 3 escalating drafts” above. Gemini will craft a WhatsApp reminder, a
            7-day formal notice, and a consumer grievance summary using only your verified PG
            evidence.
          </p>
        </Card>
      ) : (
        <Tabs
          value={activeStage}
          onValueChange={(v) => setActiveStage(v as NoticeStage)}
          className="w-full"
        >
          <TabsList className="w-full overflow-x-auto">
            {STAGES.map((s) => (
              <TabsTrigger key={s.stage} value={s.stage} className="flex-1">
                {s.tabLabel}
              </TabsTrigger>
            ))}
          </TabsList>

          {STAGES.map((s) => {
            const content = draftTexts[s.stage];
            const waUrl = `https://wa.me/${sanitizeWhatsAppPhone(
              pg.ownerPhone
            )}?text=${encodeURIComponent(content)}`;

            return (
              <TabsContent key={s.stage} value={s.stage}>
                <Card>
                  <CardHeader>
                    <CardTitle>{s.title}</CardTitle>
                    <CardDescription>{s.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {generating ? (
                      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-900" />
                        <p className="mt-3 text-sm font-medium text-slate-800">
                          Drafting calm, factual notices with Gemini...
                        </p>
                      </div>
                    ) : (
                      <>
                        <Textarea
                          value={content}
                          onChange={(e) =>
                            setDraftTexts((prev) => ({
                              ...prev,
                              [s.stage]: e.target.value,
                            }))
                          }
                          className="min-h-[280px] font-sans text-sm leading-relaxed"
                          aria-label={s.title}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleCopy(s.stage)}
                              disabled={!content}
                            >
                              {copiedStage === s.stage ? (
                                <Check className="h-4 w-4 text-emerald-700" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                              {copiedStage === s.stage ? "Copied" : "Copy text"}
                            </Button>

                            <Button type="button" variant="outline" size="sm" asChild>
                              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="h-4 w-4 text-emerald-700" />
                                Open in WhatsApp
                              </a>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!content}
                              onClick={() =>
                                downloadNoticePdf({
                                  title: s.title,
                                  pgName: pg.pgName,
                                  roomNumber: pg.roomNumber,
                                  tenantName,
                                  content,
                                })
                              }
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </Button>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            disabled={!content || savingStage === s.stage}
                            onClick={() => void handleSaveEdit(s.stage)}
                          >
                            {savingStage === s.stage ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save edits
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
