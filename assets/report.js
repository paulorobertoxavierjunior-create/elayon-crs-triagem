const KEY_SESSIONS = "elayon_crs_sessions";
const MAX_REPORTS = 10;

function getParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}
function loadSessions(){
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}
function saveSessions(arr){
  localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
}
function fmt(ts){
  const d = new Date(ts);
  return d.toLocaleString();
}

const id = getParam("id");
const sessions = loadSessions();

const single = document.getElementById("single");
const list = document.getElementById("list");

function closedOnly(arr){
  return arr.filter(s => s.status === "closed");
}

function deleteSession(sessionId){
  const arr = loadSessions();
  const out = arr.filter(s => s.id !== sessionId);
  saveSessions(out);
}

function deleteAllClosed(){
  const arr = loadSessions();
  const out = arr.filter(s => s.status !== "closed");
  saveSessions(out);
}

if (id) {
  const s = sessions.find(x => x.id === id);
  if (!s) {
    alert("Relatório não encontrado.");
    location.href = "report.html";
  }

  single.style.display = "block";
  list.style.display = "none";

  const durMs = ((s.closedAt || Date.now()) - s.start);
  const mins = Math.max(1, Math.round(durMs/60000));
  const sum = s.summary || {};

  document.getElementById("meta").textContent =
    `ID: ${s.id} • Médico: ${s.medico} • Paciente: ${s.paciente} • Início: ${fmt(s.start)} • Encerrado: ${fmt(s.closedAt || Date.now())} • Motivo: ${s.closeReason || "manual"}`;

  document.getElementById("k1").textContent =
    `duração: ~${mins} min\npausas (proxy): ${((sum.pauseRatio ?? 0)*100).toFixed(1)}%`;

  document.getElementById("k2").textContent =
    `nível médio (RMS): ${(sum.avgRms ?? 0).toFixed(4)}\nvariabilidade: ${(sum.variability ?? 0).toFixed(4)}`;

  // imagens congeladas
  const snaps = s.snaps || {};
  const imgFft = document.getElementById("imgFft");
  const imgSil = document.getElementById("imgSil");
  const imgOv = document.getElementById("imgOv");
  if(snaps.fft) imgFft.src = snaps.fft;
  if(snaps.sil) imgSil.src = snaps.sil;
  if(snaps.ov) imgOv.src = snaps.ov;

  const cfg = s.configSnapshot || {};
  const hint = cfg.hint ? `\n\nObservação interna:\n${cfg.hint}` : "";

  const questions = (s.questions || []).map((q,i)=>`  ${i+1}. ${q}`).join("\n");

  const baseText =
`ELAYON HEALTH — CRS (DEMO)
Data/hora: ${fmt(Date.now())}
Sessão: ${s.id}

Identificação:
- Médico: ${s.medico}
- Paciente: ${s.paciente}
- Preset: ${s.presetName || "(não informado)"}
- Contexto: ${s.contexto || "(não informado)"}

Protocolo sugerido (editável pelo médico):
${questions || "(sem perguntas)"}

Duração aproximada: ${mins} min
Registro máximo: 5 min (demo)
Encerramento: ${(s.closeReason || "manual")}
Token consumido (demo): ${s.tokenConsumed ? "1" : "0"}

Observação ética:
- Este documento é apoio métrico/visual e NÃO é diagnóstico automático.
- A responsabilidade clínica é do médico.

Resumo métrico (heurístico):
- Nível médio (RMS): ${(sum.avgRms ?? 0).toFixed(4)}
- Silêncio médio (proxy): ${(sum.avgSilence ?? 0).toFixed(4)}
- Taxa de pausas (proxy): ${((sum.pauseRatio ?? 0)*100).toFixed(1)}%
- Variabilidade (proxy): ${(sum.variability ?? 0).toFixed(4)}

Interpretação sugerida (para o médico validar):
- Pausas altas podem indicar hesitação, interrupções frequentes ou baixa projeção vocal (avaliar contexto).
- Variabilidade baixa pode sugerir ritmo mais constante; alta pode sugerir oscilação/instabilidade (avaliar contexto).
- Se houver ruído, repetir captação com melhor isolamento.

${hint}
`;

  const txt = document.getElementById("txt");
  const dx = document.getElementById("dx");

  dx.value = s.dx || "";
  txt.value = baseText + `\n\nDIAGNÓSTICO/HIPÓTESE (médico):\n${dx.value || "(pendente)"}\n`;

  function refreshText(){
    txt.value = baseText + `\n\nDIAGNÓSTICO/HIPÓTESE (médico):\n${dx.value || "(pendente)"}\n`;
  }

  document.getElementById("btnSave").addEventListener("click", ()=>{
    const value = (dx.value || "").trim();
    if(!value){
      alert("Diagnóstico/Hipótese é obrigatório.");
      return;
    }
    const arr = loadSessions();
    const i = arr.findIndex(x=>x.id===s.id);
    if(i>=0){
      arr[i].dx = value;
      saveSessions(arr);
      alert("Diagnóstico salvo.");
      refreshText();
    }
  });

  document.getElementById("btnCopy").addEventListener("click", async ()=>{
    // exige dx preenchido para copiar (padrão profissional)
    if(!(dx.value||"").trim()){
      alert("Preencha o diagnóstico/hipótese antes de copiar o relatório.");
      return;
    }
    refreshText();
    try{
      await navigator.clipboard.writeText(txt.value);
      alert("Copiado.");
    }catch{
      txt.select();
      document.execCommand("copy");
      alert("Copiado (modo compatível).");
    }
  });

  document.getElementById("btnDelete").addEventListener("click", ()=>{
    if(confirm("Excluir este relatório do dispositivo?")){
      deleteSession(s.id);
      location.href = "report.html";
    }
  });

} else {
  const items = document.getElementById("items");
  const btnDeleteAll = document.getElementById("btnDeleteAll");

  btnDeleteAll.addEventListener("click", ()=>{
    if(confirm("Excluir TODOS os relatórios do dispositivo?")){
      deleteAllClosed();
      location.reload();
    }
  });

  const closed = closedOnly(sessions).slice(0, MAX_REPORTS);

  if(!closed.length){
    items.innerHTML = `<p class="muted">Nenhum relatório salvo ainda.</p>`;
  } else {
    items.innerHTML = closed.map(s=>{
      return `
        <div class="card soft" style="margin-top:10px">
          <div class="row" style="justify-content:space-between">
            <div>
              <div style="font-weight:800">${s.medico} → ${s.paciente}</div>
              <div class="muted" style="font-size:12px">ID ${s.id} • ${fmt(s.closedAt || s.start)} • ${s.presetName || ""}</div>
            </div>
            <div class="row">
              <a class="btn" href="report.html?id=${encodeURIComponent(s.id)}">Abrir</a>
              <button class="btn danger" data-del="${s.id}">Excluir</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    items.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const sid = btn.getAttribute("data-del");
        if(confirm("Excluir este relatório?")){
          deleteSession(sid);
          location.reload();
        }
      });
    });
  }

  // aviso de limite
  const count = closedOnly(sessions).length;
  if(count >= MAX_REPORTS){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `Limite atingido: ${MAX_REPORTS}/${MAX_REPORTS}. Exclua relatórios para gerar novos.`;
    items.prepend(p);
  }
}