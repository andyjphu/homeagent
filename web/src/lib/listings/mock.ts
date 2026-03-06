import type { ListingSearchParams, NormalizedListing } from "./types";

/**
 * Mock listing data for development/testing when RapidAPI is not subscribed.
 * Returns realistic Minneapolis-area listings.
 * This is ONLY used when RAPIDAPI_USE_MOCK=true in env.
 */

const MOCK_LISTINGS: NormalizedListing[] = [
  {
    address: "2401 Pillsbury Ave S",
    city: "Minneapolis",
    state: "MN",
    zip: "55404",
    price: 375000,
    beds: 3,
    baths: 2,
    sqft: 1850,
    lot_sqft: 5200,
    year_built: 1920,
    property_type: "single_family",
    photos: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=640",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=640",
    ],
    listing_url: "https://www.realtor.com/example/2401-pillsbury",
    lat: 44.9601,
    lng: -93.2776,
    days_on_market: 12,
    description: "Charming 3-bed Craftsman bungalow in Whittier. Updated kitchen, original hardwood floors, fenced backyard with garage. Walk to Eat Street restaurants.",
    source: "mock_data",
    source_id: "mock-001",
  },
  {
    address: "3156 Hennepin Ave",
    city: "Minneapolis",
    state: "MN",
    zip: "55408",
    price: 425000,
    beds: 4,
    baths: 2,
    sqft: 2200,
    lot_sqft: 6100,
    year_built: 1935,
    property_type: "single_family",
    photos: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=640",
    ],
    listing_url: "https://www.realtor.com/example/3156-hennepin",
    lat: 44.9482,
    lng: -93.2985,
    days_on_market: 5,
    description: "Spacious 4-bed in Uptown with sun-filled living room, updated baths, and two-car garage. Steps from Hennepin Ave shops and Lake of the Isles.",
    source: "mock_data",
    source_id: "mock-002",
  },
  {
    address: "1847 Emerson Ave N",
    city: "Minneapolis",
    state: "MN",
    zip: "55411",
    price: 299000,
    beds: 3,
    baths: 1,
    sqft: 1400,
    lot_sqft: 4800,
    year_built: 1910,
    property_type: "single_family",
    photos: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=640",
    ],
    listing_url: "https://www.realtor.com/example/1847-emerson",
    lat: 44.9972,
    lng: -93.2912,
    days_on_market: 28,
    description: "Affordable 3-bed near North Commons Park. New roof 2024, updated electrical. Great investment opportunity or starter home.",
    source: "mock_data",
    source_id: "mock-003",
  },
  {
    address: "4521 Harriet Ave S",
    city: "Minneapolis",
    state: "MN",
    zip: "55419",
    price: 485000,
    beds: 4,
    baths: 3,
    sqft: 2600,
    lot_sqft: 7200,
    year_built: 1948,
    property_type: "single_family",
    photos: [
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=640",
      "https://images.unsplash.com/photo-1600573472591-ee6981cf81d6?w=640",
      "https://images.unsplash.com/photo-1600566753086-00f18f6b0313?w=640",
    ],
    listing_url: "https://www.realtor.com/example/4521-harriet",
    lat: 44.9132,
    lng: -93.2825,
    days_on_market: 3,
    description: "Beautifully maintained 4-bed in Lynnhurst. Main floor family room, finished basement, large backyard. Top-rated Washburn schools. Move-in ready.",
    source: "mock_data",
    source_id: "mock-004",
  },
  {
    address: "718 Washington Ave SE",
    city: "Minneapolis",
    state: "MN",
    zip: "55414",
    price: 340000,
    beds: 2,
    baths: 2,
    sqft: 1100,
    lot_sqft: null,
    year_built: 2018,
    property_type: "condo",
    photos: [
      "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=640",
    ],
    listing_url: "https://www.realtor.com/example/718-washington",
    lat: 44.9813,
    lng: -93.2325,
    days_on_market: 15,
    description: "Modern 2-bed condo in Marcy-Holmes with floor-to-ceiling windows, in-unit laundry, and heated parking. Walking distance to U of M campus.",
    source: "mock_data",
    source_id: "mock-005",
  },
  {
    address: "2208 Grand Ave S",
    city: "Minneapolis",
    state: "MN",
    zip: "55405",
    price: 465000,
    beds: 3,
    baths: 2,
    sqft: 2100,
    lot_sqft: 5500,
    year_built: 1925,
    property_type: "single_family",
    photos: [
      "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=640",
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=640",
    ],
    listing_url: "https://www.realtor.com/example/2208-grand",
    lat: 44.9640,
    lng: -93.2982,
    days_on_market: 8,
    description: "Stunning Tudor in Lowry Hill East. 3 beds, chef's kitchen, exposed brick, original fireplace. Private garden patio. Near Walker Art Center.",
    source: "mock_data",
    source_id: "mock-006",
  },
];

/**
 * Filter mock listings based on search params.
 * Simulates what the real API would return.
 */
export function searchMock(
  params: ListingSearchParams
): { listings: NormalizedListing[]; total: number } {
  let filtered = [...MOCK_LISTINGS];

  // Filter by price
  if (params.price_min) {
    filtered = filtered.filter((l) => (l.price ?? 0) >= params.price_min!);
  }
  if (params.price_max) {
    filtered = filtered.filter((l) => (l.price ?? Infinity) <= params.price_max!);
  }

  // Filter by beds
  if (params.beds_min) {
    filtered = filtered.filter((l) => (l.beds ?? 0) >= params.beds_min!);
  }

  // Filter by baths
  if (params.baths_min) {
    filtered = filtered.filter((l) => (l.baths ?? 0) >= params.baths_min!);
  }

  // Filter by property type
  if (params.property_type) {
    filtered = filtered.filter(
      (l) => l.property_type === params.property_type
    );
  }

  // Apply limit
  const limit = params.limit || 20;
  const offset = params.offset || 0;
  const paged = filtered.slice(offset, offset + limit);

  return { listings: paged, total: filtered.length };
}
