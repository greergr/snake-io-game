const socket = io();
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const input = new Input(canvas);

// UI Elements
const loginScreen = document.getElementById('login-screen');
const deathScreen = document.getElementById('death-screen');
const hud = document.getElementById('hud');
const playBtn = document.getElementById('play-btn');
const respawnBtn = document.getElementById('respawn-btn');
const nicknameInput = document.getElementById('nickname');
const colorBtns = document.querySelectorAll('.color-btn');
const scoreDisplay = document.getElementById('my-score');
const leaderboardList = document.getElementById('leaderboard-list');
const boostFill = document.getElementById('boost-fill');
const finalScoreDisp = document.getElementById('final-score');
const killFeed = document.getElementById('kill-feed');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

let myId = null;
let gameState = { players: {}, food: [] };
let isPlaying = false;
let selectedColor = '#39ff14'; // Default neon green
let previousScore = 10;

// Color Selection
colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedColor = btn.getAttribute('data-color');
    });
});
colorBtns[0].classList.add('selected');

// Enter Game
function joinGame() {
    const name = nicknameInput.value.trim() || 'Guest';
    socket.emit('joinGame', { name, color: selectedColor });
    loginScreen.style.display = 'none';
    deathScreen.style.display = 'none';
    hud.style.display = 'block';
    isPlaying = true;
    previousScore = 10;
    audio.init(); // Initialize audio context on play
}

playBtn.addEventListener('click', joinGame);
respawnBtn.addEventListener('click', joinGame);
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});

// Network events
socket.on('init', (data) => {
    myId = data.id;
});

socket.on('gameState', (state) => {
    // Check if I died
    if (isPlaying && myId && !state.players[myId]) {
        if (window.audio) window.audio.playDeath();
        handleDeath();
    }

    // Play eat sound based on previous score diff
    if (isPlaying && myId && state.players[myId]) {
        const currentScore = Math.floor(state.players[myId].score);
        const previousScore = gameState.players[myId] ? Math.floor(gameState.players[myId].score) : 10;
        if (currentScore > previousScore) {
            if (window.audio) window.audio.playEat();
        }
    }

    gameState = state;
    updateUI();
});

socket.on('killEvent', (data) => {
    if (window.audio) window.audio.playKill();

    // Add to kill feed
    if (killFeed) {
        const msg = document.createElement('div');
        msg.className = 'kill-msg';
        msg.innerHTML = `<span style="color: ${data.killerColor}">${data.killer}</span> eliminated <span style="color: ${data.victimColor}">${data.victim}</span>`;
        killFeed.prepend(msg);

        // Remove after 3 seconds
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 500); // Wait for fade
        }, 3000);
    }
});

function handleDeath() {
    isPlaying = false;
    // audio.playDeath(); // Moved to gameState handler
    hud.style.display = 'none';
    deathScreen.style.display = 'flex';
    // Score is cached from last UI update
}

function updateUI() {
    if (!isPlaying || !myId || !gameState.players[myId]) return;

    const me = gameState.players[myId];

    // Update Score
    const score = Math.floor(me.score);
    scoreDisplay.innerText = score;
    finalScoreDisp.innerText = score;

    // Update Boost Meter (Can only boost if score > 10)
    const canBoost = score > 10;
    boostFill.style.width = canBoost ? '100%' : '0%';
    boostFill.style.background = canBoost ? 'var(--neon-orange)' : 'gray';

    // Update Leaderboard
    const sortedPlayers = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5

    leaderboardList.innerHTML = sortedPlayers.map((p, index) => {
        const isMe = p.id === myId;
        const icon = p.isLeader ? '👑 ' : '';
        return `<li style="color: ${p.color}; ${isMe ? 'font-weight:bold' : ''}">
            <span>${index + 1}. ${icon}${p.name.substring(0, 10)}</span>
            <span>${Math.floor(p.score)}</span>
        </li>`;
    }).join('');

    drawMinimap();
}

function drawMinimap() {
    if (!minimapCtx || !minimapCanvas) return;

    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const scale = minimapCanvas.width / 3000; // 3000 is gridSize

    // Draw all players
    for (const id in gameState.players) {
        const p = gameState.players[id];
        minimapCtx.beginPath();
        minimapCtx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2);

        if (id === myId) {
            minimapCtx.fillStyle = '#fff'; // Me (white)
        } else if (p.isLeader) {
            minimapCtx.fillStyle = '#ffd700'; // Leader (gold)
        } else {
            minimapCtx.fillStyle = '#ff0055'; // Enemy (red)
        }

        minimapCtx.fill();
    }
}

// Main Game Loop running on RAF (60+ fps)
function gameLoop() {
    if (isPlaying) {
        // Send inputs
        socket.emit('input', {
            angle: input.getAngle(),
            isBoosting: input.isBoosting
        });
    }

    // Render using latest state
    renderer.render(gameState, myId);

    requestAnimationFrame(gameLoop);
}

gameLoop();
