/**
 * APP.JS — REFATORADO COM CRS + CLINICAL VALIDATION
 * PARTE 1: Inicialização, Constantes e Setup
 * 
 * Integração completa: CRS Engine + Validação Clínica + Novas Rotas
 */

// ============================================
// IMPORTS (carregar antes de app.js)
// ============================================
// <script src="../core/crs-engine/temporal-extractor.js"></script>
// <script src="../core/crs-engine/signal-vectorizer.js"></script>
// <script src="../core/crs-engine/cognitive-metrics.js"></script>
// <script src="../core/crs-engine/crs-validator.js"></script>
// <script src="../core/crs-engine/crs-integrator.js"></script>
// <script src="../core/clinical-validation/neurologist-assessment.js"></script>
// <script src="../core/clinical-validation/correlation-engine.js"></script>
// <script src="../core/clinical-validation/statistical-report.js"></script>

// ============================================
// CONSTANTES E CONFIGURAÇÃO
// ============================================

const KEY_SESSIONS = "elayon_crs_sessions";
const KEY_DOC = "elayon_demo_doctor";
const KEY_CONFIG = "elayon_crs_config";

const MAX_REPORTS = 10;
const SESSION_EXPIRE_MIN = 30;
const RECORD_MAX_SEC = 5 * 60;

// ============================================
// PRESETS CLÍNICOS (EXPANDIDO COM CRS)
// ============================================

const PRESETS = [
  {
    id: "afasia",
    name: "Afasia (CRS + Validação)",
    category: "neurologia",
    description: "Triagem de afasia com análise temporal cognitiva",
    questions: [
      "Diga seu nome completo e idade.",
      "Descreva o que você fez hoje pela manhã.",
      "Repita: 'Hoje eu acordei cedo e respirei fundo antes de falar.'",
      "Nomeie 5 objetos que você vê ao redor."
    ],
    crsEnabled: true,
    validationEnabled: true,
    estimatedDurationMin: 8
  },
  {
    id: "pos_avc",
    name: "Pós-AVC (CRS + Validação)",
    category: "neurologia",
    description: "Avaliação pós-acidente vascular cerebral",
    questions: [
      "Conte um fato simples do seu dia (20–30s).",
      "Leia lentamente uma frase curta.",
      "Conte de 1 a 20 em voz alta.",
      "Descreva como está sua fala hoje."
    ],
    crsEnabled: true,
    validationEnabled: true,
    estimatedDurationMin: 10
  },
  {
    id: "ansiedade",
    name: "Ansiedade/Respiração (CRS + Validação)",
    category: "psiquiatria",
    description: "Avaliação de padrões respiratórios e fala em ansiedade",
    questions: [
      "Respire fundo 3 vezes e descreva como se sente.",
      "Fale sobre uma situação que te deixou tenso (20–30s).",
      "Leia um texto curto em ritmo confortável."
    ],
    crsEnabled: true,
    validationEnabled: true,
    estimatedDurationMin: 7
  },
  {
    id: "livre",
    name: "Protocolo Geral (CRS)",
    category: "geral",
    description: "Protocolo customizável com análise CRS",
    questions: [
      "Conte em 30s a sua principal queixa.",
      "Repita uma frase padrão.",
      "Descreva seu estado geral hoje."
    ],
    crsEnabled: true,
    validationEnabled: false,
    estimatedDurationMin: 5
  }
];

// ============================================
// UTILITÁRIOS
// ============================================

function loadSessions() {
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}

function saveSessions(arr) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

function closedReportsCount() {
  const arr = loadSessions();
  return arr.filter(s => s.status === "closed").length;
}

function getConfig() {
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    sampleHz: 10,
    silenceThr: 0.025,
    hint: "Config padrão (demo)."
  };
}

