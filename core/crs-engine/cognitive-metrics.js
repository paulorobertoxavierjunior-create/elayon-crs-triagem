/**
 * COGNITIVE METRICS - CRS Engine
 * 
 * Função: Mapear sinais temporais → indicadores cognitivos
 * Responsabilidade: Interpretar vetor CRS em termos clínicos
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "intérprete de cognição". Ele pega os 8 números
 * do vetor CRS e os transforma em descrições que você entende clinicamente.
 */

class CognitiveMetrics {
  constructor(options = {}) {
    // Mapeamento de dimensões CRS → interpretações cognitivas
    this.cognitiveMap = {
      0: {
        name: "RMS (Energia)",
        cognitiveIndicator: "Intensidade Vocal",
        clinicalMeaning: "Força de projeção, energia geral",
        ranges: {
          low: { min: 0, max: 0.3, label: "Fraca", interpretation: "Baixa projeção, possível fadiga ou fraqueza" },
          medium: { min: 0.3, max: 0.7, label: "Normal", interpretation: "Projeção adequada" },
          high: { min: 0.7, max: 1, label: "Forte", interpretation: "Projeção elevada, possível esforço ou urgência" }
        }
      },
      1: {
        name: "Pausa Micro [0-100ms]",
        cognitiveIndicator: "Micro-Hesitações",
        clinicalMeaning: "Processamento rápido, fluidez",
        ranges: {
          low: { min: 0, max: 0.2, label: "Fluida", interpretation: "Fala fluida, sem hesitações" },
          medium: { min: 0.2, max: 0.6, label: "Normal", interpretation: "Hesitações ocasionais normais" },
          high: { min: 0.6, max: 1, label: "Frequente", interpretation: "Muitas micro-hesitações, possível dificuldade de processamento" }
        }
      },
      2: {
        name: "Pausa Curta [100-200ms]",
        cognitiveIndicator: "Hesitação Decisória",
        clinicalMeaning: "Dificuldade de escolha, incerteza",
        ranges: {
          low: { min: 0, max: 0.2, label: "Decisiva", interpretation: "Decisões rápidas, sem hesitação" },
          medium: { min: 0.2, max: 0.6, label: "Normal", interpretation: "Hesitação ocasional apropriada" },
          high: { min: 0.6, max: 1, label: "Indecisa", interpretation: "Frequente hesitação, dificuldade decisória" }
        }
      },
      3: {
        name: "Pausa Média [200-1000ms]",
        cognitiveIndicator: "Reorganização Cognitiva",
        clinicalMeaning: "Busca de palavras, planejamento",
        ranges: {
          low: { min: 0, max: 0.2, label: "Rápida", interpretation: "Recuperação rápida de palavras" },
          medium: { min: 0.2, max: 0.6, label: "Normal", interpretation: "Tempo apropriado de organização" },
          high: { min: 0.6, max: 1, label: "Lenta", interpretation: "Dificuldade de busca de palavras, possível afasia" }
        }
      },
      4: {
        name: "Pausa Longa [1000ms+]",
        cognitiveIndicator: "Fadiga/Esforço Extremo",
        clinicalMeaning: "Cansaço, dificuldade severa",
        ranges: {
          low: { min: 0, max: 0.2, label: "Ausente", interpretation: "Sem pausas longas, boa resistência" },
          medium: { min: 0.2, max: 0.5, label: "Presente", interpretation: "Pausas longas ocasionais, possível fadiga" },
          high: { min: 0.5, max: 1, label: "Frequente", interpretation: "Muitas pausas longas, fadiga severa ou dificuldade extrema" }
        }
      },
      5: {
        name: "Pitch Proxy",
        cognitiveIndicator: "Estabilidade de Frequência",
        clinicalMeaning: "Tensão muscular, emoção",
        ranges: {
          low: { min: 0, max: 0.3, label: "Instável", interpretation: "Variação alta de pitch, possível tensão ou emoção" },
          medium: { min: 0.3, max: 0.7, label: "Normal", interpretation: "Pitch estável e natural" },
          high: { min: 0.7, max: 1, label: "Estável", interpretation: "Pitch muito estável, possível monotonia" }
        }
      },
      6: {
        name: "Graves [60-250Hz]",
        cognitiveIndicator: "Projeção Vocal",
        clinicalMeaning: "Força de ressonância, confiança",
        ranges: {
          low: { min: 0, max: 0.3, label: "Fraca", interpretation: "Pouca projeção grave, voz fraca" },
          medium: { min: 0.3, max: 0.7, label: "Normal", interpretation: "Projeção adequada" },
          high: { min: 0.7, max: 1, label: "Forte", interpretation: "Projeção forte, boa ressonância" }
        }
      },
      7: {
        name: "Inteligibilidade [800-3500Hz]",
        cognitiveIndicator: "Clareza Articulatória",
        clinicalMeaning: "Precisão de fala, inteligibilidade",
        ranges: {
          low: { min: 0, max: 0.3, label: "Confusa", interpretation: "Fala confusa, articulação prejudicada" },
          medium: { min: 0.3, max: 0.7, label: "Normal", interpretation: "Fala clara e inteligível" },
          high: { min: 0.7, max: 1, label: "Clara", interpretation: "Fala muito clara, articulação precisa" }
        }
      }
    };
  }

