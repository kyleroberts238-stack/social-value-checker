"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapLayer =
  | "none"
  | "imd"
  | "income"
  | "employment"
  | "education"
  | "health"
  | "fuel"
  | "jobs";

export type PoiToggles = {
  skills: boolean;
  youth: boolean;
  community: boolean;
  foodbanks: boolean;
  gps: boolean;
  hospitals: boolean;
  schools: boolean;
};

export type LookupMode = "postcode" | "site";

type Props = {
  lat: number;
  lng: number;
  mapLayer: MapLayer;
  popupData?: any;
  poiToggles?: PoiToggles;
  lookupMode?: LookupMode;
  onSiteSelect?: (coords: { lng: number; lat: number }) => void;
};

function getFillExpression(layer: MapLayer) {
  if (layer === "none") {
    return "rgba(0,0,0,0)";
  }

  if (layer === "imd") {
    return [
      "interpolate",
      ["linear"],
      ["coalesce", ["to-number", ["get", "IMD Decile"]], 0],
      0,
      "rgba(0,0,0,0)",
      1,
      "#7f1d1d",
      3,
      "#b91c1c",
      5,
      "#f97316",
      7,
      "#facc15",
      9,
      "#22c55e",
      10,
      "#16a34a",
    ];
  }

  if (layer === "income") {
    return [
      "interpolate",
      ["linear"],
      ["coalesce", ["to-number", ["get", "Income Decile"]], 0],
      0,
      "rgba(0,0,0,0)",
      1,
      "#7f1d1d",
      3,
      "#b91c1c",
      5,
      "#f97316",
      7,
      "#facc15",
      9,
      "#22c55e",
      10,
      "#16a34a",
    ];
  }

  if (layer === "employment") {
    return [
      "interpolate",
      ["linear"],
      ["coalesce", ["to-number", ["get", "Employment Decile"]], 0],
      0,
      "rgba(0,0,0,0)",
      1,
      "#7f1d1d",
      3,
      "#b91c1c",
      5,
      "#f97316",
      7,
      "#facc15",
      9,
      "#22c55e",
      10,
      "#16a34a",
    ];
  }

  if (layer === "education") {
    return [
      "interpolate",
      ["linear"],
      [
        "coalesce",
        ["to-number", ["get", "Education, Skills and Training Decile"]],
        0,
      ],
      0,
      "rgba(0,0,0,0)",
      1,
      "#7f1d1d",
      3,
      "#b91c1c",
      5,
      "#f97316",
      7,
      "#facc15",
      9,
      "#22c55e",
      10,
      "#16a34a",
    ];
  }

  if (layer === "health") {
    return [
      "interpolate",
      ["linear"],
      [
        "coalesce",
        ["to-number", ["get", "Health Deprivation and Disability Decile"]],
        0,
      ],
      0,
      "rgba(0,0,0,0)",
      1,
      "#7f1d1d",
      3,
      "#b91c1c",
      5,
      "#f97316",
      7,
      "#facc15",
      9,
      "#22c55e",
      10,
      "#16a34a",
    ];
  }

  if (layer === "fuel") {
    return [
      "interpolate",
      ["linear"],
      ["coalesce", ["to-number", ["get", "Households Fuel Poor (%)"]], 0],
      0,
      "rgba(0,0,0,0)",
      5,
      "#84cc16",
      10,
      "#facc15",
      15,
      "#f97316",
      20,
      "#dc2626",
      25,
      "#7f1d1d",
    ];
  }

  return [
    "interpolate",
    ["linear"],
    [
      "coalesce",
      [
        "to-number",
        ["get", "Users within 30 minutes of Employment by PT/walk (%)"],
      ],
      0,
    ],
    0,
    "rgba(0,0,0,0)",
    20,
    "#dc2626",
    40,
    "#f97316",
    60,
    "#facc15",
    80,
    "#84cc16",
    100,
    "#16a34a",
  ];
}

