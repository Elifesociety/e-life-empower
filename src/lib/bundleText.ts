export type BundleTextField = {
  id: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "email"
    | "phone"
    | "date"
    | "select"
    | "radio"
    | "checkbox"
    | "multi_text"
    | "yes_no";
  required: boolean;
  options?: string[];
  followupType?: "checkbox" | "radio";
  followupRequired?: boolean;
  followupOptions?: string[];
};

export type BundleTextEntry = Record<string, unknown>;

const hasValue = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim().length > 0;

export function getBundleFieldInitialValue(field: BundleTextField): unknown {
  if (field.type === "checkbox" || field.type === "multi_text") return [];
  if (field.type === "yes_no") return { value: "", followup: [] };
  return "";
}

function isBundleFieldAnswered(field: BundleTextField, value: unknown): boolean {
  if (field.type === "yes_no") {
    const answer = value as { value?: string; followup?: string[] } | null;
    return answer?.value === "yes" || answer?.value === "no";
  }
  if (field.type === "checkbox") return Array.isArray(value) && value.length > 0;
  if (field.type === "multi_text") return Array.isArray(value) && value.some(hasValue);
  return hasValue(value);
}

function isBundleFieldValid(field: BundleTextField, value: unknown): boolean {
  if (!isBundleFieldAnswered(field, value)) return false;
  if (field.type !== "yes_no") return true;

  const answer = value as { value?: string; followup?: string[] };
  return !(
    answer.value === "yes" &&
    field.followupRequired &&
    (field.followupOptions?.length ?? 0) > 0
  ) || (Array.isArray(answer.followup) && answer.followup.length > 0);
}

export function validateBundleAnswer(
  answer: unknown,
  fields: BundleTextField[],
  bundleRequired: boolean,
): boolean {
  const entries = Array.isArray(answer) ? answer as BundleTextEntry[] : [];
  const filledEntries = entries.filter((entry) =>
    fields.some((field) => isBundleFieldAnswered(field, entry?.[field.id])),
  );

  if (bundleRequired && filledEntries.length === 0) return false;

  return filledEntries.every((entry) =>
    fields.every((field) => !field.required || isBundleFieldValid(field, entry?.[field.id])),
  );
}

export function formatBundleAnswer(answer: unknown, fields: BundleTextField[]): string {
  if (!Array.isArray(answer)) return "";

  return (answer as BundleTextEntry[])
    .map((entry, index) => {
      const values = fields
        .filter((field) => isBundleFieldAnswered(field, entry?.[field.id]))
        .map((field) => {
          const value = entry[field.id];
          if (field.type === "yes_no") {
            const answer = value as { value?: string; followup?: string[] };
            const followup = Array.isArray(answer.followup) && answer.followup.length > 0
              ? ` (${answer.followup.join(", ")})`
              : "";
            return `${field.label}: ${answer.value === "yes" ? "Yes" : "No"}${followup}`;
          }
          const formatted = Array.isArray(value) ? value.join(", ") : String(value);
          return `${field.label}: ${formatted}`;
        });
      return values.length > 0 ? `Entry ${index + 1} — ${values.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("; ");
}