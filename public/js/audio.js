class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;

        // Wait for first user interaction to enable audio context (browser requirement)
        window.addEventListener('click', () => this.init(), { once: true });
        window.addEventListener('keydown', () => this.init(), { once: true });
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
        }
    }

    playOscillator(freq, type, duration, vol) {
        if (!this.enabled || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEat() {
        // High pitched pop
        this.playOscillator(800, 'sine', 0.1, 0.1);
        setTimeout(() => this.playOscillator(1200, 'sine', 0.1, 0.1), 50);
    }

    playDeath() {
        // Descending saw
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playKill() {
        // Triumphant chord
        this.playOscillator(440, 'square', 0.2, 0.05);
        this.playOscillator(554.37, 'square', 0.2, 0.05); // C#
        this.playOscillator(659.25, 'square', 0.2, 0.05); // E
    }
}

const audio = new AudioEngine();
