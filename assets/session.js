// ==================================================
// CÓDIGO ORIGINAL FUNCIONAL (Sessões, Áudio, Gráficos)
// ==================================================
const KEY_SESSIONS = "elayon_crs_sessions";
const KEY_TOKENS = "elayon_demo_tokens";

const SESSION_EXPIRE_MS = 30 * 60 * 1000;
const RECORD_MAX_SEC = 5 * 60;
const CRS_LINES = 8;

function getParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}
function loadSessions(){
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}
function saveSessions(arr){
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}
function findSession(id){
  const arr = loadSessions();
  const idx = arr.findIndex(s => s.id === id);
  return { arr, idx, session: idx >= 0 ? arr[idx] : null };
}
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function loadTokens(){
  try{ return Number(localStorage.getItem(KEY_TOKENS) || "0"); }catch{ return 0; }
}
function saveTokens(n){
  localStorage.setItem(KEY_TOKENS, String(Math.max(0, Math.floor(n))));
}

const id = getParam("id");
const { arr, idx, session } = findSession(id);

if(!session){
  alert("Sessão não encontrada. Volte ao Início.");
  location.href = "index.html";
}

// UI - Elementos Originais
const subTitle = document.getElementById("subTitle");
const kpiSess = document.getElementById("kpiSess");
const kpiRec = document.getElementById("kpiRec");
const kpiState = document.getElementById("kpiState");

const btnMic = document.getElementById("btnMic");
const btnStart = document.getElementById("btnStart");
const btnPause = document.getElementById("btnPause");
const btnEnd = document.getElementById("btnEnd");

subTitle.textContent = `Médico: ${session.medico} • Paciente: ${session.paciente} • ${session.presetName || "Preset"}`;
kpiSess.textContent = `sessão: ${session.id}`;

let audioCtx, analyser, srcNode, stream;
let raf = null;
let enabled = false;
let capturing = false;

const sampleHz = Math.max(1, Math.min(30, Number(session.configSnapshot?.sampleHz || 10)));
const thr = Math.max(0.005, Math.min(0.10, Number(session.configSnapshot?.silenceThr || 0.025)));
const intervalMs = Math.max(40, Math.round(1000 / sampleHz));

// canvases
const cvFft = document.getElementById("cvFft");
const cvSil = document.getElementById("cvSil");
const cvOv = document.getElementById("cvOv");

function fitCanvas(cv, h){
  const r = cv.getBoundingClientRect();
  cv.width = Math.floor(r.width * devicePixelRatio);
  cv.height = Math.floor(h * devicePixelRatio);
}
function fitAll(){
  fitCanvas(cvFft, 240);
  fitCanvas(cvSil, 240);
  fitCanvas(cvOv, 240);
}
addEventListener("resize", fitAll);
fitAll();

const ctxF = cvFft.getContext("2d");
const ctxS = cvSil.getContext("2d");
const ctxO = cvOv.getContext("2d");

// buffers
let lastSampleT = 0;
let recordedMs = Math.floor((session.recordedSec || 0) * 1000);

const HISTORY = 720; // display width points
const overlaySeries = Array.from({length: CRS_LINES}, ()=> new Array(HISTORY).fill(0));
const silSeries = new Array(HISTORY).fill(0);
let wIdx = 0;

let fftSum = null;
let fftCount = 0;

function rmsFromTimeDomain(buf){
  let sum = 0;
  for(let i=0;i<buf.length;i++){
    const v = (buf[i]-128)/128;
    sum += v*v;
  }
  return Math.sqrt(sum/buf.length);
}

function bandEnergy(freq, fromHz, toHz, sampleRate){
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

function pitchProxy(freq, sampleRate){
  const nyq = sampleRate/2;
  const from = Math.floor((90/nyq)*freq.length);
  const to = Math.floor((350/nyq)*freq.length);
  let max=0;
  for(let i=from;i<=to;i++) max = Math.max(max, freq[i]);
  return max/255;
}

// drawing helpers
function clearPanel(ctx, cv){
  ctx.clearRect(0,0,cv.width, cv.height);
  ctx.fillStyle = "rgba(245,255,255,1)";
  ctx.fillRect(0,0,cv.width, cv.height);
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1*devicePixelRatio;
  for(let i=1;i<6;i++){
    const y = (cv.height/6)*i;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cv.width,y); ctx.stroke();
  }
}