function firstDefined(obj: any, keys: string[]) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function buildPoiPopupHtml(feature: any, label: string) {
  const props = feature?.properties || {};

  const title =
    firstDefined(props, [
      "name",
      "Name",
      "site_name",
      "SiteName",
      "Organisation",
      "Organisation Name",
      "Provider",
      "School",
      "Centre",
      "Practice",
      "Hospital",
    ]) || label;

  const address =
    firstDefined(props, [
      "address",
      "Address",
      "full_address",
      "FullAddress",
      "ADDRESS",
      "addr",
      "Address 1",
    ]) || null;

  const postcode =
    firstDefined(props, ["postcode", "Postcode", "POSTCODE", "post_code"]) ||
    null;

  const website =
    firstDefined(props, ["website", "Website", "url", "URL", "web"]) || null;

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.45;min-width:220px;max-width:280px;">
      <div style="font-weight:700;margin-bottom:6px;">${title}</div>
      <div style="margin-bottom:4px;"><strong>Type:</strong> ${label}</div>
      ${address ? `<div><strong>Address:</strong> ${address}</div>` : ""}
      ${postcode ? `<div><strong>Postcode:</strong> ${postcode}</div>` : ""}
      ${
        website
          ? `<div style="margin-top:6px;"><a href="${website}" target="_blank" rel="noopener noreferrer">Website</a></div>`
          : ""
      }
    </div>
  `;
}

export default function MapView({
  lat,
  lng,
  mapLayer,
  popupData,
  poiToggles = {
    skills: false,
    youth: false,
    community: false,
    foodbanks: false,
    gps: false,
    hospitals: false,
    schools: false,
  },
  lookupMode = "postcode",
  onSiteSelect,
}: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const lookupModeRef = useRef<LookupMode>(lookupMode);
  const onSiteSelectRef = useRef<typeof onSiteSelect>(onSiteSelect);

  useEffect(() => {
    lookupModeRef.current = lookupMode;
    onSiteSelectRef.current = onSiteSelect;
  }, [lookupMode, onSiteSelect]);

  function setSelectedPoint(
    map: maplibregl.Map,
    pointLng: number,
    pointLat: number
  ) {
    const src = map.getSource("selected-point") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!src) return;

    src.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [pointLng, pointLat],
          },
          properties: {},
        },
      ],
    });
  }

  function addPoiLayer(
    map: maplibregl.Map,
    id: string,
    dataPath: string,
    color: string,
    visible: boolean,
    label: string,
    radius = 5
  ) {
    map.addSource(id, {
      type: "geojson",
      data: dataPath,
    });

    map.addLayer({
      id: `${id}-layer`,
      type: "circle",
      source: id,
      layout: {
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "circle-radius": radius,
        "circle-color": color,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
      },
    });

    map.on("click", `${id}-layer`, (e) => {
      const feature = e.features?.[0];
      if (!feature || !e.lngLat) return;

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: "320px",
      })
        .setLngLat(e.lngLat)
        .setHTML(buildPoiPopupHtml(feature, label))
        .addTo(map);
    });

    map.on("mouseenter", `${id}-layer`, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", `${id}-layer`, () => {
      map.getCanvas().style.cursor = "";
    });
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [lng, lat],
      zoom: 11,
    });

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      "top-right"
    );

    map.on("load", () => {
      loadedRef.current = true;

      map.addSource("lsoa", {
        type: "geojson",
        data: "/data/ch_LSOA_Data.geojson",
      });

      map.addLayer({
        id: "lsoa-fill",
        type: "fill",
        source: "lsoa",
        paint: {
          "fill-color": getFillExpression(mapLayer) as any,
          "fill-opacity": 0.55,
        },
      });

      map.addLayer({
        id: "lsoa-outline",
        type: "line",
        source: "lsoa",
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.7,
        },
      });

      map.addSource("selected-point", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [lng, lat],
              },
              properties: {},
            },
          ],
        },
      });

      map.addLayer({
        id: "selected-point-halo",
        type: "circle",
        source: "selected-point",
        paint: {
          "circle-radius": 13,
          "circle-color": "#000000",
          "circle-opacity": 0,
          "circle-stroke-color":
            lookupModeRef.current === "site" ? "#2563eb" : "#000000",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "selected-point-centre",
        type: "circle",
        source: "selected-point",
        paint: {
          "circle-radius": 4,
          "circle-color":
            lookupModeRef.current === "site" ? "#2563eb" : "#000000",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      addPoiLayer(
        map,
        "skills",
        "/data/skills_providers_ch.geojson",
        "#2563eb",
        poiToggles.skills,
        "Skills Provider"
      );

      addPoiLayer(
        map,
        "youth",
        "/data/youth_provison_ch.geojson",
        "#7c3aed",
        poiToggles.youth,
        "Youth Provision"
      );

      addPoiLayer(
        map,
        "community",
        "/data/community_centres_ch.geojson",
        "#0891b2",
        poiToggles.community,
        "Community Centre"
      );

      addPoiLayer(
        map,
        "foodbanks",
        "/data/foodbanks_ch.geojson",
        "#dc2626",
        poiToggles.foodbanks,
        "Foodbank"
      );

      addPoiLayer(
        map,
        "gps",
        "/data/GP_Surgery_ch.geojson",
        "#16a34a",
        poiToggles.gps,
        "GP Surgery"
      );

      addPoiLayer(
        map,
        "schools",
        "/data/school_college_ch.geojson",
        "#ca8a04",
        poiToggles.schools,
        "School / College"
      );

      map.addSource("hospitals", {
        type: "geojson",
        data: "/data/hospital_ch.geojson",
      });

      map.addLayer({
        id: "hospitals-fill",
        type: "fill",
        source: "hospitals",
        layout: {
          visibility: poiToggles.hospitals ? "visible" : "none",
        },
        paint: {
          "fill-color": "#ea580c",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "hospitals-outline",
        type: "line",
        source: "hospitals",
        layout: {
          visibility: poiToggles.hospitals ? "visible" : "none",
        },
        paint: {
          "line-color": "#ea580c",
          "line-width": 1.5,
        },
      });

      map.on("click", "hospitals-fill", (e) => {
        const feature = e.features?.[0];
        if (!feature || !e.lngLat) return;

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "320px",
        })
          .setLngLat(e.lngLat)
          .setHTML(buildPoiPopupHtml(feature, "Hospital"))
          .addTo(map);
      });

      map.on("mouseenter", "hospitals-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "hospitals-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", (e) => {
        if (lookupModeRef.current !== "site" || !onSiteSelectRef.current) return;

        onSiteSelectRef.current({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
      });
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    map.flyTo({
      center: [lng, lat],
      zoom: 11,
      essential: true,
    });

    setSelectedPoint(map, lng, lat);
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer("lsoa-fill")) return;

    map.setPaintProperty(
      "lsoa-fill",
      "fill-color",
      getFillExpression(mapLayer) as any
    );
  }, [mapLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const setVisibility = (layerId: string, visible: boolean) => {
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    };

    setVisibility("skills-layer", poiToggles.skills);
    setVisibility("youth-layer", poiToggles.youth);
    setVisibility("community-layer", poiToggles.community);
    setVisibility("foodbanks-layer", poiToggles.foodbanks);
    setVisibility("gps-layer", poiToggles.gps);
    setVisibility("schools-layer", poiToggles.schools);
    setVisibility("hospitals-fill", poiToggles.hospitals);
    setVisibility("hospitals-outline", poiToggles.hospitals);
  }, [poiToggles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (
      !map.getLayer("selected-point-halo") ||
      !map.getLayer("selected-point-centre")
    ) {
      return;
    }

    map.setPaintProperty(
      "selected-point-halo",
      "circle-stroke-color",
      lookupMode === "site" ? "#2563eb" : "#000000"
    );
    map.setPaintProperty(
      "selected-point-centre",
      "circle-color",
      lookupMode === "site" ? "#2563eb" : "#000000"
    );
  }, [lookupMode]);

  const areaName =
    popupData?.["LSOA21NM"] ||
    popupData?.["LSOA11NM"] ||
    popupData?.["LSOA21CD"] ||
    popupData?.["LSOA11CD"] ||
    "Selected Area";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#e5e7eb",
      }}
    >
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
        }}
      />

      {popupData && (
        <div
          style={{
            position: "absolute",
            left: "12px",
            right: "12px",
            bottom: "12px",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.97)",
              borderRadius: "12px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              padding: "14px 16px",
              fontFamily: "Segoe UI, Arial, sans-serif",
              fontSize: "13px",
              lineHeight: 1.45,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: "8px",
                fontSize: "14px",
                color: "#111827",
              }}
            >
              {areaName}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "6px 18px",
                color: "#111827",
              }}
            >
              <div>
                <strong>IMD Decile:</strong> {popupData["IMD Decile"] ?? "N/A"}
              </div>

              <div>
                <strong>Fuel Poverty:</strong>{" "}
                {popupData["Households Fuel Poor (%)"] ?? "N/A"}%
              </div>

              <div>
                <strong>Employment Access (30 Min PT/Walk):</strong>{" "}
                {popupData["Users within 30 minutes of Employment by PT/walk (%)"] ??
                  "N/A"}
                %
              </div>

              <div>
                <strong>GP Access (15 Min PT/Walk):</strong>{" "}
                {popupData["Users within 15 minutes of GPs by PT/walk (%)"] ??
                  "N/A"}
                %
              </div>

              <div>
                <strong>Food Access (15 Min PT/Walk):</strong>{" "}
                {popupData["Users within 15 minutes of Food Store by PT/walk (%)"] ??
                  "N/A"}
                %
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
