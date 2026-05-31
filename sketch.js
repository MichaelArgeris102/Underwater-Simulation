let loopSheet;
let loopData;

let transSheet;
let transData;

const SCALE = 7;
const COLS = 10;
const ROWS = 5;

let currentDirection = "right";
let targetDirection = "right";

let currentTag = null;
let isTransitioning = false;
let transitionStartFrame = 0;

let fishPositions = [];

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

function getTransitionTagName(from, to) {
  const toName = {
    right: { up: "up", down: "down", left: "left", right: null },
    up:    { right: "right", down: "down", left: "left", up: null },
    down:  { right: "right", up: "up", left: "left", down: null },
    left:  { up: "mirrored_up", down: "mirrored_down", right: "right", left: null },
  };
  const resolvedTo = toName[from][to];
  if (!resolvedTo) return null;
  return from + "_to_" + resolvedTo;
}

function preload() {
  loopSheet = loadImage("assets/fishloops.png");
  loopData  = loadJSON("assets/fishloops.json");
  transSheet = loadImage("assets/fishtransitions.png");
  transData  = loadJSON("assets/fishtransitions.json");
}

function setup() {
  createCanvas(5200, 1440);
  noSmooth();

  directionVectors.right = createVector(1, 0);
  directionVectors.left  = createVector(-1, 0);
  directionVectors.up    = createVector(0, -1);
  directionVectors.down  = createVector(0, 1);

  fishPositions = [];
  let spawnCenter = createVector(width / 2, height / 2);
  let total = COLS * ROWS;

  // Radius sized so average inter-fish spacing (~90px) is already at
  // the natural equilibrium the boid rules settle into. At r=420 with
  // 50 fish the mean gap is ~95px — just above minDistance — so no
  // collapse happens on frame 1 and the school looks circular immediately.
  let radius = 420;

  for (let i = 0; i < total; i++) {
    let dir = directionVectors[currentDirection];
    let bias = random(0.88, 1.12);
    let isHoriz = (currentDirection === "left" || currentDirection === "right");

    // Uniform fill of a circle via rejection sampling.
    let px, py;
    do {
      px = random(-radius, radius);
      py = random(-radius, radius);
    } while (px * px + py * py > radius * radius);

    // Perpendicular velocity seeded from the fish's position in the
    // circle — fish at the outer edge of the perp axis get the most
    // outward velocity so the circle actively holds its shape rather
    // than immediately collapsing inward.
    let perpSeed = isHoriz ? py / radius : px / radius;
    let perpSpeed = perpSeed * 3.0;

    fishPositions.push({
      position: p5.Vector.add(spawnCenter, createVector(px, py)),
      vel: createVector(
        dir.x * random(2, 4) * bias + (isHoriz ? 0 : perpSpeed),
        dir.y * random(2, 4) * bias + (isHoriz ? perpSpeed : 0)
      ),
      bias:       bias,
      noisePhase: random(1000),
      id: i
    });
  }
}

