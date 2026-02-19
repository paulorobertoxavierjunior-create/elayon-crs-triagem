// assets/app.js
// Núcleo: storage, helpers, rotas simples (GitHub Pages friendly)

export const KEY_AUTH = "elayon_auth";
export const KEY_CONFIG = "elayon_crs_config";
export const KEY_SESSIONS = "elayon_crs_sessions";
export const KEY_TOKENS = "elayon_tokens_demo";

export function now() { return Date.now(); }

export function uid(prefix="S") {
  return `${prefix}-${Math.random().toString(16).slice(2,10)}-${Date.now().toString(16)}`;
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getAuth() {
  return loadJSON(KEY_AUTH, null);
}

export function requireAuthOrRedirect() {
  const auth = getAuth();
  if (!auth?.email) {
    location.href = "index.html";
    return null;
  }
  return auth;
}

export function getConfig() {
  return loadJSON(KEY_CONFIG, {
    sessionMinutes: 20,
    sampleHz: 10,
    preset: "Afasia (triagem)",
    questions: [
      "Diga seu nome completo e sua idade.",
      "Conte, com suas palavras, o motivo principal da consulta.",
      "Repita: 'Hoje está um dia claro em Manaus.'",
      "Conte de 1 a 20 em voz alta.",
      "Diga os meses do ano (ou os dias da semana).",
      "Descreva o que você fez hoje pela manhã (30–60s).",
      "Leia uma frase curta (se possível)."
    ]
  });
}

export function getTokens() {
  return loadJSON(KEY_TOKENS, { balance: 0, lastUpdate: now() });
}

export function setTokens(balance) {
  saveJSON(KEY_TOKENS, { balance: Math.max(0, Number(balance || 0)), lastUpdate: now() });
}

export function loadSessions() {
  return loadJSON(KEY_SESSIONS, []);
}

export function saveSessions(arr) {
  saveJSON(KEY_SESSIONS, Array.isArray(arr) ? arr : []);
}

export function findSession(id) {
  const arr = loadSessions();
  const idx = arr.findIndex(s => s.id === id);
  return { arr, idx, session: idx >= 0 ? arr[idx] : null };
}

export function qs(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}