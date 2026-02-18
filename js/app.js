function iniciarSessao() {

  let medico = document.getElementById("medico").value;
  let paciente = document.getElementById("paciente").value;

  if (!medico || !paciente) {
    alert("Preencha os campos");
    return;
  }

  let sessao = {
    medico,
    paciente,
    inicio: Date.now()
  };

  localStorage.setItem("sessaoCRS", JSON.stringify(sessao));

  window.location = "sessao.html";
}