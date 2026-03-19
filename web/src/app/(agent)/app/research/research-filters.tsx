"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TRIGGERS = [
  { value: "all", label: "All" },
  { value: "email", label: "Email" },
  { value: "calendar", label: "Calendar" },
  { value: "manual", label: "Manual" },
];

export function ResearchFilters({ currentTrigger }: { currentTrigger?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      {TRIGGERS.map((t) => (
        <button
          key={t.value}
          onClick={() => setFilter("trigger", t.value)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            (currentTrigger || "all") === t.value
              ? "bg-foreground text-background border-foreground"
              : "bg-white hover:bg-gray-50 border-gray-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
