/**
 * CRS INTEGRATOR - CRS Engine
 * 
 * Função: Integrar CRS ao fluxo de session.js
 * Responsabilidade: Orquestrar pipeline completo de análise
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é o "maestro" que coordena todos os outros.
 * Ele recebe os dados brutos, passa por cada etapa de análise
 * e retorna um relatório completo e validado.
 */

class CRSIntegrator {
  constructor(options = {}) {
    // Instanciar todos os módulos do CRS Engine
    this.temporalExtractor = new TemporalExtractor(options);
    this.signalVectorizer = new SignalVectorizer(options);
    this.cognitiveMetrics = new CognitiveMetrics(options);
    this.crsValidator = new CRSValidator(options);

    // Histórico de sessões processadas
    this.processedSessions = [];
  }

  /**
   * Processa uma sessão completa de captura de áudio
   * INPUT: audioBuffer bruto + metadados da sessão
   * OUTPUT: sessão com CRS embedado + validação
   */
  processSession(audioBuffer, sessionMetadata = {}) {
    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        valid: false,
        error: "Buffer de áudio vazio",
        crsData: null
      };
    }

    const startTime = Date.now();

    try {
      // ============================================
      // ETAPA 1: Extração Temporal
      // ============================================
      const temporalVector = this.temporalExtractor.processAudioBuffer(audioBuffer);

      if (!temporalVector || !temporalVector.vector) {
        return {
          valid: false,
          error: "Falha na extração temporal",
          crsData: null
        };
      }

      // ============================================
      // ETAPA 2: Vetorização de Sinais
      // ============================================
      const crsVector = this.signalVectorizer.vectorizeTemporalSignal(temporalVector.vector);

      if (!crsVector || !crsVector.normalized) {
        return {
          valid: false,
          error: "Falha na vetorização de sinais",
          crsData: null
        };
      }

      // ============================================
      // ETAPA 3: Interpretação Cognitiva
      // ============================================
      const cognitiveMetrics = this.cognitiveMetrics.interpretVector(crsVector.normalized);

      if (!cognitiveMetrics) {
        return {
          valid: false,
          error: "Falha na interpretação cognitiva",
          crsData: null
        };
      }

      // ============================================
      // ETAPA 4: Validação
      // ============================================
      const validation = this.crsValidator.validateVector(crsVector.normalized, sessionMetadata);

      // ============================================
      // CONSOLIDAÇÃO FINAL
      // ============================================
      const processedSession = {
        sessionId: sessionMetadata.sessionId || `sess_${Date.now()}`,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        
        // Dados brutos
        temporalVector: temporalVector.vector,
        
        // Vetor CRS normalizado
        crsVector: crsVector.normalized,
        crsLabels: crsVector.labels,
        crsRaw: crsVector.raw,
        
        // Interpretação cognitiva
        cognitiveMetrics: cognitiveMetrics,
        
        // Validação
        validation: validation,
        
        // Metadados
        metadata: {
          ...sessionMetadata,
          audioLength: audioBuffer.length,
          totalDuration: temporalVector.vector.totalDuration
        },
        
        // Status final
        valid: validation.valid && validation.confidence >= 0.6,
        confidence: validation.confidence,
        readyForClinicalUse: validation.valid && validation.confidence >= 0.75
      };

      // Armazenar no histórico
      this.processedSessions.push(processedSession);

      return processedSession;

    } catch (error) {
      return {
        valid: false,
        error: `Erro no pipeline CRS: ${error.message}`,
        crsData: null
      };
    }
  }

  /**
   * Compara duas sessões processadas (para acompanhamento longitudinal)
   */
  compareSessions(sessionIdA, sessionIdB) {
    const sessA = this.processedSessions.find(s => s.sessionId === sessionIdA);
    const sessB = this.processedSessions.find(s => s.sessionId === sessionIdB);

    if (!sessA || !sessB) {
      return { error: "Uma ou ambas as sessões não encontradas" };
    }

    const vectorComparison = this.signalVectorizer.compareVectors(
      { normalized: sessA.crsVector, labels: sessA.crsLabels },
      { normalized: sessB.crsVector, labels: sessB.crsLabels }
    );

    const cognitiveComparison = this.cognitiveMetrics.compareProfiles(
      sessA.cognitiveMetrics,
      sessB.cognitiveMetrics
    );

    return {
      sessionA: sessionIdA,
      sessionB: sessionIdB,
      vectorComparison,
      cognitiveComparison,
      summary: {
        overallTrend: vectorComparison.summary.overallTrend,
        significantChanges: vectorComparison.summary.significantIncreases + 
                           vectorComparison.summary.significantDecreases
      }
    };
  }

  /**
   * Gera relatório clínico completo para o médico
   */
  generateClinicialReport(sessionId, patientName, doctorName) {
    const session = this.processedSessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return { error: "Sessão não encontrada" };
    }

    const report = {
      header: {
        title: "RELATÓRIO CRS — ANÁLISE VOCAL ESTRUTURADA",
        date: new Date(session.timestamp).toLocaleString("pt-BR"),
        patient: patientName || "Anônimo",
        doctor: doctorName || "Médico responsável",
        sessionId: sessionId,
        processingTime: `${session.processingTime}ms`,
        disclaimer: "⚠️ ESTE NÃO É UM DIAGNÓSTICO AUTOMÁTICO. É APOIO MÉTRICO/VISUAL. RESPONSABILIDADE CLÍNICA DO MÉDICO."
      },

      qualityAssurance: {
        overallStatus: session.valid ? "✅ VÁLIDO" : "❌ INVÁLIDO",
        confidenceScore: `${(session.confidence * 100).toFixed(1)}%`,
        readyForClinicalUse: session.readyForClinicalUse,
        validationDetails: this.crsValidator.generateValidationReport(session.validation)
      },

      crsVector: {
        normalized: session.crsVector.map(v => v.toFixed(3)),
        labels: session.crsLabels,
        interpretation: session.cognitiveMetrics.metrics.map(m => ({
          dimension: m.name,
          value: m.value.toFixed(3),
          range: m.range,
          interpretation: m.interpretation
        }))
      },

      cognitiveProfile: {
        keyFindings: session.cognitiveMetrics.summary.keyFindings,
        clinicalImpressions: session.cognitiveMetrics.summary.clinicalImpressions,
        recommendedActions: session.cognitiveMetrics.summary.recommendedActions,
        overallProfile: session.cognitiveMetrics.summary.overallProfile
      },

      technicalData: {
        audioLength: session.metadata.audioLength,
        totalDuration: session.metadata.totalDuration,
        eventCount: session.temporalVector.eventCount,
        pauseIntervals: session.temporalVector.pauseIntervals,
        speechIntervals: session.temporalVector.speechIntervals
      },

      clinicalInterpretation: {
        instruction: "Preencha abaixo sua interpretação clínica (obrigatório)",
        diagnosis: "",
        hypothesis: "",
        recommendations: "",
        followUp: ""
      }
    };

    return report;
  }

  /**
   * Exporta sessão processada em formato JSON para armazenamento
   */
  exportSession(sessionId) {
    const session = this.processedSessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return null;
    }

    return {
      version: "1.0",
      crsEngine: "CRS Integrator v1.0",
      sessionId: session.sessionId,
      timestamp: session.timestamp,
      crsVector: session.crsVector,
      crsLabels: session.crsLabels,
      cognitiveMetrics: session.cognitiveMetrics,
      validation: session.validation,
      metadata: session.metadata
    };
  }

  /**
   * Importa sessão processada de JSON
   */
  importSession(jsonData) {
    if (!jsonData.crsVector || !jsonData.cognitiveMetrics) {
      return { error: "Formato JSON inválido" };
    }

    const importedSession = {
      sessionId: jsonData.sessionId,
      timestamp: jsonData.timestamp,
      crsVector: jsonData.crsVector,
      crsLabels: jsonData.crsLabels,
      cognitiveMetrics: jsonData.cognitiveMetrics,
      validation: jsonData.validation,
      metadata: jsonData.metadata,
      valid: jsonData.validation.valid,
      confidence: jsonData.validation.confidence,
      readyForClinicalUse: jsonData.validation.confidence >= 0.75
    };

    this.processedSessions.push(importedSession);
    return importedSession;
  }

  /**
   * Retorna histórico de sessões processadas
   */
  getSessionHistory(limit = 10) {
    return this.processedSessions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(s => ({
        sessionId: s.sessionId,
        timestamp: new Date(s.timestamp).toLocaleString("pt-BR"),
        confidence: `${(s.confidence * 100).toFixed(1)}%`,
        valid: s.valid,
        readyForClinical: s.readyForClinicalUse
      }));
  }

  /**
   * Limpa histórico
   */
  clearHistory() {
    this.processedSessions = [];
    return { message: "Histórico limpo" };
  }
}

// EXPORTAR
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CRSIntegrator;
}