const KEY_CONFIG = "elayon_crs_config";

function load(){
  try{
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) return JSON.parse(raw);
  }catch{}
  return { sessionMinutes: 30, sampleHz: 10, notes: "Config padrão (demo)." };
}
 
function save(cfg){
  localStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
}

const elMin = document.getElementById("sessionMinutes");
const elHz  = document.getElementById("sampleHz");
const elNotes = document.getElementById("notes");

function fill(){
  const cfg = load();
  elMin.value = cfg.sessionMinutes ?? 30;
  elHz.value  = cfg.sampleHz ?? 10;
  elNotes.value = cfg.notes ?? "";
}
fill();

document.getElementById("btnSave").addEventListener("click", ()=>{
  const cfg = {
    sessionMinutes: Number(elMin.value || 30),
    sampleHz: Number(elHz.value || 10),
    notes: (elNotes.value || "").trim()
  };
  save(cfg);
  alert("Configuração salva.");
});

document.getElementById("btnReset").addEventListener("click", ()=>{
  save({ sessionMinutes: 30, sampleHz: 10, notes: "Config padrão (demo)." });
  fill();
  alert("Padrão restaurado.");
});