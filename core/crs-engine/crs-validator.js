/**
 * CRS VALIDATOR - CRS Engine
 * 
 * Função: Validar coerência dos sinais CRS
 * Responsabilidade: Garantir que os dados fazem sentido antes de usar
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "detector de qualidade". Ele verifica se os números
 * que recebeu são confiáveis ou se há algo errado (ruído, dados incompletos).
 */

class CRSValidator {
  constructor(options = {}) {
    // Limites esperados para cada dimensão CRS
    this.expectedRanges = {
      0: { min: 0, max: 1, name: "RMS" },
      1: { min: 0, max: 1, name: "Pausa Micro" },
      2: { min: 0, max: 1, name: "Pausa Curta" },
      3: { min: 0, max: 1, name: "Pausa Média" },
      4: { min: 0, max: 1, name: "Pausa Longa" },
      5: { min: 0, max: 1, name: "Pitch Proxy" },
      6: { min: 0, max: 1, name: "Graves" },
      7: { min: 0, max: 1, name: "Inteligibilidade" }
    };

    // Thresholds de qualidade
    this.qualityThresholds = {
      minDataPoints: 10,           // Mínimo de pontos de dados
      maxOutliers: 0.2,            // Máximo 20% de outliers
      minVariance: 0.01,           // Variância mínima (não pode ser zero)
      maxVariance: 0.9,            // Variância máxima (não pode ser muito alta)
      minConfidence: 0.6            // Confiança mínima aceitável (60%)
    };

    // Histórico de validações (para análise longitudinal)
    this.validationHistory = [];
  }

  /**
   * Valida um vetor CRS completo
   * INPUT: vetor normalizado [8 dimensões]
   * OUTPUT: relatório de validação com confidence score
   */
  validateVector(crsVector, metadata = {}) {
    if (!crsVector || crsVector.length !== 8) {
      return {
        valid: false,
        confidence: 0,
        errors: ["Vetor CRS inválido ou incompleto"],
        warnings: [],
        details: null
      };
    }

    const validation = {
      timestamp: Date.now(),
      vectorLength: crsVector.length,
      errors: [],
      warnings: [],
      anomalies: [],
      outOfRangeValues: [],
      confidenceFactors: {
        rangeCompliance: 0,
        varianceQuality: 0,
        outlierDetection: 0,
        dataCompleteness: 0,
        temporalCoherence: 0
      },
      confidence: 0,
      valid: true
    };

    // ============================================
    // CHECK 1: Valores dentro de [0, 1]
    // ============================================
    let rangeCompliance = 0;
    crsVector.forEach((val, idx) => {
      const range = this.expectedRanges[idx];
      if (val < range.min || val > range.max) {
        validation.outOfRangeValues.push({
          dimension: idx,
          name: range.name,
          value: val.toFixed(3),
          expected: `[${range.min}, ${range.max}]`
        });
        validation.errors.push(`Dimensão ${idx} (${range.name}) fora do intervalo esperado: ${val.toFixed(3)}`);
      } else {
        rangeCompliance++;
      }
    });
    validation.confidenceFactors.rangeCompliance = rangeCompliance / 8;

    // ============================================
    // CHECK 2: Detecção de NaN e Infinity
    // ============================================
    crsVector.forEach((val, idx) => {
      if (isNaN(val)) {
        validation.errors.push(`Dimensão ${idx} contém NaN`);
        validation.anomalies.push({ type: "NaN", dimension: idx });
      }
      if (!isFinite(val)) {
        validation.errors.push(`Dimensão ${idx} contém Infinity`);
        validation.anomalies.push({ type: "Infinity", dimension: idx });
      }
    });

    // ============================================
    // CHECK 3: Variância (não pode ser zero ou muito alta)
    // ============================================
    const mean = crsVector.reduce((a, b) => a + b, 0) / crsVector.length;
    const variance = crsVector.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / crsVector.length;
    const stdDev = Math.sqrt(variance);

    let varianceQuality = 0;
    if (variance < this.qualityThresholds.minVariance) {
      validation.warnings.push(`Variância muito baixa (${variance.toFixed(4)}): vetor muito uniforme, possível erro de calibração`);
      varianceQuality = 0.3;
    } else if (variance > this.qualityThresholds.maxVariance) {
      validation.warnings.push(`Variância muito alta (${variance.toFixed(4)}): vetor muito disperso, possível ruído excessivo`);
      varianceQuality = 0.4;
    } else {
      varianceQuality = 1.0;
    }
    validation.confidenceFactors.varianceQuality = varianceQuality;

    // ============================================
    // CHECK 4: Detecção de Outliers (IQR method)
    // ============================================
    const sorted = [...crsVector].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    let outlierCount = 0;
    crsVector.forEach((val, idx) => {
      if (val < lowerBound || val > upperBound) {
        outlierCount++;
        validation.anomalies.push({
          type: "Outlier",
          dimension: idx,
          value: val.toFixed(3),
          bounds: `[${lowerBound.toFixed(3)}, ${upperBound.toFixed(3)}]`
        });
      }
    });

    const outlierRatio = outlierCount / crsVector.length;
    let outlierQuality = 1.0 - outlierRatio;
    if (outlierRatio > this.qualityThresholds.maxOutliers) {
      validation.warnings.push(`${(outlierRatio*100).toFixed(1)}% de outliers detectados: possível ruído ou dados anômalos`);
      outlierQuality = Math.max(0.3, outlierQuality);
    }
    validation.confidenceFactors.outlierDetection = outlierQuality;

    // ============================================
    // CHECK 5: Coerência Temporal (pausas devem somar ~1)
    // ============================================
    const pauseSum = crsVector[1] + crsVector[2] + crsVector[3] + crsVector[4];
    let temporalCoherence = 1.0;
    if (pauseSum < 0.3) {
      validation.warnings.push(`Soma de pausas muito baixa (${pauseSum.toFixed(3)}): possível falta de pausas ou gravação incompleta`);
      temporalCoherence = 0.5;
    } else if (pauseSum > 1.5) {
      validation.warnings.push(`Soma de pausas muito alta (${pauseSum.toFixed(3)}): possível sobreposição ou erro de cálculo`);
      temporalCoherence = 0.6;
    }
    validation.confidenceFactors.temporalCoherence = temporalCoherence;

    // ============================================
    // CHECK 6: Completude de Dados
    // ============================================
    const nonZeroCount = crsVector.filter(v => v > 0.01).length;
    const dataCompleteness = nonZeroCount / crsVector.length;
    if (dataCompleteness < 0.5) {
      validation.warnings.push(`Menos de 50% das dimensões têm dados: possível gravação incompleta`);
    }
    validation.confidenceFactors.dataCompleteness = dataCompleteness;

    // ============================================
    // CÁLCULO FINAL DE CONFIANÇA
    // ============================================
    const weights = {
      rangeCompliance: 0.25,
      varianceQuality: 0.20,
      outlierDetection: 0.20,
      dataCompleteness: 0.15,
      temporalCoherence: 0.20
    };

    validation.confidence = Object.keys(weights).reduce((acc, key) => {
      return acc + (validation.confidenceFactors[key] * weights[key]);
    }, 0);

    // ============================================
    // DECISÃO FINAL
    // ============================================
    if (validation.errors.length > 0) {
      validation.valid = false;
      validation.confidence = Math.max(0, validation.confidence - 0.5);
    }

    if (validation.confidence < this.qualityThresholds.minConfidence) {
      validation.valid = false;
    }

    // Armazenar no histórico
    this.validationHistory.push({
      timestamp: validation.timestamp,
      confidence: validation.confidence,
      valid: validation.valid,
      errorCount: validation.errors.length
    });

    return validation;
  }

