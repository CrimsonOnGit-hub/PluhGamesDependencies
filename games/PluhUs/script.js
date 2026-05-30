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

// --- DEV MENU SYSTEM ---
window.devVignetteEnabled = true;
let secretBuffer = "";

const devMenu = document.createElement('div');
devMenu.id = 'dev-menu';
devMenu.style.cssText = 'display: none; position: absolute; top: 70px; right: 20px; background: rgba(0,0,0,0.9); border: 2px solid #0f0; color: #0f0; font-family: monospace; padding: 15px; z-index: 9999; border-radius: 5px; box-shadow: 0 0 15px rgba(0,255,0,0.3);';
devMenu.innerHTML = `
    <h3 style="margin: 0 0 10px 0; border-bottom: 1px solid #0f0; padding-bottom: 5px;">🔧 DEV MENU</h3>
    <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="dev-vignette" checked onchange="window.devVignetteEnabled = this.checked" style="accent-color: #0f0;"> 
        Enable Vignette (Fog)
    </label>
    <div style="margin-top: 15px; text-align: right;">
        <button onclick="document.getElementById('dev-menu').style.display='none'" style="background: #111; color: #0f0; border: 1px solid #0f0; cursor: pointer; padding: 5px 15px; border-radius: 3px;">Close</button>
    </div>
`;
document.body.appendChild(devMenu);

// --- GAME MODE LOGIC ---
let gameMode = localStorage.getItem('chromeus_mode') || 'random';

window.toggleGameMode = function() {
    gameMode = (gameMode === 'random') ? 'always_impostor' : 'random';
    localStorage.setItem('chromeus_mode', gameMode);
    location.reload();
}

window.addEventListener('DOMContentLoaded', () => {
    const modeBtn = document.getElementById('mode-toggle');
    if (modeBtn) {
        modeBtn.innerText = gameMode === 'random' ? "Mode: Random Role" : "Mode: Always Impostor";
        if (gameMode === 'always_impostor') modeBtn.style.borderColor = "#ff4747";
    }
});

let killCooldown = 15; 
let globalSabotageCooldown = 0; 
let lastTick = Date.now();
let lightsOut = false;
let visionRadius = 500; 
let isSabotageMapOpen = false;

// --- MAP, WALLS & 4 DOORS ---
const WORLD_W = 2000;
const WORLD_H = 1500;
const walls = [
    {x: 0, y: 0, w: WORLD_W, h: 50}, {x: 0, y: WORLD_H-50, w: WORLD_W, h: 50}, 
    {x: 0, y: 0, w: 50, h: WORLD_H}, {x: WORLD_W-50, y: 0, w: 50, h: WORLD_H}, 
    {x: 400, y: 0, w: 100, h: 550}, {x: 400, y: 850, w: 100, h: 650}, 
    {x: 1000, y: 300, w: 600, h: 100}, {x: 1000, y: 1000, w: 600, h: 100}, 
    {x: 1000, y: 400, w: 100, h: 150}, {x: 1000, y: 850, w: 100, h: 150}, 
    {x: 800, y: 0, w: 100, h: 300}, {x: 1100, y: 0, w: 100, h: 300}, 
    {x: 800, y: 1200, w: 100, h: 300}, {x: 1100, y: 1200, w: 100, h: 300} 
];

const doors = [
    { id: 'door-1', x: 400, y: 550, w: 100, h: 300, isClosed: false, closeTimer: 0, cooldown: 0 }, 
    { id: 'door-2', x: 1000, y: 550, w: 100, h: 300, isClosed: false, closeTimer: 0, cooldown: 0 }, 
    { id: 'door-3', x: 900, y: 250, w: 200, h: 50, isClosed: false, closeTimer: 0, cooldown: 0 },  
    { id: 'door-4', x: 900, y: 1200, w: 200, h: 50, isClosed: false, closeTimer: 0, cooldown: 0 }  
];

const elecPanel = { x: 950, y: 50, w: 100, h: 60 };

const vents = [
    { x: 200, y: 250 },   
    { x: 950, y: 200 },   
    { x: 1300, y: 650 },  
    { x: 200, y: 1200 }   
];

function checkCollision(nx, ny, size) {
    let padding = 5;
    let left = nx + padding; let right = nx + size - padding;
    let top = ny + padding; let bottom = ny + size - padding;

    for (let w of walls) {
        if (right > w.x && left < w.x + w.w && bottom > w.y && top < w.y + w.h) return true;
    }
    for (let d of doors) {
        if (d.isClosed && right > d.x && left < d.x + d.w && bottom > d.y && top < d.y + d.h) return true;
    }
    return false;
}

// --- DYNAMIC SPRITE TINTER ---
function getTintedSprite(img, colorHex) {
    let tCanvas = document.createElement('canvas');
    tCanvas.width = drawSize; 
    tCanvas.height = drawSize;
    let tCtx = tCanvas.getContext('2d');
    
    // 1. Draw base sprite
    tCtx.drawImage(img, 0, 0, drawSize, drawSize);
    
    // 2. Tint it (Only draws color where the sprite exists, keeping transparency)
    tCtx.globalCompositeOperation = 'source-atop';
    tCtx.fillStyle = colorHex;
    tCtx.globalAlpha = 0.55; // Blend amount so original shading/lines show through
    tCtx.fillRect(0, 0, drawSize, drawSize);
    
    // 3. Multiply blend to make the dark outlines pop back out
    tCtx.globalAlpha = 1.0;
    tCtx.globalCompositeOperation = 'multiply';
    tCtx.drawImage(img, 0, 0, drawSize, drawSize);
    
    return tCanvas;
}

