const KEY_SESSIONS = "elayon_crs_sessions";

function getParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}
function loadSessions(){
  return JSON.parse(localStorage.getItem(KEY_SESSIONS) || "[]");
}
 
const id = getParam("id");
const sessions = loadSessions();

const single = document.getElementById("single");
const list = document.getElementById("list");

function fmtTime(ts){
  const d = new Date(ts);
  return d.toLocaleString();
}

if (id) {
  const s = sessions.find(x => x.id === id);
  if (!s) {
    alert("Sessão não encontrada.");
    location.href = "report.html";
  }

  single.style.display = "block";
  list.style.display = "none";

  const dur = ( (s.closedAt || Date.now()) - s.start );
  const mins = Math.max(1, Math.round(dur/60000));

  document.getElementById("meta").textContent =
    `ID: ${s.id} • Médico: ${s.medico} • Paciente: ${s.paciente} • Início: ${fmtTime(s.start)} • Status: ${s.status}`;

  const sum = s.summary || {};
  document.getElementById("k1").textContent =
    `amostras: ${sum.samples ?? 0}\npausas: ${((sum.pauseRatio ?? 0)*100).toFixed(1)}%`;
  document.getElementById("k2").textContent =
    `nível médio: ${(sum.avgRms ?? 0).toFixed(4)}\nvariabilidade: ${(sum.variability ?? 0).toFixed(4)}`;

  const cfg = s.configSnapshot || {};
  const notes = cfg.notes ? `\n\nConfig/Protocolo:\n${cfg.notes}` : "";

  const txt =
`ELAYON CRS — RELATÓRIO (DEMO)
Data/hora: ${fmtTime(Date.now())}
Sessão: ${s.id}

Identificação:
- Médico: ${s.medico}
- Paciente: ${s.paciente}
- Contexto: ${s.contexto || "(não informado)"}

Duração aproximada: ${mins} min
Encerramento: ${(s.closeReason || "manual")}
Observação ética: este documento é apoio métrico/visual e NÃO é diagnóstico.

Resumo métrico (heurístico):
- Nível médio (RMS): ${(sum.avgRms ?? 0).toFixed(4)}
- Taxa de pausas (proxy): ${((sum.pauseRatio ?? 0)*100).toFixed(1)}%
- Variabilidade (proxy): ${(sum.variability ?? 0).toFixed(4)}

Interpretação sugerida (para o médico validar):
- Pausas altas podem indicar hesitação, interrupções frequentes ou baixa projeção vocal (avaliar contexto).
- Variabilidade baixa pode sugerir ritmo mais constante; alta pode sugerir oscilação/instabilidade (avaliar contexto).
- Recomenda-se repetir captação com melhor isolamento, se necessário.

${notes}
`;

  const ta = document.getElementById("txt");
  ta.value = txt;

  document.getElementById("btnCopy").addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(ta.value);
      alert("Copiado.");
    }catch{
      ta.select();
      document.execCommand("copy");
      alert("Copiado (modo compatível).");
    }
  });

} else {
  // lista
  const items = document.getElementById("items");
  if (!sessions.length) {
    items.innerHTML = `<p class="muted">Nenhuma sessão salva ainda.</p>`;
  } else {
    items.innerHTML = sessions.slice(0,30).map(s=>{
      const status = s.status === "closed" ? "OK" : "ATIVA";
      return `
        <div class="card soft" style="margin-top:10px">
          <div class="row" style="justify-content:space-between">
            <div>
              <div style="font-weight:800">${s.medico} → ${s.paciente}</div>
              <div class="muted" style="font-size:12px">ID ${s.id} • ${fmtTime(s.start)}</div>
            </div>
            <a class="btn" href="report.html?id=${encodeURIComponent(s.id)}">${status}</a>
          </div>
        </div>
      `;
    }).join("");
  }
}