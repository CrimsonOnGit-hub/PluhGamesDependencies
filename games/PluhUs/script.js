const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Fullscreen Setup
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.onresize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };

const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';
const deadImg = new Image();  deadImg.src = 'Death_mogus.png';

const drawSize = 60; 
const WORLD_SIZE = 2000; // The map is much bigger now!

let gamePaused = false; 
let gameWon = false; 

class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x; this.y = y;
        this.isPlayer = isPlayer; this.colorName = colorName;
        this.isDead = false; this.isEjected = false; this.isCleanedUp = false; 
        
        this.vx = isPlayer ? 0 : (Math.random() > 0.5 ? 2.5 : -2.5);
        this.vy = isPlayer ? 0 : (Math.random() > 0.5 ? 2.5 : -2.5);
        
        this.isMoving = false; this.animTimer = 0; this.showWalkFrame = false;
    }

    update() {
        if (this.isDead || this.isEjected || gamePaused || gameWon) return; 
        this.isMoving = false;

        if (this.isPlayer) {
            if (keys['KeyW']) { this.y -= 5; this.isMoving = true; }
            if (keys['KeyS']) { this.y += 5; this.isMoving = true; }
            if (keys['KeyA']) { this.x -= 5; this.isMoving = true; }
            if (keys['KeyD']) { this.x += 5; this.isMoving = true; }
        } else {
            this.x += this.vx; this.y += this.vy; this.isMoving = true; 
            
            // Wall bouncing against the new world bounds
            if (this.x < 0 || this.x > WORLD_SIZE - drawSize) this.vx *= -1;
            if (this.y < 0 || this.y > WORLD_SIZE - drawSize) this.vy *= -1;
        }

        // Keep player in bounds
        if (this.x < 0) this.x = 0;
        if (this.x > WORLD_SIZE - drawSize) this.x = WORLD_SIZE - drawSize;
        if (this.y < 0) this.y = 0;
        if (this.y > WORLD_SIZE - drawSize) this.y = WORLD_SIZE - drawSize;

        if (this.isMoving) {
            this.animTimer++;
            if (this.animTimer > 8) {
                this.showWalkFrame = !this.showWalkFrame;
                this.animTimer = 0;
            }
        } else {
            this.showWalkFrame = false;
        }
    }

    draw(ctx) {
        if (this.isEjected) return; 
        
        // Draw Name Tag
        ctx.fillStyle = "white";
        ctx.font = "14px 'Varela Round'";
        ctx.textAlign = "center";
        ctx.fillText(this.colorName, this.x + drawSize/2, this.y - 10);

        if (this.isDead) {
            if (!this.isCleanedUp) ctx.drawImage(deadImg, this.x, this.y, drawSize, drawSize);
        } else {
            const currentImg = this.showWalkFrame ? walkImg : standImg;
            ctx.drawImage(currentImg, this.x, this.y, drawSize, drawSize);
        }
    }
}

const player = new Crewmate(WORLD_SIZE/2, WORLD_SIZE/2, true, 'Red');
const bots = [
    new Crewmate(100, 100, false, 'Blue'),
    new Crewmate(600, 100, false, 'Green'),
    new Crewmate(1200, 800, false, 'Yellow'),
    new Crewmate(1800, 1500, false, 'Pink'),
    new Crewmate(500, 1800, false, 'Cyan'),
    new Crewmate(1500, 300, false, 'Black')
];

function resetMatch() {
    gameWon = false; gamePaused = false;
    document.getElementById('end-screen').style.display = 'none';
    
    player.x = WORLD_SIZE/2; player.y = WORLD_SIZE/2; 
    player.isDead = false; player.isEjected = false;
    
    bots.forEach(bot => {
        bot.isDead = false; bot.isEjected = false; bot.isCleanedUp = false;
        bot.x = Math.random() * (WORLD_SIZE - drawSize);
        bot.y = Math.random() * (WORLD_SIZE - drawSize);
    });
}

function triggerReport(reporter, deadBody) {
    if (gamePaused || gameWon) return; 
    gamePaused = true;

    let allEntities = [player, ...bots];
    let alivePlayers = allEntities.filter(c => !c.isDead && !c.isEjected);

    let suspect = null;
    let minDistance = Infinity;

    alivePlayers.forEach(p => {
        if (p !== reporter) { 
            let dist = Math.hypot(p.x - deadBody.x, p.y - deadBody.y);
            if (dist < minDistance) { minDistance = dist; suspect = p; }
        }
    });

    if (!suspect) suspect = { colorName: "Nobody" }; 

    const votingLayer = document.getElementById('voting-layer');
    const title = document.getElementById('voting-title');
    const btnContainer = document.getElementById('voting-buttons');
    btnContainer.innerHTML = ''; 

    title.innerText = `${reporter.colorName} found a body!\n"I saw ${suspect.colorName} go with ${deadBody.colorName} and now ${deadBody.colorName} is dead! ${suspect.colorName} is sus!"`;

    alivePlayers.forEach(p => {
        let btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = `Vote ${p.colorName}`;
        btn.onclick = () => castVote(p, suspect, alivePlayers);
        btnContainer.appendChild(btn);
    });

    let skipBtn = document.createElement('button');
    skipBtn.className = 'vote-btn skip-btn';
    skipBtn.innerText = "Skip Vote";
    skipBtn.onclick = () => castVote(null, suspect, alivePlayers);
    btnContainer.appendChild(skipBtn);

    votingLayer.style.display = 'flex'; 
}

