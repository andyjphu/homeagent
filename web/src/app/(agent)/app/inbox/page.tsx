import { Inbox } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Emails grouped by buyer and deal.
        </p>
      </div>

      <div className="border rounded-lg py-16 text-center">
        <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Your inbox will appear here</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Connect Gmail in Connections to start seeing emails grouped by buyer and deal.
        </p>
      </div>
    </div>
  );
}
