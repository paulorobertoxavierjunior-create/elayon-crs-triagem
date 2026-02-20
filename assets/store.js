// assets/store.js
(() => {
  const K = {
    doctor:  "eh_doctor",
    tokens:  "eh_tokens",
    config:  "eh_config",
    sessions:"eh_sessions",
  };

  const S = {
    get(key, fallback=null){
      try{
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      }catch{ return fallback; }
    },
    set(key, val){
      localStorage.setItem(key, JSON.stringify(val));
      return val;
    },
    del(key){ localStorage.removeItem(key); }
  };

  // ---------- Doctor ----------
  function doctorGet(){ return S.get(K.doctor, null); }
  function doctorSet(d){ return S.set(K.doctor, d); }
  function doctorClear(){ S.del(K.doctor); }

  function requireLogin(){
    const d = doctorGet();
    if (!d?.nome || !d?.email || !d?.crm) {
      location.href = "login.html";
      return null;
    }
    return d;
  }

  // ---------- Tokens ----------
  function tokensGet(){
    let t = S.get(K.tokens, null);
    if (!t || typeof t.tokens !== "number") {
      t = { tokens: 3, updatedAt: Date.now() }; // DEMO default
      S.set(K.tokens, t);
    }
    return t;
  }

  function tokensSet(n){
    const t = { tokens: Math.max(0, Number(n||0)), updatedAt: Date.now() };
    return S.set(K.tokens, t);
  }

  function tokensAdd(delta){
    const t = tokensGet();
    return tokensSet(t.tokens + Number(delta||0));
  }

  function tokensConsume(qty=1){
    const t = tokensGet();
    const q = Math.max(1, Number(qty||1));
    if (t.tokens < q) return { ok:false, tokens:t.tokens };
    tokensSet(t.tokens - q);
    return { ok:true, tokens: tokensGet().tokens };
  }

  // ---------- Config ----------
  const DEFAULT_CONFIG = {
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
    consentText: "Confirmo que houve consentimento livre e esclarecido do paciente (TCLE) para captação de voz nesta sessão.",
    maxCaptureSeconds: 300, // 5 min gravando (o resto pode pausar/retomar)
    maxReports: 10          // limite de relatórios no device
  };

  function configGet(){
    const c = S.get(K.config, null);
    return c ? c : S.set(K.config, DEFAULT_CONFIG);
  }
  function configSet(patch){
    const cur = configGet();
    return S.set(K.config, { ...cur, ...patch, updatedAt: Date.now() });
  }
  function configReset(){
    return S.set(K.config, DEFAULT_CONFIG);
  }

  // ---------- Sessions ----------
  function sessionsAll(){ return S.get(K.sessions, []); }
  function sessionsSave(arr){ return S.set(K.sessions, arr); }

  function sessionsPrune(){
    const cfg = configGet();
    const max = Math.max(1, Number(cfg.maxReports||10));
    const arr = sessionsAll();
    // mantém as mais recentes primeiro
    arr.sort((a,b)=>(b.start||0)-(a.start||0));
    const cut = arr.slice(0, max);
    sessionsSave(cut);
    return cut;
  }

  function sessionUpsert(sess){
    const arr = sessionsAll();
    const i = arr.findIndex(x => x.id === sess.id);
    if (i >= 0) arr[i] = sess; else arr.push(sess);
    sessionsSave(arr);
    sessionsPrune();
    return sess;
  }

  function sessionGet(id){
    const arr = sessionsAll();
    return arr.find(x => x.id === id) || null;
  }

  function sessionDelete(id){
    const arr = sessionsAll().filter(x => x.id !== id);
    sessionsSave(arr);
    return true;
  }

  function sessionsClear(){
    sessionsSave([]);
    return true;
  }

  // Expor API única
  window.EH = {
    K, S,
    doctorGet, doctorSet, doctorClear, requireLogin,
    tokensGet, tokensSet, tokensAdd, tokensConsume,
    configGet, configSet, configReset,
    sessionsAll, sessionsSave, sessionsPrune,
    sessionUpsert, sessionGet, sessionDelete, sessionsClear
  };
})();