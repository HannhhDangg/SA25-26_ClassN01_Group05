# Observability: Metrics & Monitoring

### 1. Goal
To provide end-to-end visibility of the HRM microservices ecosystem, monitoring system health, database cluster states, and API performance using the "Golden Signals": Latency, Traffic, Errors, and Saturation.

### 2. Technology Stack (Prometheus Ecosystem)
*   **Prometheus:** Core metric collection and time-series database. Scrapes endpoints every 15 seconds.
*   **Grafana:** Primary dashboard visualization platform.
*   **Alertmanager:** Handles alerting policies.
*   **Exporters:** 
    *   `Node Exporter`: Host hardware metrics (CPU, RAM).
    *   `Blackbox Exporter`: Uptime probing (HTTP/TCP).
    *   `Postgres Exporter` & `MongoDB Exporter` & `Redis Exporter`: Database-specific performance insights.

### 3. Quick Start Guide: Observability Stack

#### A. Visualization (Grafana) - `http://localhost:3000`
*   **Login:** `admin` / `admin123` (Configured via `docker-compose.yml`).
*   **Setup:** The system is pre-provisioned. Go to the Dashboards panel to view the `HRM Health` dashboard.
*   **What to look for:**
    *   Database Uptime & Patroni Cluster State (Master/Replica sync).
    *   API Request rates and P99 Latency (Provided by `prom-client` in Node.js).
    *   Redis memory consumption.

#### B. Metrics Scraper (Prometheus) - `http://localhost:9090`
*   **Usage:** The engine that collects data. Use it to check connectivity and run raw PromQL queries.
*   **Check Targets:** Go to `Status -> Targets`. Ensure all endpoints (Node, Postgres, MongoDB, Blackbox) are `UP`.

#### C. Alerting (Alertmanager) - `http://localhost:9093`
*   Manages alerts triggered by Prometheus rules (e.g., "Postgres Master is down" or "API Latency > 2s").

### 4. Visual Flow: Monitoring Architecture

```plantuml
@startuml
actor DevOps
participant "Grafana (UI)" as Grafana
participant "Prometheus" as Prom
participant "Alertmanager" as Alert
node "Node.js Services" as NodeApp
database "Databases (PG/Mongo)" as DBs

Prom -> NodeApp: Scrape /metrics (prom-client)
Prom -> DBs: Scrape via Exporters
Prom -> Alert: Trigger alert if rule matched
Alert -> DevOps: Send Email/Slack Notification

DevOps -> Grafana: View Dashboards
Grafana -> Prom: Run PromQL Queries
Prom -> Grafana: Return Time-series Data
@enduml
```