const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load your specific sprites
const standImg = new Image(); standImg.src = 'Stand_mogus.png';
const walkImg = new Image();  walkImg.src = 'walk_mogus_1.png';

// Define entities with a state
const player = { x: 400, y: 300, isMoving: false };
const bots = [
    { x: 100, y: 100, isMoving: true, vx: 1, vy: 1 },
    { x: 600, y: 400, isMoving: true, vx: -1, vy: 2 }
];

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all characters
    [player, ...bots].forEach(entity => {
        const sprite = entity.isMoving ? walkImg : standImg;
        ctx.drawImage(sprite, entity.x, entity.y, 50, 50);
    });

    // Simple movement update
    bots.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        // Bounce
        if(b.x < 0 || b.x > 750) b.vx *= -1;
        if(b.y < 0 || b.y > 550) b.vy *= -1;
    });

    requestAnimationFrame(draw);
}

// Start only when images are ready
let loadedImages = 0;
const checkLoad = () => { if(++loadedImages === 2) draw(); };
standImg.onload = checkLoad;
walkImg.onload = checkLoad;
