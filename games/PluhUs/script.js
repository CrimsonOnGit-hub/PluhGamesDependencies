const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';
const deadImg = new Image();  deadImg.src = 'Death_mogus.png';

const drawSize = 60; 
let gamePaused = false; 
let gameWon = false; 

class Crewmate {
    constructor(x, y, isPlayer, colorName) {
        this.x = x;
        this.y = y;
        this.isPlayer = isPlayer;
        this.colorName = colorName;
        
        this.isDead = false;
        this.isEjected = false;
        this.isCleanedUp = false; 
        
        this.vx = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        this.vy = isPlayer ? 0 : (Math.random() > 0.5 ? 2 : -2);
        
        this.isMoving = false;
        this.animTimer = 0;
        this.showWalkFrame = false;
    }

    update() {
        if (this.isDead || this.isEjected || gamePaused || gameWon) return; 

        this.isMoving = false;

        if (this.isPlayer) {
            if (keys['KeyW']) { this.y -= 4; this.isMoving = true; }
            if (keys['KeyS']) { this.y += 4; this.isMoving = true; }
            if (keys['KeyA']) { this.x -= 4; this.isMoving = true; }
            if (keys['KeyD']) { this.x += 4; this.isMoving = true; }
        } else {
            this.x += this.vx;
            this.y += this.vy;
            this.isMoving = true; 
            
            if (this.x < 0 || this.x > canvas.width - drawSize) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height - drawSize) this.vy *= -1;
        }

        if (this.isMoving) {
            this.animTimer++;
            if (this.animTimer > 10) {
                this.showWalkFrame = !this.showWalkFrame;
                this.animTimer = 0;
            }
        } else {
            this.showWalkFrame = false;
        }
    }

    draw(ctx) {
        if (this.isEjected) return; 

        if (this.isDead) {
            if (!this.isCleanedUp) ctx.drawImage(deadImg, this.x, this.y, drawSize, drawSize);
        } else {
            const currentImg = this.showWalkFrame ? walkImg : standImg;
            ctx.drawImage(currentImg, this.x, this.y, drawSize, drawSize);
        }
    }
}

const player = new Crewmate(400, 300, true, 'Red');
const bots = [
    new Crewmate(100, 100, false, 'Blue'),
    new Crewmate(600, 100, false, 'Green'),
    new Crewmate(100, 400, false, 'Yellow'),
    new Crewmate(600, 400, false, 'Pink')
];

function resetMatch() {
    gameWon = false;
    gamePaused = false;
    
    player.x = 400; player.y = 300; player.isDead = false;
    bots.forEach(bot => {
        bot.isDead = false; bot.isEjected = false; bot.isCleanedUp = false;
        bot.x = Math.random() * (canvas.width - drawSize);
        bot.y = Math.random() * (canvas.height - drawSize);
    });

    document.getElementById('ui-layer').innerText = "PluhUs Engine | WASD to Move | E to Kill | R to Report";
}

// -----------------------------------------
// NEW VOTING & CLOSEST SUSPECT LOGIC
// -----------------------------------------
function triggerReport(reporter, deadBody) {
    if (gamePaused || gameWon) return; 
    gamePaused = true;

    let allEntities = [player, ...bots];
    let alivePlayers = allEntities.filter(c => !c.isDead && !c.isEjected);

    // Find who was closest to the body (excluding the dead body itself)
    let suspect = null;
    let minDistance = Infinity;

    alivePlayers.forEach(p => {
        let dist = Math.hypot(p.x - deadBody.x, p.y - deadBody.y);
        if (dist < minDistance) {
            minDistance = dist;
            suspect = p;
        }
    });

    // Populate the HTML Voting UI
    const votingLayer = document.getElementById('voting-layer');
    const title = document.getElementById('voting-title');
    const btnContainer = document.getElementById('voting-buttons');

    btnContainer.innerHTML = ''; // Clear old buttons

    title.innerText = `${reporter.colorName} found a body!\n"I saw ${suspect.colorName} go with ${deadBody.colorName} and now ${deadBody.colorName} is dead, and ${suspect.colorName} is running! ${suspect.colorName} is sus!"`;

    // Create a button for every alive player
    alivePlayers.forEach(p => {
        let btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = `Vote ${p.colorName}`;
        // Set button color to match the player color roughly
        btn.style.borderColor = p.colorName.toLowerCase();
        
        btn.onclick = () => castVote(p, suspect, alivePlayers);
        btnContainer.appendChild(btn);
    });

    // Skip button
    let skipBtn = document.createElement('button');
    skipBtn.className = 'vote-btn skip-btn';
    skipBtn.innerText = "Skip Vote";
    skipBtn.onclick = () => castVote(null, suspect, alivePlayers);
    btnContainer.appendChild(skipBtn);

    votingLayer.style.display = 'flex'; // Show menu
}