function drawFFT(freq){
  clearPanel(ctxF, cvFft);

  const barCount = 64;
  const step = Math.max(1, Math.floor(freq.length / barCount));
  const w = cvFft.width / barCount;

  for(let i=0;i<barCount;i++){
    const v = freq[i*step]/255;
    const h = v * (cvFft.height*0.78);

    ctxF.fillStyle = `rgba(14,165,233,${0.10 + v*0.35})`;
    ctxF.fillRect(i*w, cvFft.height - h, w*0.78, h);

    ctxF.fillStyle = `rgba(34,197,94,${0.06 + v*0.25})`;
    ctxF.fillRect(i*w, cvFft.height - h*0.45, w*0.78, h*0.45);
  }

  // linha de média acumulada (se existir)
  if(fftSum && fftCount>2){
    ctxF.strokeStyle = "rgba(10,30,40,0.55)";
    ctxF.lineWidth = 2*devicePixelRatio;
    ctxF.beginPath();
    for(let i=0;i<barCount;i++){
      const raw = fftSum[i] / fftCount; // 0..255
      const v = raw/255;
      const x = (i/(barCount-1)) * cvFft.width;
      const y = cvFft.height*0.90 - v*(cvFft.height*0.70);
      if(i===0) ctxF.moveTo(x,y); else ctxF.lineTo(x,y);
    }
    ctxF.stroke();
  }

  ctxF.fillStyle = "rgba(0,0,0,0.45)";
  ctxF.font = `${14*devicePixelRatio}px system-ui, -apple-system, Segoe UI, Roboto`;
  ctxF.fillText(`FFT (som) • amostra ${sampleHz}Hz • thr silêncio ${thr.toFixed(3)}`, 12*devicePixelRatio, 20*devicePixelRatio);
}

function drawSilence(){
  clearPanel(ctxS, cvSil);

  ctxS.strokeStyle = "rgba(10,30,40,0.55)";
  ctxS.lineWidth = 2*devicePixelRatio;
  ctxS.beginPath();
  for(let x=0;x<HISTORY;x++){
    const idx = (wIdx + x) % HISTORY;
    const v = silSeries[idx]; // 0..1
    const px = (x/(HISTORY-1)) * cvSil.width;
    const py = cvSil.height*0.85 - v*(cvSil.height*0.70);
    if(x===0) ctxS.moveTo(px,py); else ctxS.lineTo(px,py);
  }
  ctxS.stroke();

  // linha do threshold visual (referência)
  ctxS.strokeStyle = "rgba(245,158,11,0.35)";
  ctxS.lineWidth = 2*devicePixelRatio;
  ctxS.beginPath();
  ctxS.moveTo(0, cvSil.height*0.50);
  ctxS.lineTo(cvSil.width, cvSil.height*0.50);
  ctxS.stroke();

  ctxS.fillStyle = "rgba(0,0,0,0.45)";
  ctxS.font = `${14*devicePixelRatio}px system-ui, -apple-system, Segoe UI, Roboto`;
  ctxS.fillText("Silêncio (proxy temporal) • 0=falando 1=silêncio", 12*devicePixelRatio, 20*devicePixelRatio);
}

