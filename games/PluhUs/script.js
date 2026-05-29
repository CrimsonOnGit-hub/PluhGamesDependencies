const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
window.onresize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };

const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';
const deadImg = new Image();  deadImg.src = 'Death_mogus.png';

const drawSize = 60; 
let gamePaused = false; 
let gameWon = false; 

// --- TIMERS & COOLDOWNS ---
let killCooldown = 15; 
let lastTick = Date.now();
let lightsOut = false;
let sabotageCooldown = false;
let visionRadius = 500; 

// --- MAP & COLLISION SYSTEM ---
const WORLD_W = 2000;
const WORLD_H = 1500;
const walls = [
    {x: 0, y: 0, w: WORLD_W, h: 50}, 
    {x: 0, y: WORLD_H-50, w: WORLD_W, h: 50}, 
    {x: 0, y: 0, w: 50, h: WORLD_H}, 
    {x: WORLD_W-50, y: 0, w: 50, h: WORLD_H}, 
    {x: 400, y: 0, w: 100, h: 600}, 
    {x: 400, y: 900, w: 100, h: 600}, 
    {x: 1000, y: 300, w: 600, h: 100}, 
    {x: 1000, y: 1000, w: 600, h: 100} 
];

// The Electrical Box Location (Top middle of the map)
const elecPanel = { x: 900, y: 50, w: 100, h: 60 };

function checkCollision(nx, ny, size) {
    for (let w of walls) {
        if (nx < w.x + w.w && nx + size > w.x && ny < w.y + w.h && ny + size > w.y) return true;
    }
    return false;
}

// --- CREWMATE ENGINE ---
class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x; this.y = y;
        this.isPlayer = isPlayer; this.colorName = colorName;
        this.isDead = false; this.isEjected = false; this.isCleanedUp = false; 
        this.killer = null; 
        
        this.vx = isPlayer ? 0 : (Math.random() > 0.5 ? 2.5 : -2.5);
        this.vy = isPlayer ? 0 : (Math.random() > 0.5 ? 2.5 : -2.5);
        this.isMoving = false; this.animTimer = 0; this.showWalkFrame = false;
        this.memory = {}; 
    }

    update() {
        if (this.isDead || this.isEjected || gamePaused || gameWon) return; 
        this.isMoving = false;

        let nx = this.x; let ny = this.y;

        if (this.isPlayer) {
            if (keys['KeyW']) { ny -= 5; this.isMoving = true; }
            if (keys['KeyS']) { ny += 5; this.isMoving = true; }
            if (keys['KeyA']) { nx -= 5; this.isMoving = true; }
            if (keys['KeyD']) { nx += 5; this.isMoving = true; }
        } else {
            nx += this.vx; ny += this.vy; this.isMoving = true; 
            if (checkCollision(nx, ny, drawSize)) {
                this.vx *= -1; this.vy *= -1; 
                nx = this.x; ny = this.y; 
            }
        }

        if (!checkCollision(nx, ny, drawSize)) { this.x = nx; this.y = ny; }

        if (this.isMoving) {
            this.animTimer++;
            if (this.animTimer > 8) { this.showWalkFrame = !this.showWalkFrame; this.animTimer = 0; }
        } else { this.showWalkFrame = false; }

        if (!this.isPlayer && !lightsOut) {
            [player, ...bots].forEach(other => {
                if (other !== this && !other.isDead && !other.isEjected) {
                    if (Math.hypot(this.x - other.x, this.y - other.y) < 400) {
                        this.memory[other.colorName] = Date.now(); 
                    }
                }
            });
        }
    }

    draw(ctx) {
        if (this.isEjected) return; 
        ctx.fillStyle = "white"; ctx.font = "14px 'Varela Round'"; ctx.textAlign = "center";
        ctx.fillText(this.colorName, this.x + drawSize/2, this.y - 10);

        if (this.isDead && !this.isCleanedUp) {
            ctx.drawImage(deadImg, this.x, this.y, drawSize, drawSize);
        } else if (!this.isDead) {
            ctx.drawImage(this.showWalkFrame ? walkImg : standImg, this.x, this.y, drawSize, drawSize);
        }
    }
}

