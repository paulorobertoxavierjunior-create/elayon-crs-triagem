/**
 * SIGNAL VECTORIZER - CRS Engine
 * 
 * Função: Transformar sinais brutos em características formalizadas
 * Responsabilidade: Normalizar pausas, calcular estatísticas, vetorizar em 8 dimensões
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "tradutor de ritmo". Ele pega os números brutos de tempo
 * e os transforma em 8 métricas padronizadas que você pode comparar e entender.
 */

class SignalVectorizer {
  constructor(options = {}) {
    // Faixas de pausa (em ms) — baseadas em literatura cognitiva
    this.pauseFractions = {
      micro: { min: 0, max: 100 },        // Micro-pausas (< 100ms)
      curta: { min: 100, max: 200 },      // Curta (100-200ms) = hesitação decisória
      media: { min: 200, max: 1000 },     // Média (200-1000ms) = reorganização cognitiva
      longa: { min: 1000, max: Infinity } // Longa (1000ms+) = fadiga/esforço
    };

    // Bandas de frequência para análise espectral (em Hz)
    this.frequencyBands = {
      subgrave: { min: 20, max: 60 },      // Ressonância basal
      graves: { min: 60, max: 250 },       // Projeção vocal
      medias: { min: 250, max: 800 },      // Consoantes
      altas: { min: 800, max: 3500 }       // Inteligibilidade
    };

    // Pesos para agregação (podem ser ajustados conforme contexto)
    this.weights = {
      rms: 1.0,
      pauseMicro: 0.8,
      pauseCurta: 1.2,
      pauseMedia: 1.0,
      pauseLonga: 1.5,
      pitch: 0.9,
      subgrave: 0.7,
      graves: 1.0,
      medias: 1.1,
      altas: 1.3
    };
  }

  /**
   * Vetoriza um sinal temporal completo em 8 dimensões CRS
   * 
   * INPUT: { timestamps, intervals, pauseIntervals, speechIntervals, totalDuration, rawEvents }
   * OUTPUT: vetor [RMS, PauseMicro, PauseCurta, PauseMedia, PauseLonga, Pitch, Graves, Altas]
   */
  vectorizeTemporalSignal(temporalVector) {
    if (!temporalVector || !temporalVector.pauseIntervals) {
      throw new Error("Vetor temporal inválido. Chame temporal-extractor primeiro.");
    }

    // ============================================
    // DIMENSÃO 1: RMS (Energia / Intensidade Vocal)
    // ============================================
    const rms = this._calculateRMS(temporalVector);

    // ============================================
    // DIMENSÕES 2-5: Pausas Normalizadas
    // ============================================
    const pauseMicro = this._calculatePauseFraction(
      temporalVector.pauseIntervals,
      this.pauseFractions.micro
    );
    const pauseCurta = this._calculatePauseFraction(
      temporalVector.pauseIntervals,
      this.pauseFractions.curta
    );
    const pauseMedia = this._calculatePauseFraction(
      temporalVector.pauseIntervals,
      this.pauseFractions.media
    );
    const pauseLonga = this._calculatePauseFraction(
      temporalVector.pauseIntervals,
      this.pauseFractions.longa
    );

    // ============================================
    // DIMENSÃO 6: Pitch Proxy (Frequência Fundamental)
    // ============================================
    const pitchProxy = this._calculatePitchProxy(temporalVector);

    // ============================================
    // DIMENSÃO 7: Graves (Projeção Vocal)
    // ============================================
    const gravesEnergy = this._calculateFrequencyBandEnergy(
      temporalVector,
      this.frequencyBands.graves
    );

    // ============================================
    // DIMENSÃO 8: Médias-Altas (Inteligibilidade)
    // ============================================
    const intelligibilityEnergy = this._calculateFrequencyBandEnergy(
      temporalVector,
      this.frequencyBands.altas
    );

    // ============================================
    // VETOR CRS FORMALIZADO (8 dimensões)
    // ============================================
    const crsVector = [
      rms,
      pauseMicro,
      pauseCurta,
      pauseMedia,
      pauseLonga,
      pitchProxy,
      gravesEnergy,
      intelligibilityEnergy
    ];

    // ============================================
    // NORMALIZAR PARA [0, 1]
    // ============================================
    const normalizedVector = this._normalizeVector(crsVector);

    return {
      raw: {
        rms,
        pauseMicro,
        pauseCurta,
        pauseMedia,
        pauseLonga,
        pitchProxy,
        gravesEnergy,
        intelligibilityEnergy
      },
      normalized: normalizedVector,
      labels: [
        "RMS (Energia)",
        "Pausa Micro [0-100ms]",
        "Pausa Curta [100-200ms]",
        "Pausa Média [200-1s]",
        "Pausa Longa [1s+]",
        "Pitch Proxy",
        "Graves [60-250Hz]",
        "Inteligibilidade [800-3500Hz]"
      ],
      metadata: {
        timestamp: Date.now(),
        totalDuration: temporalVector.totalDuration,
        eventCount: temporalVector.eventCount
      }
    };
  }

  /**
   * Calcula RMS (Root Mean Square) — medida de energia/intensidade
   * Baseado em amplitude média dos eventos de fala
   */
  _calculateRMS(temporalVector) {
    if (!temporalVector.rawEvents || temporalVector.rawEvents.length === 0) {
      return 0;
    }

    const speechEvents = temporalVector.rawEvents.filter(e => e.type === "speech");
    if (speechEvents.length === 0) return 0;

    // Calcula RMS a partir da energia máxima dos eventos de fala
    let sumSquares = 0;
    speechEvents.forEach(event => {
      const rmsMax = event.rmsMax || 0;
      sumSquares += rmsMax * rmsMax;
    });

    const rms = Math.sqrt(sumSquares / speechEvents.length);
    return Math.min(1, rms); // Clamp para [0, 1]
  }

