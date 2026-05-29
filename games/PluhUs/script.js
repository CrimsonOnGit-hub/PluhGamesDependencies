const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = { x: 400, y: 300, color: '#e74c3c', name: 'Red' };
const bots = [
    { x: 100, y: 100, color: '#2ecc71', name: 'Green', memory: [] },
    { x: 600, y: 400, color: '#3498db', name: 'Blue', memory: [] }
];
let bodies = [];

const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

function reportBodies() {
    bodies.forEach(body => {
        bots.forEach(bot => {
            let dist = Math.hypot(bot.x - body.x, bot.y - body.y);
            if (dist < 150) {
                const thought = bot.memory.includes('Red') 
                    ? "I saw Red near the body earlier... Red is SUS!" 
                    : "I found a body, but I didn't see who did it.";
                alert(`${bot.name} reports: "${thought}"`);
                bodies = []; 
            }
        });
    });
}

function update() {
    if(keys['KeyW']) player.y -= 5;
    if(keys['KeyS']) player.y += 5;
    if(keys['KeyA']) player.x -= 5;
    if(keys['KeyD']) player.x += 5;
    if(keys['KeyE']) bodies.push({x: player.x, y: player.y});
    if(keys['KeyR']) reportBodies();

    bots.forEach(bot => {
        bot.x += (Math.random() - 0.5) * 4;
        bot.y += (Math.random() - 0.5) * 4;
        
        // AI Memory: If bot gets within 150 pixels of player, "remember" them
        if(Math.hypot(bot.x - player.x, bot.y - player.y) < 150) {
            if(!bot.memory.includes('Red')) bot.memory.push('Red');
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, 800, 600);
    
    // Draw Bodies
    ctx.fillStyle = '#7f8c8d';
    bodies.forEach(b => ctx.fillRect(b.x, b.y, 30, 30));

    // Draw Bots
    bots.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, 30, 30);
    });

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, 30, 30);

    update();
    requestAnimationFrame(draw);
}

draw();
