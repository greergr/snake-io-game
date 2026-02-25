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
    const state = game.getState();
    io.volatile.emit('gameState', state);
}, 1000 / 30);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
