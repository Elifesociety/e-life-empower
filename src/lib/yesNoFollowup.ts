export const FOLLOWUP_TYPES = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Single choice (radio)" },
  { value: "checkbox", label: "Multiple choice (checkbox)" },
  { value: "multi_text", label: "Multiple answers (Add More)" },
  { value: "yes_no", label: "Yes / No" },
] as const;

export type FollowupType = (typeof FOLLOWUP_TYPES)[number]["value"];

export const FOLLOWUP_CHOICE_TYPES: FollowupType[] = ["select", "radio", "checkbox"];

export function normalizeFollowupType(value: unknown): FollowupType {
  return FOLLOWUP_TYPES.some((t) => t.value === value) ? (value as FollowupType) : "checkbox";
}

/** Follow-up answers are always stored as string arrays for backwards compatibility. */
export function isFollowupAnswered(type: FollowupType, followup: unknown): boolean {
  if (!Array.isArray(followup)) return false;
  if (type === "yes_no") return followup[0] === "yes" || followup[0] === "no";
  return followup.some((item) => String(item ?? "").trim().length > 0);
}

export function isYesNoValid(
  answer: { value?: string; followup?: unknown } | null | undefined,
  config: { type: FollowupType; required: boolean; options: string[] },
  mainRequired: boolean,
): boolean {
  if (mainRequired && answer?.value !== "yes" && answer?.value !== "no") return false;
  if (answer?.value !== "yes" || !config.required) return true;
  if (FOLLOWUP_CHOICE_TYPES.includes(config.type) && config.options.length === 0) return true;
  return isFollowupAnswered(config.type, answer.followup);
}

export function formatFollowup(followup: unknown): string {
  return Array.isArray(followup)
    ? followup.map((v) => String(v ?? "").trim()).filter(Boolean).join(", ")
    : "";
}

export function formatYesNoAnswer(answer: unknown, followupQuestion?: string): string {
  if (!answer || typeof answer !== "object") return "";
  const value = (answer as { value?: string }).value;
  if (value !== "yes" && value !== "no") return "";
  const followup = formatFollowup((answer as { followup?: unknown }).followup);
  if (value === "no" || !followup) return value === "yes" ? "Yes" : "No";
  const label = followupQuestion?.trim();
  return label ? `Yes — ${label}: ${followup}` : `Yes — ${followup}`;
}
