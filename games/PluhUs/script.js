const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
window.onresize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };

const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';
const deadImg = new Image();  deadImg.src = 'Death_mogus.png';
const ghostImg = new Image(); ghostImg.src = 'ghost_mongus.png';

const drawSize = 60; 
let gamePaused = false; 
let gameWon = false; 

window.globalPlayerSpeed = 5;
window.globalBotSpeed = 3.5;
window.devSeeGhosts = false;
window.devSeeGhostChat = false;

// --- DYNAMIC UI INJECTION (Tablet, Animations, Admin, Discuss) ---
const customStyles = document.createElement('style');
customStyles.innerHTML = `
    .vent-arrow { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 80px; cursor: pointer; text-shadow: 0 0 15px #000; pointer-events: auto; transition: transform 0.1s, color 0.1s; padding: 0 40px; }
    .vent-arrow:hover { color: rgba(255,255,255,1); transform: scale(1.2); }
    .vent-arrow:active { transform: scale(0.9); }
    
    #voting-content { border: 20px solid #111; border-radius: 35px; box-shadow: 0 0 50px rgba(0,0,0,0.9), inset 0 0 10px rgba(255,255,255,0.1); position: relative; }
    #voting-content::before { content: ''; position: absolute; top: -15px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; background: #333; border-radius: 50%; box-shadow: inset 0 0 2px #000; }
    
    #end-text { animation: popBounce 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    @keyframes popBounce { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    
    #discuss-popup { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 150px; font-weight: bold; font-family: 'Varela Round'; color: #ff4747; text-shadow: 0 0 30px #000, 4px 4px 0 #fff; z-index: 2000; pointer-events: none; opacity: 0; }
    .anim-discuss { animation: discussSlam 2s forwards; }
    @keyframes discussSlam { 0% { transform: translate(-50%, -50%) scale(3); opacity: 0; } 15% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 80% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } }

    #eject-screen { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 1500; align-items: center; justify-content: center; overflow: hidden; font-family: 'Varela Round'; }
    #eject-text { color: #fff; font-size: 40px; font-weight: bold; white-space: nowrap; }
    .anim-eject { animation: driftSpace 5s linear forwards; }
    @keyframes driftSpace { 0% { transform: translateX(-100vw) rotate(-20deg); } 100% { transform: translateX(100vw) rotate(360deg); } }
`;
document.head.appendChild(customStyles);

const ventUI = document.createElement('div');
ventUI.id = 'vent-ui';
ventUI.style.cssText = 'display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; justify-content: space-between; z-index: 1000; pointer-events: none;';
ventUI.innerHTML = `<button id="vent-left" class="vent-arrow">◀</button><button id="vent-right" class="vent-arrow">▶</button>`;
document.body.appendChild(ventUI);

const discussEl = document.createElement('div');
discussEl.id = 'discuss-popup';
discussEl.innerText = "DISCUSS!";
document.body.appendChild(discussEl);

const ejectScreen = document.createElement('div');
ejectScreen.id = 'eject-screen';
ejectScreen.innerHTML = `<div id="eject-text"></div>`;
document.body.appendChild(ejectScreen);

// --- ADMIN MAP INJECTION ---
const adminLayer = document.createElement('div');
adminLayer.id = 'admin-layer';
adminLayer.className = 'full-layer';
adminLayer.innerHTML = `
    <div style="position: relative; width: 800px; height: 600px; background: #111; border: 20px solid #222; border-radius: 35px; overflow: hidden; box-shadow: 0 0 50px rgba(0,0,0,0.9);">
        <button style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.8); border:2px solid #fff; color:#fff; font-family:'Varela Round'; font-weight:bold; cursor:pointer; z-index:100; padding: 5px 15px; border-radius: 5px;" onclick="closeAdmin()">X</button>
        <h3 style="color:#2ecc71; text-align:center; margin:15px 0; font-family:'Varela Round'; text-transform:uppercase; letter-spacing: 2px;">Admin Map Tracking</h3>
        <canvas id="admin-canvas" width="800" height="600" style="position: absolute; top: 0; left: 0; pointer-events: none;"></canvas>
    </div>
`;
document.body.appendChild(adminLayer);

let adminMapOpen = false;
window.openAdmin = function() {
    if (player.isDead) return;
    adminMapOpen = true;
    gamePaused = true;
    document.getElementById('admin-layer').style.display = 'flex';
}
window.closeAdmin = function() {
    adminMapOpen = false;
    gamePaused = false;
    document.getElementById('admin-layer').style.display = 'none';
}

document.getElementById('vent-left').onclick = () => window.navigateVent(-1);
document.getElementById('vent-right').onclick = () => window.navigateVent(1);

// --- DEV MENU SYSTEM ---
window.updateSpeeds = function() {
    window.globalPlayerSpeed = parseFloat(document.getElementById('p-speed').value);
    window.globalBotSpeed = parseFloat(document.getElementById('b-speed').value);
    document.getElementById('p-spd-val').innerText = window.globalPlayerSpeed;
    document.getElementById('b-spd-val').innerText = window.globalBotSpeed;
    if (player && bots.length > 0) {
        [player, ...bots].forEach(c => { if(!c.isDead) c.speed = c.isPlayer ? window.globalPlayerSpeed : window.globalBotSpeed; });
    }
};