function drawOverlay(){
  clearPanel(ctxO, cvOv);

  const rowH = cvOv.height / CRS_LINES;

  const labels = [
    "1) RMS (energia)",
    "2) Pausa curta",
    "3) Pausa média",
    "4) Pausa longa",
    "5) Pitch proxy",
    "6) Subgrave (20–60Hz)",
    "7) Graves (60–250Hz)",
    "8) Médias-altas (800–3500Hz)"
  ];

  for(let l=0;l<CRS_LINES;l++){
    const yMid = rowH*l + rowH*0.5;
    const amp = rowH*0.32;

    ctxO.strokeStyle = "rgba(0,0,0,0.70)";
    ctxO.lineWidth = 2*devicePixelRatio;

    ctxO.beginPath();
    for(let x=0;x<HISTORY;x++){
      const idx = (wIdx + x) % HISTORY;
      const v = overlaySeries[l][idx]; // 0..1
      const px = (x/(HISTORY-1)) * cvOv.width;
      const py = yMid - (v-0.5)*2*amp;
      if(x===0) ctxO.moveTo(px,py); else ctxO.lineTo(px,py);
    }
    ctxO.stroke();

    ctxO.fillStyle = "rgba(0,0,0,0.42)";
    ctxO.font = `${13*devicePixelRatio}px system-ui, -apple-system, Segoe UI, Roboto`;
    ctxO.fillText(labels[l], 12*devicePixelRatio, (rowH*l + 18*devicePixelRatio));
  }
}

function updateKPIs(){
  const now = Date.now();
  const left = session.expiresAt - now;
  const leftSec = Math.max(0, Math.floor(left/1000));
  kpiSess.textContent = `sessão: ${session.id} • expira em ${fmtTime(leftSec)}`;
  kpiRec.textContent = `gravado: ${fmtTime(recordedMs/1000)} / 05:00`;

  if(left <= 0 && session.status === "active"){
    endSession("expired");
  }
  if(recordedMs >= RECORD_MAX_SEC*1000){
    kpiState.textContent = "estado: limite de 5 min atingido";
    btnStart.disabled = true;
    btnPause.disabled = true;
    btnEnd.disabled = false;
  }
}
setInterval(updateKPIs, 250);

async function enableMic(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    srcNode = audioCtx.createMediaStreamSource(stream);
    srcNode.connect(analyser);

    enabled = true;
    kpiState.textContent = "estado: microfone ok";
    btnStart.disabled = false;
    btnEnd.disabled = false;
    
    // AVISO IA: Microfone pronto
    iaFala("🎤 Microfone ativado! Agora é só começar a gravar que eu já analiso tudo.", true);
  }catch(e){
    alert("Falha ao acessar microfone. Verifique permissões do navegador.");
  }
}

function sampleOnce(timeData, freqData){
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  const rms = clamp01(rmsFromTimeDomain(timeData) * 3.0);

  // silêncio proxy: 0 falando → 1 silêncio
  const silence = clamp01((thr - rms) / thr);

  // pausas por suavização
  const prevMid = overlaySeries[2][(wIdx-1+HISTORY)%HISTORY] || 0;
  const prevLong = overlaySeries[3][(wIdx-1+HISTORY)%HISTORY] || 0;
  const shortPause = silence;
  const midPause = clamp01(silence*0.7 + prevMid*0.3);
  const longPause = clamp01(silence*0.5 + prevLong*0.5);

  const pp = clamp01(pitchProxy(freqData, audioCtx.sampleRate));
  const sub = clamp01(bandEnergy(freqData, 20, 60, audioCtx.sampleRate));
  const low = clamp01(bandEnergy(freqData, 60, 250, audioCtx.sampleRate));
  const midHigh = clamp01(bandEnergy(freqData, 800, 3500, audioCtx.sampleRate));

  overlaySeries[0][wIdx] = rms;
  overlaySeries[1][wIdx] = shortPause;
  overlaySeries[2][wIdx] = midPause;
  overlaySeries[3][wIdx] = longPause;
  overlaySeries[4][wIdx] = pp;
  overlaySeries[5][wIdx] = sub;
  overlaySeries[6][wIdx] = low;
  overlaySeries[7][wIdx] = midHigh;

  silSeries[wIdx] = silence;

  // Atualiza Métricas da IA em Tempo Real (aqui liga o gráfico com a inteligência)
  atualizarMetricasIA(rms, pp, midPause, low);

    // FFT avg accumulator (downsample to 64 bars)
  const barCount = 64;
  const step = Math.max(1, Math.floor(freqData.length / barCount));
  if(!fftSum) fftSum = new Array(barCount).fill(0);
  for(let i=0;i<barCount;i++){
    fftSum[i] += freqData[i*step];
  }
  fftCount++;

  wIdx = (wIdx + 1) % HISTORY;

  drawFFT(freqData);
  drawSilence();
  drawOverlay();
}

