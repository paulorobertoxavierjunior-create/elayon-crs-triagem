/**
 * SESSION.JS — REFATORADO COM CRS ENGINE
 * PARTE 1/3: Inicialização, Constantes e Setup
 * 
 * Integração completa: Captura → CRS Pipeline → Validação → Armazenamento
 */

// ============================================
// IMPORTS (carregar antes de session.js)
// ============================================
// <script src="../core/crs-engine/temporal-extractor.js"></script>
// <script src="../core/crs-engine/signal-vectorizer.js"></script>
// <script src="../core/crs-engine/cognitive-metrics.js"></script>
// <script src="../core/crs-engine/crs-validator.js"></script>
// <script src="../core/crs-engine/crs-integrator.js"></script>

// ============================================
// CONSTANTES E CONFIGURAÇÃO
// ============================================

const KEY_SESSIONS = "elayon_crs_sessions";
const SESSION_EXPIRE_MS = 30 * 60 * 1000;
const RECORD_MAX_SEC = 5 * 60;
const CRS_LINES = 8;

// ============================================
// UTILITÁRIOS
// ============================================

function getParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function loadSessions() {
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}

function saveSessions(arr) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

function findSession(id) {
  const arr = loadSessions();
  const idx = arr.findIndex(s => s.id === id);
  return { arr, idx, session: idx >= 0 ? arr[idx] : null };
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// ============================================
// INICIALIZAÇÃO DA SESSÃO
// ============================================

const id = getParam("id");
const { arr, idx, session } = findSession(id);

if (!session) {
  alert("Sessão não encontrada. Volte ao Início.");
  location.href = "index.html";
}

// ============================================
// INSTANCIAR CRS INTEGRATOR
// ============================================

const crsIntegrator = new CRSIntegrator({
  sampleRate: 16000,
  silenceThreshold: session.configSnapshot?.silenceThr || 0.025
});

// ============================================
// UI - ELEMENTOS PRINCIPAIS
// ============================================

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

// ============================================
// ESTADO DE ÁUDIO
// ============================================

let audioCtx, analyser, srcNode, stream;
let raf = null;
let enabled = false;
let capturing = false;

const sampleHz = Math.max(1, Math.min(30, Number(session.configSnapshot?.sampleHz || 10)));
const thr = Math.max(0.005, Math.min(0.10, Number(session.configSnapshot?.silenceThr || 0.025)));
const intervalMs = Math.max(40, Math.round(1000 / sampleHz));

// Buffer de áudio para CRS
let audioBuffer = [];
let recordedMs = Math.floor((session.recordedSec || 0) * 1000);
let lastSampleT = 0;

// ============================================
// CANVASES E VISUALIZAÇÃO
// ============================================

const cvFft = document.getElementById("cvFft");
const cvSil = document.getElementById("cvSil");
const cvOv = document.getElementById("cvOv");

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

const ctxF = cvFft.getContext("2d");
const ctxS = cvSil.getContext("2d");
const ctxO = cvOv.getContext("2d");

// Histórico para visualização
const HISTORY = 720;
const overlaySeries = Array.from({ length: CRS_LINES }, () => new Array(HISTORY).fill(0));
const silSeries = new Array(HISTORY).fill(0);
let wIdx = 0;

let fftSum = null;
let fftCount = 0;

// ============================================
// PROCESSAMENTO DE ÁUDIO (HELPER)
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

function pitchProxy(freq, sampleRate) {
  const nyq = sampleRate / 2;
  const from = Math.floor((90 / nyq) * freq.length);
  const to = Math.floor((350 / nyq) * freq.length);
  let max = 0;
  for (let i = from; i <= to; i++) max = Math.max(max, freq[i]);
  return max / 255;
}

// ============================================
// DESENHO DOS CANVASES
// ============================================

function clearPanel(ctx, cv) {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "rgba(245,255,255,1)";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1 * devicePixelRatio;
  for (let i = 1; i < 6; i++) {
    const y = (cv.height / 6) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cv.width, y);
    ctx.stroke();
  }
}

