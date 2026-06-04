/**
 * DASHBOARD.JS — FASE 3 (PARTE 1/2)
 * Visualização de correlações CRS + Status de validação
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
  location.href = "validation.html";
}

// ============================================
// PREENCHER INFORMAÇÕES
// ============================================

document.getElementById("infoMedico").textContent = session.medico;
document.getElementById("infoPaciente").textContent = session.paciente;
document.getElementById("infoDataSessao").textContent = formatDate(session.start);
document.getElementById("infoDiagnostico").textContent = validation.diagnostic.diagnostico || "--";
document.getElementById("infoConfianca").textContent = validation.diagnostic.confianca + "%";

// ============================================
// CALCULAR CORRELAÇÕES (se não existir relatório)
// ============================================

function extractCRSData(sess) {
  if (!sess.audioBuffer || sess.audioBuffer.length === 0) return null;
  const data = sess.audioBuffer;
  return {
    rms: data.map(d => d.rms || 0),
    silence: data.map(d => d.silence || 0),
    sub: data.map(d => d.sub || 0),
    low: data.map(d => d.low || 0),
    mid: data.map(d => d.mid || 0),
    high: data.map(d => d.high || 0)
  };
}

function calculatePearson(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / x.length;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denomY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));
  if (denomX === 0 || denomY === 0) return 0;
  return numerator / (denomX * denomY);
}

let correlations = report ? report.correlations : null;

if (!correlations) {
  const crsData = extractCRSData(session);
  if (crsData) {
    correlations = {};
    const scales = [
      { name: "Severidade", value: validation.scales.severidade },
      { name: "Inteligibilidade", value: validation.scales.inteligibilidade },
      { name: "Esforço", value: validation.scales.esforco },
      { name: "Fluência", value: validation.scales.fluencia },
      { name: "Pausa", value: validation.scales.pausa }
    ];

    const crsMetrics = [
      { name: "RMS", data: crsData.rms },
      { name: "Silêncio", data: crsData.silence },
      { name: "Sub", data: crsData.sub },
      { name: "Low", data: crsData.low },
      { name: "Mid", data: crsData.mid },
      { name: "High", data: crsData.high }
    ];

    scales.forEach(scale => {
      correlations[scale.name] = {};
      crsMetrics.forEach(metric => {
        const scaleArray = Array(metric.data.length).fill(scale.value);
        const r = calculatePearson(scaleArray, metric.data);
        correlations[scale.name][metric.name] = {
          r: parseFloat(r.toFixed(3)),
          significant: Math.abs(r) > 0.5
        };
      });
    });
  }
}

// ============================================
// PREENCHER MATRIZ
// ============================================

function populateMatrix() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (!correlations) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999999;">Sem dados de correlação</td></tr>';
    return;
  }

  Object.entries(correlations).forEach(([scaleName, metrics]) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td style="text-align: left; font-weight: 700;">${scaleName}</td>`;

    ["RMS", "Silêncio", "Sub", "Low", "Mid", "High"].forEach(metricName => {
      const corr = metrics[metricName];
      if (corr) {
        const r = corr.r;
        const cellClass = Math.abs(r) > 0.5 ? "corr-strong" : Math.abs(r) > 0.3 ? "corr-moderate" : "corr-weak";
        row.innerHTML += `<td class="corr-cell ${cellClass}">${r.toFixed(3)}</td>`;
      } else {
        row.innerHTML += `<td>--</td>`;
      }
    });

    tbody.appendChild(row);
  });
}

populateMatrix();

// ============================================
// CALCULAR KPIs
// ============================================

function calculateKPIs() {
  if (!correlations) return;

  let total = 0;
  let significant = 0;
  let topCorrs = [];

  Object.entries(correlations).forEach(([scaleName, metrics]) => {
    Object.entries(metrics).forEach(([metricName, corr]) => {
      total++;
      if (corr.significant) significant++;
      topCorrs.push({
        scale: scaleName,
        metric: metricName,
        r: corr.r,
        significant: corr.significant
      });
    });
  });

  const rate = total > 0 ? Math.round((significant / total) * 100) : 0;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiSignificant").textContent = significant;
  document.getElementById("kpiRate").textContent = rate + "%";

  // Status
  let status = "❌ NÃO VALIDADO";
  let statusClass = "status-invalid";
  if (significant >= 8) {
    status = "✅ ALTAMENTE FIDEDIGNO";
    statusClass = "status-validated";
  } else if (significant >= 5) {
    status = "✅ VALIDADO";
    statusClass = "status-validated";
  } else if (significant >= 3) {
    status = "⚠️ PARCIALMENTE VALIDADO";
    statusClass = "status-partial";
  }

  document.getElementById("kpiStatus").innerHTML = `<span class="status-badge ${statusClass}">${status}</span>`;

  // Top correlações
  topCorrs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const topList = document.getElementById("topCorrList");
  topList.innerHTML = topCorrs.slice(0, 5).map(c => `
    <div class="top-corr-item">
      <div class="top-corr-title">${c.scale} ↔ ${c.metric}</div>
      <div class="top-corr-value">${c.r.toFixed(3)}</div>
      <div class="top-corr-desc">
        ${c.significant ? "✅ Significativa (p < 0.05)" : "⚠️ Não significativa"}
      </div>
    </div>
  `).join("");

  return { total, significant, rate };
}

const kpis = calculateKPIs();

console.log("✅ dashboard.js carregado (PARTE 1/2)");

// ============================================
// GRÁFICO DE VALIDAÇÃO
// ============================================

function drawCorrelationChart() {
  const canvas = document.getElementById("cvCorrelations");
  const ctx = canvas.getContext("2d");

  if (!correlations) {
    ctx.fillStyle = "#999999";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Sem dados para visualizar", canvas.width / 2, canvas.height / 2);
    return;
  }

  // Preparar dados
  const scales = Object.keys(correlations);
  const metrics = ["RMS", "Silêncio", "Sub", "Low", "Mid", "High"];
  const colors = ["#0284c7", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"];

  // Limpar canvas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const padding = 60;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;

  // Desenhar eixos
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.stroke();

  // Labels dos eixos
  ctx.fillStyle = "#666666";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Escalas Clínicas", canvas.width / 2, canvas.height - 10);

  ctx.save();
  ctx.translate(10, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Correlação (r)", 0, 0);
  ctx.restore();

  // Desenhar barras
  const barWidth = chartWidth / (scales.length * metrics.length);
  let x = padding;

  scales.forEach((scale, scaleIdx) => {
    metrics.forEach((metric, metricIdx) => {
      const corr = correlations[scale][metric];
      if (corr) {
        const r = Math.abs(corr.r);
        const barHeight = (r / 1) * chartHeight;
        const y = canvas.height - padding - barHeight;

        // Cor baseada em significância
        ctx.fillStyle = corr.significant ? colors[metricIdx] : "#e5e5e5";
        ctx.fillRect(x, y, barWidth - 2, barHeight);

        x += barWidth;
      }
    });
  });

  // Legenda
  ctx.font = "11px Arial";
  ctx.textAlign = "left";
  let legendX = padding;
  let legendY = padding - 30;

  metrics.forEach((metric, idx) => {
    ctx.fillStyle = colors[idx];
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(metric, legendX + 16, legendY + 10);
    legendX += 100;
  });
}

drawCorrelationChart();

// ============================================
// GERAR CONCLUSÕES
// ============================================

function generateConclusions() {
  if (!correlations || !kpis) return;

  const { total, significant, rate } = kpis;

  let statusText = "";
  if (significant >= 8) {
    statusText = "✅ <strong>ALTAMENTE FIDEDIGNO:</strong> O CRS apresenta forte correlação com achados clínicos. Recomenda-se uso em triagem clínica.";
  } else if (significant >= 5) {
    statusText = "✅ <strong>VALIDADO:</strong> O CRS correlaciona adequadamente com avaliação clínica. Pode ser utilizado como ferramenta complementar.";
  } else if (significant >= 3) {
    statusText = "⚠️ <strong>PARCIALMENTE VALIDADO:</strong> Algumas correlações significativas detectadas. Recomenda-se validação adicional.";
  } else {
    statusText = "❌ <strong>NÃO VALIDADO:</strong> Correlações insuficientes. Mais dados necessários para validação.";
  }

  const topCorr = Object.entries(correlations)
    .flatMap(([scale, metrics]) => 
      Object.entries(metrics).map(([metric, corr]) => ({
        scale,
        metric,
        r: corr.r,
        significant: corr.significant
      }))
    )
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];

  const conclusions = `
    <p><strong>Resumo da Validação:</strong></p>
    <p>${statusText}</p>
    
    <p style="margin-top: 12px;"><strong>Estatísticas:</strong></p>
    <ul style="margin-left: 20px; margin-top: 8px;">
      <li>Total de correlações: <strong>${total}</strong></li>
      <li>Correlações significativas (r > 0.5): <strong>${significant}</strong></li>
      <li>Taxa de validação: <strong>${rate}%</strong></li>
      <li>Correlação mais forte: <strong>${topCorr.scale} ↔ ${topCorr.metric} (r = ${topCorr.r.toFixed(3)})</strong></li>
    </ul>

    <p style="margin-top: 12px;"><strong>Recomendações:</strong></p>
    <ul style="margin-left: 20px; margin-top: 8px;">
      <li>Diagnóstico clínico: <strong>${validation.diagnostic.diagnostico || "Não especificado"}</strong></li>
      <li>Confiança do médico: <strong>${validation.diagnostic.confianca}%</strong></li>
      <li>Próximo passo: Assinatura e fechamento do relatório</li>
    </ul>
  `;

  document.getElementById("conclusions").innerHTML = conclusions;
}

generateConclusions();

// ============================================
// BOTÕES
// ============================================

document.getElementById("btnAssinatura").addEventListener("click", () => {
  location.href = `assinatura.html?id=${encodeURIComponent(sessionId)}`;
});

document.getElementById("btnExportJSON").addEventListener("click", () => {
  const exportData = {
    session: {
      id: session.id,
      medico: session.medico,
      paciente: session.paciente,
      data: formatDate(session.start)
    },
    validation: {
      diagnostico: validation.diagnostic.diagnostico,
      confianca: validation.diagnostic.confianca,
      escalas: validation.scales
    },
    correlations: correlations,
    kpis: kpis,
    timestamp: Date.now()
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elayon-dashboard-${session.id}.json`;
  a.click();
});

document.getElementById("btnVoltar").addEventListener("click", () => {
  location.href = `validation.html?id=${encodeURIComponent(sessionId)}`;
});

// ============================================
// INICIALIZAÇÃO
// ============================================

console.log("✅ dashboard.js carregado (PARTE 2/2)");
console.log("📊 Dashboard de correlações ativo");
console.log("🔗 Correlações CRS:", correlations);
console.log("📈 KPIs:", kpis);