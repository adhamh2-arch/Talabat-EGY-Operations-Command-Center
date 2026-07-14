# System Architecture — Multi-Agent Operations Monitoring & Risk Management

## Overview

A multi-agent system that monitors operational performance across Egyptian cities and business segments, calculates risk scores, validates data quality, and delivers automated executive reporting.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR                                │
│                   (Daily / Weekly Scheduler)                        │
│                                                                     │
│  ┌───────────────── Phase 1: Monitoring (Parallel) ──────────────┐ │
│  │                                                                │ │
│  │  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │ │
│  │  │ Alexandria   │ │  ESM     │ │  Delta   │ │  Special     │ │ │
│  │  │ Agent        │ │  Agent   │ │  Agent   │ │  Segment     │ │ │
│  │  │              │ │          │ │          │ │  Agent       │ │ │
│  │  │ • Alexandria │ │ • Suez   │ │ • Mans.  │ │              │ │ │
│  │  │              │ │ • Assiut │ │ • Tanta  │ │ • Key=Y      │ │ │
│  │  │              │ │ • Hurg.  │ │ • Mahall.│ │ • Food=Y     │ │ │
│  │  │              │ │          │ │          │ │ • Dark=N     │ │ │
│  │  └──────┬───────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │ │
│  └─────────┼──────────────┼────────────┼───────────────┼─────────┘ │
│            │              │            │               │           │
│            └──────────────┴─────┬──────┴───────────────┘           │
│                                 │                                   │
│            ┌────────────────────▼────────────────────┐             │
│            │  Phase 2: QUALITY AGENT                 │             │
│            │  • Data accuracy validation             │             │
│            │  • Risk calculation verification        │             │
│            │  • Recommendation quality check         │             │
│            │  • Completeness / duplicates / gaps     │             │
│            └────────────────────┬────────────────────┘             │
│                                 │                                   │
│            ┌────────────────────▼────────────────────┐             │
│            │  Phase 3: REPORTING AGENT               │             │
│            │  • Aggregate all agent outputs          │             │
│            │  • Generate daily executive summary     │             │
│            │  • Send email to stakeholders           │             │
│            │  • Update Google Sheets                 │             │
│            └────────────────────┬────────────────────┘             │
│                                 │                                   │
│            ┌────────────────────▼────────────────────┐             │
│            │  Phase 4: OBSERVER AGENT                │             │
│            │  • Executive overview                   │             │
│            │  • Risk distribution analysis           │             │
│            │  • Agent effectiveness scoring          │             │
│            │  • Weekly executive reports             │             │
│            │  • Strategic recommendations            │             │
│            └─────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘

External Integrations:
  ┌──────────┐   ┌──────────────┐   ┌───────────┐   ┌────────────┐
  │  Looker  │   │ Google Sheets│   │   Gmail   │   │   Slack    │
  │  (Data)  │   │  (Storage)   │   │  (Email)  │   │  (Notify)  │
  └──────────┘   └──────────────┘   └───────────┘   └────────────┘
