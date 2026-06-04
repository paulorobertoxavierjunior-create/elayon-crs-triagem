/**
 * NEUROLOGIST ASSESSMENT - Clinical Validation
 * 
 * Função: Estruturar avaliação clínica do neurologista
 * Responsabilidade: Capturar julgamento clínico especializado
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "formulário clínico estruturado".
 * Você preenche sua avaliação profissional aqui.
 * O sistema depois correlaciona com os números do CRS.
 */

class NeurologistAssessment {
  constructor(options = {}) {
    // Escalas clínicas padronizadas
    this.scales = {
      severity: {
        name: "Severidade da Afasia",
        min: 0,
        max: 10,
        labels: {
          0: "Sem alteração",
          3: "Leve",
          5: "Moderada",
          7: "Moderada-severa",
          10: "Severa"
        }
      },
      intelligibility: {
        name: "Inteligibilidade da Fala",
        min: 0,
        max: 100,
        unit: "%",
        labels: {
          0: "Incompreensível",
          25: "Muito difícil",
          50: "Difícil",
          75: "Razoável",
          100: "Clara"
        }
      },
      effort: {
        name: "Esforço para Falar",
        min: 0,
        max: 10,
        labels: {
          0: "Sem esforço",
          3: "Leve",
          5: "Moderado",
          7: "Considerável",
          10: "Extremo"
        }
      },
      fluency: {
        name: "Fluência da Fala",
        min: 0,
        max: 10,
        labels: {
          0: "Muito fluida",
          3: "Fluida",
          5: "Levemente não-fluida",
          7: "Não-fluida",
          10: "Muito não-fluida"
        }
      },
      pauses: {
        name: "Frequência de Pausas",
        min: 0,
        max: 10,
        labels: {
          0: "Raras",
          3: "Ocasionais",
          5: "Frequentes",
          7: "Muito frequentes",
          10: "Constantes"
        }
      }
    };

    this.assessments = [];
  }

  /**
   * Cria nova avaliação clínica
   */
  createAssessment(sessionId, doctorName) {
    const assessment = {
      id: `assess_${Date.now()}`,
      sessionId: sessionId,
      doctorName: doctorName,
      timestamp: Date.now(),
      
      // Escalas numéricas
      clinicalScores: {
        severity: null,
        intelligibility: null,
        effort: null,
        fluency: null,
        pauses: null
      },

      // Classificações qualitativas
      qualitativeFindings: {
        afasiaType: null,           // Broca, Wernicke, Condução, Global, Anômia
        speechCharacteristics: [],  // Lenta, Rápida, Entrecortada, Monótona, etc
        comprehension: null,        // Preservada, Prejudicada, Severa
        repetition: null,           // Normal, Prejudicada, Severa
        naming: null                // Normal, Prejudicada, Severa
      },

      // Observações clínicas
      clinicalObservations: {
        contextualFactors: "",      // Fadiga, medicação, estado emocional, etc
        environmentalNotes: "",     // Ruído, iluminação, etc
        patientBehavior: "",        // Cooperação, motivação, etc
        additionalNotes: ""
      },

      // Hipótese diagnóstica
      diagnosis: {
        hypothesis: "",             // Descrição da hipótese diagnóstica
        confidence: null,           // 0-100%
        differentialDiagnosis: []   // Diagnósticos alternativos
      },

      // Recomendações
      recommendations: {
        followUp: "",               // Quando reavaliar
        interventions: [],          // Fonoaudiologia, terapia, etc
        additionalTests: [],        // Exames complementares
        precautions: ""             // Cuidados especiais
      },

      // Status
      completed: false,
      validatedByCRS: false
    };

    this.assessments.push(assessment);
    return assessment;
  }

