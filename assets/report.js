/**
 * REPORT.JS — REFATORADO COM CRS
 * PARTE 1: Inicialização, Carregamento e Estrutura Base
 * 
 * Integração: Carrega sessão com CRS embedado + gera relatório científico
 */

// ============================================
// IMPORTS (carregar antes de report.js)
// ============================================
// <script src="../core/clinical-validation/neurologist-assessment.js"></script>
// <script src="../core/clinical-validation/correlation-engine.js"></script>
// <script src="../core/clinical-validation/statistical-report.js"></script>

// ============================================
// CONSTANTES
// ============================================

const KEY_SESSIONS = "elayon_crs_sessions";
const MAX_REPORTS = 10;

// ============================================
// UTILITÁRIOS
// ============================================

function getParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function loadSessions() {
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}

function saveSessions(arr) {
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR");
}

// ============================================
// INSTANCIAR MÓDULOS DE VALIDAÇÃO CLÍNICA
// ============================================

const assessmentModule = new NeurologistAssessment();
const correlationEngine = new CorrelationEngine();
const statisticalReport = new StatisticalReport();

// ============================================
// ELEMENTOS DOM
// ============================================

const id = getParam("id");
const sessions = loadSessions();

const single = document.getElementById("single");
const list = document.getElementById("list");

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function closedOnly(arr) {
  return arr.filter(s => s.status === "closed");
}

function deleteSession(sessionId) {
  const arr = loadSessions();
  const out = arr.filter(s => s.id !== sessionId);
  saveSessions(out);
}

function deleteAllClosed() {
  const arr = loadSessions();
  const out = arr.filter(s => s.status !== "closed");
  saveSessions(out);
}

// ============================================
// GERAÇÃO DE RELATÓRIO COM CRS
// ============================================

function generateCRSReport(session) {
  if (!session.crsVector) {
    return {
      title: "⚠️ CRS Não Disponível",
      content: "Esta sessão foi capturada antes da integração CRS. Dados heurísticos apenas.",
      crsAvailable: false
    };
  }

  const crs = session.crsVector;
  const metrics = session.cognitiveMetrics;
  const validation = session.crsValidation;
  const confidence = session.crsConfidence || 0;

  // Mapear dimensões CRS para interpretações
  const dimensions = [
    { idx: 0, name: "RMS (Energia Vocal)", value: crs[0], unit: "0-1" },
    { idx: 1, name: "Pausa Micro [0-100ms]", value: crs[1], unit: "0-1" },
    { idx: 2, name: "Pausa Curta [100-200ms]", value: crs[2], unit: "0-1" },
    { idx: 3, name: "Pausa Média [200-1s]", value: crs[3], unit: "0-1" },
    { idx: 4, name: "Pausa Longa [1s+]", value: crs[4], unit: "0-1" },
    { idx: 5, name: "Pitch Proxy", value: crs[5], unit: "0-1" },
    { idx: 6, name: "Graves [60-250Hz]", value: crs[6], unit: "0-1" },
    { idx: 7, name: "Inteligibilidade [800-3500Hz]", value: crs[7], unit: "0-1" }
  ];

  // Interpretações clínicas
  let clinicalInterpretation = "";

  if (crs[0] < 0.3) {
    clinicalInterpretation += "• Intensidade vocal fraca: possível fadiga, fraqueza ou baixa projeção.\n";
  } else if (crs[0] > 0.7) {
    clinicalInterpretation += "• Intensidade vocal elevada: possível esforço, urgência ou compensação.\n";
  }

  if (crs[3] > 0.6) {
    clinicalInterpretation += "• Pausas médias frequentes: possível reorganização cognitiva ou hesitação.\n";
  }

  if (crs[4] > 0.4) {
    clinicalInterpretation += "• Pausas longas detectadas: possível fadiga, esforço extremo ou reflexão prolongada.\n";
  }

  if (crs[7] < 0.5) {
    clinicalInterpretation += "• Inteligibilidade reduzida: possível articulação imprecisa ou alteração de fala.\n";
  }

  if (!clinicalInterpretation) {
    clinicalInterpretation = "• Padrão dentro dos limites esperados para fala típica.\n";
  }

  return {
    title: "📊 Análise CRS (Camada de Ritmo e Sinais Temporais)",
    crsAvailable: true,
    confidence: `${(confidence * 100).toFixed(1)}%`,
    dimensions: dimensions,
    clinicalInterpretation: clinicalInterpretation,
    validation: validation,
    metrics: metrics
  };
}

// ============================================
// VISUALIZAÇÃO DE RELATÓRIO ÚNICO
// ============================================

