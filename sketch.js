// ---------------------------------------------------------------------------
// Assets (loaded once, passed into creature constructors)
// ---------------------------------------------------------------------------
let loopSheet;
let loopData;
let transSheet;
let transData;
let sharkLoopSheet;
let sharkLoopData;
let sharkTransSheet;
let sharkTransData;
let sharkBiteSheet;
let sharkBiteData;
let gameState = "menu";
let selectedMode = null;
let shark = null;
let apple = null;
let score = 0;
let gameStartTime = 0;
let wanderTarget = null;
let sharkFood = null;
let sharkFoodSpawnTime = 0;
let sharkSpeedBoostEnd = 0;
let bubbles = [];
let keysHeld = {};
let keyOrder = []; // WASD press order, most-recent last

// ---------------------------------------------------------------------------
// Constants / shared lookups
// ---------------------------------------------------------------------------
const BASE_SCALE   = 7;
const SCALE        = 1.75;
const SCHOOL_SCALE = SCALE / BASE_SCALE;
const COLS         = 10;
const ROWS         = 5;

const directionVectors = {
    right: null,
    left:  null,
    up:    null,
    down:  null,
};


const loopTagNames = {
    right: "right_loop",
    up:    "up_loop",
    down:  "down_loop",
    left:  "left_loop",
};

let fishPositions = [];

// ---------------------------------------------------------------------------
// p5 lifecycle
// ---------------------------------------------------------------------------

function preload() {
    loopSheet  = loadImage("assets/fishloops.png");
    loopData   = loadJSON("assets/fishloops.json");
    transSheet = loadImage("assets/fishtransitions.png");
    transData  = loadJSON("assets/fishtransitions.json");

    sharkLoopSheet  = loadImage("assets/shark_loops.png");
    sharkTransSheet = loadImage("assets/shark_transitions.png");
    sharkBiteSheet  = loadImage("assets/shark_bite.png");
    sharkLoopData   = loadJSON("assets/shark_loops.json");
    sharkTransData  = loadJSON("assets/shark_transitions.json");
    sharkBiteData   = loadJSON("assets/shark_bite.json");
}

function setup() {
    
    createCanvas(windowWidth, windowHeight);
    noSmooth();

    directionVectors.right = createVector( 1,  0);
    directionVectors.left  = createVector(-1,  0);
    directionVectors.up    = createVector( 0, -1);
    directionVectors.down  = createVector( 0,  1);
    directionVectors.mirrored_up   = createVector(0, -1);  
    directionVectors.mirrored_down = createVector(0,  1);  

    spawnFish();
}
function getSchoolCenter() {
    if (fishPositions.length === 0) return createVector(width / 2, height / 2);
    let sum = createVector(0, 0);
    for (let fish of fishPositions) sum.add(fish.position);
    return sum.div(fishPositions.length);
}

function windowResized() {
    let oldCX = width  / 2;
    let oldCY = height / 2;

    resizeCanvas(windowWidth, windowHeight);

    let dx = width  / 2 - oldCX;
    let dy = height / 2 - oldCY;

    for (let fish of fishPositions) {
        fish.position.x += dx;
        fish.position.y += dy;
    }
}

// ---------------------------------------------------------------------------
// Menu to game transition
// ---------------------------------------------------------------------------

// Replace your existing startGame function in sketch.js:
function startGame(mode) {
    selectedMode = mode;
    gameState    = "playing";
    document.getElementById("menu-overlay").classList.add("hidden");
    document.getElementById("gameover-overlay").classList.add("hidden");

    spawnFish();

    shark = new Shark(
        width/2, height/2,
        sharkLoopSheet, sharkLoopData,
        sharkTransSheet, sharkTransData,
        sharkBiteSheet, sharkBiteData
    );

    score             = 0;
    gameStartTime     = millis();
    sharkSpeedBoostEnd = 0;
    spawnApple();
    spawnSharkFood();
}

// ---------------------------------------------------------------------------
// Fish spawning
// ---------------------------------------------------------------------------

function spawnFish() {
    fishPositions = [];

    let spawnCenter    = createVector(width / 2, height / 2);
    let total          = COLS * ROWS;
    const SPAWN_RADIUS = 340 * SCHOOL_SCALE;

    for (let i = 0; i < total; i++) {
        let bias    = random(0.88, 1.12);

        // Uniform fill of a circle via rejection sampling
        let px, py;
        do {
            px = random(-SPAWN_RADIUS, SPAWN_RADIUS);
            py = random(-SPAWN_RADIUS, SPAWN_RADIUS);
        } while (px * px + py * py > SPAWN_RADIUS * SPAWN_RADIUS);

        let perpSeed  = py / SPAWN_RADIUS;
        let perpSpeed = perpSeed * 3.0;

        let fish = new Fish(
            spawnCenter.x + px,
            spawnCenter.y + py,
            loopSheet, loopData,
            transSheet, transData,
            bias,
            random(1000),
            i
        );

        fish.vel = createVector(
            directionVectors.right.x * random(2, 4) * bias,
            perpSpeed
        );

        fishPositions.push(fish);
    }
}

