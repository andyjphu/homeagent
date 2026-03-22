import { permanentRedirect } from "next/navigation";

export default async function LegacyDashboardCatchAll({
  params,
}: {
  params: Promise<{ dashboardToken: string; rest: string[] }>;
}) {
  const { dashboardToken, rest } = await params;
  permanentRedirect(`/p/${dashboardToken}/${rest.join("/")}`);
}
