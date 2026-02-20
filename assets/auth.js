// assets/auth.js (versão prática - demo)
const ELAYON = (() => {
  const KEYS = {
    AUTH: "elayon_health_auth",
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

  // --- Auth DEMO (sem CRM/email por enquanto)
  function isConnected(){
    const a = readJSON(KEYS.AUTH, null);
    return !!a?.connected;
  }

  function connectDemo(){
    writeJSON(KEYS.AUTH, { connected: true, mode: "demo", connectedAt: Date.now() });
  }

  function disconnect(){
    localStorage.removeItem(KEYS.AUTH);
  }

  function requireConnection(){
    if (!isConnected()){
      location.href = "login.html";
      return false;
    }
    return true;
  }

  // --- Tokens (demo)
  function getTokens(){
    const t = readJSON(KEYS.TOKENS, null);
    if (t && typeof t.tokens === "number") return t;
    const init = { tokens: 3, updatedAt: Date.now() }; // 3 tokens demo
    writeJSON(KEYS.TOKENS, init);
    return init;
  }

  function setTokens(tokensObj){
    writeJSON(KEYS.TOKENS, tokensObj);
  }

  return {
    KEYS,
    readJSON,
    writeJSON,
    isConnected,
    connectDemo,
    disconnect,
    requireConnection,
    getTokens,
    setTokens
  };
})();

window.ELAYON = ELAYON;