```

---

## Agent Interaction Map

```
                    ┌─────────────┐
                    │ Orchestrator│
                    └──────┬──────┘
                           │ triggers
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌───────────┐   ┌───────────┐   ┌──────────────┐
    │ City      │   │ City      │   │ Segment      │
    │ Monitors  │   │ Monitors  │   │ Monitor      │
    │ (Alex,    │   │ (ESM,     │   │ (Special)    │
    │  Delta)   │   │           │   │              │
    └─────┬─────┘   └─────┬─────┘   └──────┬───────┘
          │               │                │
          └───────────────┼────────────────┘
                          │ outputs
                          ▼
                   ┌──────────────┐
                   │Quality Agent │ ◄── validates all
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │Reporting     │ ◄── aggregates + emails
                   │Agent         │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │Observer Agent│ ◄── executive oversight
                   └──────────────┘
                          │
                          ▼
                    Stakeholders
```

---

## Data Flow

```
Looker API ──► Monitoring Agent ──► compute_metrics ──► apply_risk_scoring
                                                              │
                                    ┌─────────────────────────┤
                                    │                         │
                                    ▼                         ▼
                             Google Sheets              Audit Record
                             (Monitoring Log)           (persist_audit)
                                    │
                                    ▼
                             Quality Agent ──► Google Sheets (Quality Review)
                                    │
                                    ▼
                             Reporting Agent ──► Email (Daily Summary)
                                    │             │
                                    │             ▼
                                    │        Stakeholders
                                    ▼
                             Observer Agent ──► Email (Weekly Executive)
                                    │
                                    ▼
                             Google Sheets (Executive Summary)
```

---

## Risk Calculation Logic

### Scoring Components (Weighted)

| Component        | Weight | Logic                                      |
|------------------|--------|--------------------------------------------|
| Revenue          | 30%    | Inverse score: lower revenue = higher risk |
| Order Velocity   | 25%    | Inverse score: fewer orders = higher risk  |
| Average Value    | 20%    | Penalty if AOV < $200 threshold            |
| Quantity         | 15%    | Inverse score: lower quantity = higher risk|
| Freshness        | 10%    | Reserved for data staleness checks         |

### Risk Levels

| Level    | Score Range | Action Required                    |
|----------|------------|-------------------------------------|
| Low      | 0–25       | No action needed                   |
| Medium   | 26–50      | Monitor, no immediate action       |
| High     | 51–75      | Review required, flag for attention |
| Critical | 76–100     | Immediate escalation and response  |

### Root-Cause Analysis

When risk exceeds thresholds, the system generates:
- **Findings**: Specific metrics that fell below performance thresholds
- **Recommendations**: Actionable corrective measures

All thresholds are configurable via `config/agents.config.json`.

---

## Configuration Management

All operational parameters are centralized in `config/agents.config.json`:

- **Agent assignments**: Which cities/segments each agent monitors
- **Risk thresholds**: Score ranges for each risk level
- **Risk weights**: Relative importance of each scoring component
- **Performance thresholds**: Minimum acceptable metrics
- **Google Sheets**: Spreadsheet ID, sheet names, column headers
- **Reporting**: Stakeholder list, email preferences
- **Scheduling**: Daily/weekly trigger times and workflow order
- **Quality checks**: Validation rules and tolerances

Changes to configuration require **no code changes** — edit the JSON file and restart.

---

## Project Structure

```
project-root/
├── config/
│   └── agents.config.json              # Centralized configuration
├── claude_agents/
│   ├── manifests/
│   │   ├── alexandria_agent.yaml
│   │   ├── esm_agent.yaml
│   │   ├── delta_agent.yaml
│   │   ├── special_segment_agent.yaml
│   │   ├── reporting_agent.yaml
│   │   ├── quality_agent.yaml
│   │   ├── observer_agent.yaml
│   │   └── orchestrator.yaml
│   └── runtime/
│       ├── agents/
│       │   ├── orchestrator.js          # Pipeline coordinator
│       │   ├── alexandria_agent.js      # Alexandria monitor
│       │   ├── esm_agent.js             # Suez/Assiut/Hurghada monitor
│       │   ├── delta_agent.js           # Mansoura/Tanta/Mahalla monitor
│       │   ├── special_segment_agent.js # Key+Food segment monitor
│       │   ├── reporting_agent.js       # Aggregation + email reports
│       │   ├── quality_agent.js         # Cross-agent validation
│       │   └── observer_agent.js        # Executive oversight
│       └── skills/
│           ├── config_loader.js         # Centralized config reader
│           ├── city_monitor_base.js     # Shared city monitoring logic
│           ├── looker_query.js          # Looker API integration
│           ├── compute_metrics.js       # Metrics computation
│           ├── apply_risk_scoring.js    # 4-level risk scoring + root cause
│           ├── google_sheets.js         # Google Sheets read/write
│           ├── email_report.js          # Email report generation
│           ├── persist_audit.js         # Audit trail persistence
│           ├── notify.js                # Slack notifications
│           └── utils.js                 # Shared utilities
├── docs/
│   └── architecture.md                  # This document
├── tests/
│   └── unit/
│       └── city_agent.test.js
└── package.json
```
