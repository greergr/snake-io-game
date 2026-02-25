class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Grid properties
        this.gridSize = 3000;
        this.cellSize = 50;

        // Visual effects layer (offscreen canvas for glow could be used, but standard shadowBlur is easier initially)
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setCamera(x, y, radius) {
        // Smooth camera follow
        const targetZoom = Math.max(0.4, 20 / radius);
        this.camera.zoom += (targetZoom - this.camera.zoom) * 0.1;

        // Screen center
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        const targetX = x * this.camera.zoom - cx;
        const targetY = y * this.camera.zoom - cy;

        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a0f'; // Dark background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // Boundary glow
        this.ctx.strokeStyle = '#ff0055';
        this.ctx.lineWidth = 10;
        this.ctx.strokeRect(0, 0, this.gridSize, this.gridSize);

        // Inner Grid - Hexagon/Tech look
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)'; // Neon cyan grid
        this.ctx.lineWidth = 1.5;

        const startX = Math.max(0, Math.floor(this.camera.x / (this.cellSize * this.camera.zoom)) * this.cellSize);
        const endX = Math.min(this.gridSize, Math.ceil((this.camera.x + this.canvas.width) / (this.cellSize * this.camera.zoom)) * this.cellSize);

        const startY = Math.max(0, Math.floor(this.camera.y / (this.cellSize * this.camera.zoom)) * this.cellSize);
        const endY = Math.min(this.gridSize, Math.ceil((this.camera.y + this.canvas.height) / (this.cellSize * this.camera.zoom)) * this.cellSize);

        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += this.cellSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += this.cellSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawFood(foodArray) {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        const colors = ['#39ff14', '#00ffff', '#ff00ff', '#ff9900', '#ccff00', '#9d00ff'];

        // Optimize: check if food is within screen bounds roughly
        const offset = 50; // cushion
        const scX = this.camera.x / this.camera.zoom;
        const scY = this.camera.y / this.camera.zoom;
        const scW = this.canvas.width / this.camera.zoom;
        const scH = this.canvas.height / this.camera.zoom;

        foodArray.forEach(f => {
            if (f.x > scX - offset && f.x < scX + scW + offset &&
                f.y > scY - offset && f.y < scY + scH + offset) {

                this.ctx.beginPath();
                const size = f.value * 2 + 2;
                this.ctx.arc(f.x, f.y, size, 0, Math.PI * 2);
                this.ctx.fillStyle = colors[f.value % colors.length];
                this.ctx.fill();
            }
        });

        this.ctx.restore();
    }

    drawSnakes(players, myId) {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // Sort so my player is drawn last (on top)
        const playerKeys = Object.keys(players).sort((a, b) => (a === myId) ? 1 : (b === myId) ? -1 : 0);

        playerKeys.forEach(id => {
            const p = players[id];

            // Draw body segments
            for (let i = p.segments.length - 1; i > 0; i--) {
                const seg = p.segments[i];
                const prev = p.segments[i - 1];

                // Draw line between segments (thick lines)
                this.ctx.beginPath();
                this.ctx.moveTo(seg.x, seg.y);
                this.ctx.lineTo(prev.x, prev.y);

                // Radius decreases slightly towards tail
                const t = i / p.segments.length;
                this.ctx.lineWidth = p.radius * 2 * (1 - t * 0.3);
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.strokeStyle = p.color;

                if (p.isBoosting) {
                    this.ctx.lineWidth *= 1.2; // visual boost thickness instead of shadow
                    this.ctx.strokeStyle = '#fff';
                }

                // Adjust opacity or color slightly for segmentation effect
                this.ctx.stroke();
            }

            // Draw Head
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();

            // Draw Eyes
            const eyeDist = p.radius * 0.5;
            const eyeSize = p.radius * 0.3;
            this.ctx.fillStyle = '#fff';

            // Calculate eye offsets based on angle
            const ex1 = p.x + Math.cos(p.angle - 0.5) * eyeDist;
            const ey1 = p.y + Math.sin(p.angle - 0.5) * eyeDist;
            const ex2 = p.x + Math.cos(p.angle + 0.5) * eyeDist;
            const ey2 = p.y + Math.sin(p.angle + 0.5) * eyeDist;

            this.ctx.beginPath();
            this.ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
            this.ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Name Tag
            this.ctx.font = `bold ${Math.max(12, p.radius * 0.8)}px Outfit`;
            this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
            this.ctx.textAlign = 'center';
            // Dark text outline for readability instead of shadow
            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            this.ctx.strokeText(p.name, p.x, p.y - p.radius - 15);
            this.ctx.fillText(p.name, p.x, p.y - p.radius - 15);

            // Crown for Top Player
            if (p.isLeader) {
                this.ctx.save();
                this.ctx.translate(p.x, p.y - p.radius - 35);
                this.ctx.beginPath();
                this.ctx.moveTo(-15, 0);
                this.ctx.lineTo(-20, -20);
                this.ctx.lineTo(-5, -10);
                this.ctx.lineTo(0, -25);
                this.ctx.lineTo(5, -10);
                this.ctx.lineTo(20, -20);
                this.ctx.lineTo(15, 0);
                this.ctx.closePath();
                this.ctx.fillStyle = '#ffd700'; // Gold
                this.ctx.fill();
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = '#000';
                this.ctx.stroke();
                this.ctx.restore();
            }
        });

        this.ctx.restore();
    }

    render(state, myId) {
        this.clear();

        if (state.players[myId]) {
            const me = state.players[myId];
            this.setCamera(me.x, me.y, me.radius);
        }

        this.drawGrid();
        this.drawFood(state.food);
        this.drawSnakes(state.players, myId);
    }
}
