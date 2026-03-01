import { Skeleton } from "@/components/ui/skeleton";

export default function IntakeFormLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-72 mx-auto" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>

        {/* Form section skeletons */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        ))}

        <Skeleton className="h-12 w-full rounded-md" />
      </main>
    </div>
  );
}
