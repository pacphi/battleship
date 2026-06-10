// Landing page is a pure lobby: it only collects the game mode and the
// host/guest intent, then hands off to the game page via the URL. The WebRTC
// connection is established ON the game page so it survives — establishing it
// here and then navigating would tear down the RTCPeerConnection and close the
// signaling socket (deleting the room) on page load.

let selectedMode = 'round';

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

// Create game → enter the game page as host (player 1). The share code is
// generated and shown there, on the waiting screen.
document.getElementById('create-btn').addEventListener('click', () => {
  window.location.href = `/game.html?player=1&mode=${selectedMode}`;
});

// Join game → enter the game page as guest (player 2) with the entered code.
document.getElementById('join-btn').addEventListener('click', () => {
  const code = document.getElementById('join-code').value.trim().toLowerCase();
  if (!code || code.length !== 6) {
    alert('Enter a 6-character game code.');
    return;
  }
  window.location.href = `/game.html?player=2&mode=${selectedMode}&code=${encodeURIComponent(code)}`;
});
