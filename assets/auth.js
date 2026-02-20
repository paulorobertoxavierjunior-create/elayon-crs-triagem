// assets/auth.js
const ELAYON = (() => {
  const KEYS = {
    DOCTOR: "elayon_health_doctor",
    CONFIG: "elayon_health_config",
    SESSIONS: "elayon_health_sessions",
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

  function getDoctor(){
    return readJSON(KEYS.DOCTOR, null);
  }
  function setDoctor(doc){
    writeJSON(KEYS.DOCTOR, doc);
  }
  function clearDoctor(){
    localStorage.removeItem(KEYS.DOCTOR);
  }

  function requireConnection(){
    const d = getDoctor();
    if(!d?.nome || !d?.crm || !d?.uf){
      location.href = "login.html";
      return null;
    }
    return d;
  }

  function ensureConfig(){
    const cfg = readJSON(KEYS.CONFIG, null);
    if(cfg) return cfg;

    const def = {
      sampleHz: 12,
      silenceThr: 0.025,
      recordMaxSec: 5 * 60,
      sessionExpireMin: 30,
      hint: "Config padrão (demo)."
    };
    writeJSON(KEYS.CONFIG, def);
    return def;
  }

  return {
    KEYS,
    readJSON,
    writeJSON,
    getDoctor,
    setDoctor,
    clearDoctor,
    requireConnection,
    ensureConfig
  };
})();
window.ELAYON = ELAYON;