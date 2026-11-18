import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";
import { BundleTextField, formatBundleAnswer } from "@/lib/bundleText";

export interface ExportColumn {
  header: string;
  key: string;
}

export async function exportRegistrationsToXlsx(
  registrations: ProgramRegistration[],
  questions: ProgramFormQuestion[],
  programName: string
) {
  const XLSX = await import("xlsx");
  // Sort questions by sort_order
  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  // Create header row with fixed fields first
  const headers = [
    "#",
    "Rank",
    "Registration Date",
    "Name",
    "Mobile Number",
    "Panchayath",
    "Ward",
    "Score %",
    ...sortedQuestions.map((q) => q.question_text),
  ];

  // Create data rows
  const rows = registrations.map((reg, index) => {
    const answers = reg.answers as Record<string, any>;
    const fixedData = answers._fixed || {};

    const row: any[] = [
      index + 1,
      (reg as any).rank != null ? (reg as any).rank : "-",
      new Date(reg.created_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      fixedData.name || "",
      fixedData.mobile || "",
      fixedData.panchayath_name || "",
      fixedData.ward ? `Ward ${fixedData.ward}` : "",
      (reg as any).percentage != null ? `${(reg as any).percentage.toFixed(1)}%` : "-",
    ];

    sortedQuestions.forEach((question) => {
      const answer = answers[question.id];
      if (question.question_type === "bundle_text") {
        row.push(formatBundleAnswer(answer, (((question.options as any)?.fields || []) as BundleTextField[])));
      } else if (Array.isArray(answer)) {
        row.push(answer.join(", "));
      } else {
        row.push(answer || "");
      }
    });

    return row;
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  const colWidths = headers.map((header) => ({
    wch: Math.max(header.length, 15),
  }));
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registrations");

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split("T")[0];
  const safeFileName = programName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  const fileName = `${safeFileName}_registrations_${timestamp}.xlsx`;

  // Download
  XLSX.writeFile(wb, fileName);
}
