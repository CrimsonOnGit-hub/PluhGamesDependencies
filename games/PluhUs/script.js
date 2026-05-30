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
        
        ctx.save();
        ctx.translate(this.x + drawSize/2, this.y + drawSize/2);
        
        if (this.inVent) ctx.globalAlpha = 0.4;
        
        if (this.lastDir === 'left') ctx.scale(-1, 1);
        
        if (this.isDead && !this.isCleanedUp) {
            ctx.drawImage(deadImg, -drawSize/2, -drawSize/2, drawSize, drawSize);
        } else if (this.isMoving) {
            let bob = Math.sin(Date.now() / 100) * 4;
            ctx.rotate(Math.sin(Date.now() / 100) * 0.1);
            ctx.drawImage(walkImg, -drawSize/2, -drawSize/2 + bob, drawSize, drawSize);
        } else {
            ctx.drawImage(standImg, -drawSize/2, -drawSize/2, drawSize, drawSize);
        }

        ctx.restore();

        if (!this.inVent || this.isPlayer) {
            ctx.fillStyle = (this.isImpostor && player.isImpostor) ? "#ff4747" : "white";
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
    msg.innerHTML = `<span class="name" style="color: ${author.toLowerCase()}">${author}:</span> ${text}`;
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
