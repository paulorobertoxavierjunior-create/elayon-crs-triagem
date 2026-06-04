/**
 * CORRELATION ENGINE - Clinical Validation
 * 
 * Função: Calcular correlações entre CRS e avaliação clínica
 * Responsabilidade: Validar fidedignidade das métricas CRS
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "validador científico". Ele compara os números do CRS
 * com sua avaliação clínica e mostra se estão correlacionados.
 * Se correlacionam bem, o CRS é fidedigno.
 */

class CorrelationEngine {
  constructor(options = {}) {
    this.correlations = [];
    this.pairings = []; // Pares CRS + Clínico
  }

  /**
   * Adiciona um par de dados (CRS + Avaliação Clínica)
   */
  addPairing(crsVector, clinicalAssessment) {
    if (!crsVector || !clinicalAssessment) {
      return { error: "Dados incompletos" };
    }

    const pairing = {
      id: `pair_${Date.now()}`,
      timestamp: Date.now(),
      crsVector: crsVector,
      clinicalScores: clinicalAssessment.clinicalScores,
      qualitativeFindings: clinicalAssessment.qualitativeFindings,
      diagnosis: clinicalAssessment.diagnosis
    };

    this.pairings.push(pairing);
    return pairing;
  }

  /**
   * Calcula correlação de Pearson entre duas variáveis
   */
  calculatePearson(x, y) {
    if (x.length !== y.length || x.length < 2) {
      return null;
    }

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b) / n;
    const meanY = y.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denominator = Math.sqrt(denomX * denomY);
    if (denominator === 0) return null;

