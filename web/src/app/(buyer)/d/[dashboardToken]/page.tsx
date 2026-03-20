import { permanentRedirect } from "next/navigation";

export default async function LegacyDashboardRedirect({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  permanentRedirect(`/p/${dashboardToken}`);
}