function drawFFT(freq) {
  clearPanel(ctxF, cvFft);
  const barCount = 64;
  const step = Math.max(1, Math.floor(freq.length / barCount));
  const w = cvFft.width / barCount;
  for (let i = 0; i < barCount; i++) {
    const v = freq[i * step] / 255;
    const h = v * (cvFft.height * 0.78);
    ctxF.fillStyle = `rgba(14,165,233,${0.1 + v * 0.35})`;
    ctxF.fillRect(i * w, cvFft.height - h, w * 0.78, h);
    ctxF.fillStyle = `rgba(34,197,94,${0.06 + v * 0.25})`;
    ctxF.fillRect(i * w, cvFft.height - h * 0.45, w * 0.78, h * 0.45);
  }
  if (fftSum && fftCount > 2) {
    ctxF.strokeStyle = "rgba(10,30,40,0.55)";
    ctxF.lineWidth = 2 * devicePixelRatio;
    ctxF.beginPath();
    for (let i = 0; i < barCount; i++) {
      const raw = fftSum[i] / fftCount;
      const v = raw / 255;
      const x = (i / (barCount - 1)) * cvFft.width;
      const y = cvFft.height * 0.9 - v * (cvFft.height * 0.7);
      if (i === 0) ctxF.moveTo(x, y);
      else ctxF.lineTo(x, y);
    }
    ctxF.stroke();
  }
  ctxF.fillStyle = "rgba(0,0,0,0.45)";
  ctxF.font = `${14 * devicePixelRatio}px system-ui`;
  ctxF.fillText(
    `FFT • amostra ${sampleHz}Hz • thr ${thr.toFixed(3)}`,
    12 * devicePixelRatio,
    20 * devicePixelRatio
  );
}

function drawSilence() {
  clearPanel(ctxS, cvSil);
  ctxS.strokeStyle = "rgba(10,30,40,0.55)";
  ctxS.lineWidth = 2 * devicePixelRatio;
  ctxS.beginPath();
  for (let x = 0; x < HISTORY; x++) {
    const idx = (wIdx + x) % HISTORY;
    const v = silSeries[idx];
    const px = (x / (HISTORY - 1)) * cvSil.width;
    const py = cvSil.height * 0.85 - v * (cvSil.height * 0.7);
    if (x === 0) ctxS.moveTo(px, py);
    else ctxS.lineTo(px, py);
  }
  ctxS.stroke();
  ctxS.strokeStyle = "rgba(245,158,11,0.35)";
  ctxS.lineWidth = 2 * devicePixelRatio;
  ctxS.beginPath();
  ctxS.moveTo(0, cvSil.height * 0.5);
  ctxS.lineTo(cvSil.width, cvSil.height * 0.5);
  ctxS.stroke();
  ctxS.fillStyle = "rgba(0,0,0,0.45)";
  ctxS.font = `${14 * devicePixelRatio}px system-ui`;
  ctxS.fillText(
    "Silêncio • 0=falando 1=silêncio",
    12 * devicePixelRatio,
    20 * devicePixelRatio
  );
}

function drawOverlay() {
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
  for (let l = 0; l < CRS_LINES; l++) {
    const yMid = rowH * l + rowH * 0.5;
    const amp = rowH * 0.32;
    ctxO.strokeStyle = "rgba(0,0,0,0.70)";
    ctxO.lineWidth = 2 * devicePixelRatio;
    ctxO.beginPath();
    for (let x = 0; x < HISTORY; x++) {
      const idx = (wIdx + x) % HISTORY;
      const v = overlaySeries[l][idx];
      const px = (x / (HISTORY - 1)) * cvOv.width;
      const py = yMid - (v - 0.5) * 2 * amp;
      if (x === 0) ctxO.moveTo(px, py);
      else ctxO.lineTo(px, py);
    }
    ctxO.stroke();
    ctxO.fillStyle = "rgba(0,0,0,0.42)";
    ctxO.font = `${13 * devicePixelRatio}px system-ui`;
    ctxO.fillText(labels[l], 12 * devicePixelRatio, rowH * l + 18 * devicePixelRatio);
  }
}

// ============================================
// ATUALIZAÇÃO DE KPIs
// ============================================

