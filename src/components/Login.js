// src/components/Login.js
import React, { useState } from "react";
import "./Login.css";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`http://${window.location.hostname}:8000/api/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Authenticated successfully
        localStorage.setItem("user", data.username);
        onLoginSuccess(data.username);
      } else {
        setError(data.error || "Login failed. Please verify credentials.");
      }
    } catch (err) {
      setError("Unable to connect to the backend disaster response service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="login-container" 
      style={{ backgroundImage: `url('/rescue_bg.png')` }}
    >
      <div className="login-overlay" />
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L3 7v8l8 5 8-5V7L11 2z" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M11 2v18M3 7l8 5 8-5" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="login-title">SDRAS Command</h2>
        <p className="login-subtitle">
          Smart Disaster Resource Allocation System — Authorized Personnel Login Only
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="login-label">Username</label>
            <input
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              autoFocus
            />
          </div>

          <div className="login-input-group">
            <label className="login-label">Password</label>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter secure password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? "Authorizing Access..." : "Secure Login →"}
          </button>
        </form>
      </div>
    </div>
  );
}
