const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const spriteSheet = new Image();
spriteSheet.src = 'crew_spritesheet.png';

// Spritesheet math based on your 660px width / 6 columns
const frameWidth = 110;  
const frameHeight = 115; 
const drawSize = 60; // How big they appear on screen

// -----------------------------------------
// CREWMATE CLASS SYSTEM
// -----------------------------------------
class Crewmate {
    constructor(x, y, isPlayer) {
        this.x = x;
        this.y = y;
        this.isPlayer = isPlayer;
        
        // Random speed for bots, zero for player
        this.vx = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        this.vy = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        
        // Animation tracking
        this.frameX = 0; 
        this.frameY = 0; 
        this.animTimer = 0;
    }

    update() {
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
            this.animTimer++;
            if (this.animTimer > 8) { // Change frame every 8 ticks
                this.frameX++;
                // Loop through walk frames (assuming columns 1, 2, 3 are walking)
                if (this.frameX > 3) this.frameX = 1; 
                this.animTimer = 0;
            }
        } else {
            // Standing still frame
            this.frameX = 0; 
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
const player = new Crewmate(400, 300, true);

// Spawn an array of 5 bots easily using the class
const bots = [];
for(let i = 0; i < 5; i++) {
    bots.push(new Crewmate(Math.random() * 700, Math.random() * 500, false));
}

// Input tracking
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// -----------------------------------------
// MAIN GAME LOOP
// -----------------------------------------
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // HACK: If your spritesheet has a solid black background instead of transparent,
    // this line forces black pixels to disappear against the canvas. 
    ctx.globalCompositeOperation = 'lighter'; 

    // Update and draw all bots
    bots.forEach(bot => {
        bot.update();
        bot.draw(ctx);
    });

    // Update and draw player
    player.update();
    player.draw(ctx);

    // Reset composite operation so the UI stays normal
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(gameLoop);
}

// Start the game only after the heavy spritesheet finishes downloading
spriteSheet.onload = () => {
    gameLoop();
};
