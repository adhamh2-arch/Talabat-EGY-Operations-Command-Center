export function getEnv(name, required = true) {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function logStep(event, payload) {
  const record = {
    event,
    timestamp: new Date().toISOString(),
    payload,
  };
  console.debug(JSON.stringify(record));
}
