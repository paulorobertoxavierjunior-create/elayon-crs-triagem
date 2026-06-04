/**
 * SESSION.JS — VERSÃO FUNCIONAL MINIMALISTA
 * Apenas: Mic → Gráficos → JSON → Report
 */

const KEY_SESSIONS = "elayon_crs_sessions";

function getParam(name) {
  return new URL(location.href).searchParams.get(name);
}

function loadSessions() {
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}

function saveSessions(arr) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

function log(msg) {
  const el = document.getElementById("debugLog");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

// ============================================
// CARREGAR SESSÃO
// ============================================

const id = getParam("id");
const { session } = (() => {
  const arr = loadSessions();
  const s = arr.find(x => x.id === id);
  return { session: s };
})();

if (!session) {
  alert("Sessão não encontrada");
  location.href = "index.html";
}

document.getElementById("subTitle").textContent = 
  `${session.medico} → ${session.paciente}`;
document.getElementById("sessId").textContent = session.id.substring(0, 12) + "...";

// ============================================
// ÁUDIO & CANVAS
// ============================================

let audioCtx, analyser, srcNode, stream;
let enabled = false;
let recording = false;
let recordedMs = 0;
let audioBuffer = [];

const cvFft = document.getElementById("cvFft");
const cvSil = document.getElementById("cvSil");
const cvOv = document.getElementById("cvOv");

const ctxF = cvFft.getContext("2d");
const ctxS = cvSil.getContext("2d");
const ctxO = cvOv.getContext("2d");

// Histórico para visualização
const HISTORY = 720;
const overlaySeries = Array.from({ length: 8 }, () => new Array(HISTORY).fill(0));
const silSeries = new Array(HISTORY).fill(0);
let wIdx = 0;

function fitCanvas(cv, h) {
  const r = cv.getBoundingClientRect();
  cv.width = Math.floor(r.width * devicePixelRatio);
  cv.height = Math.floor(h * devicePixelRatio);
}

function fitAll() {
  fitCanvas(cvFft, 240);
  fitCanvas(cvSil, 240);
  fitCanvas(cvOv, 240);
}

addEventListener("resize", fitAll);
fitAll();

// ============================================
// PROCESSAMENTO DE ÁUDIO
// ============================================

function rmsFromTimeDomain(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

function bandEnergy(freq, fromHz, toHz, sampleRate) {
  const nyq = sampleRate / 2;
  const from = Math.floor((fromHz / nyq) * freq.length);
  const to = Math.floor((toHz / nyq) * freq.length);
  let sum = 0, n = 0;
  for (let i = Math.max(0, from); i <= Math.min(freq.length - 1, to); i++) {
    sum += freq[i];
    n++;
  }
  return n ? (sum / n) / 255 : 0;
}

function sampleOnce(timeData, freqData) {
  const rms = rmsFromTimeDomain(timeData);
  const silence = rms < 0.025 ? 1 : 0;

  // Bandas
  const sub = bandEnergy(freqData, 20, 80, 16000);
  const low = bandEnergy(freqData, 80, 250, 16000);
  const mid = bandEnergy(freqData, 250, 2000, 16000);
  const high = bandEnergy(freqData, 2000, 8000, 16000);

  // Armazenar no histórico (CRS)
  overlaySeries[0][wIdx] = rms;
  overlaySeries[1][wIdx] = low;
  overlaySeries[2][wIdx] = mid;
  overlaySeries[3][wIdx] = high;
  overlaySeries[4][wIdx] = silence;
  overlaySeries[5][wIdx] = sub;
  silSeries[wIdx] = silence;

  wIdx = (wIdx + 1) % HISTORY;

  // Armazenar para JSON
  if (recording) {
    audioBuffer.push({
      ts: recordedMs,
      rms,
      silence,
      sub,
      low,
      mid,
      high
    });
    recordedMs += 50; // ~20Hz
  }

  // Atualizar métricas
  document.getElementById("mRms").textContent = rms.toFixed(3);
  document.getElementById("mSil").textContent = silence.toFixed(3);

  // Desenhar
  drawFFT(freqData);
  drawSilence();
  drawOverlay();
}

function drawFFT(freq) {
  ctxF.fillStyle = "rgba(248, 250, 252, 1)";
  ctxF.fillRect(0, 0, cvFft.width, cvFft.height);

  const barCount = 64;
  const step = Math.max(1, Math.floor(freq.length / barCount));
  const w = cvFft.width / barCount;

  for (let i = 0; i < barCount; i++) {
    const v = freq[i * step] / 255;
    const h = v * (cvFft.height * 0.9);
    ctxF.fillStyle = `rgba(14, 165, 233, ${0.3 + v * 0.7})`;
    ctxF.fillRect(i * w, cvFft.height - h, w - 1, h);
  }
}

function drawSilence() {
  ctxS.fillStyle = "rgba(248, 250, 252, 1)";
  ctxS.fillRect(0, 0, cvSil.width, cvSil.height);

  const step = Math.max(1, Math.floor(HISTORY / (cvSil.width / 2)));
  for (let i = 0; i < HISTORY; i += step) {
    const v = silSeries[i];
    const x = (i / HISTORY) * cvSil.width;
    const h = v * cvSil.height;
    ctxS.fillStyle = v > 0.5 ? "rgba(239, 68, 68, 0.6)" : "rgba(16, 185, 129, 0.6)";
    ctxS.fillRect(x, cvSil.height - h, 2, h);
  }
}

function drawOverlay() {
  ctxO.fillStyle = "rgba(248, 250, 252, 1)";
  ctxO.fillRect(0, 0, cvOv.width, cvOv.height);

  const colors = [
    "rgba(14, 165, 233, 0.8)",
    "rgba(16, 185, 129, 0.8)",
    "rgba(245, 158, 11, 0.8)",
    "rgba(239, 68, 68, 0.8)",
    "rgba(168, 85, 247, 0.8)",
    "rgba(236, 72, 153, 0.8)",
    "rgba(59, 130, 246, 0.8)",
    "rgba(34, 197, 94, 0.8)"
  ];

  const step = Math.max(1, Math.floor(HISTORY / (cvOv.width / 2)));
  const lineH = cvOv.height / 8;

  for (let line = 0; line < 8; line++) {
    ctxO.strokeStyle = colors[line];
    ctxO.lineWidth = 2;
    ctxO.beginPath();

    for (let i = 0; i < HISTORY; i += step) {
      const v = overlaySeries[line][i];
      const x = (i / HISTORY) * cvOv.width;
      const y = (line + 0.5) * lineH - v * lineH * 0.8;
      if (i === 0) ctxO.moveTo(x, y);
      else ctxO.lineTo(x, y);
    }
    ctxO.stroke();
  }
}

let raf;
function loop() {
  const timeData = new Uint8Array(analyser.frequencyBinCount);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  sampleOnce(timeData, freqData);
  raf = requestAnimationFrame(loop);
}

// ============================================
// BOTÕES
// ============================================

document.getElementById("btnMic").addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    srcNode = audioCtx.createMediaStreamSource(stream);
    srcNode.connect(analyser);

    enabled = true;
    document.getElementById("btnMic").disabled = true;
    document.getElementById("btnRec").disabled = false;
    log("✅ Microfone ativado");
  } catch (e) {
    log(`❌ Erro: ${e.message}`);
    alert("Erro ao acessar microfone: " + e.message);
  }
});

