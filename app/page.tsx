"use client";

import { useEffect, useMemo, useState } from "react";
import MapView, {
  LookupMode,
  MapLayer,
  PoiToggles,
} from "@/components/MapView";

type LookupRow = {
  postcode: string;
  lsoa_code: string;
  imd_decile: number;
  lng: number;
  lat: number;
  need_level: string;
  opportunity_score: number;
};

type Scores = {
  economicInclusion: number;
  skillsOpportunity: number;
  healthWellbeing: number;
  householdResilience: number;
  environmentalSustainability: number;
  overallMateriality: number;
};

type ThemeItem = {
  name: string;
  value: number;
  toms: string;
  why: string;
  actions: string[];
};

type AssetToggleKey =
  | "skills"
  | "youth"
  | "community"
  | "foodbanks"
  | "gps"
  | "hospitals"
  | "schools";

type RecommendedAsset = {
  label: string;
  key?: AssetToggleKey;
  reason: string;
};

type MapPanelTab = "layers" | "partners";
type DetailTab = "toms" | "why" | "actions" | "method";

const DEFAULT_CENTER = {
  lat: 53.2403,
  lng: -2.734,
};

function num(v: any) {
  return Number(String(v ?? "").replace("%", "").trim());
}

function decileNeed(d: number) {
  return (11 - d) * 10;
}

function pctNeed(p: number) {
  return 100 - p;
}

function fuelNeed(p: number) {
  return Math.min(100, p * 5);
}

function environmentalScore(p: any) {
  const hasGreenspace = Number(p["has_greenspace"] ?? 0);
  const hasPriorityHabitat = Number(p["has_priority_habitat"] ?? 0);

  const greenspaceScore = hasGreenspace === 1 ? 60 : 20;
  const habitatScore = hasPriorityHabitat === 1 ? 80 : 20;

  return Math.round(greenspaceScore * 0.5 + habitatScore * 0.5);
}

function calcScores(p: any): Scores {
  const income = decileNeed(num(p["Income Decile"]));
  const employment = decileNeed(num(p["Employment Decile"]));
  const education = decileNeed(
    num(p["Education, Skills and Training Decile"])
  );
  const health = decileNeed(
    num(p["Health Deprivation and Disability Decile"])
  );

  const gp = pctNeed(num(p["Users within 15 minutes of GPs by PT/walk (%)"]));
  const jobs = pctNeed(
    num(p["Users within 30 minutes of Employment by PT/walk (%)"])
  );
  const food = pctNeed(
    num(p["Users within 15 minutes of Food Store by PT/walk (%)"])
  );
  const fuel = fuelNeed(num(p["Households Fuel Poor (%)"]));

  const economicInclusion = income * 0.35 + employment * 0.35 + jobs * 0.3;
  const skillsOpportunity = education * 0.6 + employment * 0.4;
  const healthWellbeing = health * 0.6 + gp * 0.4;
  const householdResilience = fuel * 0.5 + income * 0.3 + food * 0.2;
  const environmentalSustainability = environmentalScore(p);

  const overallMateriality =
    economicInclusion * 0.25 +
    skillsOpportunity * 0.2 +
    healthWellbeing * 0.2 +
    householdResilience * 0.2 +
    environmentalSustainability * 0.15;

  return {
    economicInclusion: Math.round(economicInclusion),
    skillsOpportunity: Math.round(skillsOpportunity),
    healthWellbeing: Math.round(healthWellbeing),
    householdResilience: Math.round(householdResilience),
    environmentalSustainability: Math.round(environmentalSustainability),
    overallMateriality: Math.round(overallMateriality),
  };
}

function band(v: number) {
  if (v >= 70) return "High";
  if (v >= 45) return "Moderate";
  return "Low";
}

