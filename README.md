# Elayon Health — CRS (Triagem Vocal)

## 🎯 O que é isso?

**Elayon Health** é um **termômetro da fala**, não um médico.

Ele mede **QUANDO** você fala e **QUANDO** você pausa. Nada mais.

A interpretação clínica é **sua responsabilidade**.

---

## 📚 Fundamento Científico

Este sistema implementa a **Camada de Ritmo e Sinais Temporais Cognitivos (CRS)**, uma abordagem formalizada para capturar padrões temporais da interação humana.

**Referência:** Artigo "Modelagem e Integração de Sinais Temporais Cognitivos em Sistemas Multimodais" — Paulo Roberto Xavier Júnior, 2026.

### O que o CRS faz:

1. **Extrai timestamps** — marca QUANDO eventos acontecem
2. **Calcula intervalos** — mede pausas, latências, ritmo
3. **Vetoriza dados** — transforma em 8 métricas formalizadas
4. **Valida coerência** — garante que os dados fazem sentido
5. **Gera relatório** — congelado para auditoria clínica

### O que o CRS NÃO faz:

❌ Não diagnostica
❌ Não interpreta emoções
❌ Não faz julgamentos clínicos
❌ Não identifica pessoas
❌ Não armazena conteúdo de fala

---

## 🔐 Conformidade Legal (LGPD)

Este sistema opera sobre **dados anonimizados**:

- ✅ Coleta apenas **timestamps** (não conteúdo)
- ✅ Não identifica indivíduos
- ✅ Não armazena áudio
- ✅ Não exige Comitê de Ética (não é pesquisa clínica)
- ✅ Responsabilidade clínica = **do médico**

**Princípio:** "Quem faz termômetro não explica febre."

---

## 🚀 Como Usar

### FASE 1: Login (Identificação do Médico)

1. Acesse: `login.html`
2. Preencha:
   - Nome completo
   - CRM (número)
   - UF (estado)
   - Email (opcional)

**Tutorial para o médico:**
> "Aqui você se identifica como responsável clínico. Seus dados ficam salvos no seu navegador. Ninguém mais tem acesso."

---

### FASE 2: Configurar Sessão (`index.html`)

1. Preencha:
   - **Médico:** (já preenchido)
   - **Paciente:** Nome completo
   - **Contexto:** Ex: "Pós-AVC", "Afasia", "Linha de base"
   - **Protocolo:** Escolha um (Afasia, Pós-AVC, Ansiedade, Geral)

2. Clique: **"Iniciar Captura e Análise"**

**Tutorial para o médico:**
> "O contexto ajuda você a lembrar depois. O protocolo define as frases que o paciente vai ler. Tudo fica anonimizado — apenas números de tempo."

---

### FASE 3: Captura Vocal (`session.html`)

#### **ETAPA 1: Definir Linha de Base (Referência)**

1. **Clique:** "Ativar Microfone"
2. **Leia a frase:**
   > "Bom dia, tudo bem com você? Eu acordei bem hoje e estou pronto para conversar e contar como foi o meu dia."

3. **Clique:** "Iniciar Gravação"
4. **Fale com naturalidade** (5 min máximo)
5. **Clique:** "Finalizar Gravação"
6. **Classifique:** Como foi a emissão?
   - Padrão Normal
   - Clara e Projetada
   - Rápida / Veloz
   - Fraca / Baixa Intensidade
   - Esforçada / Cansada

**O que acontece nos bastidores:**
- Sistema extrai timestamps de início/fim de fala
- Calcula pausas (micro, curta, média, longa)
- Mede energia (RMS), pitch, clareza
- Define isso como "padrão base" para comparação

**Tutorial para o médico:**
> "Essa primeira gravação é sua REFERÊNCIA. Tudo que vier depois será comparado com isso. É como tirar uma foto do padrão vocal do paciente naquele dia."

---

#### **ETAPA 2: Validação (Comparação)**

1. **Leia a frase:**
   > "Eu gosto de caminhar um pouco ao ar livre, conversar com as pessoas e descansar quando o corpo pede um tempo para se recuperar."

2. Repita o processo (gravação + classificação)

**O que muda:**
- Sistema COMPARA com a linha de base
- Mostra: "Energia +10%", "Pausas -5%", etc.
- Você vê se há desvios significativos

**Tutorial para o médico:**
> "Aqui você vê se o paciente está diferente da primeira gravação. Mais lento? Mais pausado? Mais cansado? Os números mostram isso."

---

#### **ETAPA 3: Consolidação (Perfil Completo)**