  /**
   * Calcula a fração de pausas em uma faixa específica
   * Retorna: proporção de pausas naquela faixa (0-1)
   */
  _calculatePauseFraction(pauseIntervals, fraction) {
    if (!pauseIntervals || pauseIntervals.length === 0) {
      return 0;
    }

    const pausesInFraction = pauseIntervals.filter(
      p => p >= fraction.min && p < fraction.max
    ).length;

    return pausesInFraction / pauseIntervals.length;
  }

  /**
   * Calcula Pitch Proxy (estimativa de frequência fundamental)
   * Baseado em variação de intervalos entre eventos
   */
  _calculatePitchProxy(temporalVector) {
    if (!temporalVector.intervals || temporalVector.intervals.length === 0) {
      return 0;
    }

    // Pitch proxy = inverso da variação de ritmo
    // Ritmo regular (baixa variação) = pitch mais estável
    const intervals = temporalVector.intervals;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Pitch proxy: quanto menor a variação, maior o pitch proxy (0-1)
    const pitchProxy = Math.exp(-stdDev / mean);
    return Math.min(1, pitchProxy);
  }

  /**
   * Calcula energia em uma banda de frequência específica
   * Simula análise FFT sem processar áudio real
   */
  _calculateFrequencyBandEnergy(temporalVector, band) {
    if (!temporalVector.rawEvents || temporalVector.rawEvents.length === 0) {
      return 0;
    }

    // Proxy: usa RMS máximo como indicador de energia na banda
    const speechEvents = temporalVector.rawEvents.filter(e => e.type === "speech");
    if (speechEvents.length === 0) return 0;

    const maxRms = Math.max(...speechEvents.map(e => e.rmsMax || 0));
    
    // Bandas mais altas (inteligibilidade) têm menos energia absoluta
    // Bandas mais baixas (graves) têm mais energia
    const bandFactor = 1 / (1 + (band.max - band.min) / 1000);
    
    return Math.min(1, maxRms * bandFactor);
  }

  /**
   * Normaliza um vetor para [0, 1]
   */
  _normalizeVector(vector) {
    const max = Math.max(...vector);
    const min = Math.min(...vector);
    const range = max - min || 1;

    return vector.map(v => (v - min) / range);
  }

  /**
   * Calcula estatísticas agregadas do vetor CRS
   * Útil para comparações e análises longitudinais
   */
  calculateAggregateStatistics(crsVectors) {
    if (!crsVectors || crsVectors.length === 0) {
      return null;
    }

    const dimensions = crsVectors[0].normalized.length;
    const stats = {
      mean: new Array(dimensions).fill(0),
      variance: new Array(dimensions).fill(0),
      entropy: new Array(dimensions).fill(0),
      min: new Array(dimensions).fill(Infinity),
      max: new Array(dimensions).fill(-Infinity)
    };

    // Calcula média
    crsVectors.forEach(vec => {
      vec.normalized.forEach((val, idx) => {
        stats.mean[idx] += val;
        stats.min[idx] = Math.min(stats.min[idx], val);
        stats.max[idx] = Math.max(stats.max[idx], val);
      });
    });

    stats.mean = stats.mean.map(m => m / crsVectors.length);

    // Calcula variância
    crsVectors.forEach(vec => {
      vec.normalized.forEach((val, idx) => {
        stats.variance[idx] += Math.pow(val - stats.mean[idx], 2);
      });
    });

    stats.variance = stats.variance.map(v => v / crsVectors.length);

    // Calcula entropia (medida de incerteza/variabilidade)
    stats.entropy = stats.variance.map(v => -Math.log(Math.max(0.001, 1 - v)));

    return stats;
  }

  /**
   * Compara dois vetores CRS e retorna diferenças percentuais
   * Útil para acompanhamento longitudinal
   */
  compareVectors(vectorA, vectorB) {
    if (!vectorA || !vectorB) {
      return null;
    }

    const differences = [];
    const labels = vectorA.labels || [];

    for (let i = 0; i < vectorA.normalized.length; i++) {
      const valA = vectorA.normalized[i];
      const valB = vectorB.normalized[i];
      const diff = ((valB - valA) / (valA || 0.001)) * 100; // % de mudança

      differences.push({
        dimension: labels[i] || `Dim${i}`,
        valueA: valA.toFixed(3),
        valueB: valB.toFixed(3),
        percentChange: diff.toFixed(1),
        direction: diff > 0 ? "↑" : "↓"
      });
    }

    return {
      timestamp: Date.now(),
      differences,
      summary: {
        totalDimensions: vectorA.normalized.length,
        dimensionsIncreased: differences.filter(d => d.percentChange > 0).length,
        dimensionsDecreased: differences.filter(d => d.percentChange < 0).length,
        averageChange: (
          differences.reduce((a, b) => a + parseFloat(b.percentChange), 0) /
          differences.length
        ).toFixed(1)
      }
    };
  }

  /**
   * Exporta vetor CRS em formato JSON para armazenamento/transmissão
   */
  exportJSON(crsVector) {
    return {
      version: "1.0",
      timestamp: crsVector.metadata.timestamp,
      vector: crsVector.normalized,
      labels: crsVector.labels,
      raw: crsVector.raw,
      metadata: crsVector.metadata
    };
  }

  /**
   * Importa vetor CRS de JSON
   */
  importJSON(jsonData) {
    return {
      normalized: jsonData.vector,
      raw: jsonData.raw,
      labels: jsonData.labels,
      metadata: jsonData.metadata
    };
  }
}

// ============================================
// EXPORTAR PARA USO EM OUTROS MÓDULOS
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SignalVectorizer;
}