document.getElementById("btnRec").addEventListener("click", () => {
  recording = true;
  recordedMs = 0;
  audioBuffer = [];
  document.getElementById("btnRec").disabled = true;
  document.getElementById("btnStop").disabled = false;
  document.getElementById("status").textContent = "🔴 Gravando";
  document.getElementById("status").style.color = "var(--danger)";
  log("🔴 Gravação iniciada");
  if (!raf) loop();
});

document.getElementById("btnStop").addEventListener("click", () => {
  recording = false;
  document.getElementById("btnRec").disabled = false;
  document.getElementById("btnStop").disabled = true;
  document.getElementById("status").textContent = "⏸️ Parado";
  document.getElementById("status").style.color = "var(--warning)";
  log("⏹️ Gravação parada");
});

document.getElementById("btnEnd").addEventListener("click", () => {
  if (raf) cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();

  // Salvar snapshots
  session.snaps = {
    fft: cvFft.toDataURL("image/png"),
    sil: cvSil.toDataURL("image/png"),
    ov: cvOv.toDataURL("image/png")
  };

  // Salvar dados
  session.audioBuffer = audioBuffer;
  session.recordedMs = recordedMs;
  session.status = "closed";
  session.closedAt = Date.now();

  const arr = loadSessions();
  const idx = arr.findIndex(s => s.id === session.id);
  if (idx >= 0) arr[idx] = session;
  saveSessions(arr);

  log("✅ Sessão finalizada");
  setTimeout(() => {
    location.href = `report.html?id=${encodeURIComponent(session.id)}`;
  }, 1000);
});

// Iniciar loop
if (enabled) loop();