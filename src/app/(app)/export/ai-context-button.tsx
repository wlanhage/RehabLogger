"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Download, Check } from "lucide-react";
import { buildAiContext } from "./ai-context";

export function AiContextExport() {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(mode: "copy" | "download") {
    setError(null);
    setCopied(false);
    start(async () => {
      try {
        const md = await buildAiContext();
        if (mode === "copy") {
          await navigator.clipboard.writeText(md);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } else {
          const blob = new Blob([md], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `ai-context-${new Date().toISOString().slice(0, 10)}.md`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunde inte generera");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        En kompakt Markdown-sammanfattning av din träning, load och kroppens svar — gjord för att klistra in i
        ChatGPT eller Claude så AI:n förstår din rehab på 20 sekunder.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" disabled={pending} onClick={() => run("copy")}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : copied ? (
            <>
              <Check className="h-4 w-4" /> Kopierat!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Kopiera för AI
            </>
          )}
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => run("download")}>
          <Download className="h-4 w-4" /> Ladda ner .md
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
