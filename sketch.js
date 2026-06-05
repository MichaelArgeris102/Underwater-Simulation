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

// ---------------------------------------------------------------------------
// Constants / shared lookups
// ---------------------------------------------------------------------------
const SCALE = 7;
const COLS  = 10;
const ROWS  = 5;

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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
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

    spawnFish();
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
// Menu → game transition
// ---------------------------------------------------------------------------

function startGame(mode) {
    selectedMode = mode;
    gameState    = "playing";
    document.getElementById("menu-overlay").classList.add("hidden");
}

// ---------------------------------------------------------------------------
// Fish spawning
// ---------------------------------------------------------------------------

function spawnFish() {
    fishPositions = [];

    let spawnCenter    = createVector(width / 2, height / 2);
    let total          = COLS * ROWS;
    const SPAWN_RADIUS = 420;

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
// Draw
// ---------------------------------------------------------------------------

function draw() {
    if (gameState !== "playing") return;

    background(220);

    for (let fish of fishPositions) {
        fish.update(fishPositions);
        let info = fish.getFrameInfo();
        fish.drawFrame(info.sheet, info.data, info.frameIndex, fish.position.x, fish.position.y);
    }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function keyPressed() {
    if (gameState !== "playing") return;

    let newDirection = null;
    if (key === 'w') newDirection = "up";
    if (key === 'a') newDirection = "left";
    if (key === 's') newDirection = "down";
    if (key === 'd') newDirection = "right";

    if (!newDirection) return;

    for (let fish of fishPositions) {
        if (newDirection !== fish.currentDirection) {
            fish.targetDirection = newDirection;
            fish.startTransition(fish.currentDirection, newDirection);
        }
    }
}