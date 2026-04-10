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
  work: number;
  economy: number;
  community: number;
  planet: number;
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
type DetailTab = "themes" | "why" | "actions" | "method";

const DEFAULT_CENTER = {
  lat: 53.2403,
  lng: -2.734,
};

function num(v: unknown) {
  return Number(String(v ?? "").replace("%", "").trim());
}

function safeNumber(v: number, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function decileNeed(d: number) {
  const value = safeNumber(d, 10);
  return Math.max(0, Math.min(100, (11 - value) * 10));
}

function pctNeed(p: number) {
  const value = safeNumber(p, 100);
  return Math.max(0, Math.min(100, 100 - value));
}

function fuelNeed(p: number) {
  const value = safeNumber(p, 0);
  return Math.max(0, Math.min(100, value * 5));
}

function environmentalScore(p: Record<string, unknown>) {
  const hasGreenspace = Number(p["has_greenspace"] ?? 0);
  const hasPriorityHabitat = Number(p["has_priority_habitat"] ?? 0);

  const greenspaceScore = hasGreenspace === 1 ? 60 : 20;
  const habitatScore = hasPriorityHabitat === 1 ? 80 : 20;

  return Math.round(greenspaceScore * 0.5 + habitatScore * 0.5);
}

function calcScores(p: Record<string, unknown>): Scores {
  const income = decileNeed(num(p["Income Decile"]));
  const employment = decileNeed(num(p["Employment Decile"]));
  const education = decileNeed(num(p["Education, Skills and Training Decile"]));
  const health = decileNeed(num(p["Health Deprivation and Disability Decile"]));

  const gp = pctNeed(num(p["Users within 15 minutes of GPs by PT/walk (%)"]));
  const jobsAccess = pctNeed(
    num(p["Users within 30 minutes of Employment by PT/walk (%)"])
  );
  const food = pctNeed(
    num(p["Users within 15 minutes of Food Store by PT/walk (%)"])
  );
  const fuel = fuelNeed(num(p["Households Fuel Poor (%)"]));

  const work = employment * 0.45 + education * 0.35 + jobsAccess * 0.2;
  const economy = income * 0.5 + employment * 0.25 + jobsAccess * 0.25;
  const community = health * 0.35 + fuel * 0.25 + gp * 0.2 + food * 0.2;
  const planet = environmentalScore(p);

  const overallMateriality = (work + economy + community + planet) / 4;

  return {
    work: Math.round(work),
    economy: Math.round(economy),
    community: Math.round(community),
    planet: Math.round(planet),
    overallMateriality: Math.round(overallMateriality),
  };
}

function band(v: number) {
  if (v >= 70) return "High";
  if (v >= 45) return "Moderate";
  return "Low";
}

function themes(scores: Scores): ThemeItem[] {
  const t: ThemeItem[] = [
    {
      name: "Work",
      value: scores.work,
      toms: "Work",
      why:
        "Employment access, labour market exclusion and skills deprivation suggest relevance for local hiring, apprenticeships and routes into work.",
      actions: ["Local Hiring", "Apprenticeships", "Work Placements"],
    },
    {
      name: "Economy",
      value: scores.economy,
      toms: "Economy",
      why:
        "Income and economic participation indicators suggest potential for inclusive growth, SME engagement and stronger local supply chain activity.",
      actions: ["SME Procurement", "Local Supply Chain", "Enterprise Support"],
    },
    {
      name: "Community",
      value: scores.community,
      toms: "Community",
      why:
        "Health, affordability and access indicators suggest scope for wellbeing, resilience and access-to-services interventions.",
      actions: [
        "Community Wellbeing",
        "Fuel Poverty Support",
        "Access to Services",
      ],
    },
    {
      name: "Planet",
      value: scores.planet,
      toms: "Planet",
      why:
        "Environmental context indicates potential relevance for biodiversity enhancement, access to nature and place-based environmental improvement.",
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
    return "Education, skills and training deprivation. Useful for identifying areas where skills investment may be more material.";
  }
  if (layer === "health") {
    return "Health deprivation and disability. Highlights areas with greater health and wellbeing pressures.";
  }
  if (layer === "fuel") {
    return "Fuel poverty. Shows areas where household energy affordability pressures are higher.";
  }
  return "Employment accessibility by public transport and walking within 30 minutes. Lower access suggests greater mobility constraints.";
}

function getFeatureLsoaCode(properties: Record<string, unknown>) {
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
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

function findClosestPostcode(lookup: any, lat: number, lng: number): string | null {
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

function recommendedAssetsFromThemes(topThemes: ThemeItem[]): RecommendedAsset[] {
  const assetMap: Record<string, RecommendedAsset[]> = {
    Work: [
      {
        label: "Skills Providers",
        key: "skills",
        reason:
          "Useful for employability pathways, training activity and routes into work.",
      },
      {
        label: "Schools / Colleges",
        key: "schools",
        reason:
          "Relevant for careers engagement, outreach and early talent pipelines.",
      },
      {
        label: "Youth Provision",
        key: "youth",
        reason:
          "Useful for mentoring, aspiration-building and youth-focused opportunity creation.",
      },
    ],
    Economy: [
      {
        label: "Community Centres",
        key: "community",
        reason:
          "Can support local enterprise outreach, community delivery and place-based partnership activity.",
      },
      {
        label: "Skills Providers",
        key: "skills",
        reason:
          "Helpful where economic participation is linked to skills support and workforce development.",
      },
    ],
    Community: [
      {
        label: "GP Surgeries",
        key: "gps",
        reason:
          "Helpful for understanding local health service presence and wider wellbeing context.",
      },
      {
        label: "Hospitals",
        key: "hospitals",
        reason:
          "Relevant where broader health access and resilience pressures are part of the picture.",
      },
      {
        label: "Foodbanks",
        key: "foodbanks",
        reason:
          "Useful indicator of immediate household support need and resilience pressure.",
      },
      {
        label: "Community Centres",
        key: "community",
        reason:
          "Can support advice services, community delivery and trusted local engagement.",
      },
    ],
    Planet: [
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
          "Can support stewardship, volunteering and local environmental activity.",
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
  const [detailTab, setDetailTab] = useState<DetailTab>("themes");

  const [selectedPoint, setSelectedPoint] = useState(DEFAULT_CENTER);
  const [selectedLsoaProps, setSelectedLsoaProps] = useState<any>(null);
  const [selectedLookupRow, setSelectedLookupRow] = useState<LookupRow | null>(null);
  const [siteCoords, setSiteCoords] = useState<{ lng: number; lat: number } | null>(
    null
  );
  const [siteNearestPostcode, setSiteNearestPostcode] = useState<string | null>(null);

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
    setSelectedPoint({ lat: point.lat, lng: point.lng });
    setShowMethodology(false);

    if (!feature) {
      setSelectedLsoaProps(null);
      setScores(null);
      setTop([]);
      return;
    }

    setSelectedLsoaProps(feature.properties);

    const s = calcScores(feature.properties);
    setScores(s);
    setTop(themes(s));
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
    const nearestPostcode = findClosestPostcode(lookup, siteCoords.lat, siteCoords.lng);

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

  const recommendedAssets = useMemo(() => recommendedAssetsFromThemes(top), [top]);

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
          label: "Work",
          value: scores.work,
          detail: "Employment, skills and pathways into work",
        },
        {
          label: "Economy",
          value: scores.economy,
          detail: "Inclusive growth and local economic participation",
        },
        {
          label: "Community",
          value: scores.community,
          detail: "Wellbeing, resilience and access to essentials",
        },
        {
          label: "Planet",
          value: scores.planet,
          detail: "Biodiversity, greenspace and environmental value",
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
    "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none";
  const activeButtonStyle = { background: "#00285B", color: "white" };
  const inactiveButtonStyle = { background: "#2fa4df", color: "white" };
  const calloutClass = "rounded-xl bg-slate-50 p-4 text-sm text-black";
  const mutedTextClass = "text-sm text-black";

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
                National TOMs 2025 screening aligned to Work, Economy, Community and Planet.
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
              style={lookupMode === "postcode" ? activeButtonStyle : inactiveButtonStyle}
            >
              Postcode Lookup
            </button>

            <button
              type="button"
              onClick={() => setLookupMode("site")}
              className={`${baseButtonClass} w-full sm:w-auto`}
              style={lookupMode === "site" ? activeButtonStyle : inactiveButtonStyle}
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
            <div className={calloutClass}>
              Click anywhere on the map to select a site location and run screening.
            </div>
          )}
        </div>

        {loading && (
          <div className="w-full rounded-2xl bg-white p-4 shadow-md md:p-6 text-black">
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
                    style={mapPanelTab === "layers" ? activeButtonStyle : inactiveButtonStyle}
                  >
                    Layers
                  </button>

                  <button
                    type="button"
                    onClick={() => setMapPanelTab("partners")}
                    className={`${baseButtonClass} w-full sm:w-auto`}
                    style={mapPanelTab === "partners" ? activeButtonStyle : inactiveButtonStyle}
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
                          style={mapLayer === value ? activeButtonStyle : inactiveButtonStyle}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-black">
                      <strong>Layer Description:</strong> {layerDescription(mapLayer)}
                    </div>

                    <div className="mt-4 text-black">
                      <strong>Legend</strong>

                      {mapLayer !== "none" && (
                        <div className="mt-3">
                          <div className="mb-2 font-semibold text-black">Map Legend</div>

                          <div className="flex flex-wrap gap-3 text-black">
                            {[
                              "imd",
                              "income",
                              "employment",
                              "education",
                              "health",
                            ].includes(mapLayer) && (
                              <>
                                <span>
                                  <span style={{ color: "#7f1d1d" }}>■</span> Higher Need
                                </span>
                                <span>
                                  <span style={{ color: "#f97316" }}>■</span> Medium
                                </span>
                                <span>
                                  <span style={{ color: "#22c55e" }}>■</span> Lower Need
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
                                  <span style={{ color: "#7f1d1d" }}>■</span> Poor Access
                                </span>
                                <span>
                                  <span style={{ color: "#facc15" }}>■</span> Medium
                                </span>
                                <span>
                                  <span style={{ color: "#16a34a" }}>■</span> Better Access
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
                          <div className="flex flex-wrap gap-3 text-black">
                            {activePoiLegend.map((item) => (
                              <span key={item.label}>
                                <span style={{ color: item.color }}>●</span> {item.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {mapLayer === "none" && activePoiLegend.length === 0 && (
                        <div className="mt-2 text-black">
                          Turn on a map layer or community asset to populate the legend.
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
                        <div className="mt-2 text-sm text-black">
                          Based on the strongest local themes, these are the most relevant
                          assets to review and, where appropriate, turn on in the map.
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
                                    <div className="font-semibold text-black">{asset.label}</div>
                                    <div className="mt-1 text-sm text-black">{asset.reason}</div>
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
                                    <div className="w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs text-black sm:w-auto">
                                      Reference Layer
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 text-sm text-black">
                          This links <strong>priority themes</strong> to
                          <strong> local delivery assets</strong>, making the output more
                          practical for TOMs-aligned interventions, partnerships and bids.
                        </div>
                      </>
                    ) : (
                      <div className={calloutClass}>
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
                        {selectedLookupRow?.imd_decile ?? selectedLsoaProps?.["IMD Decile"]}
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
                      {siteNearestPostcode && <div>Nearest postcode: {siteNearestPostcode}</div>}
                    </>
                  )}
                </div>
              )}

              {!scores && (
                <div className={calloutClass}>
                  {lookupMode === "postcode"
                    ? "Enter a postcode and run the lookup."
                    : "Click a site location on the map to run screening."}
                </div>
              )}

              {scores && (
                <>
                  <div style={{ background: "#00285B" }} className="mb-4 rounded-xl p-4 text-white">
                    <div className="text-sm font-medium uppercase tracking-wide text-blue-100">
                      Overall Materiality
                    </div>
                    <div className="mt-1 text-3xl font-bold">{scores.overallMateriality}/100</div>
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
                          <div className="mt-1 text-xs text-black">{card.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <strong className="text-black">Priority Themes Ranked</strong>
                    <ul className="mt-2 list-disc pl-5 text-black">
                      {top.map((t) => (
                        <li key={t.name}>
                          {t.name} ({t.value})
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-5">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => setDetailTab("themes")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={detailTab === "themes" ? activeButtonStyle : inactiveButtonStyle}
                      >
                        Theme Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("why")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={detailTab === "why" ? activeButtonStyle : inactiveButtonStyle}
                      >
                        Why It Matters
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("actions")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={detailTab === "actions" ? activeButtonStyle : inactiveButtonStyle}
                      >
                        Suggested Actions
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("method")}
                        className={`${baseButtonClass} w-full sm:w-auto`}
                        style={detailTab === "method" ? activeButtonStyle : inactiveButtonStyle}
                      >
                        Method Summary
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-black">
                      {detailTab === "themes" && (
                        <div className="space-y-3">
                          {top.map((item) => (
                            <div key={item.name} className="rounded-xl bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-black">{item.name}</div>
                                  <div className="text-sm text-black">National TOMs 2025 theme</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-bold text-black">{item.value}</div>
                                  <div className="text-xs text-black">{band(item.value)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {detailTab === "why" && (
                        <div className="space-y-3">
                          {top.map((item) => (
                            <div key={item.name} className="rounded-xl bg-white p-3">
                              <div className="font-semibold text-black">{item.name}</div>
                              <p className="mt-1 text-sm text-black">{item.why}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {detailTab === "actions" && (
                        <div className="space-y-3">
                          {top.map((item) => (
                            <div key={item.name} className="rounded-xl bg-white p-3">
                              <div className="font-semibold text-black">{item.name}</div>
                              <ul className="mt-2 list-disc pl-5 text-sm text-black">
                                {item.actions.map((action) => (
                                  <li key={action}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {detailTab === "method" && (
                        <>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <strong className="text-black">How This Score Is Calculated</strong>
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
                            The Overall Materiality Score is an indicative screening score
                            out of 100. It uses the National TOMs 2025 structure and ranks
                            the relative relevance of four themes: Work, Economy, Community
                            and Planet. Each theme contributes 25% to the final score.
                          </p>

                          {showMethodology && (
                            <>
                              <ul className="mt-3 list-disc pl-5 text-sm text-black">
                                <li>
                                  <strong>Work</strong> combines employment deprivation,
                                  education and skills deprivation, and access to employment
                                  within 30 minutes.
                                </li>
                                <li>
                                  <strong>Economy</strong> combines income deprivation,
                                  employment conditions and access to employment as a proxy for
                                  local economic participation.
                                </li>
                                <li>
                                  <strong>Community</strong> combines health deprivation, fuel
                                  poverty, GP access and access to food stores as a proxy for
                                  wellbeing and resilience.
                                </li>
                                <li>
                                  <strong>Planet</strong> is a screening indicator based on
                                  local greenspace presence and priority habitat presence.
                                </li>
                              </ul>

                              <p className="mt-3 text-sm text-black">
                                <strong>Weighting</strong>
                                <br />
                                Each theme contributes equally to the Overall Materiality
                                Score.
                                <br />
                                Work 25%
                                <br />
                                Economy 25%
                                <br />
                                Community 25%
                                <br />
                                Planet 25%
                              </p>

                              <p className="mt-3 text-sm text-black">
                                <strong>Work Logic</strong>
                                <br />
                                Employment deprivation contributes most strongly, followed by
                                education and skills deprivation, then employment access.
                              </p>

                              <p className="mt-3 text-sm text-black">
                                <strong>Economy Logic</strong>
                                <br />
                                Income deprivation drives the score most strongly, with
                                employment conditions and access acting as supporting signals.
                              </p>

                              <p className="mt-3 text-sm text-black">
                                <strong>Community Logic</strong>
                                <br />
                                Health pressures, fuel poverty and access to core services are
                                combined to show where wellbeing and resilience interventions
                                may be most material.
                              </p>

                              <p className="mt-3 text-sm text-black">
                                <strong>Planet Logic</strong>
                                <br />
                                <code>has_greenspace = 1</code> contributes a moderate
                                environmental relevance score.
                                <br />
                                <code>has_priority_habitat = 1</code> contributes a stronger
                                biodiversity relevance score.
                              </p>

                              <p className="mt-3 text-sm text-black">
                                <strong>Overall Score Logic</strong>
                                <br />
                                The Overall Materiality Score is the simple average of the
                                Work, Economy, Community and Planet scores. No additional
                                weighting or uplift is applied, so each theme has the same
                                influence on the final score.
                              </p>
                            </>
                          )}

                          <p className="mt-3 text-sm text-black">
                            Higher scores indicate themes are more likely to be materially
                            relevant in the selected area. This supports early-stage
                            screening, targeting and TOMs-aligned intervention planning. It
                            does not directly measure social value delivered.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={calloutClass}>
                    <strong>Interpretation</strong>
                    <div className="mt-2 text-sm text-black">
                      Use this output to identify which National TOMs themes appear most
                      material locally, then shape delivery activity, partner selection and
                      bid narrative around the highest-ranked themes.
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
