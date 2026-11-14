import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = "gemini-2.5-flash";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function stripMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, model: GEMINI_MODEL });
  });

  app.post("/api/analyze-move-in-photo", async (req, res) => {
    try {
      const { imageBase64, mimeType, roomArea } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        roomArea?: string;
      };

      if (!imageBase64 || !mimeType || !roomArea) {
        res.status(400).json({ error: "imageBase64, mimeType, and roomArea are required." });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
Identify any pre-existing wear, stains, cracks, peeling paint, dampness, rust, broken or loose fittings, scratches, or defects visible in the photo.
If the surface/area looks clean and undamaged, return an empty array [] for aiDamageTags and state clearly that no visible damage was found in aiSummary.
Be strictly factual and concise so this timestamped record protects a tenant at move-out.`,
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
                description:
                  "Short 1-3 word lowercase tags of visible pre-existing defects (e.g. 'water stain', 'peeling paint', 'loose hinge'). Empty array if none.",
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

      const rawText = stripMarkdownFences(response.text || "{}");
      const parsed = JSON.parse(rawText);

      res.json({
        aiDamageTags: Array.isArray(parsed.aiDamageTags)
          ? parsed.aiDamageTags.filter((t: unknown): t is string => typeof t === "string").slice(0, 10)
          : [],
        aiSummary:
          typeof parsed.aiSummary === "string" && parsed.aiSummary.trim()
            ? parsed.aiSummary.trim()
            : "Move-in condition photo inspected.",
      });
    } catch (error) {
      console.error("Error in /api/analyze-move-in-photo:", error);
      const message = error instanceof Error ? error.message : "Failed to analyze photo with Gemini.";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/evaluate-deductions", async (req, res) => {
    try {
      const { deductions, moveInPhotos } = req.body as {
        deductions?: Array<{ id?: string; reason: string; amount: number }>;
        moveInPhotos?: Array<{
          id: string;
          roomArea: string;
          aiDamageTags: string[];
          aiSummary: string;
          capturedAtLabel: string;
          locked: boolean;
        }>;
      };

      if (!Array.isArray(deductions) || deductions.length === 0) {
        res.status(400).json({ error: "At least one deduction is required." });
        return;
      }

      const photoContext = (moveInPhotos || []).map((p) => ({
        photoId: p.id,
        roomArea: p.roomArea,
        locked: p.locked,
        capturedAt: p.capturedAtLabel,
        damageTags: p.aiDamageTags,
        summary: p.aiSummary,
      }));

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Evaluate each PG hostel security deposit deduction claimed by the owner at move-out against the tenant's timestamped move-in inspection photos.

Move-in Photos Record:
${JSON.stringify(photoContext, null, 2)}

Owner Deductions Claimed:
${JSON.stringify(deductions, null, 2)}

Rules:
- If a move-in photo already documents the same defect, stain, crack, peeling paint, or broken/loose fitting, mark aiVerdict as "unfair" and set matchedPhotoId to that exact photoId.
- If a move-in photo of that specific area shows clean undamaged condition and the owner claims fresh damage, or if a reasonable standard cleaning fee is itemized, evaluate fairly ("fair" if clearly justified, "unclear" if vague or unverified).
- If the deduction is vague/blanket (e.g., "general maintenance", "miscellaneous charges", "admin fee") without specific damage, mark "unclear".
- Provide a short, factual aiReason (1-2 sentences) referencing the move-in photo area and timestamp if matched.
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

      const rawText = stripMarkdownFences(response.text || "[]");
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        throw new Error("Unexpected response format from Gemini.");
      }

      res.json({ results: parsed });
    } catch (error) {
      console.error("Error in /api/evaluate-deductions:", error);
      const message = error instanceof Error ? error.message : "Failed to evaluate deductions with Gemini.";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/generate-notices", async (req, res) => {
    try {
      const { tenantName, pg, unfairDeductions, matchedPhotos, complaints } = req.body as {
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
        unfairDeductions: Array<{
          reason: string;
          amount: number;
          aiReason: string;
          matchedPhotoArea?: string;
          matchedPhotoDate?: string;
        }>;
        matchedPhotos: Array<{
          id: string;
          roomArea: string;
          aiDamageTags: string[];
          aiSummary: string;
          capturedAtLabel: string;
          locked: boolean;
        }>;
        complaints: Array<{
          category: string;
          description: string;
          status: "open" | "fixed";
          unfixedDays: number;
        }>;
      };

      if (!tenantName || !pg?.pgName) {
        res.status(400).json({ error: "Tenant name and PG details are required." });
        return;
      }

      const totalDisputable = (unfairDeductions || []).reduce(
        (sum, d) => sum + Number(d.amount || 0),
        0
      );

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
- Disputed/Unfair Deductions & Move-In Evidence: ${JSON.stringify(unfairDeductions || [])}
- Locked Move-in Photos Summary: ${JSON.stringify(matchedPhotos || [])}
- Logged Complaints with Unfixed Day Counts: ${JSON.stringify(complaints || [])}

Strict Rules:
1. Polite, calm, factual, and firm. No anger, no threats, no exaggeration.
2. Use ONLY the facts provided above. Do NOT invent any legal section numbers, act names, statutes, court names, or claim to provide legal advice.
3. Generate exactly three drafts:
   - reminder: Stage 1 — Friendly WhatsApp reminder (concise, easy to read on mobile, cites move-in photo evidence and exact Rs amount).
   - formal_notice: Stage 2 — Formal notice with a clear 7-day deadline to refund Rs ${totalDisputable}, citing each disputed deduction, its move-in photo date/area, and any open complaints with exact unfixed day counts.
   - consumer_complaint_draft: Stage 3 — Structured draft summary for a consumer grievance filing (factual timeline, exact INR amounts, evidence list, and polite refund request without inventing laws).`,
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

      const rawText = stripMarkdownFences(response.text || "{}");
      const parsed = JSON.parse(rawText);

      if (!parsed.reminder || !parsed.formal_notice || !parsed.consumer_complaint_draft) {
        throw new Error("Incomplete notice drafts returned by Gemini.");
      }

      res.json({
        reminder: parsed.reminder,
        formal_notice: parsed.formal_notice,
        consumer_complaint_draft: parsed.consumer_complaint_draft,
      });
    } catch (error) {
      console.error("Error in /api/generate-notices:", error);
      const message = error instanceof Error ? error.message : "Failed to generate notices with Gemini.";
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PGProof server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start PGProof server:", err);
  process.exit(1);
});
