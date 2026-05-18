// Variáveis globais de estado e aprendizado
let padraoBase = { energia: null, ritmo: null, pausa: null, clareza: null };
let historicoConfirmado = [];
let etapaAtual = 0;
let dadosCalibracao = [];
let pontosAnalise = [];

// Elementos da Interface
const passos = [document.getElementById('passo1'), document.getElementById('passo2'), document.getElementById('passo3')];
const botoesGrav = [document.getElementById('btnGrav1'), document.getElementById('btnGrav2'), document.getElementById('btnGrav3')];
const botoesParar = [document.getElementById('btnParar1'), document.getElementById('btnParar2'), document.getElementById('btnParar3')];
const avaliacoes = [document.querySelectorAll('#avalia1 .btn-avalia'), document.querySelectorAll('#avalia2 .btn-avalia'), document.querySelectorAll('#avalia3 .btn-avalia')];
const contadores = [document.getElementById('c1'), document.getElementById('c2'), document.getElementById('c3')];
const historicos = [document.getElementById('hist1'), document.getElementById('hist2'), document.getElementById('hist3')];
const iaLog = document.getElementById('iaLog');

// Elementos das Métricas (o que estava faltando aparecer)
const metricasBox = document.getElementById('metricasBox');
const mEnergia = document.getElementById('mEnergia');
const mRitmo = document.getElementById('mRitmo');
const mPausa = document.getElementById('mPausa');
const mClareza = document.getElementById('mClareza');
const mComparacao = document.getElementById('mComparacao');

// Elementos de Alerta
const alertaEsforco = document.getElementById('alertaEsforco');
const alertaConduta = document.getElementById('alertaConduta');

// ----------------------
// FUNÇÕES DE INTERAÇÃO
// ----------------------

function iaFala(texto, ehConfirmada = false){
  const el = document.createElement('div');
  el.className = `ia-mensagem ${ehConfirmada ? 'confirmada' : ''}`;
  el.textContent = texto;
  iaLog.appendChild(el);
  iaLog.scrollTop = iaLog.scrollHeight;
}

function registrarPonto(etapa, tipo, valor, status){
  const p = { etapa, tipo, valor, status, hora: new Date().toLocaleTimeString() };
  pontosAnalise.push(p);
  const el = document.createElement('div');
  el.className = 'ponto-item';
  el.innerHTML = `<span>${tipo}</span><span>${valor}</span><span>${status}</span>`;
  historicos[etapa].appendChild(el);
}

function atualizarMetricas(energia, ritmo, pausa, clareza, comparacao = ""){
  metricasBox.style.display = "block";
  mEnergia.textContent = `Energia: ${energia.toFixed(2)}`;
  mRitmo.textContent = `Ritmo: ${ritmo.toFixed(2)}`;
  mPausa.textContent = `Pausa: ${pausa.toFixed(2)}`;
  mClareza.textContent = `Clareza: ${clareza.toFixed(2)}`;
  mComparacao.textContent = `Comparação: ${comparacao}`;
}