// --- AI PATHFINDING GRAPH ---
const waypoints = [
    { id: 0, x: 250, y: 300, edges: [2] },         
    { id: 1, x: 250, y: 1200, edges: [2] },        
    { id: 2, x: 250, y: 700, edges: [0, 1, 3] },   
    { id: 3, x: 550, y: 700, edges: [2, 4] },      
    { id: 4, x: 800, y: 700, edges: [3, 6, 10] },  
    { id: 5, x: 1000, y: 150, edges: [12] },       
    { id: 6, x: 950, y: 700, edges: [4, 7, 12] },  
    { id: 7, x: 1200, y: 700, edges: [6, 8, 9] },  
    { id: 8, x: 1400, y: 500, edges: [7] },        
    { id: 9, x: 1400, y: 900, edges: [7] },        
    { id: 10, x: 950, y: 1100, edges: [4, 11] },   
    { id: 11, x: 1000, y: 1350, edges: [10] },     
    { id: 12, x: 950, y: 400, edges: [5, 6] }      
];

function getClosestNode(x, y) {
    let closest = 0; let min = Infinity;
    waypoints.forEach(wp => {
        let d = Math.hypot(x - wp.x, y - wp.y);
        if (d < min) { min = d; closest = wp.id; }
    });
    return closest;
}

function getPath(startId, endId) {
    if (startId === endId) return [];
    let queue = [[startId]];
    let visited = new Set([startId]);
    while(queue.length > 0) {
        let path = queue.shift();
        let node = path[path.length - 1];
        if (node === endId) return path;
        for (let neighbor of waypoints[node].edges) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }
    return [];
}

