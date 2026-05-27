import { ExportForm } from "./export-form";

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Export</h1>
      <p className="text-sm text-muted-foreground">Download your training log.</p>
      <ExportForm />
    </div>
  );
}