function getDoctor() {
  try {
    const raw = localStorage.getItem(KEY_DOC);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

// ============================================
// ELEMENTOS DOM
// ============================================

const elMed = document.getElementById("medico");
const elPac = document.getElementById("paciente");
const elCtx = document.getElementById("contexto");
const elPreset = document.getElementById("preset");
const pillReports = document.getElementById("pillReports");

const btnLimpar = document.getElementById("btnLimpar");
const btnIniciar = document.getElementById("btnIniciar");
const btnValidacao = document.getElementById("btnValidacao");
const btnDashboard = document.getElementById("btnDashboard");

// ============================================
// PREENCHIMENTO DE PRESETS
// ============================================

function fillPreset() {
  elPreset.innerHTML = PRESETS.map(p => {
    return `<option value="${p.id}" data-category="${p.category}" title="${p.description}">
      ${p.name}
    </option>`;
  }).join("");
}

fillPreset();

// ============================================
// PREENCHIMENTO AUTOMÁTICO DE MÉDICO
// ============================================

(function prefillDoctor() {
  const d = getDoctor();
  if (d && elMed && !elMed.value) {
    const label = `${d.name} • CRM ${d.crm}/${d.uf}`;
    elMed.value = label;
  }
})();

// ============================================
// ATUALIZAÇÃO DE PILL (CONTADOR DE RELATÓRIOS)
// ============================================

function updatePill() {
  const n = closedReportsCount();
  pillReports.textContent = `Relatórios: ${n}/${MAX_REPORTS}`;
  pillReports.classList.toggle("warn", n >= MAX_REPORTS);

  if (n >= MAX_REPORTS) {
    btnIniciar.disabled = true;
    btnIniciar.title = `Limite atingido (${MAX_REPORTS}/${MAX_REPORTS}). Exclua relatórios para continuar.`;
  } else {
    btnIniciar.disabled = false;
    btnIniciar.title = "Iniciar nova sessão de análise CRS";
  }
}

updatePill();

// ============================================
// EVENTOS DOS BOTÕES
// ============================================

if (btnLimpar) {
  btnLimpar.addEventListener("click", () => {
    elMed.value = "";
    elPac.value = "";
    elCtx.value = "";
    elPreset.value = PRESETS[0].id;
  });
}

if (btnIniciar) {
  btnIniciar.addEventListener("click", () => {
    const n = closedReportsCount();
    if (n >= MAX_REPORTS) {
      alert(`Limite atingido (${MAX_REPORTS}/${MAX_REPORTS}). Exclua relatórios para continuar.`);
      location.href = "report.html";
      return;
    }

    const medico = (elMed.value || "").trim();
    const paciente = (elPac.value || "").trim();
    const contexto = (elCtx.value || "").trim();
    const presetId = elPreset.value;

    if (!medico || !paciente) {
      alert("Preencha Médico e Paciente.");
      return;
    }

    const cfg = getConfig();
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];

    const now = Date.now();
    const session = {
      id: uid(),
      medico,
      paciente,
      contexto,
      presetId: preset.id,
      presetName: preset.name,
      questions: preset.questions,
      category: preset.category,
      crsEnabled: preset.crsEnabled,
      validationEnabled: preset.validationEnabled,
      estimatedDurationMin: preset.estimatedDurationMin,
      start: now,
      expiresAt: now + SESSION_EXPIRE_MIN * 60 * 1000,
      status: "active",
      configSnapshot: {
        sampleHz: cfg.sampleHz ?? 10,
        silenceThr: cfg.silenceThr ?? 0.025,
        hint: cfg.hint ?? ""
      },
      recordMaxSec: RECORD_MAX_SEC,
      recordedSec: 0,
      // CRS embedado
      crsVector: null,
      crsLabels: null,
      cognitiveMetrics: null,
      crsValidation: null,
      crsConfidence: 0,
      crsReport: null,
      // Validação clínica
      assessment: null,
      assessmentId: null,
      // Sumário
      summary: null,
      snaps: null,
      dx: ""
    };

    const arr = loadSessions();
    arr.unshift(session);
    saveSessions(arr);

    location.href = `session.html?id=${encodeURIComponent(session.id)}`;
  });
}

// ============================================
// NOVOS BOTÕES: VALIDAÇÃO E DASHBOARD
// ============================================

if (btnValidacao) {
  btnValidacao.addEventListener("click", () => {
    location.href = "clinical-validation.html";
  });
}

if (btnDashboard) {
  btnDashboard.addEventListener("click", () => {
    location.href = "crs-dashboard.html";
  });
}

// ============================================
// EXIBIÇÃO DE INFORMAÇÕES DO PRESET
// ============================================

if (presetInfo) {
  presetInfo.addEventListener("click", () => {
    const presetId = elPreset.value;
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];

    let info = `
📋 PRESET: ${preset.name}

Categoria: ${preset.category}
Descrição: ${preset.description}
Duração Estimada: ${preset.estimatedDurationMin} minutos

Análise CRS: ${preset.crsEnabled ? "✅ Ativada" : "❌ Desativada"}
Validação Clínica: ${preset.validationEnabled ? "✅ Ativada" : "❌ Desativada"}

Questões do Protocolo:
${preset.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
    `;

    alert(info);
  });
}

// ============================================
// MONITORAMENTO DE SESSÕES ATIVAS
// ============================================