function loop(){
  raf = requestAnimationFrame(loop);

  // sempre desenha com o que tiver (último estado)
  drawSilence();
  drawOverlay();

  if(!capturing) return;
  if(recordedMs >= RECORD_MAX_SEC*1000) return;

  const now = performance.now();
  if(now - lastSampleT < intervalMs) return;
  lastSampleT = now;

  recordedMs += intervalMs;

  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  sampleOnce(timeData, freqData);

  // persistir progresso leve na sessão
  session.recordedSec = recordedMs/1000;
  arr[idx] = session;
  saveSessions(arr);
}

function startCapture(){
  if(!enabled || !analyser) return;
  if(recordedMs >= RECORD_MAX_SEC*1000) return;

  capturing = true;
  kpiState.textContent = "estado: captando (demo)";
  btnStart.disabled = true;
  btnPause.disabled = false;
  btnEnd.disabled = false;

  if(!raf) loop();
  
  // IA avisa que começou
  iaFala("🎙️ Gravação iniciada! Estou captando tudo e analisando cada detalhe da sua voz...");
}

function pauseCapture(){
  capturing = false;
  kpiState.textContent = "estado: pausado";
  btnStart.disabled = false;
  btnPause.disabled = true;
  
  // IA avisa pausa
  iaFala("⏸️ Gravação pausada. Quando quiser, é só continuar ou encerrar.");
}

function summarize(){
  // deriva de overlaySeries[0] (rms) e silSeries
  // pega os últimos HISTORY pontos como proxy do período captado
  let rmsSum=0, rmsN=0, varSum=0, silSum=0;
  let prev=null;

  for(let i=0;i<HISTORY;i++){
    const idx = i; // já está circular, mas queremos média do buffer
    const rms = overlaySeries[0][idx];
    const sil = silSeries[idx];

    rmsSum += rms; rmsN++;
    silSum += sil;

    if(prev!==null) varSum += Math.abs(rms - prev);
    prev = rms;
  }

  const avgRms = rmsN ? rmsSum/rmsN : 0;
  const avgSil = rmsN ? silSum/rmsN : 0;
  const variability = (rmsN>1) ? varSum/(rmsN-1) : 0;

  // “pausa ratio” proxy: silêncio > 0.5
  let pauseCount=0;
  for(let i=0;i<HISTORY;i++){
    if(silSeries[i] > 0.5) pauseCount++;
  }
  const pauseRatio = pauseCount/HISTORY;

  return { avgRms, avgSilence: avgSil, variability, pauseRatio, fftCount };
}

function snapshotAll(){
  // garante render final
  drawSilence(); drawOverlay();
  return {
    fft: cvFft.toDataURL("image/png"),
    sil: cvSil.toDataURL("image/png"),
    ov: cvOv.toDataURL("image/png")
  };
}

function cleanupAudio(){
  try{ if(raf) cancelAnimationFrame(raf); }catch{}
  raf = null;

  try{ srcNode?.disconnect(); }catch{}
  try{ analyser?.disconnect?.(); }catch{}
  try{ audioCtx?.close(); }catch{}
  try{ stream?.getTracks()?.forEach(t=>t.stop()); }catch{}

  enabled = false;
  capturing = false;
}

function consumeTokenIfAny(){
  // demo: consome 1 token ao encerrar
  const t = loadTokens();
  if(t > 0){
    saveTokens(t-1);
    return true;
  }
  return false;
}

