// assets/dashboard.js
document.addEventListener("DOMContentLoaded", ()=>{
  ELAYON.requireLogin();

  const PRESETS = [
    { name:"Afasia (triagem)", questions:[
      "Diga seu nome completo e sua idade.",
      "Conte o que você fez hoje desde que acordou (30–60s).",
      "Repita: 'Hoje eu vim fazer uma avaliação de fala'.",
      "Nomeie objetos simples ao redor (mesa, cadeira, porta).",
      "Conte de 20 até 1 em voz alta."
    ]},
    { name:"Pós-AVC (fala)", questions:[
      "Descreva a queixa principal com suas palavras (30–60s).",
      "Repita uma frase simples (articulação): 'A vida é feita de passos'.",
      "Leia em voz alta uma frase curta (se possível).",
      "Nomeie 5 objetos do ambiente.",
      "Conte de 1 até 20."
    ]},
    { name:"Disartria / articulação", questions:[
      "Fale uma frase longa sem parar (fôlego).",
      "Repita: 'três pratos de trigo para três tigres tristes'.",
      "Leia uma frase curta (se possível).",
      "Conte de 20 até 1.",
      "Descreva sua queixa principal (30–60s)."
    ]},
    { name:"Cognição/atenção (fala)", questions:[
      "Conte como foi seu dia (30–60s).",
      "Diga os meses do ano ao contrário (se conseguir).",
      "Liste 5 animais (rápido).",
      "Repita uma frase curta.",
      "Explique uma tarefa simples (ex: fazer café)."
    ]}
  ];

  const $ = (id)=>document.getElementById(id);

  const elDisease = $("disease");
  const elMin = $("sessionMinutes");
  const elHz = $("sampleHz");
  const elBands = $("bands");
  const elQuestions = $("questions");
  const elConsentRequired = $("consentRequired");
  const elConsentText = $("consentText");

  function fillPresets(){
    elDisease.innerHTML = PRESETS.map(p=>`<option value="${p.name}">${p.name}</option>`).join("");
  }
  fillPresets();

  function load(){
    return ELAYON.ensureConfig();
  }

  function apply(cfg){
    elDisease.value = cfg.disease || PRESETS[0].name;
    elMin.value = cfg.sessionMinutes ?? 20;
    elHz.value = cfg.sampleHz ?? 12;
    elBands.value = String(cfg.bands ?? 8);
    elQuestions.value = (cfg.questions || []).join("\n");
    elConsentRequired.checked = (cfg.consentRequired ?? true);
    elConsentText.value = cfg.consentText || cfg.consentText === "" ? cfg.consentText : cfg.consentText;
    if (!elConsentText.value){
      elConsentText.value = "Confirmo que houve consentimento livre e esclarecido do paciente (TCLE) para captação de voz nesta sessão.";
    }
  }

  const cfg0 = load();
  apply(cfg0);

  elDisease.addEventListener("change", ()=>{
    const p = PRESETS.find(x=>x.name===elDisease.value);
    if (p) elQuestions.value = p.questions.join("\n");
  });

  $("btnSave").addEventListener("click", ()=>{
    const cfg = {
      disease: elDisease.value,
      sessionMinutes: Number(elMin.value || 20),
      sampleHz: Number(elHz.value || 12),
      bands: Number(elBands.value || 8),
      questions: (elQuestions.value||"").split("\n").map(s=>s.trim()).filter(Boolean),
      consentRequired: !!elConsentRequired.checked,
      consentText: (elConsentText.value||"").trim()
    };
    ELAYON.writeJSON(ELAYON.KEYS.CONFIG, cfg);
    alert("Configuração salva.");
  });

  $("btnReset").addEventListener("click", ()=>{
    localStorage.removeItem(ELAYON.KEYS.CONFIG);
    const cfg = ELAYON.ensureConfig();
    cfg.bands = 8;
    cfg.consentRequired = true;
    ELAYON.writeJSON(ELAYON.KEYS.CONFIG, cfg);
    apply(cfg);
    alert("Padrão restaurado.");
  });
});