function updateKPIs() {
  const now = Date.now();
  const left = session.expiresAt - now;
  const leftSec = Math.max(0, Math.floor(left / 1000));
  kpiSess.textContent = `sessão: ${session.id} • expira em ${fmtTime(leftSec)}`;
  kpiRec.textContent = `gravado: ${fmtTime(recordedMs / 1000)} / 05:00`;
  if (left <= 0 && session.status === "active") endSession("expired");
  if (recordedMs >= RECORD_MAX_SEC * 1000) {
    kpiState.textContent = "estado: limite de 5 min atingido";
    btnStart.disabled = true;
    btnPause.disabled = true;
    btnEnd.disabled = false;
  }
}

setInterval(updateKPIs, 250);

// ============================================
// ATIVAR MICROFONE
// ============================================

async function enableMic() {
  try {
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
    iaFala("🎤 Microfone ativado! Pronto para capturar e analisar.", true);
  } catch (e) {
    alert("Falha ao acessar microfone. Verifique permissões.");
  }
}

btnMic.addEventListener("click", enableMic);

// ============================================
// LOOP PRINCIPAL (AMOSTRAGEM E ANÁLISE)
// ============================================

function sampleOnce(timeData, freqData) {
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  const rms = clamp01(rmsFromTimeDomain(timeData) * 3.0);
  const silence = clamp01((thr - rms) / thr);

  const prevMid = overlaySeries[2][(wIdx - 1 + HISTORY) % HISTORY] || 0;
  const prevLong = overlaySeries[3][(wIdx - 1 + HISTORY) % HISTORY] || 0;

  const shortPause = silence;
  const midPause = clamp01(silence * 0.7 + prevMid * 0.3);
  const longPause = clamp01(silence * 0.5 + prevLong * 0.5);

  const pp = clamp01(pitchProxy(freqData, audioCtx.sampleRate));
  const sub = clamp01(bandEnergy(freqData, 20, 60, audioCtx.sampleRate));
  const low = clamp01(bandEnergy(freqData, 60, 250, audioCtx.sampleRate));
  const mid = clamp01(bandEnergy(freqData, 250, 800, audioCtx.sampleRate));
  const high = clamp01(bandEnergy(freqData, 800, 3500, audioCtx.sampleRate));

  // Atualizar séries de overlay (8 dimensões CRS)
  overlaySeries[0][wIdx] = rms;
  overlaySeries[1][wIdx] = shortPause;
  overlaySeries[2][wIdx] = midPause;
  overlaySeries[3][wIdx] = longPause;
  overlaySeries[4][wIdx] = pp;
  overlaySeries[5][wIdx] = sub;
  overlaySeries[6][wIdx] = low;
  overlaySeries[7][wIdx] = high;

  silSeries[wIdx] = silence;

  // Acumular FFT para média
  if (!fftSum) {
    fftSum = new Array(freqData.length).fill(0);
    fftCount = 0;
  }
  for (let i = 0; i < freqData.length; i++) {
    fftSum[i] += freqData[i];
  }
  fftCount++;

  wIdx = (wIdx + 1) % HISTORY;

  // Armazenar no buffer para CRS
  if (capturing) {
    audioBuffer.push({
      timestamp: recordedMs,
      rms: rms,
      silence: silence,
      pitch: pp,
      subgrave: sub,
      graves: low,
      medias: mid,
      altas: high
    });
    recordedMs += intervalMs;
  }

  // Desenhar canvases
  drawFFT(freqData);
  drawSilence();
  drawOverlay();
}

function loop() {
  const timeData = new Uint8Array(analyser.frequencyBinCount);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const now = Date.now();
  if (now - lastSampleT >= intervalMs) {
    sampleOnce(timeData, freqData);
    lastSampleT = now;
  }

  raf = requestAnimationFrame(loop);
}

// ============================================
// CONTROLES DOS BOTÕES
// ============================================

btnStart.addEventListener("click", () => {
  if (!enabled) return alert("Ative o microfone primeiro!");
  capturing = true;
  btnStart.disabled = true;
  btnPause.disabled = false;
  btnEnd.disabled = false;
  kpiState.textContent = "estado: gravando...";
  iaFala("🎙️ Gravação iniciada! Análise em tempo real ativada.", true);
  if (!raf) loop();
});

