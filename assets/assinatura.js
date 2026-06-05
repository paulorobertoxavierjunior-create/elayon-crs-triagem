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
// EXPORTAR PDF (COM jsPDF + GRÁFICOS)
// ============================================

document.getElementById("btnExportPDF").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (signatureData === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") {
    alert("❌ Por favor, desenhe sua assinatura antes de exportar");
    return;
  }

  generatePDFProfissional(signatureData);
});

// ============================================
// GERAR PDF PROFISSIONAL COM GRÁFICOS
// ============================================

function generatePDFProfissional(signatureData) {
  const { jsPDF } = window.jspdf;
  
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
  // PÁGINA 1: CABEÇALHO + INFORMAÇÕES
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

  // Confiança
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

  // ============================================
  // PÁGINA 2: GRÁFICO DAS ESCALAS
  // ============================================

  doc.addPage();
  y = margin;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ESCALAS DE AVALIAÇÃO (GRÁFICO)", margin, y);
  y += 12;

  // Dados das escalas
  const scalesData = [
    { label: "Severidade", value: validation.scales.severidade, color: [239, 68, 68] },
    { label: "Inteligibilidade", value: validation.scales.inteligibilidade, color: [59, 130, 246] },
    { label: "Esforço Vocal", value: validation.scales.esforco, color: [249, 115, 22] },
    { label: "Fluência", value: validation.scales.fluencia, color: [34, 197, 94] },
    { label: "Índice Pausa", value: validation.scales.pausa, color: [168, 85, 247] }
  ];

  // Desenhar gráfico de barras
  const barWidth = 8;
  const barSpacing = 15;
  const maxBarHeight = 40;
  const startX = margin + 10;
  const startY = y + 50;

  scalesData.forEach((scale, idx) => {
    const barHeight = (scale.value / 10) * maxBarHeight;
    const x = startX + idx * barSpacing;

    // Barra
    doc.setFillColor(scale.color[0], scale.color[1], scale.color[2]);
    doc.rect(x, startY - barHeight, barWidth, barHeight, 'F');

    // Valor
    doc.setFontSize(8);
    doc.setTextColor(26, 26, 26);
    doc.text(`${scale.value}`, x + 1, startY + 5);

    // Label
    doc.setFontSize(7);
    doc.text(scale.label, x - 2, startY + 12, { maxWidth: 12, align: 'center' });
  });

  y = startY + 25;

  // Tabela de escalas
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  scalesData.forEach(scale => {
    doc.text(`${scale.label}: ${scale.value}/10`, margin, y);
    y += 5;
  });

  y += 5;
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(`Confiança no Diagnóstico: ${validation.diagnostic.confianca}%`, margin, y);

  // ============================================
  // PÁGINA 3: MÉTRICAS CRS TÉCNICAS
  // ============================================

  doc.addPage();
  y = margin;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("MÉTRICAS CRS TÉCNICAS", margin, y);
  y += 12;

  // Tabela de métricas
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const metricsTable = [
    ["Métrica", "Valor", "Interpretação"],
    ["Severidade da Afasia", `${validation.scales.severidade}/10`, validation.scales.severidade <= 3 ? "Leve" : validation.scales.severidade <= 6 ? "Moderada" : "Severa"],
    ["Inteligibilidade", `${validation.scales.inteligibilidade}/10`, validation.scales.inteligibilidade >= 7 ? "Preservada" : "Alterada"],
    ["Esforço Vocal", `${validation.scales.esforco}/10`, validation.scales.esforco <= 3 ? "Normal" : "Aumentado"],
    ["Fluência", `${validation.scales.fluencia}/10`, validation.scales.fluencia >= 7 ? "Fluente" : "Disfluente"],
    ["Índice de Pausa", `${validation.scales.pausa}/10`, validation.scales.pausa >= 5 ? "Aumentado" : "Normal"]
  ];

  // Desenhar tabela
  let tableY = y;
  metricsTable.forEach((row, idx) => {
    if (idx === 0) {
      doc.setFont(undefined, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(2, 132, 199);
      doc.rect(margin, tableY - 4, contentWidth, 5, 'F');
    } else {
      doc.setFont(undefined, 'normal');
      doc.setTextColor(26, 26, 26);
      if (idx % 2 === 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, tableY - 4, contentWidth, 5, 'F');
      }
    }

    doc.text(row[0], margin + 2, tableY);
    doc.text(row[1], margin + 60, tableY);
    doc.text(row[2], margin + 85, tableY);
    tableY += 6;
  });

  y = tableY + 10;

  // Tipo de Afasia
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("TIPO DE AFASIA", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);
  doc.text(validation.qualitative.tipoAfasia || "Não especificado", margin, y);
  y += 8;

  // Achados Qualitativos
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ACHADOS QUALITATIVOS", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const qualitative = [
    `Compreensão: ${validation.qualitative.compreensao || "Não avaliado"}`,
    `Repetição: ${validation.qualitative.repeticao || "Não avaliado"}`,
    `Nomeação: ${validation.qualitative.nomeacao || "Não avaliado"}`
  ];

  qualitative.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });

  // ============================================
  // PÁGINA 4: ANÁLISE SEMÂNTICA
  // ============================================

  doc.addPage();
  y = margin;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ANÁLISE SEMÂNTICA E MOMENTOS INTEGRAIS", margin, y);
  y += 12;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  // Momento Integral (média das escalas)
  const momentoIntegral = (
    validation.scales.severidade +
    validation.scales.inteligibilidade +
    validation.scales.esforco +
    validation.scales.fluencia +
    validation.scales.pausa
  ) / 5;

  doc.text(`Momento Integral (Média): ${momentoIntegral.toFixed(2)}/10`, margin, y);
  y += 6;

  // Derivado Semântico (variação entre escalas)
  const scales = [
    validation.scales.severidade,
    validation.scales.inteligibilidade,
    validation.scales.esforco,
    validation.scales.fluencia,
    validation.scales.pausa
  ];
  const maxScale = Math.max(...scales);
  const minScale = Math.min(...scales);
  const derivadoSemantico = maxScale - minScale;

  doc.text(`Derivado Semântico (Variação): ${derivadoSemantico.toFixed(2)}`, margin, y);
  y += 6;

  // Interpretação
  doc.setFont(undefined, 'bold');
  doc.text("Interpretação:", margin, y);
  y += 6;

  doc.setFont(undefined, 'normal');
  const interpretacao = `
    O momento integral de ${momentoIntegral.toFixed(2)} indica um padrão ${momentoIntegral <= 3 ? "leve" : momentoIntegral <= 6 ? "moderado" : "severo"} de alteração.
    O derivado semântico de ${derivadoSemantico.toFixed(2)} sugere ${derivadoSemantico <= 2 ? "consistência nos achados" : derivadoSemantico <= 5 ? "variabilidade moderada" : "grande variabilidade entre domínios"}.
  `;

  const interpretacaoLines = doc.splitTextToSize(interpretacao, contentWidth);
  doc.text(interpretacaoLines, margin, y);
  y += interpretacaoLines.length * 5 + 10;

  // Contexto
  if (session.contexto && session.contexto !== "") {
    doc.setFont(undefined, 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text("CONTEXTO DA SESSÃO", margin, y);
    y += 8;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(26, 26, 26);
    const ctxLines = doc.splitTextToSize(session.contexto, contentWidth);
    doc.text(ctxLines, margin, y);
    y += ctxLines.length * 5;
  }

  // ============================================
  // PÁGINA 5: RECOMENDAÇÕES + ASSINATURA
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
  // PÁGINA 6: ASSINATURA
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
    alert("✅ Relatório exportado com sucesso em PDF profissional!");
  };

  img.src = signatureData;
}

// ============================================
// INICIALIZAÇÃO
// ============================================

console.log("✅ assinatura.js carregado (PARTE 2/2 - PROFISSIONAL)");
console.log("📊 PDF com gráficos e métricas CRS");
console.log("📄 6 páginas profissionais");