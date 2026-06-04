/**
 * REPORT.JS — FASE 2
 * Exibição de relatório + Botão para validação
 */

const KEY_SESSIONS = "elayon_crs_sessions";

function getParam(name) {
  return new URL(location.href).searchParams.get(name);
}

function loadSessions() {
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}

const id = getParam("id");
const sessions = loadSessions();
const session = sessions.find(s => s.id === id);

if (!session) {
  alert("Relatório não encontrado");
  location.href = "index.html";
}

// Preencher dados
document.getElementById("subTitle").textContent = 
  `${session.medico} → ${session.paciente}`;

if (session.snaps) {
  document.getElementById("imgFft").src = session.snaps.fft;
  document.getElementById("imgSil").src = session.snaps.sil;
  document.getElementById("imgOv").src = session.snaps.ov;
}

// JSON
const jsonStr = JSON.stringify({
  id: session.id,
  medico: session.medico,
  paciente: session.paciente,
  contexto: session.contexto,
  inicio: new Date(session.start).toLocaleString("pt-BR"),
  fim: new Date(session.closedAt).toLocaleString("pt-BR"),
  duracao_ms: session.closedAt - session.start,
  dados_audio: session.audioBuffer || []
}, null, 2);

document.getElementById("jsonData").value = jsonStr;

// ============================================
// BOTÕES: COPIAR E BAIXAR JSON
// ============================================

document.getElementById("btnCopy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(jsonStr);
  alert("✅ Copiado!");
});

document.getElementById("btnDownload").addEventListener("click", () => {
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elayon-${session.id}.json`;
  a.click();
});

// ============================================
// BOTÃO: IR PARA VALIDAÇÃO
// ============================================

document.getElementById("btnValidacao").addEventListener("click", () => {
  location.href = `validation.html?id=${encodeURIComponent(id)}`;
});

// ============================================
// LISTA DE RELATÓRIOS
// ============================================

const closed = sessions.filter(s => s.status === "closed");
const list = document.getElementById("reportsList");

if (closed.length === 0) {
  list.innerHTML = "<p class='muted'>Nenhum relatório.</p>";
} else {
  list.innerHTML = closed.map(s => `
    <div style="padding: 10px; background: rgba(14, 165, 233, 0.04); border-radius: 8px;">
      <strong>${s.medico} → ${s.paciente}</strong><br/>
      <small class='muted'>${new Date(s.closedAt).toLocaleString("pt-BR")}</small><br/>
      <a href="report.html?id=${encodeURIComponent(s.id)}" style="color: var(--primary); text-decoration: none; font-size: 12px;">
        📄 Abrir →
      </a>
    </div>
  `).join("");
}

console.log("✅ report.js carregado");