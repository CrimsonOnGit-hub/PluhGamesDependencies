const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const spriteSheet = new Image();
spriteSheet.src = 'crew_spritesheet.png';

// Spritesheet math based on your 660px width / 6 columns
const frameWidth = 110;  
const frameHeight = 115; 
const drawSize = 60; // How big they appear on screen

// Map your animations to grid coordinates
const animations = {
    stand: { x: 0, y: 0 },
    walk:  { x: 1, y: 0 },
    dead:  { x: 0, y: 1 } // <-- CHANGE THIS Y VALUE to match the row of your dead sprite
};

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
        this.frameX = animations.stand.x; 
        this.frameY = animations.stand.y; 
        this.animTimer = 0;
    }

    update() {
        // If dead, show dead sprite and stop moving
        if (this.isDead) {
            this.frameX = animations.dead.x;
            this.frameY = animations.dead.y;
            return; 
        }

        let isMoving = false;

        if (this.isPlayer) {
            if (keys['KeyW']) { this.y -= 4; isMoving = true; }
            if (keys['KeyS']) { this.y += 4; isMoving = true; }
            if (keys['KeyA']) { this.x -= 4; isMoving = true; }
            if (keys['KeyD']) { this.x += 4; isMoving = true; }
        } else {
            // Bot wandering logic
            this.x += this.vx;
            this.y += this.vy;
            isMoving = true; 
            
            // Wall bouncing
            if (this.x < 0 || this.x > canvas.width - drawSize) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height - drawSize) this.vy *= -1;
        }

        // Animation Logic
        if (isMoving) {
            this.frameY = animations.walk.y; // Ensure we are on the walking row
            this.animTimer++;
            if (this.animTimer > 8) { // Change frame every 8 ticks
                this.frameX++;
                if (this.frameX > 3) this.frameX = 1; // Loop walk frames
                this.animTimer = 0;
            }
        } else {
            this.frameX = animations.stand.x; 
            this.frameY = animations.stand.y;
        }
    }

    draw(ctx) {
        ctx.drawImage(
            spriteSheet,
            this.frameX * frameWidth, this.frameY * frameHeight, 
            frameWidth, frameHeight,                             
            this.x, this.y, drawSize, drawSize                   
        );
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
                    break; // Only kill one per button press
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
                    
                    // Here is where you would freeze the game and open the voting menu
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
    
    ctx.globalCompositeOperation = 'lighter'; 

    // Draw dead bots first so they are under living players
    bots.forEach(bot => { if (bot.isDead) { bot.update(); bot.draw(ctx); } });
    
    // Draw living bots
    bots.forEach(bot => { if (!bot.isDead) { bot.update(); bot.draw(ctx); } });

    // Draw player last so they are always on top
    player.update();
    player.draw(ctx);

    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(gameLoop);
}

spriteSheet.onload = () => {
    gameLoop();
};
