const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const spriteSheet = new Image();
spriteSheet.src = 'crew_spritesheet.png';

// Configuration: Adjust these to match your specific image grid
const frameWidth = 64;  // Width of one character frame
const frameHeight = 64; // Height of one character frame
let frameIndex = 0;     // Current animation frame

// Map your animations to grid coordinates (X, Y)
const animations = {
    stand: { x: 0, y: 0 },
    walk:  { x: 1, y: 0 } 
};

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get current animation coordinates
    const anim = animations.stand;

    // Draw the specific frame
    ctx.drawImage(
        spriteSheet,
        anim.x * frameWidth, anim.y * frameHeight, // Source X, Y (where to cut)
        frameWidth, frameHeight,                   // Width/Height to cut
        400, 300,                                  // Dest X, Y (where to draw)
        frameWidth, frameHeight                    // Size on screen
    );

    requestAnimationFrame(draw);
}

spriteSheet.onload = () => draw();
