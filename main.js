/**
 * Main — wires up the UI, audio engine, stadium renderer, Spotify panel,
 * and animation loop.
 */
(function () {
  const canvas = document.getElementById('stadium');
  const fileInput = document.getElementById('audio-file');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const patternSelect = document.getElementById('pattern');
  const sensitivityInput = document.getElementById('sensitivity');
  const nowPlaying = document.getElementById('now-playing');

  // Spotify elements
  const spotifyBtn = document.getElementById('spotify-btn');
  const spotifyPanel = document.getElementById('spotify-panel');
  const spotifyClose = document.getElementById('spotify-close');
  const spotifySetup = document.getElementById('spotify-setup');
  const spotifySearch = document.getElementById('spotify-search');
  const spotifyClientIdInput = document.getElementById('spotify-client-id');
  const spotifyAuthBtn = document.getElementById('spotify-auth-btn');
  const spotifyQuery = document.getElementById('spotify-query');
  const spotifySearchBtn = document.getElementById('spotify-search-btn');
  const spotifyResults = document.getElementById('spotify-results');
  const spotifyLogoutBtn = document.getElementById('spotify-logout-btn');
  const redirectUriDisplay = document.getElementById('redirect-uri-display');

  const audio = new AudioEngine();
  const stadium = new StadiumRenderer(canvas);
  const spotify = new SpotifyClient();

  let currentPattern = 'reactive';
  let animationId = null;
  let time = 0;

  // Show the redirect URI the user needs to add in their Spotify app
  redirectUriDisplay.textContent = window.location.origin + window.location.pathname;

  // --- Spotify Setup ---

  // Handle OAuth callback on page load
  (async () => {
    if (spotify.isConfigured) {
      spotifyClientIdInput.value = spotify.clientId;
    }
    const didAuth = await spotify.handleCallback();
    if (didAuth || spotify.isAuthenticated) {
      showSpotifySearch();
    }
  })();

  function showSpotifySearch() {
    spotifySetup.classList.add('hidden');
    spotifySearch.classList.remove('hidden');
  }

  function showSpotifySetup() {
    spotifySetup.classList.remove('hidden');
    spotifySearch.classList.add('hidden');
    spotifyResults.innerHTML = '';
  }

  spotifyBtn.addEventListener('click', () => {
    spotifyPanel.classList.toggle('hidden');
  });

  spotifyClose.addEventListener('click', () => {
    spotifyPanel.classList.add('hidden');
  });

  spotifyAuthBtn.addEventListener('click', async () => {
    const clientId = spotifyClientIdInput.value.trim();
    if (!clientId) return;
    spotify.setClientId(clientId);
    try {
      await spotify.authorize();
    } catch (err) {
      nowPlaying.textContent = `Spotify error: ${err.message}`;
    }
  });

  spotifyLogoutBtn.addEventListener('click', () => {
    spotify.logout();
    showSpotifySetup();
  });

  // Search
  spotifySearchBtn.addEventListener('click', () => doSpotifySearch());
  spotifyQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSpotifySearch();
  });

  async function doSpotifySearch() {
    const query = spotifyQuery.value.trim();
    if (!query) return;

    spotifyResults.innerHTML = '<div class="hint">Searching...</div>';

    try {
      const tracks = await spotify.search(query);
      renderSpotifyResults(tracks);
    } catch (err) {
      spotifyResults.innerHTML = `<div class="hint">Error: ${err.message}</div>`;
      if (err.message.includes('expired') || err.message.includes('Not authenticated')) {
        showSpotifySetup();
      }
    }
  }

  function renderSpotifyResults(tracks) {
    spotifyResults.innerHTML = '';

    if (tracks.length === 0) {
      spotifyResults.innerHTML = '<div class="hint">No results found.</div>';
      return;
    }

    tracks.forEach(track => {
      const el = document.createElement('div');
      el.className = 'track-item' + (track.previewUrl ? '' : ' no-preview');

      const art = track.albumArt
        ? `<img class="track-art" src="${track.albumArt}" alt="">`
        : '<div class="track-art"></div>';

      const badge = track.previewUrl ? '30s' : 'No preview';

      el.innerHTML = `
        ${art}
        <div class="track-info">
          <div class="track-name">${escapeHtml(track.name)}</div>
          <div class="track-artist">${escapeHtml(track.artist)}</div>
        </div>
        <div class="track-badge">${badge}</div>
      `;

      if (track.previewUrl) {
        el.addEventListener('click', () => loadSpotifyTrack(track));
      }

      spotifyResults.appendChild(el);
    });
  }

  async function loadSpotifyTrack(track) {
    nowPlaying.textContent = `Loading: ${track.name} — ${track.artist}...`;
    spotifyPanel.classList.add('hidden');

    try {
      await audio.loadUrl(track.previewUrl);
      nowPlaying.textContent = `${track.name} — ${track.artist} (30s preview)`;
      playBtn.disabled = false;
      stopBtn.disabled = false;

      // Auto-play
      audio.play();
      playBtn.textContent = 'Pause';
      if (!animationId) startLoop();
    } catch (err) {
      nowPlaying.textContent = `Error loading preview: ${err.message}`;
      console.error(err);
    }
  }

  // --- File loading ---
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

  // --- Playback controls ---
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

  // --- Animation loop ---
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Konami Code Easter Egg ---
  const konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiProgress = 0;
  let konamiUnlocked = false;

  document.addEventListener('keydown', (e) => {
    if (e.key === konamiSequence[konamiProgress]) {
      konamiProgress++;
      if (konamiProgress === konamiSequence.length) {
        konamiProgress = 0;
        if (!konamiUnlocked) {
          konamiUnlocked = true;
          const opt = document.createElement('option');
          opt.value = 'fireworks';
          opt.textContent = 'Fireworks';
          patternSelect.appendChild(opt);
          patternSelect.value = 'fireworks';
          currentPattern = 'fireworks';
          nowPlaying.textContent = 'Easter egg unlocked! Fireworks mode activated.';
          if (!animationId) startLoop();
        } else {
          patternSelect.value = 'fireworks';
          currentPattern = 'fireworks';
          nowPlaying.textContent = 'Fireworks mode activated!';
        }
      }
    } else {
      konamiProgress = e.key === konamiSequence[0] ? 1 : 0;
    }
  });

  // Initial draw
  stadium.draw();
})();
