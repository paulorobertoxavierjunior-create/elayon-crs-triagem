const KEY_CONFIG = "elayon_crs_config";

function load(){
  try{
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  }catch{}
  return { sampleHz: 10, silenceThr: 0.025, hint: "Config padrão (demo)." };
}
function save(cfg){
  localStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
}

const elHz = document.getElementById("sampleHz");
const elThr = document.getElementById("silenceThr");
const elHint = document.getElementById("hint");

function fill(){
  const cfg = load();
  elHz.value = cfg.sampleHz ?? 10;
  elThr.value = cfg.silenceThr ?? 0.025;
  elHint.value = cfg.hint ?? "";
}
fill();

document.getElementById("btnSave").addEventListener("click", ()=>{
  const cfg = {
    sampleHz: Math.max(1, Math.min(30, Number(elHz.value || 10))),
    silenceThr: Math.max(0.005, Math.min(0.10, Number(elThr.value || 0.025))),
    hint: (elHint.value || "").trim()
  };
  save(cfg);
  alert("Configuração salva.");
});

document.getElementById("btnReset").addEventListener("click", ()=>{
  save({ sampleHz: 10, silenceThr: 0.025, hint: "Config padrão (demo)." });
  fill();
  alert("Padrão restaurado.");
});