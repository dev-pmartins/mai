import * as XLSX from "xlsx";
import * as os from "os";
import * as path from "path";

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const excelToolDefinitions = [
  {
    name: "export_to_excel",
    description:
      "Generate an Excel (.xlsx) file from structured data and save it to disk. " +
      "Use this after collecting report data to produce a downloadable file. " +
      "Each sheet receives an array of row objects — the keys of the first row become column headers.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description:
            "File name without extension (e.g. 'relatorio_equipe_marco_2026'). " +
            "Defaults to 'runrunit_report_<date>'.",
        },
        output_dir: {
          type: "string",
          description:
            "Directory to save the file. Defaults to the user's Downloads folder.",
        },
        sheets: {
          type: "array",
          description: "List of sheets to include in the workbook.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Sheet tab name (max 31 chars).",
              },
              rows: {
                type: "array",
                description:
                  "Array of row objects. Keys of the first object become column headers.",
                items: { type: "object" },
              },
            },
            required: ["name", "rows"],
          },
        },
      },
      required: ["sheets"],
    },
  },
] as const;

// ─── Handler ──────────────────────────────────────────────────────────────────

type SheetInput = { name: string; rows: Record<string, unknown>[] };
type ToolArgs = Record<string, unknown> | undefined;

export async function handleExcelTool(name: string, args: ToolArgs) {
  if (name !== "export_to_excel") throw new Error(`Unknown excel tool: ${name}`);

  const sheets = (args?.["sheets"] as SheetInput[] | undefined) ?? [];
  if (sheets.length === 0) throw new Error("At least one sheet is required");

  const today = new Date().toISOString().slice(0, 10);
  const filename = (args?.["filename"] as string | undefined) ?? `runrunit_report_${today}`;
  const outputDir =
    (args?.["output_dir"] as string | undefined) ??
    path.join(os.homedir(), "Downloads");

  const filePath = path.join(outputDir, `${filename}.xlsx`);

  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const sheetName = sheet.name.slice(0, 31);
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  XLSX.writeFile(workbook, filePath);

  return {
    content: [
      {
        type: "text",
        text: `Excel gerado com sucesso: ${filePath}\nAbas: ${sheets.map((s) => s.name).join(", ")}`,
      },
    ],
  };
}
