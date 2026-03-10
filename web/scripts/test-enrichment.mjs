// Test individual enrichment providers directly
// Run: node scripts/test-enrichment.mjs

const TEST_ADDRESS = "1600 Pennsylvania Avenue NW, Washington, DC 20500";
const TEST_LAT = 38.8977;
const TEST_LNG = -77.0365;

async function testWalkScore() {
  const key = process.env.WALKSCORE_API_KEY;
  if (!key) return console.log("[SKIP] Walk Score - no API key");

  const params = new URLSearchParams({
    format: "json",
    address: TEST_ADDRESS,
    lat: TEST_LAT.toString(),
    lon: TEST_LNG.toString(),
    transit: "1",
    bike: "1",
    wsapikey: key,
  });

  const res = await fetch(`https://api.walkscore.com/score?${params}`);
  const json = await res.json();
  console.log("[Walk Score]", json.status === 1 ? "OK" : "FAIL", {
    walk: json.walkscore,
    transit: json.transit?.score,
    bike: json.bike?.score,
    desc: json.description,
  });
}

async function testFEMA() {
  const params = new URLSearchParams({
    geometry: `${TEST_LNG},${TEST_LAT}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
    returnGeometry: "false",
    f: "json",
  });

  const res = await fetch(
    `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?${params}`
  );
  const json = await res.json();
  if (json.features && json.features.length > 0) {
    console.log("[FEMA Flood] OK", json.features[0].attributes);
  } else {
    console.log("[FEMA Flood] OK - no flood zone (Zone X/low risk)");
  }
}

async function testCensus() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) return console.log("[SKIP] Census - no API key");

  // Step 1: geocode to FIPS
  const geoRes = await fetch(
    `https://geo.fcc.gov/api/census/block/find?latitude=${TEST_LAT}&longitude=${TEST_LNG}&censusYear=2020&format=json`
  );
  const geoJson = await geoRes.json();
  const fips = geoJson.Block?.FIPS;
  if (!fips) return console.log("[Census] FAIL - no FIPS");

  const state = fips.substring(0, 2);
  const county = fips.substring(2, 5);
  const tract = fips.substring(5, 11);

  // Step 2: query Census ACS
  const variables = "B19013_001E,B25077_001E,B01003_001E,B25003_001E,B25003_002E,B01002_001E";
  const url = `https://api.census.gov/data/2022/acs/acs5?get=${variables}&for=tract:${tract}&in=state:${state}+county:${county}&key=${key}`;

  const res = await fetch(url);
  const json = await res.json();
  if (json && json.length >= 2) {
    const row = json[1];
    console.log("[Census] OK", {
      median_income: row[0],
      median_home_value: row[1],
      population: row[2],
      total_occupied: row[3],
      owner_occupied: row[4],
      median_age: row[5],
    });
  } else {
    console.log("[Census] FAIL", json);
  }
}

async function testFCCBroadband() {
  // First get census block
  const geoRes = await fetch(
    `https://geo.fcc.gov/api/census/block/find?latitude=${TEST_LAT}&longitude=${TEST_LNG}&censusYear=2020&format=json`
  );
  const geoJson = await geoRes.json();
  console.log("[FCC Broadband] FCC geocoder:", geoJson.Block?.FIPS ? "OK" : "FAIL");

  // Try BDC API
  const params = new URLSearchParams({
    latitude: TEST_LAT.toString(),
    longitude: TEST_LNG.toString(),
    category: "fixed",
    speed: "25",
    tech_code: "0",
  });

  const res = await fetch(
    `https://broadbandmap.fcc.gov/api/public/map/listAvailableFixedProvidersByLocation?${params}`,
    { headers: { Accept: "application/json" } }
  );
  console.log("[FCC Broadband] BDC status:", res.status);
  if (res.ok) {
    const json = await res.json();
    console.log("[FCC Broadband]", json.data ? `${json.data.length} providers` : "no data");
  }
}

async function testAirNow() {
  const key = process.env.AIRNOW_API_KEY;
  if (!key) return console.log("[SKIP] AirNow - no API key");

  const params = new URLSearchParams({
    format: "application/json",
    latitude: TEST_LAT.toString(),
    longitude: TEST_LNG.toString(),
    distance: "25",
    API_KEY: key,
  });

  const res = await fetch(
    `https://www.airnowapi.org/aq/observation/latLong/current/?${params}`
  );
  const json = await res.json();
  if (Array.isArray(json) && json.length > 0) {
    console.log("[AirNow] OK", {
      readings: json.length,
      highest_aqi: Math.max(...json.map((r) => r.AQI || 0)),
      category: json[0].Category?.Name,
    });
  } else {
    console.log("[AirNow] FAIL or no data", json);
  }
}

async function testNCES() {
  const params = new URLSearchParams({
    geometry: `${TEST_LNG},${TEST_LAT}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIsWithin",
    distance: "5",
    units: "esriSRUnit_StatuteMile",
    outFields: "NAME,STREET,CITY,STATE,ZIP,SCH_TYPE,GSLO,GSHI,ENROLLMENT,FT_TEACHER",
    returnGeometry: "true",
    f: "json",
    resultRecordCount: "5",
  });

  const res = await fetch(
    `https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2324/MapServer/0/query?${params}`
  );
  const json = await res.json();
  if (json.features && json.features.length > 0) {
    console.log("[NCES Schools] OK -", json.features.length, "schools found");
    json.features.slice(0, 3).forEach((f) => {
      console.log(`  - ${f.attributes.NAME} (${f.attributes.GSLO || "PK"}-${f.attributes.GSHI || "12"}, enrollment: ${f.attributes.ENROLLMENT})`);
    });
  } else {
    console.log("[NCES Schools] FAIL", json.error || "no features");
  }
}

async function testFBICrime() {
  const key = process.env.DATAGOV_API_KEY;
  if (!key) return console.log("[SKIP] FBI Crime - no API key");

  // Get state from coordinates
  const geoRes = await fetch(
    `https://geo.fcc.gov/api/census/block/find?latitude=${TEST_LAT}&longitude=${TEST_LNG}&censusYear=2020&format=json`
  );
  const geoJson = await geoRes.json();
  const fips = geoJson.Block?.FIPS;
  if (!fips) return console.log("[FBI Crime] FAIL - no FIPS");

  // DC = state code 11
  const stateAbbr = "DC"; // We know this for the test address

  // Try estimates endpoint
  const year = 2022;
  const url = `https://api.usa.gov/crime/fbi/sapi/api/estimates/states/${stateAbbr}/${year}/${year}?api_key=${key}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.results && json.results.length > 0) {
    const entry = json.results[0];
    console.log("[FBI Crime] OK", {
      violent_crime: entry.violent_crime,
      property_crime: entry.property_crime,
      population: entry.population,
      year: entry.year,
    });
  } else {
    console.log("[FBI Crime] FAIL", json);
  }
}

async function main() {
  console.log("=== Testing Enrichment Providers ===");
  console.log(`Address: ${TEST_ADDRESS}`);
  console.log(`Lat/Lng: ${TEST_LAT}, ${TEST_LNG}`);
  console.log("");

  await testWalkScore().catch((e) => console.error("[Walk Score] ERROR:", e.message));
  await testFEMA().catch((e) => console.error("[FEMA] ERROR:", e.message));
  await testCensus().catch((e) => console.error("[Census] ERROR:", e.message));
  await testFCCBroadband().catch((e) => console.error("[FCC] ERROR:", e.message));
  await testAirNow().catch((e) => console.error("[AirNow] ERROR:", e.message));
  await testNCES().catch((e) => console.error("[NCES] ERROR:", e.message));
  await testFBICrime().catch((e) => console.error("[FBI Crime] ERROR:", e.message));

  console.log("\n=== Done ===");
}

main();