  /**
   * Preenche escalas numéricas
   */
  fillScales(assessmentId, scoresObject) {
    const assessment = this.assessments.find(a => a.id === assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    // Validar e preencher cada escala
    Object.keys(scoresObject).forEach(key => {
      if (this.scales[key]) {
        const value = Number(scoresObject[key]);
        const range = this.scales[key];

        if (value >= range.min && value <= range.max) {
          assessment.clinicalScores[key] = value;
        } else {
          console.warn(`Valor fora do intervalo para ${key}: ${value}`);
        }
      }
    });

    return assessment;
  }

  /**
   * Preenche achados qualitativos
   */
  fillQualitativeFindings(assessmentId, findingsObject) {
    const assessment = this.assessments.find(a => a.id === assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    assessment.qualitativeFindings = {
      ...assessment.qualitativeFindings,
      ...findingsObject
    };

    return assessment;
  }

  /**
   * Preenche observações clínicas
   */
  fillClinicalObservations(assessmentId, observationsObject) {
    const assessment = this.assessments.find(a => a.id === assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    assessment.clinicalObservations = {
      ...assessment.clinicalObservations,
      ...observationsObject
    };

    return assessment;
  }

  /**
   * Preenche diagnóstico e hipótese
   */
  fillDiagnosis(assessmentId, diagnosisObject) {
    const assessment = this.assessments.find(a => a.id === assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    assessment.diagnosis = {
      ...assessment.diagnosis,
      ...diagnosisObject
    };

    return assessment;
  }

  /**
   * Preenche recomendações
   */
  fillRecommendations(assessmentId, recommendationsObject) {
    const assessment = this.assessments.find(a => a.id === assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    assessment.recommendations = {
      ...assessment.recommendations,
      ...recommendationsObject
    };

    return assessment;
  }

  /**
   * Marca avaliação como completa
   */
  completeAssessment(assessmentId) {
    const assessment = this.assessments.find(a => a.id === assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    // Validar preenchimento obrigatório
    if (!assessment.diagnosis.hypothesis || assessment.diagnosis.hypothesis.trim() === "") {
      return { error: "Hipótese diagnóstica é obrigatória" };
    }

    assessment.completed = true;
    assessment.completedAt = Date.now();

    return { success: true, assessment };
  }

  /**
   * Retorna avaliação por ID
   */
  getAssessment(assessmentId) {
    return this.assessments.find(a => a.id === assessmentId) || null;
  }

  /**
   * Retorna avaliação por sessionId
   */
  getAssessmentBySession(sessionId) {
    return this.assessments.find(a => a.sessionId === sessionId) || null;
  }

  /**
   * Exporta avaliação em formato JSON
   */
  exportAssessment(assessmentId) {
    const assessment = this.getAssessment(assessmentId);
    if (!assessment) return null;

    return {
      version: "1.0",
      timestamp: assessment.timestamp,
      doctor: assessment.doctorName,
      sessionId: assessment.sessionId,
      clinicalScores: assessment.clinicalScores,
      qualitativeFindings: assessment.qualitativeFindings,
      clinicalObservations: assessment.clinicalObservations,
      diagnosis: assessment.diagnosis,
      recommendations: assessment.recommendations,
      completed: assessment.completed
    };
  }

  /**
   * Gera relatório clínico estruturado
   */
  generateClinicalReport(assessmentId) {
    const assessment = this.getAssessment(assessmentId);
    if (!assessment) return { error: "Avaliação não encontrada" };

    const report = {
      header: {
        title: "AVALIAÇÃO CLÍNICA NEUROLÓGICA",
        date: new Date(assessment.timestamp).toLocaleString("pt-BR"),
        doctor: assessment.doctorName,
        sessionId: assessment.sessionId
      },

      clinicalScores: {
        severity: {
          value: assessment.clinicalScores.severity,
          label: this.scales.severity.labels[assessment.clinicalScores.severity] || "Não preenchido",
          scale: `0-${this.scales.severity.max}`
        },
        intelligibility: {
          value: assessment.clinicalScores.intelligibility,
          label: this.scales.intelligibility.labels[assessment.clinicalScores.intelligibility] || "Não preenchido",
          unit: "%"
        },
        effort: {
          value: assessment.clinicalScores.effort,
          label: this.scales.effort.labels[assessment.clinicalScores.effort] || "Não preenchido",
          scale: `0-${this.scales.effort.max}`
        },
        fluency: {
          value: assessment.clinicalScores.fluency,
          label: this.scales.fluency.labels[assessment.clinicalScores.fluency] || "Não preenchido",
          scale: `0-${this.scales.fluency.max}`
        },
        pauses: {
          value: assessment.clinicalScores.pauses,
          label: this.scales.pauses.labels[assessment.clinicalScores.pauses] || "Não preenchido",
          scale: `0-${this.scales.pauses.max}`
        }
      },

      qualitativeFindings: assessment.qualitativeFindings,
      clinicalObservations: assessment.clinicalObservations,
      diagnosis: assessment.diagnosis,
      recommendations: assessment.recommendations,

      completionStatus: {
        completed: assessment.completed,
        completedAt: assessment.completed ? new Date(assessment.completedAt).toLocaleString("pt-BR") : "Não concluída"
      }
    };

    return report;
  }

  /**
   * Retorna histórico de avaliações
   */
  getAssessmentHistory(limit = 10) {
    return this.assessments
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(a => ({
        id: a.id,
        sessionId: a.sessionId,
        doctor: a.doctorName,
        timestamp: new Date(a.timestamp).toLocaleString("pt-BR"),
        completed: a.completed,
        severity: a.clinicalScores.severity
      }));
  }
}

// EXPORTAR
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeurologistAssessment;
}