// --- CREWMATE ENGINE ---
class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x; this.y = y;
        this.isPlayer = isPlayer; this.colorName = colorName;
        this.isDead = false; this.isEjected = false; this.isCleanedUp = false; 
        this.killer = null; 
        
        // Color mapping for the dynamic tinter
        const colorMap = {
            'Red': '#ff0000', 'Blue': '#1e90ff', 'Green': '#32cd32', 'Yellow': '#ffd700',
            'Pink': '#ff69b4', 'Cyan': '#00ffff', 'Black': '#555555', 'Orange': '#ff8c00'
        };
        this.colorHex = colorMap[this.colorName] || '#ffffff';
        this.tintedStand = null;
        this.tintedWalk = null;
        this.tintedDead = null;

        this.isImpostor = false;
        this.internalKillCooldown = 600; 
        
        this.speed = isPlayer ? 5 : 3.5;
        this.path = [];
        this.targetNode = null;
        this.waitTimer = 0;
        this.goingToFixLights = false;
        this.finalOffsetX = 0;
        this.finalOffsetY = 0;
        
        this.inVent = false;
        this.currentVent = -1;
        this.stuckTimer = 0; 

        this.isMoving = false;
        this.lastDir = 'right';
        this.memory = {}; 
        
        this.swaySpeed = 200 + Math.random() * 200;
        this.swayIntensity = 0.5 + Math.random() * 0.8;
    }

    update() {
        if (this.isDead || this.isEjected || gamePaused || gameWon) {
            this.isMoving = false;
            return; 
        }
        
        if (this.inVent) {
            this.isMoving = false;
            return;
        }

        this.isMoving = false;

        if (this.isPlayer) {
            let nx = this.x; let ny = this.y;
            if (keys['KeyW']) { ny -= this.speed; this.isMoving = true; }
            if (keys['KeyS']) { ny += this.speed; this.isMoving = true; }
            if (keys['KeyA']) { nx -= this.speed; this.isMoving = true; this.lastDir = 'left'; }
            if (keys['KeyD']) { nx += this.speed; this.isMoving = true; this.lastDir = 'right'; }
            if (!checkCollision(nx, ny, drawSize)) { this.x = nx; this.y = ny; }
        } else {
            
            if (this.isImpostor) {
                if (this.internalKillCooldown > 0) this.internalKillCooldown--;
                if (this.internalKillCooldown <= 0) {
                    let aliveCrew = [player, ...bots].filter(c => !c.isDead && !c.isEjected && !c.isImpostor && !c.inVent);
                    let target = null;
                    let minDist = Infinity;
                    aliveCrew.forEach(c => {
                        let d = Math.hypot(c.x - this.x, c.y - this.y);
                        if (d < minDist) { minDist = d; target = c; }
                    });
                    
                    if (target && minDist < 200) { 
                        let witnesses = aliveCrew.filter(c => c !== target && Math.hypot(c.x - this.x, c.y - this.y) < 400);
                        if (witnesses.length === 0 || lightsOut) {
                            if (minDist < 90) {
                                target.isDead = true; target.killer = this;
                                this.internalKillCooldown = 900; 

                                let sightRadius = lightsOut ? 150 : 400;
                                bots.forEach(w => {
                                    if (!w.isDead && !w.isEjected && !w.inVent && w !== target && w !== this) {
                                        if (Math.hypot(w.x - this.x, w.y - this.y) < sightRadius) {
                                            w.memory.sawKill = { killer: this.colorName, victim: target.colorName, time: Date.now() };
                                        }
                                    }
                                });

                                checkWinCondition();
                                this.targetNode = null; this.path = []; this.waitTimer = 0;
                                return; 
                            } else {
                                let angle = Math.atan2(target.y - this.y, target.x - this.x);
                                let nx = this.x + Math.cos(angle) * this.speed;
                                let ny = this.y + Math.sin(angle) * this.speed;
                                
                                if (!checkCollision(nx, ny, drawSize)) {
                                    this.x = nx; this.y = ny; this.isMoving = true;
                                    if (Math.abs(Math.cos(angle)) > 0.1) this.lastDir = (Math.cos(angle) > 0) ? 'right' : 'left';
                                    return; 
                                }
                            }
                        }
                    }
                }
            }
            
            if (lightsOut && !this.goingToFixLights && !this.isImpostor) {
                this.goingToFixLights = true;
                let start = getClosestNode(this.x, this.y);
                let pathIds = getPath(start, 5); pathIds.shift();
                this.path = pathIds;
                this.targetNode = this.path.length > 0 ? waypoints[this.path[0]] : waypoints[5];
            } else if (!lightsOut) { this.goingToFixLights = false; }

            if (this.goingToFixLights && Math.hypot(this.x - waypoints[5].x, this.y - waypoints[5].y) < 100) {
                this.isMoving = false;
                if (Math.random() < 0.01) { lightsOut = false; visionRadius = 500; closeTask(); }
                return;
            }
            
            if (!this.isImpostor && this.waitTimer <= 0 && Math.random() < 0.003) {
                this.waitTimer = 20 + Math.random() * 40; 
            }

            if (this.waitTimer > 0) { this.waitTimer--; this.isMoving = false; } 
            else if (this.targetNode) {
                let isFinalNode = (this.path.length === 0);
                let targetX = this.targetNode.x + (isFinalNode ? this.finalOffsetX : 0);
                let targetY = this.targetNode.y + (isFinalNode ? this.finalOffsetY : 0);
                
                let dx = targetX - this.x; let dy = targetY - this.y;
                let dist = Math.hypot(dx, dy);

                if (dist < 10) {
                    this.path.shift(); 
                    if (this.path.length > 0) this.targetNode = waypoints[this.path[0]]; 
                    else { 
                        this.targetNode = null; 
                        this.finalOffsetX = (Math.random() - 0.5) * 60; 
                        this.finalOffsetY = (Math.random() - 0.5) * 60;
                        this.waitTimer = 100 + Math.random() * 200; 
                    }
                } else {
                    let angle = Math.atan2(dy, dx);
                    let swayAngle = angle + (Math.PI / 2); 
                    let swayAmount = Math.sin(Date.now() / this.swaySpeed) * this.swayIntensity;
                    
                    let nx = this.x + (Math.cos(angle) * this.speed) + (Math.cos(swayAngle) * swayAmount);
                    let ny = this.y + (Math.sin(angle) * this.speed) + (Math.sin(swayAngle) * swayAmount);
                    
                    let sepX = 0; let sepY = 0;
                    [player, ...bots].forEach(other => {
                        if (other !== this && !other.isDead && Math.hypot(this.x - other.x, this.y - other.y) < 40) {
                            sepX += (this.x - other.x) * 0.05;
                            sepY += (this.y - other.y) * 0.05;
                        }
                    });
                    nx += sepX; ny += sepY;

                    if (!checkCollision(nx, ny, drawSize)) {
                        this.x = nx; this.y = ny; this.isMoving = true; this.stuckTimer = 0;
                        if (Math.abs(Math.cos(angle)) > 0.1) this.lastDir = (Math.cos(angle) > 0) ? 'right' : 'left';
                    } else {
                        if (!checkCollision(nx, this.y, drawSize)) { this.x = nx; this.isMoving = true; this.stuckTimer = 0; }
                        else if (!checkCollision(this.x, ny, drawSize)) { this.y = ny; this.isMoving = true; this.stuckTimer = 0; }
                        else { 
                            this.isMoving = false; 
                            this.stuckTimer++;
                            if (this.stuckTimer > 15) {
                                this.targetNode = null;
                                this.stuckTimer = 0;
                            }
                        }
                    }
                }
            } else {
                let start = getClosestNode(this.x, this.y);
                let target;
                do { target = Math.floor(Math.random() * waypoints.length); } while (target === start && waypoints.length > 1);
                let pathIds = getPath(start, target); pathIds.shift();
                this.path = pathIds;
                this.targetNode = this.path.length > 0 ? waypoints[this.path[0]] : waypoints[target];
            }
        }
        
        if (!this.isPlayer && !lightsOut && !this.inVent) {
            [player, ...bots].forEach(other => {
                if (other !== this && !other.isDead && !other.isEjected && !other.inVent) {
                    if (Math.hypot(this.x - other.x, this.y - other.y) < 400) {
                        this.memory[other.colorName] = Date.now(); 
                    }
                }
            });
        }
    }

    draw(ctx) {
        if (this.isEjected) return; 

        // Generate colored sprites on-the-fly once images load
        if (standImg.complete && standImg.naturalWidth > 0 && !this.tintedStand) {
            this.tintedStand = getTintedSprite(standImg, this.colorHex);
            this.tintedWalk = getTintedSprite(walkImg, this.colorHex);
            this.tintedDead = getTintedSprite(deadImg, this.colorHex);
        }

        ctx.save();
        ctx.translate(this.x + drawSize/2, this.y + drawSize/2);
        
        if (this.inVent) ctx.globalAlpha = 0.4;
        if (this.lastDir === 'left') ctx.scale(-1, 1);
        
        // Pick the correct dynamically colored sprite
        let currentImg = this.tintedStand || standImg;
        if (this.isDead && !this.isCleanedUp) currentImg = this.tintedDead || deadImg;
        else if (this.isMoving) currentImg = this.tintedWalk || walkImg;

        if (this.isDead && !this.isCleanedUp) {
            ctx.drawImage(currentImg, -drawSize/2, -drawSize/2, drawSize, drawSize);
        } else if (this.isMoving) {
            let bob = Math.sin(Date.now() / 100) * 4;
            ctx.rotate(Math.sin(Date.now() / 100) * 0.1);
            ctx.drawImage(currentImg, -drawSize/2, -drawSize/2 + bob, drawSize, drawSize);
        } else {
            ctx.drawImage(currentImg, -drawSize/2, -drawSize/2, drawSize, drawSize);
        }

        ctx.restore();

        if (!this.inVent || this.isPlayer) {
            ctx.fillStyle = this.colorHex;
            ctx.font = "bold 14px 'Varela Round'";
            ctx.textAlign = "center";
            ctx.strokeStyle = "black"; 
            ctx.lineWidth = 3;
            ctx.strokeText(this.colorName, this.x + drawSize/2, this.y - 5);
            ctx.fillText(this.colorName, this.x + drawSize/2, this.y - 5);
        }
    }
}

