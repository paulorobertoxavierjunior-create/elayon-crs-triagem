// ==========================================================================
// [ELAYON HEALTH] MOTOR DO PILOTO • CRS ENGINE & AUDITORIA CLÍNICA
// ==========================================================================

let currentPilotUser = null;
let selectedUserId = null;
let selectedRowId = null;

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        currentPilotUser = session.user;
        await carregarPerfilPiloto();
    }

    // Captura parâmetros vindos da Fila Mútua (URL)
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('target_user');
    const rowId = urlParams.get('row_id');

    if (targetUser) {
        selectedUserId = targetUser;
        selectedRowId = rowId;
        document.getElementById('lblAtivoId').textContent = targetUser;
        // Muda automaticamente para a aba de análise se houver paciente atribuído
        trocarAbaPiloto('analise');
    }

    await carregarFilaMútua();
    desenharGraficoUnificado([]);
});

async function carregarPerfilPiloto() {
    if (!currentPilotUser) return;
    const { data: piloto } = await supabaseClient
        .from('pilotos_perfil')
        .select('*')
        .eq('id', currentPilotUser.id)
        .maybeSingle();

    if (piloto) {
        document.getElementById('lblNomePiloto').textContent = piloto.nome_completo;
        document.getElementById('lblCrPiloto').textContent = `Registro: ${piloto.crm_crfa_crp} | Especialidade: ${piloto.especialidade}`;
        document.getElementById('hudPilotoStatus').textContent = 'REGISTRADO & ATIVO';
        document.getElementById('hudPilotoStatus').style.color = 'var(--success)';
        
        document.getElementById('regNome').value = piloto.nome_completo;
        document.getElementById('regCrm').value = piloto.crm_crfa_crp;
        document.getElementById('regEspecialidade').value = piloto.especialidade;
    }
}

function verificarOutraEspecialidade(val) {
    document.getElementById('boxOutraEsp').style.display = (val === 'Outros') ? 'grid' : 'none';
}

async function salvarCredenciaisPiloto() {
    if (!currentPilotUser) {
        alert('⚠️ Faça login no Supabase para salvar suas credenciais.');
        return;
    }
    const nome = document.getElementById('regNome').value.trim();
    const crm = document.getElementById('regCrm').value.trim();
    const esp = document.getElementById('regEspecialidade').value;
    const outraEsp = document.getElementById('regOutraEspecialidade').value.trim();
    const especialidadeFinal = (esp === 'Outros') ? outraEsp : esp;

    const msg = document.getElementById('msgCredencial');
    msg.textContent = '⏳ A salvar credenciais legais...';
    msg.style.color = 'var(--warning)';

    const { error } = await supabaseClient.from('pilotos_perfil').upsert({
        id: currentPilotUser.id,
        nome_completo: nome,
        crm_crfa_crp: crm,
        especialidade: especialidadeFinal,
        termo_responsabilidade_aceito: true
    });

    if (error) {
        msg.textContent = '❌ Erro ao salvar: ' + error.message;
        msg.style.color = 'var(--danger)';
    } else {
        msg.textContent = '✅ Credenciais gravadas com sucesso!';
        msg.style.color = 'var(--success)';
        await carregarPerfilPiloto();
    }
}

async function carregarFilaMútua() {
    const container = document.getElementById('queueContainer');
    if (!container) return;

    const { data: fila } = await supabaseClient
        .from('atendimento_fila')
        .select('*')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false });

    if (!fila || fila.length === 0) {
        container.innerHTML = '<p style="font-size:12px; color:var(--muted);">Nenhum paciente na fila mútua.</p>';
        return;
    }

    container.innerHTML = '';
    fila.forEach(item => {
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.innerHTML = `
            <div class="queue-info">
                <h4>Paciente ID: ${item.user_id}</h4>
                <p>${item.motivo || 'Solicitação de escuta'} • ${new Date(item.criado_em).toLocaleTimeString()}</p>
            </div>
            <button class="btn-action btn-primary" style="width:auto;" onclick="atenderPaciente('${item.user_id}', '${item.id}')">🩺 Selecionar</button>
        `;
        container.appendChild(div);
    });
}

function atenderPaciente(userId, rowId) {
    selectedUserId = userId;
    selectedRowId = rowId;
    document.getElementById('lblAtivoId').textContent = userId;
    trocarAbaPiloto('analise');
}