const devMenu = document.createElement('div');
devMenu.id = 'dev-menu';
devMenu.style.cssText = 'display: none; position: absolute; top: 70px; right: 20px; background: rgba(0,0,0,0.9); border: 2px solid #0f0; color: #0f0; font-family: monospace; padding: 15px; z-index: 9999; border-radius: 5px; box-shadow: 0 0 15px rgba(0,255,0,0.3);';
devMenu.innerHTML = `
    <h3 style="margin: 0 0 10px 0; border-bottom: 1px solid #0f0; padding-bottom: 5px;">🔧 DEV MENU</h3>
    <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="dev-vignette" checked onchange="window.devVignetteEnabled = this.checked" style="accent-color: #0f0;"> Enable Vignette
    </label>
    <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top:5px;">
        <input type="checkbox" onchange="window.devSeeGhosts = this.checked" style="accent-color: #0f0;"> See Ghosts
    </label>
    <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top:5px;">
        <input type="checkbox" onchange="window.devSeeGhostChat = this.checked" style="accent-color: #0f0;"> See Ghost Chat
    </label>
    <h4 style="margin: 15px 0 5px 0; font-size: 14px; border-bottom: 1px dashed #0f0; padding-bottom: 3px;">SPEED CONTROLS</h4>
    <label style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 5px;">
        Player: <input type="range" id="p-speed" min="2" max="15" value="5" step="1" onchange="window.updateSpeeds()" style="width: 80px; margin: 0 10px;"> <span id="p-spd-val">5</span>
    </label>
    <label style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 5px;">
        Bots: <input type="range" id="b-speed" min="1" max="10" value="3.5" step="0.5" onchange="window.updateSpeeds()" style="width: 80px; margin: 0 10px;"> <span id="b-spd-val">3.5</span>
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
let meetingCooldown = 15; 
let lastTick = Date.now();
let lightsOut = false;
let visionRadius = 500; 
let isSabotageMapOpen = false;
let gaslightCounters = {};
let gaslightTarget = null;

// --- HARDCODED MAP DATA ---
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
    { x: 200, y: 250 }, { x: 950, y: 200 }, { x: 1300, y: 650 }, { x: 200, y: 1200 }   
];

const waypoints = [
    { id: 0, x: 170, y: 270, edges: [2] },         
    { id: 1, x: 170, y: 1170, edges: [2] },        
    { id: 2, x: 170, y: 670, edges: [0, 1, 4] },   
    { id: 4, x: 620, y: 670, edges: [2, 6] },  
    { id: 5, x: 970, y: 150, edges: [12] },       
    { id: 6, x: 920, y: 670, edges: [4, 7, 10, 12, 13] },  
    { id: 7, x: 1270, y: 670, edges: [6, 8, 9, 13] },  
    { id: 8, x: 1370, y: 470, edges: [7] },        
    { id: 9, x: 1370, y: 870, edges: [7] },        
    { id: 10, x: 920, y: 1070, edges: [6, 11] },   
    { id: 11, x: 970, y: 1270, edges: [10] },     
    { id: 12, x: 920, y: 350, edges: [5, 6] },
    { id: 13, x: 1000, y: 750, edges: [6, 7] } 
];

function checkCollision(nx, ny, size) {
    let padding = 5; let left = nx + padding; let right = nx + size - padding;
    let top = ny + padding; let bottom = ny + size - padding;
    for (let w of walls) { if (right > w.x && left < w.x + w.w && bottom > w.y && top < w.y + w.h) return true; }
    for (let d of doors) { if (d.isClosed && right > d.x && left < d.x + d.w && bottom > d.y && top < d.y + d.h) return true; }
    return false;
}

// --- DYNAMIC PIXEL RECOLORER ---
function getTintedSprite(img, suitHex) {
    let tCanvas = document.createElement('canvas');
    tCanvas.width = drawSize; tCanvas.height = drawSize;
    let tCtx = tCanvas.getContext('2d');
    tCtx.drawImage(img, 0, 0, drawSize, drawSize);

    try {
        const suitRgb = parseInt(suitHex.slice(1), 16);
        const rTarget = (suitRgb >> 16) & 255; const gTarget = (suitRgb >> 8) & 255; const bTarget = suitRgb & 255;
        let imgData = tCtx.getImageData(0, 0, drawSize, drawSize);
        let data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) continue; 
            let isGrayscale = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
            let isNotBlack = r > 40 || g > 40 || b > 40; 
            if (isGrayscale && isNotBlack) {
                let brightness = r / 255; 
                data[i] = rTarget * brightness; data[i+1] = gTarget * brightness; data[i+2] = bTarget * brightness;
            }
        }
        tCtx.putImageData(imgData, 0, 0);
    } catch (e) {
        let fCanvas = document.createElement('canvas');
        fCanvas.width = drawSize; fCanvas.height = drawSize;
        let fCtx = fCanvas.getContext('2d');
        fCtx.drawImage(img, 0, 0, drawSize, drawSize);
        fCtx.globalCompositeOperation = 'source-in';
        fCtx.fillStyle = suitHex;
        fCtx.fillRect(0, 0, drawSize, drawSize);
        fCtx.globalCompositeOperation = 'multiply';
        fCtx.drawImage(img, 0, 0, drawSize, drawSize);
        return fCanvas;
    }
    return tCanvas;
}

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
        let nodeId = path[path.length - 1];
        if (nodeId === endId) return path;
        
        let nodeData = waypoints.find(w => w.id === nodeId);
        if (!nodeData) continue; 

        for (let neighbor of nodeData.edges) {
            if (!visited.has(neighbor)) { visited.add(neighbor); queue.push([...path, neighbor]); }
        }
    }
    return [];
}

function tpToCafe() {
    let alive = [player, ...bots].filter(c => !c.isDead && !c.isEjected);
    let radius = 150;
    let angleStep = (Math.PI * 2) / alive.length;
    alive.forEach((c, i) => {
        c.x = 1000 + Math.cos(angleStep * i) * radius;
        c.y = 750 + Math.sin(angleStep * i) * radius;
        c.targetNode = null; c.path = []; c.inVent = false; c.isMoving = false;
    });
    
    if (!player.isDead) {
        player.x = 1000 + Math.cos(0) * radius;
        player.y = 750 + Math.sin(0) * radius;
    } else {
        player.x = 1000; player.y = 750; // Dead player in center
    }
}

// --- CREWMATE ENGINE ---
class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x; this.y = y;
        this.isPlayer = isPlayer; this.colorName = colorName;
        this.isDead = false; this.isEjected = false; this.isCleanedUp = false; 
        this.killer = null; 
        
        const colorMap = {
            'Red': '#ff0000', 'Blue': '#1e90ff', 'Green': '#32cd32', 'Yellow': '#ffd700',
            'Pink': '#ff69b4', 'Cyan': '#00ffff', 'Black': '#666666', 'Orange': '#ff8c00'
        };
        this.colorHex = colorMap[this.colorName] || '#ffffff';
        this.tintedStand = null; this.tintedWalk = null; this.tintedDead = null; this.tintedGhost = null;

        this.isImpostor = false;
        this.internalKillCooldown = 600; 
        
        this.speed = isPlayer ? window.globalPlayerSpeed : window.globalBotSpeed;
        this.path = []; this.targetNode = null; this.waitTimer = 0;
        this.goingToFixLights = false; this.finalOffsetX = 0; this.finalOffsetY = 0;
        
        this.inVent = false; this.currentVent = -1;
        this.ventTargetX = x; this.ventTargetY = y;
        this.stuckTimer = 0; 
        this.isMoving = false; this.lastDir = 'right';
        this.memory = {}; 
        this.swaySpeed = 200 + Math.random() * 200; this.swayIntensity = 0.5 + Math.random() * 0.8;
    }

    update() {
        if (this.isEjected || gamePaused || gameWon) {
            this.isMoving = false;
            return; 
        }

        if (this.isDead) {
            this.speed = (this.isPlayer ? window.globalPlayerSpeed : window.globalBotSpeed) * 1.5; 
            if (this.isPlayer) {
                let nx = this.x; let ny = this.y; let moved = false;
                if (keys['KeyW']) { ny -= this.speed; moved = true; }
                if (keys['KeyS']) { ny += this.speed; moved = true; }
                if (keys['KeyA']) { nx -= this.speed; moved = true; this.lastDir = 'left'; }
                if (keys['KeyD']) { nx += this.speed; moved = true; this.lastDir = 'right'; }
                if (moved) { this.x = nx; this.y = ny; this.isMoving = true; } else { this.isMoving = false; }
            } else {
                this.x += (Math.random() - 0.5) * this.speed; this.y += (Math.random() - 0.5) * this.speed;
                this.x = Math.max(0, Math.min(WORLD_W, this.x)); this.y = Math.max(0, Math.min(WORLD_H, this.y));
                this.isMoving = true;
            }
            return; 
        }
        
        if (this.inVent) {
            this.isMoving = false;
            let dx = this.ventTargetX - this.x; let dy = this.ventTargetY - this.y;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { this.x += dx * 0.08; this.y += dy * 0.08; } 
            else { this.x = this.ventTargetX; this.y = this.ventTargetY; }
            return;
        }

        this.isMoving = false;

        if (this.isPlayer) {
            let nx = this.x; let ny = this.y; let moved = false;
            if (keys['KeyW']) { ny -= this.speed; moved = true; }
            if (keys['KeyS']) { ny += this.speed; moved = true; }
            if (keys['KeyA']) { nx -= this.speed; moved = true; this.lastDir = 'left'; }
            if (keys['KeyD']) { nx += this.speed; moved = true; this.lastDir = 'right'; }
            if (moved) {
                if (!checkCollision(nx, ny, drawSize)) { this.x = nx; this.y = ny; this.isMoving = true; } 
                else {
                    if (!checkCollision(nx, this.y, drawSize)) { this.x = nx; this.isMoving = true; }
                    else if (!checkCollision(this.x, ny, drawSize)) { this.y = ny; this.isMoving = true; }
                }
            }
        } else {
            if (this.isImpostor) {
                if (this.internalKillCooldown > 0) this.internalKillCooldown--;
                if (this.internalKillCooldown <= 0) {
                    let aliveCrew = [player, ...bots].filter(c => !c.isDead && !c.isEjected && !c.isImpostor && !c.inVent);
                    let target = null; let minDist = Infinity;
                    aliveCrew.forEach(c => { let d = Math.hypot(c.x - this.x, c.y - this.y); if (d < minDist) { minDist = d; target = c; } });
                    
                    if (target && minDist < 200) { 
                        let witnesses = aliveCrew.filter(c => c !== target && Math.hypot(c.x - this.x, c.y - this.y) < 400);
                        if (witnesses.length === 0 || lightsOut) {
                            if (minDist < 90) {
                                target.isDead = true; target.killer = this; this.internalKillCooldown = 900; 
                                let sightRadius = lightsOut ? 150 : 400;
                                bots.forEach(w => {
                                    if (!w.isDead && !w.isEjected && !w.inVent && w !== target && w !== this) {
                                        if (Math.hypot(w.x - this.x, w.y - this.y) < sightRadius) {
                                            w.memory.sawKill = { killer: this.colorName, victim: target.colorName, time: Date.now() };
                                        }
                                    }
                                });
                                checkWinCondition(); this.targetNode = null; this.path = []; this.waitTimer = 0; return; 
                            } else {
                                let angle = Math.atan2(target.y - this.y, target.x - this.x);
                                let nx = this.x + Math.cos(angle) * this.speed; let ny = this.y + Math.sin(angle) * this.speed;
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
                this.goingToFixLights = true; let start = getClosestNode(this.x, this.y);
                let pathIds = getPath(start, 5); pathIds.shift(); this.path = pathIds;
                let targetData = waypoints.find(w => w.id === this.path[0]);
                this.targetNode = this.path.length > 0 ? targetData : waypoints.find(w => w.id === 5);
            } else if (!lightsOut) { this.goingToFixLights = false; }

            if (this.goingToFixLights && Math.hypot(this.x - waypoints.find(w=>w.id===5).x, this.y - waypoints.find(w=>w.id===5).y) < 100) {
                this.isMoving = false; if (Math.random() < 0.01) { lightsOut = false; visionRadius = 500; closeTask(); } return;
            }
            
            if (!this.isImpostor && this.waitTimer <= 0 && Math.random() < 0.003) this.waitTimer = 20 + Math.random() * 40; 
            if (this.waitTimer > 0) { this.waitTimer--; this.isMoving = false; } 
            else if (this.targetNode) {
                let isFinalNode = (this.path.length === 0);
                let targetX = this.targetNode.x + (isFinalNode ? this.finalOffsetX : 0);
                let targetY = this.targetNode.y + (isFinalNode ? this.finalOffsetY : 0);
                let dx = targetX - this.x; let dy = targetY - this.y; let dist = Math.hypot(dx, dy);

                if (dist < 10) {
                    this.path.shift(); 
                    if (this.path.length > 0) this.targetNode = waypoints.find(w=>w.id===this.path[0]); 
                    else { 
                        this.targetNode = null; this.finalOffsetX = (Math.random() - 0.5) * 60; this.finalOffsetY = (Math.random() - 0.5) * 60;
                        this.waitTimer = 100 + Math.random() * 200; 
                    }
                } else {
                    let angle = Math.atan2(dy, dx); let swayAngle = angle + (Math.PI / 2); 
                    let swayAmount = Math.sin(Date.now() / this.swaySpeed) * this.swayIntensity;
                    let nx = this.x + (Math.cos(angle) * this.speed) + (Math.cos(swayAngle) * swayAmount);
                    let ny = this.y + (Math.sin(angle) * this.speed) + (Math.sin(swayAngle) * swayAmount);
                    
                    let sepX = 0; let sepY = 0;
                    [player, ...bots].forEach(other => {
                        if (other !== this && !other.isDead && Math.hypot(this.x - other.x, this.y - other.y) < 40) {
                            sepX += (this.x - other.x) * 0.05; sepY += (this.y - other.y) * 0.05;
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
                            this.isMoving = false; this.stuckTimer++;
                            if (this.stuckTimer > 15) { this.targetNode = null; this.stuckTimer = 0; }
                        }
                    }
                }
            } else {
                let start = getClosestNode(this.x, this.y);
                let validTargets = waypoints.filter(wp => wp.id !== start && Math.hypot(wp.x - this.x, wp.y - this.y) > 500);
                let target;
                if (validTargets.length > 0) { target = validTargets[Math.floor(Math.random() * validTargets.length)].id; } 
                else { do { target = waypoints[Math.floor(Math.random() * waypoints.length)].id; } while (target === start && waypoints.length > 1); }
                let pathIds = getPath(start, target); pathIds.shift(); this.path = pathIds;
                this.targetNode = this.path.length > 0 ? waypoints.find(w=>w.id===this.path[0]) : waypoints.find(w=>w.id===target);
            }
        }
        
        if (!this.isPlayer && !lightsOut && !this.inVent) {
            [player, ...bots].forEach(other => {
                if (other !== this && !other.isDead && !other.isEjected && !other.inVent) {
                    if (Math.hypot(this.x - other.x, this.y - other.y) < 400) { this.memory[other.colorName] = Date.now(); }
                }
            });
        }
    }

    draw(ctx) {
        if (this.isEjected) return; 

        if (standImg.complete && !this.tintedStand) this.tintedStand = getTintedSprite(standImg, this.colorHex);
        if (walkImg.complete && !this.tintedWalk) this.tintedWalk = getTintedSprite(walkImg, this.colorHex);
        if (deadImg.complete && !this.tintedDead) this.tintedDead = getTintedSprite(deadImg, this.colorHex);
        if (ghostImg.complete && !this.tintedGhost) this.tintedGhost = getTintedSprite(ghostImg, this.colorHex);

        ctx.save();
        ctx.translate(this.x + drawSize/2, this.y + drawSize/2);
        
        if (this.inVent) ctx.globalAlpha = 0.4;
        
        if (this.isDead && this.isCleanedUp) {
            if (!player.isDead && !window.devSeeGhosts) { ctx.restore(); return; } 
            ctx.globalAlpha = 0.5;
            if (this.lastDir === 'left') ctx.scale(-1, 1);
            let bob = Math.sin(Date.now() / 200) * 5;
            ctx.drawImage(this.tintedGhost || ghostImg, -drawSize/2, -drawSize/2 + bob, drawSize, drawSize);
            ctx.restore();
            
            ctx.fillStyle = this.colorHex; ctx.font = "14px 'Varela Round'"; ctx.textAlign = "center";
            ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 3;
            ctx.strokeText("👻 " + this.colorName, this.x + drawSize/2, this.y - 15);
            ctx.fillText("👻 " + this.colorName, this.x + drawSize/2, this.y - 15);
            return;
        }
        
        if (this.lastDir === 'left') ctx.scale(-1, 1);
        
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
            ctx.fillStyle = this.colorHex; ctx.font = "bold 14px 'Varela Round'"; ctx.textAlign = "center";
            ctx.strokeStyle = "black"; ctx.lineWidth = 3;
            ctx.strokeText(this.colorName, this.x + drawSize/2, this.y - 5);
            ctx.fillText(this.colorName, this.x + drawSize/2, this.y - 5);
        }
    }
}

const player = new Crewmate(waypoints.find(w=>w.id===13).x, waypoints.find(w=>w.id===13).y, true, 'Red');
const bots = [
    new Crewmate(waypoints.find(w=>w.id===13).x-50, waypoints.find(w=>w.id===13).y-50, false, 'Blue'),
    new Crewmate(waypoints.find(w=>w.id===13).x+50, waypoints.find(w=>w.id===13).y-50, false, 'Green'),
    new Crewmate(waypoints.find(w=>w.id===13).x-50, waypoints.find(w=>w.id===13).y+50, false, 'Yellow'),
    new Crewmate(waypoints.find(w=>w.id===13).x+50, waypoints.find(w=>w.id===13).y+50, false, 'Pink'),
    new Crewmate(waypoints.find(w=>w.id===13).x-100, waypoints.find(w=>w.id===13).y, false, 'Cyan'),
    new Crewmate(waypoints.find(w=>w.id===13).x+100, waypoints.find(w=>w.id===13).y, false, 'Black'), 
    new Crewmate(waypoints.find(w=>w.id===13).x, waypoints.find(w=>w.id===13).y-100, false, 'Orange')
];

function assignRoles() {
    let allEntities = [player, ...bots];
    allEntities.forEach(e => e.isImpostor = false);
    if (gameMode === 'always_impostor') player.isImpostor = true;
    else allEntities[Math.floor(Math.random() * allEntities.length)].isImpostor = true;

    const taskHeader = document.querySelector('#task-list h3');
    const taskDesc = document.querySelector('#task-list p');
    
    if (player.isImpostor) {
        taskHeader.innerText = "Impostor"; taskHeader.style.color = "#ff4747"; taskDesc.innerText = "Sabotage and kill everyone.";
        document.getElementById('kill-btn').style.display = 'flex'; document.getElementById('sabotage-btn').style.display = 'flex';
    } else {
        taskHeader.innerText = "Crewmate"; taskHeader.style.color = "#3498db"; taskDesc.innerText = "Find the impostor and fix sabotages.";
        document.getElementById('kill-btn').style.display = 'none'; document.getElementById('sabotage-btn').style.display = 'none';
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
        if (globalSabotageCooldown === 0 && !lightsOut) { lightsOut = true; visionRadius = 150; globalSabotageCooldown = 30; }
    } else if (type.startsWith('door')) {
        let door = doors.find(d => d.id === type);
        if (door && door.cooldown === 0 && !door.isClosed) { door.isClosed = true; door.closeTimer = 10; door.cooldown = 20; }
    }
}

window.openLightsTask = function() {
    if (player.inVent || player.isDead) return;
    gamePaused = true; switchStates = [false, false, false, false, false];
    document.querySelectorAll('.switch').forEach(s => s.className = 'switch off');
    document.getElementById('task-layer').style.display = 'flex';
}

let switchStates = [false, false, false, false, false];
window.closeTask = function() { document.getElementById('task-layer').style.display = 'none'; gamePaused = false; }

window.toggleSwitch = function(el) {
    let index = Array.from(el.parentNode.children).indexOf(el);
    switchStates[index] = !switchStates[index]; 
    el.className = switchStates[index] ? 'switch on' : 'switch off';
    if (switchStates.every(s => s === true)) setTimeout(() => { lightsOut = false; visionRadius = 500; closeTask(); }, 500);
}

// DRAW ADMIN LIVE MAP LOOP
function drawAdminMap() {
    let aCanvas = document.getElementById('admin-canvas');
    if (!aCanvas || !adminMapOpen) return;
    let aCtx = aCanvas.getContext('2d');
    aCtx.clearRect(0, 0, aCanvas.width, aCanvas.height);
    
    let scaleX = 800 / WORLD_W; let scaleY = 600 / WORLD_H;
    
    aCtx.fillStyle = "#4a5a6a";
    walls.forEach(w => aCtx.fillRect(w.x * scaleX, w.y * scaleY, w.w * scaleX, w.h * scaleY));
    
    let alive = [player, ...bots].filter(c => !c.isDead && !c.isEjected);
    alive.forEach(c => {
        aCtx.fillStyle = "#2ecc71";
        aCtx.beginPath(); aCtx.arc(c.x * scaleX, c.y * scaleY, 6, 0, Math.PI*2); aCtx.fill();
    });
}

window.doUse = () => { 
    if(gamePaused || player.isDead || player.inVent) return;
    let nearPanel = Math.hypot(player.x - (elecPanel.x + 50), player.y - (elecPanel.y + 30)) < 150;
    let nearCafe = Math.hypot(player.x - 1000, player.y - 750) < 150;
    let nearAdmin = Math.hypot(player.x - 1275, player.y - 560) < 150;
    
    if (lightsOut && nearPanel) openLightsTask();
    else if (nearCafe && meetingCooldown <= 0) triggerReport(player, null, true);
    else if (nearAdmin) openAdmin();
};

window.doVent = () => {
    if(!player.isImpostor || lightsOut || player.isDead) return;
    if(player.inVent) { player.inVent = false; } 
    else {
        let nearest = vents.findIndex(v => Math.hypot(player.x - v.x, player.y - v.y) < 100);
        if(nearest !== -1) { 
            player.inVent = true; player.currentVent = nearest; 
            player.ventTargetX = vents[nearest].x; player.ventTargetY = vents[nearest].y;
            player.x = vents[nearest].x; player.y = vents[nearest].y;
        }
    }
};

window.navigateVent = (dir) => {
    if(!player.inVent || player.isDead) return;
    player.currentVent = (player.currentVent + dir + vents.length) % vents.length;
    player.ventTargetX = vents[player.currentVent].x; player.ventTargetY = vents[player.currentVent].y;
};

window.doKill = () => {
    if(!player.isImpostor || killCooldown > 0 || player.inVent || gamePaused || lightsOut || isSabotageMapOpen || player.isDead) return;
    for (let bot of bots) {
        if (!bot.isDead && !bot.isEjected && !bot.inVent && Math.hypot(bot.x - player.x, bot.y - player.y) < 90) { 
            bot.isDead = true; bot.killer = player; killCooldown = 20; 
            let sightRadius = lightsOut ? 150 : 400;
            bots.forEach(w => {
                if (!w.isDead && !w.isEjected && !w.inVent && w !== bot) {
                    if (Math.hypot(w.x - player.x, w.y - player.y) < sightRadius) { w.memory.sawKill = { killer: player.colorName, victim: bot.colorName, time: Date.now() }; }
                }
            });
            checkWinCondition(); break; 
        }
    }
};

window.doReport = () => {
    if(gamePaused || isSabotageMapOpen || player.isDead) return;
    let bodies = bots.filter(c => c.isDead && !c.isCleanedUp);
    for (let b of bodies) { if (Math.hypot(player.x - b.x, player.y - b.y) < 150) { triggerReport(player, b, false); break; } }
};

document.getElementById('use-btn').onclick = window.doUse;
document.getElementById('kill-btn').onclick = window.doKill;
document.getElementById('report-btn').onclick = window.doReport;
let ventBtnEl = document.getElementById('vent-btn'); if(ventBtnEl) ventBtnEl.onclick = window.doVent;

const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); 
    if (e.key && e.key.length === 1) {
        secretBuffer += e.key.toLowerCase(); if (secretBuffer.length > 6) secretBuffer = secretBuffer.slice(-6);
        if (secretBuffer === 'pluhus' || secretBuffer === 'chrome') { 
            const dm = document.getElementById('dev-menu'); dm.style.display = (dm.style.display === 'none') ? 'block' : 'none'; secretBuffer = ''; 
        }
    }
    if (gamePaused || gameWon || player.isEjected) return;

    if (e.code === 'KeyF' && player.isImpostor && !player.inVent && !player.isDead) toggleSabotageMap();
    if (player.inVent && !player.isDead) {
        if (e.code === 'KeyA') window.navigateVent(-1); if (e.code === 'KeyD') window.navigateVent(1); if (e.code === 'KeyV') window.doVent();
        return; 
    } 
    if (e.code === 'KeyV' && !player.isDead) window.doVent();
    if (e.code === 'Space') window.doUse(); // ghosts can't use but logic blocked inside
    if (e.code === 'KeyE' && !player.isDead) window.doKill();
    if (e.code === 'KeyR' && !player.isDead) window.doReport();
});

// --- CHAT & MEETING SYSTEM ---
function addChatMsg(author, text, isGhost=false) {
    if (isGhost && !player.isDead && !window.devSeeGhostChat) return;

    const box = document.getElementById('chat-box');
    let msg = document.createElement('div'); msg.className = 'chat-msg';
    
    const colorMap = {
        'Red': '#ff4747', 'Blue': '#2572ff', 'Green': '#32cd32', 'Yellow': '#ffd700',
        'Pink': '#ff69b4', 'Cyan': '#00ffff', 'Black': '#444444', 'Orange': '#ff8c00'
    };
    let hex = colorMap[author] || '#ffffff';
    if(author === "SYSTEM") hex = "#0f0";
    
    if (isGhost) {
        msg.innerHTML = `<span class="name" style="color: #777; font-weight:bold;">[X] ${author}:</span> <span style="color:#aaa;">${text}</span>`;
    } else {
        msg.innerHTML = `<span class="name" style="color: ${hex}; text-shadow: 1px 1px 2px #000;">${author}:</span> ${text}`;
    }
    box.appendChild(msg); box.scrollTop = box.scrollHeight; 
}

window.sendPlayerChat = function() {
    if (player.isEjected) return; 
    const select = document.getElementById('quick-chat-select');
    if (select.value) {
        addChatMsg(player.colorName, select.value, player.isDead);
        
        if (select.value.includes(" is sus!") && !player.isDead) {
            let targetColor = select.value.split(" ")[0];
            if (gaslightCounters[targetColor] !== undefined) {
                gaslightCounters[targetColor]++;
                if (gaslightCounters[targetColor] === 10) {
                    gaslightTarget = targetColor;
                    let aliveBots = bots.filter(b => !b.isDead && !b.isEjected && b.colorName !== targetColor);
                    aliveBots.forEach((b, index) => {
                        setTimeout(() => {
                            let phrases = [`Alright fine, voting ${targetColor}.`, `You convinced me, ${targetColor} is sus.`, `If we lose it's your fault, voting ${targetColor}.`, `Okay okay, voting ${targetColor}.`];
                            addChatMsg(b.colorName, phrases[Math.floor(Math.random() * phrases.length)]);
                        }, (index * 800) + 500);
                    });
                }
            }
        }
        select.selectedIndex = 0; 
    }
}

