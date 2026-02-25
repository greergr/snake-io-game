const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize the game state
const game = new Game(io);

io.on('connection', (socket) => {
    console.log(`[+] Player connected: ${socket.id}`);

    socket.on('joinGame', (data) => {
        game.addPlayer(socket.id, data.name, data.color);
        socket.emit('init', { id: socket.id });
        socket.emit('initFood', game.food); // Send all food only once
    });

    socket.on('input', (data) => {
        game.handleInput(socket.id, data);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Player disconnected: ${socket.id}`);
        game.removePlayer(socket.id);
    });
});

// Broadcast game state to all players at 30 fps (approx 33ms)
setInterval(() => {
    game.update();
    const fullState = game.getState();

    // Create a compressed state to send over network
    const netState = {
        players: {},
        eatenFood: fullState.eatenFoodIds,
        newFood: fullState.newFoodBoxes.map(f => ({
            id: f.id,
            x: Math.round(f.x),
            y: Math.round(f.y),
            value: f.value
        }))
    };

    // Only send essential fields to save bandwidth
    for (const id in fullState.players) {
        const p = fullState.players[id];
        netState.players[id] = {
            id: p.id,
            name: p.name,
            color: p.color,
            x: Math.round(p.x * 10) / 10,
            y: Math.round(p.y * 10) / 10,
            angle: Math.round(p.angle * 10) / 10,
            score: Math.round(p.score),
            radius: Math.round(p.radius * 10) / 10,
            isBoosting: p.isBoosting,
            isLeader: p.isLeader,
            segments: p.segments.map(seg => ({
                x: Math.round(seg.x),
                y: Math.round(seg.y)
            }))
        };
    }

    io.volatile.emit('gameState', netState);
}, 1000 / 30);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
