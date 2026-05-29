const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load your specific individual images
const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';
const deadImg = new Image();  deadImg.src = 'Death_mogus.png'; // New death sprite!

const drawSize = 60; // How big they appear on screen
let gamePaused = false; // Used to stop movement during meetings

// -----------------------------------------
// CREWMATE CLASS SYSTEM
// -----------------------------------------
class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x;
        this.y = y;
        this.isPlayer = isPlayer;
        this.colorName = colorName;
        
        // Status states
        this.isDead = false;
        this.isEjected = false;
        this.isCleanedUp = false; // Hides bodies after a meeting
        
        // Random speed for bots, zero for player
        this.vx = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        this.vy = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        
        // Animation tracking
        this.isMoving = false;
        this.animTimer = 0;
        this.showWalkFrame = false;
    }

    update() {
        if (this.isDead || this.isEjected || gamePaused) return; 

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
        if (this.isEjected) return; // Don't draw players floating in space

        if (this.isDead) {
            if (!this.isCleanedUp) {
                // Draw the new death sprite
                ctx.drawImage(deadImg, this.x, this.y, drawSize, drawSize);
            }
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

// -----------------------------------------
// MEETING & REPORTING LOGIC
// -----------------------------------------
function triggerReport(reporter, deadBody) {
    if (gamePaused) return; // Don't trigger multiple meetings at once
    gamePaused = true;

    // Find everyone who is alive, not ejected, and is NOT the person reporting
    let allEntities = [player, ...bots];
    let possibleSuspects = allEntities.filter(c => !c.isDead && !c.isEjected && c !== reporter);
    
    let suspect;
    if (possibleSuspects.length > 0) {
        // Pick a random innocent (or guilty) person to frame
        suspect = possibleSuspects[Math.floor(Math.random() * possibleSuspects.length)];
    } else {
        suspect = { colorName: "Nobody" }; // Fallback if everyone is dead
    }

    const ui = document.getElementById('ui-layer');
    
    // 1. The Accusation
    ui.innerText = `${reporter.colorName}: "I saw ${suspect.colorName} go with ${deadBody.colorName} and now ${deadBody.colorName} is dead, and ${suspect.colorName} is running! ${suspect.colorName} is sus!"`;

    // 2. The Ejection (Wait 4 seconds so you can read the text)
    setTimeout(() => {
        ui.innerText = `${suspect.colorName} was ejected.`;
        if (suspect.colorName !== "Nobody") {
            suspect.isEjected = true; // Remove them from the game
        }
        
        // 3. Resume Game (Wait 2 more seconds)
        setTimeout(() => {
            // Clean up bodies so they don't get reported again
            allEntities.forEach(c => { if (c.isDead) c.isCleanedUp = true; });
            ui.innerText = "PluhUs Engine | WASD to Move | E to Kill | R to Report";
            gamePaused = false; // Unfreeze movement
        }, 2000);

    }, 4000);
}

// -----------------------------------------
// INPUT HANDLING
// -----------------------------------------
const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (gamePaused || player.isDead) return; // No actions during meetings

    // --- KILL LOGIC (Press E) ---
    if (e.code === 'KeyE') {
        for (let bot of bots) {
            if (!bot.isDead && !bot.isEjected) {
                let dist = Math.hypot(bot.x - player.x, bot.y - player.y);
                if (dist < 80) { 
                    bot.isDead = true;
                    // Briefly flash kill text, but don't pause game
                    document.getElementById('ui-layer').innerText = `You killed ${bot.colorName}!`;
                    setTimeout(() => {
                        if (!gamePaused) document.getElementById('ui-layer').innerText = "PluhUs Engine | WASD to Move | E to Kill | R to Report";
                    }, 1500);
                    break; 
                }
            }
        }
    }

    // --- PLAYER REPORT LOGIC (Press R) ---
    if (e.code === 'KeyR') {
        let allBodies = bots.filter(c => c.isDead && !c.isCleanedUp);
        for (let body of allBodies) {
            let dist = Math.hypot(player.x - body.x, player.y - body.y);
            if (dist < 100) { 
                triggerReport(player, body);
                break;
            }
        }
    }
});

// -----------------------------------------
// MAIN GAME LOOP
// -----------------------------------------
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // --- BOT AUTO-REPORT LOGIC ---
    if (!gamePaused) {
        bots.forEach(bot => {
            if (!bot.isDead && !bot.isEjected) {
                let allBodies = [player, ...bots].filter(c => c.isDead && !c.isCleanedUp);
                allBodies.forEach(body => {
                    let dist = Math.hypot(bot.x - body.x, bot.y - body.y);
                    if (dist < 60) { // If bot steps on a body
                        triggerReport(bot, body);
                    }
                });
            }
        });
    }

    // Draw all entities
    let allEntities = [...bots, player];
    
    // Draw dead bodies first (so they are under living players)
    allEntities.forEach(entity => { if (entity.isDead) { entity.update(); entity.draw(ctx); } });
    
    // Draw living players on top
    allEntities.forEach(entity => { if (!entity.isDead) { entity.update(); entity.draw(ctx); } });

    requestAnimationFrame(gameLoop);
}

// Error logging to catch bad file names
standImg.onerror = () => console.error("Missing: Stand_mogus.png");
walkImg.onerror = () => console.error("Missing: walk_mogus_1.png");
deadImg.onerror = () => console.error("Missing: Death_mogus.png");

// Start game loop immediately
gameLoop();
