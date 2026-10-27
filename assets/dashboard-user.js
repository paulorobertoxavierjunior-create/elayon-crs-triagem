// ==========================================================================
// [ELAYON HEALTH] MOTOR DO PACIENTE • VERIFICAÇÃO DE LIBERAÇÃO MÉDICA
// ==========================================================================

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('user_id') || 'c708823f-a48a-41f0-948f-287eee484821';
let tokensAtuais = 100;
let sistemaLiberadoPeloMedico = false;

window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('userIdDisplay').textContent = `ID: ${userId}`;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (profile) {
        document.getElementById('userName').textContent = profile.nome || 'Paciente Elayon';
        tokensAtuais = profile.tokens ?? 100;
        document.getElementById('userTokens').textContent = tokensAtuais;
        if (profile.avatar_url) document.getElementById('userAvatarImg').src = profile.avatar_url;
    }

    await verificarStatusLiberacaoMedica();
});

async function verificarStatusLiberacaoMedica() {
    const { data: atendimento } = await supabaseClient
        .from('atendimento_fila')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (atendimento) {
        if (atendimento.status === 'liberado') {
            liberarAbaTesteComParametros(atendimento.relatorio_medico);
        } else if (atendimento.status === 'pendente' || atendimento.status === 'em_atendimento') {
            document.getElementById('msgStatusSolicitacao').textContent = '⏳ Sua solicitação está sendo acompanhada pela central médica.';
            document.getElementById('msgStatusSolicitacao').style.color = 'var(--warning)';
        }
    }
}

async function solicitarAtendimentoHumano() {
    const msgDiv = document.getElementById('msgStatusSolicitacao');
    msgDiv.textContent = '⏳ A enviar solicitação para a fila global...';
    msgDiv.style.color = 'var(--warning)';

    try {
        const { error } = await supabaseClient.from('atendimento_fila').insert({
            user_id: userId,
            status: 'pendente',
            motivo: 'Paciente solicitou escuta simbiótica e auditoria fônica.',
            criado_em: new Date().toISOString()
        });

        if (error) throw error;

        msgDiv.textContent = '✅ Solicitação enviada! Os médicos na central mútua já podem visualizar seu ID.';
        msgDiv.style.color = 'var(--success)';
    } catch (err) {
        msgDiv.textContent = '❌ Erro ao solicitar: ' + err.message;
        msgDiv.style.color = 'var(--danger)';
    }
}

function liberarAbaTesteComParametros(relatorioTexto) {
    sistemaLiberadoPeloMedico = true;
    document.getElementById('statusCalibracao').textContent = '🟢 Laudo Emitido pelo Médico';
    document.getElementById('statusCalibracao').className = 'status-tag liberado';

    const btnTabTeste = document.getElementById('btnTabTeste');
    if (btnTabTeste) {
        btnTabTeste.classList.remove('btn-disabled');
        btnTabTeste.textContent = '🤖 2. IA de Teste & Exercícios (Ativo)';
    }

    if (relatorioTexto) {
        document.getElementById('txtRelatorioMedico').textContent = relatorioTexto;
    } else {
        document.getElementById('txtRelatorioMedico').textContent = 'Laudo padrão aplicado e validado pelo médico responsável.';
    }

    desenharGraficosFônicosParametrizados();
}

function trocarAba(aba) {
    if (aba === 'teste' && !sistemaLiberadoPeloMedico) {
        alert('⚠️ A aba de testes está bloqueada até que um médico emita o laudo de liberação.');
        return;
    }

    document.getElementById('tabSolicitacao').classList.toggle('active', aba === 'solicitacao');
    document.getElementById('tabTeste').classList.toggle('active', aba === 'teste');
    document.querySelectorAll('.tab-btn').forEach((b, idx) => {
        if (idx === 0) b.classList.toggle('active', aba === 'solicitacao');
        if (idx === 1 && sistemaLiberadoPeloMedico) b.classList.toggle('active', aba === 'teste');
    });
}

async function enviarInteracaoIA() {
    if (!sistemaLiberadoPeloMedico) return;
    if (tokensAtuais <= 0) {
        alert('⚠️ Tokens esgotados para teste fônico!');
        return;
    }

    const inputTxt = document.getElementById('txtInputInteracao');
    const texto = inputTxt.value.trim();
    if (!texto) return;

    tokensAtuais -= 1;
    document.getElementById('userTokens').textContent = tokensAtuais;

    await supabaseClient.from('profiles').update({ tokens: tokensAtuais }).eq('id', userId);

    const chatBox = document.getElementById('chatBox');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = texto;
    chatBox.appendChild(userMsg);
    inputTxt.value = '';

    setTimeout(() => {
        const aiMsg = document.createElement('div');
        aiMsg.className = 'chat-message ad';
        aiMsg.innerHTML = `<strong>Ad (Elayon CRS):</strong> Amostra temporal processada sob supervisão clínica.`;
        chatBox.appendChild(aiMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        desenharGraficosFônicosParametrizados();
    }, 800);
}

function desenharGraficosFônicosParametrizados() {
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cv${i}`);
        if (!cv) continue;
        const ctx = cv.getContext('2d');
        const W = cv.width = cv.parentElement.clientWidth || 280;
        const H = cv.height = 90;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#e2f0ed';
        ctx.lineWidth = 1;
        for (let y = 15; y < H; y += 15) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        ctx.strokeStyle = '#2a9d8f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < W; x += 4) {
            const y = H / 2 + Math.sin(x * 0.08 + i) * (18 + (i % 2) * 8);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}
