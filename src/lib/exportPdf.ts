// PDF export. Renders the canvas to a high-DPI raster, then drops it into a
// single-page PDF sized exactly to the content so there's no extra whitespace.
// jsPDF is imported dynamically so its ~800 kB only loads when actually used.
import { renderExportCanvas, type ExportOptions, type ExportResult } from './exportImage';

export async function exportCanvasToPdf(options: ExportOptions = {}): Promise<ExportResult> {
  const { filename = 'sketch' } = options;

  // 2x density keeps text/edges crisp when the PDF is zoomed.
  const rendered = await renderExportCanvas({ scale: 2, ...options });
  if (!rendered.ok) return { ok: false, reason: rendered.reason };

  const { canvas, worldWidth, worldHeight } = rendered.result;

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    return { ok: false, reason: 'tainted' };
  }

  // Page dimensions in points (1 world px ≈ 0.75 pt @ 96dpi) keep a sensible
  // physical size while matching the content aspect ratio exactly.
  const pdfW = worldWidth * 0.75;
  const pdfH = worldHeight * 0.75;

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: pdfW >= pdfH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pdfW, pdfH],
    compress: true,
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
  pdf.save(filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`);
  return { ok: true };
}