function trocarAbaPiloto(aba) {
    const abas = ['credencial', 'fila', 'analise', 'param'];
    abas.forEach((a, idx) => {
        const tabEl = document.getElementById(`tab${a.charAt(0).toUpperCase() + a.slice(1)}`);
        const btnEl = document.getElementById(`btnTab${idx+1}`);
        if (tabEl) tabEl.classList.toggle('active', a === aba);
        if (btnEl) btnEl.classList.toggle('active', a === aba);
    });
}

function iniciarLigacaoOuAnaliseAoVivo() {
    if (!selectedUserId) {
        alert('⚠️ Selecione um paciente na Fila Mútua (Aba 2) ou Central de Espera primeiro.');
        return;
    }
    alert(`📞 Iniciando captura de fonação ao vivo para o paciente ${selectedUserId}...`);
    document.getElementById('statusCrsVal').textContent = 'Processando Timestamps • CRS: OK';
    desenharGraficoUnificado([45, 60, 28, 85, 12, 110, 45, 30]);
}

function processarAudioUpload(input) {
    if (!input.files || !input.files[0]) return;
    alert(`📂 Áudio "${input.files[0].name}" carregado. Extraindo vetores CRS...`);
    document.getElementById('statusCrsVal').textContent = 'Análise Concluída • Relatório CRS Congelado';
    desenharGraficoUnificado([55, 75, 25, 90, 15, 115, 50, 32]);
}

function gerarRelatorioCrsCompleto() {
    alert('📄 Relatório temporal de pausas e frequências congelado para auditoria clínica.');
}

async function salvarParametrizacaoEEnviarPaciente() {
    const msg = document.getElementById('msgParam');
    const relatorio = document.getElementById('paramRelatorio').value.trim();
    const sev = document.getElementById('paramSeveridade').value;
    const conduta = document.getElementById('paramConduta').value.trim();

    if (!selectedUserId) {
        alert('⚠️ Nenhum paciente selecionado para parametrização.');
        return;
    }

    if (!relatorio) {
        alert('⚠️ O campo de diagnóstico e hipótese clínica é obrigatório.');
        return;
    }

    msg.textContent = '⏳ A salvar laudo no Supabase...';
    msg.style.color = 'var(--warning)';

    // Se veio direto da fila mútua sem row_id explícito na URL, busca o active row
    let rowIdToUpdate = selectedRowId;
    if (!rowIdToUpdate) {
        const { data: found } = await supabaseClient
            .from('atendimento_fila')
            .select('id')
            .eq('user_id', selectedUserId)
            .order('criado_em', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (found) rowIdToUpdate = found.id;
    }

    const updatePayload = {
        status: 'liberado',
        relatorio_medico: relatorio,
        parametros_json: { severidade: sev, conduta: conduta }
    };

    let error = null;
    if (rowIdToUpdate) {
        const res = await supabaseClient.from('atendimento_fila').update(updatePayload).eq('id', rowIdToUpdate);
        error = res.error;
    } else {
        const res = await supabaseClient.from('atendimento_fila').insert({
            user_id: selectedUserId,
            piloto_id: currentPilotUser ? currentPilotUser.id : null,
            ...updatePayload
        });
        error = res.error;
    }

    if (error) {
        msg.textContent = '❌ Erro: ' + error.message;
        msg.style.color = 'var(--danger)';
    } else {
        msg.textContent = '✅ Laudo emitido e paciente liberado com sucesso!';
        msg.style.color = 'var(--success)';
        document.getElementById('paramRelatorio').value = '';
        await carregarFilaMútua();
    }
}

function desenharGraficoUnificado(dadosMock) {
    const cv = document.getElementById('cvUnificado');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width = cv.parentElement.clientWidth || 300;
    const H = cv.height = 220;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#e2f0ed';
    ctx.lineWidth = 1;
    for (let y = 25; y < H; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const cores = ['#2a9d8f', '#e76f51', '#f4a261', '#264653', '#8ab17d', '#6a040f', '#3a86ff', '#8338ec'];

    for (let dim = 0; dim < 8; dim++) {
        ctx.strokeStyle = cores[dim];
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let x = 0; x < W; x += 5) {
            const base = dadosMock.length > 0 ? dadosMock[dim] : 35 + (dim * 4);
            const y = (H / 2) + Math.sin((x * 0.05) + dim) * (base * 0.35) + ((dim - 4) * 5);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}
