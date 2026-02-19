// assets/auth.js
const KEYS = {
  AUTH: "elayon_health_doctor",
  TOKENS: "elayon_health_tokens",
  CONFIG: "elayon_crs_config",
  SESSIONS: "elayon_crs_sessions"
};

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}
function writeJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function getDoctor(){
  return readJSON(KEYS.AUTH, null);
}
function setDoctor(doc){
  writeJSON(KEYS.AUTH, doc);
}
function clearDoctor(){
  localStorage.removeItem(KEYS.AUTH);
}

function getTokens(){
  const t = readJSON(KEYS.TOKENS, null);
  if (t && typeof t.tokens === "number") return t;
  const init = { tokens: 3, updatedAt: Date.now() }; // começa com 3 tokens demo
  writeJSON(KEYS.TOKENS, init);
  return init;
}
function setTokens(tokensObj){
  writeJSON(KEYS.TOKENS, tokensObj);
}

function requireLogin(){
  const d = getDoctor();
  if (!d?.nome || !d?.email || !d?.crm) {
    location.href = "login.html";
    return null;
  }
  return d;
}

function ensureConfig(){
  const cfg = readJSON(KEYS.CONFIG, null);
  if (cfg) return cfg;
  const def = {
    sessionMinutes: 20,
    sampleHz: 12,
    disease: "Afasia (triagem)",
    questions: [
      "Diga seu nome completo e sua idade.",
      "Conte o que você fez hoje desde que acordou (30–60s).",
      "Repita: 'Hoje eu vim fazer uma avaliação de fala'.",
      "Nomeie objetos simples ao redor (ex: mesa, cadeira, porta).",
      "Conte de 20 até 1 em voz alta."
    ],
    consentText: "Confirmo que houve consentimento livre e esclarecido do paciente (TCLE) para captação de voz nesta sessão."
  };
  writeJSON(KEYS.CONFIG, def);
  return def;
}

window.ELAYON = {
  KEYS,
  readJSON,
  writeJSON,
  getDoctor,
  setDoctor,
  clearDoctor,
  getTokens,
  setTokens,
  requireLogin,
  ensureConfig
};