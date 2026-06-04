/**
 * VALIDATION.JS — FASE 2 + FASE 3
 * Avaliação clínica estruturada + Botão para Dashboard
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

function saveValidations(arr) {
  localStorage.setItem(KEY_VALIDATIONS, JSON.stringify(arr));
}

function formatDate(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}

function formatDuration(ms) {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function showAlert(message, type = "info") {
  const alert = document.createElement("div");
  alert.className = `alert ${type}`;
  alert.textContent = message;
  alertContainer.appendChild(alert);
  
  setTimeout(() => alert.remove(), 4000);
}

// ============================================
// ELEMENTOS DOM
// ============================================

const sessionSelect = document.getElementById("sessionSelect");
const formSection = document.getElementById("formSection");
const sessionInfo = document.getElementById("sessionInfo");
const summarySection = document.getElementById("summarySection");
const alertContainer = document.getElementById("alertContainer");

const btnSalvar = document.getElementById("btnSalvar");
const btnDashboard = document.getElementById("btnDashboard");
const btnLimpar = document.getElementById("btnLimpar");
const btnVoltar = document.getElementById("btnVoltar");

let currentSession = null;

// ============================================
// CARREGAR SESSÕES
// ============================================

function loadSessionsToSelect() {
  const sessions = loadSessions();
  const closed = sessions.filter(s => s.status === "closed");

  sessionSelect.innerHTML = closed.length === 0
    ? '<option value="">-- Nenhuma sessão disponível --</option>'
    : [
        '<option value="">-- Selecionar sessão --</option>',
        ...closed.map(s => `<option value="${s.id}">${s.medico} → ${s.paciente} (${formatDate(s.start)})</option>`)
      ].join("");
}

loadSessionsToSelect();

// ============================================
// SELECIONAR SESSÃO
// ============================================

sessionSelect.addEventListener("change", (e) => {
  const sessionId = e.target.value;
  if (!sessionId) {
    formSection.style.display = "none";
    sessionInfo.style.display = "none";
    btnDashboard.style.display = "none";
    return;
  }

  const sessions = loadSessions();
  currentSession = sessions.find(s => s.id === sessionId);

  if (currentSession) {
    // Mostrar info
    document.getElementById("infoMedico").textContent = currentSession.medico;
    document.getElementById("infoPaciente").textContent = currentSession.paciente;
    document.getElementById("infoData").textContent = formatDate(currentSession.start);
    document.getElementById("infoDuracao").textContent = formatDuration(currentSession.closedAt - currentSession.start);
    sessionInfo.style.display = "block";

    // Mostrar formulário
    formSection.style.display = "block";
    alertContainer.innerHTML = '';

    // Carregar validação anterior se existir
    const validations = loadValidations();
    const existing = validations.find(v => v.sessionId === sessionId);
    if (existing) {
      loadValidationToForm(existing);
      showAlert("⚠️ Validação anterior carregada. Você pode editar.", "info");
      btnDashboard.style.display = "block";
    } else {
      btnDashboard.style.display = "none";
    }
  }
});

// ============================================
// CARREGAR VALIDAÇÃO NO FORMULÁRIO
// ============================================

function loadValidationToForm(validation) {
  document.getElementById("scaleSeveridade").value = validation.scales.severidade || 0;
  document.getElementById("scaleInteligibilidade").value = validation.scales.inteligibilidade || 10;
  document.getElementById("scaleEsforco").value = validation.scales.esforco || 0;
  document.getElementById("scaleFluencia").value = validation.scales.fluencia || 10;
  document.getElementById("scalePausa").value = validation.scales.pausa || 0;

  document.getElementById("tipoAfasia").value = validation.qualitative.tipoAfasia || "";
  document.getElementById("compreensao").value = validation.qualitative.compreensao || "";
  document.getElementById("repeticao").value = validation.qualitative.repeticao || "";
  document.getElementById("nomeacao").value = validation.qualitative.nomeacao || "";

  // Checkboxes
  if (validation.qualitative.caracteristicas) {
    Object.entries(validation.qualitative.caracteristicas).forEach(([key, checked]) => {
      const el = document.getElementById(`char_${key}`);
      if (el) el.checked = checked;
    });
  }

  document.getElementById("diagnostico").value = validation.diagnostic.diagnostico || "";
  document.getElementById("confianca").value = validation.diagnostic.confianca || 50;
  document.getElementById("diferenciais").value = validation.diagnostic.diferenciais || "";
  document.getElementById("recomendacoes").value = validation.diagnostic.recomendacoes || "";
  document.getElementById("observacoes").value = validation.clinical.observacoes || "";
}

// ============================================
// SALVAR AVALIAÇÃO
// ============================================

btnSalvar.addEventListener("click", () => {
  if (!currentSession) {
    showAlert("❌ Selecione uma sessão primeiro", "error");
    return;
  }

  // Coletar dados
  const validation = {
    id: `val_${Date.now()}`,
    sessionId: currentSession.id,
    medico: currentSession.medico,
    paciente: currentSession.paciente,
    createdAt: Date.now(),
    scales: {
      severidade: parseInt(document.getElementById("scaleSeveridade").value) || 0,
      inteligibilidade: parseInt(document.getElementById("scaleInteligibilidade").value) || 10,
      esforco: parseInt(document.getElementById("scaleEsforco").value) || 0,
      fluencia: parseInt(document.getElementById("scaleFluencia").value) || 10,
      pausa: parseInt(document.getElementById("scalePausa").value) || 0
    },
    qualitative: {
      tipoAfasia: document.getElementById("tipoAfasia").value || "",
      compreensao: document.getElementById("compreensao").value || "",
      repeticao: document.getElementById("repeticao").value || "",
      nomeacao: document.getElementById("nomeacao").value || "",
      caracteristicas: {
        hesitacao: document.getElementById("char_hesitacao").checked,
        repeticao: document.getElementById("char_repeticao").checked,
        parafasia: document.getElementById("char_parafasia").checked,
        tremor: document.getElementById("char_tremor").checked,
        disartria: document.getElementById("char_disartria").checked,
        disfonia: document.getElementById("char_disfonia").checked
      }
    },
    diagnostic: {
      diagnostico: document.getElementById("diagnostico").value || "",
      confianca: parseInt(document.getElementById("confianca").value) || 50,
      diferenciais: document.getElementById("diferenciais").value || "",
      recomendacoes: document.getElementById("recomendacoes").value || ""
    },
    clinical: {
      observacoes: document.getElementById("observacoes").value || ""
    }
  };

  // Salvar
  const validations = loadValidations();
  const idx = validations.findIndex(v => v.sessionId === currentSession.id);
  if (idx >= 0) {
    validations[idx] = validation;
  } else {
    validations.unshift(validation);
  }
  saveValidations(validations);

  showAlert("✅ Avaliação salva com sucesso!", "success");
  
  // Mostrar botão dashboard
  btnDashboard.style.display = "block";
  
  updateSummary();
});

// ============================================
// BOTÃO: IR PARA DASHBOARD
// ============================================

btnDashboard.addEventListener("click", () => {
  if (!currentSession) {
    showAlert("❌ Selecione uma sessão primeiro", "error");
    return;
  }
  location.href = `dashboard.html?id=${encodeURIComponent(currentSession.id)}`;
});

// ============================================
// LIMPAR FORMULÁRIO
// ============================================

btnLimpar.addEventListener("click", () => {
  document.getElementById("scaleSeveridade").value = 0;
  document.getElementById("scaleInteligibilidade").value = 10;
  document.getElementById("scaleEsforco").value = 0;
  document.getElementById("scaleFluencia").value = 10;
  document.getElementById("scalePausa").value = 0;
  document.getElementById("tipoAfasia").value = "";
  document.getElementById("compreensao").value = "";
  document.getElementById("repeticao").value = "";
  document.getElementById("nomeacao").value = "";
  document.getElementById("diagnostico").value = "";
  document.getElementById("confianca").value = 50;
  document.getElementById("diferenciais").value = "";
  document.getElementById("recomendacoes").value = "";
  document.getElementById("observacoes").value = "";

  document.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);
});

// ============================================
// VOLTAR
// ============================================

btnVoltar.addEventListener("click", () => {
  location.href = "report.html";
});

// ============================================
// ATUALIZAR RESUMO
// ============================================

function updateSummary() {
  const validations = loadValidations();
  const validationsList = document.getElementById("validationsList");

  if (validations.length === 0) {
    summarySection.style.display = "none";
    return;
  }

  summarySection.style.display = "block";
  validationsList.innerHTML = validations
    .slice(0, 5)
    .map(v => `
      <div style="padding: 12px; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 8px;">
        <strong style="color: #0284c7;">${v.medico} → ${v.paciente}</strong><br/>
        <small style="color: #999999;">
          ${formatDate(v.createdAt)} | Confiança: ${v.diagnostic.confianca}%
        </small><br/>
        <small style="color: #666666; margin-top: 4px; display: block;">
          Tipo: ${v.qualitative.tipoAfasia || "Não especificado"}
        </small>
      </div>
    `)
    .join("");
}

updateSummary();

console.log("✅ validation.js carregado (COMPLETO)");