btnPause.addEventListener("click", () => {
  capturing = false;
  btnStart.disabled = false;
  btnPause.disabled = true;
  kpiState.textContent = "estado: pausado";
  iaFala("⏸️ Gravação pausada. Dados salvos até o momento.");
});

btnEnd.addEventListener("click", () => endSession("manual"));

// ============================================
// FINALIZAÇÃO DA SESSÃO (COM CRS)
// ============================================

function endSession(reason = "ok") {
  capturing = false;
  enabled = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (audioCtx) audioCtx.close();
  if (stream) stream.getTracks().forEach(t => t.stop());

  session.status = "closed";
  session.endedAt = Date.now();
  session.endReason = reason;

  // ============================================
  // PROCESSAR ÁUDIO COM CRS ENGINE
  // ============================================

  if (audioBuffer.length > 0) {
    // Converter buffer para formato esperado pelo CRS
    const temporalVector = {
      timestamps: audioBuffer.map((_, i) => i * intervalMs),
      intervals: audioBuffer.slice(1).map((s, i) => s.timestamp - audioBuffer[i].timestamp),
      pauseIntervals: audioBuffer
        .filter(s => s.silence > thr)
        .map(s => s.timestamp),
      speechIntervals: audioBuffer
        .filter(s => s.silence <= thr)
        .map(s => s.timestamp),
      totalDuration: recordedMs,
      rawEvents: audioBuffer
    };

    // Processar com CRS Integrator
    const crsResult = crsIntegrator.processSession(audioBuffer, {
      sessionId: session.id,
      patientName: session.paciente,
      doctorName: session.medico,
      context: session.contexto
    });

    if (crsResult.valid) {
      // Armazenar CRS na sessão
      session.crsVector = crsResult.crsVector;
      session.crsLabels = crsResult.crsLabels;
      session.cognitiveMetrics = crsResult.cognitiveMetrics;
      session.crsValidation = crsResult.validation;
      session.crsConfidence = crsResult.validation.confidence;
      session.crsReport = crsResult.report;

      // Congelar snapshots dos gráficos
      session.snaps = {
        fft: cvFft.toDataURL("image/png"),
        sil: cvSil.toDataURL("image/png"),
        ov: cvOv.toDataURL("image/png")
      };

      iaFala(
        `✅ Análise CRS concluída! Confiança: ${(crsResult.validation.confidence * 100).toFixed(1)}%`,
        true
      );
    } else {
      iaFala(
        `⚠️ Análise CRS com avisos: ${crsResult.validation.errors.join(", ")}`,
        true
      );
      session.crsValidation = crsResult.validation;
      session.crsConfidence = 0;
    }
  }

  // Calcular métricas resumidas (fallback)
  const sumRms = overlaySeries[0].reduce((a, b) => a + b, 0) / HISTORY;
  const sumPausa = overlaySeries[3].reduce((a, b) => a + b, 0) / HISTORY;
  const sumPitch = overlaySeries[4].reduce((a, b) => a + b, 0) / HISTORY;
  const sumGraves = overlaySeries[6].reduce((a, b) => a + b, 0) / HISTORY;

  session.summary = {
    energiaMedia: sumRms.toFixed(3),
    pausaMedia: sumPausa.toFixed(3),
    pitchMedio: sumPitch.toFixed(3),
    gravesMedio: sumGraves.toFixed(3),
    duracaoSeg: recordedMs / 1000
  };

  arr[idx] = session;
  saveSessions(arr);

  iaFala("✅ Sessão finalizada com sucesso! Redirecionando para o relatório...", true);
  setTimeout(() => (location.href = `report.html?id=${session.id}`), 1500);
}

// ============================================
// IA E CALIBRAÇÃO (MANTÉM IGUAL)
// ============================================

let padraoBase = { energia: null, ritmo: null, pausa: null, clareza: null };
let historicoConfirmado = [];
let etapaAtual = 0;
let dadosCalibracao = [];
let pontosAnalise = [];

