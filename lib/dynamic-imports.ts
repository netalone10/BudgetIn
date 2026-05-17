// Dynamic import wrappers for heavy dependencies.
// These functions load their dependencies only at invocation time via import(),
// keeping them out of the initial page bundle.

import { measureTiming, checkThresholdBreach } from "@/lib/performance";

/**
 * PDF Generation — loaded only when user clicks "Generate Report"
 * Dependencies: html2canvas (~400KB), jspdf (~300KB)
 */
export async function generatePDF(element: HTMLElement, filename: string) {
  const stopTiming = measureTiming("pdf-generation");

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const width = pdf.internal.pageSize.getWidth();
  const height = (canvas.height * width) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, width, height);
  pdf.save(filename);

  const duration = stopTiming();
  const breach = checkThresholdBreach("pdf-generation", duration);
  if (breach) {
    console.warn(breach.message);
  }
}

/**
 * AI Analysis — loaded only when user triggers analysis
 * Dependencies: groq-sdk (~50KB)
 */
export async function analyzeWithAI(prompt: string, apiKey: string) {
  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  return groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
  });
}
