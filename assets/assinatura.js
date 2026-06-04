/**
 * ASSINATURA.JS — FASE 4 (PARTE 1/2)
 * Assinatura digital + Exportação PDF
 */

const KEY_SESSIONS = "elayon_crs_sessions";
const KEY_VALIDATIONS = "elayon_validations";
const KEY_REPORTS = "elayon_correlation_reports";

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

function loadReports() {
  return JSON.parse(localStorage.getItem(KEY_REPORTS) || "[]");
}

function formatDate(ms) {
  return new Date(ms).toLocaleString("pt-BR");
}

// ============================================
// CARREGAR DADOS
// ============================================

const sessionId = getParam("id");
const sessions = loadSessions();
const validations = loadValidations();
const reports = loadReports();

const session = sessions.find(s => s.id === sessionId);
const validation = validations.find(v => v.sessionId === sessionId);
const report = reports.find(r => r.sessionId === sessionId);

if (!session || !validation) {
  alert("Sessão ou validação não encontrada");
  location.href = "dashboard.html";
}

// ============================================
// PREENCHER INFORMAÇÕES
// ============================================

document.getElementById("infoMedico").textContent = session.medico;
document.getElementById("infoPaciente").textContent = session.paciente;
document.getElementById("infoDataSessao").textContent = formatDate(session.start);
document.getElementById("infoDiagnostico").textContent = validation.diagnostic.diagnostico || "--";

// Status validação
let statusText = "⚠️ Pendente";
if (report && report.summary.significantCorrelations >= 5) {
  statusText = "✅ Validado";
} else if (report && report.summary.significantCorrelations >= 3) {
  statusText = "⚠️ Parcialmente Validado";
}
document.getElementById("infoStatus").textContent = statusText;

// Preenchimento de resumo
document.getElementById("sumSeveridade").textContent = validation.scales.severidade + "/10";
document.getElementById("sumInteligibilidade").textContent = validation.scales.inteligibilidade + "/10";
document.getElementById("sumEsforco").textContent = validation.scales.esforco + "/10";
document.getElementById("sumFluencia").textContent = validation.scales.fluencia + "/10";
document.getElementById("sumPausa").textContent = validation.scales.pausa + "/10";
document.getElementById("sumConfianca").textContent = validation.diagnostic.confianca + "%";

// ============================================
// CANVAS DE ASSINATURA
// ============================================

const canvas = document.getElementById("signatureCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Ajustar tamanho do canvas
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Desenho
function startDrawing(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
}

function draw(e) {
  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  lastX = x;
  lastY = y;
}

function stopDrawing() {
  isDrawing = false;
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

// Touch support
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousedown", {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  const mouseEvent = new MouseEvent("mouseup", {});
  canvas.dispatchEvent(mouseEvent);
});

// ============================================
// BOTÕES DE ASSINATURA
// ============================================

document.getElementById("btnClearSignature").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById("signaturePreview").style.display = "none";
});

document.getElementById("btnPreviewSignature").addEventListener("click", () => {
  const img = canvas.toDataURL("image/png");
  document.getElementById("signatureImg").src = img;
  document.getElementById("signaturePreview").style.display = "block";
});

// ============================================
// CONFIRMAÇÃO
// ============================================

document.getElementById("confirmCheck").addEventListener("change", (e) => {
  const btnAssinar = document.getElementById("btnAssinar");
  const btnExportPDF = document.getElementById("btnExportPDF");
  
  if (e.target.checked) {
    btnAssinar.disabled = false;
    btnExportPDF.disabled = false;
  } else {
    btnAssinar.disabled = true;
    btnExportPDF.disabled = true;
  }
});

// ============================================
// SALVAR ASSINATURA
// ============================================

document.getElementById("btnAssinar").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (signatureData === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") {
    alert("❌ Por favor, desenhe sua assinatura antes de continuar");
    return;
  }

  // Salvar assinatura
  const signedReport = {
    id: `signed_${Date.now()}`,
    sessionId: sessionId,
    validationId: validation.id,
    medico: session.medico,
    paciente: session.paciente,
    signatureData: signatureData,
    signedAt: Date.now(),
    session: session,
    validation: validation,
    report: report
  };

  const KEY_SIGNED = "elayon_signed_reports";
  const signed = JSON.parse(localStorage.getItem(KEY_SIGNED) || "[]");
  signed.unshift(signedReport);
  localStorage.setItem(KEY_SIGNED, JSON.stringify(signed));

  // Mostrar resultado
  const resultSection = document.getElementById("resultSection");
  const resultContent = document.getElementById("resultContent");
  
  resultContent.innerHTML = `
    <div style="padding: 16px; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 16px;">
      <strong style="color: #15803d;">✅ Relatório assinado com sucesso!</strong>
    </div>
    
    <p style="margin-bottom: 12px;"><strong>Informações do Relatório Assinado:</strong></p>
    <ul style="margin-left: 20px; font-size: 13px; line-height: 1.8;">
      <li><strong>ID:</strong> ${signedReport.id}</li>
      <li><strong>Médico:</strong> ${signedReport.medico}</li>
      <li><strong>Paciente:</strong> ${signedReport.paciente}</li>
      <li><strong>Data de Assinatura:</strong> ${formatDate(signedReport.signedAt)}</li>
      <li><strong>Status:</strong> ✅ Finalizado</li>
    </ul>

    <p style="margin-top: 16px; font-size: 12px; color: #666666;">
      O relatório foi salvo e pode ser exportado em PDF para arquivo permanente.
    </p>
  `;
  
  resultSection.style.display = "block";

  // Desabilitar botão
  document.getElementById("btnAssinar").disabled = true;
  document.getElementById("btnAssinar").textContent = "✅ Assinado";
});

