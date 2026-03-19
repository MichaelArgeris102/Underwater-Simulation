let loopSheet;
let loopData;

let transSheet;
let transData;

const SCALE = 6;       // sprites are 16x16, this makes them 96x96 on screen
const COLS = 10;       // 10 columns x 5 rows = 50 fish
const ROWS = 5;

let currentDirection = "right";
let targetDirection = "right";

let currentTag = null;
let animFrame = 0;
let isTransitioning = false;

let fishPositions = [];

// maps direction names to their loop tag names in fishloops.json
const loopTagNames = {
  right: "right_loop",
  up:    "up_loop",
  down:  "down_loop",
  left:  "left_loop",
};

// builds the correct transition tag name to look up in fishtransitions.json
// "left" is a special case — its up/down transitions use mirrored variants
// because the fish sprite faces a different way when swimming left
function getTransitionTagName(from, to) {
  const toName = {
    right: { up: "up",          down: "down",          left: "left",   right: null },
    up:    { right: "right",    down: "down",          left: "left",   up: null    },
    down:  { right: "right",    up: "up",              left: "left",   down: null  },
    left:  { up: "mirrored_up", down: "mirrored_down", right: "right", left: null  },
  };
  const resolvedTo = toName[from][to];
  if (!resolvedTo) return null; // same direction, no transition needed
  return from + "_to_" + resolvedTo;
}

function preload() {
  loopSheet = loadImage("assets/fishloops.png");
  loopData  = loadJSON("assets/fishloops.json");

  transSheet = loadImage("assets/fishtransitions.png");
  transData  = loadJSON("assets/fishtransitions.json");
}

function setup() {
  createCanvas(2560, 1440);
  noSmooth(); // keeps pixel art crisp, no interpolation

  // divide the canvas evenly into a COLS x ROWS grid and center each fish in its cell
  let cellW = width  / COLS;
  let cellH = height / ROWS;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      fishPositions.push({
        x: cellW * col + (cellW - 16 * SCALE) / 2,
        y: cellH * row + (cellH - 16 * SCALE) / 2,
      });
    }
  }
}

function draw() {
  background(220);

  // getFrameInfo returns both the correct sheet/data AND the frame index
  // so drawFrame knows which spritesheet to pull from
  let info = getFrameInfo();

  for (let pos of fishPositions) {
    drawFrame(info.sheet, info.data, info.frameIndex, pos.x, pos.y);
  }
}

function keyPressed() {
  if (key === 'w') targetDirection = "up";
  if (key === 'a') targetDirection = "left";
  if (key === 's') targetDirection = "down";
  if (key === 'd') targetDirection = "right";

  // only start a transition if the direction actually changed
  if (targetDirection !== currentDirection) {
    startTransition(currentDirection, targetDirection);
  }
}

function startTransition(from, to) {
  let tagName = getTransitionTagName(from, to);

  if (!tagName) {
    console.log("No transition needed from", from, "to", to);
    return;
  }

  let tag = transData.meta.frameTags.find(t => t.name === tagName);

  if (!tag) {
    console.log("Missing transition tag:", tagName);
    return;
  }

  currentTag = tag;
  animFrame = 0;      // reset playhead to start of transition
  isTransitioning = true;
}

// returns { sheet, data, frameIndex } so draw() knows which
// spritesheet to use — the loop sheet or the transition sheet
function getFrameInfo() {
  if (isTransitioning) {
    let start = currentTag.from;
    let end   = currentTag.to;

    // divide animFrame by 6 to slow the animation down (6 draw() calls per sprite frame)
    let frameIndex = start + floor(animFrame / 6);

    // once we've played past the last frame, transition is done
    if (frameIndex > end) {
      isTransitioning = false;
      currentDirection = targetDirection;
      animFrame = 0;
      // drop into loop immediately for this frame
      return getLoopFrameInfo();
    }

    animFrame++;
    return { sheet: transSheet, data: transData, frameIndex }; // <-- transition sheet

  } else {
    return getLoopFrameInfo();
  }
}

function getLoopFrameInfo() {
  let tagName = loopTagNames[currentDirection];
  let tag = loopData.meta.frameTags.find(t => t.name === tagName);

  if (!tag) {
    console.log("Missing loop tag:", tagName);
    return { sheet: loopSheet, data: loopData, frameIndex: 0 };
  }

  let start  = tag.from;
  let end    = tag.to;
  let length = end - start + 1;

  // use frameCount (global p5 counter) to drive the loop, modulo keeps it cycling
  let frameIndex = start + (floor(frameCount / 6) % length);
  return { sheet: loopSheet, data: loopData, frameIndex }; // <-- loop sheet
}

function drawFrame(sheet, data, index, x, y) {
  let f = data.frames[index].frame; // f holds x, y, w, h of the sprite on the sheet

  // p5 image() signature: image(img, dx, dy, dw, dh, sx, sy, sw, sh)
  // d = destination (where on canvas), s = source (where on spritesheet)
  // multiply dw/dh by SCALE to zoom the sprite up from 16x16 to 96x96
  image(
    sheet,
    x, y,
    f.w * SCALE, f.h * SCALE,
    f.x, f.y,
    f.w, f.h
  );
}