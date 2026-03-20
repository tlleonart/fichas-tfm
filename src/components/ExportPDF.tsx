"use client";

import { useCallback } from "react";

export default function ExportPDF({ targetId, filename }: { targetId: string; filename?: string }) {
  const exportPdf = useCallback(async () => {
    const element = document.getElementById(targetId);
    if (!element) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdf = (await import("html2pdf.js")).default as any;
    html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename: filename ?? "ficha.pdf",
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      } as Record<string, unknown>)
      .from(element)
      .save();
  }, [targetId, filename]);

  return (
    <button
      onClick={exportPdf}
      className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Exportar PDF
    </button>
  );
}
