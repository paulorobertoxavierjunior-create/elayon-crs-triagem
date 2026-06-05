/**
 * SESSION.JS — GRAVAÇÃO CRS OTIMIZADA
 * Carrega dados + Grava áudio + Calcula métricas + Salva validação
 */

const KEY_SESSIONS = "elayon_crs_sessions";
const KEY_VALIDATIONS = "elayon_validations";

// ============================================
// UTILITÁRIOS
// ============================================

function getParam(name) {
  return new URL(location.href).searchParams.get(name);
}

function loadSessions() {
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}

function loadValidations() {
  return JSON.parse(localStorage.getItem(KEY_VALIDATIONS) || "[]");
}

function saveSessions(arr) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

function saveValidations(arr) {
  localStorage.setItem(KEY_VALIDATIONS, JSON.stringify(arr));
}

function log(msg) {
  const debugLog = document.getElementById("debugLog");
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  debugLog.innerHTML += `[${timestamp}] ${msg}<br/>`;
  debugLog.scrollTop = debugLog.scrollHeight;
}

// ============================================
// CARREGAR SESSÃO
// ============================================

const sessionId = getParam("id");
const sessions = loadSessions();
let session = sessions.find(s => s.id === sessionId);

if (!session) {
  alert("Sessão não encontrada");
  location.href = "index.html";
}

// Preencher info
document.getElementById("infoMedico").textContent = session.medico;
document.getElementById("infoPaciente").textContent = session.paciente;
document.getElementById("infoId").textContent = session.id;
document.getElementById("subTitle").textContent = `${session.paciente} • ${session.medico}`;

// ============================================
// AUDIO CONTEXT
// ============================================

let stream, audioCtx, analyser, srcNode;
let enabled = false;
let recording = false;
let recordedMs = 0;
let audioBuffer = [];
let raf;

const HISTORY = 512;
const overlaySeries = Array(8).fill(null).map(() => new Float32Array(HISTORY));
const silSeries = new Float32Array(HISTORY);
let wIdx = 0;

// Canvas
const cvFft = document.getElementById("cvFft");
const cvSil = document.getElementById("cvSil");
const cvOv = document.getElementById("cvOv");
const ctxF = cvFft.getContext("2d");
const ctxS = cvSil.getContext("2d");
const ctxO = cvOv.getContext("2d");

// ============================================
// CÁLCULOS
// ============================================

function rmsFromTimeDomain(timeData) {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const norm = (timeData[i] - 128) / 128;
    sum += norm * norm;
  }
  const n = timeData.length;
  return Math.sqrt(sum / n);
}

function bandEnergy(freqData, fMin, fMax, sampleRate) {
  const nyquist = sampleRate / 2;
  const binMin = Math.floor((fMin / nyquist) * freqData.length);
  const binMax = Math.floor((fMax / nyquist) * freqData.length);

  let sum = 0, n = 0;
  for (let i = binMin; i < binMax && i < freqData.length; i++) {
    sum += freqData[i];
    n++;
  }
  return n ? (sum / n) / 255 : 0;
}

function sampleOnce(timeData, freqData) {
  const rms = rmsFromTimeDomain(timeData);
  const silence = rms < 0.025 ? 1 : 0;

  // Bandas de frequência
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
  document.getElementById("samples").textContent = audioBuffer.length;

  // Desenhar (com throttle)
  if (audioBuffer.length % 4 === 0) {
    drawFFT(freqData);
    drawSilence();
    drawOverlay();
  }
}

// ============================================
// DESENHAR GRÁFICOS
// ============================================

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
  document.getElementById("status").classList.add("recording");
  log("🔴 Gravação iniciada");
  if (!raf) loop();
});

document.getElementById("btnStop").addEventListener("click", () => {
  recording = false;
  document.getElementById("btnRec").disabled = false;
  document.getElementById("btnStop").disabled = true;
  document.getElementById("status").textContent = "⏸️ Parado";
  document.getElementById("status").classList.remove("recording");
  log(`⏹️ Gravação parada (${audioBuffer.length} amostras)`);
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

  // Salvar dados da sessão
  session.audioBuffer = audioBuffer;
  session.recordedMs = recordedMs;
  session.status = "closed";
  session.closedAt = Date.now();

  const arr = loadSessions();
  const idx = arr.findIndex(s => s.id === session.id);
  if (idx >= 0) arr[idx] = session;
  saveSessions(arr);

  // CRIAR VALIDAÇÃO VAZIA
  const validations = loadValidations();
  const validation = {
    sessionId: sessionId,
    scales: {
      severidade: 0,
      inteligibilidade: 0,
      esforco: 0,
      fluencia: 0,
      pausa: 0
    },
    diagnostic: {
      diagnostico: "",
      confianca: 0,
      recomendacoes: "",
      diferenciais: ""
    },
    clinical: {
      tipo: "",
      compreensao: "",
      repeticao: "",
      nomeacao: "",
      observacoes: ""
    },
    createdAt: Date.now()
  };

  const existingIdx = validations.findIndex(v => v.sessionId === sessionId);
  if (existingIdx !== -1) {
    validations[existingIdx] = validation;
  } else {
    validations.unshift(validation);
  }
  saveValidations(validations);

  log("✅ Sessão finalizada");
  setTimeout(() => {
    location.href = `assinatura.html?id=${encodeURIComponent(sessionId)}`;
  }, 1000);
});

log("✅ session.js carregado");