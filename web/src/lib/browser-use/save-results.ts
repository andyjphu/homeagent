import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createAdminClient() as any;

/**
 * Save or update a property. Deduplicates on zillow_url (explicit check + update/insert,
 * matching the Python agent's behavior).
 * Returns the property ID.
 */
export async function saveProperty(
  agentId: string,
  taskId: string,
  data: Record<string, any>
): Promise<string> {
  const row: Record<string, any> = {
    agent_id: agentId,
    research_task_id: taskId,
    scraped_at: new Date().toISOString(),
    address: data.address,
    city: data.city ?? null,
    state: data.state ?? null,
    zip: data.zip ?? null,
    listing_price: data.listing_price ?? data.price ?? null,
    beds: data.beds ?? null,
    baths: data.baths ?? null,
    sqft: data.sqft ?? null,
    lot_sqft: data.lot_sqft ?? null,
    year_built: data.year_built ?? null,
    property_type: data.property_type ?? null,
    hoa_monthly: data.hoa_monthly ?? null,
    tax_annual: data.tax_annual ?? null,
    tax_assessed_value: data.tax_assessed_value ?? null,
    listing_description: data.listing_description ?? null,
    photos: data.photos ?? (data.thumbnail_url ? [data.thumbnail_url] : []),
    amenities: data.amenities ?? [],
    days_on_market: data.days_on_market ?? null,
    price_history: data.price_history ?? [],
    zillow_url: data.zillow_url ?? data.listing_url ?? null,
    zillow_id: data.zillow_id ?? null,
    listing_status: "active",
  };

  // Clean out undefined values
  for (const key of Object.keys(row)) {
    if (row[key] === undefined) delete row[key];
  }

  // Check for existing property by zillow_url to avoid duplicates
  const zillowUrl = row.zillow_url;
  if (zillowUrl) {
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .eq("zillow_url", zillowUrl);

    if (existing && existing.length > 0) {
      const propId = existing[0].id;
      await supabase
        .from("properties")
        .update(row)
        .eq("id", propId);
      return propId;
    }
  }

  const { data: inserted, error } = await supabase
    .from("properties")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    throw new Error(`saveProperty failed: ${error.message}`);
  }
  return inserted.id;
}

/**
 * Save a listing agent, deduplicating on name + brokerage.
 * Returns the listing agent ID.
 */
export async function saveListingAgent(data: {
  name: string;
  brokerage?: string;
  phone?: string;
  email?: string;
}): Promise<string> {
  const { data: existing } = await supabase
    .from("listing_agents")
    .select("id")
    .eq("name", data.name)
    .eq("brokerage", data.brokerage ?? "")
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  const { data: inserted, error } = await supabase
    .from("listing_agents")
    .insert({
      name: data.name,
      brokerage: data.brokerage ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`saveListingAgent failed: ${error.message}`);
  return inserted.id;
}

/**
 * Link a property to a buyer via buyer_property_scores.
 * Upserts on (buyer_id, property_id) with placeholder score.
 */
export async function linkPropertyToBuyer(
  buyerId: string,
  propertyId: string
): Promise<void> {
  await supabase.from("buyer_property_scores").upsert(
    {
      buyer_id: buyerId,
      property_id: propertyId,
      match_score: 0,
    },
    { onConflict: "buyer_id,property_id" }
  );
}

/**
 * Update a property with enrichment data (schools, walkscore, commute).
 */
export async function saveEnrichment(
  propertyId: string,
  updates: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", propertyId);

  if (error) {
    throw new Error(`saveEnrichment failed: ${error.message}`);
  }
}

/**
 * Log an event to the agent_tasks execution_log.
 */
export async function logEvent(
  taskId: string,
  action: string,
  data?: Record<string, any>
): Promise<void> {
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("execution_log")
    .eq("id", taskId)
    .single();

  const log: any[] = task?.execution_log ?? [];
  log.push({
    timestamp: new Date().toISOString(),
    action,
    ...(data ? { data } : {}),
  });

  await supabase
    .from("agent_tasks")
    .update({ execution_log: log })
    .eq("id", taskId);
}

/**
 * Update task status in agent_tasks.
 */
export async function updateTaskStatus(
  taskId: string,
  status: string,
  extra?: Record<string, any>
): Promise<void> {
  const updates: Record<string, any> = { status };
  if (status === "running") updates.started_at = new Date().toISOString();
  if (status === "completed") updates.completed_at = new Date().toISOString();
  if (status === "failed") updates.failed_at = new Date().toISOString();
  if (extra) {
    // Merge extra fields (output_data, error_message, etc.)
    Object.assign(updates, extra);
  }

  await supabase.from("agent_tasks").update(updates).eq("id", taskId);
}

/**
 * Get the current task record.
 */
export async function getTask(taskId: string) {
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) throw new Error(`getTask failed: ${error.message}`);
  return data;
}
