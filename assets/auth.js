const KEY_DOCTOR = "elayon_crs_doctor";

function $(id){ return document.getElementById(id); }

function saveDoctor(doc){
  localStorage.setItem(KEY_DOCTOR, JSON.stringify(doc));
}

function loadDoctor(){
  try{
    const raw = localStorage.getItem(KEY_DOCTOR);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function clearForm(){
  $("nome").value = "";
  $("email").value = "";
  $("senha").value = "";
}

function goHome(){
  location.href = "home.html";
}

document.addEventListener("DOMContentLoaded", ()=>{
  const doc = loadDoctor();
  if (doc?.name && doc?.email) {
    // já logado → vai direto pro início
    goHome();
    return;
  }

  $("btnEntrar").addEventListener("click", ()=>{
    const name = ($("nome").value || "").trim();
    const email = ($("email").value || "").trim();
    const pass = ($("senha").value || "").trim();

    if (!name || !email || !pass) {
      alert("Preencha nome, e-mail e senha.");
      return;
    }

    // Login DEMO (local) — depois você troca por backend/CRM/etc.
    saveDoctor({
      name,
      email,
      role: "doctor",
      loggedAt: Date.now()
    });

    goHome();
  });

  $("btnLimpar").addEventListener("click", clearForm);
});