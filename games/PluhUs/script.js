const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load your specific individual images
const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';

const drawSize = 60; // How big they appear on screen

// -----------------------------------------
// CREWMATE CLASS SYSTEM
// -----------------------------------------
class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x;
        this.y = y;
        this.isPlayer = isPlayer;
        this.colorName = colorName;
        this.isDead = false;
        
        // Random speed for bots, zero for player
        this.vx = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        this.vy = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        
        // Animation tracking
        this.isMoving = false;
        this.animTimer = 0;
        this.showWalkFrame = false;
    }

    update() {
        if (this.isDead) return; // Dead bots don't move

        this.isMoving = false;

        if (this.isPlayer) {
            if (keys['KeyW']) { this.y -= 4; this.isMoving = true; }
            if (keys['KeyS']) { this.y += 4; this.isMoving = true; }
            if (keys['KeyA']) { this.x -= 4; this.isMoving = true; }
            if (keys['KeyD']) { this.x += 4; this.isMoving = true; }
        } else {
            // Bot wandering logic
            this.x += this.vx;
            this.y += this.vy;
            this.isMoving = true; 
            
            // Wall bouncing
            if (this.x < 0 || this.x > canvas.width - drawSize) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height - drawSize) this.vy *= -1;
        }

        // Simple animation toggle for walking
        if (this.isMoving) {
            this.animTimer++;
            if (this.animTimer > 10) {
                this.showWalkFrame = !this.showWalkFrame; // Swap between stand and walk
                this.animTimer = 0;
            }
        } else {
            this.showWalkFrame = false;
        }
    }

    draw(ctx) {
        if (this.isDead) {
            // Rotate the standing image 90 degrees to look dead
            ctx.save();
            ctx.translate(this.x + drawSize / 2, this.y + drawSize / 2);
            ctx.rotate(Math.PI / 2); 
            ctx.drawImage(standImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
            ctx.restore();
        } else {
            // Draw either the walk frame or stand frame
            const currentImg = this.showWalkFrame ? walkImg : standImg;
            ctx.drawImage(currentImg, this.x, this.y, drawSize, drawSize);
        }
    }
}

// -----------------------------------------
// GAME INITIALIZATION
// -----------------------------------------
const player = new Crewmate(400, 300, true, 'Red');

const bots = [
    new Crewmate(100, 100, false, 'Blue'),
    new Crewmate(600, 100, false, 'Green'),
    new Crewmate(100, 400, false, 'Yellow'),
    new Crewmate(600, 400, false, 'Pink')
];

// Input tracking
const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    // --- KILL LOGIC (Press E) ---
    if (e.code === 'KeyE') {
        for (let bot of bots) {
            if (!bot.isDead) {
                let dist = Math.hypot(bot.x - player.x, bot.y - player.y);
                if (dist < 80) { // Kill range
                    bot.isDead = true;
                    document.getElementById('ui-layer').innerText = `You killed ${bot.colorName}!`;
                    break; 
                }
            }
        }
    }

    // --- REPORT LOGIC (Press R) ---
    if (e.code === 'KeyR') {
        for (let bot of bots) {
            if (bot.isDead) {
                let dist = Math.hypot(bot.x - player.x, bot.y - player.y);
                if (dist < 100) { // Report range
                    document.getElementById('ui-layer').innerText = `DEAD BODY REPORTED: ${bot.colorName}`;
                    
                    setTimeout(() => {
                        document.getElementById('ui-layer').innerText = "PluhUs Engine | WASD to Move | E to Kill | R to Report";
                    }, 3000);
                    break;
                }
            }
        }
    }
});

// -----------------------------------------
// MAIN GAME LOOP
// -----------------------------------------
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw dead bots first so they are under living players
    bots.forEach(bot => { if (bot.isDead) { bot.update(); bot.draw(ctx); } });
    
    // Draw living bots
    bots.forEach(bot => { if (!bot.isDead) { bot.update(); bot.draw(ctx); } });

    // Draw player last so they are always on top
    player.update();
    player.draw(ctx);

    requestAnimationFrame(gameLoop);
}

// Start game once images load
let loaded = 0;
const checkLoad = () => { if (++loaded === 2) gameLoop(); };
standImg.onload = checkLoad;
walkImg.onload = checkLoad;
