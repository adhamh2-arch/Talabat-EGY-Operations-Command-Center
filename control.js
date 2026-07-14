#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config', 'agents.config.json');
const MCP_DATA_DIR = join(__dirname, 'mcp_data');
const LOGS_DIR = join(__dirname, 'logs');
const STATE_FILE = join(__dirname, '.pipeline_state.json');

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  return { lastRun: null, runCount: 0, history: [] };
}

function fmt(num) {
  return typeof num === 'number' ? num.toLocaleString() : num;
}

const commands = {
  status() {
    const config = loadConfig();
    const state = loadState();
    console.log('\n========================================');
    console.log('  talabat EGY Operations Command Center');
    console.log(`  v${config.system.version}`);
    console.log('========================================\n');
    console.log(`Metric: ${config.system.metric}`);
    console.log(`Note: ${config.system.metricNote}`);
    console.log(`Last Run: ${state.lastRun || 'Never'}`);
    console.log(`Run Count: ${state.runCount}`);
    console.log(`Last Status: ${state.lastStatus || 'N/A'}`);
    console.log('');
    console.log('AGENTS:');
    for (const [key, agent] of Object.entries(config.agents)) {
      const status = agent.enabled ? '\x1b[32mENABLED\x1b[0m' : '\x1b[31mDISABLED\x1b[0m';
      const clusters = agent.clusters
        ? agent.clusters.join(', ')
        : agent.cluster || 'N/A';
      console.log(`  ${agent.name.padEnd(22)} ${status}  (${agent.type}) → ${clusters}`);
    }
    console.log('');
    console.log('CLUSTERS:');
    for (const [key, cluster] of Object.entries(config.clusters)) {
      console.log(`  ${cluster.name.padEnd(15)} Target: ${cluster.targetLabel}  Agent: ${cluster.agent}  Cities: ${cluster.cities?.length || 0}`);
    }
  },

  agents() {
    const config = loadConfig();
    console.log('\nAGENT DETAILS:\n');
    for (const [key, agent] of Object.entries(config.agents)) {
      console.log(`[${key}]`);
      console.log(`  Name: ${agent.name}`);
      console.log(`  Type: ${agent.type}`);
      console.log(`  Enabled: ${agent.enabled}`);
      if (agent.cluster) console.log(`  Cluster: ${agent.cluster}`);
      if (agent.clusters) console.log(`  Clusters: ${agent.clusters.join(', ')}`);
      if (agent.filters) console.log(`  Filters: ${JSON.stringify(agent.filters)}`);
      console.log('');
    }
  },

  enable(agentKey) {
    if (!agentKey) { console.log('Usage: node control.js enable <agent_key>'); return; }
    const config = loadConfig();
    if (!config.agents[agentKey]) { console.log(`Agent "${agentKey}" not found. Available: ${Object.keys(config.agents).join(', ')}`); return; }
    config.agents[agentKey].enabled = true;
    saveConfig(config);
    console.log(`Agent "${config.agents[agentKey].name}" has been ENABLED.`);
  },

  disable(agentKey) {
    if (!agentKey) { console.log('Usage: node control.js disable <agent_key>'); return; }
    const config = loadConfig();
    if (!config.agents[agentKey]) { console.log(`Agent "${agentKey}" not found. Available: ${Object.keys(config.agents).join(', ')}`); return; }
    config.agents[agentKey].enabled = false;
    saveConfig(config);
    console.log(`Agent "${config.agents[agentKey].name}" has been DISABLED.`);
  },

  target(clusterKey, newTarget) {
    if (!clusterKey || !newTarget) { console.log('Usage: node control.js target <cluster_key> <new_target_pct>'); console.log('Example: node control.js target alex 0.75'); return; }
    const config = loadConfig();
    if (!config.clusters[clusterKey]) { console.log(`Cluster "${clusterKey}" not found. Available: ${Object.keys(config.clusters).join(', ')}`); return; }
    const pct = parseFloat(newTarget);
    config.clusters[clusterKey].target = pct / 100;
    config.clusters[clusterKey].targetLabel = pct.toFixed(2) + '%';
    saveConfig(config);
    console.log(`Cluster "${config.clusters[clusterKey].name}" target updated to ${pct.toFixed(2)}%`);
  },

  performance(dateArg) {
    const runDate = dateArg || new Date().toISOString().slice(0, 10);
    const outputFile = join(MCP_DATA_DIR, `scored_output_${runDate}.json`);
    if (!existsSync(outputFile)) { console.log(`No scored output for ${runDate}. Run the pipeline first.`); return; }

    const data = JSON.parse(readFileSync(outputFile, 'utf-8'));
    const config = loadConfig();

    console.log(`\n=== PERFORMANCE REPORT: ${runDate} ===\n`);
    console.log('CLUSTER PERFORMANCE vs TARGETS:');
    console.log('─'.repeat(90));
    console.log(`${'Cluster'.padEnd(15)} ${'Fail Rate'.padEnd(12)} ${'Target'.padEnd(10)} ${'Deviation'.padEnd(12)} ${'Risk'.padEnd(10)} ${'Failed'.padEnd(10)} ${'Lost GMV'.padEnd(15)}`);
    console.log('─'.repeat(90));

    for (const cr of data.clusterResults) {
      const devStr = cr.deviation > 0 ? `\x1b[31m+${cr.deviation.toFixed(2)}%\x1b[0m` : `\x1b[32m${cr.deviation.toFixed(2)}%\x1b[0m`;
      const riskColor = cr.riskLevel === 'critical' ? '\x1b[31m' : cr.riskLevel === 'high' ? '\x1b[33m' : '\x1b[32m';
      console.log(`${cr.name.padEnd(15)} ${(cr.vendorFailRate + '%').padEnd(12)} ${cr.targetLabel.padEnd(10)} ${devStr.padEnd(22)} ${riskColor}${(cr.riskLevel.toUpperCase() + ' (' + cr.riskScore + ')').padEnd(10)}\x1b[0m ${fmt(cr.failedOrders).toString().padEnd(10)} ${fmt(cr.lostGmv) + ' EGP'}`);
    }

    console.log('─'.repeat(90));
    console.log(`${'TOTAL'.padEnd(15)} ${(data.summary.overallFailRate + '%').padEnd(12)} ${''.padEnd(10)} ${''.padEnd(12)} ${''.padEnd(10)} ${fmt(data.summary.totalFailed).toString().padEnd(10)} ${fmt(data.summary.totalLostGmv) + ' EGP'}`);

    console.log('\n\nTOP OFFENDERS PER CLUSTER:\n');
    for (const cr of data.clusterResults) {
      if (cr.topOffenders.length === 0) continue;
      console.log(`  ${cr.name}:`);
      for (const off of cr.topOffenders.slice(0, 3)) {
        console.log(`    - ${off.vendor} (${off.city}) | Failed: ${off.failedOrders} | Lost: ${fmt(off.lostGmv)} EGP`);
      }
      console.log('');
    }

    if (data.keyAccounts?.topOffenders?.length > 0) {
      console.log('  Key Accounts:');
      for (const ka of data.keyAccounts.topOffenders.slice(0, 5)) {
        console.log(`    - ${ka.vendor} (${ka.city}) | Failed: ${ka.failedOrders} | Lost: ${fmt(ka.lostGmv)} EGP`);
      }
    }
  },

  history() {
    const state = loadState();
    if (state.history.length === 0) { console.log('No pipeline run history.'); return; }
    console.log('\nPIPELINE RUN HISTORY:\n');
    console.log(`${'Date'.padEnd(14)} ${'Status'.padEnd(18)} ${'Time'.padEnd(10)} ${'Timestamp'}`);
    console.log('─'.repeat(70));
    for (const h of state.history.slice(-10).reverse()) {
      const statusColor = h.status === 'SUCCESS' ? '\x1b[32m' : '\x1b[31m';
      console.log(`${h.date.padEnd(14)} ${statusColor}${h.status.padEnd(18)}\x1b[0m ${(h.elapsed?.toFixed(1) + 's').padEnd(10)} ${h.timestamp}`);
    }
  },

  clusters() {
    const config = loadConfig();
    console.log('\nCLUSTER DETAILS:\n');
    for (const [key, cluster] of Object.entries(config.clusters)) {
      console.log(`[${key}] ${cluster.name}`);
      console.log(`  Agent: ${cluster.agent}`);
      console.log(`  Target: ${cluster.targetLabel}`);
      if (cluster.cities?.length > 0) {
        console.log(`  Cities: ${cluster.cities.join(', ')}`);
      }
      if (cluster.segment) console.log('  Type: Segment (national)');
      console.log('');
    }
    console.log('SEGMENT TARGETS:');
    for (const [seg, t] of Object.entries(config.segmentTargets)) {
      console.log(`  ${seg}: ${t.targetLabel}`);
    }
  },

  risks(dateArg) {
    const runDate = dateArg || new Date().toISOString().slice(0, 10);
    const outputFile = join(MCP_DATA_DIR, `scored_output_${runDate}.json`);
    if (!existsSync(outputFile)) { console.log(`No data for ${runDate}.`); return; }
    const data = JSON.parse(readFileSync(outputFile, 'utf-8'));
    console.log(`\nRISK REGISTER: ${runDate}\n`);
    if (!data.riskRegister || data.riskRegister.length === 0) {
      console.log('No clusters at medium risk or above.');
      return;
    }
    for (const r of data.riskRegister) {
      const color = r.riskLevel === 'critical' ? '\x1b[31m' : r.riskLevel === 'high' ? '\x1b[33m' : '\x1b[36m';
      console.log(`${color}[${r.riskLevel.toUpperCase()}]\x1b[0m ${r.cluster} — Score: ${r.riskScore} | Rate: ${r.failRate} vs ${r.target} (${r.deviation}) | Lost: ${fmt(r.lostGmv)} EGP`);
      console.log(`  Top Offender: ${r.topOffender}`);
      console.log('');
    }
  },

  logs(dateArg) {
    const runDate = dateArg || new Date().toISOString().slice(0, 10);
    const logFile = join(LOGS_DIR, `pipeline_${runDate}.log`);
    if (!existsSync(logFile)) { console.log(`No logs for ${runDate}.`); return; }
    console.log(readFileSync(logFile, 'utf-8'));
  },

  report(dateArg) {
    const runDate = dateArg || new Date().toISOString().slice(0, 10);
    const reportFile = join(LOGS_DIR, `report_${runDate}.txt`);
    if (!existsSync(reportFile)) { console.log(`No report for ${runDate}.`); return; }
    console.log(readFileSync(reportFile, 'utf-8'));
  },

  config() {
    const config = loadConfig();
    console.log('\nCURRENT CONFIGURATION:\n');
    console.log(`System: ${config.system.name} v${config.system.version}`);
    console.log(`Timezone: ${config.system.timezone}`);
    console.log(`Daily Trigger: ${config.scheduling.daily.triggerTime}`);
    console.log(`Weekly Trigger: ${config.scheduling.weekly.triggerDay} ${config.scheduling.weekly.triggerTime}`);
    console.log(`Sheet ID: ${config.googleSheets.spreadsheetId}`);
    console.log(`Email: ${config.reporting.stakeholders[0]?.email}`);
    console.log(`\nRisk Weights:`);
    for (const [k, v] of Object.entries(config.risk.weights)) {
      console.log(`  ${k}: ${v}`);
    }
    console.log(`\nEscalation Threshold: ${config.risk.escalationThreshold}`);
    console.log(`Review Threshold: ${config.risk.reviewThreshold}`);
  },

  help() {
    console.log(`
talabat EGY Operations Control Tool
====================================

Usage: node control.js <command> [args]

Commands:
  status                    System overview (agents, clusters, last run)
  agents                    Detailed agent listing
  enable <agent_key>        Enable an agent
  disable <agent_key>       Disable an agent
  target <cluster> <pct>    Update cluster target (e.g., target alex 0.75)
  clusters                  Cluster details and city mappings
  performance [date]        Performance report with targets vs actuals
  risks [date]              Risk register for a date
  history                   Pipeline run history
  logs [date]               View pipeline logs
  report [date]             View generated text report
  config                    Show current configuration
  help                      Show this help

Agent keys: alex, delta, esm, key_accounts, quality, reporting, observer
Cluster keys: alex, delta, canal, upper_egypt, key_accounts

Examples:
  node control.js status
  node control.js performance 2026-06-12
  node control.js target upper_egypt 0.80
  node control.js disable quality
  node control.js risks 2026-06-12
`);
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  commands.help();
} else {
  commands[cmd](...args);
}