    return numerator / denominator;
  }

  /**
   * Calcula p-value (significância estatística)
   * Usa aproximação t-distribution
   */
  calculatePValue(r, n) {
    if (!r || n < 3) return null;

    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    // Aproximação simplificada (t-distribution)
    const pValue = 2 * (1 - this._tCDF(Math.abs(t), n - 2));
    return Math.max(0, Math.min(1, pValue));
  }

  /**
   * CDF da distribuição t (aproximação)
   */
  _tCDF(t, df) {
    const x = df / (df + t * t);
    return this._incompleteBeta(x, df / 2, 0.5);
  }

  /**
   * Beta incompleta (aproximação)
   */
  _incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lnBeta = this._logBeta(a, b);
    return Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta);
  }

  /**
   * Log da função beta
   */
  _logBeta(a, b) {
    return (
      (a > 0 ? Math.log(a) : 0) +
      (b > 0 ? Math.log(b) : 0) -
      Math.log(a + b)
    );
  }

  /**
   * Calcula todas as correlações entre CRS e escalas clínicas
   */
  calculateAllCorrelations() {
    if (this.pairings.length < 3) {
      return {
        error: "Mínimo 3 pares necessários para correlação",
        pairingCount: this.pairings.length
      };
    }

    const results = {
      timestamp: Date.now(),
      pairingCount: this.pairings.length,
      correlations: {}
    };

    // Extrair vetores CRS
    const crsDimensions = this.pairings[0].crsVector.length;
    const crsLabels = [
      "RMS",
      "PausaMicro",
      "PausaCurta",
      "PauseMedia",
      "PausaLonga",
      "PitchProxy",
      "Graves",
      "Inteligibilidade"
    ];

    // Extrair escalas clínicas
    const clinicalScales = [
      "severity",
      "intelligibility",
      "effort",
      "fluency",
      "pauses"
    ];

    // Calcular correlações CRS × Escalas Clínicas
    for (let i = 0; i < crsDimensions; i++) {
      const crsValues = this.pairings.map(p => p.crsVector[i]);

      for (const scale of clinicalScales) {
        const clinicalValues = this.pairings.map(
          p => p.clinicalScores[scale]
        );

        const r = this.calculatePearson(crsValues, clinicalValues);
        const pValue = r ? this.calculatePValue(r, this.pairings.length) : null;

        const key = `${crsLabels[i]}_vs_${scale}`;
        results.correlations[key] = {
          dimension: crsLabels[i],
          clinicalScale: scale,
          pearsonR: r ? r.toFixed(3) : "N/A",
          pValue: pValue ? pValue.toFixed(4) : "N/A",
          significant: pValue && pValue < 0.05 ? "✅ SIM" : "❌ NÃO",
          strength: this._interpretCorrelationStrength(r)
        };
      }
    }

    this.correlations = results;
    return results;
  }

  /**
   * Interpreta força da correlação
   */
  _interpretCorrelationStrength(r) {
    if (!r) return "Não calculável";
    const abs = Math.abs(r);
    if (abs < 0.3) return "Fraca";
    if (abs < 0.5) return "Moderada";
    if (abs < 0.7) return "Forte";
    return "Muito Forte";
  }

  /**
   * Gera matriz de correlações formatada
   */
  generateCorrelationMatrix() {
    if (!this.correlations || !this.correlations.correlations) {
      return { error: "Nenhuma correlação calculada" };
    }

    const matrix = {
      title: "MATRIZ DE CORRELAÇÕES CRS × ESCALAS CLÍNICAS",
      timestamp: new Date(this.correlations.timestamp).toLocaleString("pt-BR"),
      pairingCount: this.correlations.pairingCount,
      table: []
    };

    Object.entries(this.correlations.correlations).forEach(([key, corr]) => {
      matrix.table.push({
        crsDimension: corr.dimension,
        clinicalScale: corr.clinicalScale,
        r: corr.pearsonR,
        pValue: corr.pValue,
        significant: corr.significant,
        strength: corr.strength
      });
    });

    return matrix;
  }

  /**
   * Identifica correlações significativas
   */
  getSignificantCorrelations(pValueThreshold = 0.05) {
    if (!this.correlations || !this.correlations.correlations) {
      return [];
    }

    return Object.entries(this.correlations.correlations)
      .filter(([_, corr]) => {
        const p = parseFloat(corr.pValue);
        return p < pValueThreshold;
      })
      .map(([key, corr]) => ({
        pair: key,
        r: corr.pearsonR,
        pValue: corr.pValue,
        strength: corr.strength,
        interpretation: `${corr.dimension} correlaciona ${corr.strength.toLowerCase()} com ${corr.clinicalScale} (r=${corr.pearsonR}, p=${corr.pValue})`
      }));
  }

  /**
   * Gera relatório de validação
   */
  generateValidationReport() {
    const significantCorrs = this.getSignificantCorrelations();

    const report = {
      title: "RELATÓRIO DE VALIDAÇÃO CRS",
      date: new Date().toLocaleString("pt-BR"),
      summary: {
        totalPairings: this.pairings.length,
        totalCorrelations: Object.keys(
          this.correlations.correlations || {}
        ).length,
        significantCorrelations: significantCorrs.length,
        validationStatus:
          significantCorrs.length >= 5 ? "✅ VALIDADO" : "⚠️ PARCIALMENTE VALIDADO"
      },
      significantFindings: significantCorrs.map(corr => corr.interpretation),
      clinicalImplications: this._generateClinicalImplications(
        significantCorrs
      ),
      recommendation: this._generateRecommendation(significantCorrs)
    };

    return report;
  }

  /**
   * Gera implicações clínicas
   */
  _generateClinicalImplications(significantCorrs) {
    const implications = [];

    const severityCorrs = significantCorrs.filter(c =>
      c.pair.includes("severity")
    );
    if (severityCorrs.length > 0) {
      implications.push(
        `Severidade clínica correlaciona com: ${severityCorrs.map(c => c.pair.split("_")[0]).join(", ")}`
      );
    }

    const intelligibilityCorrs = significantCorrs.filter(c =>
      c.pair.includes("intelligibility")
    );
    if (intelligibilityCorrs.length > 0) {
      implications.push(
        `Inteligibilidade correlaciona com: ${intelligibilityCorrs.map(c => c.pair.split("_")[0]).join(", ")}`
      );
    }

    const pauseCorrs = significantCorrs.filter(c =>
      c.pair.includes("pauses")
    );
    if (pauseCorrs.length > 0) {
      implications.push(
        `Frequência de pausas clínicas correlaciona com: ${pauseCorrs.map(c => c.pair.split("_")[0]).join(", ")}`
      );
    }

    return implications.length > 0
      ? implications
      : ["Correlações insuficientes para implicações clínicas"];
  }

  /**
   * Gera recomendação
   */
  _generateRecommendation(significantCorrs) {
    if (significantCorrs.length >= 8) {
      return "✅ CRS ALTAMENTE FIDEDIGNO: Métricas correlacionam bem com avaliação clínica. Seguro para uso clínico.";
    }

    if (significantCorrs.length >= 5) {
      return "✅ CRS VALIDADO: Correlações significativas demonstram fidedignidade. Recomendado para uso clínico com supervisão.";
    }

    if (significantCorrs.length >= 3) {
      return "⚠️ CRS PARCIALMENTE VALIDADO: Algumas correlações significativas. Recomenda-se mais dados para validação completa.";
    }

    return "❌ CRS NÃO VALIDADO: Correlações insuficientes. Não recomendado para uso clínico sem mais validação.";
  }

  /**
   * Exporta dados de correlação
   */
  exportCorrelationData() {
    return {
      version: "1.0",
      timestamp: this.correlations.timestamp,
      pairingCount: this.correlations.pairingCount,
      correlations: this.correlations.correlations,
      significantCorrelations: this.getSignificantCorrelations(),
      validationReport: this.generateValidationReport()
    };
  }
}

// EXPORTAR
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CorrelationEngine;
}