function castVote(playerChoice, suspect, alivePlayers) {
    let votes = { "Skip": 0 };
    alivePlayers.forEach(p => votes[p.colorName] = 0);

    // 1. Tally Player Vote
    if (playerChoice) votes[playerChoice.colorName]++;
    else votes["Skip"]++;

    // 2. Tally Bot Votes (Bots will blindly vote for whoever was accused as 'suspect')
    alivePlayers.forEach(p => {
        if (!p.isPlayer) {
            votes[suspect.colorName]++;
        }
    });

    // 3. Find the loser
    let highestVotes = -1;
    let ejectedName = null;
    let tie = false;

    for (let name in votes) {
        if (votes[name] > highestVotes) {
            highestVotes = votes[name];
            ejectedName = name;
            tie = false;
        } else if (votes[name] === highestVotes) {
            tie = true;
        }
    }

    const title = document.getElementById('voting-title');
    document.getElementById('voting-buttons').innerHTML = ''; // Hide buttons

    if (tie || ejectedName === "Skip") {
        title.innerText = `Votes tied or skipped. Nobody was ejected.`;
        ejectedName = null;
    } else {
        title.innerText = `${ejectedName} was ejected with ${highestVotes} votes.`;
    }

    // Wait 3 seconds, then resume game
    setTimeout(() => {
        document.getElementById('voting-layer').style.display = 'none';

        if (ejectedName) {
            let ejectedObj = [player, ...bots].find(p => p.colorName === ejectedName);
            if (ejectedObj) ejectedObj.isEjected = true;
        }

        [player, ...bots].forEach(c => { if (c.isDead) c.isCleanedUp = true; });
        gamePaused = false; 
        document.getElementById('ui-layer').innerText = "PluhUs Engine | WASD to Move | E to Kill | R to Report";
        
        checkWinCondition(); 
    }, 3000);
}

function checkWinCondition() {
    if (gameWon) return;
    let aliveCount = bots.filter(b => !b.isDead && !b.isEjected).length + (player.isDead || player.isEjected ? 0 : 1);
    if (aliveCount <= 2) {
        gameWon = true;
        document.getElementById('ui-layer').innerText = "MATCH OVER! Restarting in 3 seconds...";
        setTimeout(resetMatch, 3000);
    }
}

const keys = {};
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (gamePaused || gameWon || player.isDead) return; 

    if (e.code === 'KeyE') {
        for (let bot of bots) {
            if (!bot.isDead && !bot.isEjected) {
                let dist = Math.hypot(bot.x - player.x, bot.y - player.y);
                if (dist < 80) { 
                    bot.isDead = true;
                    document.getElementById('ui-layer').innerText = `You killed ${bot.colorName}!`;
                    checkWinCondition(); 
                    if (!gameWon) {
                        setTimeout(() => {
                            if (!gamePaused && !gameWon) document.getElementById('ui-layer').innerText = "PluhUs Engine | WASD to Move | E to Kill | R to Report";
                        }, 1500);
                    }
                    break; 
                }
            }
        }
    }

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

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!gamePaused && !gameWon) {
        bots.forEach(bot => {
            if (!bot.isDead && !bot.isEjected) {
                let allBodies = [player, ...bots].filter(c => c.isDead && !c.isCleanedUp);
                allBodies.forEach(body => {
                    let dist = Math.hypot(bot.x - body.x, bot.y - body.y);
                    if (dist < 60) { 
                        triggerReport(bot, body);
                    }
                });
            }
        });
    }

    let allEntities = [...bots, player];
    allEntities.forEach(entity => { if (entity.isDead) { entity.update(); entity.draw(ctx); } });
    allEntities.forEach(entity => { if (!entity.isDead) { entity.update(); entity.draw(ctx); } });

    requestAnimationFrame(gameLoop);
}

gameLoop();
