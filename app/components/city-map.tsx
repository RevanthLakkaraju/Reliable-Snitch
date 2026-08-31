"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { DEMO_FACILITIES, type Report } from "@/lib/domain";
import { imageUrl } from "@/lib/client";
type Point = { latitude: number; longitude: number };
export default function CityMap({
  reports = [],
  selected,
  onSelect,
  onPick,
  showFacilities = false,
}: {
  reports?: Report[];
  selected?: Point | null;
  onSelect?: (report: Report) => void;
  onPick?: (point: Point) => void;
  showFacilities?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layer = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false),
    [mapError, setMapError] = useState(false);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    let disposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    import("leaflet")
      .then((L) => {
        if (disposed || !element.current) return;
        const m = L.map(element.current, {
          scrollWheelZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([12.9716, 77.5946], 14);
        map.current = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on("tileerror", () => setMapError(true))
          .addTo(m);
        layer.current = L.layerGroup().addTo(m);
        m.on("click", (e) =>
          pick.current?.({
            latitude: Number(e.latlng.lat.toFixed(6)),
            longitude: Number(e.latlng.lng.toFixed(6)),
          }),
        );
        setReady(true);
        resizeTimer = setTimeout(() => {
          if (!disposed && map.current === m) m.invalidateSize();
        }, 100);
      })
      .catch(() => setMapError(true));
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();
      const points: [number, number][] = [];
      for (const r of reports) {
        if (r.latitude === null || r.longitude === null) continue;
        const coords: [number, number] = [r.latitude, r.longitude];
        points.push(coords);
        const color = ["Resolved", "Closed"].includes(r.status)
          ? "#679451"
          : r.status === "In progress"
            ? "#d09435"
            : r.status === "Reported"
              ? "#527b9b"
              : "#718069";
        const icon = L.divIcon({
          className: "report-map-marker",
          html: `<span style="background:${color}"></span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker(coords, {
          icon,
          keyboard: true,
          title: r.title,
        }).addTo(layer.current);
        const popup = document.createElement("div");
        popup.className = "map-popup";
        const title = document.createElement("strong");
        title.textContent = r.title;
        popup.appendChild(title);
        const photo = r.photoKey ? imageUrl(r.photoKey) : r.demoPhoto;
        if (photo) {
          const image = document.createElement("img");
          image.src = photo;
          image.alt = r.isDemo ? "Illustrative Indian street photo" : r.title;
          image.width = 180;
          image.style.maxHeight = "110px";
          image.style.objectFit = "cover";
          popup.appendChild(image);
          if (r.demoPhoto) {
            const credit = document.createElement("a");
            credit.href = "/about#photo-credits";
            credit.textContent =
              "Illustrative photo · not incident evidence · credits";
            credit.style.display = "block";
            credit.style.fontSize = "10px";
            popup.appendChild(credit);
          }
        }
        const line = document.createElement("p");
        line.textContent = `${r.id} · ${r.status}${r.isDemo ? " · Demo" : ""}`;
        popup.appendChild(line);
        if (onSelect) {
          const button = document.createElement("button");
          button.className = "button";
          button.textContent = "View report";
          button.onclick = () => onSelect(r);
          popup.appendChild(button);
        }
        marker.bindPopup(popup);
      }
      if (showFacilities)
        for (const f of DEMO_FACILITIES)
          L.circleMarker([f.latitude, f.longitude], {
            radius: 7,
            color: "#879966",
            fillColor: "#eff5e4",
            fillOpacity: 1,
            weight: 2,
          })
            .bindTooltip(f.name + " · illustrative")
            .addTo(layer.current);
      if (selected) {
        points.push([selected.latitude, selected.longitude]);
        L.circleMarker([selected.latitude, selected.longitude], {
          radius: 10,
          color: "#285c48",
          fillColor: "#d9ed9a",
          fillOpacity: 1,
          weight: 4,
        }).addTo(layer.current);
        map.current.setView([selected.latitude, selected.longitude], 16, {
          animate: false,
        });
      } else if (points.length > 1)
        map.current.fitBounds(points, {
          padding: [45, 45],
          maxZoom: 15,
          animate: false,
        });
      else if (points.length === 1)
        map.current.setView(points[0], 15, { animate: false });
    });
    return () => {
      cancelled = true;
    };
  }, [reports, selected, onSelect, showFacilities, ready]);
  return (
    <div className="map-wrap">
      <div
        ref={element}
        className="city-map"
        aria-label={
          onPick
            ? "Map: click to place the issue location"
            : "Map of reported disruptions"
        }
      />
      {mapError && (
        <div className="map-warning">
          Map tiles are unavailable. Report lists and location coordinates still
          work.
        </div>
      )}
      {onPick && (
        <span className="map-instruction">
          Click the map to place or adjust the pin
        </span>
      )}
    </div>
  );
}
