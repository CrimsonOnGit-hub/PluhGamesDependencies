/* global BABYLON */

export class TextureGenerator {
    constructor(engine) {
        this.engine = engine;
        this.scene = engine ? engine.scene : null;
        this.initTextures();
    }

    createBabylonTextureFromCanvas(canvas) {
        if (!this.scene) return null;
        return new BABYLON.Texture(canvas.toDataURL(), this.scene);
    }

    initTextures() {
        this.miiFace = this.createMiiFaceTexture();
        this.bunnyShirt = this.createBunnyShirtTexture();
        this.concrete = this.createConcreteTexture();
        this.mahogany = this.createMahoganyTexture();
        this.paddedWall = this.createPaddedWallTexture();
    }

    createMiiFaceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f7d5b7';
        ctx.fillRect(0, 0, 512, 512);

        // Eyebrows
        ctx.strokeStyle = '#3a2510';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(185, 195, 30, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(327, 195, 30, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(185, 240, 18, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(327, 240, 18, 26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye glints
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(178, 230, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(320, 230, 7, 0, Math.PI * 2);
        ctx.fill();

        // Blush
        ctx.fillStyle = 'rgba(255, 130, 150, 0.3)';
        ctx.beginPath();
        ctx.ellipse(140, 290, 28, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(372, 290, 28, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(256, 315, 28, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        return this.createBabylonTextureFromCanvas(canvas);
    }

    createBunnyShirtTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ff88aa';
        ctx.fillRect(0, 0, 512, 512);

        // White Bunny Silhouette
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(256, 320, 90, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(200, 160, 25, 90, -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(312, 160, 25, 90, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#ff4477';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(256, 325, 30, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();

        return this.createBabylonTextureFromCanvas(canvas);
    }

    createConcreteTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#3a3a45';
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 2000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#2e2e38' : '#45455a';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }

        return this.createBabylonTextureFromCanvas(canvas);
    }

    createMahoganyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#4a2211';
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = '#331508';
        ctx.lineWidth = 4;
        for (let y = 0; y < 512; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y + (Math.random() * 8 - 4));
            ctx.lineTo(512, y + (Math.random() * 8 - 4));
            ctx.stroke();
        }

        return this.createBabylonTextureFromCanvas(canvas);
    }

    createPaddedWallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#22222a';
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 4;
        for (let i = 0; i < 512; i += 64) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 512);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(512, i);
            ctx.stroke();
        }

        return this.createBabylonTextureFromCanvas(canvas);
    }
}