const player = new Crewmate(waypoints[4].x, waypoints[4].y, true, 'Red');
const bots = [
    new Crewmate(waypoints[0].x, waypoints[0].y, false, 'Blue'),
    new Crewmate(waypoints[1].x, waypoints[1].y, false, 'Green'),
    new Crewmate(waypoints[5].x, waypoints[5].y, false, 'Yellow'),
    new Crewmate(waypoints[8].x, waypoints[8].y, false, 'Pink'),
    new Crewmate(waypoints[9].x, waypoints[9].y, false, 'Cyan'),
    new Crewmate(waypoints[11].x, waypoints[11].y, false, 'Black'), 
    new Crewmate(waypoints[7].x, waypoints[7].y, false, 'Orange')
];

function assignRoles() {
    let allEntities = [player, ...bots];
    allEntities.forEach(e => e.isImpostor = false);
    if (gameMode === 'always_impostor') player.isImpostor = true;
    else allEntities[Math.floor(Math.random() * allEntities.length)].isImpostor = true;

    const taskHeader = document.querySelector('#task-list h3');
    const taskDesc = document.querySelector('#task-list p');
    
    if (player.isImpostor) {
        taskHeader.innerText = "Impostor";
        taskHeader.style.color = "#ff4747";
        taskDesc.innerText = "Sabotage and kill everyone.";
        document.getElementById('kill-btn').style.display = 'flex';
        document.getElementById('sabotage-btn').style.display = 'flex';
    } else {
        taskHeader.innerText = "Crewmate";
        taskHeader.style.color = "#3498db";
        taskDesc.innerText = "Find the impostor and fix sabotages.";
        document.getElementById('kill-btn').style.display = 'none';
        document.getElementById('sabotage-btn').style.display = 'none';
    }
}
assignRoles();

// --- CLICKABLE UI & INPUT HANDLERS ---
window.toggleSabotageMap = function() {
    if (gamePaused || player.isDead || !player.isImpostor || player.inVent) return;
    isSabotageMapOpen = !isSabotageMapOpen;
    document.getElementById('sabotage-layer').style.display = isSabotageMapOpen ? 'flex' : 'none';
}

window.triggerSabotage = function(type) {
    if (type === 'lights') {
        if (globalSabotageCooldown === 0 && !lightsOut) {
            lightsOut = true; visionRadius = 150;
            globalSabotageCooldown = 30; 
        }
    } else if (type.startsWith('door')) {
        let door = doors.find(d => d.id === type);
        if (door && door.cooldown === 0 && !door.isClosed) {
            door.isClosed = true;
            door.closeTimer = 10; 
            door.cooldown = 20; 
        }
    }
}

window.openLightsTask = function() {
    if (player.inVent) return;
    gamePaused = true;
    switchStates = [false, false, false, false, false];
    document.querySelectorAll('.switch').forEach(s => s.className = 'switch off');
    document.getElementById('task-layer').style.display = 'flex';
}

let switchStates = [false, false, false, false, false];
window.closeTask = function() {
    document.getElementById('task-layer').style.display = 'none';
    gamePaused = false;
}

window.toggleSwitch = function(el) {
    let index = Array.from(el.parentNode.children).indexOf(el);
    switchStates[index] = !switchStates[index]; 
    el.className = switchStates[index] ? 'switch on' : 'switch off';
    
    if (switchStates.every(s => s === true)) {
        setTimeout(() => { lightsOut = false; visionRadius = 500; closeTask(); }, 500);
    }
}

window.doUse = () => { 
    if(gamePaused || player.isDead || player.inVent) return;
    let nearPanel = Math.hypot(player.x - (elecPanel.x + 50), player.y - (elecPanel.y + 30)) < 150;
    if(lightsOut && nearPanel) openLightsTask();
};

window.doVent = () => {
    if(!player.isImpostor || lightsOut) return;
    if(player.inVent) { 
        player.inVent = false; 
    } else {
        let nearest = vents.findIndex(v => Math.hypot(player.x - v.x, player.y - v.y) < 100);
        if(nearest !== -1) { 
            player.inVent = true; 
            player.currentVent = nearest; 
            player.x = vents[nearest].x;
            player.y = vents[nearest].y;
        }
    }
};

window.navigateVent = (dir) => {
    if(!player.inVent) return;
    player.currentVent = (player.currentVent + dir + vents.length) % vents.length;
    player.x = vents[player.currentVent].x;
    player.y = vents[player.currentVent].y;
};