  /**
   * Interpreta um vetor CRS completo em métricas cognitivas
   * INPUT: vetor normalizado [8 dimensões]
   * OUTPUT: métricas cognitivas interpretadas
   */
  interpretVector(crsVector) {
    if (!crsVector || crsVector.length !== 8) {
      throw new Error("Vetor CRS inválido. Deve ter 8 dimensões.");
    }

    const metrics = [];

    // Para cada dimensão do vetor, encontra a interpretação cognitiva
    crsVector.forEach((value, idx) => {
      const cogMap = this.cognitiveMap[idx];
      if (!cogMap) return;

      // Encontra o range apropriado
      let range = cogMap.ranges.medium;
      for (const [key, r] of Object.entries(cogMap.ranges)) {
        if (value >= r.min && value < r.max) {
          range = r;
          break;
        }
      }

      metrics.push({
        dimension: idx,
        name: cogMap.name,
        cognitiveIndicator: cogMap.cognitiveIndicator,
        clinicalMeaning: cogMap.clinicalMeaning,
        value: value.toFixed(3),
        range: range.label,
        interpretation: range.interpretation,
        rawRange: range
      });
    });

    return {
      timestamp: Date.now(),
      metrics,
      summary: this._generateSummary(metrics)
    };
  }

  /**
   * Gera resumo clínico das métricas
   */
  _generateSummary(metrics) {
    const summary = {
      overallProfile: "",
      keyFindings: [],
      clinicalImpressions: [],
      recommendedActions: []
    };

    // Análise de energia (RMS)
    const rmsValue = parseFloat(metrics[0].value);
    if (rmsValue < 0.3) {
      summary.keyFindings.push("Intensidade vocal reduzida");
      summary.clinicalImpressions.push("Possível fraqueza vocal ou fadiga");
      summary.recommendedActions.push("Avaliar fadiga geral, cansaço vocal");
    } else if (rmsValue > 0.7) {
      summary.keyFindings.push("Intensidade vocal elevada");
      summary.clinicalImpressions.push("Possível esforço ou urgência");
    }

    // Análise de pausas
    const pausaMicro = parseFloat(metrics[1].value);
    const pausaCurta = parseFloat(metrics[2].value);
    const pausaMedia = parseFloat(metrics[3].value);
    const pausaLonga = parseFloat(metrics[4].value);

    if (pausaLonga > 0.5) {
      summary.keyFindings.push("Pausas longas frequentes");
      summary.clinicalImpressions.push("Fadiga severa ou dificuldade expressiva importante");
      summary.recommendedActions.push("Considerar repouso vocal, avaliação de fadiga");
    }

    if (pausaMedia > 0.7) {
      summary.keyFindings.push("Dificuldade de organização cognitiva");
      summary.clinicalImpressions.push("Possível afasia ou dificuldade de busca de palavras");
      summary.recommendedActions.push("Avaliar afasia, considerar fonoaudiologia");
    }

    if (pausaCurta > 0.6) {
      summary.keyFindings.push("Hesitação decisória frequente");
      summary.clinicalImpressions.push("Incerteza, possível ansiedade ou dificuldade de processamento");
    }

    // Análise de clareza
    const inteligibilidade = parseFloat(metrics[7].value);
    if (inteligibilidade < 0.3) {
      summary.keyFindings.push("Inteligibilidade prejudicada");
      summary.clinicalImpressions.push("Articulação confusa, fala pouco clara");
      summary.recommendedActions.push("Avaliar articulação, considerar exercícios fonoaudiológicos");
    }

    // Análise de pitch
    const pitch = parseFloat(metrics[5].value);
    if (pitch < 0.3) {
      summary.keyFindings.push("Instabilidade de pitch");
      summary.clinicalImpressions.push("Possível tensão muscular ou variação emocional");
    }

    // Perfil geral
    if (summary.keyFindings.length === 0) {
      summary.overallProfile = "Perfil vocal normal, sem desvios significativos";
    } else if (summary.keyFindings.length <= 2) {
      summary.overallProfile = "Perfil vocal com desvios leves a moderados";
    } else {
      summary.overallProfile = "Perfil vocal com múltiplos desvios, sugestivo de dificuldade expressiva";
    }

    return summary;
  }