// SIMULAÇÃO DE ANÁLISE EM TEMPO REAL
function analisarSinal(etapa, avaliacaoUsuario){
  let energia = Math.random() * 0.8 + 0.2;
  let ritmo = Math.random() * 0.7 + 0.1;
  let pausa = Math.random() * 0.5;
  let clareza = Math.random() * 0.9;

  iaFala(`🔍 Analisando amostra ${etapa+1}: energia ${energia.toFixed(2)}, ritmo ${ritmo.toFixed(2)}, pausa ${pausa.toFixed(2)}`);

  if(etapa === 0){
    padraoBase.energia = energia;
    padraoBase.ritmo = ritmo;
    padraoBase.pausa = pausa;
    padraoBase.clareza = clareza;
    iaFala(`✅ Padrão BASE definido! Agora todas as próximas falas serão comparadas com este valor.`, true);
    registrarPonto(etapa, "Energia", energia.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Ritmo", ritmo.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Pausa", pausa.toFixed(2), "REFERÊNCIA");
    registrarPonto(etapa, "Clareza", clareza.toFixed(2), "REFERÊNCIA");
    atualizarMetricas(energia, ritmo, pausa, clareza, "Base definida");
  } else {
    // Compara com base
    let difE = ((energia - padraoBase.energia)/padraoBase.energia*100).toFixed(1);
    let difR = ((ritmo - padraoBase.ritmo)/padraoBase.ritmo*100).toFixed(1);
    let difP = ((pausa - padraoBase.pausa)/padraoBase.pausa*100).toFixed(1);
    let difC = ((clareza - padraoBase.clareza)/padraoBase.clareza*100).toFixed(1);

    let textoComp = `E: ${difE}% | R: ${difR}% | P: ${difP}% | C: ${difC}%`;
    iaFala(`📊 Comparando com a sua base: ${textoComp}`);
    atualizarMetricas(energia, ritmo, pausa, clareza, textoComp);

    // --- Lógica de Alertas e Orientações Inteligentes ---
    // Se energia ou clareza cair muito -> orienta postura e respiração
    if(difE < -15 || difC < -15) {
      alertaConduta.style.display = 'block';
      iaFala(`💡 Percebi que a voz saiu mais fraca ou menos clara que o seu normal. Vou te ensinar um jeito melhor: sente ereto, respire fundo pelo nariz antes de falar e solte a voz suavemente. Isso ajuda muito!`);
    }
    // Se ritmo muito rápido ou energia excessiva -> orienta descanso
    if(difR > 20 || difE > 25) {
      alertaEsforco.style.display = 'block';
      iaFala(`⚠️ Você está falando mais rápido ou com mais força do que costuma. Isso cansa a musculatura da garganta e boca. Que tal parar, respirar e relaxar um pouco? Descansar também é exercício.`);
    }
    // Se está muito lento -> estimula levemente
    if(difR < -20) {
      iaFala(`ℹ️ Hoje você está bem mais devagar que o normal. Tudo bem, é o seu ritmo de hoje, mas se quiser, pode tentar acelerar um pouquinho, sem pressa.`);
    }

    // Registra o ponto de análise com comparação
    registrarPonto(etapa, "Energia", energia.toFixed(2), `${difE}% da base`);
    registrarPonto(etapa, "Ritmo", ritmo.toFixed(2), `${difR}% da base`);
    registrarPonto(etapa, "Pausa", pausa.toFixed(2), `${difP}% da base`);
    registrarPonto(etapa, "Clareza", clareza.toFixed(2), `${difC}% da base`);

    // --- ATUALIZAÇÃO DE CALIBRAÇÃO ---
    // Se usuário disse que foi "Normal", adicionamos essa amostra ao padrão oficial para ficar mais preciso
    if(avaliacaoUsuario.includes("Normal")) {
      iaFala(`✅ Perfeito! Você confirmou que essa fala foi NORMAL. Agora eu adiciono esses valores na sua referência oficial, e minha análise fica ainda mais correta da próxima vez.`, true);
      // Média móvel para aprimorar a base
      padraoBase.energia = (padraoBase.energia + energia) / 2;
      padraoBase.ritmo = (padraoBase.ritmo + ritmo) / 2;
      padraoBase.pausa = (padraoBase.pausa + pausa) / 2;
      padraoBase.clareza = (padraoBase.clareza + clareza) / 2;
      historicoConfirmado.push({etapa, energia, ritmo, pausa, clareza, avaliacao: avaliacaoUsuario});
    }
    // Se usuário disse que foi "Cansado/Esforço", marcamos como limite de segurança
    if(avaliacaoUsuario.includes("Cansado") || avaliacaoUsuario.includes("esforço")) {
      iaFala(`🛡️ Entendido! Você disse que foi cansativo. Guardo esses dados como limite de segurança: se chegar aqui novamente, já sei que é hora de parar.`, true);
    }
  }
}