window.doKill = () => {
    if(!player.isImpostor || killCooldown > 0 || player.inVent || gamePaused || lightsOut || isSabotageMapOpen) return;
    for (let bot of bots) {
        if (!bot.isDead && !bot.isEjected && !bot.inVent && Math.hypot(bot.x - player.x, bot.y - player.y) < 90) { 
            bot.isDead = true; bot.killer = player; 
            killCooldown = 20; 

            let sightRadius = lightsOut ? 150 : 400;
            bots.forEach(w => {
                if (!w.isDead && !w.isEjected && !w.inVent && w !== bot) {
                    if (Math.hypot(w.x - player.x, w.y - player.y) < sightRadius) {
                        w.memory.sawKill = { killer: player.colorName, victim: bot.colorName, time: Date.now() };
                    }
                }
            });

            checkWinCondition(); break; 
        }
    }
};

window.doReport = () => {
    if(gamePaused || isSabotageMapOpen) return;
    let bodies = bots.filter(c => c.isDead && !c.isCleanedUp);
    for (let b of bodies) {
        if (Math.hypot(player.x - b.x, player.y - b.y) < 250) { triggerReport(player, b); break; }
    }
};

document.getElementById('use-btn').onclick = window.doUse;
document.getElementById('kill-btn').onclick = window.doKill;
document.getElementById('report-btn').onclick = window.doReport;
let ventBtnEl = document.getElementById('vent-btn');
if(ventBtnEl) ventBtnEl.onclick = window.doVent;

const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault(); 
    
    if (e.key && e.key.length === 1) {
        secretBuffer += e.key.toLowerCase();
        if (secretBuffer.length > 6) secretBuffer = secretBuffer.slice(-6);
        if (secretBuffer === 'pluhus' || secretBuffer === 'chrome') { 
            const dm = document.getElementById('dev-menu');
            dm.style.display = (dm.style.display === 'none') ? 'block' : 'none';
            secretBuffer = ''; 
        }
    }
    
    if (gamePaused || gameWon || player.isDead || player.isEjected) return; 

    if (e.code === 'KeyF' && player.isImpostor && !player.inVent) toggleSabotageMap();

    if (player.inVent) {
        if (e.code === 'KeyA') window.navigateVent(-1);
        if (e.code === 'KeyD') window.navigateVent(1);
        if (e.code === 'KeyV') window.doVent();
        return; 
    } 
    
    if (e.code === 'KeyV') window.doVent();
    if (e.code === 'Space') window.doUse();
    if (e.code === 'KeyE') window.doKill();
    if (e.code === 'KeyR') window.doReport();
});

// --- CHAT & MEETING SYSTEM ---
function addChatMsg(author, text) {
    const box = document.getElementById('chat-box');
    let msg = document.createElement('div');
    msg.className = 'chat-msg';
    
    const colorMap = {
        'Red': '#ff0000', 'Blue': '#1e90ff', 'Green': '#32cd32', 'Yellow': '#ffd700',
        'Pink': '#ff69b4', 'Cyan': '#00ffff', 'Black': '#555555', 'Orange': '#ff8c00'
    };
    let hex = colorMap[author] || '#ffffff';
    if(author === "SYSTEM") hex = "#0f0";

    msg.innerHTML = `<span class="name" style="color: ${hex}; text-shadow: 1px 1px 2px #000;">${author}:</span> ${text}`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight; 
}

window.sendPlayerChat = function() {
    if (player.isDead || player.isEjected) return; 
    const select = document.getElementById('quick-chat-select');
    if (select.value) {
        addChatMsg(player.colorName, select.value);
        select.selectedIndex = 0; 
    }
}

