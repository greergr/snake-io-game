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
let targetState = { players: {}, food: [] };
let isPlaying = false;
let selectedColor = '#39ff14'; // Default neon green
let previousScore = 10;
const LERP_FACTOR = 0.3; // Smoothing factor (0.1 - 0.5 is good)

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

socket.on('initFood', (foodArray) => {
    gameState.food = foodArray;
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
        const previousScore = gameState.players && gameState.players[myId] ? Math.floor(gameState.players[myId].score) : 10;
        if (currentScore > previousScore) {
            if (window.audio) window.audio.playEat();
        }
    }

    // Handle Food Sync: Remove Eaten, Add New
    if (state.eatenFood && state.eatenFood.length > 0) {
        state.eatenFood.forEach(id => {
            const ix = gameState.food.findIndex(f => f.id === id);
            if (ix !== -1) gameState.food.splice(ix, 1);
        });
    }
    if (state.newFood && state.newFood.length > 0) {
        gameState.food.push(...state.newFood);
    }

    // Prepare for interpolation
    if (Object.keys(gameState.players).length === 0) {
        gameState.players = JSON.parse(JSON.stringify(state.players)); // Full clone first time
    }
    targetState.players = state.players;

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

// Linear interpolation function
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

// Function to smoothly interpolate game state towards target state
function interpolateState() {
    if (!targetState.players) return;

    for (const id in targetState.players) {
        const targetPlayer = targetState.players[id];

        // If it's a new player, add them directly
        if (!gameState.players[id]) {
            gameState.players[id] = JSON.parse(JSON.stringify(targetPlayer));
            continue;
        }

        const currentPlayer = gameState.players[id];

        // Lerp Head Position
        currentPlayer.x = lerp(currentPlayer.x, targetPlayer.x, LERP_FACTOR);
        currentPlayer.y = lerp(currentPlayer.y, targetPlayer.y, LERP_FACTOR);

        // Interpolate angle (handle wraparound logic)
        let diff = targetPlayer.angle - currentPlayer.angle;
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        currentPlayer.angle += diff * LERP_FACTOR;

        currentPlayer.radius = targetPlayer.radius;
        currentPlayer.score = targetPlayer.score;
        currentPlayer.isBoosting = targetPlayer.isBoosting;
        currentPlayer.isLeader = targetPlayer.isLeader;

        // Update Segments
        // Since segments change count and position abruptly from server, 
        // we snap the segments directly for simplicity, or we can lerp them too.
        // For performance & stability: Snap segments
        if (targetPlayer.segments.length !== currentPlayer.segments.length) {
            currentPlayer.segments = JSON.parse(JSON.stringify(targetPlayer.segments));
        } else {
            for (let i = 0; i < targetPlayer.segments.length; i++) {
                currentPlayer.segments[i].x = lerp(currentPlayer.segments[i].x, targetPlayer.segments[i].x, LERP_FACTOR);
                currentPlayer.segments[i].y = lerp(currentPlayer.segments[i].y, targetPlayer.segments[i].y, LERP_FACTOR);
            }
        }
    }

    // Remove disconnected/dead players from gameState interpolator
    for (const id in gameState.players) {
        if (!targetState.players[id]) {
            delete gameState.players[id];
        }
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

    interpolateState();

    // Render using interpolated state
    renderer.render(gameState, myId);

    requestAnimationFrame(gameLoop);
}

gameLoop();