const passos = [
  document.getElementById("passo1"),
  document.getElementById("passo2"),
  document.getElementById("passo3")
];
const botoesGrav = [
  document.getElementById("btnGrav1"),
  document.getElementById("btnGrav2"),
  document.getElementById("btnGrav3")
];
const botoesParar = [
  document.getElementById("btnParar1"),
  document.getElementById("btnParar2"),
  document.getElementById("btnParar3")
];
const avaliacoes = [
  document.querySelectorAll("#avalia1 .btn-avalia"),
  document.querySelectorAll("#avalia2 .btn-avalia"),
  document.querySelectorAll("#avalia3 .btn-avalia")
];
const contadores = [
  document.getElementById("c1"),
  document.getElementById("c2"),
  document.getElementById("c3")
];
const historicos = [
  document.getElementById("hist1"),
  document.getElementById("hist2"),
  document.getElementById("hist3")
];
const iaLog = document.getElementById("iaLog");

const metricasBox = document.getElementById("metricasBox");
const mEnergia = document.getElementById("mEnergia");
const mRitmo = document.getElementById("mRitmo");
const mPausa = document.getElementById("mPausa");
const mClareza = document.getElementById("mClareza");
const mComparacao = document.getElementById("mComparacao");

const alertaEsforco = document.getElementById("alertaEsforco");
const alertaConduta = document.getElementById("alertaConduta");

function iaFala(texto, ehConfirmada = false) {
  if (!iaLog) return;
  const el = document.createElement("div");
  el.className = `ia-mensagem ${ehConfirmada ? "confirmada" : ""}`;
  el.textContent = texto;
  iaLog.appendChild(el);
  iaLog.scrollTop = iaLog.scrollHeight;
}

function registrarPonto(etapa, tipo, valor, status) {
  const p = { etapa, tipo, valor, status, hora: new Date().toLocaleTimeString() };
  pontosAnalise.push(p);
  const el = document.createElement("div");
  el.className = "ponto-item";
  el.innerHTML = `<span>${tipo}</span><span>${valor}</span><span>${status}</span>`;
  historicos[etapa].appendChild(el);
}

function atualizarMetricasIA(rms, pitch, pausa, graves) {
  const energia = clamp01(rms * 1.2);
  const ritmo = clamp01(1 - pausa * 0.8);
  const clareza = clamp01(pitch * 0.9 + graves * 0.3);

  if (padraoBase.energia !== null) {
    let difE = ((energia - padraoBase.energia) / padraoBase.energia * 100).toFixed(1);
    let difR = ((ritmo - padraoBase.ritmo) / padraoBase.ritmo * 100).toFixed(1);
    let difP = ((pausa - padraoBase.pausa) / padraoBase.pausa * 100).toFixed(1);
    let difC = ((clareza - padraoBase.clareza) / padraoBase.clareza * 100).toFixed(1);

    let textoComp = `E: ${difE}% | R: ${difR}% | P: ${difP}% | C: ${difC}%`;

    if (metricasBox) metricasBox.style.display = "block";
    if (mEnergia) mEnergia.textContent = `Energia Vocal: ${energia.toFixed(2)}`;
    if (mRitmo) mRitmo.textContent = `Ritmo/Frequência: ${ritmo.toFixed(2)}`;
    if (mPausa) mPausa.textContent = `Índice de Pausa: ${pausa.toFixed(2)}`;
    if (mClareza) mClareza.textContent = `Clareza/Projeção: ${clareza.toFixed(2)}`;
    if (mComparacao) mComparacao.innerHTML = `<strong>Comparação com Padrão:</strong> ${textoComp}`;

    if (alertaEsforco && alertaConduta) {
      if (difE < -15 || difC < -15) {
        alertaConduta.style.display = "block";
        alertaEsforco.style.display = "none";
      } else if (difR > 20 || difE > 25) {
        alertaEsforco.style.display = "block";
        alertaConduta.style.display = "none";
      } else {
        alertaEsforco.style.display = "none";
        alertaConduta.style.display = "none";
      }
    }
  }
}

