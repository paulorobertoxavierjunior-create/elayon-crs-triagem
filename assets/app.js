const KEY_CONFIG = "elayon_crs_config";
const KEY_SESSIONS = "elayon_crs_sessions";

function uid() {
  return "S" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    sessionMinutes: 30,
    sampleHz: 10,
    notes: "Config padrão (demo)."
  };
}

function saveSession(session) {
  const arr = JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
  arr.unshift(session);
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

document.getElementById("btnIniciar")?.addEventListener("click", () => {
  const medico = (document.getElementById("medico").value || "").trim();
  const paciente = (document.getElementById("paciente").value || "").trim();
  const contexto = (document.getElementById("contexto").value || "").trim();

  if (!medico || !paciente) {
    alert("Preencha Médico e Paciente.");
    return;
  }

  const cfg = loadConfig();
  const id = uid();
  const start = Date.now();
  const expiresAt = start + (cfg.sessionMinutes || 30) * 60 * 1000;

  const session = {
    id,
    medico,
    paciente,
    contexto,
    start,
    expiresAt,
    status: "active",
    metrics: [],
    summary: null,
    configSnapshot: cfg
  };

  saveSession(session);
  location.href = `session.html?id=${encodeURIComponent(id)}`;
});

document.getElementById("btnLimpar")?.addEventListener("click", () => {
  document.getElementById("medico").value = "";
  document.getElementById("paciente").value = "";
  document.getElementById("contexto").value = "";
});