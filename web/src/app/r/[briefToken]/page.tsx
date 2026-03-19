import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ResearchBriefView } from "./brief-view";

interface Props {
  params: Promise<{ briefToken: string }>;
}

export default async function ResearchBriefPage({ params }: Props) {
  const { briefToken } = await params;
  const supabase = createAdminClient() as any;

  // Fetch the brief by public token
  const { data: brief, error } = await supabase
    .from("research_briefs")
    .select(`
      id,
      brief_content,
      simplified_content,
      enrichment_snapshot,
      confidence_level,
      data_sources,
      comp_count,
      created_at,
      viewed_at,
      property:properties (
        address,
        city,
        state,
        zip,
        beds,
        baths,
        sqft,
        year_built,
        lot_sqft,
        listing_price,
        property_type
      ),
      agent:agents (
        full_name,
        brokerage,
        brand_settings
      )
    `)
    .eq("public_token", briefToken)
    .single();

  if (error || !brief) {
    notFound();
  }

  // Track viewed_at (fire-and-forget)
  if (!brief.viewed_at) {
    supabase
      .from("research_briefs")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", brief.id)
      .then(() => {})
      .catch(() => {});
  }

  return <ResearchBriefView brief={brief} />;
}