1. **Leia a frase:**
   > "Às vezes é difícil falar por muito tempo sem parar, mas eu vou devagar para dar conta de dizer tudo o que quero e me fazer entender bem."

2. Repita o processo

**O que acontece:**
- Sistema consolida o perfil vocal completo
- Gera 8 métricas formalizadas (CRS)
- Ativa protocolo de exercícios terapêuticos

**Tutorial para o médico:**
> "Pronto! Agora o sistema conhece a voz do paciente. As próximas gravações serão comparadas com esse perfil consolidado."

---

#### **FASE 4: Exercícios Terapêuticos (FIFO)**

Sistema oferece até **10 frases** para o paciente ler:

1. "A natureza é bela e devemos cuidar..."
2. "Caminhar devagar ajuda a pensar melhor..."
3. ... (até 10)

**Para cada exercício:**
- Paciente grava
- Você classifica: "Normal", "Esforço", "Fadiga", etc.
- Sistema compara com padrão
- IA oferece feedback em tempo real

**Tutorial para o médico:**
> "Esses exercícios são monitorados. Você vê em tempo real se o paciente está cansando, se há mudanças no ritmo, se há sinais de esforço excessivo. Você controla tudo."

---

### FASE 5: Relatório (`report.html`)

Ao final, você vê:

#### **Gráficos Congelados (Auditoria):**

1. **FFT (Espectro)** — Distribuição de frequências
2. **Silêncio (Pausas)** — Padrão temporal de pausas
3. **Overlay 8 Linhas** — Todas as métricas simultâneas

#### **Métricas Quantitativas:**
RMS (Energia):           0.45 (média)
Pausas Curtas [0-200ms]: 12 eventos
Pausas Médias [200-1s]:  8 eventos
Pausas Longas [1s+]:     3 eventos
Pitch Proxy:             0.62
Clareza (Inteligibilidade): 0.78
Variabilidade:           0.34
Ritmo (Cadência):        0.71
#### **Campo Obrigatório: Diagnóstico/Hipótese**
VOCÊ PREENCHE:Severidade (0-10): _
Inteligibilidade (%): 
Esforço (0-10): 
Observações clínicas: ___________
Hipótese diagnóstica: ___________
Conduta recomendada: _____________
**Tutorial para o médico:**
> "Aqui você coloca SUAS conclusões clínicas. O sistema forneceu os dados. Você interpreta. Sua assinatura, sua responsabilidade."

---

## 📊 As 8 Métricas CRS Explicadas

| Métrica | O que mede | Interpretação clínica |
|---------|-----------|----------------------|
| **RMS (Energia)** | Intensidade vocal | Projeção, cansaço, esforço |
| **Pausa Curta [0-200ms]** | Hesitação decisória | Dúvida, busca de palavra |
| **Pausa Média [200-1s]** | Reorganização cognitiva | Reflexão, processamento |
| **Pausa Longa [1s+]** | Fadiga/esforço extremo | Cansaço, dificuldade motora |
| **Pitch Proxy** | Frequência fundamental | Tensão muscular, emoção |
| **Subgrave [20-60Hz]** | Ressonância basal | Qualidade tonal, projeção |
| **Graves [60-250Hz]** | Energia grave | Projeção vocal, força |
| **Médias-Altas [800-3500Hz]** | Inteligibilidade | Clareza articulatória |

---

## 🔄 Fluxo Completo (Resumido)
Login
  ↓
Cadastro Sessão
  ↓
Ativar Microfone
  ↓
ETAPA 1: Linha de Base (Frase 1)
  ├─ Grava
  ├─ Classifica
  └─ Sistema define padrão
  ↓
ETAPA 2: Validação (Frase 2)
  ├─ Grava
  ├─ Classifica
  └─ Sistema compara com padrão
  ↓
ETAPA 3: Consolidação (Frase 3)
  ├─ Grava
  ├─ Classifica
  └─ Perfil consolidado
  ↓
EXERCÍCIOS (até 10 frases)
  ├─ Grava
  ├─ Classifica
  └─ IA oferece feedback
  ↓
RELATÓRIO
  ├─ Gráficos congelados
  ├─ 8 métricas quantitativas
  └─ Campo para diagnóstico clínico (OBRIGATÓRIO)
  ↓
SALVO (localStorage, máx 10 relatórios)
---

## ⚙️ Configuração (Dashboard)

Acesse: `dashboard.html`

### Parâmetros Ajustáveis:

