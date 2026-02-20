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

// UI
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
}

function pauseCapture(){
  capturing = false;
  kpiState.textContent = "estado: pausado";
  btnStart.disabled = false;
  btnPause.disabled = true;
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