const player = new Crewmate(200, 200, true, 'Red');
const bots = [
    new Crewmate(200, 800, false, 'Blue'), new Crewmate(1200, 150, false, 'Green'),
    new Crewmate(1600, 500, false, 'Yellow'), new Crewmate(800, 1200, false, 'Pink'),
    new Crewmate(1600, 1200, false, 'Cyan'), new Crewmate(100, 1300, false, 'Black'),
    new Crewmate(800, 200, false, 'White'), new Crewmate(1500, 800, false, 'Orange')
];

// --- MINI-GAME LOGIC ---
let switchStates = [false, false, false, false, false];

window.openLightsTask = function() {
    gamePaused = true;
    switchStates = [false, false, false, false, false];
    document.querySelectorAll('.switch').forEach(s => s.className = 'switch off');
    document.getElementById('task-layer').style.display = 'flex';
}

window.closeTask = function() {
    document.getElementById('task-layer').style.display = 'none';
    gamePaused = false;
}

window.toggleSwitch = function(el) {
    let index = Array.from(el.parentNode.children).indexOf(el);
    switchStates[index] = !switchStates[index]; // Toggle state
    el.className = switchStates[index] ? 'switch on' : 'switch off';
    
    // Check if all are on
    if (switchStates.every(s => s === true)) {
        setTimeout(() => {
            lightsOut = false;
            visionRadius = 500;
            closeTask();
        }, 500);
    }
}

