"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchExportRows, type ExportRange, type ExportRow } from "./actions";

const COLUMNS: (keyof ExportRow)[] = [
  "date","training_type","exercise","sets","reps","weight","duration","pain_score","pain_location","reaction","rpe","notes",
];

function toCSV(rows: ExportRow[]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => esc(r[c])).join(","));
  return lines.join("\n");
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportForm() {
  const [range, setRange] = useState<ExportRange>("month");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();

  function run(fmt: "csv" | "xlsx") {
    start(async () => {
      const rows = await fetchExportRows(range, date);
      if (fmt === "csv") {
        const csv = toCSV(rows);
        download(`rehab-${range}-${date}.csv`, new Blob([csv], { type: "text/csv" }));
      } else {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS as string[] });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Training");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        download(
          `rehab-${range}-${date}.xlsx`,
          new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Range</Label>
        <Select value={range} onValueChange={(v) => setRange(v as ExportRange)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {range !== "all" && (
        <div className="space-y-2">
          <Label>Anchor date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button size="lg" variant="outline" disabled={pending} onClick={() => run("csv")}>CSV</Button>
        <Button size="lg" disabled={pending} onClick={() => run("xlsx")}>Excel</Button>
      </div>
    </div>
  );
}
