import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { jsPDF } from "jspdf";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatDate(msOrIso: number | string | undefined): string {
  if (!msOrIso) return "—";
  const d = typeof msOrIso === "number" ? new Date(msOrIso) : new Date(msOrIso);
  if (Number.isNaN(d.getTime())) return String(msOrIso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ms: number | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysElapsed(startMs: number, endMs: number = Date.now()): number {
  const diff = Math.max(0, endMs - startMs);
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function sanitizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface CompressedImageResult {
  blob: Blob;
  base64: string;
  mimeType: string;
}

export async function validateAndPrepareImage(file: File): Promise<CompressedImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file (JPG, PNG, or WebP).");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image exceeds the 5 MB limit. Please choose a smaller photo.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid or corrupted image file."));
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Browser canvas is unavailable."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image."));
              return;
            }
            if (blob.size > 5 * 1024 * 1024) {
              reject(new Error("Prepared image still exceeds 5 MB. Please choose a smaller photo."));
              return;
            }
            const bReader = new FileReader();
            bReader.onerror = () => reject(new Error("Failed to encode image."));
            bReader.onloadend = () => {
              const dataUrl = String(bReader.result || "");
              const base64 = dataUrl.split(",")[1] || "";
              resolve({
                blob,
                base64,
                mimeType: "image/jpeg",
              });
            };
            bReader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.84
        );
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export function downloadNoticePdf(params: {
  title: string;
  pgName: string;
  roomNumber: string;
  tenantName: string;
  content: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(49, 46, 129);
  doc.text(`PGProof — ${params.title}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Tenant: ${params.tenantName} | PG: ${params.pgName} (Room ${params.roomNumber}) | Generated: ${formatDate(Date.now())}`,
    margin,
    y
  );
  y += 14;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(params.content, maxWidth) as string[];
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y > pageHeight - 72) {
      doc.addPage();
      y = 56;
    }
    doc.text(line, margin, y);
    y += 16;
  }

  y = Math.min(pageHeight - 36, y + 20);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Disclaimer: This is a draft to help you communicate, not legal advice.",
    margin,
    y
  );

  const safeSlug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`pgproof-${safeSlug}.pdf`);
}