function triggerReport(reporter, deadBody, isEmergency = false) {
    if (gamePaused || gameWon) return; 
    if (player.inVent) player.inVent = false; 
    
    gamePaused = true; lightsOut = false; visionRadius = 500; isSabotageMapOpen = false; adminMapOpen = false;
    document.getElementById('sabotage-layer').style.display = 'none';
    document.getElementById('admin-layer').style.display = 'none';
    doors.forEach(d => d.isClosed = false); 

    let alivePlayers = [player, ...bots].filter(c => !c.isDead && !c.isEjected);
    let deadBots = bots.filter(c => c.isDead && !c.isEjected);
    
    let accusedName = "Nobody"; let mainAccuser = null;
    gaslightCounters = {}; gaslightTarget = null;
    alivePlayers.forEach(p => gaslightCounters[p.colorName] = 0);

    let dPop = document.getElementById('discuss-popup');
    dPop.className = ''; void dPop.offsetWidth; dPop.className = 'anim-discuss';

    document.getElementById('voting-title').innerText = isEmergency ? "EMERGENCY MEETING CALLED" : "DEAD BODY REPORTED";
    document.getElementById('chat-box').innerHTML = ''; document.getElementById('voting-buttons').innerHTML = ''; 
    document.getElementById('voting-layer').style.display = 'flex'; 

    const accuseGroup = document.getElementById('qc-accuse'); accuseGroup.innerHTML = '';
    alivePlayers.forEach(p => {
        if (!p.isPlayer) { let opt = document.createElement('option'); opt.value = `${p.colorName} is sus!`; opt.innerText = `${p.colorName} is sus!`; accuseGroup.appendChild(opt); }
    });

    let delay = 2000; 
    if (!isEmergency && !reporter.isPlayer) { setTimeout(() => addChatMsg(reporter.colorName, `Where? I found a body.`), delay); delay += 1000; }
    else if (isEmergency && !reporter.isPlayer) { setTimeout(() => addChatMsg(reporter.colorName, `I have information.`), delay); delay += 1000; }

    alivePlayers.forEach(b => {
        if (!b.isPlayer && b.memory.sawKill && (!isEmergency || b.memory.sawKill.time > Date.now() - 30000)) {
            accusedName = b.memory.sawKill.killer;
            if (!mainAccuser) { mainAccuser = b.colorName; setTimeout(() => { addChatMsg(b.colorName, `${accusedName} killed ${b.memory.sawKill.victim} in front of me!`); }, delay); } 
            else { setTimeout(() => { addChatMsg(b.colorName, `Yeah, I literally saw ${accusedName} kill them!`); }, delay); }
            delay += 1000;
        }
    });

    if (!mainAccuser) {
        alivePlayers.forEach(b => {
            if (!b.isPlayer && b !== reporter && Math.random() > 0.4) {
                let phrases = isEmergency ? ["Why the button?", "Who called it?", "Any sus?", "What's going on?", "skip?"] : ["Where?", "Who?", "I didn't see anything.", "skip?", "any proof?", "I was doing tasks."];
                setTimeout(() => addChatMsg(b.colorName, phrases[Math.floor(Math.random() * phrases.length)]), delay); delay += Math.random() * 800 + 400; 
            }
        });
    } else {
        alivePlayers.forEach(b => {
            if (!b.isPlayer && b.colorName !== mainAccuser && b.colorName !== accusedName && !b.memory.sawKill && Math.random() > 0.4) {
                setTimeout(() => { let phrases = [`Voting ${accusedName}.`, `If you say so, ${mainAccuser}.`, `Okay, voting ${accusedName}.`]; addChatMsg(b.colorName, phrases[Math.floor(Math.random() * phrases.length)]); }, delay); delay += 800;
            }
        });
    }

    deadBots.forEach(b => {
        if (b.killer) {
            setTimeout(() => {
                let imp = b.killer.colorName; let msgs = [`Stupid ${imp} i hate you, you killed me!`, `bro ${imp} is imp`, `why did ${imp} target me`];
                addChatMsg(b.colorName, msgs[Math.floor(Math.random()*msgs.length)], true);
            }, 3000 + Math.random() * 4000);
        }
    });

    setTimeout(() => {
        const btnContainer = document.getElementById('voting-buttons');
        alivePlayers.forEach(p => {
            let btn = document.createElement('button'); btn.className = 'vote-btn'; btn.innerText = `Vote ${p.colorName}`; btn.style.borderColor = p.colorHex;
            btn.onclick = () => { if(!player.isDead) castVote(p, accusedName, alivePlayers); }; btnContainer.appendChild(btn);
        });
        let skipBtn = document.createElement('button'); skipBtn.className = 'vote-btn skip-btn'; skipBtn.innerText = "Skip Vote";
        skipBtn.onclick = () => { if(!player.isDead) castVote(null, accusedName, alivePlayers); }; btnContainer.appendChild(skipBtn);
        
        if (player.isDead) setTimeout(() => castVote(null, accusedName, alivePlayers, true), 3000);
    }, delay);
}