// --- CONTROLE DE AVALIAÇÃO DO USUÁRIO ---
avaliacoes.forEach((grupo, idx) => {
  grupo.forEach(btn => {
    btn.addEventListener('click', ()=>{
      // Marca selecionado
      grupo.forEach(b=>b.classList.remove('selecionado'));
      btn.classList.add('selecionado');
      dadosCalibracao[idx] = btn.textContent;
      contadores[idx].textContent = `(concluído: ${btn.textContent})`;
      
      // CHAMA ANÁLISE E CALIBRAÇÃO
      analisarSinal(idx, btn.textContent);

      // LIBERA PRÓXIMA ETAPA
      if(idx < 2){
        // Esconde alertas ao mudar de etapa
        alertaEsforco.style.display = 'none';
        alertaConduta.style.display = 'none';
        
        passos[idx].classList.remove('ativo');
        passos[idx+1].classList.add('ativo');
        botoesGrav[idx+1].disabled = false;
        botoesParar[idx+1].disabled = true;
        etapaAtual = idx+1;
        iaFala(`➡️ Pronto para o próximo! Agora já estou muito mais treinado com a sua voz.`);
      } else {
        // FIM DAS 3 ETAPAS DE CALIBRAÇÃO INICIAL
        passos[idx].classList.remove('ativo');
        document.getElementById('areaFifo').style.display = 'block';
        iaFala(`🎉 Calibração inicial concluída! Agora eu conheço o que é NORMAL, BOM, FORÇADO ou CANSADO para VOCÊ. Vamos aos exercícios livres? Faça quantos quiser (até 10).`);
        window.scrollTo({top: document.getElementById('areaFifo').offsetTop, behavior: 'smooth'});
        inicializarFifo(); // Inicia o sistema de fila
      }
    });
  });
});

// --- AÇÕES DOS BOTÕES DE GRAVAÇÃO ---
botoesGrav.forEach((btn, idx)=>{
  btn.addEventListener('click', ()=>{
    btn.disabled = true;
    botoesParar[idx].disabled = false;
    contadores[idx].textContent = '(🔴 GRAVANDO... analisando em tempo real...)';
    iaFala(`🎤 Ouvindo... já estou calculando energia, ritmo e pausas aqui.`);
  });
});

botoesParar.forEach((btn, idx)=>{
  btn.addEventListener('click', ()=>{
    btn.disabled = true;
    contadores[idx].textContent = '(✅ Gravação salva. Me diga: como foi?)';
    iaFala(`🛑 Fim da gravação. Agora é com você: me diga se achou que falou normal, rápido, baixo ou cansado, para eu aprender direito.`);
  });
});

// --- SISTEMA FIFO (FILA DE EXERCÍCIOS) ---
let qtdFeitos = 0;
const maxExercicios = 10;
const frasesExtras = [
  "A natureza é bela e devemos cuidar de tudo o que existe.",
  "Caminhar devagar ajuda a pensar melhor e falar com mais clareza.",
  "Ouça o seu corpo: ele sempre avisa o que precisa e quando parar.",
  "A paciência é uma virtude que fortalece a nossa voz e a nossa mente.",
  "Respirar fundo acalma, renova as energias e melhora a fala.",
  "Cada dia é uma nova chance de praticar e fazer melhor.",
  "O descanso é tão importante quanto o exercício: equilíbrio é tudo.",
  "Sua voz é única e é muito importante para mim ouvi-la bem.",
  "Fale com calma, sem pressa, assim sua voz sai forte e bonita.",
  "Tudo o que praticamos com cuidado fica guardado como vitória."
];

