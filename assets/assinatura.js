/**
 * ASSINATURA.JS — FASE 4 (PARTE 1/2)
 * Assinatura digital + Exportação PDF com jsPDF
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
  location.href = "index.html";
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

  // Atualizar status da sessão
  const sessions = loadSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  if (sessionIndex !== -1) {
    sessions[sessionIndex].status = "signed";
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions));
  }

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
  location.href = `index.html`;
});

console.log("✅ assinatura.js carregado (PARTE 1/2)");

// ============================================
// EXPORTAR PDF (COM jsPDF - PROFISSIONAL)
// ============================================

document.getElementById("btnExportPDF").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (signatureData === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") {
    alert("❌ Por favor, desenhe sua assinatura antes de exportar");
    return;
  }

  generatePDFWithjsPDF(signatureData);
});

// ============================================
// GERAR PDF COM jsPDF (PROFISSIONAL)
// ============================================

function generatePDFWithjsPDF(signatureData) {
  const { jsPDF } = window.jspdf;
  
  // Criar documento A4
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // ============================================
  // PÁGINA 1: CABEÇALHO + INFORMAÇÕES + DIAGNÓSTICO
  // ============================================

  // Cabeçalho
  doc.setFontSize(24);
  doc.setTextColor(2, 132, 199);
  doc.setFont(undefined, 'bold');
  doc.text("ELAYON HEALTH", margin, y);
  y += 12;

  doc.setFontSize(14);
  doc.setTextColor(26, 26, 26);
  doc.setFont(undefined, 'normal');
  doc.text("Relatório de Avaliação Clínica CRS", margin, y);
  y += 10;

  // Linha separadora
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Informações gerais
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 26);
  doc.setFont(undefined, 'normal');

  const infoLines = [
    `Médico: ${session.medico}`,
    `Paciente: ${session.paciente}`,
    `Data da Sessão: ${formatDate(session.start)}`,
    `Data de Assinatura: ${formatDate(Date.now())}`,
    `ID do Relatório: ${session.id}`
  ];

  infoLines.forEach(line => {
    doc.text(line, margin, y);
    y += 6;
  });

  y += 8;

  // Diagnóstico
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("DIAGNÓSTICO CLÍNICO", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const diagnostico = validation.diagnostic.diagnostico || "Não especificado";
  const diagLines = doc.splitTextToSize(diagnostico, contentWidth);
  doc.text(diagLines, margin, y);
  y += diagLines.length * 5 + 5;

  // Confiança no diagnóstico
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(`Confiança no Diagnóstico: ${validation.diagnostic.confianca}%`, margin, y);
  y += 6;

  // Status
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);
  doc.text(`Status: ${statusText}`, margin, y);
  y += 6;

  // ============================================
  // PÁGINA 2: ESCALAS DE AVALIAÇÃO
  // ============================================

  doc.addPage();
  y = margin;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ESCALAS DE AVALIAÇÃO", margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const scales = [
    `Severidade da Afasia: ${validation.scales.severidade}/10`,
    `Inteligibilidade da Fala: ${validation.scales.inteligibilidade}/10`,
    `Esforço Vocal: ${validation.scales.esforco}/10`,
    `Fluência: ${validation.scales.fluencia}/10`,
    `Índice de Pausa: ${validation.scales.pausa}/10`
  ];

  scales.forEach(line => {
    doc.text(line, margin, y);
    y += 6;
  });

  y += 8;

  // Tipo de Afasia
  if (validation.qualitative.tipoAfasia && validation.qualitative.tipoAfasia !== "") {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text("TIPO DE AFASIA", margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(26, 26, 26);
    doc.text(validation.qualitative.tipoAfasia, margin, y);
    y += 6;
    y += 6;
  }

  // Achados Qualitativos
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ACHADOS QUALITATIVOS", margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const qualitative = [
    `Compreensão: ${validation.qualitative.compreensao || "Não avaliado"}`,
    `Repetição: ${validation.qualitative.repeticao || "Não avaliado"}`,
    `Nomeação: ${validation.qualitative.nomeacao || "Não avaliado"}`
  ];

  qualitative.forEach(line => {
    doc.text(line, margin, y);
    y += 6;
  });

  y += 6;

  // Contexto da sessão
  if (session.contexto && session.contexto !== "") {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text("CONTEXTO DA SESSÃO", margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(26, 26, 26);
    const ctxLines = doc.splitTextToSize(session.contexto, contentWidth);
    doc.text(ctxLines, margin, y);
    y += ctxLines.length * 5;
  }

  // ============================================
  // PÁGINA 3: RECOMENDAÇÕES E DIFERENCIAIS
  // ============================================

  doc.addPage();
  y = margin;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("RECOMENDAÇÕES CLÍNICAS", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  if (validation.diagnostic.recomendacoes && validation.diagnostic.recomendacoes !== "") {
    const recomLines = doc.splitTextToSize(validation.diagnostic.recomendacoes, contentWidth);
    doc.text(recomLines, margin, y);
    y += recomLines.length * 5 + 8;
  } else {
    doc.text("Nenhuma recomendação específica", margin, y);
    y += 8;
  }

  y += 5;

  // Diagnósticos Diferenciais
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("DIAGNÓSTICOS DIFERENCIAIS", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  if (validation.diagnostic.diferenciais && validation.diagnostic.diferenciais !== "") {
    const difLines = doc.splitTextToSize(validation.diagnostic.diferenciais, contentWidth);
    doc.text(difLines, margin, y);
    y += difLines.length * 5 + 8;
  } else {
    doc.text("Nenhum diagnóstico diferencial especificado", margin, y);
    y += 8;
  }

  y += 5;

  // Observações
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("OBSERVAÇÕES CLÍNICAS", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  if (validation.clinical.observacoes && validation.clinical.observacoes !== "") {
    const obsLines = doc.splitTextToSize(validation.clinical.observacoes, contentWidth);
    doc.text(obsLines, margin, y);
  } else {
    doc.text("Nenhuma observação adicional", margin, y);
  }

  // ============================================
  // PÁGINA 4: ASSINATURA
  // ============================================

  doc.addPage();
  y = pageHeight - 100;

  // Texto de assinatura
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);
  doc.text("Assinatura do Médico:", margin, y - 25);

  // Linha para assinatura
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 80, y);

  // Adicionar assinatura
  const img = new Image();
  img.onload = () => {
    doc.addImage(img, 'PNG', margin, y - 30, 80, 25);

    // Texto abaixo
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(26, 26, 26);
    doc.text(`${session.medico}`, margin, y + 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${formatDate(Date.now())}`, margin, y + 22);

    // Rodapé
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Documento gerado digitalmente pelo sistema ELAYON HEALTH",
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );

    // Salvar PDF
    doc.save(`elayon-relatorio-${session.id}.pdf`);
    alert("✅ Relatório exportado com sucesso em PDF!");
  };

  img.src = signatureData;
}

// ============================================
// INICIALIZAÇÃO
// ============================================

console.log("✅ assinatura.js carregado (PARTE 2/2 - jsPDF)");
console.log("📄 PDF profissional com jsPDF");
console.log("📋 Sessão:", session);
console.log("✍️ Validação:", validation);
console.log("📊 Relatório:", report);