// ---------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------

function updateBubbles() {
    if (random() < 0.04) {
        bubbles.push({
            x:     random(width),
            y:     height + 10,
            r:     random(3, 10),
            speed: random(0.6, 1.8),
            drift: random(-0.3, 0.3),
        });
    }

    noFill();
    strokeWeight(1);
    for (let i = bubbles.length - 1; i >= 0; i--) {
        let b = bubbles[i];
        b.y -= b.speed;
        b.x += b.drift;
        let alpha = map(b.y, 0, height, 0, 180);
        stroke(150, 200, 255, alpha);
        circle(b.x, b.y, b.r * 2);
        if (b.y < -b.r) bubbles.splice(i, 1);
    }
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

const APPLE_RADIUS = 14;

function spawnApple() {
    let margin = min(width, height) * 0.18;
    apple = {
        x: random(margin, width  - margin),
        y: random(margin, height - margin),
    };
}

function drawApple() {
    if (!apple) return;
    textAlign(CENTER, CENTER);
    textSize(28);
    text('🍎', apple.x, apple.y);
}

function checkAppleCollision() {
    if (!apple) return;
    for (let fish of fishPositions) {
        let c = fish.getBodyCenter();
        let dx = c.x - apple.x;
        let dy = c.y - apple.y;
        if (dx * dx + dy * dy < (fish.getHitRadius() + APPLE_RADIUS) ** 2) {
            score++;
            if (score >= 50) { triggerFishWin(); return; }
            spawnApple();
            return;
        }
    }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function drawHUD() {
    let elapsed = (millis() - gameStartTime) / 1000;
    let m = floor(elapsed / 60);
    let s = floor(elapsed % 60);
    let timeStr = m + ':' + nf(s, 2);

    noStroke();
    textFont('Courier New');
    textSize(15);
    textAlign(RIGHT, TOP);
    fill(180, 220, 255, 220);
    text('SCORE  ' + score,   width - 22, 22);
    text('TIME   ' + timeStr, width - 22, 42);
}

// ---------------------------------------------------------------------------
// Shark food (kryptonite — 2× speed for 2 s)
// ---------------------------------------------------------------------------

function spawnSharkFood() {
    let margin = min(width, height) * 0.18;
    sharkFood = {
        x: random(margin, width - margin),
        y: random(margin, height - margin),
    };
    sharkFoodSpawnTime = millis();
}

function drawSharkFood() {
    if (!sharkFood) return;
    textAlign(CENTER, CENTER);
    textSize(28);
    text('💚', sharkFood.x, sharkFood.y);
}

function checkSharkFoodCollision() {
    if (!sharkFood || !shark) return;
    if (millis() - sharkFoodSpawnTime > 10000) { spawnSharkFood(); return; }
    let dx = shark.position.x - sharkFood.x;
    let dy = shark.position.y - sharkFood.y;
    if (dx * dx + dy * dy < 30 * 30) {
        sharkSpeedBoostEnd = millis() + 4000;
        spawnSharkFood();
    }
}

// ---------------------------------------------------------------------------
// Prey-mode auto-bite
// ---------------------------------------------------------------------------

// Triggers startBite() when a fish's hitbox overlaps (or is predicted to
// overlap in LOOKAHEAD frames) with the shark's mouth hitbox.
// The scan radius is BITE_RADIUS + fishRadius + 15px — just far enough to
// catch fast fish before they slip past the mouth.
function checkPreyAutoBite() {
    if (!shark || shark.isBiting || shark.isTransitioning) return;
    if (gameState !== 'playing') return;

    const LOOKAHEAD = 60; // frames (~1 s at 60 fps)

    let mouthPos    = shark.getMouthPosition();
    let mouthRadius = shark.getMouthRadius();

    for (let fish of fishPositions) {
        let fishCenter = fish.getBodyCenter();
        let fishRadius = fish.getHitRadius();
        let combined   = mouthRadius + fishRadius;
        let scanR      = combined + 15;

        let dx   = fishCenter.x - mouthPos.x;
        let dy   = fishCenter.y - mouthPos.y;
        let distSq = dx * dx + dy * dy;

        if (distSq > scanR * scanR) continue;

        // Already inside bite hitbox — bite now
        if (distSq <= combined * combined) {
            shark.startBite();
            return;
        }

        // Inside scan radius but not yet touching — check predicted position
        let futureCX = fishCenter.x + fish.vel.x * LOOKAHEAD;
        let futureCY = fishCenter.y + fish.vel.y * LOOKAHEAD;
        let fdx = futureCX - mouthPos.x;
        let fdy = futureCY - mouthPos.y;
        if (fdx * fdx + fdy * fdy <= combined * combined) {
            shark.startBite();
            return;
        }
    }
}

// ---------------------------------------------------------------------------
// Bite collisions
// ---------------------------------------------------------------------------

// Erases any fish caught inside the shark's mouth while the bite hitbox is
// active. Runs the same way in both modes — hunter (player bites) and prey
// (shark auto-bites, once that's wired up) — since it only cares about
// isBiteHitboxActive(), not who's controlling the shark.
function checkBiteCollisions() {
    if (!shark || !shark.isBiteHitboxActive()) return;

    let mouthPos    = shark.getMouthPosition();
    let mouthRadius = shark.getMouthRadius();
    let before      = fishPositions.length;

    fishPositions = fishPositions.filter(fish => {
        let fishCenter = fish.getBodyCenter();
        let fishRadius = fish.getHitRadius();
        let distance   = p5.Vector.dist(mouthPos, fishCenter);
        return distance > (mouthRadius + fishRadius);
    });

    let eaten = before - fishPositions.length;
    if (eaten > 0) {
        shark.drawScale += 0.12 * eaten;
        if (fishPositions.length === 0) triggerGameOver();
    }
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

function showEndScreen(title) {
    gameState = "gameover";
    let elapsed = (millis() - gameStartTime) / 1000;
    let m = floor(elapsed / 60);
    let s = floor(elapsed % 60);
    document.getElementById('go-title').textContent = title;
    document.getElementById('go-score').textContent = 'SCORE  ' + score;
    document.getElementById('go-time').textContent  = 'TIME   ' + m + ':' + nf(s, 2);
    document.getElementById('gameover-overlay').classList.remove('hidden');
}

function triggerGameOver() { showEndScreen('SHARK WINS'); }
function triggerFishWin()  { showEndScreen('FISH WIN');  }

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

function draw() {
    if (gameState === "menu") return;

    background(8, 28, 58);
    updateBubbles();
    let schoolCenter = getSchoolCenter();

    if (gameState === "playing") {
        for (let fish of fishPositions) {
            fish.update(fishPositions);
            let info = fish.getFrameInfo();
            fish.drawFrame(info.sheet, info.data, info.frameIndex, fish.position.x, fish.position.y);
        }
    }


    if (shark) {
        shark.update(schoolCenter);
        let info = shark.getFrameInfo();
        if (millis() < sharkSpeedBoostEnd) {
            let pulse = (sin(frameCount * 0.25) + 1) / 2;
            drawingContext.filter = `saturate(${lerp(100, 600, pulse)}%)`;
        }
        shark.drawFrame(info.sheet, info.data, info.frameIndex, shark.position.x, shark.position.y);
        drawingContext.filter = 'none';
    }

    if (gameState === "playing") {
        drawApple();
        checkAppleCollision();
        drawSharkFood();
        checkSharkFoodCollision();
        checkPreyAutoBite();
        checkBiteCollisions();
        drawHUD();
    }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function keyPressed() {
    if (gameState !== "playing") return;

    if (key === ' ') {
        if (shark !== null && selectedMode === "hunter") shark.startBite();
        return;
    }

    let k = key.toLowerCase();
    if ('wasd'.includes(k)) {
        keysHeld[k] = true;
        keyOrder = keyOrder.filter(x => x !== k);
        keyOrder.push(k);
    }

    // Prey mode: WASD steers the fish school
    if (selectedMode === "prey") {
        let newDirection = { w:'up', a:'left', s:'down', d:'right' }[k];
        if (newDirection) {
            for (let fish of fishPositions) {
                if (newDirection !== fish.currentDirection) {
                    fish.targetDirection = newDirection;
                    fish.startTransition(fish.currentDirection, newDirection);
                }
            }
        }
    }
    // Hunter mode: movement is handled per-frame in Shark.update() from keysHeld
}

function keyReleased() {
    let k = key.toLowerCase();
    keysHeld[k] = false;
    keyOrder = keyOrder.filter(x => x !== k);
}