// --- CHAT & MEETING SYSTEM ---
function addChatMsg(author, text) {
    const box = document.getElementById('chat-box');
    let msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="name" style="color: ${author.toLowerCase()}">${author}:</span> ${text}`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight; 
}

function triggerReport(reporter, deadBody) {
    if (gamePaused || gameWon) return; 
    gamePaused = true; lightsOut = false; visionRadius = 500; 
    document.getElementById('sabotage-btn').classList.remove('cooldown');

    let alivePlayers = [player, ...bots].filter(c => !c.isDead && !c.isEjected);
    let suspect = alivePlayers.find(p => p !== reporter && Math.hypot(p.x - deadBody.x, p.y - deadBody.y) < 400);
    if (!suspect) suspect = { colorName: "Nobody" }; 

    document.getElementById('voting-title').innerText = "Emergency Meeting";
    document.getElementById('chat-box').innerHTML = ''; 
    document.getElementById('voting-buttons').innerHTML = ''; 
    document.getElementById('voting-layer').style.display = 'flex'; 

    let delay = 1000;
    
    setTimeout(() => { addChatMsg(reporter.colorName, `Where? I found a body.`); }, delay);
    delay += 1000;

    alivePlayers.forEach(b => {
        if (!b.isPlayer && b !== reporter && Math.random() > 0.3) {
            let phrases = ["Where?", "Who?", "I was doing tasks.", "skip?", "any proof?", "What happened?"];
            let phrase = phrases[Math.floor(Math.random() * phrases.length)];
            setTimeout(() => addChatMsg(b.colorName, phrase), delay);
            delay += Math.random() * 800 + 400; 
        }
    });

    delay += 1000;

    let selfReportAccusers = 0;
    let isSelfReport = (reporter === player && deadBody.killer === player);

    if (isSelfReport) {
        alivePlayers.forEach(b => {
            if (!b.isPlayer && b.memory[player.colorName] > Date.now() - 15000 && b.memory[deadBody.colorName] > Date.now() - 15000) {
                selfReportAccusers++;
                setTimeout(() => { addChatMsg(b.colorName, `SELF REPORT! I saw Red with them!`); }, delay);
                delay += 800;
            }
        });
    } else {
        alivePlayers.forEach(b => {
            if (!b.isPlayer && suspect.colorName !== "Nobody" && suspect.colorName !== b.colorName) {
                setTimeout(() => { 
                    addChatMsg(b.colorName, `I saw ${suspect.colorName} go with ${deadBody.colorName} and now ${deadBody.colorName} is dead! ${suspect.colorName} is sus!`); 
                }, delay);
                delay += 1000;
            }
        });
    }

    setTimeout(() => {
        const btnContainer = document.getElementById('voting-buttons');
        alivePlayers.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'vote-btn'; btn.innerText = `Vote ${p.colorName}`;
            btn.onclick = () => castVote(p, suspect, alivePlayers, selfReportAccusers);
            btnContainer.appendChild(btn);
        });
        let skipBtn = document.createElement('button');
        skipBtn.className = 'vote-btn skip-btn'; skipBtn.innerText = "Skip Vote";
        skipBtn.onclick = () => castVote(null, suspect, alivePlayers, selfReportAccusers);
        btnContainer.appendChild(skipBtn);
    }, delay);
}

function castVote(playerChoice, suspect, alivePlayers, selfReportAccusers) {
    let votes = { "Skip": 0 };
    alivePlayers.forEach(p => votes[p.colorName] = 0);
    if (playerChoice) votes[playerChoice.colorName]++; else votes["Skip"]++;

    alivePlayers.forEach(p => {
        if (!p.isPlayer) {
            if (selfReportAccusers >= 3) votes['Red']++; 
            else if (suspect.colorName !== "Nobody") votes[suspect.colorName]++;
            else votes["Skip"]++;
        }
    });

    let maxVotes = -1; let ejectedName = null; let tie = false;
    for (let name in votes) {
        if (votes[name] > maxVotes) { maxVotes = votes[name]; ejectedName = name; tie = false; } 
        else if (votes[name] === maxVotes) tie = true;
    }

    document.getElementById('voting-buttons').innerHTML = ''; 
    addChatMsg("SYSTEM", tie || ejectedName === "Skip" ? `Votes tied. Nobody ejected.` : `${ejectedName} was ejected.`);

    setTimeout(() => {
        document.getElementById('voting-layer').style.display = 'none';
        if (ejectedName) {
            let ejectedObj = [player, ...bots].find(p => p.colorName === ejectedName);
            if (ejectedObj) ejectedObj.isEjected = true;
        }
        [player, ...bots].forEach(c => { if (c.isDead) c.isCleanedUp = true; });
        
        killCooldown = 15; 
        gamePaused = false; 
        checkWinCondition(); 
    }, 3000);
}

function checkWinCondition() {
    if (gameWon) return;
    if (player.isEjected) { triggerEnd("CREWMATES WIN", "#3498db"); return; }
    let aliveCount = bots.filter(b => !b.isDead && !b.isEjected).length + (player.isDead || player.isEjected ? 0 : 1);
    if (aliveCount <= 2 && !player.isEjected) { triggerEnd("IMPOSTOR WINS", "#ff4747"); }
}

function triggerEnd(message, color) {
    gameWon = true;
    document.getElementById('end-text').innerText = message;
    document.getElementById('end-text').style.color = color;
    document.getElementById('end-screen').style.display = 'flex';
    setTimeout(() => location.reload(), 4000); 
}

// --- INPUTS & ACTIONS ---
const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // Prevent spacebar from scrolling the webpage down
    if (e.code === 'Space') e.preventDefault(); 

    if (gamePaused || gameWon || player.isDead || player.isEjected) return; 

    // USE Logic (Spacebar)
    if (e.code === 'Space') {
        let nearPanel = Math.hypot(player.x - (elecPanel.x + elecPanel.w/2), player.y - (elecPanel.y + elecPanel.h/2)) < 150;
        if (lightsOut && nearPanel) {
            openLightsTask();
        }
    }

    if (e.code === 'KeyE' && killCooldown === 0 && !lightsOut) { // Can't kill in pitch black to prevent cheese
        for (let bot of bots) {
            if (!bot.isDead && !bot.isEjected && Math.hypot(bot.x - player.x, bot.y - player.y) < 90) { 
                bot.isDead = true; bot.killer = player; 
                killCooldown = 20; 
                checkWinCondition(); 
                break; 
            }
        }
    }

    if (e.code === 'KeyR') {
        let bodies = bots.filter(c => c.isDead && !c.isCleanedUp);
        for (let b of bodies) {
            if (Math.hypot(player.x - b.x, player.y - b.y) < 120) { triggerReport(player, b); break; }
        }
    }

    if (e.code === 'KeyF' && !sabotageCooldown) {
        lightsOut = true; visionRadius = 150; sabotageCooldown = true;
        document.getElementById('sabotage-btn').classList.add('cooldown');
        
        // Cooldown timer only (no more auto-fix!)
        setTimeout(() => { document.getElementById('sabotage-btn').classList.remove('cooldown'); sabotageCooldown = false; }, 30000); 
    }
});

// --- RENDER ENGINE ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let now = Date.now();
    if (now - lastTick >= 1000) {
        if (killCooldown > 0 && !gamePaused && !gameWon) killCooldown--;
        lastTick = now;
    }

    // Update HUD Buttons
    let nearPanel = Math.hypot(player.x - (elecPanel.x + elecPanel.w/2), player.y - (elecPanel.y + elecPanel.h/2)) < 150;
    document.getElementById('use-btn').className = (lightsOut && nearPanel && !gamePaused) ? 'action-btn active-use' : 'action-btn';

    const killBtn = document.getElementById('kill-btn');
    if (killCooldown > 0) {
        killBtn.className = 'action-btn cooldown'; killBtn.innerText = killCooldown;
    } else {
        let canKill = bots.some(b => !b.isDead && !b.isEjected && Math.hypot(b.x - player.x, b.y - player.y) < 90);
        killBtn.className = (canKill && !gamePaused && !lightsOut) ? 'action-btn active-kill' : 'action-btn';
        killBtn.innerText = 'KILL (E)';
    }

    let canReport = bots.some(b => b.isDead && !b.isCleanedUp && Math.hypot(player.x - b.x, player.y - b.y) < 120);
    document.getElementById('report-btn').className = canReport && !gamePaused ? 'action-btn active-report' : 'action-btn';

    if (!gamePaused && !gameWon && !lightsOut) {
        bots.forEach(bot => {
            if (!bot.isDead && !bot.isEjected) {
                bots.filter(c => c.isDead && !c.isCleanedUp).forEach(body => {
                    if (Math.hypot(bot.x - body.x, bot.y - body.y) < 100) triggerReport(bot, body);
                });
            }
        });
    }

    ctx.save();
    ctx.translate(canvas.width / 2 - player.x - drawSize / 2, canvas.height / 2 - player.y - drawSize / 2);

    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "#4a5a6a"; walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Draw the Electrical Box!
    ctx.fillStyle = lightsOut ? "#ff4747" : "#555"; 
    ctx.fillRect(elecPanel.x, elecPanel.y, elecPanel.w, elecPanel.h);
    ctx.fillStyle = "white"; ctx.font = "bold 20px 'Varela Round'"; ctx.textAlign = "center";
    ctx.fillText("⚡", elecPanel.x + elecPanel.w/2, elecPanel.y + elecPanel.h/2 + 7);
    if (lightsOut) {
        // Draw an alert ping above it
        ctx.fillStyle = "rgba(255, 71, 71, 0.5)";
        ctx.beginPath(); ctx.arc(elecPanel.x + elecPanel.w/2, elecPanel.y - 20, 15 + Math.sin(now/200)*5, 0, Math.PI*2); ctx.fill();
    }

    let allEntities = [...bots, player];
    allEntities.forEach(e => { if (e.isDead) { e.update(); e.draw(ctx); } });
    allEntities.forEach(e => { if (!e.isDead) { e.update(); e.draw(ctx); } });

    ctx.restore();

    if (!gamePaused && !gameWon) {
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, visionRadius * 0.3, canvas.width/2, canvas.height/2, visionRadius);
        grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.98)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    requestAnimationFrame(gameLoop);
}

gameLoop();
