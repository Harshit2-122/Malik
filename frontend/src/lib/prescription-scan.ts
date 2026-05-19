import type { AppLocale } from "./locale";

function ocrLang(locale: AppLocale): string {
  if (locale === "en") return "eng";
  if (locale === "hi") return "hin";
  return "hin+eng";
}

/** Client-side OCR for prescription photos (Tesseract.js). */
export async function scanPrescriptionImage(
  file: File,
  locale: AppLocale,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(ocrLang(locale), undefined, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text.replace(/\s+/g, " ").trim();
  } finally {
    await worker.terminate();
  }
}

/** Pull likely medicine lines from OCR text into medicines field. */
export function extractMedicinesFromOcr(text: string): string {
  const lines = text
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const medLike = lines.filter((l) =>
    /mg|ml|tablet|tab|cap|syrup|injection|metformin|paracetamol|dawai|दवा|मिलीग्राम|टैबलेट/i.test(l),
  );
  const picked = (medLike.length ? medLike : lines).slice(0, 8);
  return picked.join(", ");
}
