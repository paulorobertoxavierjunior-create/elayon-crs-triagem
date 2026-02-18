// assets/app.js
"use strict";

/**
 * Chaves de armazenamento
 */
const KEY_DOCTOR = "elayon_doctor";
const KEY_TOKENS = "elayon_tokens";
const KEY_CONFIG = "elayon_crs_config";
const KEY_SESSIONS = "elayon_crs_sessions";

/**
 * Utils
 */
function $(id){ return document.getElementById(id); }

function safeJsonParse(raw, fallback){
  try { return JSON.parse(raw); } catch { return fallback; }
}

function loadDoctor(){
  return safeJsonParse(localStorage.getItem(KEY_DOCTOR) || "null", null);
}
function saveDoctor(doc){
  localStorage.setItem(KEY_DOCTOR, JSON.stringify(doc));
}
function clearDoctor(){
  localStorage.removeItem(KEY_DOCTOR);
}

function getTokens(){
  const n = Number(localStorage.getItem(KEY_TOKENS) || "0");
  return Number.isFinite(n) ? n : 0;
}
function setTokens(n){
  localStorage.setItem(KEY_TOKENS, String(Math.max(0, Math.floor(n))));
}
function addTokens(n){
  setTokens(getTokens() + Number(n || 0));
}
function consumeToken(){
  const t = getTokens();
  if (t <= 0) return false;
  setTokens(t - 1);
  return true;
}

function loadConfig(){
  const cfg = safeJsonParse(localStorage.getItem(KEY_CONFIG) || "{}", {});
  return {
    // defaults
    sessionMinutes: Number(cfg.sessionMinutes ?? 20),
    sampleHz: Number(cfg.sampleHz ?? 10),
    presetKey: String(cfg.presetKey ?? "AFASIA"),
    // 8 “linhas/medidas” por padrão (7 emblemático + 1 RMS total)
    lines: Number(cfg.lines ?? 8),
  };
}

function requireLoginOrRedirect(){
  const doc = loadDoctor();
  if (!doc) {
    location.href = "index.html";
    return null;
  }
  return doc;
}

function genId(prefix="S"){
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`.toUpperCase();
}

/**
 * Login page behavior
 */
(function initLogin(){
  const btnLogin = $("btnLogin");
  if (!btnLogin) return; // não está no index.html login

  // Se já estiver logado, manda pro home
  const already = loadDoctor();
  if (already) {
    location.href = "home.html";
    return;
  }

  $("btnGoPricing")?.addEventListener("click", ()=> location.href = "pricing.html");

  btnLogin.addEventListener("click", ()=>{
    const nome = ($("nome")?.value || "").trim();
    const email = ($("email")?.value || "").trim();
    const senha = ($("senha")?.value || "").trim();
    const crm = ($("crm")?.value || "").trim();

    if (!nome || !email || !senha) {
      alert("Preencha nome, e-mail e senha.");
      return;
    }

    // Demo: validação local (sem backend)
    const doctor = {
      id: genId("DOC"),
      nome,
      email,
      crm: crm || "",
      createdAt: Date.now()
    };

    saveDoctor(doctor);

    // Se for a primeira vez, dá 1 token de demo opcional (se quiser, comente essa linha)
    if (getTokens() === 0) setTokens(1);

    location.href = "home.html";
  });
})();