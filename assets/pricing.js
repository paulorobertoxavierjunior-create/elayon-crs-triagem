const KEY_PRICING = "elayon_crs_pricing";
function load(){
  try{
    const raw = localStorage.getItem(KEY_PRICING);
    if (raw) return JSON.parse(raw);
  }catch{}
  return { tokenValue: 10.00, sessionLimit: 30 };
}
function save(v){
  localStorage.setItem(KEY_PRICING, JSON.stringify(v));
}

const t = document.getElementById("tokenValue");
const s = document.getElementById("sessionLimit");
const cfg = load();
t.value = cfg.tokenValue;
s.value = cfg.sessionLimit;

document.getElementById("btnSavePrice").addEventListener("click", ()=>{
  save({ tokenValue: Number(t.value||0), sessionLimit: Number(s.value||30) });
  alert("Salvo.");
});

document.getElementById("btnFakeCheckout").addEventListener("click", ()=>{
  const v = Number(t.value||0).toFixed(2);
  alert(`Checkout (demo): cobraria R$ ${v} por sessão.\n\nIntegração real (Pix/checkout) entra na próxima etapa.`);
});