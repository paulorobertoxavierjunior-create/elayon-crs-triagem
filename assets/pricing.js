// assets/pricing.js
document.addEventListener("DOMContentLoaded", ()=>{
  ELAYON.requireLogin();

  const $ = (id)=>document.getElementById(id);

  function render(){
    const t = ELAYON.getTokens();
    $("kTokens").textContent = `tokens: ${t.tokens}`;
  }
  render();

  $("btnBuy").addEventListener("click", ()=>{
    // simulação de checkout
    const t = ELAYON.getTokens();
    t.tokens = (t.tokens||0) + 10;
    t.updatedAt = Date.now();
    ELAYON.setTokens(t);
    render();
    alert("Checkout simulado: +10 tokens (R$0,01 fictício).");
  });

  $("btnAdd1").addEventListener("click", ()=>{
    const t = ELAYON.getTokens();
    t.tokens = (t.tokens||0) + 1;
    t.updatedAt = Date.now();
    ELAYON.setTokens(t);
    render();
  });

  $("btnReset").addEventListener("click", ()=>{
    const ok = confirm("Zerar tokens (demo)?");
    if(!ok) return;
    ELAYON.setTokens({ tokens: 0, updatedAt: Date.now() });
    render();
  });
});