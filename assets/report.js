// assets/report.js
document.addEventListener("DOMContentLoaded", ()=>{
  ELAYON.requireLogin();

  const $ = (id)=>document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const id = params.get("id");

  const sessions = ELAYON.readJSON(ELAYON.KEYS.SESSIONS, []);
  const single = $("single");
  const list = $("list");

  function fmtTime(ts){
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function buildText(s, diagText){
    const sum = s.summary || {};
    const cfg = s.configSnapshot || {};
    const bandAvg = sum.bandAvg || [];

    const bandsTxt = bandAvg.length
      ? `Bandas (médias):
- 20–60Hz: ${(bandAvg[0]||0).toFixed(4)}
- 60–120Hz: ${(bandAvg[1]||0).toFixed(4)}
- 120–250Hz: ${(bandAvg[2]||0).toFixed(4)}
- 250–500Hz: ${(bandAvg[3]||0).toFixed(4)}
- 500–1kHz: ${(bandAvg[4]||0).toFixed(4)}
- 1–2kHz: ${(bandAvg[5]||0).toFixed(4)}
- 2–4kHz: ${(bandAvg[6]||0).toFixed(4)}
` : "";

    return `ELAYON HEALTH • CRS — RELATÓRIO (DEMO)
Gerado em: ${fmtTime(Date.now())}
Sessão: ${s.id}

Identificação do médico:
- Nome: ${s.doctor?.nome || "-"}
- CRM: ${s.doctor?.crm || "-"}
- E-mail: ${s.doctor?.email || "-"}

Identificação do paciente:
- Paciente: ${s.paciente || "-"}
- Contexto: ${s.contexto || "(não informado)"}

Configuração (snapshot):
- Preset: ${cfg.disease || "-"}
- Duração máxima: ${cfg.sessionMinutes || "-"} min
- Amostragem: ${cfg.sampleHz || "-"} Hz
- Linhas overlay: ${cfg.bands || "-"}

Resumo métrico (heurístico / apoio):
- Amostras: ${sum.samples ?? 0}
- Nível médio (RMS): ${(sum.avgRms ?? 0).toFixed(4)}
- Silêncio médio (proxy): ${(sum.avgSilence ?? 0).toFixed(4)}
- Taxa de pausas “altas” (proxy): ${(((sum.pauseRatio ?? 0)*100)).toFixed(1)}%
- Variabilidade (RMS): ${(sum.variability ?? 0).toFixed(4)}

${bandsTxt}
Diagnóstico do médico (manual, obrigatório):
${diagText}

Ética:
- Este relatório NÃO é diagnóstico automático.
- Evidência visual/métrica é apoio. A conclusão clínica é do médico.
`;
  }

  if (id){
    const s = sessions.find(x=>x.id===id);
    if(!s){ alert("Sessão não encontrada."); location.href="report.html"; return; }

    single.style.display="block";
    list.style.display="none";

    $("meta").textContent =
      `ID: ${s.id} • Médico: ${s.doctor?.nome} (${s.doctor?.crm}) • Paciente: ${s.paciente} • Encerrada: ${fmtTime(s.endedAt||Date.now())} • Motivo: ${s.closeReason||"-"}`;

    const sum = s.summary || {};
    $("k1").textContent = `amostras: ${sum.samples ?? 0}\npausas altas: ${(((sum.pauseRatio ?? 0)*100)).toFixed(1)}%`;
    $("k2").textContent = `RMS médio: ${(sum.avgRms ?? 0).toFixed(4)}\nvariabilidade: ${(sum.variability ?? 0).toFixed(4)}`;

    // imagens
    $("imgSound").src = s.charts?.sound || "";
    $("imgSil").src = s.charts?.silence || "";
    $("imgOv").src = s.charts?.overlay || "";

    const diag = $("diag");
    const txt = $("txt");

    function refreshText(){
      txt.value = buildText(s, (diag.value||"").trim() || "(não preenchido)");
    }
    refreshText();
    diag.addEventListener("input", refreshText);

    $("btnCopy").addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(txt.value);
        alert("Copiado.");
      }catch{
        txt.select(); document.execCommand("copy");
        alert("Copiado (compat).");
      }
    });

    $("btnFinalize").addEventListener("click", ()=>{
      const d = (diag.value||"").trim();
      if(!d) return alert("Diagnóstico obrigatório (manual).");

      // salva diagnóstico + assina
      s.diagnosis = d;
      s.signedAt = Date.now();
      s.signedBy = { nome: s.doctor?.nome, crm: s.doctor?.crm };

      // atualiza storage
      const idx = sessions.findIndex(x=>x.id===s.id);
      sessions[idx] = s;
      ELAYON.writeJSON(ELAYON.KEYS.SESSIONS, sessions);

      refreshText();
      alert("Relatório finalizado e assinado (demo).");
    });

  } else {
    // lista
    const items = $("items");
    if(!sessions.length){
      items.innerHTML = `<p class="muted">Nenhuma sessão salva ainda.</p>`;
      return;
    }
    items.innerHTML = sessions.slice(0,30).map(s=>{
      const status = s.signedAt ? "ASSINADO" : "ABERTO";
      return `
        <div class="card soft" style="margin-top:10px">
          <div class="row">
            <div>
              <div style="font-weight:900">${s.doctor?.nome || "Médico"} → ${s.paciente || "Paciente"}</div>
              <div class="muted" style="font-size:12px">ID ${s.id} • ${fmtTime(s.endedAt||s.createdAt)}</div>
              <div class="muted" style="font-size:12px">Preset: ${(s.configSnapshot?.disease||"-")} • ${status}</div>
            </div>
            <a class="btn" href="report.html?id=${encodeURIComponent(s.id)}">Abrir</a>
          </div>
        </div>
      `;
    }).join("");
  }
});