function triggerReport(reporter, deadBody) {
    if (gamePaused || gameWon) return; 
    
    if (player.inVent) player.inVent = false; 
    
    gamePaused = true; lightsOut = false; visionRadius = 500; 
    isSabotageMapOpen = false;
    document.getElementById('sabotage-layer').style.display = 'none';
    doors.forEach(d => d.isClosed = false); 

    let alivePlayers = [player, ...bots].filter(c => !c.isDead && !c.isEjected);
    let suspect = alivePlayers.find(p => p !== reporter && Math.hypot(p.x - deadBody.x, p.y - deadBody.y) < 400);
    if (!suspect) suspect = { colorName: "Nobody" }; 

    document.getElementById('voting-title').innerText = "Emergency Meeting";
    document.getElementById('chat-box').innerHTML = ''; 
    document.getElementById('voting-buttons').innerHTML = ''; 
    document.getElementById('voting-layer').style.display = 'flex'; 

    const accuseGroup = document.getElementById('qc-accuse');
    accuseGroup.innerHTML = '';
    alivePlayers.forEach(p => {
        if (!p.isPlayer) {
            let opt = document.createElement('option');
            opt.value = `${p.colorName} is sus!`;
            opt.innerText = `${p.colorName} is sus!`;
            accuseGroup.appendChild(opt);
        }
    });

    let delay = 1000;
    setTimeout(() => { if (!reporter.isPlayer) addChatMsg(reporter.colorName, `Where? I found a body.`); }, delay);
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
    let isSelfReport = (reporter === deadBody.killer);
    let mainAccuser = null;

    alivePlayers.forEach(b => {
        if (!b.isPlayer && b.memory.sawKill && b.memory.sawKill.victim === deadBody.colorName) {
            suspect = [player, ...bots].find(p => p.colorName === b.memory.sawKill.killer) || suspect;
            if (!mainAccuser) {
                mainAccuser = b.colorName;
                setTimeout(() => { addChatMsg(b.colorName, `${suspect.colorName} killed ${deadBody.colorName} in front of me!`); }, delay);
            } else {
                setTimeout(() => { addChatMsg(b.colorName, `Yeah, I literally saw ${suspect.colorName} kill them!`); }, delay);
            }
            delay += 1000;
        }
    });

    if (!mainAccuser) {
        if (isSelfReport) {
            alivePlayers.forEach(b => {
                if (!b.isPlayer && b.memory[reporter.colorName] > Date.now() - 15000 && b.memory[deadBody.colorName] > Date.now() - 15000) {
                    selfReportAccusers++;
                    if (!mainAccuser) {
                        mainAccuser = b.colorName; 
                        setTimeout(() => { addChatMsg(b.colorName, `SELF REPORT! I saw ${reporter.colorName} with them!`); }, delay);
                    } else {
                        let currentAccuser = mainAccuser; 
                        setTimeout(() => {
                            let agreements = [`Yeah, i agree, ${currentAccuser}`, `listen to ${currentAccuser}`, `${reporter.colorName} is pretty sus`];
                            addChatMsg(b.colorName, agreements[Math.floor(Math.random() * agreements.length)]);
                        }, delay);
                    }
                    delay += 800;
                }
            });
        } else {
            if (suspect.colorName === "Nobody") {
                let randomAccuser = alivePlayers.find(p => !p.isPlayer && p !== reporter);
                if (randomAccuser && Math.random() > 0.4) {
                    let potentialTargets = alivePlayers.filter(p => p !== randomAccuser && p !== reporter);
                    if (potentialTargets.length > 0) {
                        let randomTarget = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                        setTimeout(() => {
                            addChatMsg(randomAccuser.colorName, `I didn't see the body, but ${randomTarget.colorName} is faking tasks.`);
                            suspect = randomTarget; mainAccuser = randomAccuser.colorName;
                        }, delay);
                        delay += 1000;
                    }
                }
            }
            alivePlayers.forEach(b => {
                if (!b.isPlayer && suspect.colorName !== "Nobody" && suspect.colorName !== b.colorName) {
                    if (!mainAccuser) {
                        mainAccuser = b.colorName; 
                        setTimeout(() => { addChatMsg(b.colorName, `I saw ${suspect.colorName} go with ${deadBody.colorName}! ${suspect.colorName} is sus!`); }, delay);
                    } else {
                        let currentAccuser = mainAccuser; 
                        setTimeout(() => {
                            let agreements = [`Yeah, i agree, ${currentAccuser}`, `listen to ${currentAccuser}`, `${suspect.colorName} is pretty sus`];
                            addChatMsg(b.colorName, agreements[Math.floor(Math.random() * agreements.length)]);
                        }, delay);
                    }
                    delay += 1000;
                }
            });
        }
    }

    setTimeout(() => {
        const btnContainer = document.getElementById('voting-buttons');
        alivePlayers.forEach(p => {
            let btn = document.createElement('button');
            btn.className = 'vote-btn'; btn.innerText = `Vote ${p.colorName}`;
            btn.style.borderColor = p.colorHex;
            btn.onclick = () => castVote(p, suspect, alivePlayers, selfReportAccusers, reporter);
            btnContainer.appendChild(btn);
        });
        let skipBtn = document.createElement('button');
        skipBtn.className = 'vote-btn skip-btn'; skipBtn.innerText = "Skip Vote";
        skipBtn.onclick = () => castVote(null, suspect, alivePlayers, selfReportAccusers, reporter);
        btnContainer.appendChild(skipBtn);
    }, delay);
}

function castVote(playerChoice, suspect, alivePlayers, selfReportAccusers, reporter) {
    let voteLedger = { "Skip": [] };
    alivePlayers.forEach(p => voteLedger[p.colorName] = []);

    let pTarget = playerChoice ? playerChoice.colorName : "Skip";
    voteLedger[pTarget].push(player);

    alivePlayers.forEach(p => {
        if (!p.isPlayer) {
            let target = "Skip";
            if (p.memory.sawKill && p.memory.sawKill.victim === (bots.find(b => b.killer) || {}).colorName) {
                 target = p.memory.sawKill.killer;
            } else if (selfReportAccusers >= 3) {
                 target = reporter.colorName; 
            } else if (suspect.colorName !== "Nobody") {
                 target = suspect.colorName;
            }
            voteLedger[target].push(p);
        }
    });

    let maxVotes = -1; let ejectedName = null; let tie = false;
    for (let name in voteLedger) {
        let count = voteLedger[name].length;
        if (count > maxVotes) { maxVotes = count; ejectedName = name; tie = false; } 
        else if (count === maxVotes) tie = true;
    }

    document.getElementById('voting-buttons').innerHTML = '';
    let resultsHTML = '<h3 style="color:white; text-align:center; margin-bottom:10px;">Voting Results</h3><div style="display:flex; flex-direction:column; gap:8px;">';
    
    for (let name in voteLedger) {
        if (voteLedger[name].length > 0) {
            let voterDots = voteLedger[name].map(voter => 
                `<span style="display:inline-block; width:16px; height:16px; background-color:${voter.colorHex}; border:2px solid #fff; border-radius:50%; margin-left:4px; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></span>`
            ).join('');
            
            let targetColor = name === "Skip" ? "#888" : ([player, ...bots].find(c=>c.colorName === name) || {}).colorHex || '#fff';
            resultsHTML += `
                <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.6); padding:8px 15px; border-radius:8px; border-left: 5px solid ${targetColor};">
                    <span style="color:${targetColor}; font-weight:bold; font-size:16px; text-shadow: 1px 1px 2px #000;">${name} <span style="font-size:12px; color:#aaa;">(${voteLedger[name].length})</span></span>
                    <div>${voterDots}</div>
                </div>
            `;
        }
    }
    resultsHTML += '</div>';
    document.getElementById('voting-buttons').innerHTML = resultsHTML;

    addChatMsg("SYSTEM", tie || ejectedName === "Skip" ? `Votes tied. Nobody ejected.` : `${ejectedName} was ejected.`);

    setTimeout(() => {
        document.getElementById('voting-layer').style.display = 'none';
        if (ejectedName && ejectedName !== "Skip" && !tie) {
            let ejectedObj = [player, ...bots].find(p => p.colorName === ejectedName);
            if (ejectedObj) ejectedObj.isEjected = true;
        }
        [player, ...bots].forEach(c => { if (c.isDead) c.isCleanedUp = true; });
        
        killCooldown = 15; gamePaused = false; checkWinCondition(); 
    }, 6000);
}

