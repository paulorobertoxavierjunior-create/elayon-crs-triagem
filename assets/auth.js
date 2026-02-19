// assets/auth.js
const KEY_AUTH = "elayon_auth_doctor";
const KEY_TOKENS = "elayon_tokens_balance";

function $(id){ return document.getElementById(id); }

function saveDoctor(doctor){
  localStorage.setItem(KEY_AUTH, JSON.stringify(doctor));
  // demo: inicia com 0 tokens se não existir
  if (localStorage.getItem(KEY_TOKENS) == null) {
    localStorage.setItem(KEY_TOKENS, JSON.stringify({ tokens: 0, updatedAt: Date.now() }));
  }
}

function clearForm(){
  ["nome","email","senha","crm"].forEach(id => { if($(id)) $(id).value = ""; });
  if ($("aceite")) $("aceite").checked = false;
}

function validate(){
  const nome = ($("nome")?.value || "").trim();
  const email = ($("email")?.value || "").trim();
  const senha = ($("senha")?.value || "").trim();
  const crm = ($("crm")?.value || "").trim();
  const aceite = !!$("aceite")?.checked;

  if (!nome) return { ok:false, msg:"Informe o nome do médico." };
  if (!email || !email.includes("@")) return { ok:false, msg:"Informe um e-mail válido." };
  if (!senha || senha.length < 4) return { ok:false, msg:"Senha muito curta (mínimo 4 caracteres) — demo." };
  if (!aceite) return { ok:false, msg:"Você precisa confirmar o termo de responsabilidade (demo)." };

  return { ok:true, doctor: { nome, email, crm, loggedAt: Date.now() } };
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnEntrar")?.addEventListener("click", () => {
    const v = validate();
    if (!v.ok) return alert(v.msg);

    saveDoctor(v.doctor);
    // Vai para a página principal do CRS
    location.href = "index.html";
  });

  $("btnLimpar")?.addEventListener("click", clearForm);
});