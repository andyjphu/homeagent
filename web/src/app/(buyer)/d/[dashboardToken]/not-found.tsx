import { Building2 } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Dashboard not found</h1>
        <p className="text-muted-foreground text-sm">
          This link may have expired or the dashboard doesn&apos;t exist.
          Please check with your agent for an updated link.
        </p>
      </div>
    </div>
  );
}
