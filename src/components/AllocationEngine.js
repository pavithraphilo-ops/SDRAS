// src/components/AllocationEngine.js
import React, { useState, useEffect, useCallback } from "react";
import { getZones, getResources, runAIAnalysis, createAllocation, updateAllocation, createZone, createResource, voicebotCommand } from "../services/api";
import "./AllocationEngine.css";

const TYPE_COLOR = { medical: "#EF4444", rescue: "#F59E0B", food: "#10B981", shelter: "#3B82F6" };

export default function AllocationEngine() {
  const [zones, setZones] = useState([]);
  const [resources, setResources] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [applied, setApplied] = useState([]);
  const [manualZone, setManualZone] = useState("");
  const [manualResource, setManualResource] = useState("");
  const [manualAllocations, setManualAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyStatus, setApplyStatus] = useState({});

  // Custom Location Registry States
  const [newPlace, setNewPlace] = useState("");
  const [newState, setNewState] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [needMedical, setNeedMedical] = useState(50);
  const [needFood, setNeedFood] = useState(50);
  const [needShelter, setNeedShelter] = useState(50);
  const [needRescue, setNeedRescue] = useState(50);
  const [regMessage, setRegMessage] = useState("");
  const [regError, setRegError] = useState("");

  // Custom Resource Registry States
  const [resNameSelect, setResNameSelect] = useState("Medical Unit");
  const [customResName, setCustomResName] = useState("");
  const [resType, setResType] = useState("medical");
  const [resCapacity, setResCapacity] = useState(200);
  const [resMessage, setResMessage] = useState("");
  const [resError, setResError] = useState("");

  // Command Bot States
  const [commandText, setCommandText] = useState("");
  const [commandMessage, setCommandMessage] = useState("");
  const [commandError, setCommandError] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-IN";
      rec.onresult = (event) => {
        const text = Array.from(event.results).map((r) => r[0].transcript).join(" ");
        setCommandText(text);
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      setRecognition(rec);
    }
  }, []);

  const startListening = () => {
    if (recognition && !isListening) {
      setIsListening(true);
      setCommandText("");
      setCommandMessage("");
      setCommandError("");
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const handleCommandSubmit = async () => {
    if (!commandText.trim()) return;
    setCommandLoading(true);
    setCommandMessage("");
    setCommandError("");
    try {
      const res = await voicebotCommand(commandText);
      setCommandMessage(res.message || "Command executed successfully!");
      setCommandText("");
      fetchData();
    } catch (err) {
      setCommandError(err.message || "Failed to process command.");
    } finally {
      setCommandLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [zonesData, resourcesData] = await Promise.all([getZones(), getResources()]);
      setZones(zonesData);
      setResources(resourcesData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const standbyResources = resources.filter((r) => r.status === "standby");

  const handleRunAI = async () => {
    setRunning(true);
    setDone(false);
    try {
      const result = await runAIAnalysis();
      setAiResults(result.analysis || []);
      setDone(true);
    } catch (err) {
      console.error("AI analysis error:", err);
    } finally {
      setRunning(false);
    }
  };

  const applyRec = async (zoneId, resourceId, recKey) => {
    setApplyStatus((prev) => ({ ...prev, [recKey]: "loading" }));
    try {
      await createAllocation({ zone: zoneId, resource: resourceId });
      setApplied((prev) => [...prev, recKey]);
      setApplyStatus((prev) => ({ ...prev, [recKey]: "done" }));
      fetchData(); // Refresh resources
    } catch (err) {
      console.error("Allocation error:", err);
      setApplyStatus((prev) => ({ ...prev, [recKey]: "error" }));
    }
  };

  const handleManualAllocate = async () => {
    if (!manualZone || !manualResource) return;
    const zone = zones.find((z) => z.id === parseInt(manualZone));
    const res = resources.find((r) => r.id === parseInt(manualResource));
    if (!zone || !res) return;
    try {
      await createAllocation({ zone: zone.id, resource: res.id, notes: "Manual override" });
      setManualAllocations((prev) => [...prev, { zone, resource: res, id: Date.now() }]);
      setManualZone("");
      setManualResource("");
      fetchData();
    } catch (err) {
      console.error("Manual allocation error:", err);
    }
  };

  // Build flat recommendations list from AI results
  const allRecommendations = aiResults.flatMap((zoneResult) =>
    (zoneResult.recommendations || []).map((rec) => ({
      ...rec,
      zone_id: zoneResult.zone_id,
      zone_name: zoneResult.zone_name,
      key: `${zoneResult.zone_id}-${rec.resource_id}`,
    }))
  );

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center", color: "var(--slate)" }}>
          <div className="analyze-spinner" style={{ margin: "0 auto 16px" }} />
          <div>Loading allocation engine...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>AI Allocation Engine</h1>
        <p>Intelligent resource-to-zone matching using real-time need scoring and priority algorithms</p>
      </div>

      <div className="alloc-layout">
        {/* Left — AI engine */}
        <div>
          {/* Engine card */}
          <div className="card engine-card">
            <div className="engine-header">
              <div>
                <div className="card-title">Smart Allocation Engine</div>
                <div style={{ fontSize: 13, color: "var(--slate)" }}>
                  Analyzes zone needs, population, severity, and resource availability
                </div>
              </div>
              <div className="ai-badge">
                <span className="ai-spark">✦</span> AI
              </div>
            </div>

            <div className="algo-factors">
              <div className="algo-factor">
                <div className="af-icon" style={{ color: "#EF4444" }}>◉</div>
                <div>
                  <div className="af-name">Severity Weight</div>
                  <div className="af-desc">Critical zones get 4× priority multiplier</div>
                </div>
                <div className="af-pct" style={{ color: "#EF4444" }}>30%</div>
              </div>
              <div className="algo-factor">
                <div className="af-icon" style={{ color: "#F59E0B" }}>◉</div>
                <div>
                  <div className="af-name">Need Index</div>
                  <div className="af-desc">Averaged across medical, food, rescue, shelter</div>
                </div>
                <div className="af-pct" style={{ color: "#F59E0B" }}>40%</div>
              </div>
              <div className="algo-factor">
                <div className="af-icon" style={{ color: "#3B82F6" }}>◉</div>
                <div>
                  <div className="af-name">Population Impact</div>
                  <div className="af-desc">Affected persons as ratio of total population</div>
                </div>
                <div className="af-pct" style={{ color: "#3B82F6" }}>30%</div>
              </div>
            </div>

            <button
              className={`btn btn-primary engine-run-btn ${running ? "running" : ""}`}
              onClick={handleRunAI}
              disabled={running}
            >
              {running ? (
                <><span className="spinner" />Analyzing Zones...</>
              ) : done ? (
                <>✓ Re-run Analysis</>
              ) : (
                <>✦ Run AI Analysis</>
              )}
            </button>
          </div>

          {/* Zone priority table */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Zone Priority Scores</div>
            <div className="priority-list">
              {[...zones]
                .sort((a, b) => b.priority_score - a.priority_score)
                .map((zone, idx) => (
                  <div key={zone.id} className="priority-row">
                    <div className="priority-rank">{idx + 1}</div>
                    <div className="priority-info">
                      <div className="priority-name">{zone.name.split("—")[0].trim()}</div>
                      <div className="priority-type">{zone.disaster_type} · {zone.affected_count.toLocaleString()} affected</div>
                    </div>
                    <div className="priority-score-wrap">
                      <div
                        className="priority-score-bar"
                        style={{
                          width: `${zone.priority_score}%`,
                          background: zone.priority_score >= 65 ? "#EF4444" : zone.priority_score >= 50 ? "#F59E0B" : "#3B82F6",
                        }}
                      />
                      <span className="priority-score-num">{zone.priority_score}</span>
                    </div>
                    <span className={`badge badge-${zone.severity}`}>{zone.severity}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right — Recommendations + Manual */}
        <div>
          {/* AI Command Voice & Text Assistant */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">🤖 AI command bot (Voice & Text)</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 14 }}>
              Speak or type a command to manage assets (e.g. add standby, register zone, dispatch, recall).
            </div>

            {commandMessage && <div style={{ color: "var(--green)", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(16,185,129,0.1)", borderRadius: 4 }}>✓ {commandMessage}</div>}
            {commandError && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 4 }}>⚠️ {commandError}</div>}

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <div
                onClick={isListening ? stopListening : startListening}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isListening ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.1)",
                  border: isListening ? "1px solid var(--red)" : "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                title={isListening ? "Click to stop" : "Click to speak"}
              >
                🎙️
              </div>
              <input
                type="text"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder={isListening ? "Listening... speak now" : "Type or speak a command... (e.g. 'Recall Medical Unit')"}
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 12,
                  outline: "none"
                }}
              />
            </div>

            <div className="example-phrases" style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                "Add standby Medical Unit with capacity 500",
                "Register location Secunderabad Relief Hub",
                "Dispatch Medical Unit to Secunderabad Relief Hub",
                "Recall Medical Unit"
              ].map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCommandText(phrase);
                    setCommandMessage("");
                    setCommandError("");
                  }}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    color: "var(--slate)",
                    fontSize: 10,
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  "{phrase}"
                  {/* tag [ignoring loop detection] */}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCommandSubmit}
              disabled={!commandText.trim() || commandLoading}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {commandLoading ? "Executing Command..." : "🤖 Execute Command"}
            </button>
          </div>

          {/* AI Recommendations */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>AI Recommendations</div>
              {done && <span className="badge badge-high">{allRecommendations.length} actions</span>}
            </div>

            {!done ? (
              <div className="empty-state">
                {running ? (
                  <div className="analyzing">
                    <div className="analyze-spinner" />
                    <div>Analyzing {zones.length} zones and {resources.length} resources...</div>
                    <div style={{ fontSize: 11, color: "var(--slate-dim)", marginTop: 4 }}>Computing optimal allocation matrix</div>
                  </div>
                ) : (
                  <div style={{ color: "var(--slate)", fontSize: 13 }}>
                    Run the AI Analysis to get resource allocation recommendations.
                  </div>
                )}
              </div>
            ) : allRecommendations.length === 0 ? (
              <div style={{ color: "var(--green)", fontSize: 13, padding: "12px 0" }}>
                ✓ All zones adequately resourced or no standby resources available
              </div>
            ) : (
              <div className="recs-list">
                {allRecommendations.map((rec) => {
                  const isApplied = applied.includes(rec.key);
                  const status = applyStatus[rec.key];
                  return (
                    <div key={rec.key} className={`rec-card ${isApplied ? "rec-applied" : ""}`}>
                      <div className="rec-header">
                        <div className="rec-type-dot" style={{ background: TYPE_COLOR[rec.resource_type] }} />
                        <div className="rec-title">{rec.resource_name}</div>
                        <span className={`badge badge-${rec.urgency === "immediate" ? "critical" : "high"}`}>
                          {rec.urgency}
                        </span>
                      </div>
                      <div className="rec-arrow">
                        <div className="rec-from">Standby</div>
                        <div className="rec-arrow-line">→</div>
                        <div className="rec-to">{rec.zone_name?.split("—")[0].trim()}</div>
                      </div>
                      <div className="rec-reason">{rec.reason}</div>
                      <div className="rec-footer">
                        <div style={{ fontSize: 11, color: "var(--slate)" }}>
                          Priority Score: <strong style={{ color: "var(--white)" }}>{rec.priority_score}</strong>
                        </div>
                        {isApplied ? (
                          <span className="badge badge-deployed">✓ Applied</span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => applyRec(rec.zone_id, rec.resource_id, rec.key)}
                            disabled={status === "loading"}
                          >
                            {status === "loading" ? "Applying..." : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual allocation */}
          <div className="card">
            <div className="card-title">Manual Override</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 12 }}>
              Manually assign a standby resource to a zone
            </div>
            {standbyResources.length === 0 && (
              <div style={{ color: "#EF4444", fontSize: 11, marginBottom: 12, lineHeight: "1.4" }}>
                ⚠️ No resources are currently on standby. Go to the <strong>Resources</strong> page to recall an asset back to Base Camp first.
              </div>
            )}
            <div className="manual-form">
              <select className="alloc-select" value={manualResource} onChange={(e) => setManualResource(e.target.value)}>
                <option value="">Select resource...</option>
                {standbyResources.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select className="alloc-select" value={manualZone} onChange={(e) => setManualZone(e.target.value)}>
                <option value="">Select zone...</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name.split("—")[0].trim()}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleManualAllocate} disabled={!manualZone || !manualResource}>
                Allocate
              </button>
            </div>

            {manualAllocations.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>Manual Allocations</div>
                {manualAllocations.map((ma) => (
                  <div key={ma.id} className="manual-alloc-row">
                    <span className="badge badge-standby">Manual</span>
                    <span style={{ fontSize: 12 }}>{ma.resource.name}</span>
                    <span style={{ color: "var(--slate)", fontSize: 12 }}>→</span>
                    <span style={{ fontSize: 12 }}>{ma.zone.name.split("—")[0].trim()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Standby Resource Card */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Add Standby Resource</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 12 }}>
              Instantly add a new standby resource stationed at Base Camp — Hyderabad.
            </div>

            {resMessage && <div style={{ color: "var(--green)", fontSize: 12, marginBottom: 10 }}>{resMessage}</div>}
            {resError && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{resError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, color: "var(--slate)", marginBottom: 4 }}>RESOURCE TYPE / CATEGORY</label>
                <select
                  className="alloc-select"
                  value={resType}
                  onChange={(e) => {
                    setResType(e.target.value);
                    // Set a clean default name based on type
                    const typeToName = {
                      medical: "Medical Unit",
                      rescue: "Rescue Team",
                      food: "Food Supply Unit",
                      shelter: "Emergency Shelter",
                    };
                    setResNameSelect(typeToName[e.target.value] || "Other");
                  }}
                  style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", outline: "none" }}
                >
                  <option value="medical">Medical Unit</option>
                  <option value="rescue">Rescue Team</option>
                  <option value="food">Food / Water Supply Unit</option>
                  <option value="shelter">Emergency Shelter</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, color: "var(--slate)", marginBottom: 4 }}>RESOURCE NAME</label>
                <select
                  className="alloc-select"
                  value={resNameSelect}
                  onChange={(e) => setResNameSelect(e.target.value)}
                  style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", outline: "none", marginBottom: resNameSelect === "Other" ? 8 : 0 }}
                >
                  {resType === "medical" && <option value="Medical Unit">Medical Unit</option>}
                  {resType === "rescue" && (
                    <>
                      <option value="Rescue Team">Rescue Team</option>
                      <option value="Fire Suspension">Fire Suspension</option>
                    </>
                  )}
                  {resType === "food" && (
                    <>
                      <option value="Food Supply Unit">Food Supply Unit</option>
                      <option value="Water Supply Unit">Water Supply Unit</option>
                    </>
                  )}
                  {resType === "shelter" && <option value="Emergency Shelter">Emergency Shelter</option>}
                  <option value="Other">Other / Custom Name...</option>
                </select>

                {resNameSelect === "Other" && (
                  <input
                    type="text"
                    value={customResName}
                    onChange={(e) => setCustomResName(e.target.value)}
                    placeholder="Enter custom resource name..."
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", width: "100%", color: "#fff", fontSize: 12, outline: "none" }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, color: "var(--slate)", marginBottom: 4 }}>TOTAL CAPACITY (UNITS)</label>
                <input
                  type="number"
                  value={resCapacity}
                  onChange={(e) => setResCapacity(e.target.value)}
                  placeholder="e.g. 500"
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", width: "100%", color: "#fff", fontSize: 12, outline: "none" }}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={async () => {
                  const name = resNameSelect === "Other" ? customResName : resNameSelect;
                  if (!name) {
                    setResError("Please enter or select a resource name.");
                    return;
                  }
                  setResMessage("");
                  setResError("");
                  try {
                    await createResource({
                      name: name.trim(),
                      resource_type: resType,
                      status: "standby",
                      assigned_zone: null,
                      capacity: parseInt(resCapacity) || 100,
                      utilized: 0,
                      location: "Base Camp — Hyderabad",
                    });
                    setResMessage(`Successfully added ${name} to Base Camp.`);
                    setCustomResName("");
                    fetchData();
                  } catch (err) {
                    setResError("Failed to add resource to database.");
                  }
                }}
                style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
              >
                Save Resource to Base Camp
              </button>
            </div>
          </div>

          {/* Manual Location Needs Registration Card */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Register Location & Resource Needs</div>
            <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 12 }}>
              Manually add a place with its current resource deficit levels to the database.
            </div>
            
            {regMessage && <div style={{ color: "var(--green)", fontSize: 12, marginBottom: 10 }}>{regMessage}</div>}
            {regError && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{regError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "var(--slate)", marginBottom: 4 }}>STATE</label>
                  <input 
                    type="text" 
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    placeholder="e.g. Telangana"
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", width: "100%", color: "#fff", fontSize: 12, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "var(--slate)", marginBottom: 4 }}>DISTRICT</label>
                  <input 
                    type="text" 
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", width: "100%", color: "#fff", fontSize: 12, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, color: "var(--slate)", marginBottom: 4 }}>PLACE / REGION NAME</label>
                <input 
                  type="text" 
                  value={newPlace}
                  onChange={(e) => setNewPlace(e.target.value)}
                  placeholder="e.g. Begumpet Sector 3"
                  style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", width: "100%", color: "#fff", fontSize: 12, outline: "none" }}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--white)", display: "block", marginBottom: 8 }}>RESOURCE REQUIREMENT DEFICIT LEVELS</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 15px" }}>
                  {[
                    { label: "🏥 Medical Need", val: needMedical, set: setNeedMedical },
                    { label: "🍎 Food/Water Need", val: needFood, set: setNeedFood },
                    { label: "⛺ Shelter Need", val: needShelter, set: setNeedShelter },
                    { label: "🚒 Rescue Need", val: needRescue, set: setNeedRescue },
                  ].map((need) => (
                    <div key={need.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--slate)", marginBottom: 2 }}>
                        <span>{need.label}</span>
                        <span>{need.val}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={need.val}
                        onChange={(e) => need.set(parseInt(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--blue)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  if (!newPlace || !newState || !newDistrict) {
                    setRegError("Please fill in all location fields (Place, State, District).");
                    return;
                  }
                  setRegMessage("");
                  setRegError("");
                  try {
                    const coord_x = 35 + Math.random() * 8;
                    const coord_y = 60 + Math.random() * 8;
                    await createZone({
                      name: `${newPlace} — Disaster Relief Zone`,
                      disaster_type: "Flood Relief",
                      severity: needMedical > 75 || needRescue > 75 ? "critical" : "medium",
                      state: newState,
                      district: newDistrict,
                      data_source: "📝 Manual Operations Registry",
                      population: 5000,
                      affected_count: 850,
                      coord_x,
                      coord_y,
                      need_medical: parseInt(needMedical),
                      need_food: parseInt(needFood),
                      need_shelter: parseInt(needShelter),
                      need_rescue: parseInt(needRescue),
                      is_active: true
                    });
                    setRegMessage(`Successfully registered ${newPlace} in database.`);
                    setNewPlace("");
                    setNewState("");
                    setNewDistrict("");
                    setNeedMedical(50);
                    setNeedFood(50);
                    setNeedShelter(50);
                    setNeedRescue(50);
                    fetchData();
                  } catch (err) {
                    setRegError("Failed to register location in database.");
                  }
                }} 
                style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
              >
                Save Location Needs to Database
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