  /**
   * Compara dois perfis cognitivos e identifica mudanças
   */
  compareProfiles(metricsA, metricsB) {
    if (!metricsA || !metricsB) {
      return null;
    }

    const comparison = {
      timestamp: Date.now(),
      changes: [],
      summary: {}
    };

    // Compara cada métrica
    metricsA.metrics.forEach((metricA, idx) => {
      const metricB = metricsB.metrics[idx];
      if (!metricB) return;

      const valA = parseFloat(metricA.value);
      const valB = parseFloat(metricB.value);
      const percentChange = ((valB - valA) / (valA || 0.001)) * 100;

      comparison.changes.push({
        dimension: metricA.name,
        valueA: valA.toFixed(3),
        valueB: valB.toFixed(3),
        percentChange: percentChange.toFixed(1),
        direction: percentChange > 0 ? "↑" : "↓",
        interpretation: this._interpretChange(metricA, percentChange)
      });
    });

    // Resumo de mudanças
    const increased = comparison.changes.filter(c => parseFloat(c.percentChange) > 10);
    const decreased = comparison.changes.filter(c => parseFloat(c.percentChange) < -10);

    comparison.summary = {
      totalChanges: comparison.changes.length,
      significantIncreases: increased.length,
      significantDecreases: decreased.length,
      overallTrend: increased.length > decreased.length ? "Piora" : "Melhora"
    };

    return comparison;
  }

  /**
   * Interpreta uma mudança específica
   */
  _interpretChange(metric, percentChange) {
    const abs = Math.abs(percentChange);

    if (abs < 5) return "Mudança negligenciável";
    if (abs < 15) return "Mudança leve";
    if (abs < 30) return "Mudança moderada";
    return "Mudança significativa";
  }

  /**
   * Gera relatório clínico estruturado
   */
  generateClinicalReport(metrics, patientName, doctorName) {
    const report = {
      header: {
        title: "RELATÓRIO DE ANÁLISE VOCAL — CRS",
        date: new Date().toLocaleString("pt-BR"),
        patient: patientName || "Anônimo",
        doctor: doctorName || "Médico responsável",
        disclaimer: "ESTE NÃO É UM DIAGNÓSTICO AUTOMÁTICO. É APOIO MÉTRICO/VISUAL. RESPONSABILIDADE CLÍNICA DO MÉDICO."
      },
      findings: metrics.summary.keyFindings,
      impressions: metrics.summary.clinicalImpressions,
      recommendations: metrics.summary.recommendedActions,
      detailedMetrics: metrics.metrics,
      overallProfile: metrics.summary.overallProfile
    };

    return report;
  }
}

// EXPORTAR
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CognitiveMetrics;
}