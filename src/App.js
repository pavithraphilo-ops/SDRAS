// src/App.js
import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ResourcePanel from "./components/ResourcePanel";
import ZoneMap from "./components/ZoneMap";
import AllocationEngine from "./components/AllocationEngine";
import AlertsPanel from "./components/AlertsPanel";
import EmergencyPortal from "./components/EmergencyPortal";
import Login from "./components/Login";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(localStorage.getItem("user") || null);
  const [activeView, setActiveView] = useState("dashboard");
  const [tick, setTick] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  // Poll backend every 5 seconds for real-time feel
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch unresolved alert count for sidebar badge
  useEffect(() => {
    if (!user) return;
    const fetchAlertCount = async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:8000/api/alerts/?acknowledged=false`);
        const data = await res.json();
        setAlertCount(Array.isArray(data) ? data.filter((a) => a.alert_type === "critical").length : 0);
      } catch {
        // Ignore — backend might not be ready yet
      }
    };
    fetchAlertCount();
  }, [tick, user]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard":  return <Dashboard tick={tick} />;
      case "map":        return <ZoneMap tick={tick} />;
      case "resources":  return <ResourcePanel tick={tick} />;
      case "allocate":   return <AllocationEngine />;
      case "portal":     return <EmergencyPortal tick={tick} />;
      case "alerts":     return <AlertsPanel tick={tick} />;
      default:           return <Dashboard tick={tick} />;
    }
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div className="app">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        alertCount={alertCount} 
        user={user}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}
