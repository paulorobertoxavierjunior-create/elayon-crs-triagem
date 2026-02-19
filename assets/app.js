// assets/app.js
document.addEventListener("DOMContentLoaded", ()=>{
  const doc = ELAYON.requireLogin();
  if(!doc) return;

  // sair
  const btnSair = document.getElementById("btnSair");
  if (btnSair){
    btnSair.addEventListener("click", (e)=>{
      e.preventDefault();
      ELAYON.clearDoctor();
      location.href = "login.html";
    });
  }

  const tokens = ELAYON.getTokens();
  const cfg = ELAYON.ensureConfig();
  const sessions = ELAYON.readJSON(ELAYON.KEYS.SESSIONS, []);

  const who = document.getElementById("who");
  if (who) who.innerHTML = `<b>Médico:</b> ${doc.nome} • <b>CRM:</b> ${doc.crm} • <b>E-mail:</b> ${doc.email}`;

  const kTokens = document.getElementById("kTokens");
  if (kTokens) kTokens.textContent = `tokens: ${tokens.tokens}`;

  const kCfg = document.getElementById("kCfg");
  if (kCfg) kCfg.textContent = `config: ${cfg.disease} • ${cfg.sessionMinutes}min • ${cfg.sampleHz}Hz`;

  const kSessions = document.getElementById("kSessions");
  if (kSessions) kSessions.textContent = `sessões: ${sessions.length}`;
});