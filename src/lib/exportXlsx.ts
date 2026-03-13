import { ProgramFormQuestion, ProgramRegistration } from "@/hooks/usePrograms";

export interface ExportColumn {
  header: string;
  key: string;
}

export async function exportRegistrationsToXlsx(
  registrations: ProgramRegistration[],
  questions: ProgramFormQuestion[],
  programName: string
) {
  // Dynamic import to avoid bundling issues
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
      if (Array.isArray(answer)) {
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
    wch: Math.max(String(header).length, 15),
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

export function exportRegistrationsToPdf(
  registrations: ProgramRegistration[],
  questions: ProgramFormQuestion[],
  programName: string
) {
  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  const rows = registrations.map((reg, index) => {
    const answers = reg.answers as Record<string, any>;
    const fixedData = answers._fixed || {};
    return {
      index: index + 1,
      rank: (reg as any).rank != null ? (reg as any).rank : "-",
      date: new Date(reg.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      name: fixedData.name || "",
      mobile: fixedData.mobile || "",
      panchayath: fixedData.panchayath_name || "",
      ward: fixedData.ward ? `Ward ${fixedData.ward}` : "",
      percentage: (reg as any).percentage != null ? `${(reg as any).percentage.toFixed(1)}%` : "-",
      questionAnswers: sortedQuestions.map((q) => {
        const answer = answers[q.id];
        if (Array.isArray(answer)) return answer.join(", ");
        return answer || "";
      }),
    };
  });

  const questionHeaders = sortedQuestions.map((q) => `<th>${q.question_text}</th>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${programName} - Registrations</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; color: #333; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; margin-bottom: 16px; font-size: 11px; }
    .summary { margin-bottom: 16px; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #f3f4f6; text-align: left; padding: 5px 6px; border: 1px solid #d1d5db; font-size: 10px; white-space: nowrap; }
    td { padding: 4px 6px; border: 1px solid #e5e7eb; font-size: 10px; }
    tr:nth-child(even) { background: #f9fafb; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <h1>${programName} - Registrations Report</h1>
  <div class="meta">Generated on ${new Date().toLocaleString("en-IN")}</div>
  <div class="summary">Total Registrations: ${registrations.length}</div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Rank</th><th>Date</th><th>Name</th><th>Mobile</th><th>Panchayath</th><th>Ward</th><th>Score %</th>${questionHeaders}
      </tr>
    </thead>
    <tbody>
      ${rows.map((r) => `<tr>
        <td>${r.index}</td><td>${r.rank}</td><td>${r.date}</td><td>${r.name}</td><td>${r.mobile}</td><td>${r.panchayath}</td><td>${r.ward}</td><td>${r.percentage}</td>${r.questionAnswers.map((a) => `<td>${a}</td>`).join("")}
      </tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }
}
