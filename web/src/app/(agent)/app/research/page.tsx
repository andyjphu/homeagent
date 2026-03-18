import { FileSearch } from "lucide-react";

export default function ResearchPage() {
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated property research briefs for your buyers.
        </p>
      </div>

      <div className="border rounded-lg py-16 text-center">
        <FileSearch className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Research briefs will appear here</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          When FoyerFind detects property addresses in your emails, it automatically
          researches them and creates briefs linked to your buyers.
        </p>
      </div>
    </div>
  );
}