if (id) {
  const s = sessions.find(x => x.id === id);
  if (!s) {
    alert("Relatório não encontrado.");
    location.href = "report.html";
  }

  single.style.display = "block";
  list.style.display = "none";

  const durMs = (s.endedAt || Date.now()) - s.start;
  const mins = Math.max(1, Math.round(durMs / 60000));
  const sum = s.summary || {};

  // Metadados da sessão
  document.getElementById("meta").textContent =
    `ID: ${s.id} • Médico: ${s.medico} • Paciente: ${s.paciente} • Início: ${fmt(s.start)} • Encerrado: ${fmt(s.endedAt || Date.now())} • Motivo: ${s.endReason || "manual"}`;

  // KPIs básicos
  document.getElementById("k1").textContent =
    `duração: ~${mins} min\npausas (proxy): ${((sum.pauseRatio ?? 0) * 100).toFixed(1)}%`;

  document.getElementById("k2").textContent =
    `nível médio (RMS): ${(sum.energiaMedia ?? 0).toFixed(4)}\nvariabilidade: ${(sum.variability ?? 0).toFixed(4)}`;

  // Snapshots dos gráficos
  const snaps = s.snaps || {};
  const imgFft = document.getElementById("imgFft");
  const imgSil = document.getElementById("imgSil");
  const imgOv = document.getElementById("imgOv");
  if (snaps.fft) imgFft.src = snaps.fft;
  if (snaps.sil) imgSil.src = snaps.sil;
  if (snaps.ov) imgOv.src = snaps.ov;

  // Configuração e hints
  const cfg = s.configSnapshot || {};
  const hint = cfg.hint ? `\n\nObservação interna:\n${cfg.hint}` : "";

  // Perguntas do protocolo
  const questions = (s.questions || []).map((q, i) => `  ${i + 1}. ${q}`).join("\n");

  // ============================================
  // GERAR RELATÓRIO COM CRS
  // ============================================

  const crsReport = generateCRSReport(s);

  // Construir texto base do relatório
  const baseText = `
╔════════════════════════════════════════════════════════════════╗
║         ELAYON HEALTH — RELATÓRIO CLÍNICO CRS (DEMO)          ║
╚════════════════════════════════════════════════════════════════╝

📋 DATA E HORA
  ${fmt(Date.now())}

🔐 IDENTIFICAÇÃO DA SESSÃO
  • ID Sessão: ${s.id}
  • Médico Responsável: ${s.medico}
  • Paciente: ${s.paciente}
  • Preset Utilizado: ${s.presetName || "(não informado)"}
  • Contexto Clínico: ${s.contexto || "(não informado)"}

⏱️ DURAÇÃO E PARÂMETROS
  • Duração Aproximada: ${mins} minuto(s)
  • Limite de Gravação (demo): 5 minutos
  • Motivo de Encerramento: ${s.endReason || "manual"}
  • Tokens Consumidos (demo): ${s.tokenConsumed ? "1" : "0"}

📝 PROTOCOLO DE AVALIAÇÃO
${questions || "  (sem perguntas definidas)"}

${crsReport.crsAvailable ? `
📊 ANÁLISE CRS (CAMADA DE RITMO E SINAIS TEMPORAIS)
  
  Confiança da Análise: ${crsReport.confidence}
  
  Dimensões Medidas:
${crsReport.dimensions.map(d => `    • ${d.name}: ${d.value.toFixed(3)} (${d.unit})`).join("\n")}
  
  Interpretação Clínica:
${crsReport.clinicalInterpretation.split("\n").map(line => `    ${line}`).join("\n")}
  
  Status de Validação:
    • Válido: ${crsReport.validation?.valid ? "✅ Sim" : "❌ Não"}
    • Erros: ${(crsReport.validation?.errors || []).join(", ") || "Nenhum"}
    • Avisos: ${(crsReport.validation?.warnings || []).join(", ") || "Nenhum"}
` : `
⚠️ CRS NÃO DISPONÍVEL
  Esta sessão foi capturada antes da integração completa do CRS Engine.
  Dados heurísticos apenas (não validados cientificamente).
`}

⚠️ AVISO ÉTICO E LEGAL
  
  ✓ Este documento é APOIO MÉTRICO/VISUAL apenas.
  ✓ NÃO é diagnóstico automático.
  ✓ A responsabilidade clínica é EXCLUSIVAMENTE do médico.
  ✓ Conformidade: LGPD, GDPR, Resolução CNS 466/2012.
  ✓ Dados anonimizados, sem identificação pessoal.

📊 RESUMO MÉTRICO (HEURÍSTICO)
  • Nível Médio (RMS): ${(sum.energiaMedia ?? 0).toFixed(4)}
  • Silêncio Médio (proxy): ${(sum.pausaMedia ?? 0).toFixed(4)}
  • Taxa de Pausas (proxy): ${((sum.pauseRatio ?? 0) * 100).toFixed(1)}%
  • Variabilidade (proxy): ${(sum.variability ?? 0).toFixed(4)}

💡 SUGESTÕES PARA INTERPRETAÇÃO (MÉDICO VALIDAR)
  • Pausas altas: hesitação, interrupções frequentes ou baixa projeção (avaliar contexto)
  • Variabilidade baixa: ritmo constante; alta: oscilação/instabilidade (avaliar contexto)
  • Se houver ruído: repetir captura com melhor isolamento acústico
  
${hint}

═══════════════════════════════════════════════════════════════════
DIAGNÓSTICO / HIPÓTESE CLÍNICA (PREENCHIMENTO OBRIGATÓRIO DO MÉDICO)
═══════════════════════════════════════════════════════════════════
`;

  const txt = document.getElementById("txt");
  const dx = document.getElementById("dx");

  dx.value = s.dx || "";
  txt.value = baseText + `\n${dx.value || "(pendente)"}\n`;

  function refreshText() {
    txt.value = baseText + `\n${dx.value || "(pendente)"}\n`;
  }

  // ============================================
  // EVENTOS DOS BOTÕES
  // ============================================

  document.getElementById("btnSave").addEventListener("click", () => {
    const value = (dx.value || "").trim();
    if (!value) {
      alert("Diagnóstico/Hipótese é obrigatório para salvar.");
      return;
    }
    const arr = loadSessions();
    const i = arr.findIndex(x => x.id === s.id);
    if (i >= 0) {
      arr[i].dx = value;
      saveSessions(arr);
      alert("✅ Diagnóstico salvo com sucesso.");
      refreshText();
    }
  });

  document.getElementById("btnCopy").addEventListener("click", async () => {
    if (!(dx.value || "").trim()) {
      alert("Preencha o diagnóstico/hipótese antes de copiar o relatório.");
      return;
    }
    refreshText();
    try {
      await navigator.clipboard.writeText(txt.value);
      alert("✅ Relatório copiado para área de transferência.");
    } catch {
      txt.select();
      document.execCommand("copy");
      alert("✅ Relatório copiado (modo compatível).");
    }
  });

  document.getElementById("btnDelete").addEventListener("click", () => {
    if (confirm("Tem certeza que deseja excluir este relatório do dispositivo?")) {
      deleteSession(s.id);
      location.href = "report.html";
    }
  });

} else {
  // ============================================
  // MODO LISTA: EXIBIR TODOS OS RELATÓRIOS
  // ============================================

  const items = document.getElementById("items");
  const btnDeleteAll = document.getElementById("btnDeleteAll");

  btnDeleteAll.addEventListener("click", () => {
    if (confirm("Excluir TODOS os relatórios do dispositivo?")) {
      deleteAllClosed();
      location.reload();
    }
  });

  const closed = closedOnly(sessions).slice(0, MAX_REPORTS);

  if (!closed.length) {
    items.innerHTML = `<p class="muted">Nenhum relatório salvo ainda.</p>`;
  } else {
    items.innerHTML = closed
      .map(s => {
        // Extrair dados CRS se disponível
        const crsConfidence = s.crsConfidence ? `${(s.crsConfidence * 100).toFixed(1)}%` : "N/A";
        const crsStatus = s.crsVector ? "✅ CRS" : "⚠️ Heurístico";

        return `
          <div class="card soft" style="margin-top:10px">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <div style="flex: 1;">
                <div style="font-weight:800">${s.medico} → ${s.paciente}</div>
                <div class="muted" style="font-size:12px;">
                  ID ${s.id} • ${fmt(s.closedAt || s.start)} • ${s.presetName || ""}
                </div>
                <div class="muted" style="font-size:11px; margin-top:4px;">
                  ${crsStatus} • Confiança: ${crsConfidence}
                </div>
              </div>
              <div class="row" style="gap: 8px;">
                <a class="btn" href="report.html?id=${encodeURIComponent(s.id)}">Abrir</a>
                <button class="btn danger" data-del="${s.id}">Excluir</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    items.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-del");
        if (confirm("Excluir este relatório?")) {
          deleteSession(sid);
          location.reload();
        }
      });
    });
  }

  // Aviso de limite
  const count = closedOnly(sessions).length;
  if (count >= MAX_REPORTS) {
    const p = document.createElement("p");
    p.className = "muted";
    p.style.color = "#f59e0b";
    p.style.fontWeight = "600";
    p.textContent = `⚠️ Limite atingido: ${MAX_REPORTS}/${MAX_REPORTS}. Exclua relatórios para gerar novos.`;
    items.prepend(p);
  }

  // Estatísticas gerais
  const statsDiv = document.createElement("div");
  statsDiv.className = "card soft";
  statsDiv.style.marginBottom = "16px";
  statsDiv.style.background = "#f0f9ff";
  statsDiv.style.borderLeft = "4px solid #0284c7";

  const totalSessions = sessions.length;
  const closedCount = closed.length;
  const crsCount = closed.filter(s => s.crsVector).length;
  const avgConfidence = crsCount > 0
    ? (closed.filter(s => s.crsVector).reduce((a, b) => a + (b.crsConfidence || 0), 0) / crsCount * 100).toFixed(1)
    : "N/A";

  statsDiv.innerHTML = `
    <div style="font-weight: 800; margin-bottom: 8px;">📊 Estatísticas Gerais</div>
    <div class="muted" style="font-size: 13px; line-height: 1.6;">
      • Total de sessões: ${totalSessions}<br/>
      • Relatórios fechados: ${closedCount}<br/>
      • Com análise CRS: ${crsCount}<br/>
      • Confiança média CRS: ${avgConfidence}%
    </div>
  `;
  items.prepend(statsDiv);
}