function castVote(playerChoice, accusedName, alivePlayers, autoBotVote = false) {
    let voteLedger = { "Skip": [] }; alivePlayers.forEach(p => voteLedger[p.colorName] = []);

    if (!autoBotVote && !player.isDead) { let pTarget = playerChoice ? playerChoice.colorName : "Skip"; voteLedger[pTarget].push(player); }

    alivePlayers.forEach(p => {
        if (!p.isPlayer) {
            let target = "Skip";
            if (gaslightTarget && p.colorName !== gaslightTarget) { target = gaslightTarget; } 
            else if (p.memory.sawKill && p.memory.sawKill.victim === (bots.find(b => b.killer) || {}).colorName) { target = p.memory.sawKill.killer; } 
            else if (accusedName !== "Nobody" && p.colorName !== accusedName) { target = accusedName; }
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
            let voterDots = voteLedger[name].map(voter => `<span style="display:inline-block; width:16px; height:16px; background-color:${voter.colorHex}; border:2px solid #fff; border-radius:50%; margin-left:4px; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></span>`).join('');
            let targetColor = name === "Skip" ? "#888" : ([player, ...bots].find(c=>c.colorName === name) || {}).colorHex || '#fff';
            resultsHTML += `<div style="display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.6); padding:8px 15px; border-radius:8px; border-left: 5px solid ${targetColor};"><span style="color:${targetColor}; font-weight:bold; font-size:16px; text-shadow: 1px 1px 2px #000;">${name} <span style="font-size:12px; color:#aaa;">(${voteLedger[name].length})</span></span><div>${voterDots}</div></div>`;
        }
    }
    resultsHTML += '</div>'; document.getElementById('voting-buttons').innerHTML = resultsHTML;

    setTimeout(() => {
        document.getElementById('voting-layer').style.display = 'none';
        
        let isImp = false;
        if (ejectedName && ejectedName !== "Skip" && !tie) {
            let ejectedObj = [player, ...bots].find(p => p.colorName === ejectedName);
            if (ejectedObj) { ejectedObj.isEjected = true; ejectedObj.isDead = true; isImp = ejectedObj.isImpostor; }
        }
        
        let eText = document.getElementById('eject-text');
        eText.className = ''; void eText.offsetWidth; eText.className = 'anim-eject';
        if (tie || ejectedName === "Skip") eText.innerText = "No one was ejected. (Tie/Skip)";
        else eText.innerText = `${ejectedName} was ${isImp ? '' : 'not '}The Impostor.`;
        
        document.getElementById('eject-screen').style.display = 'flex';

        setTimeout(() => {
            document.getElementById('eject-screen').style.display = 'none';
            [player, ...bots].forEach(c => { if (c.isDead) c.isCleanedUp = true; });
            tpToCafe(); meetingCooldown = 15; killCooldown = 15; gamePaused = false; checkWinCondition(); 
        }, 5000);
    }, 4000);
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
    gameWon = true; let el = document.getElementById('end-text');
    el.innerText = message; el.style.color = color;
    el.className = ''; void el.offsetWidth; document.getElementById('end-screen').style.display = 'flex';
    setTimeout(() => location.reload(), 4000); 
}

function drawNavigationArrow() {
    let targetX = elecPanel.x + elecPanel.w / 2; let targetY = elecPanel.y + elecPanel.h / 2;
    let playerCenterX = player.x + drawSize / 2; let playerCenterY = player.y + drawSize / 2;
    let angle = Math.atan2(targetY - playerCenterY, targetX - playerCenterX); let arrowRadius = drawSize + 30;
    let centerX = canvas.width / 2; let centerY = canvas.height / 2;
    let screenArrowX = centerX + (Math.cos(angle) * arrowRadius); let screenArrowY = centerY + (Math.sin(angle) * arrowRadius);

    ctx.save(); ctx.translate(screenArrowX, screenArrowY); ctx.rotate(angle); 
    ctx.fillStyle = "#ff4747"; ctx.lineWidth = 4; ctx.strokeStyle = "white";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -10); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawCrate(x, y, size) {
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(x+5, y+5, size, size); ctx.fillStyle = "#8B5A2B"; ctx.fillRect(x, y, size, size);
    ctx.lineWidth = 4; ctx.strokeStyle = "#5C3A21"; ctx.strokeRect(x+2, y+2, size-4, size-4);
    ctx.beginPath(); ctx.moveTo(x+4, y+4); ctx.lineTo(x+size-4, y+size-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+size-4, y+4); ctx.lineTo(x+4, y+size-4); ctx.stroke();
    ctx.fillStyle = "#d2b48c"; ctx.fillRect(x + size/2 - 5, y, 10, size);
}

// --- RENDER ENGINE ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let now = Date.now();
    if (now - lastTick >= 1000) {
        if (killCooldown > 0 && !gamePaused && !gameWon) killCooldown--;
        if (globalSabotageCooldown > 0 && !gamePaused && !gameWon) globalSabotageCooldown--;
        if (meetingCooldown > 0 && !gamePaused && !gameWon) meetingCooldown--;
        if (!gamePaused && !gameWon) {
            doors.forEach(d => { if (d.closeTimer > 0) { d.closeTimer--; if (d.closeTimer === 0) d.isClosed = false; } if (d.cooldown > 0) d.cooldown--; });
        }
        lastTick = now;
    }

    if (adminMapOpen) drawAdminMap();

    let nearPanel = Math.hypot(player.x - (elecPanel.x + elecPanel.w/2), player.y - (elecPanel.y + elecPanel.h/2)) < 150;
    let nearCafe = Math.hypot(player.x - 1000, player.y - 750) < 150 && meetingCooldown <= 0;
    let nearAdmin = Math.hypot(player.x - 1275, player.y - 560) < 150;
    let canUse = (lightsOut && nearPanel) || nearCafe || nearAdmin;
    document.getElementById('use-btn').className = (canUse && !gamePaused && !player.inVent && !player.isDead) ? 'action-btn active-use' : 'action-btn';

    if (player.isImpostor && !player.isDead) {
        const killBtn = document.getElementById('kill-btn');
        if (killCooldown > 0) { killBtn.className = 'action-btn cooldown'; killBtn.innerText = killCooldown; } 
        else {
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
        let ventBtn = document.getElementById('vent-btn'); if (ventBtn) ventBtn.style.display = 'none';
        let killBtn = document.getElementById('kill-btn'); if (killBtn) killBtn.style.display = 'none';
    }

    let canReport = bots.some(b => b.isDead && !b.isCleanedUp && Math.hypot(player.x - b.x, player.y - b.y) < 150);
    document.getElementById('report-btn').className = (canReport && !gamePaused && !player.inVent && !player.isDead) ? 'action-btn active-report' : 'action-btn';

    if (isSabotageMapOpen && player.isImpostor) {
        document.getElementById('sabo-lights').className = (globalSabotageCooldown > 0 || lightsOut) ? 'sabo-icon lights-icon cooldown' : 'sabo-icon lights-icon';
        doors.forEach(d => {
            let dBtn = document.getElementById('sabo-' + d.id);
            if (dBtn) { dBtn.className = (d.cooldown > 0 || d.isClosed) ? 'sabo-icon door-icon cooldown' : 'sabo-icon door-icon'; dBtn.innerText = d.isClosed ? 'X' : '🚪'; }
        });
    }

    if (!gamePaused && !gameWon && !lightsOut && !player.inVent) {
        bots.forEach(bot => {
            if (!bot.isDead && !bot.isEjected && !bot.inVent) {
                bots.filter(c => c.isDead && !c.isCleanedUp).forEach(body => { if (Math.hypot(bot.x - body.x, bot.y - body.y) < 150) triggerReport(bot, body, false); });
            }
        });
    }
    
    const ventUIEl = document.getElementById('vent-ui');
    if (ventUIEl) ventUIEl.style.display = (player.inVent && !gamePaused && !gameWon && !player.isDead) ? 'flex' : 'none';

    let killLayer = document.getElementById('kill-status');
    if (killLayer) killLayer.style.opacity = player.isDead ? 1 : 0;

    ctx.save();
    let camX = canvas.width / 2 - player.x - drawSize / 2;
    let camY = canvas.height / 2 - player.y - drawSize / 2;
    ctx.translate(camX, camY);

    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    
    ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(250, 300, 130, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#334155";
    for(let i=130; i<=370; i+=25) { ctx.beginPath(); ctx.moveTo(i, 170); ctx.lineTo(i, 430); ctx.stroke(); ctx.beginPath(); ctx.moveTo(130, i-130+170); ctx.lineTo(370, i-130+170); ctx.stroke(); }
    let radGrad = ctx.createRadialGradient(250, 300, 5, 250, 300, 95);
    radGrad.addColorStop(0, "#ffffff"); radGrad.addColorStop(0.25, "#38bdf8"); radGrad.addColorStop(0.8, "rgba(2, 132, 199, 0.2)"); radGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = radGrad; ctx.beginPath(); ctx.arc(250, 300, 95, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#0284c7"; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(250, 300, 85, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#64748b"; ctx.fillRect(242, 170, 16, 45); ctx.fillRect(242, 385, 16, 45); ctx.fillRect(130, 292, 45, 16); ctx.fillRect(325, 292, 45, 16);

    ctx.fillStyle = "#1e293b"; ctx.fillRect(1130, 480, 290, 160); ctx.fillStyle = "#0f172a"; ctx.fillRect(1145, 495, 260, 130); ctx.strokeStyle = "#334155"; ctx.lineWidth = 6; ctx.strokeRect(1145, 495, 260, 130);
    let holoBase = ctx.createRadialGradient(1275, 560, 5, 1275, 560, 75); holoBase.addColorStop(0, "rgba(34, 197, 94, 0.45)"); holoBase.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = holoBase; ctx.fillRect(1150, 500, 250, 120); let t = Date.now() / 800; ctx.strokeStyle = "rgba(74, 222, 128, 0.6)"; ctx.lineWidth = 3;
    if(ctx.ellipse) { ctx.beginPath(); ctx.ellipse(1275, 560, 90 + Math.sin(t)*8, 45 + Math.sin(t)*4, 0, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(1275, 560, 45 - Math.cos(t)*6, 22 - Math.cos(t)*3, 0, 0, Math.PI*2); ctx.stroke(); }

    drawCrate(840, 1310, 75); drawCrate(930, 1280, 95); drawCrate(885, 1375, 85);

    ctx.save(); ctx.beginPath(); ctx.rect(850, 250, 200, 20); ctx.clip(); ctx.fillStyle = "#eab308"; ctx.fillRect(850, 250, 200, 20); ctx.fillStyle = "#0f172a";
    for(let i=-30; i<250; i+=35) { ctx.beginPath(); ctx.moveTo(850+i, 250); ctx.lineTo(850+i+20, 250); ctx.lineTo(850+i+5, 270); ctx.lineTo(850+i-15, 270); ctx.fill(); }
    ctx.restore(); ctx.fillStyle = "#334155"; ctx.fillRect(810, 50, 75, 165); ctx.fillStyle = "#1e293b"; ctx.fillRect(815, 55, 65, 155); ctx.fillStyle = "#020617"; ctx.fillRect(822, 65, 51, 40); ctx.fillRect(822, 115, 51, 85); 
    ctx.fillStyle = (Math.floor(Date.now()/400) % 2 === 0) ? "#ef4444" : "#7f1d1d"; ctx.beginPath(); ctx.arc(832, 75, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = (Math.floor(Date.now()/250) % 2 === 0) ? "#22c55e" : "#14532d"; ctx.beginPath(); ctx.arc(847, 75, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = (Math.floor(Date.now()/600) % 2 === 0) ? "#3b82f6" : "#1e3a8a"; ctx.beginPath(); ctx.arc(862, 75, 4, 0, Math.PI*2); ctx.fill();

    // 5. Cafeteria (Center)
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(1000, 750, 80, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#444"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(1000, 750, 80, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#ff4747"; ctx.beginPath(); ctx.arc(1000, 750, 20, 0, Math.PI*2); ctx.fill(); 

    ctx.fillStyle = "#475569"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 4;
    vents.forEach(v => { ctx.fillRect(v.x - 30, v.y - 30, 60, 60); ctx.strokeRect(v.x - 30, v.y - 30, 60, 60); ctx.beginPath(); for(let i = -15; i <= 15; i += 10) { ctx.moveTo(v.x - 21, v.y + i); ctx.lineTo(v.x + 21, v.y + i); } ctx.stroke(); });

    ctx.fillStyle = "#4a5a6a"; walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));
    doors.forEach(d => { if (d.isClosed) { ctx.fillStyle = "#b53a3a"; ctx.fillRect(d.x, d.y, d.w, d.h); ctx.strokeStyle = "#111"; ctx.lineWidth = 5; ctx.strokeRect(d.x, d.y, d.w, d.h); ctx.beginPath(); if (d.w > d.h) { ctx.moveTo(d.x + d.w/2, d.y); ctx.lineTo(d.x + d.w/2, d.y + d.h) } else { ctx.moveTo(d.x, d.y + d.h/2); ctx.lineTo(d.x + d.w, d.y + d.h/2); } ctx.stroke(); } });

    ctx.fillStyle = lightsOut ? "#ef4444" : "#475569"; ctx.fillRect(elecPanel.x, elecPanel.y, elecPanel.w, elecPanel.h);
    ctx.fillStyle = "white"; ctx.font = "bold 20px 'Varela Round'"; ctx.textAlign = "center"; ctx.fillText("⚡", elecPanel.x + elecPanel.w/2, elecPanel.y + elecPanel.h/2 + 7);
    if (lightsOut) { ctx.fillStyle = "rgba(239, 68, 68, 0.45)"; ctx.beginPath(); ctx.arc(elecPanel.x + elecPanel.w/2, elecPanel.y - 20, 15 + Math.sin(Date.now()/150)*6, 0, Math.PI*2); ctx.fill(); }

    let allEntities = [...bots, player];
    allEntities.forEach(e => { if (e.isDead && e.isCleanedUp) { e.update(); e.draw(ctx); } }); 
    allEntities.forEach(e => { if (!(e.isDead && e.isCleanedUp)) { e.update(); e.draw(ctx); } });

    ctx.restore();

    if (window.devVignetteEnabled && !gamePaused && !gameWon) {
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, visionRadius * 0.3, canvas.width/2, canvas.height/2, visionRadius);
        grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.98)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (lightsOut && !gamePaused && !gameWon && !player.inVent && !player.isDead) drawNavigationArrow();

    requestAnimationFrame(gameLoop);
}

gameLoop();