function castVote(playerChoice, suspect, alivePlayers) {
    let votes = { "Skip": 0 };
    alivePlayers.forEach(p => votes[p.colorName] = 0);

    if (playerChoice) votes[playerChoice.colorName]++;
    else votes["Skip"]++;

    alivePlayers.forEach(p => {
        if (!p.isPlayer && suspect.colorName !== "Nobody") votes[suspect.colorName]++;
    });

    let highestVotes = -1; let ejectedName = null; let tie = false;
    for (let name in votes) {
        if (votes[name] > highestVotes) {
            highestVotes = votes[name]; ejectedName = name; tie = false;
        } else if (votes[name] === highestVotes) tie = true;
    }

    const title = document.getElementById('voting-title');
    document.getElementById('voting-buttons').innerHTML = ''; 

    if (tie || ejectedName === "Skip") {
        title.innerText = `Votes tied. Nobody was ejected.`;
        ejectedName = null;
    } else {
        title.innerText = `${ejectedName} was ejected.`;
    }

    setTimeout(() => {
        document.getElementById('voting-layer').style.display = 'none';

        if (ejectedName) {
            let ejectedObj = [player, ...bots].find(p => p.colorName === ejectedName);
            if (ejectedObj) ejectedObj.isEjected = true;
        }

        [player, ...bots].forEach(c => { if (c.isDead) c.isCleanedUp = true; });
        gamePaused = false; 
        checkWinCondition(); 
    }, 3000);
}

function triggerEnd(message, color) {
    gameWon = true;
    const endScreen = document.getElementById('end-screen');
    const endText = document.getElementById('end-text');
    endText.innerText = message;
    endText.style.color = color;
    endScreen.style.display = 'flex';
    setTimeout(resetMatch, 4000);
}

function checkWinCondition() {
    if (gameWon) return;
    if (player.isEjected) { triggerEnd("CREWMATES WIN", "#3498db"); return; }

    let aliveCount = bots.filter(b => !b.isDead && !b.isEjected).length + (player.isDead || player.isEjected ? 0 : 1);
    if (aliveCount <= 2 && !player.isEjected) { triggerEnd("IMPOSTOR WINS", "#ff4747"); }
}

const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (gamePaused || gameWon || player.isDead || player.isEjected) return; 

    if (e.code === 'KeyE') {
        for (let bot of bots) {
            if (!bot.isDead && !bot.isEjected && Math.hypot(bot.x - player.x, bot.y - player.y) < 90) { 
                bot.isDead = true; checkWinCondition(); break; 
            }
        }
    }

    if (e.code === 'KeyR') {
        let allBodies = bots.filter(c => c.isDead && !c.isCleanedUp);
        for (let body of allBodies) {
            if (Math.hypot(player.x - body.x, player.y - body.y) < 120) { 
                triggerReport(player, body); break;
            }
        }
    }
});

function drawGrid() {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    for(let i = 0; i < WORLD_SIZE; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(WORLD_SIZE, i); ctx.stroke();
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // --- HUD BUTTON LOGIC ---
    let canKill = bots.some(b => !b.isDead && !b.isEjected && Math.hypot(b.x - player.x, b.y - player.y) < 90);
    let canReport = bots.some(b => b.isDead && !b.isCleanedUp && Math.hypot(player.x - b.x, player.y - b.y) < 120);
    
    document.getElementById('kill-btn').className = canKill && !gamePaused ? 'action-btn active-kill' : 'action-btn';
    document.getElementById('report-btn').className = canReport && !gamePaused ? 'action-btn active-report' : 'action-btn';

    if (!gamePaused && !gameWon) {
        bots.forEach(bot => {
            if (!bot.isDead && !bot.isEjected) {
                let allBodies = [player, ...bots].filter(c => c.isDead && !c.isCleanedUp);
                allBodies.forEach(body => {
                    if (Math.hypot(bot.x - body.x, bot.y - body.y) < 70) triggerReport(bot, body);
                });
            }
        });
    }

    // --- CAMERA SYSTEM ---
    ctx.save();
    let camX = canvas.width / 2 - player.x - drawSize / 2;
    let camY = canvas.height / 2 - player.y - drawSize / 2;
    ctx.translate(camX, camY);

    // Draw the Map
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    drawGrid();

    // Draw Entities
    let allEntities = [...bots, player];
    allEntities.forEach(entity => { if (entity.isDead) { entity.update(); entity.draw(ctx); } });
    allEntities.forEach(entity => { if (!entity.isDead) { entity.update(); entity.draw(ctx); } });

    ctx.restore(); // Stop camera movement

    // --- FOG OF WAR (Shadows) ---
    if (!gamePaused && !gameWon) {
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 100, canvas.width/2, canvas.height/2, 500);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.98)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    requestAnimationFrame(gameLoop);
}

// Error logging
standImg.onerror = () => console.error("Missing: Stand_mogus.png");
walkImg.onerror = () => console.error("Missing: walk_mogus_1.png");
deadImg.onerror = () => console.error("Missing: Death_mogus.png");

gameLoop();
