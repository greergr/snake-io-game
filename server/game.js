class Game {
    constructor(io) {
        this.io = io; // Added to emit global events directly if needed
        this.players = {};
        this.food = [];
        this.gridSize = { width: 3000, height: 3000 };
        this.generateInitialFood(500);
    }

    generateInitialFood(count) {
        for (let i = 0; i < count; i++) {
            this.addFood();
        }
    }

    addFood() {
        this.food.push({
            id: Math.random().toString(36).substring(2, 9),
            x: Math.floor(Math.random() * this.gridSize.width),
            y: Math.floor(Math.random() * this.gridSize.height),
            value: Math.floor(Math.random() * 5) + 1 // Random color/value
        });
    }

    addPlayer(id, name, color) {
        this.players[id] = {
            id,
            name: name || 'Snake',
            color: color || '#ff0000',
            x: Math.random() * this.gridSize.width,
            y: Math.random() * this.gridSize.height,
            angle: 0,
            segments: [], // Array of {x, y}
            score: 10,
            baseSpeed: 5,
            boostSpeed: 10,
            isBoosting: false,
            radius: 10
        };

        // Initialize segments
        for (let i = 0; i < 10; i++) {
            this.players[id].segments.push({
                x: this.players[id].x,
                y: this.players[id].y
            });
        }
    }

    removePlayer(id) {
        // Drop food upon death
        if (this.players[id]) {
            const player = this.players[id];
            player.segments.forEach(seg => {
                if (Math.random() > 0.5) {
                    this.food.push({
                        id: Math.random().toString(36).substring(2, 9),
                        x: seg.x,
                        y: seg.y,
                        value: 2
                    });
                }
            });
            delete this.players[id];

            // Limit total food to prevent lag
            while (this.food.length > 1000) {
                this.food.shift();
            }
        }
    }

    handleInput(id, data) {
        if (this.players[id]) {
            this.players[id].angle = data.angle;
            this.players[id].isBoosting = data.isBoosting && this.players[id].score > 10;
        }
    }

    update() {
        // Update all players
        for (const id in this.players) {
            const p = this.players[id];

            p.radius = 10 + Math.sqrt(p.score) * 0.5;

            // Movement logic
            const speed = p.isBoosting ? p.boostSpeed : p.baseSpeed;
            if (p.isBoosting) {
                p.score = Math.max(10, p.score - 0.2); // Lose mass when boosting

                // Drop food behind occasionally
                if (Math.random() < 0.2) {
                    const tail = p.segments[p.segments.length - 1];
                    this.food.push({
                        id: Math.random().toString(36).substring(2, 9),
                        x: tail.x,
                        y: tail.y,
                        value: 1
                    });
                }
            }

            const dx = Math.cos(p.angle) * speed;
            const dy = Math.sin(p.angle) * speed;

            p.x += dx;
            p.y += dy;

            // Boundaries
            p.x = Math.max(p.radius, Math.min(this.gridSize.width - p.radius, p.x));
            p.y = Math.max(p.radius, Math.min(this.gridSize.height - p.radius, p.y));

            // Update segments (tail follows head)
            p.segments.unshift({ x: p.x, y: p.y });

            // The length of the snake based on score
            const desiredLength = Math.floor(this.players[id].score);
            while (p.segments.length > desiredLength) {
                p.segments.pop();
            }

            // Food collision
            for (let i = this.food.length - 1; i >= 0; i--) {
                const f = this.food[i];
                const dist = Math.hypot(p.x - f.x, p.y - f.y);
                if (dist < p.radius + 5) { // Food radius approx 5
                    p.score += f.value;
                    this.food.splice(i, 1);
                    this.addFood(); // respawn food
                }
            }

            // Player-Player collision
            for (const otherId in this.players) {
                if (id !== otherId) {
                    const other = this.players[otherId];
                    // Check head vs other body
                }
            }
        }

        // Detailed Player-Player Collision Loop
        const deadPlayers = [];
        const playerKeys = Object.keys(this.players);

        for (let i = 0; i < playerKeys.length; i++) {
            const id1 = playerKeys[i];
            const p1 = this.players[id1];

            for (let j = 0; j < playerKeys.length; j++) {
                if (i === j) continue;

                const id2 = playerKeys[j];
                const p2 = this.players[id2];

                // Broad phase check (AABB roughly)
                if (Math.abs(p1.x - p2.x) > p1.radius + p2.radius + p2.score + 50) continue;
                if (Math.abs(p1.y - p2.y) > p1.radius + p2.radius + p2.score + 50) continue;

                // Check p1 head against p2 segments
                for (let k = 0; k < p2.segments.length; k++) {
                    // Skip the first few segments to avoid immediate head-to-head issues
                    if (k < 5 && Math.hypot(p1.x - p2.x, p1.y - p2.y) < (p1.radius + p2.radius)) {
                        // Head to head collision: smaller snake dies
                        if (p1.score < p2.score) {
                            deadPlayers.push({ victimId: id1, killerId: id2 });
                            break;
                        }
                    } else {
                        const seg = p2.segments[k];
                        const dist = Math.hypot(p1.x - seg.x, p1.y - seg.y);
                        // Relax collision slightly for feel
                        if (dist < p1.radius + p2.radius * 0.5) {
                            deadPlayers.push({ victimId: id1, killerId: id2 });
                            break;
                        }
                    }
                }
            } // end loop j
        } // end loop i

        // Process deaths
        deadPlayers.forEach(killInfo => {
            const victim = this.players[killInfo.victimId];
            const killer = this.players[killInfo.killerId];
            if (victim && killer) {
                // Emit event for kill feed
                this.io && this.io.emit('killEvent', {
                    killer: killer.name,
                    killerColor: killer.color,
                    victim: victim.name,
                    victimColor: victim.color
                });
            }
            this.removePlayer(killInfo.victimId);
        });

        // Determine Leader
        let topScore = -1;
        let leaderId = null;
        for (const id in this.players) {
            this.players[id].isLeader = false; // Reset
            if (this.players[id].score > topScore) {
                topScore = this.players[id].score;
                leaderId = id;
            }
        }
        if (leaderId) {
            this.players[leaderId].isLeader = true;
        }
    }

    getState() {
        // In a real optimized game, we only send visible entities to each client
        // For simplicity, we send all players and food here.
        return {
            players: this.players,
            food: this.food
        };
    }
}

module.exports = Game;