function analisarSinal(etapa, avaliacaoUsuario) {
  const energia = overlaySeries[0][wIdx] || 0;
  const ritmo = 1 - (overlaySeries[3][wIdx] || 0);
  const pausa = overlaySeries[3][wIdx] || 0;
  const clareza = (overlaySeries[4][wIdx] + overlaySeries[6][wIdx]) / 2 || 0;

  iaFala(
    `🔍 Análise final da amostra ${etapa + 1}: Energia ${energia.toFixed(2)}, Ritmo ${ritmo.toFixed(2)}`
  );

  if (etapa === 0) {
    padraoBase.energia = energia;
    padraoBase.ritmo = ritmo;
    padraoBase.pausa = pausa;
    padraoBase.clareza = clareza;
    registrarPonto(etapa, "Energia", energia.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Ritmo", ritmo.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Pausa", pausa.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Clareza", clareza.toFixed(2), "REFERÊNCIA");
  } else {
    let difE = ((energia - padraoBase.energia) / padraoBase.energia * 100).toFixed(1);
    let difR = ((ritmo - padraoBase.ritmo) / padraoBase.ritmo * 100).toFixed(1);
    let difP = ((pausa - padraoBase.pausa) / padraoBase.pausa * 100).toFixed(1);
    let difC = ((clareza - padraoBase.clareza) / padraoBase.clareza * 100).toFixed(1);

    iaFala(`📊 Comparação Real: Energia ${difE}% | Ritmo ${difR}%`);

    registrarPonto(etapa, "Energia", energia.toFixed(2), `${difE}%`);
    registrarPonto(etapa, "Ritmo", ritmo.toFixed(2), `${difR}%`);
    registrarPonto(etapa, "Pausa", pausa.toFixed(2), `${difP}%`);
    registrarPonto(etapa, "Clareza", clareza.toFixed(2), `${difC}%`);

    if (avaliacaoUsuario.includes("Normal")) {
      padraoBase.energia = (padraoBase.energia + energia) / 2;
      padraoBase.ritmo = (padraoBase.ritmo + ritmo) / 2;
      padraoBase.pausa = (padraoBase.pausa + pausa) / 2;
      padraoBase.clareza = (padraoBase.clareza + clareza) / 2;
      iaFala(`💾 Perfeito! Atualizei o padrão com essa amostra.`);
    }
  }
}

// Controle das avaliações
if (avaliacoes) {
  avaliacoes.forEach((grupo, idx) => {
    grupo.forEach(btn => {
      btn.addEventListener("click", () => {
        grupo.forEach(b => b.classList.remove("selecionado"));
        btn.classList.add("selecionado");
        dadosCalibracao[idx] = btn.textContent;
        if (contadores[idx]) contadores[idx].textContent = `(concluído: ${btn.textContent})`;

        analisarSinal(idx, btn.textContent);

        if (idx < 2 && passos[idx] && passos[idx + 1] && botoesGrav[idx + 1]) {
          passos[idx].classList.remove("ativo");
          passos[idx + 1].classList.add("ativo");
          botoesGrav[idx + 1].disabled = false;
          etapaAtual = idx + 1;
          iaFala(`➡️ Pronto para a próxima etapa!`);
        } else if (idx === 2) {
          passos[idx].classList.remove("ativo");
          const areaFifo = document.getElementById("areaFifo");
          if (areaFifo) areaFifo.style.display = "block";
          iaFala(`🎉 Calibração concluída!`, true);
          inicializarFifo();
        }
      });
    });
  });
}

// Ações dos botões de gravação
if (botoesGrav && botoesParar) {
  botoesGrav.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      if (!enabled) {
        iaFala("⚠️ Ative o microfone primeiro!");
        return;
      }
      btn.disabled = true;
      botoesParar[idx].disabled = false;
      if (contadores[idx]) contadores[idx].textContent = "(🔴 GRAVANDO...)";
      if (!capturing) {
        capturing = true;
        btnStart.disabled = true;
        btnPause.disabled = false;
        kpiState.textContent = "estado: gravando...";
        if (!raf) loop();
      }
    });
  });

  botoesParar.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      btn.disabled = true;
      capturing = false;
      btnStart.disabled = false;
      btnPause.disabled = true;
      kpiState.textContent = "estado: pausado";
      if (contadores[idx]) contadores[idx].textContent = "(✅ Gravação salva.)";
      iaFala(`🛑 Gravação finalizada. Avalie abaixo.`);
    });
  });
}

// Mensagem inicial
iaFala("🤖 Sistema pronto! Clique em **Ativar Microfone** acima.", true);