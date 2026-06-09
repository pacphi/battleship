import { WebRTCManager } from '/scripts/webrtc.js';

let selectedMode = 'round';
let webrtc = null;

// Mode selection
document.querySelectorAll('.mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMode = card.dataset.mode;
  });
});

// Auto-select first mode
document.querySelector('.mode-card').classList.add('selected');

// Create game
document.getElementById('create-btn').addEventListener('click', async () => {
  document.getElementById('loading').style.display = 'flex';
  webrtc = new WebRTCManager();

  webrtc.onStateChange = (state, data) => {
    if (state === 'waiting') {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('game-code-display').style.display = 'block';
      document.getElementById('active-code').textContent = data;
    } else if (state === 'connected') {
      // Navigate to game page
      window.location.href = `/game.html?player=1&mode=${selectedMode}&code=${data}`;
    }
  };

  webrtc.onMessage = (msg) => {
    if (msg.type === 'game-joined') {
      // Guest joined, navigate to game
      window.location.href = `/game.html?player=1&mode=${selectedMode}&code=${msg.code}`;
    }
  };

  await webrtc.createGame();
});

// Join game
document.getElementById('join-btn').addEventListener('click', async () => {
  const code = document.getElementById('join-code').value.trim().toLowerCase();
  if (!code || code.length !== 6) {
    alert('Enter a 6-character game code.');
    return;
  }

  document.getElementById('loading').style.display = 'flex';
  webrtc = new WebRTCManager();

  webrtc.onStateChange = (state, data) => {
    if (state === 'connected') {
      document.getElementById('loading').style.display = 'none';
      window.location.href = `/game.html?player=2&mode=${selectedMode}&code=${data}`;
    }
  };

  webrtc.onMessage = (msg) => {
    if (msg.type === 'join-failed') {
      document.getElementById('loading').style.display = 'none';
      alert(msg.reason === 'invalid-code' ? 'Invalid game code.' : 'Game is full.');
    }
  };

  await webrtc.joinGame(code);
});