| Parâmetro | Padrão | Intervalo | O que faz |
|-----------|--------|-----------|----------|
| **Sample Hz** | 10 | 5-25 | Frequência de amostragem (Hz) |
| **Silence Threshold** | 0.025 | 0.005-0.10 | Limiar de detecção de silêncio (RMS) |
| **Hint** | — | — | Observação interna (ex: "ruído alto") |

**Tutorial para o médico:**
> "Deixe no padrão. Se houver muito ruído de fundo, aumente o Silence Threshold. Se detectar pausas falsas, diminua."

---

## 💾 Armazenamento (Privacidade)

- ✅ Tudo fica no **seu navegador** (localStorage)
- ✅ Nada vai para servidor
- ✅ Nada é enviado para ninguém
- ✅ Você controla quando deletar
- ✅ Máximo 10 relatórios (depois precisa deletar antigos)

**Tutorial para o médico:**
> "Seus dados ficam aqui. Você é o dono. Se quiser deletar, clique em 'Excluir'. Ninguém mais acessa."

---

## 🎓 Exemplo Prático: Paciente com Afasia

### Cenário:
Paciente pós-AVC com afasia de Broca (dificuldade de fala, mas compreensão preservada).

### O que você vê:

**ETAPA 1 (Linha de Base):**Frase: "Bom dia, tudo bem com você?"
Resultado:•RMS: 0.35 (baixo = fraca)•Pausas Longas: 5 eventos (hesitação)•Pitch: 0.45 (reduzido)•Clareza: 0.52 (prejudicada)Classificação do médico: "Esforçada / Cansada"
**ETAPA 2 (Validação):**Frase: "Eu gosto de caminhar..."
Resultado:•RMS: 0.32 (-8% vs base)•Pausas Longas: 7 eventos (+40% vs base)•Pitch: 0.42 (-6% vs base)•Clareza: 0.48 (-8% vs base)Classificação: "Esforçada / Cansada"
**INTERPRETAÇÃO CLÍNICA (Você preenche):**Severidade: 7/10
Inteligibilidade: 45%
Esforço: 8/10
Observações: "Paciente apresenta dificuldade de fala com pausas prolongadas, 
consistente com afasia de Broca. Fadiga progressiva ao longo da sessão."
Hipótese: "Afasia de Broca pós-AVC, em fase de recuperação."
Conduta: "Fonoaudiologia 2x/semana. Reavaliar em 4 semanas."
---

## 🔒 Segurança e Ética

### O que o sistema coleta:
- ✅ Timestamps (QUANDO você fala)
- ✅ Duração de pausas
- ✅ Frequências (FFT)
- ✅ Energia (RMS)

### O que o sistema NÃO coleta:
- ❌ Áudio bruto
- ❌ Conteúdo de fala
- ❌ Identificação pessoal
- ❌ Dados sensíveis (saúde, religião, etc.)

### Responsabilidade:
- **Sistema:** Fornece números
- **Você (médico):** Interpreta números e toma decisão clínica

---

## 📱 Compatibilidade

- ✅ Chrome, Firefox, Safari, Edge
- ✅ Desktop, tablet, smartphone
- ✅ Offline (tudo no navegador)
- ✅ Sem dependências externas

---

## 🚀 Como Começar

1. **Abra:** `https://seu-repo.github.io`
2. **Clique:** "Iniciar conexão"
3. **Preencha:** Nome, CRM, UF
4. **Comece:** Primeira sessão

---

## 📞 Suporte

Dúvidas técnicas? Abra uma issue no GitHub.

Dúvidas clínicas? Consulte literatura especializada. **O sistema é um termômetro, não um médico.**

---

## 📄 Licença

Uso educacional e clínico. Não comercializar sem autorização.

---

## 🙏 Créditos

Desenvolvido por **Elayon Health** com base em pesquisa de **Paulo Roberto Xavier Júnior**.

Implementação: **Temporal Extractor + CRS Engine + Clinical Validation Framework**

---

## ⚠️ Aviso Legal

**Este sistema NÃO é um dispositivo médico certificado.**

Ele fornece **evidência visual e métrica** para apoiar avaliação clínica.

**A responsabilidade diagnóstica é exclusivamente do profissional de saúde.**

Conformidade: LGPD, GDPR, Resolução CNS 466/2012.

---

## 🔬 Referências Científicas

- Donders (1868): Tempo de reação como janela para cognição
- Hick (1952): Tempo de decisão proporcional a alternativas
- Freeman (2000): Cérebro como sistema temporal
- Ratcliff & McKoon (2008): Modelos de difusão estocástica
- Insel et al. (2017): Biomarcadores digitais
- Cummins (2012): Características temporais da fala e carga cognitiva
- Low et al. (2020): Padrões rítmicos e estresse

---

