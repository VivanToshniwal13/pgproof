import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import {
  Complaint,
  DeductionVerdict,
  MoveInPhoto,
  NoticeStage,
  PgStay,
  RoomArea,
} from "../types";
import { daysElapsed, formatDateTime } from "./utils";

const USE_CLOUD_FUNCTIONS = import.meta.env.VITE_USE_CLOUD_FUNCTIONS === "true";

async function postJsonWithTimeout<T>(url: string, body: unknown, timeoutMs = 40000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Gemini analysis timed out. Please retry.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeMoveInPhotoAI(params: {
  imageBase64: string;
  mimeType: string;
  roomArea: RoomArea;
}): Promise<{ aiDamageTags: string[]; aiSummary: string }> {
  if (USE_CLOUD_FUNCTIONS) {
    const fn = httpsCallable<typeof params, { aiDamageTags: string[]; aiSummary: string }>(
      functions,
      "analyzeMoveInPhoto"
    );
    const result = await fn(params);
    return result.data;
  }
  return postJsonWithTimeout("/api/analyze-move-in-photo", params);
}

export interface EvaluatedDeductionResult {
  reason: string;
  amount: number;
  aiVerdict: DeductionVerdict;
  aiReason: string;
  matchedPhotoId: string;
}

export async function evaluateDeductionsAI(params: {
  deductions: Array<{ id?: string; reason: string; amount: number }>;
  moveInPhotos: MoveInPhoto[];
}): Promise<EvaluatedDeductionResult[]> {
  const payload = {
    deductions: params.deductions,
    moveInPhotos: params.moveInPhotos.map((p) => ({
      id: p.id,
      roomArea: p.roomArea,
      aiDamageTags: p.aiDamageTags,
      aiSummary: p.aiSummary,
      capturedAtLabel: formatDateTime(p.capturedAtMs),
      locked: p.locked,
    })),
  };

  if (USE_CLOUD_FUNCTIONS) {
    const fn = httpsCallable<typeof payload, { results: EvaluatedDeductionResult[] }>(
      functions,
      "evaluateDeductions"
    );
    const result = await fn(payload);
    return result.data.results;
  }

  const data = await postJsonWithTimeout<{ results: EvaluatedDeductionResult[] }>(
    "/api/evaluate-deductions",
    payload
  );
  return data.results;
}

export async function generateNoticesAI(params: {
  tenantName: string;
  pg: PgStay;
  unfairDeductions: Array<{
    reason: string;
    amount: number;
    aiReason: string;
    matchedPhotoArea?: string;
    matchedPhotoDate?: string;
  }>;
  matchedPhotos: MoveInPhoto[];
  complaints: Complaint[];
}): Promise<Record<NoticeStage, string>> {
  const payload = {
    tenantName: params.tenantName,
    pg: {
      pgName: params.pg.pgName,
      ownerName: params.pg.ownerName,
      ownerPhone: params.pg.ownerPhone,
      address: params.pg.address,
      roomNumber: params.pg.roomNumber,
      monthlyRent: params.pg.monthlyRent,
      depositAmount: params.pg.depositAmount,
      moveInDate: params.pg.moveInDate,
      moveOutDate: params.pg.moveOutDate,
    },
    unfairDeductions: params.unfairDeductions,
    matchedPhotos: params.matchedPhotos.map((p) => ({
      id: p.id,
      roomArea: p.roomArea,
      aiDamageTags: p.aiDamageTags,
      aiSummary: p.aiSummary,
      capturedAtLabel: formatDateTime(p.capturedAtMs),
      locked: p.locked,
    })),
    complaints: params.complaints.map((c) => ({
      category: c.category,
      description: c.description,
      status: c.status,
      unfixedDays: daysElapsed(c.reportedAtMs, c.fixedAtMs ?? Date.now()),
    })),
  };

  if (USE_CLOUD_FUNCTIONS) {
    const fn = httpsCallable<typeof payload, Record<NoticeStage, string>>(
      functions,
      "generateNotices"
    );
    const result = await fn(payload);
    return result.data;
  }

  return postJsonWithTimeout<Record<NoticeStage, string>>("/api/generate-notices", payload, 45000);
}
