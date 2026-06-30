// src/components/EmergencyPortal.js
import React, { useState, useEffect } from "react";
import { createReport, getReports, voicebotReport } from "../services/api";
import "./EmergencyPortal.css";

const SEV_COLOR = { critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#10B981" };

export default function EmergencyPortal({ tick }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("form"); // "form" | "voicebot" | "reports"

  // Form state
  const [form, setForm] = useState({
    location: "",
    disaster_type: "Flood",
    severity: "medium",
    people_affected: "",
    description: "",
    reporter_name: "",
    reporter_contact: "",
  });

  // VoiceBot state
  const [transcript, setTranscript] = useState("");
  const [voicebotResult, setVoicebotResult] = useState(null);
  const [voicebotLoading, setVoicebotLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    fetchReports();
    // Set up Web Speech API
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-IN";
      rec.onresult = (event) => {
        const text = Array.from(event.results).map((r) => r[0].transcript).join(" ");
        setTranscript(text);
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      setRecognition(rec);
    }
  }, [tick]);

  const fetchReports = async () => {
    try {
      const data = await getReports();
      setReports(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.location || !form.people_affected) return;
    setSubmitting(true);
    setSubmitted(false);
    try {
      await createReport({ ...form, people_affected: parseInt(form.people_affected) });
      setSubmitted(true);
      setForm({ location: "", disaster_type: "Flood", severity: "medium", people_affected: "", description: "", reporter_name: "", reporter_contact: "" });
      fetchReports();
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const startListening = () => {
    if (recognition && !isListening) {
      setIsListening(true);
      setTranscript("");
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleVoicebotSubmit = async () => {
    if (!transcript.trim()) return;
    setVoicebotLoading(true);
    setVoicebotResult(null);
    try {
      const result = await voicebotReport(transcript);
      setVoicebotResult(result);
      fetchReports();
    } catch (err) {
      console.error(err);
    } finally {
      setVoicebotLoading(false);
    }
  };

  const getPriorityLabel = (score) => {
    if (score >= 75) return { label: "CRITICAL", color: "#EF4444" };
    if (score >= 50) return { label: "HIGH", color: "#F59E0B" };
    if (score >= 30) return { label: "MEDIUM", color: "#3B82F6" };
    return { label: "LOW", color: "#10B981" };
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Emergency Request Portal</h1>
        <p>Submit emergency reports and track response status in real time</p>
      </div>

      {/* Tabs */}
      <div className="portal-tabs">
        {[
          { key: "form", label: "📋 Submit Report" },
          { key: "voicebot", label: "🎤 VoiceBot" },
          { key: "reports", label: `📡 Live Reports (${reports.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`portal-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Submit Report Tab */}
      {activeTab === "form" && (
        <div className="portal-layout">
          <div className="portal-main">
            <div className="card">
              <div className="card-title">New Emergency Report</div>
              <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 20 }}>
                Fill in the details below. The AI will automatically calculate a priority score.
              </div>

              {submitted && (
                <div className="success-banner">
                  ✓ Emergency report submitted successfully! AI priority score calculated and zone updated.
                </div>
              )}

              <form onSubmit={handleSubmit} className="report-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Location / Area *</label>
                    <input
                      className="form-input"
                      name="location"
                      value={form.location}
                      onChange={handleInput}
                      placeholder="e.g. Ward 12, North Sector"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Disaster Type *</label>
                    <select className="form-input" name="disaster_type" value={form.disaster_type} onChange={handleInput}>
                      {["Flood", "Earthquake", "Wildfire", "Storm", "Drought", "Cyclone", "Landslide", "Other"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Severity *</label>
                    <div className="severity-buttons">
                      {["low", "medium", "high", "critical"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`sev-btn ${form.severity === s ? "sev-btn-active" : ""}`}
                          style={form.severity === s ? { borderColor: SEV_COLOR[s], color: SEV_COLOR[s], background: `${SEV_COLOR[s]}18` } : {}}
                          onClick={() => setForm((prev) => ({ ...prev, severity: s }))}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">People Affected *</label>
                    <input
                      className="form-input"
                      name="people_affected"
                      type="number"
                      value={form.people_affected}
                      onChange={handleInput}
                      placeholder="Estimated count"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    name="description"
                    value={form.description}
                    onChange={handleInput}
                    rows={3}
                    placeholder="Describe the situation, immediate needs, access issues..."
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Reporter Name</label>
                    <input className="form-input" name="reporter_name" value={form.reporter_name} onChange={handleInput} placeholder="Optional" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact</label>
                    <input className="form-input" name="reporter_contact" value={form.reporter_contact} onChange={handleInput} placeholder="Phone / ID" />
                  </div>
                </div>

                {/* AI preview */}
                {form.people_affected && form.severity && (
                  <div className="ai-preview">
                    <div className="ai-preview-label">✦ AI Priority Preview</div>
                    <div className="ai-preview-row">
                      <div>
                        <div style={{ fontSize: 11, color: "var(--slate)" }}>Estimated Score</div>
                        {(() => {
                          const sevW = { critical: 100, high: 75, medium: 50, low: 25 };
                          const ps = Math.round((sevW[form.severity] * 0.6) + (Math.min(100, (parseInt(form.people_affected || 0) / 10000) * 100) * 0.4));
                          const { label, color } = getPriorityLabel(ps);
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                              <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "var(--font-display)" }}>{ps}</span>
                              <span className="badge" style={{ background: `${color}20`, color, border: `1px solid ${color}` }}>{label}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--slate)", maxWidth: 220 }}>
                        Score calculated from severity weight (60%) + affected population ratio (40%)
                      </div>
                    </div>
                  </div>
                )}

                <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
                  {submitting ? "Submitting..." : "🚨 Submit Emergency Report"}
                </button>
              </form>
            </div>
          </div>

          {/* Right sidebar — quick stats */}
          <div>
            <div className="card">
              <div className="card-title">Report Status Overview</div>
              {["pending", "processing", "allocated", "resolved"].map((s) => {
                const count = reports.filter((r) => r.status === s).length;
                const colors = { pending: "#EF4444", processing: "#F59E0B", allocated: "#3B82F6", resolved: "#10B981" };
                return (
                  <div key={s} className="status-overview-row">
                    <div className="status-dot" style={{ background: colors[s] }} />
                    <span style={{ fontSize: 13, textTransform: "capitalize", flex: 1 }}>{s}</span>
                    <span style={{ fontWeight: 700, color: colors[s] }}>{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">AI Scoring Formula</div>
              <div className="formula-card">
                <div className="formula-item">
                  <span style={{ color: "#F59E0B" }}>Severity Weight</span>
                  <span>60%</span>
                </div>
                <div className="formula-item">
                  <span style={{ color: "#3B82F6" }}>Population Impact</span>
                  <span>40%</span>
                </div>
                <div className="formula-divider" />
                <div style={{ fontSize: 11, color: "var(--slate)" }}>
                  Critical = 100 · High = 75 · Medium = 50 · Low = 25
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VoiceBot Tab */}
      {activeTab === "voicebot" && (
        <div className="portal-layout">
          <div className="portal-main">

            {/* Hero section */}
            <div className="voicebot-hero">
              <div className="voicebot-title">🎤 VoiceBot Emergency Reporting</div>
              <div className="voicebot-subtitle">
                Speak or type an emergency description. Our AI instantly extracts the location, disaster type, severity, and creates an emergency report — no forms needed.
              </div>

              {/* Mic with sonar rings */}
              <div className="voicebot-mic-area">
                <div
                  className={`mic-button ${isListening ? "mic-listening" : ""}`}
                  onClick={isListening ? stopListening : startListening}
                  title={isListening ? "Click to stop" : "Click to speak"}
                >
                  🎤
                </div>
                {isListening && (
                  <div className="mic-rings">
                    <div className="mic-ring" />
                    <div className="mic-ring" />
                    <div className="mic-ring" />
                  </div>
                )}
                <div className="mic-status">
                  {isListening ? (
                    <span style={{ color: "#EF4444", fontWeight: 600 }}>● RECORDING — speak clearly</span>
                  ) : (
                    <span style={{ color: "var(--slate)" }}>Click microphone to start</span>
                  )}
                </div>
              </div>
            </div>

            {/* Transcript input */}
            <div className="card">
              <div className="form-group">
                <label className="form-label">Voice Transcript / Type Here</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder='Say or type: "There is flooding in Ward 12, around 200 people are trapped. We need medical help urgently."'
                  style={{ fontSize: 14, lineHeight: 1.6 }}
                />
              </div>

              <div className="example-phrases" style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "var(--slate)", marginBottom: 8, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>💡 Tap to use an example:</div>
                {[
                  "There is flooding in Ward 5, 150 people need rescue immediately",
                  "Earthquake damage in Central Market, 500 people affected, critical situation",
                  "Fire in Eastern Hills area, 80 families evacuated, need food and shelter",
                ].map((phrase, i) => (
                  <button key={i} className="phrase-btn" onClick={() => setTranscript(phrase)}>
                    "{phrase}"
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 16, padding: "13px" }}
                onClick={handleVoicebotSubmit}
                disabled={!transcript.trim() || voicebotLoading}
              >
                {voicebotLoading ? (
                  <><div className="analyze-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing transcript...</>
                ) : (
                  <>🤖 Process & Create Emergency Report</>
                )}
              </button>
            </div>

            {/* VoiceBot Result */}
            {voicebotResult && (
              <div className="voicebot-result-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 20 }}>✅</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--green)", fontSize: 15 }}>Report Created from VoiceBot</div>
                    <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2 }}>Report #{voicebotResult.report?.id} · AI scored and zone updated</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
                  <div className="vb-extracted">
                    <div style={{ fontSize: 11, color: "var(--slate)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Extracted:</div>
                    {Object.entries(voicebotResult.extracted || {}).map(([k, v]) => (
                      <div key={k} className="vb-field">
                        <span className="vb-key">{k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                        <span className="vb-val">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="vb-score-box">
                    <div style={{ fontSize: 10, color: "var(--slate)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Priority</div>
                    <div style={{ fontSize: 40, fontWeight: 700, color: "#F59E0B", fontFamily: "var(--font-display)", lineHeight: 1, textShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
                      {voicebotResult.report?.ai_priority_score}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--slate)", marginTop: 4 }}>/ 100</div>
                  </div>
                </div>

                <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => { setVoicebotResult(null); setTranscript(""); }}>
                  ← Submit Another Report
                </button>
              </div>
            )}
          </div>

          {/* Right info */}
          <div>
            <div className="card">
              <div className="card-title">How VoiceBot Works</div>
              <div className="vb-steps">
                {[
                  { icon: "🎤", title: "Speak or Type", desc: "Describe the emergency in natural language — no forms needed" },
                  { icon: "🧠", title: "AI Extracts", desc: "Location, disaster type, severity, affected people count" },
                  { icon: "📋", title: "Auto-Creates Report", desc: "Emergency report saved instantly with AI priority score" },
                  { icon: "🗺️", title: "Map & Dashboard Update", desc: "Zone appears on live map, dashboard shows new alert" },
                  { icon: "🚑", title: "Resources Dispatched", desc: "AI recommends nearest available resources" },
                ].map((step, i) => (
                  <div key={i} className="vb-step">
                    <div className="vb-step-icon">{step.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{step.title}</div>
                      <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2, lineHeight: 1.4 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-title">Why VoiceBot?</div>
              {[
                { icon: "📵", text: "Works without smartphone literacy" },
                { icon: "♿", text: "Accessible to everyone" },
                { icon: "⚡", text: "Zero-friction emergency reporting" },
                { icon: "🌍", text: "Reaches remote & underserved areas" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ color: "var(--slate)" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>All Emergency Reports</div>
            <button className="btn btn-ghost btn-sm" onClick={fetchReports}>↻ Refresh</button>
          </div>

          {loading ? (
            <div style={{ color: "var(--slate)", fontSize: 13 }}>Loading...</div>
          ) : reports.length === 0 ? (
            <div style={{ color: "var(--slate)", fontSize: 13 }}>No reports submitted yet.</div>
          ) : (
            <div className="reports-table">
              <div className="report-table-header">
                <span>ID</span>
                <span>Location</span>
                <span>Type</span>
                <span>Severity</span>
                <span>People</span>
                <span>AI Score</span>
                <span>Status</span>
                <span>Reporter</span>
                <span>Time</span>
              </div>
              {reports.map((r) => {
                const { color } = getPriorityLabel(r.ai_priority_score);
                return (
                  <div key={r.id} className={`report-table-row ${r.is_voicebot ? "voicebot-row" : ""}`}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>#{r.id}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{r.location}</span>
                    <span><span className="badge badge-medium">{r.disaster_type}</span></span>
                    <span><span className={`badge badge-${r.severity}`}>{r.severity}</span></span>
                    <span style={{ fontSize: 12 }}>{r.people_affected.toLocaleString()}</span>
                    <span style={{ fontWeight: 700, color, fontFamily: "var(--font-display)" }}>{r.ai_priority_score}</span>
                    <span>
                      <span className={`status-pill status-${r.status}`}>{r.status}</span>
                    </span>
                    <span style={{ fontSize: 11, color: "var(--slate)" }}>
                      {r.is_voicebot ? "🎤 VoiceBot" : r.reporter_name || "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--slate-dim)", fontFamily: "var(--font-mono)" }}>
                      {new Date(r.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
