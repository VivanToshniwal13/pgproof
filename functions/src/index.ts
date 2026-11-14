import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { GoogleGenAI, Type } from "@google/genai";

initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const MODEL_NAME = "gemini-2.5-flash";

function getGeminiClient(): GoogleGenAI {
  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "GEMINI_API_KEY secret is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

interface MoveInPhotoInput {
  id: string;
  roomArea: string;
  aiDamageTags: string[];
  aiSummary: string;
  capturedAtLabel: string;
  locked: boolean;
}

interface DeductionInput {
  id?: string;
  reason: string;
  amount: number;
}

interface ComplaintInput {
  category: string;
  description: string;
  status: "open" | "fixed";
  unfixedDays: number;
}

export const analyzeMoveInPhoto = onCall(
  { secrets: [geminiApiKey], region: "asia-south1", timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const { imageBase64, mimeType, roomArea } = request.data as {
      imageBase64?: string;
      mimeType?: string;
      roomArea?: string;
    };

    if (!imageBase64 || !mimeType || !roomArea) {
      throw new HttpsError("invalid-argument", "imageBase64, mimeType, and roomArea are required.");
    }

    const ai = getGeminiClient();

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `You are inspecting a move-in photo of a paying-guest (PG) hostel room area: "${roomArea}".
Identify any pre-existing wear, stains, cracks, peeling paint, dampness, rust, broken/loose fittings, scratches, or defects visible in the photo.
If the surface/area looks clean and undamaged, return an empty array [] for aiDamageTags and state that no visible damage was found in aiSummary.
Be strictly factual and concise so this record protects a tenant at move-out.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiDamageTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Short 1-3 word lowercase tags of visible pre-existing defects (e.g. 'water stain', 'peeling paint', 'loose hinge'). Empty array if none.",
              },
              aiSummary: {
                type: Type.STRING,
                description: "One clear, factual sentence summarizing the move-in condition of this area.",
              },
            },
            required: ["aiDamageTags", "aiSummary"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return {
        aiDamageTags: Array.isArray(parsed.aiDamageTags) ? parsed.aiDamageTags.slice(0, 10) : [],
        aiSummary: typeof parsed.aiSummary === "string" && parsed.aiSummary.trim()
          ? parsed.aiSummary.trim()
          : "Move-in condition photo inspected.",
      };
    } catch (error) {
      throw new HttpsError("internal", error instanceof Error ? error.message : "Gemini photo analysis failed.");
    }
  }
);

export const evaluateDeductions = onCall(
  { secrets: [geminiApiKey], region: "asia-south1", timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const { deductions, moveInPhotos } = request.data as {
      deductions?: DeductionInput[];
      moveInPhotos?: MoveInPhotoInput[];
    };

    if (!Array.isArray(deductions) || deductions.length === 0) {
      throw new HttpsError("invalid-argument", "At least one deduction is required.");
    }

    const ai = getGeminiClient();
    const photoContext = (moveInPhotos || []).map((p) => ({
      photoId: p.id,
      roomArea: p.roomArea,
      locked: p.locked,
      capturedAt: p.capturedAtLabel,
      damageTags: p.aiDamageTags,
      summary: p.aiSummary,
    }));

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Evaluate each PG hostel security deposit deduction claimed by the owner at move-out against the tenant's timestamped move-in inspection photos.

Move-in Photos Record:
${JSON.stringify(photoContext, null, 2)}

Owner Deductions Claimed:
${JSON.stringify(deductions, null, 2)}

Rules:
- If a move-in photo already documents the same defect, stain, crack, or broken fitting (or normal wear-and-tear documented at move-in), mark aiVerdict as "unfair" and set matchedPhotoId to that exact photoId.
- If the deduction is vague/blanket (e.g., "general maintenance", "miscellaneous charges", "admin fee") without specific damage, mark "unclear" (or "unfair" if contradicted by move-in record).
- If the deduction appears reasonable and specific (e.g., standard agreed cleaning or damage not present in move-in photos), mark "fair".
- Provide a short, factual aiReason (1-2 sentences) referencing the move-in photo area and date if matched.
- matchedPhotoId must be an exact photoId from Move-in Photos Record, or empty string "" if none matches.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                reason: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                aiVerdict: { type: Type.STRING, enum: ["fair", "unfair", "unclear"] },
                aiReason: { type: Type.STRING },
                matchedPhotoId: { type: Type.STRING },
              },
              required: ["reason", "amount", "aiVerdict", "aiReason", "matchedPhotoId"],
            },
          },
        },
      });

      const results = JSON.parse(response.text || "[]");
      return { results };
    } catch (error) {
      throw new HttpsError("internal", error instanceof Error ? error.message : "Gemini deduction evaluation failed.");
    }
  }
);

export const generateNotices = onCall(
  { secrets: [geminiApiKey], region: "asia-south1", timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }

    const { tenantName, pg, unfairDeductions, matchedPhotos, complaints } = request.data as {
      tenantName: string;
      pg: {
        pgName: string;
        ownerName: string;
        ownerPhone: string;
        address: string;
        roomNumber: string;
        monthlyRent: number;
        depositAmount: number;
        moveInDate: string;
        moveOutDate?: string;
      };
      unfairDeductions: Array<{ reason: string; amount: number; aiReason: string; matchedPhotoArea?: string; matchedPhotoDate?: string }>;
      matchedPhotos: MoveInPhotoInput[];
      complaints: ComplaintInput[];
    };

    const ai = getGeminiClient();
    const totalDisputable = (unfairDeductions || []).reduce((sum, d) => sum + Number(d.amount || 0), 0);

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate 3 escalating communication drafts for a paying-guest (PG) hostel tenant in Bengaluru seeking a fair security deposit refund.

Facts Provided by Tenant (use ONLY these facts):
- Tenant Name: ${tenantName}
- PG Name: ${pg.pgName}
- PG Owner/Warden: ${pg.ownerName} (${pg.ownerPhone})
- Address: ${pg.address}
- Room Number: ${pg.roomNumber}
- Monthly Rent: Rs ${pg.monthlyRent}
- Total Security Deposit Paid: Rs ${pg.depositAmount}
- Move-in Date: ${pg.moveInDate}
- Move-out Date: ${pg.moveOutDate || "Not specified"}
- Total Disputable Deductions: Rs ${totalDisputable}
- Disputed/Unfair Deductions & Move-In Evidence: ${JSON.stringify(unfairDeductions)}
- Locked Move-in Photos Summary: ${JSON.stringify(matchedPhotos)}
- Logged Complaints with Unfixed Day Counts: ${JSON.stringify(complaints)}

Strict Guidelines:
1. Polite, calm, factual, and firm. No anger, no threats, no exaggeration.
2. Use ONLY the facts provided above. Do NOT invent legal section numbers, statutes, court names, or claim legal authority.
3. Generate exactly three drafts:
   - reminder: Stage 1 — Friendly WhatsApp reminder (concise, easy to read on phone, mentions exact disputed amount and move-in photo proof).
   - formal_notice: Stage 2 — Formal written notice requesting refund of Rs ${totalDisputable} within 7 days, listing each disputed item with move-in date/photo proof and unresolved complaint durations.
   - consumer_complaint_draft: Stage 3 — Structured draft summary ready for filing a consumer grievance (factual timeline, amounts, evidence checklist, polite relief requested).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reminder: { type: Type.STRING },
              formal_notice: { type: Type.STRING },
              consumer_complaint_draft: { type: Type.STRING },
            },
            required: ["reminder", "formal_notice", "consumer_complaint_draft"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return {
        reminder: parsed.reminder,
        formal_notice: parsed.formal_notice,
        consumer_complaint_draft: parsed.consumer_complaint_draft,
      };
    } catch (error) {
      throw new HttpsError("internal", error instanceof Error ? error.message : "Gemini notice generation failed.");
    }
  }
);
