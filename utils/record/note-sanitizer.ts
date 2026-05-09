const DATE_TIME_NOTE_PARTS = [
  /\b(?:hari ini|kemarin|besok|lusa|barusan|sekarang|tadi(?:\s+(?:pagi|siang|sore|malam))?|pagi ini|siang ini|sore ini|malam ini|minggu lalu|bulan lalu|tahun lalu)\b/gi,
  /\b(?:jam|pukul)\s*(?:[01]?\d|2[0-3])(?:[:.][0-5]\d)?(?:\s*(?:pagi|siang|sore|malam))?\b/gi,
  /\b(?:tanggal|tgl)\s*\d{1,2}(?:[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\s+(?:jan|januari|feb|februari|mar|maret|apr|april|mei|jun|juni|jul|juli|agu|agustus|sep|september|okt|oktober|nov|november|des|desember)(?:\s+\d{2,4})?)?\b/gi,
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}[\/]\d{1,2}(?:[\/]\d{2,4})?\b/g,
];

export function sanitizeTransactionNote(note: unknown): string {
  if (typeof note !== "string") return "";
  return DATE_TIME_NOTE_PARTS
    .reduce((value, pattern) => value.replace(pattern, " "), note)
    .replace(/\s*[-–—,;:]\s*$/g, "")
    .replace(/^\s*[-–—,;:]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
