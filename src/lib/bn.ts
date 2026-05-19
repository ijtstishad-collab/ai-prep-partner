// Bangla numeral + MCQ option helpers. UI-only utilities.

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export const toBnDigits = (input: number | string): string =>
  String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);

// A/B/C/D (or 1/2/3/4) → ক/খ/গ/ঘ/ঙ for OMR-style options.
const BN_OPTION_LABELS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

export const toBnOptionLabel = (key: string, fallbackIndex: number): string => {
  const upper = (key ?? "").toUpperCase();
  const idx = upper.charCodeAt(0) - 65; // A=0
  if (idx >= 0 && idx < BN_OPTION_LABELS.length) return BN_OPTION_LABELS[idx];
  const num = Number(upper);
  if (Number.isFinite(num) && num >= 1 && num <= BN_OPTION_LABELS.length) {
    return BN_OPTION_LABELS[num - 1];
  }
  return BN_OPTION_LABELS[fallbackIndex] ?? upper;
};

export const formatDuration = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};