// ============================================
// VOLTAR
// ============================================

document.getElementById("btnVoltar").addEventListener("click", () => {
  location.href = `dashboard.html?id=${encodeURIComponent(sessionId)}`;
});

console.log("✅ assinatura.js carregado (PARTE 1/2)");

// ============================================
// EXPORTAR PDF (VERSÃO CORRIGIDA)
// ============================================

document.getElementById("btnExportPDF").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (signatureData === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") {
    alert("❌ Por favor, desenhe sua assinatura antes de exportar");
    return;
  }

  generatePDFSimple(signatureData);
});

// ============================================
// GERAR PDF SIMPLES E FUNCIONAL
// ============================================

function generatePDFSimple(signatureData) {
  const pdfCanvas = document.createElement("canvas");
  const pdfCtx = pdfCanvas.getContext("2d");
  
  // Configurações A4
  const A4_WIDTH = 210;
  const A4_HEIGHT = 297;
  const DPI = 150;
  const SCALE = DPI / 25.4;
  
  pdfCanvas.width = A4_WIDTH * SCALE;
  pdfCanvas.height = A4_HEIGHT * SCALE;
  
  // Fundo branco
  pdfCtx.fillStyle = "#ffffff";
  pdfCtx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  
  const margin = 15 * SCALE;
  const contentWidth = pdfCanvas.width - 2 * margin;
  let y = margin;
  
  // ============================================
  // CABEÇALHO
  // ============================================
  
  pdfCtx.fillStyle = "#0284c7";
  pdfCtx.font = `bold ${20 * SCALE}px Arial`;
  pdfCtx.fillText("ELAYON HEALTH", margin, y);
  y += 30 * SCALE;
  
  pdfCtx.fillStyle = "#1a1a1a";
  pdfCtx.font = `${12 * SCALE}px Arial`;
  pdfCtx.fillText("Relatório de Avaliação Clínica CRS", margin, y);
  y += 25 * SCALE;
  
  // Linha separadora
  pdfCtx.strokeStyle = "#cccccc";
  pdfCtx.lineWidth = 1;
  pdfCtx.beginPath();
  pdfCtx.moveTo(margin, y);
  pdfCtx.lineTo(pdfCanvas.width - margin, y);
  pdfCtx.stroke();
  y += 20 * SCALE;
  
  // ============================================
  // INFORMAÇÕES GERAIS
  // ============================================
  
  pdfCtx.fillStyle = "#1a1a1a";
  pdfCtx.font = `${11 * SCALE}px Arial`;
  
  const info = [
    `Médico: ${session.medico}`,
    `Paciente: ${session.paciente}`,
    `Data da Sessão: ${formatDate(session.start)}`,
    `Data de Assinatura: ${formatDate(Date.now())}`,
    `ID do Relatório: ${session.id}`
  ];
  
  info.forEach(line => {
    pdfCtx.fillText(line, margin, y);
    y += 16 * SCALE;
  });
  
  y += 15 * SCALE;
  
  // ============================================
  // DIAGNÓSTICO
  // ============================================
  
  pdfCtx.fillStyle = "#0284c7";
  pdfCtx.font = `bold ${12 * SCALE}px Arial`;
  pdfCtx.fillText("DIAGNÓSTICO CLÍNICO", margin, y);
  y += 18 * SCALE;
  
  pdfCtx.fillStyle = "#1a1a1a";
  pdfCtx.font = `${10 * SCALE}px Arial`;
  
  const diagnostico = validation.diagnostic.diagnostico || "Não especificado";
  const diagLines = wrapTextPDF(pdfCtx, diagnostico, contentWidth, 10 * SCALE);
  diagLines.forEach(line => {
    pdfCtx.fillText(line, margin, y);
    y += 14 * SCALE;
  });
  
  y += 12 * SCALE;
  
  // ============================================
  // ESCALAS CLÍNICAS
  // ============================================
  
  pdfCtx.fillStyle = "#0284c7";
  pdfCtx.font = `bold ${12 * SCALE}px Arial`;
  pdfCtx.fillText("ESCALAS DE AVALIAÇÃO", margin, y);
  y += 18 * SCALE;
  
  pdfCtx.fillStyle = "#1a1a1a";
  pdfCtx.font = `${10 * SCALE}px Arial`;
  
  const scales = [
    `Severidade da Afasia: ${validation.scales.severidade}/10`,
    `Inteligibilidade da Fala: ${validation.scales.inteligibilidade}/10`,
    `Esforço Vocal: ${validation.scales.esforco}/10`,
    `Fluência: ${validation.scales.fluencia}/10`,
    `Índice de Pausa: ${validation.scales.pausa}/10`,
    `Confiança no Diagnóstico: ${validation.diagnostic.confianca}%`
  ];
  
  scales.forEach(line => {
    pdfCtx.fillText(line, margin, y);
    y += 14 * SCALE;
  });
  
  y += 12 * SCALE;
  
  // ============================================
  // TIPO DE AFASIA
  // ============================================
  
  if (validation.qualitative.tipoAfasia && validation.qualitative.tipoAfasia !== "") {
    pdfCtx.fillStyle = "#0284c7";
    pdfCtx.font = `bold ${12 * SCALE}px Arial`;
    pdfCtx.fillText("TIPO DE AFASIA", margin, y);
    y += 18 * SCALE;
    
    pdfCtx.fillStyle = "#1a1a1a";
    pdfCtx.font = `${10 * SCALE}px Arial`;
    pdfCtx.fillText(validation.qualitative.tipoAfasia, margin, y);
    y += 14 * SCALE;
    y += 12 * SCALE;
  }
  
  // ============================================
  // RECOMENDAÇÕES
  // ============================================
  
  if (validation.diagnostic.recomendacoes && validation.diagnostic.recomendacoes !== "") {
    pdfCtx.fillStyle = "#0284c7";
    pdfCtx.font = `bold ${12 * SCALE}px Arial`;
    pdfCtx.fillText("RECOMENDAÇÕES", margin, y);
    y += 18 * SCALE;
    
    pdfCtx.fillStyle = "#1a1a1a";
    pdfCtx.font = `${10 * SCALE}px Arial`;
    
    const recomLines = wrapTextPDF(pdfCtx, validation.diagnostic.recomendacoes, contentWidth, 10 * SCALE);
    recomLines.forEach(line => {
      pdfCtx.fillText(line, margin, y);
      y += 14 * SCALE;
    });
    
    y += 12 * SCALE;
  }
  
  // ============================================
  // ESPAÇO PARA ASSINATURA
  // ============================================
  
  y = pdfCanvas.height - 100 * SCALE;
  
  // Linha para assinatura
  pdfCtx.strokeStyle = "#1a1a1a";
  pdfCtx.lineWidth = 1;
  pdfCtx.beginPath();
  pdfCtx.moveTo(margin, y);
  pdfCtx.lineTo(margin + 120 * SCALE, y);
  pdfCtx.stroke();
  
  // Desenhar assinatura
  const signatureImg = new Image();
  signatureImg.onload = () => {
    pdfCtx.drawImage(signatureImg, margin, y - 60 * SCALE, 120 * SCALE, 50 * SCALE);
    
    // Texto abaixo
    pdfCtx.fillStyle = "#1a1a1a";
    pdfCtx.font = `${9 * SCALE}px Arial`;
    pdfCtx.fillText(`${session.medico}`, margin, y + 15 * SCALE);
    pdfCtx.fillText(`${formatDate(Date.now())}`, margin, y + 28 * SCALE);
    
    // Rodapé
    pdfCtx.fillStyle = "#999999";
    pdfCtx.font = `${8 * SCALE}px Arial`;
    pdfCtx.fillText("Documento gerado digitalmente pelo sistema ELAYON HEALTH", margin, pdfCanvas.height - 8 * SCALE);
    
    // Converter e baixar
    downloadPDFImage(pdfCanvas);
  };
  
  signatureImg.src = signatureData;
}

// ============================================
// QUEBRA DE TEXTO
// ============================================

function wrapTextPDF(ctx, text, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  
  words.forEach(word => {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ============================================
// DOWNLOAD PDF
// ============================================

function downloadPDFImage(canvas) {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `elayon-relatorio-${session.id}.png`;
  link.click();
  
  alert("✅ Relatório exportado com sucesso!");
}

// ============================================
// INICIALIZAÇÃO
// ============================================

console.log("✅ assinatura.js carregado (PARTE 2/2 - CORRIGIDO)");
console.log("📋 Sessão:", session);
console.log("✍️ Validação:", validation);
console.log("📊 Relatório:", report);