/**
 * TEMPORAL EXTRACTOR - CRS Engine
 * 
 * Função: Extrair timestamps brutos de eventos vocais
 * Responsabilidade: Capturar QUANDO as coisas acontecem (não O QUÊ)
 * 
 * TUTORIAL PARA O MÉDICO:
 * Este arquivo é um "detector de ritmo". Ele não interpreta a fala,
 * apenas marca os momentos em que você fala, pausa e retoma.
 * Esses timestamps alimentam o resto do sistema.
 */

class TemporalExtractor {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 16000; // Hz
    this.silenceThreshold = options.silenceThreshold || 0.02; // RMS
    this.minSilenceDuration = options.minSilenceDuration || 100; // ms
    this.minSpeechDuration = options.minSpeechDuration || 50; // ms
    
    // Histórico de eventos
    this.events = [];
    this.currentSessionStart = null;
  }

  /**
   * Inicia uma nova sessão de extração
   */
  startSession() {
    this.currentSessionStart = Date.now();
    this.events = [];
    return {
      sessionId: this._generateId(),
      startTime: this.currentSessionStart,
      status: "recording"
    };
  }

  /**
   * Processa um buffer de áudio e extrai eventos temporais
   * 
   * INPUT: buffer de áudio (PCM)
   * OUTPUT: array de eventos com timestamps
   */
  processAudioBuffer(audioBuffer) {
    if (!this.currentSessionStart) {
      throw new Error("Sessão não iniciada. Chame startSession() primeiro.");
    }

    const events = [];
    const rmsValues = this._calculateRMS(audioBuffer);
    
    let isSpeaking = false;
    let speechStart = null;
    let silenceStart = null;

    // Percorre cada frame de áudio
    for (let i = 0; i < rmsValues.length; i++) {
      const rms = rmsValues[i];
      const timestamp = this.currentSessionStart + (i * 1000 / this.sampleRate);
      const isAboveThreshold = rms > this.silenceThreshold;

      // Transição: silêncio → fala
      if (isAboveThreshold && !isSpeaking) {
        speechStart = timestamp;
        isSpeaking = true;

        // Se havia silêncio, registra o evento de pausa
        if (silenceStart !== null) {
          const pauseDuration = timestamp - silenceStart;
          if (pauseDuration >= this.minSilenceDuration) {
            events.push({
              type: "silence",
              startTime: silenceStart,
              endTime: timestamp,
              duration: pauseDuration,
              rmsMin: Math.min(...rmsValues.slice(
                Math.max(0, i - Math.floor(this.minSilenceDuration * this.sampleRate / 1000)),
                i
              ))
            });
          }
        }
        silenceStart = null;
      }

      // Transição: fala → silêncio
      if (!isAboveThreshold && isSpeaking) {
        silenceStart = timestamp;
        isSpeaking = false;

        // Registra o evento de fala
        if (speechStart !== null) {
          const speechDuration = timestamp - speechStart;
          if (speechDuration >= this.minSpeechDuration) {
            events.push({
              type: "speech",
              startTime: speechStart,
              endTime: timestamp,
              duration: speechDuration,
              rmsMax: Math.max(...rmsValues.slice(
                Math.max(0, i - Math.floor(speechDuration * this.sampleRate / 1000)),
                i
              ))
            });
          }
        }
        speechStart = null;
      }
    }

    // Se terminou enquanto falando, fecha o evento
    if (isSpeaking && speechStart !== null) {
      const finalTime = this.currentSessionStart + (rmsValues.length * 1000 / this.sampleRate);
      events.push({
        type: "speech",
        startTime: speechStart,
        endTime: finalTime,
        duration: finalTime - speechStart,
        rmsMax: Math.max(...rmsValues)
      });
    }

    this.events.push(...events);
    return events;
  }

  /**
   * Extrai vetor temporal puro (latências entre eventos)
   * 
   * OUTPUT: {
   *   timestamps: [t1, t2, t3...],
   *   intervals: [Δt1, Δt2, Δt3...],
   *   pauseIntervals: [pausa1, pausa2...],
   *   speechIntervals: [fala1, fala2...]
   * }
   */
  extractTemporalVector() {
    if (this.events.length === 0) {
      return {
        timestamps: [],
        intervals: [],
        pauseIntervals: [],
        speechIntervals: [],
        totalDuration: 0,
        eventCount: 0
      };
    }

    const timestamps = this.events.map(e => e.startTime);
    const intervals = [];
    const pauseIntervals = [];
    const speechIntervals = [];

    // Calcula intervalos entre eventos consecutivos
    for (let i = 1; i < this.events.length; i++) {
      const interval = this.events[i].startTime - this.events[i - 1].endTime;
      intervals.push(interval);

      if (this.events[i].type === "silence") {
        pauseIntervals.push(this.events[i].duration);
      } else if (this.events[i].type === "speech") {
        speechIntervals.push(this.events[i].duration);
      }
    }

    const totalDuration = this.events.length > 0
      ? this.events[this.events.length - 1].endTime - this.events[0].startTime
      : 0;

    return {
      timestamps,
      intervals,
      pauseIntervals,
      speechIntervals,
      totalDuration,
      eventCount: this.events.length,
      rawEvents: this.events // Para auditoria
    };
  }

  /**
   * Encerra a sessão e retorna relatório temporal
   */
  endSession() {
    const vector = this.extractTemporalVector();
    const sessionDuration = Date.now() - this.currentSessionStart;

    const report = {
      sessionId: this._generateId(),
      startTime: this.currentSessionStart,
      endTime: Date.now(),
      sessionDuration,
      temporalVector: vector,
      summary: {
        totalEvents: vector.eventCount,
        totalSpeechTime: vector.speechIntervals.reduce((a, b) => a + b, 0),
        totalSilenceTime: vector.pauseIntervals.reduce((a, b) => a + b, 0),
        averagePauseDuration: vector.pauseIntervals.length > 0
          ? vector.pauseIntervals.reduce((a, b) => a + b, 0) / vector.pauseIntervals.length
          : 0,
        averageSpeechDuration: vector.speechIntervals.length > 0
          ? vector.speechIntervals.reduce((a, b) => a + b, 0) / vector.speechIntervals.length
          : 0
      }
    };

    this.currentSessionStart = null;
    this.events = [];

    return report;
  }

  /**
   * Calcula RMS (Root Mean Square) de um buffer de áudio
   * RMS = medida de energia/intensidade do áudio
   */
  _calculateRMS(audioBuffer) {
    const frameSize = Math.floor(this.sampleRate / 100); // 10ms frames
    const rmsValues = [];

    for (let i = 0; i < audioBuffer.length; i += frameSize) {
      const frame = audioBuffer.slice(i, i + frameSize);
      let sum = 0;

      for (let j = 0; j < frame.length; j++) {
        const normalized = frame[j] / 32768; // Normaliza para [-1, 1]
        sum += normalized * normalized;
      }

      const rms = Math.sqrt(sum / frame.length);
      rmsValues.push(rms);
    }

    return rmsValues;
  }

  /**
   * Gera ID único para sessão
   */
  _generateId() {
    return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

// ============================================
// EXPORTAR PARA USO EM OUTROS MÓDULOS
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TemporalExtractor;
}