export type BundleTextField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "email" | "phone" | "date";
  required: boolean;
};

export type BundleTextEntry = Record<string, unknown>;

const hasValue = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim().length > 0;

export function validateBundleAnswer(
  answer: unknown,
  fields: BundleTextField[],
  bundleRequired: boolean,
): boolean {
  const entries = Array.isArray(answer) ? answer as BundleTextEntry[] : [];
  const filledEntries = entries.filter((entry) =>
    fields.some((field) => hasValue(entry?.[field.id])),
  );

  if (bundleRequired && filledEntries.length === 0) return false;

  return filledEntries.every((entry) =>
    fields.every((field) => !field.required || hasValue(entry?.[field.id])),
  );
}

export function formatBundleAnswer(answer: unknown, fields: BundleTextField[]): string {
  if (!Array.isArray(answer)) return "";

  return (answer as BundleTextEntry[])
    .map((entry, index) => {
      const values = fields
        .filter((field) => hasValue(entry?.[field.id]))
        .map((field) => `${field.label}: ${String(entry[field.id])}`);
      return values.length > 0 ? `Entry ${index + 1} — ${values.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("; ");
}