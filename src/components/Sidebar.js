// src/components/Sidebar.js
import React from "react";
import "./Sidebar.css";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",    icon: "dashboard" },
  { id: "map",       label: "Zone Map",     icon: "map" },
  { id: "resources", label: "Resources",    icon: "resources" },
  { id: "allocate",  label: "AI Allocate",  icon: "allocate" },
  { id: "portal",    label: "Emergency",    icon: "portal" },
  { id: "alerts",    label: "Alerts",       icon: "alerts" },
];

const NavIcon = ({ id }) => {
  const icons = {
    dashboard: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    map: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L6 4.5H2V16L6 13.5L9 16L12 13.5L16 16V4.5L12 7L9 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    resources: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 6h14M2 12h14M7 1v16M11 1v16" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    allocate: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 1v3M9 14v3M1 9h3M14 9h3M3.22 3.22l2.12 2.12M12.66 12.66l2.12 2.12M14.78 3.22l-2.12 2.12M5.34 12.66l-2.12 2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    portal: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1C4.58 1 1 4.58 1 9s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M1 9h2M15 9h2M9 1v2M9 15v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    alerts: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L1 16h16L9 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M9 7v4M9 13v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  };
  return icons[id] || null;
};

export default function Sidebar({ activeView, setActiveView, alertCount = 0, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L3 7v8l8 5 8-5V7L11 2z" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M11 2v18M3 7l8 5 8-5" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div className="brand-name">SDRAS</div>
          <div className="brand-sub">Disaster Response</div>
        </div>
      </div>

      <div className="sidebar-status">
        <span className="live-dot" />
        <span className="status-text">System Active</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#10B981" }}>● API</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">COMMAND CENTER</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? "active" : ""}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="nav-icon">
              <NavIcon id={item.id} />
            </span>
            <span className="nav-label">{item.label}</span>
            {item.id === "alerts" && alertCount > 0 && (
              <span className="nav-badge">{alertCount}</span>
            )}
            {item.id === "allocate" && (
              <span className="nav-badge ai">AI</span>
            )}
            {item.id === "portal" && (
              <span className="nav-badge" style={{ background: "rgba(239,68,68,0.2)", color: "#EF4444" }}>SOS</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ paddingBottom: "24px" }}>
        {user && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#ffffff", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "16px" }}>👤</span> admin
            </span>
            <button 
              onClick={onLogout} 
              className="btn btn-danger" 
              style={{ padding: "6px 14px", fontSize: "12px", fontWeight: "600", borderRadius: "6px", backgroundColor: "#EF4444", color: "#ffffff", border: "none", boxShadow: "0 0 12px rgba(239, 68, 68, 0.5)", cursor: "pointer" }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