function draw() {
  background(220);

  let info = getFrameInfo();

  let isHorizontal = (currentDirection === "left" || currentDirection === "right");

  let minDistance = isHorizontal ? 78 : 80;
  let visualRange = isHorizontal ? 320 : 290;

  let globalCenter = createVector(width / 2, height / 2);
  let desired = directionVectors[currentDirection];

  for (let fish of fishPositions) {

    if (isTransitioning) {
      drawFrame(info.sheet, info.data, info.frameIndex, fish.position.x, fish.position.y);
      continue;
    }

    let centerX = 0, centerY = 0;
    let avgDX = 0, avgDY = 0;
    let moveX = 0, moveY = 0;
    let numNeighbors = 0;

    for (let other of fishPositions) {
      if (other === fish) continue;

      let d = p5.Vector.dist(fish.position, other.position);

      if (d < visualRange) {
        centerX += other.position.x;
        centerY += other.position.y;
        avgDX += other.vel.x;
        avgDY += other.vel.y;
        numNeighbors++;
      }

      if (d < minDistance) {
        moveX += fish.position.x - other.position.x;
        moveY += fish.position.y - other.position.y;
      }
    }

    // Cohesion
    let cohesionStrength = isHorizontal ? 0.0015 : 0.003;
    if (numNeighbors > 0) {
      centerX /= numNeighbors;
      centerY /= numNeighbors;
      fish.vel.x += (centerX - fish.position.x) * cohesionStrength;
      fish.vel.y += (centerY - fish.position.y) * cohesionStrength;
    }

    // Global cohesion
    fish.vel.x += (globalCenter.x - fish.position.x) * 0.00008;
    fish.vel.y += (globalCenter.y - fish.position.y) * 0.00008;

    // Separation — project out any backward component so separation
    // can only push fish sideways/diagonally, never reverse their heading.
    let sepStrength = isHorizontal ? 0.048 : 0.065;
    let sepX = moveX * sepStrength;
    let sepY = moveY * sepStrength;

    let dot = sepX * desired.x + sepY * desired.y;
    if (dot < 0) {
      sepX -= dot * desired.x;
      sepY -= dot * desired.y;
    }

    fish.vel.x += sepX;
    fish.vel.y += sepY;

    // Alignment
    if (numNeighbors > 0) {
      avgDX /= numNeighbors;
      avgDY /= numNeighbors;
      let alignStrength = isHorizontal ? 0.028 : 0.05;
      fish.vel.x += (avgDX - fish.vel.x) * alignStrength;
      fish.vel.y += (avgDY - fish.vel.y) * alignStrength;
    }

    // Directional steering — bumped up from 0.13 for snappier movement
    fish.vel.x += desired.x * 0.18 * fish.bias;
    fish.vel.y += desired.y * 0.18 * fish.bias;

    // Perpendicular Perlin drift
    let t = frameCount * 0.006;
    let drift = (noise(t, fish.noisePhase) - 0.5) * 2;
    let driftStrength = isHorizontal ? 0.11 : 0.06;
    if (isHorizontal) {
      fish.vel.y += drift * driftStrength;
    } else {
      fish.vel.x += drift * driftStrength;
    }

    // Per-fish random particle jitter
    let jitter = 0.18;
    if (isHorizontal) {
      fish.vel.y += random(-jitter, jitter);
    } else {
      fish.vel.x += random(-jitter, jitter);
    }

    // Speed limit — raised from 6 to 8 for snappier overall movement
    let speedLimit = 8 * fish.bias;
    let speed = fish.vel.mag();
    if (speed > speedLimit) {
      fish.vel.normalize();
      fish.vel.mult(speedLimit);
    }

    // Bounds steering
    let innerMargin = 500;

    if (fish.position.x < innerMargin) {
      let depth = (innerMargin - fish.position.x) / innerMargin;
      fish.vel.x += depth * depth * 1.2;
    }
    if (fish.position.x > width - innerMargin) {
      let depth = (fish.position.x - (width - innerMargin)) / innerMargin;
      fish.vel.x -= depth * depth * 1.2;
    }

    if (fish.position.y < innerMargin) {
      let depth = (innerMargin - fish.position.y) / innerMargin;
      fish.vel.y += depth * depth * 1.2;
    }
    if (fish.position.y > height - innerMargin) {
      let depth = (fish.position.y - (height - innerMargin)) / innerMargin;
      fish.vel.y -= depth * depth * 1.2;
    }

    fish.position.add(fish.vel);

    drawFrame(info.sheet, info.data, info.frameIndex, fish.position.x, fish.position.y);
  }
}

function keyPressed() {
  if (key === 'w') targetDirection = "up";
  if (key === 'a') targetDirection = "left";
  if (key === 's') targetDirection = "down";
  if (key === 'd') targetDirection = "right";
  if (targetDirection !== currentDirection) {
    startTransition(currentDirection, targetDirection);
  }
}

function startTransition(from, to) {
  let tagName = getTransitionTagName(from, to);
  if (!tagName) return;
  let tag = transData.meta.frameTags.find(t => t.name === tagName);
  if (!tag) return;
  currentTag = tag;
  transitionStartFrame = frameCount;
  isTransitioning = true;
}

function getFrameInfo() {
  if (isTransitioning) {
    let elapsed = frameCount - transitionStartFrame;
    let start = currentTag.from;
    let end   = currentTag.to;

    let fromIsHorizontal = (currentDirection === "left" || currentDirection === "right");
    let divisor = fromIsHorizontal ? 4 : 6;

    let frameIndex = start + floor(elapsed / divisor);
    if (frameIndex > end) {
      isTransitioning = false;
      currentDirection = targetDirection;
      transitionStartFrame = 0;
      return getLoopFrameInfo();
    }
    return { sheet: transSheet, data: transData, frameIndex };
  } else {
    return getLoopFrameInfo();
  }
}

function getLoopFrameInfo() {
  let tagName = loopTagNames[currentDirection];
  let tag = loopData.meta.frameTags.find(t => t.name === tagName);
  if (!tag) return { sheet: loopSheet, data: loopData, frameIndex: 0 };
  let start  = tag.from;
  let end    = tag.to;
  let length = end - start + 1;
  let frameIndex = start + (floor(frameCount / 6) % length);
  return { sheet: loopSheet, data: loopData, frameIndex };
}

function drawFrame(sheet, data, index, x, y) {
  let f = data.frames[index].frame;
  image(sheet, x, y, f.w * SCALE, f.h * SCALE, f.x, f.y, f.w, f.h);
}
