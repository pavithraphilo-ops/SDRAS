// src/components/AlertsPanel.js
import React, { useState, useEffect, useCallback } from "react";
import { getAlerts, getZones, createAlert, acknowledgeAlert, acknowledgeAllAlerts } from "../services/api";
import "./AlertsPanel.css";

const TYPE_COLOR = { critical: "#EF4444", warning: "#F59E0B", info: "#3B82F6" };

export default function AlertsPanel({ tick }) {
  const [alerts, setAlerts] = useState([]);
  const [zones, setZones] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [newType, setNewType] = useState("info");
  const [newZone, setNewZone] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsData, zonesData] = await Promise.all([getAlerts(), getZones()]);
      setAlerts(alertsData);
      setZones(zonesData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [tick]);

  const acknowledge = async (id) => {
    try {
      await acknowledgeAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch (err) {
      console.error(err);
    }
  };

  const dismissAll = async () => {
    try {
      await acknowledgeAllAlerts();
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const sendAlert = async () => {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      const payload = {
        alert_type: newType,
        message: newMsg.trim(),
        zone: newZone || null,
        acknowledged: false,
      };
      const newAlert = await createAlert(payload);
      setAlerts((prev) => [newAlert, ...prev]);
      setNewMsg("");
      setNewZone("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const unresolved = alerts.filter((a) => !a.acknowledged);
  const resolved = alerts.filter((a) => a.acknowledged);

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center", color: "var(--slate)" }}>
          <div className="analyze-spinner" style={{ margin: "0 auto 16px" }} />
          <div>Loading alerts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Alerts & Notifications</h1>
        <p>Monitor and manage all system alerts across active disaster zones</p>
      </div>

      <div className="alerts-layout">
        <div className="alerts-main">
          {/* Summary row */}
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className="stat-card critical">
              <div className="stat-label">Critical</div>
              <div className="stat-value">{alerts.filter((a) => a.alert_type === "critical" && !a.acknowledged).length}</div>
              <div className="stat-sub">Unacknowledged</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-label">Warnings</div>
              <div className="stat-value">{alerts.filter((a) => a.alert_type === "warning" && !a.acknowledged).length}</div>
              <div className="stat-sub">Unacknowledged</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-label">Info</div>
              <div className="stat-value">{alerts.filter((a) => a.alert_type === "info").length}</div>
              <div className="stat-sub">Informational</div>
            </div>
          </div>

          {/* Unresolved */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Active Alerts
                {unresolved.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "var(--red)" }}>
                    ({unresolved.length})
                  </span>
                )}
              </div>
              {unresolved.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={dismissAll}>
                  Acknowledge All
                </button>
              )}
            </div>

            {unresolved.length === 0 ? (
              <div className="empty-alerts">
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ color: "var(--green)", fontWeight: 600 }}>All alerts acknowledged</div>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>No active issues requiring attention</div>
              </div>
            ) : (
              <div className="full-alerts-list">
                {unresolved.map((alert) => (
                  <div key={alert.id} className={`full-alert-card alert-type-${alert.alert_type}`}>
                    <div className="fac-stripe" style={{ background: TYPE_COLOR[alert.alert_type] }} />
                    <div className="fac-body">
                      <div className="fac-header">
                        <span className={`badge badge-${alert.alert_type === "critical" ? "critical" : alert.alert_type === "warning" ? "high" : "medium"}`}>
                          {alert.alert_type}
                        </span>
                        {alert.zone_name && (
                          <span style={{ fontSize: 11, color: "var(--slate)" }}>
                            Zone: {alert.zone_name?.split("—")[0].trim()}
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-dim)" }}>
                          {new Date(alert.created_at).toUTCString().slice(4, 25)} UTC
                        </span>
                      </div>
                      <div className="fac-message">{alert.message}</div>
                      <div className="fac-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => acknowledge(alert.id)}>
                          Acknowledge
                        </button>
                        {alert.alert_type === "critical" && (
                          <button className="btn btn-danger btn-sm">Escalate</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="card">
              <div className="card-title">Resolved ({resolved.length})</div>
              <div className="resolved-list">
                {resolved.map((alert) => (
                  <div key={alert.id} className="resolved-row">
                    <div className="resolved-dot" style={{ background: TYPE_COLOR[alert.alert_type] }} />
                    <div className="resolved-msg">{alert.message}</div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-dim)", marginLeft: "auto", flexShrink: 0 }}>
                      {new Date(alert.created_at).toUTCString().slice(17, 25)} UTC
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — send alert */}
        <div>
          <div className="card">
            <div className="card-title">Send Alert</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 14 }}>
              Broadcast an alert to all operators
            </div>

            <div className="send-form">
              <label className="form-label">Alert Type</label>
              <div className="type-select-row">
                {["info", "warning", "critical"].map((t) => (
                  <button
                    key={t}
                    className={`type-btn ${newType === t ? "type-btn-active" : ""}`}
                    style={newType === t ? { borderColor: TYPE_COLOR[t], color: TYPE_COLOR[t], background: `${TYPE_COLOR[t]}15` } : {}}
                    onClick={() => setNewType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <label className="form-label" style={{ marginTop: 12 }}>Affected Zone (optional)</label>
              <select
                className="alloc-select"
                style={{ width: "100%", marginBottom: 0 }}
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
              >
                <option value="">No specific zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name.split("—")[0].trim()}</option>
                ))}
              </select>

              <label className="form-label" style={{ marginTop: 12 }}>Message</label>
              <textarea
                className="alert-textarea"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Describe the situation or action required..."
                rows={4}
              />

              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
                onClick={sendAlert}
                disabled={!newMsg.trim() || sending}
              >
                {sending ? "Sending..." : "Send Alert"}
              </button>
            </div>
          </div>

          {/* Alert stats */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Response Stats</div>
            <div className="resp-stats">
              <div className="resp-stat">
                <div className="resp-stat-val">4.2 min</div>
                <div className="resp-stat-label">Avg. Response Time</div>
              </div>
              <div className="resp-stat">
                <div className="resp-stat-val" style={{ color: "var(--green)" }}>
                  {alerts.length > 0 ? Math.round((resolved.length / alerts.length) * 100) : 0}%
                </div>
                <div className="resp-stat-label">Ack. Rate</div>
              </div>
              <div className="resp-stat">
                <div className="resp-stat-val">{alerts.length}</div>
                <div className="resp-stat-label">Total Alerts</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
