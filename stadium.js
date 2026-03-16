/**
 * StadiumRenderer — draws a 2D overhead view of a stadium with light fixtures
 * arranged around the perimeter, upper deck, and field edges.
 */
class StadiumRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lights = [];
    this.sections = [];
    this.resize();
    this.buildStadium();

    window.addEventListener('resize', () => {
      this.resize();
      this.buildStadium();
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  buildStadium() {
    this.lights = [];
    this.sections = [];

    const cx = this.width / 2;
    const cy = this.height / 2;
    const scaleX = this.width * 0.42;
    const scaleY = this.height * 0.38;

    // Stadium is an elliptical bowl. We place lights in concentric rings.
    const rings = [
      { rx: scaleX, ry: scaleY, count: 80, row: 0, label: 'upper' },
      { rx: scaleX * 0.82, ry: scaleY * 0.82, count: 64, row: 1, label: 'middle' },
      { rx: scaleX * 0.64, ry: scaleY * 0.64, count: 48, row: 2, label: 'lower' },
      { rx: scaleX * 0.46, ry: scaleY * 0.46, count: 32, row: 3, label: 'field' },
    ];

    rings.forEach((ring) => {
      const section = { label: ring.label, indices: [] };
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * ring.rx;
        const y = cy + Math.sin(angle) * ring.ry;
        const idx = this.lights.length;
        this.lights.push({
          x, y, angle,
          row: ring.row,
          index: i,
          total: ring.count,
          r: 0, g: 0, b: 0, a: 0,
          radius: Math.max(3, 6 - ring.row),
          glowRadius: Math.max(8, 18 - ring.row * 3),
        });
        section.indices.push(idx);
      }
      this.sections.push(section);
    });
  }

  setLight(index, r, g, b, a = 1) {
    if (index < 0 || index >= this.lights.length) return;
    const light = this.lights[index];
    light.r = r;
    light.g = g;
    light.b = b;
    light.a = a;
  }

  clearLights() {
    for (const light of this.lights) {
      light.r = 0;
      light.g = 0;
      light.b = 0;
      light.a = 0;
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background
    ctx.fillStyle = '#08080e';
    ctx.fillRect(0, 0, w, h);

    // Draw stadium structure (subtle outlines)
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const scaleX = w * 0.42;
    const scaleY = h * 0.38;

    [1, 0.82, 0.64, 0.46].forEach(s => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, scaleX * s, scaleY * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw field rectangle in center
    const fieldW = w * 0.28;
    const fieldH = h * 0.22;
    ctx.strokeStyle = 'rgba(40, 120, 40, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - fieldW / 2, cy - fieldH / 2, fieldW, fieldH);

    // Center line
    ctx.beginPath();
    ctx.moveTo(cx, cy - fieldH / 2);
    ctx.lineTo(cx, cy + fieldH / 2);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, fieldH * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // Draw lights (glow pass first, then solid)
    for (const light of this.lights) {
      if (light.a < 0.01) continue;
      const glow = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, light.glowRadius * (0.5 + light.a * 0.8)
      );
      glow.addColorStop(0, `rgba(${light.r},${light.g},${light.b},${light.a * 0.5})`);
      glow.addColorStop(1, `rgba(${light.r},${light.g},${light.b},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(
        light.x - light.glowRadius, light.y - light.glowRadius,
        light.glowRadius * 2, light.glowRadius * 2
      );
    }

    for (const light of this.lights) {
      if (light.a < 0.01) continue;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${light.r},${light.g},${light.b},${light.a})`;
      ctx.fill();
    }

    // Dim dots for inactive lights
    for (const light of this.lights) {
      if (light.a >= 0.01) continue;
      ctx.beginPath();
      ctx.arc(light.x, light.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
    }
  }
}
