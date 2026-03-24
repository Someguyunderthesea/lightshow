/**
 * SpotifyClient — handles Spotify Web API auth (PKCE flow) and track search.
 * No backend required. User must provide their own Client ID from
 * https://developer.spotify.com/dashboard
 */
class SpotifyClient {
  constructor() {
    this.clientId = localStorage.getItem('spotify_client_id') || '';
    this.accessToken = localStorage.getItem('spotify_access_token') || '';
    this.tokenExpiry = parseInt(localStorage.getItem('spotify_token_expiry') || '0', 10);
    this.redirectUri = window.location.origin + window.location.pathname;
  }

  get isConfigured() {
    return this.clientId.length > 0;
  }

  get isAuthenticated() {
    return this.accessToken.length > 0 && Date.now() < this.tokenExpiry;
  }

  setClientId(id) {
    this.clientId = id.trim();
    localStorage.setItem('spotify_client_id', this.clientId);
  }

  // --- PKCE Auth Flow ---

  async authorize() {
    if (!this.clientId) throw new Error('Client ID not set');

    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: 'user-read-private streaming',
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('Spotify auth error:', error);
      return false;
    }
    if (!code) return false;

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      console.error('Missing code verifier');
      return false;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!resp.ok) {
      console.error('Token exchange failed:', resp.status);
      return false;
    }

    const data = await resp.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    localStorage.setItem('spotify_access_token', this.accessToken);
    localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
    localStorage.removeItem('spotify_code_verifier');

    return true;
  }

  logout() {
    this.accessToken = '';
    this.tokenExpiry = 0;
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
  }

  // --- API Calls ---

  async search(query, limit = 12) {
    if (!this.isAuthenticated) throw new Error('Not authenticated');

    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
    });

    const resp = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (resp.status === 401) {
      this.logout();
      throw new Error('Token expired — please log in again');
    }
    if (resp.status === 403) {
      throw new Error('Spotify denied the request — your app may be in development mode or rate-limited');
    }
    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);

    const data = await resp.json();
    return data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[2]?.url || track.album.images[0]?.url || '',
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      uri: track.uri,
    }));
  }

  async getTrack(trackId) {
    if (!this.isAuthenticated) throw new Error('Not authenticated');

    const resp = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!resp.ok) throw new Error(`Failed to get track: ${resp.status}`);

    const track = await resp.json();
    return {
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[1]?.url || track.album.images[0]?.url || '',
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      uri: track.uri,
    };
  }

  // --- Helpers ---

  generateRandomString(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(36).padStart(2, '0')).join('').slice(0, length);
  }

  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
