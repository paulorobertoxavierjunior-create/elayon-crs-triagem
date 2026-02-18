const KEY_CONFIG = "elayon_crs_config";

/* ===================== CONFIG ===================== */
function loadConfig(){
  try{
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  }catch{}
  return { sessionMinutes: 30, sampleHz: 10, notes: "Config padrão (demo)." };
}

function saveConfig(cfg){
  localStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
}

const elMin   = document.getElementById("sessionMinutes");
const elHz    = document.getElementById("sampleHz");
const elNotes = document.getElementById("notes");

function fillConfig(){
  const cfg = loadConfig();
  elMin.value = cfg.sessionMinutes ?? 30;
  elHz.value  = cfg.sampleHz ?? 10;
  elNotes.value = cfg.notes ?? "";
}
fillConfig();

document.getElementById("btnSave").addEventListener("click", ()=>{
  const cfg = {
    sessionMinutes: Number(elMin.value || 30),
    sampleHz: Number(elHz.value || 10),
    notes: (elNotes.value || "").trim()
  };
  saveConfig(cfg);
  alert("Configuração salva.");
});

document.getElementById("btnReset").addEventListener("click", ()=>{
  saveConfig({ sessionMinutes: 30, sampleHz: 10, notes: "Config padrão (demo)." });
  fillConfig();
  alert("Padrão restaurado.");
});

/* ===================== SPECTROS (MIC) ===================== */
const btnStart = document.getElementById("btnMicStart");
const btnStop  = document.getElementById("btnMicStop");
const btnClear = document.getElementById("btnClear");

const kpiState = document.getElementById("kpiState");
const kpiRms   = document.getElementById("kpiRms");
const kpiSil   = document.getElementById("kpiSil");
const kpiHz    = document.getElementById("kpiHz");

const cvSound   = document.getElementById("cvSound");
const cvSilence = document.getElementById("cvSilence");
const cvOverlay = document.getElementById("cvOverlay");

const ctxSound   = cvSound.getContext("2d");
const ctxSilence = cvSilence.getContext("2d");
const ctxOverlay = cvOverlay.getContext("2d");

function fitCanvas(cv){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = cv.getBoundingClientRect();
  cv.width  = Math.floor(rect.width * dpr);
  cv.height = Math.floor(rect.height * dpr);
}
function fitAll(){
  [cvSound, cvSilence, cvOverlay].forEach(fitCanvas);
}
window.addEventListener("resize", fitAll);
setTimeout(fitAll, 80);

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let mediaStream = null;

let raf = 0;
let freqData = null;
let timeData = null;

// RMS history para “silêncio”
const RMS_MAX_POINTS = 240; // ~4s-8s dependendo do fps (visual)
let rmsHistory = [];
let silencePctHistory = []; // opcional: manter tendência
let running = false;

// parâmetros de silêncio (ajustáveis depois)
const SILENCE_RMS_THRESHOLD = 0.020; // energia baixa => “silêncio”
const SILENCE_WINDOW = 60; // últimos N frames p/ % silêncio
let silenceWindow = [];

function clearAll(){
  rmsHistory = [];
  silencePctHistory = [];
  silenceWindow = [];
  drawEmpty();
}

function drawEmpty(){
  [ctxSound, ctxSilence, ctxOverlay].forEach(ctx=>{
    ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(0,0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(10,30,40,.35)";
    ctx.font = `${Math.floor(12*(window.devicePixelRatio||1))}px system-ui`;
    ctx.fillText("Aguardando microfone…", 18*(window.devicePixelRatio||1), 26*(window.devicePixelRatio||1));
  });
}
drawEmpty();

function computeRMS(arr){
  // arr é Uint8Array (time domain) 0..255, centro ~128
  let sum = 0;
  for (let i=0;i<arr.length;i++){
    const v = (arr[i] - 128) / 128; // -1..1
    sum += v*v;
  }
  return Math.sqrt(sum / arr.length);
}

function drawFrequencyBars(ctx, data){
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0,0,w,h);

  // fundo suave
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(0,0,w,h);

  const n = data.length;
  const step = Math.max(1, Math.floor(n / 120)); // reduz barras p/ leveza
  const bars = Math.floor(n / step);
  const barW = w / bars;

  for (let i=0, b=0; i<n; i+=step, b++){
    const v = data[i] / 255; // 0..1
    const bh = v * (h * 0.92);

    // gradiente simples (sem “pesar”)
    const x = b * barW;
    ctx.fillStyle = "rgba(14,165,233,.35)";
    ctx.fillRect(x, h - bh, barW * 0.9, bh);

    // “reflexo” verde bem leve por cima (duas camadas = bonito e leve)
    ctx.fillStyle = "rgba(34,197,94,.18)";
    ctx.fillRect(x, h - (bh*0.55), barW * 0.9, bh*0.55);
  }

  // linha base
  ctx.strokeStyle = "rgba(10,30,40,.12)";
  ctx.beginPath();
  ctx.moveTo(0, h-1);
  ctx.lineTo(w, h-1);
  ctx.stroke();
}