  /**
   * Compara validação atual com histórico
   * Detecta degradação progressiva de qualidade
   */
  detectDegradation() {
    if (this.validationHistory.length < 3) {
      return { degrading: false, trend: "insufficient_data" };
    }

    const recent = this.validationHistory.slice(-5);
    const confidences = recent.map(v => v.confidence);
    const trend = confidences[confidences.length - 1] - confidences[0];

    return {
      degrading: trend < -0.15,
      trend: trend.toFixed(3),
      recentConfidences: confidences.map(c => c.toFixed(2)),
      recommendation: trend < -0.15 
        ? "Qualidade degradando. Considere recalibrar o sistema."
        : "Qualidade estável."
    };
  }

  /**
   * Gera relatório de validação para o médico
   */
  generateValidationReport(validation) {
    const report = {
      timestamp: new Date(validation.timestamp).toLocaleString("pt-BR"),
      overallStatus: validation.valid ? "✅ VÁLIDO" : "❌ INVÁLIDO",
      confidenceScore: `${(validation.confidence * 100).toFixed(1)}%`,
      summary: {
        totalErrors: validation.errors.length,
        totalWarnings: validation.warnings.length,
        anomaliesDetected: validation.anomalies.length,
        outOfRangeValues: validation.outOfRangeValues.length
      },
      details: {
        errors: validation.errors,
        warnings: validation.warnings,
        anomalies: validation.anomalies
      },
      factorBreakdown: Object.entries(validation.confidenceFactors).map(([key, val]) => ({
        factor: key,
        score: `${(val * 100).toFixed(1)}%`
      })),
      recommendation: this._getRecommendation(validation)
    };

    return report;
  }

  /**
   * Recomendação baseada em validação
   */
  _getRecommendation(validation) {
    if (!validation.valid) {
      return "⚠️ DADOS INVÁLIDOS: Não use para análise clínica. Repita a captura.";
    }

    if (validation.confidence >= 0.9) {
      return "✅ EXCELENTE: Dados de alta confiabilidade. Seguro para análise clínica.";
    }

    if (validation.confidence >= 0.75) {
      return "✅ BOM: Dados confiáveis, com pequenas ressalvas. Adequado para análise.";
    }

    if (validation.confidence >= 0.6) {
      return "⚠️ ACEITÁVEL: Dados com qualidade moderada. Use com cautela, considere validação adicional.";
    }

    return "❌ INSUFICIENTE: Qualidade inadequada. Não recomendado para uso clínico.";
  }

  /**
   * Exporta histórico de validações
   */
  exportValidationHistory() {
    return {
      totalValidations: this.validationHistory.length,
      averageConfidence: (
        this.validationHistory.reduce((a, b) => a + b.confidence, 0) /
        this.validationHistory.length
      ).toFixed(3),
      validCount: this.validationHistory.filter(v => v.valid).length,
      invalidCount: this.validationHistory.filter(v => !v.valid).length,
      history: this.validationHistory
    };
  }
}

// EXPORTAR
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CRSValidator;
}