function endSession(reason="manual"){
  if(session.status === "closed") return;

  // encerra captura
  capturing = false;

  // gera evidência
  const sum = summarize();
  const snaps = snapshotAll();

  session.status = "closed";
  session.closedAt = Date.now();
  session.closeReason = reason;
  session.summary = sum;
  session.snaps = snaps;

  // consome token (demo) — se não tiver token, ainda fecha (demo), mas marca no relatório
  const consumed = consumeTokenIfAny();
  session.tokenConsumed = consumed ? 1 : 0;

  arr[idx] = session;
  saveSessions(arr);

  cleanupAudio();
  
  // IA finaliza
  iaFala("✅ Sessão encerrada! Todos os dados foram salvos e analisados. Vamos ver o relatório completo?", true);

  location.href = `report.html?id=${encodeURIComponent(session.id)}`;
}

// binds
btnMic.addEventListener("click", enableMic);
btnStart.addEventListener("click", startCapture);
btnPause.addEventListener("click", pauseCapture);
btnEnd.addEventListener("click", ()=> endSession("manual"));

updateKPIs();
drawFFT(new Uint8Array(256));
drawSilence();
drawOverlay();


// ==================================================
// PARTE NOVA: INTELIGÊNCIA ARTIFICIAL E CALIBRAÇÃO
// ==================================================

// Variáveis globais de estado e aprendizado
let padraoBase = { energia: null, ritmo: null, pausa: null, clareza: null };
let historicoConfirmado = [];
let etapaAtual = 0;
let dadosCalibracao = [];
let pontosAnalise = [];

// Elementos da Interface
const passos = [document.getElementById('passo1'), document.getElementById('passo2'), document.getElementById('passo3')];
const botoesGrav = [document.getElementById('btnGrav1'), document.getElementById('btnGrav2'), document.getElementById('btnGrav3')];
const botoesParar = [document.getElementById('btnParar1'), document.getElementById('btnParar2'), document.getElementById('btnParar3')];
const avaliacoes = [document.querySelectorAll('#avalia1 .btn-avalia'), document.querySelectorAll('#avalia2 .btn-avalia'), document.querySelectorAll('#avalia3 .btn-avalia')];
const contadores = [document.getElementById('c1'), document.getElementById('c2'), document.getElementById('c3')];
const historicos = [document.getElementById('hist1'), document.getElementById('hist2'), document.getElementById('hist3')];
const iaLog = document.getElementById('iaLog');

// Elementos das Métricas
const metricasBox = document.getElementById('metricasBox');
const mEnergia = document.getElementById('mEnergia');
const mRitmo = document.getElementById('mRitmo');
const mPausa = document.getElementById('mPausa');
const mClareza = document.getElementById('mClareza');
const mComparacao = document.getElementById('mComparacao');

// Elementos de Alerta
const alertaEsforco = document.getElementById('alertaEsforco');
const alertaConduta = document.getElementById('alertaConduta');

// ----------------------
// FUNÇÕES DE INTERAÇÃO IA
// ----------------------

function iaFala(texto, ehConfirmada = false){
  const el = document.createElement('div');
  el.className = `ia-mensagem ${ehConfirmada ? 'confirmada' : ''}`;
  el.textContent = texto;
  iaLog.appendChild(el);
  iaLog.scrollTop = iaLog.scrollHeight;
}

function registrarPonto(etapa, tipo, valor, status){
  const p = { etapa, tipo, valor, status, hora: new Date().toLocaleTimeString() };
  pontosAnalise.push(p);
  const el = document.createElement('div');
  el.className = 'ponto-item';
  el.innerHTML = `<span>${tipo}</span><span>${valor}</span><span>${status}</span>`;
  historicos[etapa].appendChild(el);
}

