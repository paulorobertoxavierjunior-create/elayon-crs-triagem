/**
 * ASSINATURA.JS — FASE 4 (PARTE 1/2)
 * Assinatura digital + Exportação PDF Multipáginas
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
// EXPORTAR PDF (MULTIPÁGINAS - FLUIDO)
// ============================================

document.getElementById("btnExportPDF").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (signatureData === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") {
    alert("❌ Por favor, desenhe sua assinatura antes de exportar");
    return;
  }

  generatePDFMultipage(signatureData);
});

// ============================================
// EXPORTAR PDF (MULTIPÁGINAS - FLUIDO)
// ============================================

document.getElementById("btnExportPDF").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (signatureData === "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") {
    alert("❌ Por favor, desenhe sua assinatura antes de exportar");
    return;
  }

  generatePDFMultipage(signatureData);
});


// ============================================
// GERAR PDF 4 PÁGINAS (TUDO APARECENDO)
// ============================================

function generatePDFMultipage(signatureData) {
  const pages = [];
  
  // Configurações A4 REAL
  const A4_WIDTH = 210;
  const A4_HEIGHT = 297;
  const DPI = 72;
  const SCALE = DPI / 25.4;
  
  const margin = 20 * SCALE;
  const contentWidth = (A4_WIDTH - 2 * 20) * SCALE;
  const lineHeight = 16 * SCALE;
  
  // ============================================
  // PÁGINA 1: CABEÇALHO + INFORMAÇÕES
  // ============================================
  
  let page1 = createBlankPage(A4_WIDTH, A4_HEIGHT, SCALE);
  let ctx = page1.getContext("2d");
  let y = margin;
  
  // CABEÇALHO
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${28 * SCALE}px Arial`;
  ctx.fillText("ELAYON HEALTH", margin, y);
  y += 40 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${14 * SCALE}px Arial`;
  ctx.fillText("Relatório de Avaliação Clínica CRS", margin, y);
  y += 30 * SCALE;
  
  // Linha separadora
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(page1.width - margin, y);
  ctx.stroke();
  y += 30 * SCALE;
  
  // INFORMAÇÕES GERAIS
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${12 * SCALE}px Arial`;
  
  const infoLines = [
    `Médico: ${session.medico}`,
    `Paciente: ${session.paciente}`,
    `Data da Sessão: ${formatDate(session.start)}`,
    `Data de Assinatura: ${formatDate(Date.now())}`,
    `ID do Relatório: ${session.id}`
  ];
  
  infoLines.forEach(line => {
    ctx.fillText(line, margin, y);
    y += 20 * SCALE;
  });
  
  y += 25 * SCALE;
  
  // DIAGNÓSTICO
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${14 * SCALE}px Arial`;
  ctx.fillText("DIAGNÓSTICO CLÍNICO", margin, y);
  y += 25 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${11 * SCALE}px Arial`;
  
  const diagnostico = validation.diagnostic.diagnostico || "Não especificado";
  const diagLines = wrapTextPDF(ctx, diagnostico, contentWidth, 11 * SCALE);
  diagLines.forEach(line => {
    if (y > page1.height - margin - 20 * SCALE) return;
    ctx.fillText(line, margin, y);
    y += 18 * SCALE;
  });
  
  pages.push(page1);
  
  // ============================================
  // PÁGINA 2: ESCALAS DE AVALIAÇÃO
  // ============================================
  
  let page2 = createBlankPage(A4_WIDTH, A4_HEIGHT, SCALE);
  ctx = page2.getContext("2d");
  y = margin;
  
  // Título
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${14 * SCALE}px Arial`;
  ctx.fillText("ESCALAS DE AVALIAÇÃO", margin, y);
  y += 25 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${12 * SCALE}px Arial`;
  
  const scales = [
    `Severidade da Afasia: ${validation.scales.severidade}/10`,
    `Inteligibilidade da Fala: ${validation.scales.inteligibilidade}/10`,
    `Esforço Vocal: ${validation.scales.esforco}/10`,
    `Fluência: ${validation.scales.fluencia}/10`,
    `Índice de Pausa: ${validation.scales.pausa}/10`,
    `Confiança no Diagnóstico: ${validation.diagnostic.confianca}%`
  ];
  
  scales.forEach(line => {
    ctx.fillText(line, margin, y);
    y += 20 * SCALE;
  });
  
  y += 25 * SCALE;
  
  // TIPO DE AFASIA
  if (validation.qualitative.tipoAfasia && validation.qualitative.tipoAfasia !== "") {
    ctx.fillStyle = "#0284c7";
    ctx.font = `bold ${14 * SCALE}px Arial`;
    ctx.fillText("TIPO DE AFASIA", margin, y);
    y += 25 * SCALE;
    
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `${12 * SCALE}px Arial`;
    ctx.fillText(validation.qualitative.tipoAfasia, margin, y);
    y += 20 * SCALE;
    y += 20 * SCALE;
  }
  
  // ACHADOS QUALITATIVOS
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${14 * SCALE}px Arial`;
  ctx.fillText("ACHADOS QUALITATIVOS", margin, y);
  y += 25 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${12 * SCALE}px Arial`;
  
  const qualitative = [
    `Compreensão: ${validation.qualitative.compreensao || "Não avaliado"}`,
    `Repetição: ${validation.qualitative.repeticao || "Não avaliado"}`,
    `Nomeação: ${validation.qualitative.nomeacao || "Não avaliado"}`
  ];
  
  qualitative.forEach(line => {
    ctx.fillText(line, margin, y);
    y += 20 * SCALE;
  });
  
  pages.push(page2);
  
  // ============================================
  // PÁGINA 3: RECOMENDAÇÕES E DIFERENCIAIS
  // ============================================
  
  let page3 = createBlankPage(A4_WIDTH, A4_HEIGHT, SCALE);
  ctx = page3.getContext("2d");
  y = margin;
  
  // RECOMENDAÇÕES
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${14 * SCALE}px Arial`;
  ctx.fillText("RECOMENDAÇÕES CLÍNICAS", margin, y);
  y += 25 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${11 * SCALE}px Arial`;
  
  if (validation.diagnostic.recomendacoes && validation.diagnostic.recomendacoes !== "") {
    const recomLines = wrapTextPDF(ctx, validation.diagnostic.recomendacoes, contentWidth, 11 * SCALE);
    recomLines.forEach(line => {
      if (y > page3.height - margin - 40 * SCALE) return;
      ctx.fillText(line, margin, y);
      y += 18 * SCALE;
    });
  } else {
    ctx.fillText("Nenhuma recomendação específica", margin, y);
    y += 18 * SCALE;
  }
  
  y += 25 * SCALE;
  
  // DIAGNÓSTICOS DIFERENCIAIS
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${14 * SCALE}px Arial`;
  ctx.fillText("DIAGNÓSTICOS DIFERENCIAIS", margin, y);
  y += 25 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${11 * SCALE}px Arial`;
  
  if (validation.diagnostic.diferenciais && validation.diagnostic.diferenciais !== "") {
    const difLines = wrapTextPDF(ctx, validation.diagnostic.diferenciais, contentWidth, 11 * SCALE);
    difLines.forEach(line => {
      if (y > page3.height - margin - 40 * SCALE) return;
      ctx.fillText(line, margin, y);
      y += 18 * SCALE;
    });
  } else {
    ctx.fillText("Nenhum diagnóstico diferencial especificado", margin, y);
    y += 18 * SCALE;
  }
  
  y += 25 * SCALE;
  
  // OBSERVAÇÕES
  ctx.fillStyle = "#0284c7";
  ctx.font = `bold ${14 * SCALE}px Arial`;
  ctx.fillText("OBSERVAÇÕES CLÍNICAS", margin, y);
  y += 25 * SCALE;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${11 * SCALE}px Arial`;
  
  if (validation.clinical.observacoes && validation.clinical.observacoes !== "") {
    const obsLines = wrapTextPDF(ctx, validation.clinical.observacoes, contentWidth, 11 * SCALE);
    obsLines.forEach(line => {
      if (y > page3.height - margin - 40 * SCALE) return;
      ctx.fillText(line, margin, y);
      y += 18 * SCALE;
    });
  } else {
    ctx.fillText("Nenhuma observação adicional", margin, y);
    y += 18 * SCALE;
  }
  
  pages.push(page3);
  
  // ============================================
  // PÁGINA 4: ASSINATURA
  // ============================================
  
  let page4 = createBlankPage(A4_WIDTH, A4_HEIGHT, SCALE);
  ctx = page4.getContext("2d");
  y = page4.height - 180 * SCALE;
  
  // Espaço para assinatura
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${12 * SCALE}px Arial`;
  ctx.fillText("Assinatura do Médico:", margin, y - 40 * SCALE);
  
  // Linha para assinatura
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(margin + 160 * SCALE, y);
  ctx.stroke();
  
  // Desenhar assinatura
  const signatureImg = new Image();
  signatureImg.onload = () => {
    ctx.drawImage(signatureImg, margin, y - 70 * SCALE, 160 * SCALE, 60 * SCALE);
    
    // Texto abaixo
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `${11 * SCALE}px Arial`;
    ctx.fillText(`${session.medico}`, margin, y + 30 * SCALE);
    
    ctx.font = `${10 * SCALE}px Arial`;
    ctx.fillText(`${formatDate(Date.now())}`, margin, y + 50 * SCALE);
    
    // Rodapé
    ctx.fillStyle = "#999999";
    ctx.font = `${9 * SCALE}px Arial`;
    ctx.fillText("Documento gerado digitalmente pelo sistema ELAYON HEALTH", margin, page4.height - 10 * SCALE);
    
    // Converter páginas para PDF
    downloadPDFMultipage(pages);
  };
  
  signatureImg.src = signatureData;
}

// ============================================
// CRIAR PÁGINA EM BRANCO
// ============================================

function createBlankPage(width, height, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// ============================================
// QUEBRA DE TEXTO
// ============================================

function wrapTextPDF(ctx, text, maxWidth, fontSize) {
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
// DOWNLOAD PDF MULTIPÁGINAS
// ============================================

function downloadPDFMultipage(pages) {
  // Combinar páginas em uma única imagem
  const totalHeight = pages.reduce((sum, p) => sum + p.height, 0);
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = pages[0].width;
  finalCanvas.height = totalHeight;
  
  const finalCtx = finalCanvas.getContext("2d");
  let currentY = 0;
  
  pages.forEach(page => {
    finalCtx.drawImage(page, 0, currentY);
    currentY += page.height;
  });
  
  // Download
  const link = document.createElement("a");
  link.href = finalCanvas.toDataURL("image/png");
  link.download = `elayon-relatorio-${session.id}.png`;
  link.click();
  
  alert("✅ Relatório exportado com sucesso em 4 páginas A4!");
}

// ============================================
// INICIALIZAÇÃO
// ============================================

console.log("✅ assinatura.js carregado (PARTE 2/2 - 4 PÁGINAS)");
console.log("📄 PDF com 4 páginas A4 completas");
console.log("📋 Sessão:", session);
console.log("✍️ Validação:", validation);
console.log("📊 Relatório:", report);