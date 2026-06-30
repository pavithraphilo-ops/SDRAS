# SDRAS — Smart Disaster Resource Allocation System

A real-time, intelligent disaster response platform built with React.

## Screens

| Screen | Description |
|--------|-------------|
| **Dashboard** | Command center overview — KPIs, zone list, resource status, live alerts, deployment timeline chart |
| **Zone Map** | Interactive SVG geographic map with pulsing severity markers and resource placement |
| **Resources** | Full resource inventory table with status/type filters and utilization bars |
| **AI Allocate** | AI-powered allocation engine with priority scoring, recommendations, and manual override |
| **Alerts** | Alert management — acknowledge, escalate, and broadcast new alerts |

## Getting Started

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **React 18** — UI framework
- **Recharts** — Charts (area, bar)
- **Space Grotesk + Inter + Space Mono** — Typography system
- **Custom CSS** — No UI library; fully custom design tokens

## Design System

| Token | Value |
|-------|-------|
| `--navy` | `#0A1628` |
| `--navy-card` | `#162035` |
| `--amber` | `#F59E0B` |
| `--red` | `#EF4444` |
| `--green` | `#10B981` |
| `--blue` | `#3B82F6` |

## Project Structure

```
src/
  components/
    Sidebar.js / .css       — Navigation sidebar
    Dashboard.js / .css     — Main command dashboard
    ZoneMap.js / .css       — Interactive zone map
    ResourcePanel.js / .css — Resource management table
    AllocationEngine.js/.css— AI allocation engine
    AlertsPanel.js / .css   — Alerts management
  data/
    mockData.js             — All mock disaster/resource data
  App.js / App.css          — Root + global design tokens
```
