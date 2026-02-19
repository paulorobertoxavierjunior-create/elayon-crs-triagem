// assets/session.js
document.addEventListener("DOMContentLoaded", ()=>{
  const doctor = ELAYON.requireLogin();
  if(!doctor) return;

  const cfg = ELAYON.ensureConfig();
  const tokensObj = ELAYON.getTokens();

  const $ = (id)=>document.getElementById(id);

  $("subTitle").textContent = `Médico: ${doctor.nome} • CRM: ${doctor.crm} • tokens: ${tokensObj.tokens}`;

  $("disease").value = cfg.disease;
  $("maxMin").value = `${cfg.sessionMinutes} min • ${cfg.sampleHz} Hz • ${cfg.bands} linhas`;
  $("questions").value = (cfg.questions || []).join("\n");

  // Consentimento obrigatório
  const consentBox = $("consentBox");
  let consentOK = !cfg.consentRequired;
  if (cfg.consentRequired){
    consentBox.innerHTML = `
      <label class="check">
        <input id="consentChk" type="checkbox" />
        <span>${(cfg.consentText||"Confirmo que houve consentimento (TCLE).")}</span>
      </label>
    `;
    consentBox.querySelector("#consentChk").addEventListener("change",(e)=>{
      consentOK = !!e.target.checked;
    });
  }else{
    consentBox.innerHTML = `<span class="badge">TCLE não obrigatório (config)</span>`;
  }

  // Canvas setup
  const cvSound = $("cvSound");
  const cvSilence = $("cvSilence");
  const cvOverlay = $("cvOverlay");

  function resizeCanvas(cv, h=240){
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.floor(r.width * dpr);
    cv.height = Math.floor(h * dpr);
    cv._dpr = dpr;
  }
  function onResize(){
    resizeCanvas(cvSound, 240);
    resizeCanvas(cvSilence, 240);
    resizeCanvas(cvOverlay, 240);
  }
  window.addEventListener("resize", onResize);
  onResize();

  const ctxSound = cvSound.getContext("2d");
  const ctxSilence = cvSilence.getContext("2d");
  const ctxOverlay = cvOverlay.getContext("2d");

  // Audio state
  let audioCtx=null, analyser=null, srcNode=null, stream=null;
  let raf=null;
  let capturing=false;
  let startedAt=0;
  let lastSample=0;

  const SAMPLE_EVERY_MS = Math.max(60, Math.floor(1000 / (cfg.sampleHz || 12)));
  const MAX_MS = (cfg.sessionMinutes || 20) * 60 * 1000;

  const HISTORY = 520; // pontos no tempo (vertical/horizontal dependendo)
  const bandsN = (cfg.bands || 8);
  const overlaySeries = Array.from({length: bandsN}, ()=> new Array(HISTORY).fill(0));
  const silenceSeries = new Array(HISTORY).fill(0);
  const rmsSeries = new Array(HISTORY).fill(0);
  let wIdx=0;

  // session record (determinístico)
  const sessionId = `S${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;

  const session = {
    id: sessionId,
    createdAt: Date.now(),
    doctor: { nome: doctor.nome, email: doctor.email, crm: doctor.crm },
    configSnapshot: {
      disease: cfg.disease,
      sessionMinutes: cfg.sessionMinutes,
      sampleHz: cfg.sampleHz,
      bands: cfg.bands,
      consentRequired: cfg.consentRequired,
      consentText: cfg.consentText
    },
    paciente: "",
    contexto: "",
    questions: [],
    consentOk: false,
    status: "draft",
    metrics: [], // {ts, rms, silence, b1..b7}
    summary: null,
    charts: null // dataURLs
  };

  function fmt(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  }

  function setKpi(){
    const now = Date.now();
    const elapsed = (now - startedAt)/1000;
    $("kTimer").textContent = `tempo: ${fmt(elapsed)}`;
    if (elapsed*1000 >= MAX_MS && capturing){
      endSession("expired");
    }
  }
  setInterval(()=>{ if(startedAt) setKpi(); }, 250);

  function rmsFromTimeDomain(buf){
    let sum=0;
    for(let i=0;i<buf.length;i++){
      const v=(buf[i]-128)/128;
      sum += v*v;
    }
    return Math.sqrt(sum/buf.length);
  }

  function bandEnergy(freq, fromHz, toHz, sampleRate, fftSize){
    const nyq = sampleRate/2;
    const from = Math.floor((fromHz/nyq) * freq.length);
    const to = Math.floor((toHz/nyq) * freq.length);
    let sum=0, n=0;
    for(let i=Math.max(0,from); i<=Math.min(freq.length-1,to); i++){
      sum += freq[i];
      n++;
    }
    return n ? (sum/n)/255 : 0;
  }

  // 7 bandas fixas (cinematográfico: subgrave→agudo)
  function computeBands(freq){
    const sr = audioCtx.sampleRate;
    const fft = analyser.fftSize;
    const b = [
      bandEnergy(freq, 20, 60, sr, fft),
      bandEnergy(freq, 60, 120, sr, fft),
      bandEnergy(freq, 120, 250, sr, fft),
      bandEnergy(freq, 250, 500, sr, fft),
      bandEnergy(freq, 500, 1000, sr, fft),
      bandEnergy(freq, 1000, 2000, sr, fft),
      bandEnergy(freq, 2000, 4000, sr, fft),
    ];
    return b;
  }

  function bg(ctx, cv){
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle = "rgba(245,255,255,1)";
    ctx.fillRect(0,0,cv.width,cv.height);
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1 * (cv._dpr||1);
    for(let i=1;i<6;i++){
      const y = (cv.height/6)*i;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cv.width,y); ctx.stroke();
    }
  }

  function drawSound(freq){
    bg(ctxSound, cvSound);
    const bars = 72;
    const step = Math.floor(freq.length / bars);
    const w = cvSound.width / bars;

    for(let i=0;i<bars;i++){
      const v = freq[i*step]/255;
      const h = v * (cvSound.height*0.80);
      ctxSound.fillStyle = `rgba(14,165,233,${0.10 + v*0.35})`;
      ctxSound.fillRect(i*w, cvSound.height-h, w*0.76, h);
      ctxSound.fillStyle = `rgba(34,197,94,${0.08 + v*0.22})`;
      ctxSound.fillRect(i*w, cvSound.height-(h*0.55), w*0.76, h*0.55);
    }

    ctxSound.fillStyle = "rgba(0,0,0,0.45)";
    ctxSound.font = `${14*(cvSound._dpr||1)}px system-ui`;
    ctxSound.fillText("FFT (energia por frequência)", 12*(cvSound._dpr||1), 20*(cvSound._dpr||1));
  }

  function drawSilence(){
    bg(ctxSilence, cvSilence);

    // desenha como linha temporal
    ctxSilence.strokeStyle = "rgba(10,30,40,0.75)";
    ctxSilence.lineWidth = 2*(cvSilence._dpr||1);
    ctxSilence.beginPath();

    for(let x=0;x<HISTORY;x++){
      const idx = (wIdx + x) % HISTORY;
      const v = silenceSeries[idx]; // 0..1
      const px = (x/(HISTORY-1)) * cvSilence.width;
      const py = (cvSilence.height*0.85) - v*(cvSilence.height*0.70);
      if(x===0) ctxSilence.moveTo(px,py); else ctxSilence.lineTo(px,py);
    }
    ctxSilence.stroke();

    ctxSilence.fillStyle = "rgba(0,0,0,0.45)";
    ctxSilence.font = `${14*(cvSilence._dpr||1)}px system-ui`;
    ctxSilence.fillText("Silêncio (proxy de pausas)", 12*(cvSilence._dpr||1), 20*(cvSilence._dpr||1));
  }

  function drawOverlay(){
    bg(ctxOverlay, cvOverlay);

    const lines = bandsN;
    const rowH = cvOverlay.height / lines;

    const labels8 = [
      "0) RMS",
      "1) 20–60Hz",
      "2) 60–120Hz",
      "3) 120–250Hz",
      "4) 250–500Hz",
      "5) 500–1kHz",
      "6) 1–2kHz",
      "7) 2–4kHz"
    ];
    const labels7 = labels8.slice(0,7);

    const labels = (bandsN===8) ? labels8 : labels7;

    for(let l=0;l<lines;l++){
      const yMid = rowH*l + rowH*0.5;
      const amp = rowH*0.35;

      ctxOverlay.strokeStyle = "rgba(0,0,0,0.78)";
      ctxOverlay.lineWidth = 2*(cvOverlay._dpr||1);
      ctxOverlay.beginPath();

      for(let x=0;x<HISTORY;x++){
        const idx = (wIdx + x) % HISTORY;
        const v = overlaySeries[l][idx]; // 0..1
        const px = (x/(HISTORY-1)) * cvOverlay.width;
        const py = yMid - (v-0.5)*2*amp;
        if(x===0) ctxOverlay.moveTo(px,py); else ctxOverlay.lineTo(px,py);
      }
      ctxOverlay.stroke();

      ctxOverlay.fillStyle = "rgba(0,0,0,0.45)";
      ctxOverlay.font = `${13*(cvOverlay._dpr||1)}px system-ui`;
      ctxOverlay.fillText(labels[l] || `linha ${l}`, 12*(cvOverlay._dpr||1), (rowH*l + 18*(cvOverlay._dpr||1)));
    }
  }

  async function enableMic(){
    try{
      stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;

      srcNode = audioCtx.createMediaStreamSource(stream);
      srcNode.connect(analyser);

      $("kState").textContent = "estado: microfone ok";
      $("btnStart").disabled = false;
    }catch(e){
      alert("Falha ao acessar microfone. Verifique permissões do navegador.");
    }
  }

  function startCapture(){
    // validações mínimas
    const paciente = ($("paciente").value||"").trim();
    if(!paciente) return alert("Informe o nome do paciente.");
    if(cfg.consentRequired && !consentOK) return alert("Confirme o consentimento (TCLE) para iniciar.");

    const t = ELAYON.getTokens();
    if ((t.tokens||0) <= 0) return alert("Sem tokens. Vá em Tokens & Ética e simule compra.");

    session.paciente = paciente;
    session.contexto = ($("contexto").value||"").trim();
    session.questions = ($("questions").value||"").split("\n").map(s=>s.trim()).filter(Boolean);
    session.consentOk = true;
    session.status = "active";
    session.startedAt = Date.now();

    startedAt = Date.now();
    capturing = true;
    $("kState").textContent = "estado: captando";
    $("btnStart").disabled = true;
    $("btnPause").disabled = false;
    $("btnEnd").disabled = false;

    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const loop = ()=>{
      raf = requestAnimationFrame(loop);
      if(!capturing) return;

      const now = performance.now();
      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      const rms = Math.min(1, rmsFromTimeDomain(timeData) * 3.2);
      const silence = Math.min(1, Math.max(0, (0.035 - rms) / 0.035));

      // bandas
      const bands = computeBands(freqData); // 7 itens
      // escreve arrays visuais
      rmsSeries[wIdx] = rms;
      silenceSeries[wIdx] = silence;

      // overlay: linha 0 = RMS; linhas seguintes = bandas
      overlaySeries[0][wIdx] = rms;
      for(let i=1;i<bandsN;i++){
        overlaySeries[i][wIdx] = bands[i-1] ?? 0;
      }

      // métrica determinística (amostragem)
      if (now - lastSample >= SAMPLE_EVERY_MS){
        session.metrics.push({
          ts: Date.now(),
          rms,
          silence,
          bands
        });
        $("kLevel").textContent = `nível: ${rms.toFixed(4)}`;
        lastSample = now;
      }

      wIdx = (wIdx + 1) % HISTORY;

      // desenha
      drawSound(freqData);
      drawSilence();
      drawOverlay();

      // timer
      setKpi();
    };

    loop();
  }

  function pause(){
    capturing = false;
    $("kState").textContent = "estado: pausado";
    $("btnStart").disabled = false;
    $("btnPause").disabled = true;
  }

  function resume(){
    capturing = true;
    $("kState").textContent = "estado: captando";
    $("btnStart").disabled = true;
    $("btnPause").disabled = false;
  }

  function summarize(){
    const m = session.metrics || [];
    const n = Math.max(1, m.length);
    const avgRms = m.reduce((a,b)=>a+b.rms,0)/n;
    const avgSil = m.reduce((a,b)=>a+b.silence,0)/n;

    // variabilidade RMS
    let varSum=0;
    for(let i=1;i<m.length;i++) varSum += Math.abs(m[i].rms - m[i-1].rms);
    const variability = m.length>1 ? varSum/(m.length-1) : 0;

    // pausas “altas”
    const pauseRatio = m.reduce((a,b)=>a + (b.silence>0.6 ? 1 : 0),0)/n;

    // bandas médias
    const bandAvg = new Array(7).fill(0);
    for(const p of m){
      for(let i=0;i<7;i++) bandAvg[i] += (p.bands?.[i] || 0);
    }
    for(let i=0;i<7;i++) bandAvg[i] /= n;

    return { samples: m.length, avgRms, avgSilence: avgSil, variability, pauseRatio, bandAvg };
  }

  function snapshotCharts(){
    // reduz para não explodir localStorage
    function snap(cv, maxW=900){
      const dpr = cv._dpr || 1;
      const w = cv.width;
      const h = cv.height;
      const scale = Math.min(1, maxW / (w/dpr));
      const out = document.createElement("canvas");
      out.width = Math.floor((w/dpr) * scale);
      out.height = Math.floor((h/dpr) * scale);
      const octx = out.getContext("2d");
      // desenha "normalizando" dpr
      octx.drawImage(cv, 0,0, w, h, 0,0, out.width, out.height);
      return out.toDataURL("image/png", 0.92);
    }
    return {
      sound: snap(cvSound),
      silence: snap(cvSilence),
      overlay: snap(cvOverlay)
    };
  }

  function stopAll(){
    try{ if(raf) cancelAnimationFrame(raf); }catch{}
    raf=null;
    capturing=false;

    try{ stream?.getTracks()?.forEach(t=>t.stop()); }catch{}
    try{ audioCtx?.close(); }catch{}
    stream=null; audioCtx=null; analyser=null; srcNode=null;
  }

  function saveSession(){
    const sessions = ELAYON.readJSON(ELAYON.KEYS.SESSIONS, []);
    sessions.unshift(session);
    ELAYON.writeJSON(ELAYON.KEYS.SESSIONS, sessions.slice(0, 30)); // guarda só 30
  }

  function consumeToken(){
    const t = ELAYON.getTokens();
    t.tokens = Math.max(0, (t.tokens||0) - 1);
    t.updatedAt = Date.now();
    ELAYON.setTokens(t);
  }

  function endSession(reason="manual"){
    if(session.status !== "active" && session.status !== "paused") return;

    session.status = "closed";
    session.endedAt = Date.now();
    session.closeReason = reason;

    session.summary = summarize();
    session.charts = snapshotCharts();

    // consome token no encerramento
    consumeToken();
    saveSession();
    stopAll();

    location.href = `report.html?id=${encodeURIComponent(session.id)}`;
  }

  // binds
  $("btnMic").addEventListener("click", enableMic);

  $("btnStart").addEventListener("click", ()=>{
    if(!capturing){
      // se estava pausado e já tinha stream, resume
      if (session.status === "active") return; // redundante
      startCapture();
    }else{
      resume();
    }
  });

  $("btnPause").addEventListener("click", ()=>{
    session.status = "paused";
    pause();
  });

  $("btnEnd").addEventListener("click", ()=> endSession("manual"));
});