function themes(scores: Scores): ThemeItem[] {
  const t = [
    {
      name: "Health And Wellbeing",
      value: scores.healthWellbeing,
      toms: "NT17, NT18",
      why:
        "Local health and accessibility indicators suggest relevance for wellbeing-focused initiatives that support community resilience and participation.",
      actions: [
        "Community Wellbeing Programmes",
        "Health Partnerships",
        "Active Travel Initiatives",
      ],
    },
    {
      name: "Skills And Progression",
      value: scores.skillsOpportunity,
      toms: "NT11, NT12, NT13",
      why:
        "Education and employment indicators highlight opportunities to support skills development, early careers pathways and workforce participation.",
      actions: ["Apprenticeships", "Work Placements", "School Outreach"],
    },
    {
      name: "Economic Inclusion",
      value: scores.economicInclusion,
      toms: "NT1, NT2, NT10",
      why:
        "Economic participation indicators are generally favourable, with potential to reinforce inclusive access to employment and local supply chain opportunities.",
      actions: ["Local Hiring", "SME Procurement", "Employability Partnerships"],
    },
    {
      name: "Household Resilience",
      value: scores.householdResilience,
      toms: "NT18, NT19",
      why:
        "Household affordability indicators suggest relevance for initiatives supporting resilience, financial wellbeing and access to essential services.",
      actions: [
        "Fuel Poverty Support",
        "Energy Advice",
        "Community Resilience Programmes",
      ],
    },
    {
      name: "Environmental Sustainability",
      value: scores.environmentalSustainability,
      toms: "NT30, NT31, NT33",
      why:
        "Environmental context indicates potential relevance for biodiversity enhancement, access-to-nature improvements and wider environmental value interventions.",
      actions: [
        "Biodiversity Enhancement",
        "Greenspace Improvement",
        "Nature-Based Projects",
      ],
    },
  ];

  return t.sort((a, b) => b.value - a.value);
}

function layerDescription(layer: MapLayer) {
  if (layer === "none") {
    return "Base map only with no data overlay.";
  }
  if (layer === "imd") {
    return "Overall Index of Multiple Deprivation. Lower deciles indicate higher relative need.";
  }
  if (layer === "income") {
    return "Income deprivation. Highlights areas where household income stress is likely to be more severe.";
  }
  if (layer === "employment") {
    return "Employment deprivation. Indicates areas where exclusion from the labour market is more acute.";
  }
  if (layer === "education") {
    return "Education, skills and training deprivation. Useful for identifying areas where skills investment may be material.";
  }
  if (layer === "health") {
    return "Health deprivation and disability. Highlights areas with greater health and wellbeing pressures.";
  }
  if (layer === "fuel") {
    return "Fuel poverty. Shows areas where household energy affordability pressures are higher.";
  }
  return "Employment accessibility by public transport and walking within 30 minutes. Lower access suggests greater mobility constraints.";
}

function getFeatureLsoaCode(properties: any) {
  return (
    properties?.["LSOA21CD"] ||
    properties?.["LSOA11CD"] ||
    properties?.["LSOA code (2011)"] ||
    null
  );
}

function isPointInRing(point: [number, number], ring: number[][]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

function isPointInPolygonGeometry(point: [number, number], geometry: any) {
  if (!geometry) return false;

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates || [];
    if (!rings.length) return false;
    if (!isPointInRing(point, rings[0])) return false;

    for (let i = 1; i < rings.length; i += 1) {
      if (isPointInRing(point, rings[i])) return false;
    }
    return true;
  }

  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates || []) {
      if (!polygon.length) continue;
      if (!isPointInRing(point, polygon[0])) continue;

      let insideHole = false;
      for (let i = 1; i < polygon.length; i += 1) {
        if (isPointInRing(point, polygon[i])) {
          insideHole = true;
          break;
        }
      }

      if (!insideHole) return true;
    }
  }

  return false;
}

