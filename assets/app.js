// assets/app.js
const STORE_KEYS = {
  doctor: "elayon_doctor_v1",
  sessions: "elayon_sessions_v1",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getDoctor() {
  return loadJSON(STORE_KEYS.doctor, null);
}

export function setDoctor(doc) {
  saveJSON(STORE_KEYS.doctor, doc);
}

export function clearDoctor() {
  localStorage.removeItem(STORE_KEYS.doctor);
}

export function getSessions() {
  return loadJSON(STORE_KEYS.sessions, []);
}

export function addSession(sess) {
  const all = getSessions();
  all.unshift(sess);
  saveJSON(STORE_KEYS.sessions, all.slice(0, 25));
}

export function updateSession(id, patch) {
  const all = getSessions();
  const idx = all.findIndex(s => s.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    saveJSON(STORE_KEYS.sessions, all);
  }
}

export function mustHaveDoctorOrRedirect() {
  const doc = getDoctor();
  if (!doc) window.location.href = "./index.html";
  return doc;
}

// --- áudio (demo local) ---
let audioCtx = null;
let analyser = null;
let source = null;
let mediaStream = null;
let rafId = null;

export async function initMic() {
  // Força gesto do usuário (click) na chamada
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source = audioCtx.createMediaStreamSource(mediaStream);
  source.connect(analyser);
  return { audioCtx, analyser };
}

export function stopMic() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  if (source) { try { source.disconnect(); } catch {} }
  source = null;

  if (audioCtx) { try { audioCtx.close(); } catch {} }
  audioCtx = null;

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
  }
  mediaStream = null;
  analyser = null;
}

export function drawWaveform(canvas, onMetrics) {
  if (!analyser) throw new Error("Mic não inicializado");
  const ctx = canvas.getContext("2d");
  const bufferLen = analyser.fftSize;
  const data = new Uint8Array(bufferLen);

  function frame() {
    analyser.getByteTimeDomainData(data);

    // métricas simples (demo): energia RMS aproximada e "silêncio" (limiar)
    let sum = 0;
    let silentCount = 0;
    for (let i = 0; i < bufferLen; i++) {
      const v = (data[i] - 128) / 128; // -1..1
      sum += v * v;
      if (Math.abs(v) < 0.02) silentCount++;
    }
    const rms = Math.sqrt(sum / bufferLen);
    const silenceRatio = silentCount / bufferLen;

    // render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.beginPath();

    const w = canvas.width;
    const h = canvas.height;
    const slice = w / bufferLen;

    let x = 0;
    for (let i = 0; i < bufferLen; i++) {
      const y = (data[i] / 255) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.stroke();

    if (typeof onMetrics === "function") {
      onMetrics({ rms, silenceRatio });
    }

    rafId = requestAnimationFrame(frame);
  }

  // garante tamanho real do canvas
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width));
  canvas.height = Math.max(160, Math.floor(rect.height));

  frame();
}