function checkWinCondition() {
    if (gameWon) return;
    let theImpostor = [player, ...bots].find(e => e.isImpostor);
    if (theImpostor.isEjected) { triggerEnd("CREWMATES WIN", "#3498db"); return; }
    
    let aliveCrew = [player, ...bots].filter(b => !b.isDead && !b.isEjected && !b.isImpostor).length;
    let aliveImps = theImpostor.isDead || theImpostor.isEjected ? 0 : 1;
    if (aliveCrew <= aliveImps && aliveImps > 0) { triggerEnd("IMPOSTOR WINS", "#ff4747"); }
}

function triggerEnd(message, color) {
    gameWon = true;
    document.getElementById('end-text').innerText = message;
    document.getElementById('end-text').style.color = color;
    document.getElementById('end-screen').style.display = 'flex';
    setTimeout(() => location.reload(), 4000); 
}

function drawNavigationArrow() {
    let targetX = elecPanel.x + elecPanel.w / 2;
    let targetY = elecPanel.y + elecPanel.h / 2;
    let playerCenterX = player.x + drawSize / 2;
    let playerCenterY = player.y + drawSize / 2;

    let angle = Math.atan2(targetY - playerCenterY, targetX - playerCenterX);
    let arrowRadius = drawSize + 30;

    let centerX = canvas.width / 2; let centerY = canvas.height / 2;
    let screenArrowX = centerX + (Math.cos(angle) * arrowRadius);
    let screenArrowY = centerY + (Math.sin(angle) * arrowRadius);

    ctx.save();
    ctx.translate(screenArrowX, screenArrowY);
    ctx.rotate(angle); 
    ctx.fillStyle = "#ff4747"; ctx.lineWidth = 4; ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-20, -10); ctx.lineTo(-20, 10);    
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
}

