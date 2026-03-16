/**
 * Main — wires up the UI, audio engine, stadium renderer, and animation loop.
 */
(function () {
  const canvas = document.getElementById('stadium');
  const fileInput = document.getElementById('audio-file');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const patternSelect = document.getElementById('pattern');
  const sensitivityInput = document.getElementById('sensitivity');
  const nowPlaying = document.getElementById('now-playing');

  const audio = new AudioEngine();
  const stadium = new StadiumRenderer(canvas);

  let currentPattern = 'reactive';
  let animationId = null;
  let time = 0;

  // File loading
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    nowPlaying.textContent = `Loading: ${file.name}...`;
    try {
      await audio.loadFile(file);
      nowPlaying.textContent = `Loaded: ${file.name}`;
      playBtn.disabled = false;
      stopBtn.disabled = false;
    } catch (err) {
      nowPlaying.textContent = `Error loading file: ${err.message}`;
      console.error(err);
    }
  });

  // Playback controls
  playBtn.addEventListener('click', () => {
    if (!audio.isPlaying) {
      audio.play();
      playBtn.textContent = 'Pause';
      if (!animationId) startLoop();
    } else {
      audio.stop();
      playBtn.textContent = 'Play';
    }
  });

  stopBtn.addEventListener('click', () => {
    audio.stop();
    playBtn.textContent = 'Play';
    stadium.clearLights();
    stadium.draw();
  });

  patternSelect.addEventListener('change', (e) => {
    currentPattern = e.target.value;
  });

  // Animation loop
  function startLoop() {
    function frame() {
      time += 1 / 60;
      audio.update();

      const bands = audio.getBands();
      const sensitivity = parseFloat(sensitivityInput.value);

      stadium.clearLights();

      const patternFn = LightPatterns[currentPattern];
      if (patternFn) {
        patternFn(stadium, bands, audio, time, sensitivity);
      }

      stadium.draw();

      // Update now-playing with time info
      if (audio.isPlaying) {
        const elapsed = formatTime(audio.getElapsedTime());
        const duration = formatTime(audio.getDuration());
        const bpmText = audio.bpm > 0 ? ` | ~${audio.bpm} BPM` : '';
        nowPlaying.textContent = `${elapsed} / ${duration}${bpmText}`;
      }

      animationId = requestAnimationFrame(frame);
    }
    animationId = requestAnimationFrame(frame);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Initial draw so the stadium is visible immediately
  stadium.draw();
})();
