// src/components/ZoneMap.js — Premium Real Leaflet-based Situation Map
import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import { getZones, getResources } from "../services/api";
import { INDIA_STATES, STATE_DISTRICTS } from "../data/indiaGeo";
import "leaflet/dist/leaflet.css";
import "./ZoneMap.css";

const SEV_COLOR  = { critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#10B981" };
const SEV_RADIUS = { critical: 24, high: 18, medium: 14, low: 10 };
const TYPE_ICON  = { medical: "✚", rescue: "⬡", food: "◆", shelter: "▲" };
const TYPE_COLOR = { medical: "#EF4444", rescue: "#F59E0B", food: "#10B981", shelter: "#3B82F6" };

// Map relative coord_x/y (0–100%) to geographic India region
const coordToLatLng = (x, y) => {
  // Longitude range: 68.7 to 97.2
  const lng = 68.7 + (x / 100) * (97.2 - 68.7);
  // Latitude range: 8.4 to 35.5 (invert Y since 0 is top north)
  const lat = 35.5 - (y / 100) * (35.5 - 8.4);
  return [lat, lng];
};

// Custom Shelter Icon (Green Tent)
const createShelterIcon = () => {
  return L.divIcon({
    html: `<div class="map-shelter-marker" style="background: rgba(16, 185, 129, 0.2); border: 1.5px solid #10B981; color: #10B981; text-shadow: 0 0 4px #10B981; display: flex; align-items: center; justify-content: center; font-size: 13px;">
             ⛺
           </div>`,
    className: "custom-leaflet-icon",
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

// Generate nearby shelters (2-3 camps per zone, 5-25km away)
const getNearbySheltersForZone = (zone, resources) => {
  const zoneLatLng = coordToLatLng(zone.coord_x, zone.coord_y);
  const seed = zone.id * 10;
  
  // Shelter 1: Alpha Camp
  const lat1 = zoneLatLng[0] + 0.045 + (seed % 7) * 0.005;
  const lng1 = zoneLatLng[1] - 0.055 - (seed % 5) * 0.005;
  const dist1 = Math.round((0.045 * 111) * 10) / 10 + 3;
  const cap1 = 500 + (seed % 10) * 100;
  const occ1 = Math.floor(zone.affected_count * 0.05) + (seed % 4) * 40;
  
  const shelter1 = {
    id: `shelter-${zone.id}-1`,
    name: `${zone.name.split("—")[0].trim()} Relief Camp Alpha`,
    lat: lat1,
    lng: lng1,
    capacity: cap1,
    occupied: Math.min(cap1, occ1),
    status: "Active",
    supplies: (seed % 3 === 0) ? "Critical Need" : (seed % 3 === 1) ? "Restocked" : "Stable",
    distanceKm: dist1
  };
  
  // Shelter 2: Beta Base
  const lat2 = zoneLatLng[0] - 0.06 - (seed % 9) * 0.004;
  const lng2 = zoneLatLng[1] + 0.05 + (seed % 6) * 0.004;
  const dist2 = Math.round((0.06 * 111) * 10) / 10 + 4;
  const cap2 = 800 + (seed % 8) * 100;
  const occ2 = Math.floor(zone.affected_count * 0.03) + (seed % 3) * 60;
  
  const shelter2 = {
    id: `shelter-${zone.id}-2`,
    name: `${zone.name.split("—")[0].trim()} Emergency Center Beta`,
    lat: lat2,
    lng: lng2,
    capacity: cap2,
    occupied: Math.min(cap2, occ2),
    status: "Active",
    supplies: (seed % 3 === 0) ? "Stable" : (seed % 3 === 1) ? "Adequate" : "Restocked",
    distanceKm: dist2
  };

  // Add actual DB shelters if any are assigned to this zone
  const actualShelters = (resources || []).filter(
    (r) => r.assigned_zone === zone.id && r.resource_type === "shelter"
  ).map((r) => {
    return {
      id: `actual-${r.id}`,
      name: r.name,
      lat: zoneLatLng[0] - 0.03,
      lng: zoneLatLng[1] - 0.03,
      capacity: r.capacity,
      occupied: r.utilized,
      status: r.status === "deployed" ? "Active" : "Standby",
      supplies: "Adequate",
      distanceKm: 4.2,
      isActualResource: true
    };
  });

  return [...actualShelters, shelter1, shelter2];
};

function NeedBar({ label, value }) {
  const color = value >= 75 ? "#EF4444" : value >= 50 ? "#F59E0B" : "#3B82F6";
  return (
    <div className="need-row">
      <span className="need-label" style={{ textTransform: "capitalize" }}>{label}</span>
      <div className="need-track">
        <div className="need-fill" style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="need-pct">{value}%</span>
    </div>
  );
}

// Auto-zoom map to fit all active disaster coordinates when filters change
function FitBounds({ zones, selectedState, selectedDistrict, selectedSeverity, selected }) {
  const map = useMap();
  const lastFiltersRef = React.useRef({ state: null, district: null, severity: null, hadSelection: false, initial: false });

  useEffect(() => {
    if (selected) {
      lastFiltersRef.current.hadSelection = true;
      return;
    }

    if (!zones || zones.length === 0) return;

    const filtersChanged = 
      lastFiltersRef.current.state !== selectedState ||
      lastFiltersRef.current.district !== selectedDistrict ||
      lastFiltersRef.current.severity !== selectedSeverity ||
      lastFiltersRef.current.hadSelection ||
      !lastFiltersRef.current.initial;

    if (filtersChanged) {
      const points = zones.map(z => coordToLatLng(z.coord_x, z.coord_y));
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      
      lastFiltersRef.current = {
        state: selectedState,
        district: selectedDistrict,
        severity: selectedSeverity,
        hadSelection: false,
        initial: true
      };
    }
  }, [zones, selectedState, selectedDistrict, selectedSeverity, selected, map]);

  return null;
}

// Pan and zoom to selected zone when selection changes
function SelectedZonePan({ selected }) {
  const map = useMap();
  const lastSelectedIdRef = React.useRef(null);

  useEffect(() => {
    if (!selected) {
      lastSelectedIdRef.current = null;
      return;
    }

    if (selected.id !== lastSelectedIdRef.current) {
      const latLng = coordToLatLng(selected.coord_x, selected.coord_y);
      map.flyTo(latLng, 11, {
        animate: true,
        duration: 1.2
      });
      lastSelectedIdRef.current = selected.id;
    }
  }, [selected, map]);

  return null;
}

// Helper to create high-impact divIcons for resources
const createResourceIcon = (type, color) => {
  const symbol = TYPE_ICON[type] || "📍";
  return L.divIcon({
    html: `<div class="map-resource-marker" style="background: ${color}22; border: 1.5px solid ${color}; color: ${color}; text-shadow: 0 0 4px ${color};">
             ${symbol}
           </div>`,
    className: "custom-leaflet-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export default function ZoneMap({ tick }) {
  const [zones, setZones]       = useState([]);
  const [resources, setResources] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode]   = useState("incident"); // "incident" or "shelter"
  const [dispatchToast, setDispatchToast] = useState("");
  const [shelterState, setShelterState] = useState({});

  const handleEvacuate = (shelterId, count, shelterCapacity, currentOccupied) => {
    setShelterState(prev => {
      const current = prev[shelterId] || {};
      const baseOccupied = current.occupied !== undefined ? current.occupied : currentOccupied;
      const baseCapacity = current.capacity !== undefined ? current.capacity : shelterCapacity;
      const newOccupied = Math.min(baseCapacity, baseOccupied + count);
      return {
        ...prev,
        [shelterId]: {
          ...current,
          capacity: baseCapacity,
          occupied: newOccupied
        }
      };
    });
    setDispatchToast(`Evacuated ${count} citizens to the shelter!`);
    setTimeout(() => setDispatchToast(""), 3000);
  };

  const handleDispatchSupplies = (shelterId) => {
    setShelterState(prev => {
      const current = prev[shelterId] || {};
      return {
        ...prev,
        [shelterId]: {
          ...current,
          supplies: "Restocked"
        }
      };
    });
    setDispatchToast("Emergency supply vehicles dispatched successfully!");
    setTimeout(() => setDispatchToast(""), 3000);
  };

  const getZoneShelters = (zone) => {
    if (!zone) return [];
    const baseShelters = getNearbySheltersForZone(zone, resources);
    return baseShelters.map(s => {
      const stateUpdate = shelterState[s.id] || {};
      return {
        ...s,
        occupied: stateUpdate.occupied !== undefined ? stateUpdate.occupied : s.occupied,
        supplies: stateUpdate.supplies !== undefined ? stateUpdate.supplies : s.supplies
      };
    });
  };

  const fetchData = useCallback(async () => {
    try {
      const [z, r] = await Promise.all([getZones(), getResources()]);
      setZones(z);
      setResources(r);
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [tick]);

  // Filter States
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");

  const uniqueDistricts = selectedState ? (STATE_DISTRICTS[selectedState] || []) : [];

  // Filtered Zones
  const filteredZones = zones.filter((z) => {
    if (selectedState && z.state !== selectedState) return false;
    if (selectedDistrict && z.district !== selectedDistrict) return false;
    if (selectedSeverity && z.severity !== selectedSeverity) return false;
    return true;
  });

  // Handle selected zone filtered out
  useEffect(() => {
    if (selected && !filteredZones.some((z) => z.id === selected.id)) {
      setSelected(null);
    }
  }, [selectedState, selectedDistrict, selectedSeverity, zones, selected]);

  const deployed = resources.filter((r) => 
    r.status === "deployed" && 
    r.assigned_zone &&
    filteredZones.some((z) => z.id === r.assigned_zone)
  );

  const getPriorityColor = (s) => (s >= 65 ? "#EF4444" : s >= 50 ? "#F59E0B" : "#3B82F6");

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center", color: "var(--slate)" }}>
          <div className="analyze-spinner" style={{ margin: "0 auto 16px" }} />
          <div>Loading Situation Map...</div>
        </div>
      </div>
    );
  }

  // Define offsets to position multiple resources slightly offset from the zone center
  const offsets = {
    medical: [0.06, -0.06],
    rescue: [0.06, 0.06],
    food: [-0.06, 0.06],
    shelter: [-0.06, -0.06]
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Disaster Zone Map</h1>
        <p>Geographic interactive mapping of active disaster zones and deployed resource units</p>
      </div>

      {/* Glossy Filter Bar with Dropdowns and Severity Toggles */}
      <div 
        className="filter-bar" 
        style={{ 
          display: "flex", 
          gap: "16px", 
          alignItems: "center", 
          background: "rgba(255,255,255,0.03)", 
          padding: "12px 20px", 
          borderRadius: "8px", 
          border: "1px solid rgba(255,255,255,0.05)",
          marginBottom: "16px",
          flexWrap: "wrap",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          {/* State Dropdown */}
          <div className="filter-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>State</span>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("");
              }}
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: "pointer",
                outline: "none",
                minWidth: "140px"
              }}
            >
              <option value="">All States</option>
              {INDIA_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          {/* District Dropdown */}
          <div className="filter-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "10px", color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>District</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState}
              style={{
                background: selectedState ? "rgba(15, 23, 42, 0.6)" : "rgba(15, 23, 42, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: selectedState ? "#fff" : "rgba(255,255,255,0.3)",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                cursor: selectedState ? "pointer" : "not-allowed",
                outline: "none",
                minWidth: "140px"
              }}
            >
              <option value="">All Districts</option>
              {uniqueDistricts.map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Severity Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
          <span style={{ fontSize: "10px", color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Filter Severity</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {["critical", "high", "medium", "low"].map((sev) => {
              const active = selectedSeverity === sev;
              const color = SEV_COLOR[sev];
              return (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(active ? "" : sev)}
                  style={{
                    background: active ? `${color}22` : "rgba(15, 23, 42, 0.4)",
                    border: active ? `1.5px solid ${color}` : `1px solid ${color}44`,
                    color: active ? color : `${color}cc`,
                    borderRadius: "20px",
                    padding: "4px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    boxShadow: active ? `0 0 12px ${color}44` : "none",
                    transition: "all 0.2s ease",
                    opacity: selectedSeverity && !active ? 0.4 : 1
                  }}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="map-layout">
        {/* Real Leaflet Map */}
        <div className="card map-card" style={{ position: "relative" }}>
          {dispatchToast && <div className="dispatch-toast">{dispatchToast}</div>}
          <div className="map-header">
            <div className="map-header-tabs">
              <button 
                onClick={() => {
                  setViewMode("incident");
                  setSelected(null);
                }}
                className={`map-tab-btn active incident ${viewMode === "incident" ? "" : "inactive"}`}
                style={{
                  background: viewMode === "incident" ? "rgba(59, 130, 246, 0.12)" : "transparent",
                  border: viewMode === "incident" ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid transparent",
                  color: viewMode === "incident" ? "var(--blue)" : "var(--slate)"
                }}
              >
                Live Incident Map
              </button>
              <button 
                onClick={() => {
                  setViewMode("shelter");
                  setSelected(null);
                }}
                className={`map-tab-btn active shelter ${viewMode === "shelter" ? "" : "inactive"}`}
                style={{
                  background: viewMode === "shelter" ? "rgba(16, 185, 129, 0.12)" : "transparent",
                  border: viewMode === "shelter" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid transparent",
                  color: viewMode === "shelter" ? "var(--green)" : "var(--slate)"
                }}
              >
                Nearby Shelter
              </button>
            </div>
            <div className="map-meta">
              <span className="live-dot" />
              <span style={{ fontSize: 11, color: "var(--green)" }}>Live Map Connection</span>
              <span style={{ fontSize: 11, color: "var(--slate)", marginLeft: 8 }}>
                {viewMode === "incident" 
                  ? `${filteredZones.length} active zones · ${deployed.length} units deployed`
                  : `${filteredZones.length} zones monitored · ${filteredZones.reduce((acc, curr) => acc + getZoneShelters(curr).length, 0)} shelters active`
                }
              </span>
            </div>
          </div>

          <div className="map-inner">
            <MapContainer 
              center={[20.5937, 78.9629]} 
              zoom={5} 
              scrollWheelZoom={true}
              style={{ width: "100%", height: "100%" }}
            >
              {/* Premium CartoDB Positron light tiles */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              <FitBounds 
                zones={filteredZones} 
                selectedState={selectedState} 
                selectedDistrict={selectedDistrict} 
                selectedSeverity={selectedSeverity} 
                selected={selected} 
              />
              <SelectedZonePan selected={selected} />

              {/* Render Disaster Zones as Pulsing vector circles */}
              {filteredZones.map((z) => {
                const position = coordToLatLng(z.coord_x, z.coord_y);
                const color = SEV_COLOR[z.severity];
                const radius = SEV_RADIUS[z.severity];
                
                return (
                  <React.Fragment key={`z-layer-${z.id}`}>
                    {/* Outer glow aura */}
                    <CircleMarker
                      center={position}
                      pathOptions={{ color: color, fillColor: color, fillOpacity: 0.04, weight: 1, dashArray: "4, 8" }}
                      radius={radius * 2}
                    />
                    {/* Core Incident Marker */}
                    <CircleMarker
                      center={position}
                      pathOptions={{ color: color, fillColor: color, fillOpacity: 0.18, weight: 2 }}
                      radius={radius}
                      eventHandlers={{
                        click: () => setSelected(z)
                      }}
                    >
                      <Popup>
                        <div className="popup-inner">
                          <div className="popup-title">{z.name}</div>
                          <div className="popup-row">
                            <span>Disaster Type</span>
                            <span style={{ textTransform: "capitalize" }}>{z.disaster_type}</span>
                          </div>
                          <div className="popup-row">
                            <span>Severity</span>
                            <span className={`badge badge-${z.severity}`}>{z.severity}</span>
                          </div>
                          <div className="popup-row">
                            <span>Affected</span>
                            <span>{z.affected_count.toLocaleString()}</span>
                          </div>
                          <div className="popup-score">
                            <span className="popup-score-num" style={{ color: getPriorityColor(z.priority_score) }}>
                              {z.priority_score}
                            </span>
                            <span className="popup-score-label">AI Priority Score</span>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                );
              })}

              {/* Render Deployed Resource markers in incident mode */}
              {viewMode === "incident" && deployed.map((res) => {
                const zone = filteredZones.find((z) => z.id === res.assigned_zone);
                if (!zone) return null;

                const center = coordToLatLng(zone.coord_x, zone.coord_y);
                const offset = offsets[res.resource_type] || [0, 0];
                const resPosition = [center[0] + offset[0], center[1] + offset[1]];
                const color = TYPE_COLOR[res.resource_type];

                return (
                  <Marker
                    key={`res-marker-${res.id}`}
                    position={resPosition}
                    icon={createResourceIcon(res.resource_type, color)}
                  >
                    <Popup>
                      <div className="popup-inner">
                        <div className="popup-title" style={{ color: color }}>{res.name}</div>
                        <div className="popup-row">
                          <span>Status</span>
                          <span className={`badge badge-${res.status}`}>{res.status}</span>
                        </div>
                        <div className="popup-row">
                          <span>Utilization</span>
                          <span>{res.utilized} / {res.capacity} units</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Render Shelter markers in shelter mode */}
              {viewMode === "shelter" && filteredZones.map((z) => {
                const zoneShelters = getZoneShelters(z);
                return zoneShelters.map((s) => (
                  <Marker
                    key={`shelter-marker-${s.id}`}
                    position={[s.lat, s.lng]}
                    icon={createShelterIcon()}
                  >
                    <Popup>
                      <div className="popup-inner">
                        <div className="popup-title" style={{ color: "var(--green)" }}>{s.name}</div>
                        <div className="popup-row">
                          <span>Status</span>
                          <span className="badge badge-low" style={{ background: "rgba(16,185,129,0.18)" }}>{s.status}</span>
                        </div>
                        <div className="popup-row">
                          <span>Occupancy</span>
                          <span>{s.occupied} / {s.capacity} ({Math.round((s.occupied / s.capacity) * 100)}%)</span>
                        </div>
                        <div className="popup-row">
                          <span>Supplies</span>
                          <span style={{ 
                            color: s.supplies === "Critical Need" ? "var(--red)" : s.supplies === "Restocked" ? "var(--green)" : "var(--slate)", 
                            fontWeight: 600 
                          }}>{s.supplies}</span>
                        </div>
                        <div className="popup-row">
                          <span>Distance</span>
                          <span>{s.distanceKm} km</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ));
              })}

              {/* Draw animated dispatch routes from the selected zone to its shelters */}
              {viewMode === "shelter" && selected && getZoneShelters(selected).map((s) => {
                const zonePos = coordToLatLng(selected.coord_x, selected.coord_y);
                return (
                  <Polyline
                    key={`route-${selected.id}-${s.id}`}
                    positions={[zonePos, [s.lat, s.lng]]}
                    pathOptions={{
                      className: "dispatch-route",
                      color: s.supplies === "Critical Need" ? "var(--amber)" : "var(--green)",
                      weight: 3.5,
                      opacity: 0.8
                    }}
                  />
                );
              })}
            </MapContainer>
          </div>

          {/* Bottom legend */}
          <div style={{ display: "flex", gap: 24, padding: "10px 20px", borderTop: "1px solid var(--glass-border)", flexShrink: 0, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--slate)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Severity:</span>
              {Object.entries(SEV_COLOR).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: v, boxShadow: `0 0 6px ${v}` }} />
                  <span style={{ color: "var(--slate)", textTransform: "capitalize" }}>{k}</span>
                </div>
              ))}
            </div>
            {viewMode === "incident" ? (
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--slate)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Resources:</span>
                {Object.entries(TYPE_ICON).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <span style={{ color: TYPE_COLOR[k], fontSize: 12 }}>{v}</span>
                    <span style={{ color: "var(--slate)", textTransform: "capitalize" }}>{k}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <span style={{ fontSize: 13 }}>⛺</span>
                  <span style={{ color: "var(--slate)" }}>Nearby Shelter Camp</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <span style={{ color: "var(--green)", fontSize: 14, fontWeight: "bold" }}>┈┈</span>
                  <span style={{ color: "var(--slate)" }}>Live Dispatch Route</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="map-side">
          {viewMode === "incident" ? (
            selected ? (
              <div className="card">
                <div className="card-title">Zone Detail</div>
                <div className="mz-name">{selected.name}</div>
                <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                  <span className={`badge badge-${selected.severity}`}>{selected.severity}</span>
                  <span className="badge badge-medium">{selected.disaster_type}</span>
                </div>

                {/* Priority display */}
                <div style={{
                  textAlign: "center", padding: "16px 14px", marginBottom: 14,
                  background: "rgba(59,130,246,0.06)",
                  border: `1px solid ${getPriorityColor(selected.priority_score)}33`,
                  borderRadius: 10,
                }}>
                  <div style={{
                    fontSize: 44, fontWeight: 700, fontFamily: "var(--font-display)",
                    color: getPriorityColor(selected.priority_score),
                    textShadow: `0 0 24px ${getPriorityColor(selected.priority_score)}55`,
                    lineHeight: 1,
                  }}>
                    {selected.priority_score}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 5 }}>
                    AI Priority Score / 100
                  </div>
                </div>

                <div className="mz-stats">
                  <div className="mz-stat">
                    <div className="mz-stat-label">Affected</div>
                    <div className="mz-stat-val" style={{ color: "#EF4444", fontSize: 16 }}>{(selected.affected_count / 1000).toFixed(1)}k</div>
                  </div>
                  <div className="mz-stat">
                    <div className="mz-stat-label">Population</div>
                    <div className="mz-stat-val" style={{ fontSize: 16 }}>{(selected.population / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="mz-stat">
                    <div className="mz-stat-label">Resources</div>
                    <div className="mz-stat-val" style={{ color: "#3B82F6", fontSize: 16 }}>{selected.resources_deployed}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="card-title" style={{ marginBottom: 10 }}>Needs Assessment</div>
                  <NeedBar label="medical" value={selected.need_medical} />
                  <NeedBar label="food"    value={selected.need_food} />
                  <NeedBar label="shelter" value={selected.need_shelter} />
                  <NeedBar label="rescue"  value={selected.need_rescue} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="card-title" style={{ marginBottom: 10 }}>Deployed Resources</div>
                  {resources.filter((r) => r.assigned_zone === selected.id).map((r) => (
                    <div key={r.id} className="mz-resource">
                      <span className="mz-res-icon" style={{ color: TYPE_COLOR[r.resource_type] }}>{TYPE_ICON[r.resource_type]}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: "var(--slate)" }}>{r.utilized}/{r.capacity} utilized</div>
                      </div>
                      <span className={`badge badge-${r.status}`}>{r.status}</span>
                    </div>
                  ))}
                  {resources.filter((r) => r.assigned_zone === selected.id).length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--slate-dim)" }}>No resources currently assigned</div>
                  )}
                </div>

                <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={() => setSelected(null)}>
                  ← Back to list
                </button>
              </div>
            ) : (
              <>
                <div className="card">
                  <div className="card-title">Active Zones</div>
                  <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 12 }}>Click zone on map or select below.</div>
                  <div className="zones-summary">
                    {[...filteredZones].sort((a, b) => b.priority_score - a.priority_score).map((z) => (
                      <div key={z.id} className="zone-sum-row" onClick={() => setSelected(z)}>
                        <div className="zone-sum-dot" style={{ background: SEV_COLOR[z.severity], boxShadow: `0 0 8px ${SEV_COLOR[z.severity]}` }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{z.disaster_type} — {z.name.split("—")[0].trim()}</div>
                          <div style={{ fontSize: 10, color: "var(--slate-dim)" }}>
                            {z.affected_count.toLocaleString()} affected · Score: <span style={{ color: getPriorityColor(z.priority_score) }}>{z.priority_score}</span>
                          </div>
                        </div>
                        <span className={`badge badge-${z.severity}`}>{z.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Map Summary</div>
                  {[
                    { label: "Critical Zones", val: filteredZones.filter((z) => z.severity === "critical").length, color: "#EF4444" },
                    { label: "High Zones", val: filteredZones.filter((z) => z.severity === "high").length, color: "#F59E0B" },
                    { label: "Resources Deployed", val: deployed.length, color: "#10B981" },
                    { label: "Total Affected", val: filteredZones.reduce((s, z) => s + z.affected_count, 0).toLocaleString(), color: "#3B82F6" },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                      <span style={{ color: "var(--slate)" }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: item.color, fontFamily: "var(--font-display)" }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            /* Shelter View Mode Side Panel */
            selected ? (
              <div className="card">
                <div className="card-title">Shelter Command</div>
                <div className="mz-name">{selected.name}</div>
                <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                  <span className={`badge badge-${selected.severity}`}>{selected.severity}</span>
                  <span className="badge badge-low" style={{ background: "rgba(16,185,129,0.14)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.28)" }}>
                    Shelter Need: {selected.need_shelter}%
                  </span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="card-title" style={{ marginBottom: 12 }}>Nearby Shelter Units</div>
                  {getZoneShelters(selected).map((s) => {
                    const pct = Math.round((s.occupied / s.capacity) * 100);
                    const barColor = pct >= 85 ? "var(--red)" : pct >= 65 ? "var(--amber)" : "var(--green)";
                    
                    return (
                      <div key={s.id} className="shelter-card">
                        <div className="shelter-name">{s.name}</div>
                        <div className="shelter-meta">
                          <span>Distance: {s.distanceKm} km</span>
                          <span style={{ fontWeight: 600, color: s.supplies === "Critical Need" ? "var(--red)" : s.supplies === "Restocked" ? "var(--green)" : "var(--slate)" }}>
                            Supplies: {s.supplies}
                          </span>
                        </div>
                        <div className="shelter-progress-bar">
                          <div className="shelter-progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--slate)" }}>
                          <span>Occupancy: {pct}%</span>
                          <span>{s.occupied} / {s.capacity} units</span>
                        </div>
                        
                        <div className="dispatch-actions">
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ fontSize: "10px", padding: "4px 8px", color: "var(--white)", borderColor: "rgba(255,255,255,0.15)" }}
                            onClick={() => handleEvacuate(s.id, 50, s.capacity, s.occupied)}
                            disabled={s.occupied >= s.capacity}
                          >
                             Evacuate 50
                          </button>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ fontSize: "10px", padding: "4px 8px", color: "var(--green)", borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.02)" }}
                            onClick={() => handleDispatchSupplies(s.id)}
                            disabled={s.supplies === "Restocked"}
                          >
                            🚚 Restock
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="btn btn-ghost btn-sm" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={() => setSelected(null)}>
                  ← Back to zones
                </button>
              </div>
            ) : (
              <>
                <div className="card">
                  <div className="card-title">Zones Shelter Need</div>
                  <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 12 }}>Select a zone to view shelters & dispatch routes.</div>
                  <div className="zones-summary">
                    {[...filteredZones].sort((a, b) => b.need_shelter - a.need_shelter).map((z) => (
                      <div key={z.id} className="zone-sum-row" onClick={() => setSelected(z)}>
                        <div className="zone-sum-dot" style={{ background: getPriorityColor(z.need_shelter), boxShadow: `0 0 8px ${getPriorityColor(z.need_shelter)}` }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{z.name.split("—")[0].trim()}</div>
                          <div style={{ fontSize: 10, color: "var(--slate-dim)" }}>
                            Shelter Need: <span style={{ color: getPriorityColor(z.need_shelter), fontWeight: "bold" }}>{z.need_shelter}%</span> · Affected: {z.affected_count.toLocaleString()}
                          </div>
                        </div>
                        <span className={`badge badge-${z.severity}`}>{z.severity}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Shelter Capacity Overview</div>
                  {[
                    { 
                      label: "Total Shelters Available", 
                      val: filteredZones.reduce((acc, curr) => acc + getZoneShelters(curr).length, 0), 
                      color: "var(--green)" 
                    },
                    { 
                      label: "Total Capacity", 
                      val: filteredZones.reduce((acc, curr) => acc + getZoneShelters(curr).reduce((sAcc, s) => sAcc + s.capacity, 0), 0).toLocaleString(), 
                      color: "var(--white)" 
                    },
                    { 
                      label: "Currently Sheltered", 
                      val: filteredZones.reduce((acc, curr) => acc + getZoneShelters(curr).reduce((sAcc, s) => sAcc + s.occupied, 0), 0).toLocaleString(), 
                      color: "var(--blue)" 
                    },
                    { 
                      label: "Avg Shelter Need", 
                      val: Math.round(filteredZones.reduce((acc, curr) => acc + curr.need_shelter, 0) / (filteredZones.length || 1)) + "%", 
                      color: "var(--amber)" 
                    },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                      <span style={{ color: "var(--slate)" }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: item.color, fontFamily: "var(--font-display)" }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