// **AQUI A LIGAÇÃO PRINCIPAL**: Pega os dados REAIS do áudio e transforma nas métricas da IA
function atualizarMetricasIA(rms, pitch, pausa, graves){
  // Convertemos os valores capturados para a escala da IA (0 a 1)
  const energia = clamp01(rms * 1.2);       // Usamos o RMS real como energia
  const ritmo = clamp01(1 - (pausa * 0.8)); // Menos pausa = mais rápido/ritmo alto
  const clareza = clamp01(pitch * 0.9 + graves * 0.3); // Pitch + graves = clareza

  // Se já tem padrão base, compara
  if(padraoBase.energia !== null){
    let difE = ((energia - padraoBase.energia)/padraoBase.energia*100).toFixed(1);
    let difR = ((ritmo - padraoBase.ritmo)/padraoBase.ritmo*100).toFixed(1);
    let difP = ((pausa - padraoBase.pausa)/padraoBase.pausa*100).toFixed(1);
    let difC = ((clareza - padraoBase.clareza)/padraoBase.clareza*100).toFixed(1);
    
    let textoComp = `E: ${difE}% | R: ${difR}% | P: ${difP}% | C: ${difC}%`;
    
    // Atualiza caixa de métricas na tela
    metricasBox.style.display = "block";
    mEnergia.textContent = `Energia: ${energia.toFixed(2)}`;
    mRitmo.textContent = `Ritmo: ${ritmo.toFixed(2)}`;
    mPausa.textContent = `Pausa: ${pausa.toFixed(2)}`;
    mClareza.textContent = `Clareza: ${clareza.toFixed(2)}`;
    mComparacao.textContent = `Comparação: ${textoComp}`;

    // --- Lógica de Alertas Inteligentes (agora com dados REAIS) ---
    if(difE < -15 || difC < -15) {
      alertaConduta.style.display = 'block';
      alertaEsforco.style.display = 'none';
    } else if(difR > 20 || difE > 25) {
      alertaEsforco.style.display = 'block';
      alertaConduta.style.display = 'none';
    } else {
      alertaEsforco.style.display = 'none';
      alertaConduta.style.display = 'none';
    }
  }
}

