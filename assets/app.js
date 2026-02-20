ELAYON.requireConnection();

const KEY_SESSIONS = "elayon_crs_sessions";
const KEY_DOC = "elayon_demo_doctor";
const KEY_CONFIG = "elayon_crs_config";

const MAX_REPORTS = 10;
const SESSION_EXPIRE_MIN = 30;
const RECORD_MAX_SEC = 5 * 60;

const PRESETS = [
  {
    id: "afasia",
    name: "Afasia (demo)",
    questions: [
      "Diga seu nome completo e idade.",
      "Descreva o que você fez hoje pela manhã.",
      "Repita: 'Hoje eu acordei cedo e respirei fundo antes de falar.'",
      "Nomeie 5 objetos que você vê ao redor."
    ]
  },
  {
    id: "pos_avc",
    name: "Pós-AVC (demo)",
    questions: [
      "Conte um fato simples do seu dia (20–30s).",
      "Leia lentamente uma frase curta.",
      "Conte de 1 a 20 em voz alta.",
      "Descreva como está sua fala hoje."
    ]
  },
  {
    id: "ansiedade",
    name: "Ansiedade/Respiração (fala) (demo)",
    questions: [
      "Respire fundo 3 vezes e descreva como se sente.",
      "Fale sobre uma situação que te deixou tenso (20–30s).",
      "Leia um texto curto em ritmo confortável."
    ]
  },
  {
    id: "livre",
    name: "Protocolo Geral (demo)",
    questions: [
      "Conte em 30s a sua principal queixa.",
      "Repita uma frase padrão.",
      "Descreva seu estado geral hoje."
    ]
  }
];

function loadSessions(){
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}
function saveSessions(arr){
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}
function closedReportsCount(){
  const arr = loadSessions();
  return arr.filter(s => s.status === "closed").length;
}

function getConfig(){
  try{
    const raw = localStorage.getItem(KEY_CONFIG);
    if(raw) return JSON.parse(raw);
  }catch{}
  return { sampleHz: 10, silenceThr: 0.025, hint: "Config padrão (demo)." };
}

function getDoctor(){
  try{
    const raw = localStorage.getItem(KEY_DOC);
    if(raw) return JSON.parse(raw);
  }catch{}
  return null;
}

function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

// UI
const elMed = document.getElementById("medico");
const elPac = document.getElementById("paciente");
const elCtx = document.getElementById("contexto");
const elPreset = document.getElementById("preset");
const pillReports = document.getElementById("pillReports");

function fillPreset(){
  elPreset.innerHTML = PRESETS.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");
}
fillPreset();

(function prefillDoctor(){
  const d = getDoctor();
  if(d && elMed && !elMed.value){
    const label = `${d.name} • CRM ${d.crm}/${d.uf}`;
    elMed.value = label;
  }
})();

function updatePill(){
  const n = closedReportsCount();
  pillReports.textContent = `Relatórios: ${n}/${MAX_REPORTS}`;
  pillReports.classList.toggle("warn", n >= MAX_REPORTS);
}
updatePill();

document.getElementById("btnLimpar").addEventListener("click", ()=>{
  elMed.value = "";
  elPac.value = "";
  elCtx.value = "";
  elPreset.value = PRESETS[0].id;
});

document.getElementById("btnIniciar").addEventListener("click", ()=>{
  const n = closedReportsCount();
  if(n >= MAX_REPORTS){
    alert(`Limite atingido (${MAX_REPORTS}/${MAX_REPORTS}). Exclua relatórios para continuar.`);
    location.href = "report.html";
    return;
  }

  const medico = (elMed.value || "").trim();
  const paciente = (elPac.value || "").trim();
  const contexto = (elCtx.value || "").trim();
  const presetId = elPreset.value;

  if(!medico || !paciente){
    alert("Preencha Médico e Paciente.");
    return;
  }

  const cfg = getConfig();
  const preset = PRESETS.find(p=>p.id===presetId) || PRESETS[0];

  const now = Date.now();
  const session = {
    id: uid(),
    medico,
    paciente,
    contexto,
    presetId: preset.id,
    presetName: preset.name,
    questions: preset.questions,
    start: now,
    expiresAt: now + SESSION_EXPIRE_MIN*60*1000,
    status: "active",
    configSnapshot: {
      sampleHz: cfg.sampleHz ?? 10,
      silenceThr: cfg.silenceThr ?? 0.025,
      hint: cfg.hint ?? ""
    },
    recordMaxSec: RECORD_MAX_SEC,
    recordedSec: 0,
    // evidência e sumário serão preenchidos na session.js
    summary: null,
    snaps: null,
    dx: ""
  };

  const arr = loadSessions();
  arr.unshift(session);
  saveSessions(arr);

  location.href = `session.html?id=${encodeURIComponent(session.id)}`;
});