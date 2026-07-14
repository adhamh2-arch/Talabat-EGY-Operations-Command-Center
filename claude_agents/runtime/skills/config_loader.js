import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../../config/agents.config.json');

let _cached = null;

export function loadConfig() {
  if (_cached) return _cached;
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  _cached = JSON.parse(raw);
  return _cached;
}

export function getAgentConfig(agentKey) {
  const config = loadConfig();
  const agent = config.agents[agentKey];
  if (!agent) throw new Error(`Unknown agent key: ${agentKey}`);
  return agent;
}

export function getRiskConfig() {
  return loadConfig().risk;
}

export function getPerformanceConfig() {
  return loadConfig().performance;
}

export function getSheetsConfig() {
  return loadConfig().googleSheets;
}

export function getReportingConfig() {
  return loadConfig().reporting;
}

export function getSchedulingConfig() {
  return loadConfig().scheduling;
}

export function getQualityConfig() {
  return loadConfig().quality;
}

export function reloadConfig() {
  _cached = null;
  return loadConfig();
}