// Função de análise que USA OS DADOS REAIS para criar o padrão
function analisarSinal(etapa, avaliacaoUsuario){
  // Pegamos os dados reais do último ciclo de captura
  const energia = overlaySeries[0][wIdx] || 0; // RMS
  const ritmo = 1 - (overlaySeries[3][wIdx] || 0); // Inverte pausa longa
  const pausa = overlaySeries[3][wIdx] || 0;
  const clareza = (overlaySeries[4][wIdx] + overlaySeries[6][wIdx])/2 || 0; // Pitch + Graves

  iaFala(`🔍 Análise final da amostra ${etapa+1}: Energia ${energia.toFixed(2)}, Ritmo ${ritmo.toFixed(2)}`);

  if(etapa === 0){
    // Definindo o padrão base com dados REAIS
    padraoBase.energia = energia;
    padraoBase.ritmo = ritmo;
    padraoBase.pausa = pausa;
    padraoBase.clareza = clareza;
    iaFala(`✅ Padrão BASE DEFINIDO com a SUA voz real! Agora tudo será comparado com isso.`, true);
    registrarPonto(etapa, "Energia", energia.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Ritmo", ritmo.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Pausa", pausa.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Clareza", clareza.toFixed(2), "REFERÊNCIA");
  } else {
    // Comparação REAL com a base
    let difE = ((energia - padraoBase.energia)/padraoBase.energia*100).toFixed(1);
    let difR = ((ritmo - padraoBase.ritmo)/padraoBase.ritmo*100).toFixed(1);
    let difP = ((pausa - padraoBase.pausa)/padraoBase.pausa*100).toFixed(1);
    let difC = ((clareza - padraoBase.clareza)/padraoBase.clareza*100).toFixed(1);

    iaFala(`📊 Comparação Real: Energia ${difE}% | Ritmo ${difR}%`);

    registrarPonto(etapa, "Energia", energia.toFixed(2), `${difE}%`);
    registrarPonto(etapa, "Ritmo", ritmo.toFixed(2), `${difR}%`);

    // Atualiza base se usuário confirmar como normal
    if(avaliacaoUsuario.includes("Normal")) {
      padraoBase.energia = (padraoBase.energia + energia) / 2;
      padraoBase.ritmo = (padraoBase.ritmo + ritmo) / 2;
      iaFala(`💾 Perfeito! Atualizei o padrão com essa amostra que você achou normal.`);
    }
  }
}

// --- CONTROLE DE BOTÕES DA CALIBRAÇÃO ---
avaliacoes.forEach((grupo, idx) => {
  grupo.forEach(btn => {
    btn.addEventListener('click', ()=>{
      grupo.forEach(b=>b.classList.remove('selecionado'));
      btn.classList.add('selecionado');
      dadosCalibracao[idx] = btn.textContent;
      contadores[idx].textContent = `(concluído: ${btn.textContent})`;
      
      analisarSinal(idx, btn.textContent);

      // Libera próxima etapa
      if(idx < 2){
        passos[idx].classList.remove('ativo');
        passos[idx+1].classList.add('ativo');
        botoesGrav[idx+1].disabled = false;
        etapaAtual = idx+1;
        iaFala(`➡️ Pronto para o próximo!`);
      } else {
        // Fim da calibração inicial
        passos[idx).classList.remove('ativo');
        document.getElementById('areaFifo').style.display = 'block';
        iaFala(`🎉 Calibração concluída! Agora estou pronto para exercícios livres.`);
        inicializarFifo();
      }
    });
  });
});

// Ações dos botões de gravação dos passos
botoesGrav.forEach((btn, idx)=>{
  btn.addEventListener('click', ()=>{
    if(!enabled) {
      iaFala("⚠️ Primeiro clique em 'Ativar Microfone' ali em cima!");
      return;
    }
    btn.disabled = true;
    botoesParar[idx].disabled = false;
    contadores[idx].textContent = '(🔴 GRAVANDO...)';
    startCapture(); // Usa a função original de captura
  });
});

botoesParar.forEach((btn, idx)=>{
  btn.addEventListener('click', ()=>{
    btn.disabled = true;
    pauseCapture(); // Usa a função original de pausa
    contadores[idx].textContent = '(✅ Gravação salva. Avalie abaixo.)';
    iaFala(`🛑 Gravação finalizada. Agora me diga: como foi a sua fala?`);
  });
});

// --- SISTEMA FIFO (EXERCÍCIOS LIVRES) ---
let qtdFeitos = 0;
const MAX_EXERCICIOS = 10;
const frasesExercicios = [
  "A natureza é bela e devemos cuidar de tudo o que existe nela.",
  "Caminhar devagar ajuda a pensar melhor e falar com mais clareza.",
  "Ouça o seu corpo, ele sempre avisa o que precisa e quando parar.",
  "A paciência é uma virtude que fortalece a nossa voz e a nossa mente.",
  "Respirar fundo acalma, renova as energias e melhora toda a nossa fala.",
  "Cada dia é uma nova chance de praticar e fazer o seu melhor.",
  "O descanso é tão importante quanto o exercício: equilíbrio é tudo.",
  "Sua voz é única e é muito importante para mim ouvi-la bem.",
  "Fale com calma, sem pressa, assim sua voz sai forte e bonita.",
  "Tudo o que praticamos com carinho fica guardado como uma grande vitória."
];

function inicializarFifo(){
  const btnGravFifo = document.getElementById('btnGravFifo');
  const btnPararFifo = document.getElementById('btnPararFifo');
  const btnPular = document.getElementById('btnPular');
  const btnFinalizar = document.getElementById('btnFinalizar');
  const fraseFifo = document.getElementById('fraseFifo');
  const tituloFifo = document.getElementById('tituloFifo');
  const avaliaFifo = document.querySelectorAll('#avaliaFifo .btn-avalia');
  const historicoFifo = document.getElementById('histFifo');
  const qtdFeitosEl = document.getElementById('qtdFeitos');

  function proximoExercicio(){
    if(qtdFeitos >= MAX_EXERCICIOS) {
      iaFala(`🔚 Você já completou os ${MAX_EXERCICIOS} exercícios disponíveis. Se quiser continuar, é só pedir, mas por hoje já está de ótimo tamanho!`, true);
      btnGravFifo.disabled = true;
      btnPular.disabled = true;
      return;
    }
    tituloFifo.textContent = `Exercício ${qtdFeitos+1}`;
    fraseFifo.textContent = frasesExercicios[qtdFeitos];
    btnGravFifo.disabled = false;
    btnPararFifo.disabled = true;
    qtdFeitosEl.textContent = qtdFeitos;
    avaliaFifo.forEach(b=>b.classList.remove('selecionado'));
    
    // Limpa alertas e métricas
    alertaEsforco.style.display = 'none';
    alertaConduta.style.display = 'none';
  }

  // Começar gravação do exercício
  btnGravFifo.addEventListener('click', ()=>{
    if(!enabled) {
      iaFala("⚠️ Primeiro ative o microfone no painel superior!");
      return;
    }
    btnGravFifo.disabled = true;
    btnPararFifo.disabled = false;
    iaFala(`🎙️ Gravando exercício ${qtdFeitos+1}... Vou analisar tudo em tempo real.`);
    startCapture(); // Usa função original
  });

  // Parar gravação
  btnPararFifo.addEventListener('click', ()=>{
    btnPararFifo.disabled = true;
    pauseCapture(); // Usa função original
    iaFala(`🛑 Gravação salva! Agora me conta: como você achou que foi a sua fala agora?`);
  });

  // Pular exercício
  btnPular.addEventListener('click', ()=>{
    qtdFeitos++;
    proximoExercicio();
    iaFala(`⏭️ Tudo bem, pulamos esse. Vamos para o próximo!`);
  });

  // Avaliação do usuário
  avaliaFifo.forEach(btn => {
    btn.addEventListener('click', ()=>{
      avaliaFifo.forEach(b=>b.classList.remove('selecionado'));
      btn.classList.add('selecionado');

      // Análise final com dados REAIS
      const energia = overlaySeries[0][wIdx] || 0;
      const ritmo = 1 - (overlaySeries[3][wIdx] || 0);
      let difE = padraoBase.energia ? ((energia - padraoBase.energia)/padraoBase.energia*100).toFixed(1) : "0";
      let difR = padraoBase.ritmo ? ((ritmo - padraoBase.ritmo)/padraoBase.ritmo*100).toFixed(1) : "0";

      // Feedback inteligente
      if(btn.textContent.includes("cansado") || btn.textContent.includes("força")) {
        iaFala(`💡 Entendi que sentiu esforço. Analisando: sua energia foi ${difE}% e ritmo ${difR}%. Vamos tentar respirar mais fundo no próximo para ficar mais leve.`);
      } else if(btn.textContent.includes("devagar")) {
        iaFala(`💡 Percebeu que falou mais devagar? Comparei com o seu padrão e está ${difR}% mais calmo. Isso é ótimo para clareza!`);
      } else {
        iaFala(`✅ Que bom que correu bem! Os dados mostram que está ${difE}% na energia e ${difR}% no ritmo — bem dentro do seu normal.`);
      }

      // Salva no histórico
      const el = document.createElement('div');
      el.className = 'ponto-item';
      el.innerHTML = `<span>Ex${qtdFeitos+1}</span><span>E:${difE}% R:${difR}%</span><span>${btn.textContent}</span>`;
      historicoFifo.appendChild(el);

      qtdFeitos++;
      proximoExercicio();
    });
  });

  // Finalizar tudo
  btnFinalizar.addEventListener('click', ()=>{
    if(confirm("Deseja realmente encerrar a sessão e ir para o relatório?")){
      endSession("finalizado_por_usuario"); // Usa função original de encerramento
    }
  });

  // Inicia o primeiro exercício
  proximoExercicio();
}

// Mensagem inicial da IA
iaFala("🤖 Olá! Estou pronto. Primeiro, clique em **Ativar Microfone** no painel acima. Depois siga os passos de calibração para eu aprender a sua voz.", true);


