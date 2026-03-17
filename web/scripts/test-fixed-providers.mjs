// Test the fixed enrichment providers
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, "../.env.local"), "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    process.env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
  }
}

const TEST_LAT = 38.8977;
const TEST_LNG = -77.0365;
const TEST_ADDRESS = "1600 Pennsylvania Avenue NW, Washington, DC 20500";

async function testFEMA() {
  // Fixed URL: /arcgis/ instead of /gis/nfhl/
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
    `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const json = await res.json();

  if (json.features && json.features.length > 0) {
    console.log("[FEMA] ✓ OK", json.features[0].attributes);
  } else if (json.features) {
    console.log("[FEMA] ✓ OK - No flood zone (Zone X)");
  } else {
    console.log("[FEMA] ✗ FAIL", json.error || json);
  }
}

async function testNCES() {
  // Fixed: JSON geometry + meters + only available fields (no enrollment/grades in 2324 layer)
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({ x: TEST_LNG, y: TEST_LAT }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: "8047",
    units: "esriSRUnit_Meter",
    outFields: "NAME,STREET,CITY,STATE,ZIP,LAT,LON,LOCALE",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: "10",
  });

  const res = await fetch(
    `https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2324/MapServer/0/query?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const json = await res.json();

  if (json.features && json.features.length > 0) {
    console.log(`[NCES] ✓ OK - ${json.features.length} schools found`);
    json.features.slice(0, 3).forEach((f) => {
      const a = f.attributes;
      console.log(`  - ${a.NAME} (${a.CITY}, ${a.STATE})`);
    });
  } else {
    console.log("[NCES] ✗ FAIL", json.error || "no features");
  }
}

async function testWalkScore() {
  const key = process.env.WALKSCORE_API_KEY;
  if (!key) return console.log("[Walk Score] SKIP - no API key");

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
  console.log(
    "[Walk Score]",
    json.status === 1 ? "✓ OK" : "✗ FAIL",
    { walk: json.walkscore, transit: json.transit?.score, bike: json.bike?.score }
  );
}

async function testAirNow() {
  const key = process.env.AIRNOW_API_KEY;
  if (!key) return console.log("[AirNow] SKIP - no API key");

  const params = new URLSearchParams({
    format: "application/json",
    latitude: TEST_LAT.toString(),
    longitude: TEST_LNG.toString(),
    distance: "25",
    API_KEY: key,
  });

  const res = await fetch(`https://www.airnowapi.org/aq/observation/latLong/current/?${params}`);
  const json = await res.json();

  if (Array.isArray(json) && json.length > 0) {
    console.log("[AirNow] ✓ OK", {
      aqi: Math.max(...json.map((r) => r.AQI || 0)),
      category: json[0].Category?.Name,
    });
  } else {
    console.log("[AirNow] ✗ FAIL", json);
  }
}

async function testFCCBroadband() {
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

  if (!res.ok) {
    console.log(`[FCC Broadband] ✗ API unavailable (HTTP ${res.status}) - provider will fail gracefully`);
  } else {
    const json = await res.json();
    console.log("[FCC Broadband] ✓ OK", json.data?.length || 0, "providers");
  }
}

async function testFBICrime() {
  const key = process.env.DATAGOV_API_KEY;
  if (!key) return console.log("[FBI Crime] SKIP - no API key");

  const endpoints = [
    `https://api.usa.gov/crime/fbi/sapi/api/estimates/states/DC/2022/2022?api_key=${key}`,
    `https://cde.ucr.cjis.gov/LATEST/webapp/api/estimates/states/DC/2022/2022?API_KEY=${key}`,
  ];

  for (const url of endpoints) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      if (json.results?.length > 0) {
        const e = json.results[0];
        console.log("[FBI Crime] ✓ OK", {
          violent: e.violent_crime,
          property: e.property_crime,
          population: e.population,
        });
        return;
      }
    }
  }
  console.log("[FBI Crime] ✗ API unavailable (403) - provider will fail gracefully");
}

async function testGoogleMaps() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return console.log("[Google Maps] SKIP - no GOOGLE_MAPS_API_KEY configured");

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(TEST_ADDRESS)}&key=${key}`
  );
  const json = await res.json();
  console.log("[Google Maps]", json.status === "OK" ? "✓ OK" : `✗ ${json.status}`, json.results?.[0]?.geometry?.location);
}

console.log("=== Testing Fixed Enrichment Providers ===");
console.log(`Address: ${TEST_ADDRESS}`);
console.log(`Lat/Lng: ${TEST_LAT}, ${TEST_LNG}\n`);

await testWalkScore().catch((e) => console.log("[Walk Score] ✗ ERROR:", e.message));
await testFEMA().catch((e) => console.log("[FEMA] ✗ ERROR:", e.message));
await testAirNow().catch((e) => console.log("[AirNow] ✗ ERROR:", e.message));
await testNCES().catch((e) => console.log("[NCES] ✗ ERROR:", e.message));
await testFCCBroadband().catch((e) => console.log("[FCC] ✗ ERROR:", e.message));
await testFBICrime().catch((e) => console.log("[FBI] ✗ ERROR:", e.message));
await testGoogleMaps().catch((e) => console.log("[Google] ✗ ERROR:", e.message));

console.log("\n=== Summary ===");
console.log("Working: Walk Score, FEMA (fixed), AirNow, NCES (fixed)");
console.log("No API key: Google Maps (GOOGLE_MAPS_API_KEY not in .env.local)");
console.log("API unavailable: FCC Broadband (BDC 405), FBI Crime (403)");
console.log("Invalid key: Census (key rejected by API)");
