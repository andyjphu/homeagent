"use client";

import { useState } from "react";
import {
  Home,
  MapPin,
  Shield,
  Droplets,
  GraduationCap,
  Wind,
  Wifi,
  Users,
  ShoppingCart,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";

interface BriefData {
  id: string;
  brief_content: string;
  simplified_content: string;
  enrichment_snapshot: any;
  confidence_level: string;
  data_sources: string[];
  comp_count: number;
  created_at: string;
  property: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    year_built: number | null;
    lot_sqft: number | null;
    listing_price: number | null;
    property_type: string | null;
  };
  agent: {
    full_name: string;
    brokerage: string | null;
    brand_settings: any;
  };
}

const CONFIDENCE_STYLES = {
  high: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "High Confidence" },
  medium: { icon: Info, color: "text-yellow-600", bg: "bg-yellow-50", label: "Medium Confidence" },
  low: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Low Confidence" },
};

export function ResearchBriefView({ brief }: { brief: BriefData }) {
  const [simplified, setSimplified] = useState(false);
  const property = brief.property;
  const enrichment = brief.enrichment_snapshot || {};
  const conf = CONFIDENCE_STYLES[brief.confidence_level as keyof typeof CONFIDENCE_STYLES] || CONFIDENCE_STYLES.medium;
  const ConfIcon = conf.icon;

  const content = simplified ? brief.simplified_content : brief.brief_content;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Home className="h-4 w-4" />
            <span>Research Brief</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{property.address}</h1>
          {(property.city || property.state) && (
            <p className="text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5 inline mr-1" />
              {[property.city, property.state, property.zip].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* Property Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {property.beds != null && (
            <StatCard label="Beds" value={String(property.beds)} />
          )}
          {property.baths != null && (
            <StatCard label="Baths" value={String(property.baths)} />
          )}
          {property.sqft != null && (
            <StatCard label="Sqft" value={property.sqft.toLocaleString()} />
          )}
          {property.year_built != null && (
            <StatCard label="Built" value={String(property.year_built)} />
          )}
          {property.listing_price != null && (
            <StatCard label="Price" value={`$${property.listing_price.toLocaleString()}`} className="col-span-2" />
          )}
        </div>

        {/* Confidence + Sources */}
        <div className={`rounded-lg p-3 mb-6 ${conf.bg} flex items-center gap-3`}>
          <ConfIcon className={`h-5 w-5 ${conf.color}`} />
          <div>
            <p className={`text-sm font-medium ${conf.color}`}>{conf.label}</p>
            <p className="text-xs text-muted-foreground">
              {brief.data_sources.length} data sources · {brief.comp_count} comparable sales
            </p>
          </div>
        </div>

        {/* Simplified Toggle */}
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => setSimplified(!simplified)}
            className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 transition-colors"
          >
            {simplified ? "Show detailed version" : "Show simplified version"}
          </button>
        </div>

        {/* Brief Content */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="prose prose-sm max-w-none whitespace-pre-line">
            {content}
          </div>
        </div>

        {/* Enrichment Data Cards */}
        <div className="space-y-3 mb-6">
          {enrichment.walkability && (
            <EnrichmentCard
              icon={MapPin}
              title="Walkability"
              items={[
                `Walk Score: ${enrichment.walkability.walk_score}/100`,
                `Transit Score: ${enrichment.walkability.transit_score}/100`,
                `Bike Score: ${enrichment.walkability.bike_score}/100`,
              ]}
            />
          )}
          {enrichment.flood && (
            <EnrichmentCard
              icon={Droplets}
              title="Flood Risk"
              items={[
                `Zone: ${enrichment.flood.zone}`,
                `Risk: ${enrichment.flood.risk_level}`,
                `Insurance required: ${enrichment.flood.insurance_required ? "Yes" : "No"}`,
              ]}
            />
          )}
          {enrichment.schools?.nearby?.length > 0 && (
            <EnrichmentCard
              icon={GraduationCap}
              title="Nearby Schools"
              items={enrichment.schools.nearby.slice(0, 3).map(
                (s: any) => `${s.name} (${s.type}) — ${s.distance_miles}mi`
              )}
            />
          )}
          {enrichment.crime && (
            <EnrichmentCard
              icon={Shield}
              title="Safety"
              items={[
                enrichment.crime.safety_score != null ? `Safety score: ${enrichment.crime.safety_score}/100` : null,
                enrichment.crime.violent_crime_rate != null ? `Violent crime rate: ${enrichment.crime.violent_crime_rate}` : null,
                enrichment.crime.property_crime_rate != null ? `Property crime rate: ${enrichment.crime.property_crime_rate}` : null,
              ].filter(Boolean) as string[]}
            />
          )}
          {enrichment.air_quality && (
            <EnrichmentCard
              icon={Wind}
              title="Air Quality"
              items={[`AQI: ${enrichment.air_quality.aqi} (${enrichment.air_quality.category})`]}
            />
          )}
          {enrichment.broadband && (
            <EnrichmentCard
              icon={Wifi}
              title="Internet"
              items={[
                `Fiber: ${enrichment.broadband.fiber_available ? "Available" : "Not available"}`,
                `Max speed: ${enrichment.broadband.max_download_mbps} Mbps`,
                `ISPs: ${enrichment.broadband.isp_count}`,
              ]}
            />
          )}
          {enrichment.demographics && (
            <EnrichmentCard
              icon={Users}
              title="Neighborhood"
              items={[
                `Median income: $${enrichment.demographics.median_income?.toLocaleString()}`,
                `Median home value: $${enrichment.demographics.median_home_value?.toLocaleString()}`,
                `Population: ${enrichment.demographics.population?.toLocaleString()}`,
              ]}
            />
          )}
          {enrichment.amenities && (
            <EnrichmentCard
              icon={ShoppingCart}
              title="Amenities"
              items={[
                `${enrichment.amenities.grocery_count} grocery stores`,
                `${enrichment.amenities.restaurant_count} restaurants`,
                `${enrichment.amenities.park_count} parks`,
                `Nearest grocery: ${enrichment.amenities.nearest_grocery_miles}mi`,
              ]}
            />
          )}
        </div>

        {/* Data Sources */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Data Sources</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {brief.data_sources.map((source) => (
              <span key={source} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-muted-foreground">
                {source}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>
            Prepared by {brief.agent.full_name}
            {brief.agent.brokerage ? ` · ${brief.agent.brokerage}` : ""}
          </p>
          <p>
            Generated {new Date(brief.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-[10px]">AI-suggested research · Data should be independently verified</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border p-3 text-center ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function EnrichmentCard({ icon: Icon, title, items }: { icon: any; title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground">{item}</li>
        ))}
      </ul>
    </div>
  );
}
