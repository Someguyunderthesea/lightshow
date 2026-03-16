/**
 * AudioEngine — handles audio loading, playback, and real-time frequency analysis
 * using the Web Audio API.
 */
class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.audioBuffer = null;
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;

    // Analysis data
    this.frequencyData = null;
    this.timeDomainData = null;

    // Beat detection state
    this.energyHistory = [];
    this.beatThreshold = 1.4;
    this.beatCooldown = 0;
    this.isBeat = false;
    this.lastBeatTime = 0;
    this.bpm = 0;
    this.beatTimes = [];
  }

  init() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.audioCtx.destination);

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);
  }

  async loadFile(file) {
    if (!this.audioCtx) this.init();
    this.stop();

    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    this.pauseOffset = 0;
  }

  play() {
    if (!this.audioBuffer || this.isPlaying) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.source = this.audioCtx.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.analyser);
    this.source.start(0, this.pauseOffset);
    this.startTime = this.audioCtx.currentTime - this.pauseOffset;
    this.isPlaying = true;

    this.source.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pauseOffset = 0;
      }
    };
  }

  stop() {
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch (e) { /* ignore */ }
      this.source.disconnect();
      this.source = null;
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
  }

  update() {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    this.detectBeat();
  }

  // Split frequency spectrum into bands
  getBands() {
    if (!this.frequencyData) return { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 };

    const binCount = this.frequencyData.length;
    const nyquist = this.audioCtx ? this.audioCtx.sampleRate / 2 : 22050;

    const getBandAvg = (lowHz, highHz) => {
      const lowBin = Math.floor((lowHz / nyquist) * binCount);
      const highBin = Math.min(Math.floor((highHz / nyquist) * binCount), binCount - 1);
      let sum = 0;
      let count = 0;
      for (let i = lowBin; i <= highBin; i++) {
        sum += this.frequencyData[i];
        count++;
      }
      return count > 0 ? (sum / count) / 255 : 0;
    };

    return {
      sub: getBandAvg(20, 60),
      bass: getBandAvg(60, 250),
      lowMid: getBandAvg(250, 500),
      mid: getBandAvg(500, 2000),
      highMid: getBandAvg(2000, 6000),
      high: getBandAvg(6000, 20000),
    };
  }

  getOverallEnergy() {
    if (!this.frequencyData) return 0;
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return (sum / this.frequencyData.length) / 255;
  }

  detectBeat() {
    const energy = this.getOverallEnergy();
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 60) {
      this.energyHistory.shift();
    }

    const avg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const now = performance.now();

    this.isBeat = false;
    if (this.beatCooldown > 0) {
      this.beatCooldown--;
    } else if (energy > avg * this.beatThreshold && energy > 0.15) {
      this.isBeat = true;
      this.beatCooldown = 8; // ~133ms at 60fps
      this.beatTimes.push(now);

      // Keep last 12 beats for BPM calculation
      if (this.beatTimes.length > 12) this.beatTimes.shift();
      if (this.beatTimes.length >= 4) {
        const intervals = [];
        for (let i = 1; i < this.beatTimes.length; i++) {
          intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        this.bpm = Math.round(60000 / avgInterval);
      }
      this.lastBeatTime = now;
    }
  }

  getElapsedTime() {
    if (!this.isPlaying || !this.audioCtx) return this.pauseOffset;
    return this.audioCtx.currentTime - this.startTime;
  }

  getDuration() {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }
}
