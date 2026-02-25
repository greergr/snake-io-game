class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = canvas.width / 2;
        this.mouseY = canvas.height / 2;
        this.isBoosting = false;

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.isBoosting = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isBoosting = false;
            }
        });

        // Touch support
        window.addEventListener('touchstart', (e) => {
            this.mouseX = e.touches[0].clientX;
            this.mouseY = e.touches[0].clientY;
            this.isBoosting = true; // Automatically boost on double touch or implement custom UI button
        });

        window.addEventListener('touchmove', (e) => {
            this.mouseX = e.touches[0].clientX;
            this.mouseY = e.touches[0].clientY;
        });

        window.addEventListener('touchend', () => {
            this.isBoosting = false;
        });

        // Spacebar to boost
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.isBoosting = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.isBoosting = false;
            }
        });
    }

    getAngle() {
        // Calculate angle from center of screen to mouse pointer
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        return Math.atan2(this.mouseY - cy, this.mouseX - cx);
    }
}
