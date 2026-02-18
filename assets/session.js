const KEY_SESSIONS = "elayon_crs_sessions";

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

const id = getParam("id");
const { arr, idx, session } = findSession(id);

const subTitle = document.getElementById("subTitle");
const kpiTimer = document.getElementById("kpiTimer");
const kpiState = document.getElementById("kpiState");
const kpiLevel = document.getElementById("kpiLevel");

const btnMic = document.getElementById("btnMic");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnEnd = document.getElementById("btnEnd");

const canvas = document.getElementById("cv");
const ctx = canvas.getContext("2d");

function resize(){
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.floor(r.width * devicePixelRatio);
  canvas.height = Math.floor(220 * devicePixelRatio);
}
addEventListener("resize", resize);
resize();

if (!session) {
  alert("Sessão não encontrada. Volte ao Início.");
  location.href = "index.html";
}

subTitle.textContent = `Médico: ${session.medico} • Paciente: ${session.paciente}`;

let audioCtx, analyser, srcNode, stream;
let dataArray;
let raf = null;
let capturing = false;

const SAMPLE_EVERY_MS = Math.max(100, Math.floor(1000 / (session.configSnapshot?.sampleHz || 10)));
let lastSample = 0;

function fmt(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

function updateTimer(){
  const now = Date.now();
  const left = session.expiresAt - now;

  kpiTimer.textContent = `tempo: ${fmt(now - session.start)} • rest: ${fmt(left)}`;

  if (left <= 0 && session.status === "active") {
    endSession("expired");
  }
}
setInterval(updateTimer, 300);

function levelFromFFT(){
  analyser.getByteTimeDomainData(dataArray);
  // RMS aproximado
  let sum = 0;
  for (let i=0;i<dataArray.length;i++){
    const v = (dataArray[i]-128)/128;
    sum += v*v;
  }
  const rms = Math.sqrt(sum/dataArray.length);
  return rms;
}

function drawFrame(){
  if (!capturing) return;

  const now = performance.now();

  // fundo
  ctx.clearRect(0,0,canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0,0,canvas.width, canvas.height);

  // eixo
  ctx.strokeStyle = "rgba(10,30,40,0.12)";
  ctx.lineWidth = 1 * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height*0.5);
  ctx.lineTo(canvas.width, canvas.height*0.5);
  ctx.stroke();

  // “espectro” simples: barras por frequência
  const freq = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freq);

  const barCount = 64;
  const step = Math.floor(freq.length / barCount);
  const w = canvas.width / barCount;

  for (let i=0;i<barCount;i++){
    const v = freq[i*step] / 255;
    const h = v * (canvas.height*0.65);

    // cor suave (ciano→verde) via alpha
    ctx.fillStyle = `rgba(14,165,233,${0.10 + v*0.25})`;
    ctx.fillRect(i*w, canvas.height - h, w*0.78, h);

    ctx.fillStyle = `rgba(34,197,94,${0.08 + v*0.20})`;
    ctx.fillRect(i*w, canvas.height - h*0.55, w*0.78, h*0.55);
  }

  // linha temporal (últimos pontos)
  const m = session.metrics || [];
  const maxPts = Math.min(m.length, 180);
  if (maxPts > 2) {
    ctx.strokeStyle = "rgba(10,30,40,0.55)";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    for (let i=0;i<maxPts;i++){
      const p = m[m.length - maxPts + i];
      const x = (i/(maxPts-1)) * canvas.width;
      const y = canvas.height*0.15 + (1 - Math.min(1, p.rms*2.2)) * (canvas.height*0.30);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }

  // amostragem métrica
  if (now - lastSample >= SAMPLE_EVERY_MS) {
    const rms = levelFromFFT();
    const ts = Date.now();

    // pausa heurística: rms muito baixo
    const isPause = rms < 0.02;

    session.metrics.push({ ts, rms, pause: isPause ? 1 : 0 });

    // salva em storage a cada amostra
    arr[idx] = session;
    saveSessions(arr);

    kpiLevel.textContent = `nível: ${rms.toFixed(4)}`;
    lastSample = now;
  }

  raf = requestAnimationFrame(drawFrame);
}

async function enableMic(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.fftSize);

    srcNode = audioCtx.createMediaStreamSource(stream);
    srcNode.connect(analyser);

    kpiState.textContent = "estado: microfone ok";
    btnStart.disabled = false;
  }catch(e){
    alert("Falha ao acessar microfone. Verifique permissões do navegador.");
  }
}

function start(){
  if (!analyser) return;
  capturing = true;
  kpiState.textContent = "estado: captando";
  btnStart.disabled = true;
  btnStop.disabled = false;
  raf = requestAnimationFrame(drawFrame);
}

function stop(){
  capturing = false;
  kpiState.textContent = "estado: pausado";
  btnStart.disabled = false;
  btnStop.disabled = true;
  if (raf) cancelAnimationFrame(raf);
}

function summarize(){
  const m = session.metrics || [];
  const total = m.length || 1;
  const avg = m.reduce((a,b)=>a+b.rms,0)/total;
  const pauseRatio = m.reduce((a,b)=>a+b.pause,0)/total;

  // variação (simples)
  let varSum=0;
  for (let i=1;i<m.length;i++){
    varSum += Math.abs(m[i].rms - m[i-1].rms);
  }
  const variability = m.length>1 ? varSum/(m.length-1) : 0;

  return {
    samples: m.length,
    avgRms: avg,
    pauseRatio,
    variability
  };
}

function endSession(reason="ended"){
  stop();

  session.status = "closed";
  session.closedAt = Date.now();
  session.closeReason = reason;
  session.summary = summarize();

  arr[idx] = session;
  saveSessions(arr);

  // limpa mic
  try{ stream?.getTracks()?.forEach(t=>t.stop()); }catch{}
  try{ audioCtx?.close(); }catch{}

  location.href = `report.html?id=${encodeURIComponent(session.id)}`;
}

btnMic.addEventListener("click", enableMic);
btnStart.addEventListener("click", start);
btnStop.addEventListener("click", stop);
btnEnd.addEventListener("click", ()=>endSession("manual"));