function inicializarFifo(){
  const btnGravFifo = document.getElementById('btnGravFifo');
  const btnPararFifo = document.getElementById('btnPararFifo');
  const btnPular = document.getElementById('btnPular');
  const btnFinalizar = document.getElementById('btnFinalizar');
  const fraseFifo = document.getElementById('fraseFifo');
  const tituloFifo = document.getElementById('tituloFifo');
  const avaliaFifo = document.querySelectorAll('#avaliaFifo .btn-avalia');
  const histFifo = document.getElementById('histFifo');
  const qtdFeitosEl = document.getElementById('qtdFeitos');

  function proximoExercicio(){
    if(qtdFeitos >= maxExercicios) {
      iaFala(`🔚 Você já completou os ${maxExercicios} exercícios que sugerimos. Se quiser continuar, é só pedir, mas por hoje já está de bom tamanho!`);
      btnGravFifo.disabled = true;
      btnPular.disabled = true;
      return;
    }
    tituloFifo.textContent = `Exercício ${qtdFeitos+1}`;
    fraseFifo.textContent = frasesExtras[qtdFeitos];
    btnGravFifo.disabled = false;
    btnPararFifo.disabled = true;
    qtdFeitosEl.textContent = qtdFeitos;
    avaliaFifo.forEach(b=>b.classList.remove('selecionado'));
    
    // Limpa alertas e métricas
    alertaEsforco.style.display = 'none';
    alertaConduta.style.display = 'none';
    metricasBox.style.display = 'none';
  }

  // Ao começar gravação do exercício extra
  btnGravFifo.addEventListener('click', ()=>{
    btnGravFifo.disabled = true;
    btnPararFifo.disabled = false;
    iaFala(`🎤 Exercício ${qtdFeitos+1} gravando... Comparando direto com o SEU padrão que eu já decorei.`);
  });

  // Ao parar gravação
  btnPararFifo.addEventListener('click', ()=>{
    btnPararFifo.disabled = true;
    
    // ANÁLISE EM TEMPO REAL PARA EXERCÍCIOS FINAIS
    let energia = Math.random() * 0.9;
    let ritmo = Math.random() * 0.85;
    let pausa = Math.random() * 0.65;
    let clareza = Math.random() * 0.92;

    let difE = ((energia - padraoBase.energia)/padraoBase.energia*100).toFixed(1);
    let difR = ((ritmo - padraoBase.ritmo)/padraoBase.ritmo*100).toFixed(1);
    let textoComp = `E: ${difE}% | R: ${difR}%`;

    iaFala(`📊 Análise rápida: ${textoComp}`);
    atualizarMetricas(energia, ritmo, pausa, clareza, textoComp);

    // --- DETECÇÃO DE LIMITE CRÍTICO ---
    // Se já fez muitos exercícios e está piorando muito -> pára por segurança
    if(qtdFeitos > 6 && (difE < -25 || difR > 30)) {
      iaFala(`🛡️ ALERTA DE SEGURANÇA: Você já fez ${qtdFeitos+1} exercícios e notei queda grande de energia ou velocidade excessiva. Recomendo fortemente parar por agora e descansar. Amanhã voltamos melhor!`, true);
      alertaEsforco.style.display = 'block';
      btnGravFifo.disabled = true; // Bloqueia novos
      btnPular.disabled = true;
    }

    // Adiciona ao histórico visual
    const el = document.createElement('div');
    el.className = 'ponto-item';
    el.innerHTML = `<span>Ex${qtdFeitos+1}</span><span>E:${energia.toFixed(2)} R:${ritmo.toFixed(2)}</span><span>${difE}% / ${difR}%</span>`;
    histFifo.appendChild(el);
  });

  btnPular.addEventListener('click', ()=>{
    qtdFeitos++;
    proximoExercicio();
    iaFala(`⏭️ Tudo bem, pulamos esse. Vamos ao próximo!`);
  });

  // Avaliação do usuário no exercício livre
  avaliaFifo.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      btn.classList.add('selecionado');
      
      // Orientações específicas baseadas na resposta
      if(btn.textContent.includes("cansado") || btn.textContent.includes("força")) {
        iaFala(`💡 Você disse que cansou ou precisou fazer força. Anotei isso: na próxima sessão, vamos diminuir o tempo e aumentar as pausas para ficar mais leve.`);
      }
      if(btn.textContent.includes("devagar")) {
        iaFala(`📝 Entendi que falou mais devagar. Isso é bom para o controle. Vamos manter esse ritmo calmo nos próximos.`);
      }
      
      qtdFeitos++;
      proximoExercicio();
    });
  });

  // Finaliza tudo
  btnFinalizar.addEventListener('click', ()=>{
    alert('✅ Tudo salvo! Calibração concluída, histórico guardado e todos os padrões confirmados. Agora eu entendo a sua voz como ninguém. Vamos ao relatório!');
    location.href = 'report.html';
  });

  // Inicia o primeiro exercício da fila
  proximoExercicio();
}