// --- RENDER ENGINE ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let now = Date.now();
    if (now - lastTick >= 1000) {
        if (killCooldown > 0 && !gamePaused && !gameWon) killCooldown--;
        if (globalSabotageCooldown > 0 && !gamePaused && !gameWon) globalSabotageCooldown--;
        if (!gamePaused && !gameWon) {
            doors.forEach(d => {
                if (d.closeTimer > 0) {
                    d.closeTimer--;
                    if (d.closeTimer === 0) d.isClosed = false; 
                }
                if (d.cooldown > 0) d.cooldown--;
            });
        }
        lastTick = now;
    }

    let nearPanel = Math.hypot(player.x - (elecPanel.x + elecPanel.w/2), player.y - (elecPanel.y + elecPanel.h/2)) < 150;
    document.getElementById('use-btn').className = (lightsOut && nearPanel && !gamePaused && !player.inVent) ? 'action-btn active-use' : 'action-btn';

    if (player.isImpostor) {
        const killBtn = document.getElementById('kill-btn');
        if (killCooldown > 0) {
            killBtn.className = 'action-btn cooldown'; killBtn.innerText = killCooldown;
        } else {
            let canKill = bots.some(b => !b.isDead && !b.isEjected && !b.inVent && Math.hypot(b.x - player.x, b.y - player.y) < 90);
            killBtn.className = (canKill && !gamePaused && !lightsOut && !player.inVent) ? 'action-btn active-kill' : 'action-btn';
            killBtn.innerText = 'KILL (E)';
        }
        
        let ventBtn = document.getElementById('vent-btn');
        if (ventBtn) {
            ventBtn.style.display = 'flex';
            let nearVent = vents.some(v => Math.hypot(player.x - v.x, player.y - v.y) < 100);
            ventBtn.className = (nearVent || player.inVent) ? 'action-btn active-kill' : 'action-btn';
            ventBtn.innerText = player.inVent ? 'EXIT (V)' : 'VENT (V)';
        }
    } else {
        let ventBtn = document.getElementById('vent-btn');
        if (ventBtn) ventBtn.style.display = 'none';
    }

    let canReport = bots.some(b => b.isDead && !b.isCleanedUp && Math.hypot(player.x - b.x, player.y - b.y) < 250);
    document.getElementById('report-btn').className = (canReport && !gamePaused && !player.inVent) ? 'action-btn active-report' : 'action-btn';

    if (isSabotageMapOpen && player.isImpostor) {
        document.getElementById('sabo-lights').className = (globalSabotageCooldown > 0 || lightsOut) ? 'sabo-icon lights-icon cooldown' : 'sabo-icon lights-icon';
        doors.forEach(d => {
            let dBtn = document.getElementById('sabo-' + d.id);
            if (dBtn) {
                dBtn.className = (d.cooldown > 0 || d.isClosed) ? 'sabo-icon door-icon cooldown' : 'sabo-icon door-icon';
                dBtn.innerText = d.isClosed ? 'X' : '🚪';
            }
        });
    }

    if (!gamePaused && !gameWon && !lightsOut && !player.inVent) {
        bots.forEach(bot => {
            if (!bot.isDead && !bot.isEjected && !bot.inVent) {
                bots.filter(c => c.isDead && !c.isCleanedUp).forEach(body => {
                    if (Math.hypot(bot.x - body.x, bot.y - body.y) < 250) triggerReport(bot, body);
                });
            }
        });
    }

    ctx.save();
    let camX = canvas.width / 2 - player.x - drawSize / 2;
    let camY = canvas.height / 2 - player.y - drawSize / 2;
    ctx.translate(camX, camY);

    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    
    // --- ENVIRONMENTAL DECORATIONS ---
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.arc(250, 300, 100, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#0ff"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(250, 300, 80, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
    ctx.beginPath(); ctx.arc(250, 300, 60 + Math.sin(Date.now()/300)*5, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#222";
    ctx.fillRect(1150, 500, 250, 120); 
    ctx.fillStyle = "#4caf50"; 
    ctx.globalAlpha = 0.5 + Math.sin(Date.now()/500)*0.2;
    ctx.fillRect(1170, 520, 210, 80);
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = "#654321"; 
    ctx.fillRect(830, 1320, 90, 90);
    ctx.fillStyle = "#8B5A2B"; 
    ctx.fillRect(940, 1280, 100, 100);
    ctx.fillStyle = "#A0522D"; 
    ctx.fillRect(900, 1380, 80, 80);
    ctx.fillStyle = "#d2b48c"; 
    ctx.fillRect(830, 1360, 90, 10);
    ctx.fillRect(940, 1325, 100, 10);
    ctx.fillRect(935, 1380, 10, 80);

    ctx.fillStyle = "#ffd700";
    ctx.fillRect(850, 250, 200, 20);
    ctx.fillStyle = "#000";
    for(let i=0; i<200; i+=20) ctx.fillRect(850+i, 250, 10, 20);
    ctx.fillStyle = "#333";
    ctx.fillRect(820, 50, 60, 150);
    ctx.fillStyle = (Math.floor(Date.now()/500) % 2 === 0) ? "#f00" : "#500";
    ctx.fillRect(840, 70, 10, 10);
    ctx.fillStyle = (Math.floor(Date.now()/800) % 2 === 0) ? "#0f0" : "#050";
    ctx.fillRect(840, 100, 10, 10);

    ctx.fillStyle = "#4a4a4a";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    vents.forEach(v => {
        ctx.fillRect(v.x - 30, v.y - 30, 60, 60);
        ctx.strokeRect(v.x - 30, v.y - 30, 60, 60);
        ctx.beginPath();
        for(let i = -15; i <= 15; i += 10) {
            ctx.moveTo(v.x - 20, v.y + i);
            ctx.lineTo(v.x + 20, v.y + i);
        }
        ctx.stroke();
    });

    ctx.fillStyle = "#4a5a6a"; walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    doors.forEach(d => {
        if (d.isClosed) {
            ctx.fillStyle = "#b53a3a"; ctx.fillRect(d.x, d.y, d.w, d.h);
            ctx.strokeStyle = "#111"; ctx.lineWidth = 5; ctx.strokeRect(d.x, d.y, d.w, d.h);
            ctx.beginPath();
            if (d.w > d.h) { ctx.moveTo(d.x + d.w/2, d.y); ctx.lineTo(d.x + d.w/2, d.y + d.h) } 
            else { ctx.moveTo(d.x, d.y + d.h/2); ctx.lineTo(d.x + d.w, d.y + d.h/2); }
            ctx.stroke();
        }
    });

    ctx.fillStyle = lightsOut ? "#ff4747" : "#555"; 
    ctx.fillRect(elecPanel.x, elecPanel.y, elecPanel.w, elecPanel.h);
    ctx.fillStyle = "white"; ctx.font = "bold 20px 'Varela Round'"; ctx.textAlign = "center";
    ctx.fillText("⚡", elecPanel.x + elecPanel.w/2, elecPanel.y + elecPanel.h/2 + 7);
    if (lightsOut) {
        ctx.fillStyle = "rgba(255, 71, 71, 0.5)";
        ctx.beginPath(); ctx.arc(elecPanel.x + elecPanel.w/2, elecPanel.y - 20, 15 + Math.sin(Date.now()/200)*5, 0, Math.PI*2); ctx.fill();
    }

    let allEntities = [...bots, player];
    allEntities.forEach(e => { if (e.isDead) { e.update(); e.draw(ctx); } });
    allEntities.forEach(e => { if (!e.isDead) { e.update(); e.draw(ctx); } });

    ctx.restore();

    if (window.devVignetteEnabled && !gamePaused && !gameWon) {
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, visionRadius * 0.3, canvas.width/2, canvas.height/2, visionRadius);
        grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.98)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    if (player.inVent && !gamePaused && !gameWon) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, 80);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px 'Varela Round'";
        ctx.textAlign = "center";
        ctx.fillText("IN VENT - Press A or D to crawl, V to exit", canvas.width/2, 45);
    }

    if (lightsOut && !gamePaused && !gameWon && !player.inVent) drawNavigationArrow();

    requestAnimationFrame(gameLoop);
}

gameLoop();