function updateActiveSessionsCount() {
  const arr = loadSessions();
  const active = arr.filter(s => s.status === "active").length;
  const closed = arr.filter(s => s.status === "closed").length;

  if (statsActive) {
    statsActive.textContent = `Sessões Ativas: ${active}`;
  }
  if (statsClosed) {
    statsClosed.textContent = `Relatórios Fechados: ${closed}/${MAX_REPORTS}`;
  }
}

updateActiveSessionsCount();
setInterval(updateActiveSessionsCount, 5000);

// ============================================
// NAVEGAÇÃO PARA NOVAS ROTAS
// ============================================

const btnValidacao = document.getElementById("btnValidacao");
const btnDashboard = document.getElementById("btnDashboard");
const btnRelatorios = document.getElementById("btnRelatorios");

if (btnValidacao) {
  btnValidacao.addEventListener("click", () => {
    location.href = "clinical-validation.html";
  });
}

if (btnDashboard) {
  btnDashboard.addEventListener("click", () => {
    location.href = "crs-dashboard.html";
  });
}

if (btnRelatorios) {
  btnRelatorios.addEventListener("click", () => {
    location.href = "report.html";
  });
}

// ============================================
// HISTÓRICO DE SESSÕES RECENTES
// ============================================

function displayRecentSessions() {
  const arr = loadSessions();
  const recent = arr.slice(0, 5);
  const container = document.getElementById("recentSessions");

  if (!container) return;

  if (recent.length === 0) {
    container.innerHTML = `<p class="muted">Nenhuma sessão registrada.</p>`;
    return;
  }

  container.innerHTML = recent
    .map(s => {
      const status = s.status === "closed" ? "✅ Fechada" : "🔴 Ativa";
      const crsStatus = s.crsVector ? "✅ CRS" : "⚠️ Heurístico";
      const startTime = new Date(s.start).toLocaleTimeString("pt-BR");

      return `
        <div class="card soft" style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${s.medico} → ${s.paciente}</strong><br/>
              <small class="muted">${startTime} • ${s.presetName}</small>
            </div>
            <div style="text-align: right;">
              <div>${status}</div>
              <small>${crsStatus}</small>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

displayRecentSessions();

// ============================================
// VERIFICAÇÃO DE COMPATIBILIDADE
// ============================================

(function checkCompatibility() {
  const warnings = [];

  if (!localStorage) {
    warnings.push("⚠️ LocalStorage não disponível. Sessões não serão salvas.");
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    warnings.push("⚠️ Acesso a microfone não disponível. Gravação desabilitada.");
  }

  if (!window.AudioContext && !window.webkitAudioContext) {
    warnings.push("⚠️ Web Audio API não suportada. Análise CRS desabilitada.");
  }

  if (warnings.length > 0) {
    const warningDiv = document.getElementById("compatibilityWarnings");
    if (warningDiv) {
      warningDiv.innerHTML = warnings.map(w => `<p style="color: #f59e0b;">${w}</p>`).join("");
      warningDiv.style.display = "block";
    }
  }
})();

// ============================================
// SUGESTÕES E DICAS
// ============================================

(function initTips() {
  const tips = [
    "💡 Use fones de ouvido para melhor qualidade de áudio.",
    "💡 Escolha um ambiente com pouco ruído de fundo.",
    "💡 Verifique se o microfone está funcionando antes de iniciar.",
    "💡 Siga as instruções do protocolo clínico selecionado.",
    "💡 Salve os relatórios regularmente para não perder dados.",
    "💡 Use a validação clínica para correlacionar com CRS.",
    "💡 Consulte o dashboard para acompanhar a validação."
  ];

  const tipElement = document.getElementById("dailyTip");
  if (tipElement) {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    tipElement.textContent = randomTip;
  }
})();

// ============================================
// VERSÃO E INFORMAÇÕES DO SISTEMA
// ============================================

(function displaySystemInfo() {
  const version = "2.0.0-CRS";
  const buildDate = "2026-06";
  const infoElement = document.getElementById("systemInfo");

  if (infoElement) {
    infoElement.innerHTML = `
      <small class="muted">
        Elayon Health v${version} • Build ${buildDate} • CRS Engine Integrado
      </small>
    `;
  }
})();

// ============================================
// FINALIZAÇÃO
// ============================================

console.log("✅ APP.JS carregado com sucesso");
console.log("📊 CRS Engine integrado");
console.log("🔬 Clinical Validation disponível");
console.log("📈 Dashboard de correlações ativo");