import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityEntry } from "@/lib/supabase/activity";
import { enrichProperty } from "@/lib/enrichment/service";
import { geocodeAddress } from "@/lib/enrichment/providers/google-maps";
import type { PropertyEnrichment } from "@/lib/enrichment/types";

// Supabase TS inference returns `never` for complex select queries.
// The existing codebase works around this with `as any` casts on the client
// (see web/src/app/api/properties/route.ts). Following the same pattern here.

interface PropertyRow {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  enrichment_data: PropertyEnrichment | null;
  agent_id: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get agent
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get property — try with enrichment_data first, fall back without it
    let prop: PropertyRow | null = null;
    {
      const { data, error } = await admin
        .from("properties")
        .select("id, address, city, state, zip, latitude, longitude, enrichment_data, agent_id")
        .eq("id", propertyId)
        .single();
      if (!error && data) {
        prop = data as PropertyRow;
      } else {
        // enrichment_data column may not exist yet — query without it
        const { data: fallback, error: fbErr } = await admin
          .from("properties")
          .select("id, address, city, state, zip, latitude, longitude, agent_id")
          .eq("id", propertyId)
          .single();
        if (fbErr || !fallback) {
          return NextResponse.json({ error: "Property not found" }, { status: 404 });
        }
        prop = { ...(fallback as Omit<PropertyRow, "enrichment_data">), enrichment_data: null } as PropertyRow;
      }
    }

    if (prop.agent_id !== agent.id) {
      return NextResponse.json({ error: "Not authorized to enrich this property" }, { status: 403 });
    }

    // Check if we have recent enrichment data (< 30 days old)
    if (prop.enrichment_data?.enriched_at) {
      const enrichedAt = new Date(prop.enrichment_data.enriched_at);
      const daysSinceEnrichment = (Date.now() - enrichedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEnrichment < 30) {
        return NextResponse.json({
          enrichment: prop.enrichment_data,
          cached: true,
          enriched_at: prop.enrichment_data.enriched_at,
          message: `Using cached enrichment data from ${Math.round(daysSinceEnrichment)} days ago`,
        });
      }
    }

    // Build full address string
    const fullAddress = [prop.address, prop.city, prop.state, prop.zip]
      .filter(Boolean)
      .join(", ");

    if (!fullAddress) {
      return NextResponse.json(
        { error: "Property has no address" },
        { status: 400 }
      );
    }

    // Geocode if lat/lng not stored
    let lat = prop.latitude;
    let lng = prop.longitude;

    if (!lat || !lng) {
      const coords = await geocodeAddress(fullAddress);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;

        // Store geocoded coordinates on the property
        await admin
          .from("properties")
          .update({ latitude: lat, longitude: lng })
          .eq("id", propertyId);
      } else {
        return NextResponse.json(
          { error: "Could not geocode address. Provide latitude/longitude or check the address." },
          { status: 400 }
        );
      }
    }

    // Run enrichment
    const result = await enrichProperty(lat, lng, fullAddress);

    // Store enrichment result on the property
    // Note: enrichment_data column may not exist if migration 00003 hasn't been applied
    const { error: updateError } = await admin
      .from("properties")
      .update({ enrichment_data: result.enrichment })
      .eq("id", propertyId);

    if (updateError) {
      const isMissingColumn = updateError.message?.includes("does not exist");
      if (isMissingColumn) {
        console.warn("[enrich] enrichment_data column missing — run migration 00003. Data returned but not persisted.");
      } else {
        console.error("[enrich] Failed to store enrichment:", updateError.message);
      }
    }

    // Log activity
    await createActivityEntry(
      agent.id,
      "research_completed",
      `Property enriched: ${prop.address}`,
      `Providers: ${result.providerResults.succeeded.length + result.providerResults.cached.length} succeeded, ${result.providerResults.failed.length} failed`,
      {
        providers_succeeded: result.providerResults.succeeded,
        providers_cached: result.providerResults.cached,
        providers_failed: result.providerResults.failed,
      },
      { propertyId }
    );

    const migrationNeeded = updateError?.message?.includes("does not exist") ?? false;

    return NextResponse.json({
      enrichment: result.enrichment,
      cached: false,
      providers: result.providerResults,
      ...(migrationNeeded && {
        warning: "Enrichment data was fetched but could not be saved. The enrichment_data column is missing — run database migration 00003.",
      }),
    });
  } catch (err: unknown) {
    console.error("[enrich] Error:", err);
    return NextResponse.json(
      { error: "Failed to enrich property" },
      { status: 500 }
    );
  }
}
