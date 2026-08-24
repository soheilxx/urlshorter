/**
 * Strukturierte JSON-Logs für die serverseitige Verarbeitung.
 * Aufrufer dürfen keine Secrets oder vollständigen personenbezogenen Daten
 * übergeben (keine IP-Adressen, keine Passwörter, keine Tokens).
 */

type LogData = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, data?: LogData): void {
  const entry = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  });
  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  info: (event: string, data?: LogData) => emit("info", event, data),
  warn: (event: string, data?: LogData) => emit("warn", event, data),
  error: (event: string, data?: LogData) => emit("error", event, data),
};
