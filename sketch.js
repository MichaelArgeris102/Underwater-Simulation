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
function getSchoolCenter(){
    let fishPositionSum = createVector(0,0);

    if (fishPositions.length == 0){
        return;
    }

    for(let fish of fishPositions){
        
        fishPositionSum.add(fish.position);
        
    }
    let schoolCenter = fishPositionSum.div(fishPositions.length)
    return schoolCenter;    
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

function startGame(mode) {
    selectedMode = mode;
    console.log(selectedMode);
    gameState    = "playing";
    document.getElementById("menu-overlay").classList.add("hidden");
    if (selectedMode == 'hunter'){
        shark = new Shark (width/2, height/2,sharkLoopSheet,sharkLoopData,sharkTransSheet,sharkTransData,sharkBiteData,sharkBiteSheet )
    }
    console.log(shark);
   



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
// Draw
// ---------------------------------------------------------------------------

function draw() {
    if (gameState !== "playing") return;

    background(220);
    let schoolCenter = getSchoolCenter();
    //debugging getSchoolCenter 
    if (frameCount % 60 === 0) {
    console.log(getSchoolCenter());
}
        for (let fish of fishPositions) {
            fish.update(fishPositions);
            let info = fish.getFrameInfo();
            fish.drawFrame(info.sheet, info.data, info.frameIndex, fish.position.x, fish.position.y);
        }
    
    
    

    if(shark){
        shark.update(schoolCenter);
        let info = shark.getFrameInfo();
        shark.drawFrame(info.sheet, info.data, info.frameIndex,shark.position.x,shark.position.y);
    }

}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function keyPressed() {
    
    if (gameState !== "playing") return;

    let newDirection = null;
    if (key === 'w'|| key === 'W') newDirection = "up";
    if (key === 'a'|| key === 'A') newDirection = "left";
    if (key === 's'|| key === 'S') newDirection = "down";
    if (key === 'd'|| key === 'D') newDirection = "right";

    if (!newDirection) return;

    for (let fish of fishPositions) {
        if (newDirection !== fish.currentDirection) {
            fish.targetDirection = newDirection;
            fish.startTransition(fish.currentDirection, newDirection);
        }
    }

    if(shark !== null ){
        let resolved = shark.resolveDirection((newDirection))
        if(resolved !== shark.currentDirection || shark.isTransitioning ){
            shark.targetDirection = resolved;
            shark.startTransition (shark.currentDirection, resolved);
        }
    }

    

}