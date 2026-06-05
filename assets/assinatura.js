/**
 * ASSINATURA.JS — VERSÃO FINAL COMPLETA
 * Desenha assinatura + Gera PDF profissional 2 páginas
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

function saveSessions(arr) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

function saveValidations(arr) {
  localStorage.setItem(KEY_VALIDATIONS, JSON.stringify(arr));
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString("pt-BR");
}

// ============================================
// CARREGAR DADOS
// ============================================

const sessionId = getParam("id");
const sessions = loadSessions();
const validations = loadValidations();

let session = sessions.find(s => s.id === sessionId);
let validation = validations.find(v => v.sessionId === sessionId);

if (!session) {
  alert("Sessão não encontrada");
  location.href = "index.html";
}

if (!validation) {
  validation = {
    sessionId: sessionId,
    scales: {
      severidade: 0,
      inteligibilidade: 0,
      esforco: 0,
      fluencia: 0,
      pausa: 0
    },
    qualitative: {
      tipoAfasia: "",
      compreensao: "",
      repeticao: "",
      nomeacao: ""
    },
    diagnostic: {
      diagnostico: "",
      confianca: 0,
      recomendacoes: "",
      diferenciais: ""
    },
    clinical: {
      observacoes: ""
    },
    createdAt: Date.now()
  };
}

// Preencher formulário
document.getElementById("infoPaciente").textContent = session.paciente;
document.getElementById("infoMedico").textContent = session.medico;
document.getElementById("infoData").textContent = formatDate(session.start);

// ============================================
// CANVAS ASSINATURA
// ============================================

const canvas = document.getElementById("signatureCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1a1a1a";
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
});

canvas.addEventListener("mouseup", () => {
  isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
});

// Touch support
canvas.addEventListener("touchstart", (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  ctx.beginPath();
  ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
});

canvas.addEventListener("touchmove", (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
  ctx.stroke();
});

canvas.addEventListener("touchend", () => {
  isDrawing = false;
});

// Limpar assinatura
document.getElementById("btnClearSignature").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// ============================================
// BOTÃO ASSINAR
// ============================================

document.getElementById("btnAssinar").addEventListener("click", () => {
  const checkBox = document.getElementById("confirmCheck");
  
  if (!checkBox.checked) {
    alert("❌ Você deve confirmar as informações");
    return;
  }

  const signatureData = canvas.toDataURL("image/png");
  
  if (!signatureData || signatureData.length < 500) {
    alert("❌ Por favor, desenhe sua assinatura");
    return;
  }

  // Salvar assinatura na validação
  validation.signatureData = signatureData;
  validation.signedAt = Date.now();

  const validationIdx = validations.findIndex(v => v.sessionId === sessionId);
  if (validationIdx !== -1) {
    validations[validationIdx] = validation;
  } else {
    validations.unshift(validation);
  }
  saveValidations(validations);

  // Atualizar status da sessão
  const sessionIdx = sessions.findIndex(s => s.id === sessionId);
  if (sessionIdx !== -1) {
    sessions[sessionIdx].status = "signed";
    saveSessions(sessions);
  }

  // Mostrar resultado
  const resultSection = document.getElementById("resultSection");
  const resultContent = document.getElementById("resultContent");
  
  resultContent.innerHTML = `
    <div style="padding: 16px; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 16px;">
      <strong style="color: #15803d;">✅ Relatório assinado com sucesso!</strong>
    </div>
    
    <p style="margin-bottom: 12px;"><strong>Informações do Relatório:</strong></p>
    <ul style="margin-left: 20px; font-size: 13px; line-height: 1.8;">
      <li><strong>Médico:</strong> ${session.medico}</li>
      <li><strong>Paciente:</strong> ${session.paciente}</li>
      <li><strong>Data de Assinatura:</strong> ${formatDate(validation.signedAt)}</li>
      <li><strong>Status:</strong> ✅ Finalizado</li>
    </ul>

    <p style="margin-top: 16px; font-size: 12px; color: #666666;">
      O relatório foi salvo. Clique em "Exportar PDF" para baixar.
    </p>
  `;
  
  resultSection.style.display = "block";

  // Desabilitar botão
  document.getElementById("btnAssinar").disabled = true;
  document.getElementById("btnAssinar").textContent = "✅ Assinado";
  document.getElementById("btnExportPDF").disabled = false;
  document.getElementById("btnIAReview").disabled = false;
});

// ============================================
// EXPORTAR PDF
// ============================================

document.getElementById("btnExportPDF").addEventListener("click", () => {
  const signatureData = canvas.toDataURL("image/png");
  
  if (!signatureData || signatureData.length < 500) {
    alert("❌ Por favor, desenhe sua assinatura antes de exportar");
    return;
  }

  generatePDFProfissional(signatureData);
});

// ============================================
// GERAR PDF PROFISSIONAL (2 PÁGINAS)
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
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;
  const lineSpacing = 3.5;
  let y = margin;

  // ============================================
  // PÁGINA 1: CABEÇALHO + DIAGNÓSTICO + ESCALAS
  // ============================================

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(2, 132, 199);
  doc.setFont(undefined, 'bold');
  doc.text("ELAYON HEALTH", margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(26, 26, 26);
  doc.setFont(undefined, 'normal');
  doc.text("Relatório de Avaliação Clínica CRS", margin, y);
  y += 7;

  // Linha separadora
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Informações gerais
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 26);
  doc.setFont(undefined, 'normal');

  const infoLines = [
    `Médico: ${session.medico}`,
    `Paciente: ${session.paciente}`,
    `Data da Sessão: ${formatDate(session.start)}`,
    `Data de Assinatura: ${formatDate(validation.signedAt)}`,
    `ID: ${session.id}`
  ];

  infoLines.forEach(line => {
    doc.text(line, margin, y);
    y += lineSpacing;
  });

  y += 4;

  // Diagnóstico
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("DIAGNÓSTICO CLÍNICO", margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const diagnostico = validation.diagnostic.diagnostico || "Não especificado";
  const diagLines = doc.splitTextToSize(diagnostico, contentWidth - 5);
  doc.text(diagLines, margin, y);
  y += diagLines.length * lineSpacing + 2;

  doc.setFont(undefined, 'bold');
  doc.text(`Confiança no Diagnóstico: ${validation.diagnostic.confianca}%`, margin, y);
  y += 5;

  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text("Status: Finalizado", margin, y);
  y += 6;

  // Escalas (tabela)
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ESCALAS DE AVALIAÇÃO", margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const scalesTable = [
    `Severidade da Afasia: ${validation.scales.severidade}/10`,
    `Inteligibilidade da Fala: ${validation.scales.inteligibilidade}/10`,
    `Esforço Vocal: ${validation.scales.esforco}/10`,
    `Fluência: ${validation.scales.fluencia}/10`,
    `Índice de Pausa: ${validation.scales.pausa}/10`
  ];

  scalesTable.forEach(line => {
    doc.text(line, margin, y);
    y += lineSpacing;
  });

  y += 3;

  // Tipo de Afasia
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("TIPO DE AFASIA", margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);
  doc.text(validation.qualitative.tipoAfasia || "Não especificado", margin, y);
  y += 5;

  // Achados Qualitativos
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("ACHADOS QUALITATIVOS", margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  const qualitativeLines = [
    `Compreensão: ${validation.qualitative.compreensao || "Não avaliado"}`,
    `Repetição: ${validation.qualitative.repeticao || "Não avaliado"}`,
    `Nomeação: ${validation.qualitative.nomeacao || "Não avaliado"}`
  ];

  qualitativeLines.forEach(line => {
    doc.text(line, margin, y);
    y += lineSpacing;
  });

  y += 3;

  // Contexto da Sessão
  if (session.contexto && session.contexto.trim() !== "") {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text("CONTEXTO DA SESSÃO", margin, y);
    y += 4;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(26, 26, 26);
    const ctxLines = doc.splitTextToSize(session.contexto, contentWidth - 5);
    doc.text(ctxLines, margin, y);
    y += ctxLines.length * lineSpacing;
  }

  // ============================================
  // PÁGINA 2: RECOMENDAÇÕES + DIFERENCIAIS + OBSERVAÇÕES + ASSINATURA
  // ============================================

  doc.addPage();
  y = margin;

  // Recomendações Clínicas
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("RECOMENDAÇÕES CLÍNICAS", margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  if (validation.diagnostic.recomendacoes && validation.diagnostic.recomendacoes.trim() !== "") {
    const recLines = doc.splitTextToSize(validation.diagnostic.recomendacoes, contentWidth - 5);
    doc.text(recLines, margin, y);
    y += recLines.length * lineSpacing + 3;
  } else {
    doc.text("Nenhuma recomendação específica", margin, y);
    y += lineSpacing + 3;
  }

  // Diagnósticos Diferenciais
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("DIAGNÓSTICOS DIFERENCIAIS", margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  if (validation.diagnostic.diferenciais && validation.diagnostic.diferenciais.trim() !== "") {
    const difLines = doc.splitTextToSize(validation.diagnostic.diferenciais, contentWidth - 5);
    doc.text(difLines, margin, y);
    y += difLines.length * lineSpacing + 3;
  } else {
    doc.text("Nenhum diagnóstico diferencial especificado", margin, y);
    y += lineSpacing + 3;
  }

  // Observações Clínicas
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text("OBSERVAÇÕES CLÍNICAS", margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(26, 26, 26);

  if (validation.clinical.observacoes && validation.clinical.observacoes.trim() !== "") {
    const obsLines = doc.splitTextToSize(validation.clinical.observacoes, contentWidth - 5);
    doc.text(obsLines, margin, y);
  } else {
    doc.text("Nenhuma observação adicional", margin, y);
  }

  // ============================================
  // ASSINATURA (CANTO DIREITO INFERIOR)
  // ============================================

  const signatureImg = new Image();
  signatureImg.onload = () => {
    const signX = pageWidth - margin - 60;
    const signY = pageHeight - 35;

    // Linha para assinatura
    doc.setDrawColor(26, 26, 26);
    doc.setLineWidth(0.2);
    doc.line(signX, signY, signX + 60, signY);

    // Desenhar assinatura
    doc.addImage(signatureImg, 'PNG', signX, signY - 25, 60, 20);

    // Texto abaixo
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(26, 26, 26);
    doc.text(`${session.medico}`, signX, signY + 8);

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(formatDate(Date.now()), signX, signY + 14);

    // Rodapé
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Documento gerado digitalmente pelo sistema ELAYON HEALTH",
      pageWidth / 2,
      pageHeight - 3,
      { align: 'center' }
    );

    // Salvar PDF
    const fileName = `${session.paciente}-elayon-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
    doc.save(fileName);
    alert("✅ Relatório exportado com sucesso!");
  };

  signatureImg.onerror = () => {
    alert("❌ Erro ao carregar assinatura");
  };

  signatureImg.src = signatureData;
}

// ============================================
// BOTÃO IA REVIEW
// ============================================

document.getElementById("btnIAReview").addEventListener("click", () => {
  if (!sessionId) {
    alert("Sessão não encontrada");
    return;
  }

  location.href = `ia-review.html?id=${encodeURIComponent(sessionId)}`;
});

// ============================================
// VOLTAR
// ============================================

document.getElementById("btnVoltar").addEventListener("click", () => {
  location.href = "index.html";
});

console.log("✅ assinatura.js carregado (COMPLETO)");