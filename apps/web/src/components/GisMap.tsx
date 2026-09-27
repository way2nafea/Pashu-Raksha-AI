"use client";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const RISK_COLORS: Record<string, string> = {
  LOW: "#4B8B5B", MODERATE: "#C98A2B", HIGH: "#D8622E", CRITICAL: "#B23A2E",
};

export default function GisMap({ farms, cases, outbreaks }: { farms: any[]; cases: any[]; outbreaks: any[] }) {
  const center: [number, number] = cases[0]?.location?.coordinates
    ? [cases[0].location.coordinates[1], cases[0].location.coordinates[0]]
    : [19.3, 72.85];

  return (
    <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {outbreaks.map((o) => (
        <Circle
          key={o.id}
          center={[o.center.coordinates[1], o.center.coordinates[0]]}
          radius={o.radius_km * 1000}
          pathOptions={{ color: "#B23A2E", fillColor: "#B23A2E", fillOpacity: 0.12, weight: 1.5, dashArray: "6 4" }}
        >
          <Popup>
            <b>Outbreak Cluster</b><br />
            {o.case_count} cases · {o.severity} severity
          </Popup>
        </Circle>
      ))}

      {farms.map((f) => (
        <CircleMarker
          key={f.id}
          center={[f.location.coordinates[1], f.location.coordinates[0]]}
          radius={4}
          pathOptions={{ color: "#2F5233", fillColor: "#2F5233", fillOpacity: 0.7 }}
        >
          <Popup>{f.farm_name}<br />{f.village}</Popup>
        </CircleMarker>
      ))}

      {cases.map((c) => (
        <CircleMarker
          key={c.id}
          center={[c.location.coordinates[1], c.location.coordinates[0]]}
          radius={7}
          pathOptions={{ color: RISK_COLORS[c.risk_level] || "#888", fillColor: RISK_COLORS[c.risk_level] || "#888", fillOpacity: 0.85, weight: 2 }}
        >
          <Popup>
            <b className="capitalize">{c.species}</b><br />
            {c.disease_category}
            {c.disease_prediction && (
              <span style={{ fontSize: 11, color: c.disease_prediction.engine === "ML" ? "#1e40af" : "#92400e" }}>
                {" "}({c.disease_prediction.engine === "ML" ? "ML model" : "rule-based"})
              </span>
            )}
            <br />
            Risk: {c.risk_level} · Status: {c.status}
            {c.weather_at_report?.available && (
              <><br />Weather: {c.weather_at_report.current.condition}, {c.weather_at_report.current.temperature_c}°C</>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
