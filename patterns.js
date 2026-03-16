/**
 * LightPatterns — maps audio analysis data to stadium light colors/intensities.
 * Each pattern function receives (stadium, bands, audio, time, sensitivity).
 */
const LightPatterns = {

  /**
   * Frequency Reactive: each section of the stadium responds to a frequency band.
   * Upper ring = bass, middle = mids, lower = highs, field = sub-bass.
   */
  reactive(stadium, bands, audio, time, sensitivity) {
    const beat = audio.isBeat;
    const bandMap = [
      { band: 'bass', hue: 0 },       // upper  -> red/orange
      { band: 'mid', hue: 120 },       // middle -> green/cyan
      { band: 'highMid', hue: 220 },   // lower  -> blue/purple
      { band: 'sub', hue: 40 },        // field  -> warm yellow
    ];

    stadium.sections.forEach((section, si) => {
      const { band, hue } = bandMap[si] || bandMap[0];
      const level = Math.min(1, (bands[band] || 0) * sensitivity);

      section.indices.forEach((idx) => {
        const light = stadium.lights[idx];
        const pos = light.index / light.total;

        // Slight position-based variation
        const wave = Math.sin(pos * Math.PI * 4 + time * 2) * 0.15;
        const intensity = Math.max(0, Math.min(1, level + wave));

        // Shift hue slightly on beats
        const h = beat ? (hue + 30) % 360 : hue;
        const s = 80 + intensity * 20;
        const l = intensity * 60;

        const [r, g, b] = hslToRgb(h / 360, s / 100, l / 100);
        stadium.setLight(idx, r, g, b, intensity);
      });
    });
  },

  /**
   * Wave: a color wave sweeps around the stadium, speed and color driven by audio.
   */
  wave(stadium, bands, audio, time, sensitivity) {
    const energy = audio.getOverallEnergy() * sensitivity;
    const speed = 1 + bands.bass * 3;

    stadium.lights.forEach((light, idx) => {
      const pos = light.index / light.total;
      const wave = Math.sin(pos * Math.PI * 2 - time * speed + light.row * 0.5);
      const intensity = Math.max(0, wave) * Math.min(1, energy * 1.5);

      const hue = (pos * 360 + time * 60 + light.row * 40) % 360;
      const [r, g, b] = hslToRgb(hue / 360, 0.85, intensity * 0.55);
      stadium.setLight(idx, r, g, b, intensity);
    });
  },

  /**
   * Beat Pulse: all lights pulse outward from center on each beat.
   */
  pulse(stadium, bands, audio, time, sensitivity) {
    const timeSinceBeat = (performance.now() - audio.lastBeatTime) / 1000;
    const pulse = Math.max(0, 1 - timeSinceBeat * 4); // fast decay
    const energy = audio.getOverallEnergy() * sensitivity;

    stadium.sections.forEach((section, si) => {
      const ringDelay = si * 0.07;
      const ringPulse = Math.max(0, 1 - (timeSinceBeat - ringDelay) * 3.5);
      const intensity = ringPulse * Math.min(1, energy * 2);

      const hue = (time * 30 + si * 60) % 360;
      const [r, g, b] = hslToRgb(hue / 360, 0.9, intensity * 0.6);

      section.indices.forEach((idx) => {
        stadium.setLight(idx, r, g, b, intensity);
      });
    });
  },

  /**
   * Rainbow Sweep: smooth rainbow that rotates, with brightness modulated by audio.
   */
  rainbow(stadium, bands, audio, time, sensitivity) {
    const energy = audio.getOverallEnergy() * sensitivity;
    const bassBoost = bands.bass * sensitivity;

    stadium.lights.forEach((light, idx) => {
      const pos = light.index / light.total;
      const hue = (pos * 360 + time * 80 + light.row * 30) % 360;
      const intensity = (0.3 + energy * 0.7) * (0.7 + bassBoost * 0.5);
      const clampedI = Math.min(1, intensity);

      const [r, g, b] = hslToRgb(hue / 360, 0.95, clampedI * 0.5);
      stadium.setLight(idx, r, g, b, clampedI);
    });
  },

  /**
   * Strobe: sharp on/off flashes synced to beats, with color variety.
   */
  strobe(stadium, bands, audio, time, sensitivity) {
    const timeSinceBeat = (performance.now() - audio.lastBeatTime) / 1000;
    const on = timeSinceBeat < 0.06;
    const energy = audio.getOverallEnergy() * sensitivity;

    if (on && energy > 0.2) {
      const hue = (time * 200) % 360;
      const [r, g, b] = hslToRgb(hue / 360, 0.7, 0.9);
      stadium.lights.forEach((_, idx) => {
        stadium.setLight(idx, r, g, b, 1);
      });
    } else {
      // Dim ambient glow
      stadium.lights.forEach((light, idx) => {
        const ambient = energy * 0.15;
        stadium.setLight(idx, 30, 20, 40, ambient);
      });
    }
  },
};

// Helper: HSL to RGB (all inputs 0-1, outputs 0-255)
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
