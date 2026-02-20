const KEY_TOKENS = "elayon_demo_tokens";

function loadTokens(){
  try{ return Number(localStorage.getItem(KEY_TOKENS) || "0"); }catch{ return 0; }
}
function saveTokens(n){
  localStorage.setItem(KEY_TOKENS, String(Math.max(0, Math.floor(n))));
}

const kBalance = document.getElementById("kBalance");
function refresh(){
  kBalance.textContent = `saldo: ${loadTokens()} tokens`;
}
refresh();

document.querySelectorAll("[data-add]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const add = Number(btn.getAttribute("data-add") || "0");
    saveTokens(loadTokens() + add);
    refresh();
  });
});

document.getElementById("btnReset").addEventListener("click", ()=>{
  if(confirm("Zerar saldo de tokens (demo)?")){
    saveTokens(0);
    refresh();
  }
});

document.getElementById("btnFakePay").addEventListener("click", ()=>{
  alert("Demo: pagamento simulado. Na versão real, aqui entrará Pix/CPF e confirmação.");
});