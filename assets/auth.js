// assets/auth.js
import { KEY_AUTH, saveJSON, loadJSON } from "./app.js";

const elNome = document.getElementById("nome");
const elEmail = document.getElementById("email");
const elCrm = document.getElementById("crm");
const elSenha = document.getElementById("senha");

const btnEntrar = document.getElementById("btnEntrar");
const btnDemo = document.getElementById("btnDemo");

// se já está logado, vai direto
const existing = loadJSON(KEY_AUTH, null);
if (existing?.email) {
  location.href = "home.html";
}

btnDemo?.addEventListener("click", () => {
  elNome.value = "Dr. Paulo (demo)";
  elEmail.value = "demo@elayon.com";
  elCrm.value = "CRM-AM 00000";
  elSenha.value = "1234";
});

btnEntrar?.addEventListener("click", () => {
  const nome = (elNome.value || "").trim();
  const email = (elEmail.value || "").trim();
  const crm = (elCrm.value || "").trim();
  const senha = (elSenha.value || "").trim();

  if (!nome || !email || !senha) {
    alert("Preencha Nome, E-mail e Senha.");
    return;
  }

  // DEMO: sem validação servidor. Depois vira backend/checkout real.
  saveJSON(KEY_AUTH, {
    nome, email, crm,
    createdAt: Date.now()
  });

  location.href = "home.html";
});