function findLsoaByPoint(lsoa: any, lng: number, lat: number) {
  if (!lsoa?.features?.length) return null;
  const point: [number, number] = [lng, lat];

  for (const feature of lsoa.features) {
    if (isPointInPolygonGeometry(point, feature.geometry)) {
      return feature;
    }
  }

  return null;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findClosestPostcode(
  lookup: any,
  lat: number,
  lng: number
): string | null {
  if (!lookup?.features?.length) return null;

  let bestPostcode: string | null = null;
  let bestDistance = Infinity;

  for (const feature of lookup.features) {
    const props = feature.properties;
    const pcLat = Number(props?.lat);
const pcLng = Number(props?.long);
const pc = props?.pcd7;

    if (!pc || Number.isNaN(pcLat) || Number.isNaN(pcLng)) continue;

    const d = distanceKm(lat, lng, pcLat, pcLng);

    if (d < bestDistance) {
      bestDistance = d;
      bestPostcode = pc;
    }
  }

  return bestPostcode;
}

function recommendedAssetsFromThemes(
  topThemes: ThemeItem[]
): RecommendedAsset[] {
  const assetMap: Record<string, RecommendedAsset[]> = {
    "Economic Inclusion": [
      {
        label: "Skills Providers",
        key: "skills",
        reason:
          "Useful for employability pathways, local skills activity and access to work support.",
      },
      {
        label: "Community Centres",
        key: "community",
        reason:
          "Can support outreach, local delivery and inclusive community-based programmes.",
      },
    ],
    "Skills And Progression": [
      {
        label: "Schools / Colleges",
        key: "schools",
        reason:
          "Relevant for school engagement, careers pathways, outreach and education-linked interventions.",
      },
      {
        label: "Skills Providers",
        key: "skills",
        reason:
          "Relevant for training provision, apprenticeships and employability support.",
      },
      {
        label: "Youth Provision",
        key: "youth",
        reason:
          "Useful for early careers, mentoring and youth-focused opportunity creation.",
      },
    ],
    "Health And Wellbeing": [
      {
        label: "GP Surgeries",
        key: "gps",
        reason:
          "Helpful for understanding local health service presence and wellbeing-related context.",
      },
      {
        label: "Hospitals",
        key: "hospitals",
        reason:
          "Relevant where wider health infrastructure and access are part of local need.",
      },
      {
        label: "Community Centres",
        key: "community",
        reason:
          "Can support social prescribing, wellbeing delivery and trusted local engagement.",
      },
      {
        label: "Greenspace",
        reason:
          "Relevant for active travel, access to nature and healthier community environments.",
      },
    ],
    "Household Resilience": [
      {
        label: "Foodbanks",
        key: "foodbanks",
        reason:
          "Useful indicator of immediate household support need and community resilience pressure.",
      },
      {
        label: "Community Centres",
        key: "community",
        reason:
          "Can support advice services, resilience programmes and trusted local delivery.",
      },
      {
        label: "GP Surgeries",
        key: "gps",
        reason:
          "Helpful where health, hardship and household vulnerability intersect.",
      },
    ],
    "Environmental Sustainability": [
      {
        label: "Greenspace",
        reason:
          "Supports access-to-nature interventions, environmental improvement and wellbeing co-benefits.",
      },
      {
        label: "Priority Habitat",
        reason:
          "Indicates biodiversity relevance and potential need for protection or enhancement.",
      },
      {
        label: "Community Centres",
        key: "community",
        reason:
          "Can support local stewardship, volunteering and nature-based community projects.",
      },
    ],
  };

  const ranked = topThemes.slice(0, 3);
  const deduped = new Map<string, RecommendedAsset>();

  ranked.forEach((theme) => {
    (assetMap[theme.name] || []).forEach((asset) => {
      if (!deduped.has(asset.label)) {
        deduped.set(asset.label, asset);
      }
    });
  });

  return Array.from(deduped.values());
}

export default function Page() {
  const [postcode, setPostcode] = useState("");
  const [lookup, setLookup] = useState<any>(null);
  const [lsoa, setLsoa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [lookupMode, setLookupMode] = useState<LookupMode>("postcode");
  const [mapLayer, setMapLayer] = useState<MapLayer>("none");
  const [showMethodology, setShowMethodology] = useState(false);
  const [mapPanelTab, setMapPanelTab] = useState<MapPanelTab>("layers");
  const [detailTab, setDetailTab] = useState<DetailTab>("toms");

  const [selectedPoint, setSelectedPoint] = useState(DEFAULT_CENTER);
  const [selectedLsoaProps, setSelectedLsoaProps] = useState<any>(null);
  const [selectedLookupRow, setSelectedLookupRow] = useState<LookupRow | null>(
    null
  );
  const [siteCoords, setSiteCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [siteNearestPostcode, setSiteNearestPostcode] = useState<string | null>(
    null
  );

  const [scores, setScores] = useState<Scores | null>(null);
  const [top, setTop] = useState<ThemeItem[]>([]);

  const [poiToggles, setPoiToggles] = useState<PoiToggles>({
    skills: false,
    youth: false,
    community: false,
    foodbanks: false,
    gps: false,
    hospitals: false,
    schools: false,
  });

  useEffect(() => {
    Promise.all([
      fetch("/data/ch_lookup_clean.geojson").then((r) => r.json()),
      fetch("/data/ch_LSOA_Data.geojson").then((r) => r.json()),
    ]).then(([a, b]) => {
      setLookup(a);
      setLsoa(b);
      setLoading(false);
    });
  }, []);

  function applySelectedFeature(feature: any, point: { lng: number; lat: number }) {
    if (!feature) {
      setSelectedLsoaProps(null);
      setScores(null);
      setTop([]);
      setShowMethodology(false);
      setSelectedPoint({ lat: point.lat, lng: point.lng });
      return;
    }

    setSelectedPoint({ lat: point.lat, lng: point.lng });
    setSelectedLsoaProps(feature.properties);

    const s = calcScores(feature.properties);
    setScores(s);
    setTop(themes(s));
    setShowMethodology(false);
  }

  function searchPostcode() {
    if (!lookup || !lsoa) return;

    const pc = postcode.trim().replace(/\s+/g, "").toUpperCase();

const found = lookup.features.find((f: any) => {
  const candidate = String(f.properties?.pcd7 || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  return candidate === pc;
});

if (!found) {
  alert("Postcode not found");
  return;
}

const props = found.properties;
setSelectedLookupRow(props);
setSiteCoords(null);
setSiteNearestPostcode(null);

const lsoaCode = props.lsoa21cd;
const lsoaMatch =
  lsoa.features.find((f: any) => getFeatureLsoaCode(f.properties) === lsoaCode) ||
  findLsoaByPoint(lsoa, Number(props.long), Number(props.lat));

applySelectedFeature(lsoaMatch, {
  lng: Number(props.long),
  lat: Number(props.lat),
});
  }

  useEffect(() => {
    if (!siteCoords || !lsoa || !lookup) return;

    const lsoaMatch = findLsoaByPoint(lsoa, siteCoords.lng, siteCoords.lat);
    const nearestPostcode = findClosestPostcode(
      lookup,
      siteCoords.lat,
      siteCoords.lng
    );

    setSelectedLookupRow(null);
    setSiteNearestPostcode(nearestPostcode);
    applySelectedFeature(lsoaMatch, siteCoords);
  }, [siteCoords, lsoa, lookup]);

  const activePoiLegend = useMemo(
    () =>
      [
        poiToggles.skills && { label: "Skills Providers", color: "#2563eb" },
        poiToggles.youth && { label: "Youth Provision", color: "#7c3aed" },
        poiToggles.community && { label: "Community Centres", color: "#0891b2" },
        poiToggles.foodbanks && { label: "Foodbanks", color: "#dc2626" },
        poiToggles.gps && { label: "GP Surgeries", color: "#16a34a" },
        poiToggles.hospitals && { label: "Hospitals", color: "#ea580c" },
        poiToggles.schools && { label: "Schools / Colleges", color: "#ca8a04" },
      ].filter(Boolean) as { label: string; color: string }[],
    [poiToggles]
  );

  const recommendedAssets = useMemo(
    () => recommendedAssetsFromThemes(top),
    [top]
  );

  const hasSelection = Boolean(selectedLookupRow || siteCoords || scores);

  const selectedAreaLabel =
    lookupMode === "postcode"
      ? selectedLookupRow?.postcode || "No postcode selected"
      : siteCoords
      ? `Site${siteNearestPostcode ? ` (${siteNearestPostcode})` : ""}`
      : "No site selected";

  const scoreCards = scores
    ? [
        {
          label: "Economic Inclusion",
          value: scores.economicInclusion,
          toms: "NT1, NT2, NT10",
        },
        {
          label: "Skills And Progression",
          value: scores.skillsOpportunity,
          toms: "NT11, NT12, NT13",
        },
        {
          label: "Health And Wellbeing",
          value: scores.healthWellbeing,
          toms: "NT17, NT18",
        },
        {
          label: "Household Resilience",
          value: scores.householdResilience,
          toms: "NT18, NT19",
        },
        {
          label: "Environmental Sustainability",
          value: scores.environmentalSustainability,
          toms: "NT30, NT31, NT33",
        },
      ]
    : [];

  function toggleRecommendedAsset(asset: RecommendedAsset) {
    if (!asset.key) return;

    const key = asset.key;

    setPoiToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

    setMapPanelTab("partners");
  }

  const baseButtonClass =
    "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors";
  const activeButtonStyle = { background: "#00285B", color: "white" };
  const inactiveButtonStyle = { background: "#2fa4df", color: "white" };

  return (
    <main
      style={{ background: "#00285B" }}
      className="min-h-screen px-3 py-4 md:px-6 md:py-8"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 w-full rounded-2xl bg-white p-4 shadow-md md:mb-8 md:p-6">
          <div className="flex w-full flex-col items-center justify-center gap-3 text-center">
            <img
              src="/logo.png"
              alt="MapHorizon Logo"
              className="h-10 w-auto object-contain md:h-[60px]"
            />

            <div className="w-full text-center">
              <h1 className="text-2xl font-bold leading-tight text-black md:text-4xl">
                Social Value Opportunity Checker
              </h1>
              <div className="mt-1 text-sm text-black md:text-base">
                Powered by MapHorizon Geospatial Intelligence
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 w-full rounded-2xl bg-white p-4 shadow-md md:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => setLookupMode("postcode")}
              className={`${baseButtonClass} w-full sm:w-auto`}
              style={
                lookupMode === "postcode"
                  ? activeButtonStyle
                  : inactiveButtonStyle
              }
            >
              Postcode Lookup
            </button>

            <button
              type="button"
              onClick={() => setLookupMode("site")}
              className={`${baseButtonClass} w-full sm:w-auto`}
              style={
                lookupMode === "site" ? activeButtonStyle : inactiveButtonStyle
              }
            >
              Site Lookup
            </button>
          </div>

          {lookupMode === "postcode" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                searchPostcode();
              }}
              className="flex w-full flex-col gap-3 sm:flex-row"
            >
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="Enter Postcode"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-black outline-none focus:border-slate-500"
              />
              <button
                type="submit"
                style={{ background: "#2fa4df" }}
                className="w-full rounded-xl px-5 py-3 text-sm font-medium text-white sm:w-auto"
              >
                Check Opportunity
              </button>
            </form>
          ) : (
            <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              Click anywhere on the map to select a site location and run
              screening.
            </div>
          )}
        </div>

        {loading && (
          <div className="w-full rounded-2xl bg-white p-4 shadow-md md:p-6">
            Loading data...
          </div>
        )}

        {!loading && (
          <div className="grid w-full items-start gap-4 md:gap-6 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="flex min-w-0 flex-col">
              <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                <div className="h-[52vh] min-h-[380px] max-h-[620px] md:h-[70vh]">
                  <MapView
                    lat={selectedPoint.lat}
                    lng={selectedPoint.lng}
                    mapLayer={mapLayer}
                    popupData={selectedLsoaProps}
                    poiToggles={poiToggles}
                    lookupMode={lookupMode}
                    onSiteSelect={(coords) => setSiteCoords(coords)}
                  />
                </div>
              </div>

              <div className="mt-3 rounded-2xl bg-white p-4 text-sm shadow-md">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMapPanelTab("layers")}
                    className={`${baseButtonClass} w-full sm:w-auto`}
                    style={
                      mapPanelTab === "layers"
                        ? activeButtonStyle
                        : inactiveButtonStyle
                    }
                  >
                    Layers
                  </button>

                  <button
                    type="button"
                    onClick={() => setMapPanelTab("partners")}
                    className={`${baseButtonClass} w-full sm:w-auto`}
                    style={
                      mapPanelTab === "partners"
                        ? activeButtonStyle
                        : inactiveButtonStyle
                    }
                  >
                    Local Partners
                  </button>
                </div>

                {mapPanelTab === "layers" && (
                  <div>
                    <div className="mb-2 font-semibold text-black">Map Layer</div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        ["none", "Base Map"],
                        ["imd", "IMD"],
                        ["income", "Income"],
                        ["employment", "Employment"],
                        ["education", "Education"],
                        ["health", "Health"],
                        ["fuel", "Fuel Poverty"],
                        ["jobs", "Employment Access"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setMapLayer(value as MapLayer)}
                          className={baseButtonClass}
                          style={
                            mapLayer === value
                              ? activeButtonStyle
                              : inactiveButtonStyle
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-slate-700">
                      <strong>Layer Description:</strong> {layerDescription(mapLayer)}
                    </div>

                    <div className="mt-4">
                      <strong className="text-black">Legend</strong>

                      {mapLayer !== "none" && (
                        <div className="mt-3">
                          <div className="mb-2 font-semibold text-black">
                            Map Legend
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {(mapLayer === "imd" ||
                              mapLayer === "income" ||
                              mapLayer === "employment" ||
                              mapLayer === "education" ||
                              mapLayer === "health") && (
                              <>
                                <span>
                                  <span style={{ color: "#7f1d1d" }}>■</span> Higher
                                  Need
                                </span>
                                <span>
                                  <span style={{ color: "#f97316" }}>■</span> Medium
                                </span>
                                <span>
                                  <span style={{ color: "#22c55e" }}>■</span> Lower
                                  Need
                                </span>
                              </>
                            )}

                            {mapLayer === "fuel" && (
                              <>
                                <span>
                                  <span style={{ color: "#16a34a" }}>■</span> Lower
                                </span>
                                <span>
                                  <span style={{ color: "#facc15" }}>■</span> Medium
                                </span>
                                <span>
                                  <span style={{ color: "#7f1d1d" }}>■</span> Higher
                                </span>
                              </>
                            )}

                            {mapLayer === "jobs" && (
                              <>
                                <span>
                                  <span style={{ color: "#7f1d1d" }}>■</span> Poor
                                  Access
                                </span>
                                <span>
                                  <span style={{ color: "#facc15" }}>■</span> Medium
                                </span>
                                <span>
                                  <span style={{ color: "#16a34a" }}>■</span> Better
                                  Access
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {activePoiLegend.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-2 font-semibold text-black">
                            Community Asset Legend
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {activePoiLegend.map((item) => (
                              <span key={item.label}>
                                <span style={{ color: item.color }}>●</span>{" "}
                                {item.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {mapLayer === "none" && activePoiLegend.length === 0 && (
                        <div className="mt-2 text-slate-600">
                          Turn on a map layer or community asset to populate the
                          legend.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {mapPanelTab === "partners" && (
                  <div>
                    {hasSelection ? (
                      <>
                        <strong className="text-black">Local Partners</strong>
                        <div className="mt-2 text-sm text-slate-600">
                          Based on the strongest local themes, these are the most
                          relevant assets to review and, where appropriate, turn on
                          in the map.
                        </div>

                        <div className="mt-3 space-y-3">
                          {recommendedAssets.map((asset) => {
                            const isToggleable = Boolean(asset.key);
                            const isOn = asset.key ? poiToggles[asset.key] : false;

                            return (
                              <div
                                key={asset.label}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="font-semibold text-black">
                                      {asset.label}
                                    </div>
                                    <div className="mt-1 text-sm text-slate-600">
                                      {asset.reason}
                                    </div>
                                  </div>

                                  {isToggleable ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleRecommendedAsset(asset)}
                                      className="w-full shrink-0 rounded-lg px-3 py-2 text-sm text-white sm:w-auto"
                                      style={{
                                        background: isOn ? "#00285B" : "#2fa4df",
                                      }}
                                    >
                                      {isOn ? "Hide On Map" : "Show On Map"}
                                    </button>
                                  ) : (
                                    <div className="w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-500 sm:w-auto">
                                      Reference Layer
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 text-sm text-slate-600">
                          This links <strong>priority themes</strong> to
                          <strong> local delivery assets</strong>, making the output
                          more practical for TOMS-aligned interventions,
                          partnerships and bids.
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                        Select a postcode or site to populate local partners.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl bg-white p-4 shadow-md md:p-6">
              <h2 className="mb-3 break-words text-xl font-semibold text-black md:text-2xl">
                {selectedAreaLabel}
              </h2>

              {hasSelection && (
                <div className="mb-4 text-sm text-black">
                  {lookupMode === "postcode" ? (
                    <>
                      <div>
                        LSOA:{" "}
                        {selectedLookupRow?.lsoa_code ||
                          selectedLsoaProps?.["LSOA21CD"] ||
                          selectedLsoaProps?.["LSOA11CD"]}
                      </div>
                      <div>
                        IMD Decile:{" "}
                        {selectedLookupRow?.imd_decile ??
                          selectedLsoaProps?.["IMD Decile"]}
                      </div>
                    </>
                  ) : (
                    <>
                      {(selectedLsoaProps?.["LSOA21CD"] ||
                        selectedLsoaProps?.["LSOA11CD"]) && (
                        <div>
                          LSOA:{" "}
                          {selectedLsoaProps?.["LSOA21CD"] ||
                            selectedLsoaProps?.["LSOA11CD"]}
                        </div>
                      )}
                      {siteNearestPostcode && (
                        <div>Nearest postcode: {siteNearestPostcode}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!scores && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  {lookupMode === "postcode"
                    ? "Enter a postcode and run the lookup."
                    : "Click a site location on the map to run screening."}
                </div>
              )}

              {scores && (
                <>
                  <div
                    style={{ background: "#00285B" }}
                    className="mb-4 rounded-xl p-4 text-white"
                  >
                    <div className="text-sm font-medium uppercase tracking-wide text-blue-100">
                      Overall Materiality
                    </div>
                    <div className="mt-1 text-3xl font-bold">
                      {scores.overallMateriality}/100
                    </div>
                    <div className="mt-1 text-sm">{band(scores.overallMateriality)}</div>
                  </div>

                  <div className="mb-5">
                    <strong className="text-black">Theme Scores</strong>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {scoreCards.map((card) => (
                        <div
                          key={card.label}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="text-xs font-semibold text-black md:text-sm">
                            {card.label}
                          </div>
                          <div className="mt-1 text-xl font-bold text-black md:text-2xl">
                            {card.value}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            TOMS: {card.toms}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <strong className="text-black">Priority Themes Ranked</strong>
                    <ul className="mt-2 list-disc pl-5 text-black">
                      {top.map((t) => (
                        <li key={t.name}>
                          {t.name} ({t.value}) —{" "}
                          <span className="text-slate-600">TOMS {t.toms}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => setDetailTab("toms")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={
                          detailTab === "toms"
                            ? activeButtonStyle
                            : inactiveButtonStyle
                        }
                      >
                        TOMS
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab("why")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={
                          detailTab === "why"
                            ? activeButtonStyle
                            : inactiveButtonStyle
                        }
                      >
                        Why It Matters
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab("actions")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={
                          detailTab === "actions"
                            ? activeButtonStyle
                            : inactiveButtonStyle
                        }
                      >
                        Actions
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab("method")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={
                          detailTab === "method"
                            ? activeButtonStyle
                            : inactiveButtonStyle
                        }
                      >
                        Method
                      </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      {detailTab === "toms" && (
                        <div>
                          <strong className="text-black">TOMS Alignment</strong>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[420px] border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-100">
                                  <th className="border border-slate-200 p-2 text-left text-black">
                                    Theme
                                  </th>
                                  <th className="border border-slate-200 p-2 text-left text-black">
                                    TOMS Codes
                                  </th>
                                  <th className="border border-slate-200 p-2 text-left text-black">
                                    Score
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {top.map((t) => (
                                  <tr key={t.name}>
                                    <td className="border border-slate-200 p-2 text-black">
                                      {t.name}
                                    </td>
                                    <td className="border border-slate-200 p-2 text-black">
                                      {t.toms}
                                    </td>
                                    <td className="border border-slate-200 p-2 text-black">
                                      {t.value}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {detailTab === "why" && (
                        <div>
                          <strong className="text-black">
                            Why This Theme Matters Locally
                          </strong>
                          <ul className="mt-3 list-disc pl-5 text-black">
                            {top.map((t) => (
                              <li key={t.name}>
                                <strong>{t.name}:</strong> {t.why}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {detailTab === "actions" && (
                        <div>
                          <strong className="text-black">
                            Suggested Interventions
                          </strong>
                          <ul className="mt-3 list-disc pl-5 text-black">
                            {top.flatMap((t) => t.actions).map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {detailTab === "method" && (
                        <div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <strong className="text-black">
                              How This Score Is Calculated
                            </strong>
                            <button
                              type="button"
                              onClick={() => setShowMethodology(!showMethodology)}
                              className="rounded-lg px-4 py-2 text-sm text-white"
                              style={{ background: "#00285B" }}
                            >
                              {showMethodology ? "Hide Detail" : "Show Detail"}
                            </button>
                          </div>

                          <p className="mt-3 text-sm text-black">
                            The Overall Materiality Score is an indicative
                            screening score out of 100. It combines five themes
                            aligned to TOMS-related social and environmental
                            outcomes.
                          </p>

                          {showMethodology && (
                            <>
                              <ul className="mt-3 list-disc pl-5 text-sm text-black">
                                <li>
                                  <strong>Economic Inclusion</strong> — Income
                                  deprivation, employment deprivation, and access
                                  to employment within 30 minutes.
                                </li>
                                <li>
                                  <strong>Skills And Progression</strong> —
                                  Education, skills and training deprivation and
                                  employment conditions.
                                </li>
                                <li>
                                  <strong>Health And Wellbeing</strong> — Health
                                  deprivation and disability and access to GPs
                                  within 15 minutes.
                                </li>
                                <li>
                                  <strong>Household Resilience</strong> — Fuel
                                  poverty, income pressures, and access to food
                                  stores within 15 minutes.
                                </li>
                                <li>
                                  <strong>Environmental Sustainability</strong> —
                                  Screening indicator based on local greenspace
                                  presence and priority habitat presence.
                                </li>
                              </ul>

                              <p className="mt-3 text-sm text-black">
                                <strong>Weighting</strong>
                                <br />
                                Economic Inclusion 25%
                                <br />
                                Skills And Progression 20%
                                <br />
                                Health And Wellbeing 20%
                                <br />
                                Household Resilience 20%
                                <br />
                                Environmental Sustainability 15%
                              </p>

                              <p className="mt-3 text-sm text-black">
                                <strong>Environmental Theme Logic</strong>
                                <br />
                                `has_greenspace = 1` contributes a moderate
                                positive environmental relevance score.
                                <br />
                                `has_priority_habitat = 1` contributes a stronger
                                biodiversity relevance score.
                              </p>
                            </>
                          )}

                          <p className="mt-3 text-sm text-slate-600">
                            Higher scores indicate themes are more likely to be
                            materially relevant in the selected area. This
                            supports early-stage screening, targeting and
                            TOMS-aligned intervention planning.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
