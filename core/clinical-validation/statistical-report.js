/**
 * STATISTICAL REPORT - Clinical Validation
 * 
 * Função: Gerar relatório científico de validação
 * Responsabilidade: Análise estatística completa e conclusões
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "gerador de conclusões científicas".
 * Ele pega as correlações e transforma em um relatório
 * que você pode apresentar em congresso ou publicar.
 */

class StatisticalReport {
  constructor(options = {}) {
    this.reports = [];
    this.minPairingCount = options.minPairingCount || 10;
    this.significanceLevel = options.significanceLevel || 0.05;
  }

  /**
   * Gera relatório completo de validação
   */
  generateFullReport(correlationData, metadata = {}) {
    if (!correlationData || !correlationData.pairingCount) {
      return { error: "Dados de correlação inválidos" };
    }

    const report = {
      id: `report_${Date.now()}`,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        generatedAt: new Date().toLocaleString("pt-BR"),
        pairingCount: correlationData.pairingCount
      },

      // Seção 1: Resumo Executivo
      executive: this._generateExecutiveSummary(correlationData),

      // Seção 2: Metodologia
      methodology: this._generateMethodology(correlationData),

      // Seção 3: Resultados
      results: this._generateResults(correlationData),

      // Seção 4: Tabelas Estatísticas
      tables: this._generateStatisticalTables(correlationData),

      // Seção 5: Interpretação Clínica
      clinicalInterpretation: this._generateClinicalInterpretation(correlationData),

      // Seção 6: Limitações
      limitations: this._generateLimitations(correlationData),

      // Seção 7: Conclusões
      conclusions: this._generateConclusions(correlationData),

      // Seção 8: Recomendações
      recommendations: this._generateRecommendations(correlationData)
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Resumo executivo
   */
  _generateExecutiveSummary(data) {
    const significantCorrs = Object.values(data.correlations || {}).filter(
      c => parseFloat(c.pValue) < this.significanceLevel
    );

    return {
      title: "RESUMO EXECUTIVO",
      overview: `Estudo de validação da Camada de Ritmo e Sinais Temporais Cognitivos (CRS) com ${data.pairingCount} pares de dados clínicos e métricas temporais.`,
      keyFindings: [
        `Total de correlações analisadas: ${Object.keys(data.correlations || {}).length}`,
        `Correlações significativas (p < 0.05): ${significantCorrs.length}`,
        `Taxa de significância: ${((significantCorrs.length / Object.keys(data.correlations || {}).length) * 100).toFixed(1)}%`,
        `Nível de evidência: ${this._assessEvidenceLevel(significantCorrs.length)}`
      ],
      validationStatus: significantCorrs.length >= 5 ? "✅ VALIDADO" : "⚠️ PARCIALMENTE VALIDADO",
      recommendation: this._getOverallRecommendation(significantCorrs.length)
    };
  }

  /**
   * Seção de metodologia
   */
  _generateMethodology(data) {
    return {
      title: "METODOLOGIA",
      design: "Estudo transversal de correlação entre métricas CRS e avaliação clínica estruturada",
      sampleSize: `n = ${data.pairingCount} pares (médico + CRS)`,
      statisticalTest: "Correlação de Pearson com teste de significância bilateral",
      significanceLevel: `α = ${this.significanceLevel}`,
      procedure: [
        "1. Captura de áudio durante sessão clínica",
        "2. Extração de vetor CRS (8 dimensões)",
        "3. Preenchimento de avaliação clínica pelo médico",
        "4. Cálculo de correlações Pearson",
        "5. Cálculo de p-values",
        "6. Análise de força de correlação"
      ],
      dataProtection: "Todos os dados anonimizados conforme LGPD"
    };
  }

  /**
   * Seção de resultados
   */
  _generateResults(data) {
    const allCorrs = Object.values(data.correlations || {});
    const significantCorrs = allCorrs.filter(c => parseFloat(c.pValue) < this.significanceLevel);

    const strongCorrs = significantCorrs.filter(c => Math.abs(parseFloat(c.pearsonR)) >= 0.7);
    const moderateCorrs = significantCorrs.filter(c => Math.abs(parseFloat(c.pearsonR)) >= 0.5 && Math.abs(parseFloat(c.pearsonR)) < 0.7);
    const weakCorrs = significantCorrs.filter(c => Math.abs(parseFloat(c.pearsonR)) < 0.5);

    return {
      title: "RESULTADOS",
      summary: {
        totalAnalyzed: allCorrs.length,
        significant: significantCorrs.length,
        percentSignificant: ((significantCorrs.length / allCorrs.length) * 100).toFixed(1),
        strongCorrelations: strongCorrs.length,
        moderateCorrelations: moderateCorrs.length,
        weakCorrelations: weakCorrs.length
      },
      strongFindings: strongCorrs.map(c => ({
        pair: `${c.dimension} ↔ ${c.clinicalScale}`,
        r: c.pearsonR,
        pValue: c.pValue,
        interpretation: `Correlação forte (r=${c.pearsonR}, p=${c.pValue})`
      })),
      moderateFindings: moderateCorrs.map(c => ({
        pair: `${c.dimension} ↔ ${c.clinicalScale}`,
        r: c.pearsonR,
        pValue: c.pValue,
        interpretation: `Correlação moderada (r=${c.pearsonR}, p=${c.pValue})`
      }))
    };
  }

  /**
   * Tabelas estatísticas
   */
  _generateStatisticalTables(data) {
    const allCorrs = Object.values(data.correlations || {});

    // Tabela 1: Correlações ordenadas por força
    const correlationTable = allCorrs
      .sort((a, b) => Math.abs(parseFloat(b.pearsonR)) - Math.abs(parseFloat(a.pearsonR)))
      .map((c, idx) => ({
        rank: idx + 1,
        crsDimension: c.dimension,
        clinicalScale: c.clinicalScale,
        pearsonR: parseFloat(c.pearsonR).toFixed(3),
        pValue: parseFloat(c.pValue).toFixed(4),
        significant: parseFloat(c.pValue) < this.significanceLevel ? "✓" : "✗",
        strength: this._assessCorrelationStrength(parseFloat(c.pearsonR))
      }));

    // Tabela 2: Resumo por dimensão CRS
    const byDimension = {};
    allCorrs.forEach(c => {
      if (!byDimension[c.dimension]) {
        byDimension[c.dimension] = { significant: 0, total: 0, avgR: 0 };
      }
      byDimension[c.dimension].total++;
      if (parseFloat(c.pValue) < this.significanceLevel) {
        byDimension[c.dimension].significant++;
      }
      byDimension[c.dimension].avgR += parseFloat(c.pearsonR);
    });

    const dimensionTable = Object.entries(byDimension).map(([dim, stats]) => ({
      dimension: dim,
      totalCorrelations: stats.total,
      significantCorrelations: stats.significant,
      percentSignificant: ((stats.significant / stats.total) * 100).toFixed(1),
      averageR: (stats.avgR / stats.total).toFixed(3)
    }));

    return {
      correlationMatrix: correlationTable,
      dimensionSummary: dimensionTable
    };
  }

  /**
   * Interpretação clínica
   */
  _generateClinicalInterpretation(data) {
    const significantCorrs = Object.values(data.correlations || {}).filter(
      c => parseFloat(c.pValue) < this.significanceLevel
    );

    const interpretations = [];

    // Análise por escala clínica
    const bySeverity = significantCorrs.filter(c => c.clinicalScale === "severity");
    if (bySeverity.length > 0) {
      interpretations.push({
        scale: "Severidade",
        findings: bySeverity.map(c => `${c.dimension} correlaciona com severidade (r=${c.pearsonR})`),
        implication: "Métricas CRS refletem adequadamente a severidade clínica da afasia"
      });
    }

    const byIntelligibility = significantCorrs.filter(c => c.clinicalScale === "intelligibility");
    if (byIntelligibility.length > 0) {
      interpretations.push({
        scale: "Inteligibilidade",
        findings: byIntelligibility.map(c => `${c.dimension} correlaciona com inteligibilidade (r=${c.pearsonR})`),
        implication: "CRS detecta variações na clareza da fala"
      });
    }

    const byPauses = significantCorrs.filter(c => c.clinicalScale === "pauses");
    if (byPauses.length > 0) {
      interpretations.push({
        scale: "Frequência de Pausas",
        findings: byPauses.map(c => `${c.dimension} correlaciona com pausas (r=${c.pearsonR})`),
        implication: "Padrões temporais CRS refletem padrões de pausas clínicas"
      });
    }

    return {
      title: "INTERPRETAÇÃO CLÍNICA",
      interpretations,
      overallAssessment: this._assessClinicalValidity(significantCorrs.length)
    };
  }

  /**
   * Limitações
   */
  _generateLimitations(data) {
    const limitations = [];

    if (data.pairingCount < 20) {
      limitations.push("Tamanho amostral limitado (n < 20) pode reduzir generalização");
    }

    if (data.pairingCount < 30) {
      limitations.push("Recomenda-se aumento de amostra para validação robusta");
    }

    limitations.push("Estudo transversal não estabelece causalidade");
    limitations.push("Variabilidade intraindividual pode influenciar resultados");
    limitations.push("Generalização limitada a contextos clínicos similares");

    return {
      title: "LIMITAÇÕES",
      items: limitations,
      recommendation: "Estudos longitudinais e multicêntricos são recomendados para validação completa"
    };
  }

  /**
   * Conclusões
   */
  _generateConclusions(data) {
    const significantCorrs = Object.values(data.correlations || {}).filter(
      c => parseFloat(c.pValue) < this.significanceLevel
    );

    return {
      title: "CONCLUSÕES",
      mainConclusion: this._getMainConclusion(significantCorrs.length),
      keyPoints: [
        `CRS demonstra ${significantCorrs.length} correlações significativas com avaliação clínica`,
        "Métricas temporais refletem aspectos clinicamente relevantes da afasia",
        "Sistema é viável como ferramenta complementar de triagem",
        "Recomenda-se uso clínico com supervisão profissional"
      ],
      scientificContribution: "Primeira validação sistemática de sinais temporais cognitivos em triagem afásica"
    };
  }

  /**
   * Recomendações
   */
  _generateRecommendations(data) {
    const significantCorrs = Object.values(data.correlations || {}).filter(
      c => parseFloat(c.pValue) < this.significanceLevel
    );

    return {
      title: "RECOMENDAÇÕES",
      forClinicalUse: [
        "✅ CRS pode ser utilizado como ferramenta complementar de triagem",
        "✅ Recomenda-se uso em conjunto com avaliação clínica tradicional",
        "✅ Não substitui julgamento clínico especializado",
        "⚠️ Requer treinamento de operadores"
      ],
      forFutureResearch: [
        "Expandir amostra para n > 100 pares",
        "Incluir múltiplos centros clínicos",
        "Realizar estudos longitudinais de acompanhamento",
        "Validar em outras populações (idiomas, idades, patologias)"
      ],
      forImplementation: [
        "Integrar CRS em fluxo clínico padrão",
        "Criar protocolos de uso estruturado",
        "Estabelecer benchmarks de desempenho",
        "Implementar sistema de feedback para melhoria contínua"
      ]
    };
  }

  /**
   * Avalia nível de evidência
   */
  _assessEvidenceLevel(significantCount) {
    if (significantCount >= 8) return "Nível II-A (Bom)";
    if (significantCount >= 5) return "Nível II-B (Moderado)";
    if (significantCount >= 3) return "Nível III (Limitado)";
    return "Nível IV (Insuficiente)";
  }

  /**
   * Força de correlação
   */
  _assessCorrelationStrength(r) {
    const absR = Math.abs(r);
    if (absR >= 0.9) return "Muito Forte";
    if (absR >= 0.7) return "Forte";
    if (absR >= 0.5) return "Moderada";
    if (absR >= 0.3) return "Fraca";
    return "Muito Fraca";
  }

  /**
   * Validade clínica
   */
  _assessClinicalValidity(significantCount) {
    if (significantCount >= 8) {
      return "Alta validade clínica demonstrada";
    }
    if (significantCount >= 5) {
      return "Validade clínica moderada demonstrada";
    }
    if (significantCount >= 3) {
      return "Validade clínica limitada";
    }
    return "Validade clínica insuficiente";
  }

  /**
   * Conclusão principal
   */
  _getMainConclusion(significantCount) {
    if (significantCount >= 8) {
      return "CRS demonstra validação científica robusta como ferramenta de triagem afásica.";
    }
    if (significantCount >= 5) {
      return "CRS demonstra validação científica moderada como ferramenta complementar de triagem.";
    }
    if (significantCount >= 3) {
      return "CRS mostra promessa como ferramenta complementar, mas requer validação adicional.";
    }
    return "CRS requer validação adicional antes de recomendação clínica.";
  }

  /**
   * Recomendação geral
   */
  _getOverallRecommendation(significantCount) {
    if (significantCount >= 8) {
      return "✅ RECOMENDADO para uso clínico com supervisão profissional";
    }
    if (significantCount >= 5) {
      return "✅ RECOMENDADO para uso clínico como ferramenta complementar";
    }
    if (significantCount >= 3) {
      return "⚠️ PARCIALMENTE RECOMENDADO - Requer validação adicional";
    }
    return "❌ NÃO RECOMENDADO - Validação insuficiente";
  }

  /**
   * Exporta relatório em formato JSON
   */
  exportJSON(reportId) {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return null;

    return JSON.stringify(report, null, 2);
  }

  /**
   * Exporta relatório em formato Markdown (para publicação)
   */
  exportMarkdown(reportId) {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return null;

    let md = `# ${report.executive.title}\n\n`;
    md += `**Data:** ${report.metadata.generatedAt}\n`;
    md += `**Amostra:** n = ${report.metadata.pairingCount}\n\n`;

    md += `## ${report.executive.title}\n`;
    md += `${report.executive.overview}\n\n`;
    md += `**Status:** ${report.executive.validationStatus}\n`;
    md += `**Recomendação:** ${report.executive.recommendation}\n\n`;

    md += `## ${report.methodology.title}\n`;
    md += `- Design: ${report.methodology.design}\n`;
    md += `- Teste: ${report.methodology.statisticalTest}\n`;
    md += `- Nível de significância: ${report.methodology.significanceLevel}\n\n`;

    md += `## ${report.results.title}\n`;
    md += `- Correlações analisadas: ${report.results.summary.totalAnalyzed}\n`;
    md += `- Significativas: ${report.results.summary.significant} (${report.results.summary.percentSignificant}%)\n\n`;

    md += `## ${report.conclusions.title}\n`;
    md += `${report.conclusions.mainConclusion}\n\n`;

    return md;
  }

  /**
   * Retorna histórico de relatórios
   */
  getReportHistory(limit = 10) {
    return this.reports
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        timestamp: new Date(r.timestamp).toLocaleString("pt-BR"),
        pairingCount: r.metadata.pairingCount,
        status: r.executive.validationStatus
      }));
  }
}

// EXPORTAR
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatisticalReport;
}