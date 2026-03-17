"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Database, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

const MIGRATION_SQL: Record<string, { label: string; sql: string }> = {
  enrichment_data: {
    label: "Add enrichment_data column to properties",
    sql: `ALTER TABLE properties ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT NULL;`,
  },
  enrichment_cache: {
    label: "Create enrichment_cache table",
    sql: `CREATE TABLE IF NOT EXISTS enrichment_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address_normalized TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  provider TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  UNIQUE(address_normalized, provider)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_cache_lookup
  ON enrichment_cache(address_normalized, provider)
  WHERE expires_at > now();

ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on enrichment_cache"
  ON enrichment_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);`,
  },
};

export function MigrationBanner({
  pendingMigrations,
  projectRef,
}: {
  pendingMigrations: string[];
  projectRef?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const allSql = pendingMigrations
    .map((m) => MIGRATION_SQL[m]?.sql ?? "")
    .filter(Boolean)
    .join("\n\n");

  function handleCopy() {
    navigator.clipboard.writeText(allSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Database className="h-4 w-4" />
          Database Migrations Needed
          <Badge variant="outline" className="text-amber-700 border-amber-400">
            {pendingMigrations.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Property enrichment features require database updates. Run the SQL
            below in your{" "}
            <a
              href={projectRef ? `https://supabase.com/dashboard/project/${projectRef}/sql/new` : "https://supabase.com/dashboard"}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Supabase SQL Editor
            </a>
            .
          </p>
        </div>

        <div className="space-y-1">
          {pendingMigrations.map((m) => (
            <div key={m} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {MIGRATION_SQL[m]?.label ?? m}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-amber-800 border-amber-300 hover:bg-amber-100"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 mr-1" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
            )}
            {expanded ? "Hide SQL" : "Show SQL"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-amber-800 border-amber-300 hover:bg-amber-100"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? "Copied!" : "Copy All SQL"}
          </Button>
        </div>

        {expanded && (
          <pre className="text-xs bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">
            {allSql}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
