// src/components/ResourcePanel.js
import React, { useState, useEffect, useCallback } from "react";
import { getResources, getZones, updateResource, createAllocation } from "../services/api";
import "./ResourcePanel.css";

const TYPE_COLOR = { medical: "#EF4444", rescue: "#F59E0B", food: "#10B981", shelter: "#3B82F6" };
const TYPE_ICON = { medical: "🏥", rescue: "🚒", food: "🍎", shelter: "⛺" };
const STATUS_ORDER = { deployed: 0, "in-transit": 1, standby: 2, unavailable: 3 };

export default function ResourcePanel({ tick }) {
  const [resources, setResources] = useState([]);
  const [zones, setZones] = useState([]);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Selection and Action States
  const [actionZoneId, setActionZoneId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedLocZone, setSelectedLocZone] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [resData, zonesData] = await Promise.all([getResources(), getZones()]);
      setResources(resData);
      setZones(zonesData);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [tick, fetchData]);

  // Keep selected item details in sync if database updates
  useEffect(() => {
    if (selected) {
      const current = resources.find(r => r.id === selected.id);
      if (current) {
        setSelected(current);
      }
    }
  }, [resources, selected]);

  const filtered = resources
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => typeFilter === "all" || r.resource_type === typeFilter)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  const counts = {
    all: resources.length,
    deployed: resources.filter((r) => r.status === "deployed").length,
    "in-transit": resources.filter((r) => r.status === "in-transit").length,
    standby: resources.filter((r) => r.status === "standby").length,
  };



  // Dispatch selected asset to a target zone
  const handleDispatch = async () => {
    if (!selected || !actionZoneId) return;
    setSubmitting(true);
    setActionMessage("");
    setActionError("");
    const targetZone = zones.find(z => z.id === parseInt(actionZoneId));
    
    try {
      await createAllocation({
        zone: targetZone.id,
        resource: selected.id,
        notes: `Quick dispatched via Resource Inventory`
      });
      setActionMessage(`Successfully dispatched ${selected.name} to ${targetZone.name.split("—")[0].trim()}`);
      setActionZoneId("");
      await fetchData();
    } catch (err) {
      setActionError("Failed to dispatch resource. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Recall active asset to Base Camp (Standby)
  const handleRecall = async () => {
    if (!selected) return;
    setSubmitting(true);
    setActionMessage("");
    setActionError("");

    try {
      await updateResource(selected.id, {
        status: "standby",
        assigned_zone: null,
        location: "Base Camp — Hyderabad"
      });
      setActionMessage(`Successfully recalled ${selected.name} to Base Camp.`);
      await fetchData();
    } catch (err) {
      setActionError("Failed to recall resource.");
    } finally {
      setSubmitting(false);
    }
  };

  // Re-route active asset to a different zone
  const handleReroute = async () => {
    if (!selected || !actionZoneId) return;
    setSubmitting(true);
    setActionMessage("");
    setActionError("");
    const targetZone = zones.find(z => z.id === parseInt(actionZoneId));

    try {
      await updateResource(selected.id, {
        assigned_zone: targetZone.id,
        status: "in-transit",
        location: `En route to ${targetZone.name.split("—")[0].trim()}`
      });
      setActionMessage(`Re-routed ${selected.name} to ${targetZone.name.split("—")[0].trim()}`);
      setActionZoneId("");
      await fetchData();
    } catch (err) {
      setActionError("Failed to re-route resource.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center", color: "var(--slate)" }}>
          <div className="analyze-spinner" style={{ margin: "0 auto 16px" }} />
          <div>Loading resources...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Resource Inventory</h1>
        <p>Full inventory of emergency resources with real-time status and utilization</p>
      </div>

      {/* Summary KPI row */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "Total Resources", val: resources.length, sub: "All types", cls: "blue" },
          { label: "Deployed", val: counts.deployed, sub: "Active in field", cls: "green" },
          { label: "In Transit", val: counts["in-transit"], sub: "En route", cls: "amber" },
          { label: "Standby", val: counts.standby, sub: "Ready to deploy", cls: "critical" },
        ].map((k) => (
          <div key={k.label} className={`stat-card ${k.cls}`}>
            <div className="stat-label">{k.label}</div>
            <div className="stat-value">{k.val}</div>
            <div className="stat-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--slate)", marginRight: 4 }}>STATUS:</span>
          {["all", "deployed", "in-transit", "standby"].map((s) => (
            <button
              key={s}
              className={`filter-chip ${filter === s ? "active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "All" : s} ({counts[s] ?? resources.filter((r) => r.status === s).length})
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <span style={{ fontSize: 11, color: "var(--slate)", marginRight: 4 }}>TYPE:</span>
          {["all", "medical", "rescue", "food", "shelter"].map((t) => (
            <button
              key={t}
              className={`filter-chip ${typeFilter === t ? "active" : ""}`}
              onClick={() => setTypeFilter(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Two-Column Split Layout */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
        
        {/* Simplified Inventory Table Card */}
        <div className="card" style={{ flex: selected ? "1 1 64%" : "1 1 100%", transition: "all 0.3s ease" }}>
          <div className="card-title">Inventory Database</div>
          <div style={{ fontSize: "12px", color: "var(--slate)", marginBottom: "12px" }}>
            Select any asset row to view command options, dispatch, or recall.
          </div>
          <div className="res-table">
            <div className="res-table-header">
              <span>Resource Name</span>
              <span>Category</span>
              <span>Status</span>
              <span>Current Location</span>
              <span>Usage</span>
              <span>Last Updated</span>
            </div>
            {filtered.map((r) => {
              const pct = r.capacity > 0 ? Math.round((r.utilized / r.capacity) * 100) : 0;
              const color = TYPE_COLOR[r.resource_type] || "#94A3B8";
              const isSelected = selected && selected.id === r.id;
              
              // Simplified Terminology: Combine Zone and Current location
              const currentLocation = r.assigned_zone_name 
                ? r.assigned_zone_name.split("—")[0].trim() 
                : r.location;

              return (
                <div 
                  key={r.id} 
                  className={`res-table-row ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    setSelected(isSelected ? null : r);
                    setActionMessage("");
                    setActionError("");
                    setActionZoneId("");
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="res-name-cell">
                    <div className="res-type-indicator" style={{ background: color }} />
                    <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span>{TYPE_ICON[r.resource_type]}</span>
                      <span>{r.name}</span>
                    </span>
                  </div>
                  <span>
                    <span className="badge badge-medium" style={{ borderColor: color, color }}>
                      {r.resource_type}
                    </span>
                  </span>
                  <span>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: r.assigned_zone ? 600 : 400, color: r.assigned_zone ? "var(--white)" : "var(--slate)" }}>
                    {currentLocation}
                  </span>
                  <div className="util-cell">
                    <div className="util-bar-track">
                      <div
                        className="util-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 90 ? "#EF4444" : pct >= 60 ? "#F59E0B" : "#10B981",
                        }}
                      />
                    </div>
                    <span className="util-pct">{pct}%</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--slate-dim)", fontFamily: "var(--font-mono)" }}>
                    {new Date(r.last_update).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ color: "var(--slate)", fontSize: 12, padding: "20px 0", textAlign: "center" }}>
                No resources match the current filters.
              </div>
            )}
          </div>
        </div>

        {/* Right Asset Command Panel */}
        {selected && (
          <div 
            className="card" 
            style={{ 
              flex: "1 1 32%", 
              minWidth: "300px", 
              border: `1.5px solid ${TYPE_COLOR[selected.resource_type]}55`,
              boxShadow: `0 0 16px ${TYPE_COLOR[selected.resource_type]}11`
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "10px", textTransform: "uppercase", color: TYPE_COLOR[selected.resource_type], fontWeight: 700, letterSpacing: "0.05em" }}>
                  {selected.resource_type} Asset
                </span>
                <h2 style={{ fontSize: "18px", margin: "4px 0 0 0", color: "var(--white)" }}>{selected.name}</h2>
              </div>
              <button 
                onClick={() => setSelected(null)}
                style={{ background: "transparent", border: "none", color: "var(--slate)", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Asset quick details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "var(--slate)" }}>Current Status</span>
                <span className={`badge badge-${selected.status}`}>{selected.status}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "var(--slate)" }}>Station / Location</span>
                <span style={{ color: "var(--white)", fontWeight: 500 }}>
                  {selected.assigned_zone_name ? selected.assigned_zone_name.split("—")[0].trim() : selected.location}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "var(--slate)" }}>Usage Level</span>
                <span style={{ color: selected.utilized >= selected.capacity ? "var(--red)" : "var(--green)", fontWeight: 700 }}>
                  {selected.utilized} / {selected.capacity} Units ({selected.capacity > 0 ? Math.round((selected.utilized / selected.capacity) * 100) : 0}%)
                </span>
              </div>
            </div>

            {/* Success and Error Toasts */}
            {actionMessage && (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid var(--green)", color: "var(--green)", padding: "10px", borderRadius: "6px", fontSize: "12px", marginBottom: "16px" }}>
                {actionMessage}
              </div>
            )}
            {actionError && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid var(--red)", color: "var(--red)", padding: "10px", borderRadius: "6px", fontSize: "12px", marginBottom: "16px" }}>
                {actionError}
              </div>
            )}

            {/* Actions Form */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}>
              {selected.status === "standby" ? (
                <>
                  <h3 style={{ fontSize: "13px", margin: "0 0 10px 0", color: "var(--white)" }}>⚡ Dispatch Asset to Location</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <select
                      value={actionZoneId}
                      onChange={(e) => setActionZoneId(e.target.value)}
                      style={{
                        background: "rgba(15, 23, 42, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#fff",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "12px",
                        width: "100%",
                        outline: "none"
                      }}
                    >
                      <option value="">Select target disaster zone...</option>
                      {zones.map(z => (
                        <option key={z.id} value={z.id}>
                          {z.name.split("—")[0].trim()} ({z.severity.toUpperCase()} · AI Score: {z.priority_score})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleDispatch}
                      disabled={submitting || !actionZoneId}
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                    >
                      {submitting ? "Dispatching..." : "⚡ Dispatch Asset Now"}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <h3 style={{ fontSize: "13px", margin: "0 0 10px 0", color: "var(--white)" }}>⚡ Re-route to Different Location</h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        value={actionZoneId}
                        onChange={(e) => setActionZoneId(e.target.value)}
                        style={{
                          background: "rgba(15, 23, 42, 0.8)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#fff",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "12px",
                          flex: 1,
                          outline: "none"
                        }}
                      >
                        <option value="">Select new zone...</option>
                        {zones.filter(z => z.id !== selected.assigned_zone).map(z => (
                          <option key={z.id} value={z.id}>
                            {z.name.split("—")[0].trim()} ({z.severity.toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleReroute}
                        disabled={submitting || !actionZoneId}
                        className="btn btn-ghost"
                        style={{ fontSize: "11px", padding: "0 14px" }}
                      >
                        Re-route
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                    <h3 style={{ fontSize: "13px", margin: "0 0 6px 0", color: "var(--white)" }}>Recall Asset</h3>
                    <p style={{ fontSize: "11px", color: "var(--slate)", margin: "0 0 10px 0" }}>
                      Recall this asset back to the main Base Camp in Hyderabad. Status shifts back to standby.
                    </p>
                    <button
                      onClick={handleRecall}
                      disabled={submitting}
                      className="btn btn-ghost"
                      style={{ width: "100%", justifyContent: "center", color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)" }}
                    >
                      {submitting ? "Recalling..." : "Recall to Base Camp"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Resources by Location Lookup */}
      <div className="card" style={{ marginTop: 24, width: "100%" }}>
        <div className="card-title">📍 Resources by Location</div>
        <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 16 }}>
          Select a disaster zone below to view all resources currently allocated to that location.
        </div>

        <select
          value={selectedLocZone}
          onChange={(e) => setSelectedLocZone(e.target.value)}
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#fff",
            borderRadius: "6px",
            padding: "10px 14px",
            fontSize: "13px",
            width: "100%",
            outline: "none",
            marginBottom: 20,
            fontFamily: "var(--font-body)"
          }}
        >
          <option value="">— Select a location to inspect resources —</option>
          {zones.map(z => (
            <option key={z.id} value={z.id}>
              📍 {z.name.split("—")[0].trim()} ({z.district}, {z.state})
            </option>
          ))}
        </select>

        {selectedLocZone ? (() => {
          const zoneId = parseInt(selectedLocZone);
          const zone = zones.find(z => z.id === zoneId);
          const zoneResources = resources.filter(r => r.assigned_zone === zoneId);
          return (
            <div>
              {/* Zone header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: 8 }}>
                <span style={{ fontSize: 20 }}>📍</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--white)" }}>
                    {zone ? zone.name.split("—")[0].trim() : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--slate)" }}>
                    {zone ? `${zone.district}, ${zone.state}` : ""} &nbsp;·&nbsp;
                    <span style={{ color: zoneResources.length > 0 ? "var(--green)" : "var(--amber)" }}>
                      {zoneResources.length} resource{zoneResources.length !== 1 ? "s" : ""} allocated
                    </span>
                  </div>
                </div>
              </div>

              {/* Resource list */}
              {zoneResources.length === 0 ? (
                <div style={{ color: "var(--slate)", fontSize: 12, padding: "24px 0", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 6 }}>
                  No resources are currently allocated to this location.
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 110px 180px 140px", gap: 8, padding: "6px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--slate-dim)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                    <span>Resource Name</span>
                    <span>Category</span>
                    <span>Status</span>
                    <span>Usage</span>
                    <span>Units Used / Cap</span>
                  </div>
                  {zoneResources.map(r => {
                    const pct = r.capacity > 0 ? Math.round((r.utilized / r.capacity) * 100) : 0;
                    const color = TYPE_COLOR[r.resource_type] || "#94A3B8";
                    return (
                      <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 100px 110px 180px 140px", gap: 8, padding: "12px 10px", borderRadius: 6, alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 3, height: 22, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--white)" }}>
                            {TYPE_ICON[r.resource_type]} {r.name}
                          </span>
                        </div>
                        <span>
                          <span className="badge badge-medium" style={{ borderColor: color, color, fontSize: 10 }}>
                            {r.resource_type}
                          </span>
                        </span>
                        <span>
                          <span className={`badge badge-${r.status}`}>{r.status}</span>
                        </span>
                        <div className="util-cell">
                          <div className="util-bar-track">
                            <div className="util-bar-fill" style={{ width: `${pct}%`, background: pct >= 90 ? "#EF4444" : pct >= 60 ? "#F59E0B" : "#10B981" }} />
                          </div>
                          <span className="util-pct">{pct}%</span>
                        </div>
                        <span style={{ fontSize: 12, color: pct >= 90 ? "var(--red)" : "var(--slate)", fontFamily: "var(--font-mono)" }}>
                          {r.utilized.toLocaleString()} / {r.capacity.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                  {/* Summary row */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, padding: "12px 10px", marginTop: 8, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--slate)" }}>
                    <span>Total Units Used: <strong style={{ color: "var(--amber)" }}>{zoneResources.reduce((s, r) => s + (r.utilized || 0), 0).toLocaleString()}</strong></span>
                    <span>Total Capacity: <strong style={{ color: "var(--white)" }}>{zoneResources.reduce((s, r) => s + (r.capacity || 0), 0).toLocaleString()}</strong></span>
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div style={{ color: "var(--slate)", fontSize: 12, padding: "24px 0", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 6 }}>
            💡 Select a location from the dropdown above to view its allocated resources.
          </div>
        )}
      </div>

    </div>
  );
}
