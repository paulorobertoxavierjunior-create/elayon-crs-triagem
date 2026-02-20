// assets/auth.js  (versão prática: conexão simples)
const KEYS = {
  CONNECTION: "elayon_health_connection",
  CONFIG: "elayon_crs_config",
  SESSIONS: "elayon_crs_sessions",
  TOKENS: "elayon_health_tokens" // deixa aqui pro próximo bloco (tokens)
};

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function writeJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

// conexão (simples)
function getConnection(){
  return readJSON(KEYS.CONNECTION, null);
}

function setConnection(obj){
  writeJSON(KEYS.CONNECTION, obj);
}

function clearConnection(){
  localStorage.removeItem(KEYS.CONNECTION);
}

// gate: exige “conexão” (não é segurança real; é fluxo)
function requireConnection(){
  const c = getConnection();
  if(!c){
    location.href = "login.html";
    return null;
  }
  return c;
}

// config padrão (mantém o que já funciona)
function ensureConfig(){
  const cfg = readJSON(KEYS.CONFIG, null);
  if(cfg) return cfg;

  const def = {
    sessionMinutes: 20,
    sampleHz: 12,
    silenceThr: 0.025,
    hint: "Config padrão (demo).",
  };
  writeJSON(KEYS.CONFIG, def);
  return def;
}

window.ELAYON = {
  KEYS,
  readJSON,
  writeJSON,
  getConnection,
  setConnection,
  clearConnection,
  requireConnection,
  ensureConfig
};