function drawRMSLine(ctx){
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(0,0,w,h);

  // grade leve
  ctx.strokeStyle = "rgba(10,30,40,.08)";
  ctx.lineWidth = 1;
  for (let y=0; y<=4; y++){
    const yy = (h/4)*y;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
  }

  // linha RMS
  if (rmsHistory.length < 2) return;
  const maxR = 0.25; // escala visual (ajusta depois)
  ctx.strokeStyle = "rgba(14,165,233,.75)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  for (let i=0; i<rmsHistory.length; i++){
    const x = (i/(RMS_MAX_POINTS-1)) * w;
    const v = Math.min(1, rmsHistory[i] / maxR);
    const y = h - (v * (h*0.9)) - (h*0.05);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();

  // faixa de “silêncio” (threshold)
  const thr = Math.min(1, SILENCE_RMS_THRESHOLD / maxR);
  const yThr = h - (thr * (h*0.9)) - (h*0.05);
  ctx.strokeStyle = "rgba(245,158,11,.55)";
  ctx.setLineDash([6,6]);
  ctx.beginPath();
  ctx.moveTo(0, yThr);
  ctx.lineTo(w, yThr);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawOverlay(ctx, freq, rms){
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0,0,w,h);

  // fundo
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(0,0,w,h);

  // 1) barras freq mais “baixas” (ocupam 70% da altura)
  const n = freq.length;
  const step = Math.max(1, Math.floor(n / 120));
  const bars = Math.floor(n / step);
  const barW = w / bars;

  for (let i=0, b=0; i<n; i+=step, b++){
    const v = freq[i] / 255;
    const bh = v * (h * 0.70);
    const x = b * barW;
    ctx.fillStyle = "rgba(34,197,94,.22)";
    ctx.fillRect(x, h - bh, barW * 0.9, bh);
  }

  // 2) RMS como “agulha” vertical + número visual
  const maxR = 0.25;
  const vv = Math.min(1, rms / maxR);
  const y = h - (vv * (h*0.9)) - (h*0.05);

  ctx.strokeStyle = "rgba(14,165,233,.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();

  // 3) uma “faixa” no rodapé marcando silêncio (quanto mais silêncio, mais faixa)
  const silPct = (silenceWindow.reduce((a,b)=>a+b,0) / Math.max(1, silenceWindow.length));
  ctx.fillStyle = "rgba(245,158,11,.15)";
  ctx.fillRect(0, h - (h*0.10), w * silPct, h*0.10);
}

function loopDraw(){
  if (!running || !analyser) return;

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const rms = computeRMS(timeData);

  // historiza
  rmsHistory.push(rms);
  if (rmsHistory.length > RMS_MAX_POINTS) rmsHistory.shift();

  const isSil = rms < SILENCE_RMS_THRESHOLD ? 1 : 0;
  silenceWindow.push(isSil);
  if (silenceWindow.length > SILENCE_WINDOW) silenceWindow.shift();
  const silPct = Math.round(100 * (silenceWindow.reduce((a,b)=>a+b,0) / Math.max(1, silenceWindow.length)));

  // KPIs
  kpiRms.textContent = `RMS: ${rms.toFixed(3)}`;
  kpiSil.textContent = `Silêncio: ${silPct}%`;
  kpiHz.textContent = `FFT bins: ${freqData.length}`;

  // desenha
  drawFrequencyBars(ctxSound, freqData);
  drawRMSLine(ctxSilence);
  drawOverlay(ctxOverlay, freqData, rms);

  raf = requestAnimationFrame(loopDraw);
}

async function startMic(){
  if (running) return;

  try{
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048; // bom equilíbrio
    analyser.smoothingTimeConstant = 0.75;

    sourceNode = audioCtx.createMediaStreamSource(mediaStream);
    sourceNode.connect(analyser);

    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);

    running = true;

    btnStart.disabled = true;
    btnStop.disabled = false;
    btnClear.disabled = false;
    kpiState.textContent = "MIC: ON";

    loopDraw();
  }catch(err){
    console.error(err);
    alert("Não foi possível acessar o microfone. Verifique permissões do navegador.");
  }
}

function stopMic(){
  running = false;
  cancelAnimationFrame(raf);

  btnStart.disabled = false;
  btnStop.disabled = true;
  btnClear.disabled = true;
  kpiState.textContent = "MIC: OFF";

  try{
    if (sourceNode) sourceNode.disconnect();
  }catch{}

  try{
    if (mediaStream){
      mediaStream.getTracks().forEach(t=>t.stop());
    }
  }catch{}

  try{
    if (audioCtx) audioCtx.close();
  }catch{}

  audioCtx = null;
  analyser = null;
  sourceNode = null;
  mediaStream = null;

  drawEmpty();
}

btnStart.addEventListener("click", startMic);
btnStop.addEventListener("click", stopMic);
btnClear.addEventListener("click", clearAll);