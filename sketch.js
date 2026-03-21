let loopSheet;
let loopData;

let transSheet;
let transData;

const SCALE = 7;       // sprites are 16x16, this makes them 96x96 on screen
const COLS = 10;       // 10 columns x 5 rows = 50 fish
const ROWS = 5;
const speed = 1;

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
  let cellW = 1550  / COLS; //width from canvas width
  let cellH = 770 / ROWS; //height from canvas height
  let distanceBetween = 150;

  //creates grid for fish to live in lets tweak
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (cellW < 16 || cellH < 16 ){
        break
      }

      fishPositions.push({
        x: cellW * col + distanceBetween, //cellw * col left edge of its cell so its col num * consntant width ||
                                                    //(cellW - 16 * SCALE) / 2 centers the fish in the center of the cell 
        y: cellH * row + distanceBetween,  //cellH * row top edge of current row + distancebetween centers it 
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
    if (currentDirection === 'right') pos.x += speed;
    if (currentDirection === 'left') pos.x -= speed;
    if (currentDirection === 'up') pos.y -= speed;
    if (currentDirection === 'down') pos.y += speed;
   
   //fix this later
    //if (isTransitioning) {
    //pos.x = 0;
    //pos.y = 0;
//}
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

// if were transitioning set start and end of transitions, increment frameIndex with the proper start from the json
//once transition completes stop turning and lock in new direction and resset timer
//if decides which sheet to display and return the instructions for drawing that sheet 
// if is for transition sheet and else accoutns for loop sheet
function getFrameInfo() {
  if (isTransitioning) {
    let start = currentTag.from;
    let end   = currentTag.to;

    // divide animFrame by 6 to slow the animation down (6 draw() calls per sprite frame)
    let frameIndex = start + floor(animFrame / 6); //slows animation down to about the speed of aesprite

    // once we've played past the last frame, transition is done
    if (frameIndex > end) {
      isTransitioning = false;
      currentDirection = targetDirection;
      animFrame = 0;
      // drop into loop immediately for this frame
      return getLoopFrameInfo(); // <-- loop sheet
    }

    animFrame++;
    return { sheet: transSheet, data: transData, frameIndex }; // <-- transition sheet

  } 
  else {
    return getLoopFrameInfo();
  }
}

function getLoopFrameInfo() {
  let tagName = loopTagNames[currentDirection];
  let tag = loopData.meta.frameTags.find(t => t.name === tagName); //look through every tag and check if they are equal to what tagName holds

  if (!tag) {
    console.log("Missing loop tag:", tagName);
    return { sheet: loopSheet, data: loopData, frameIndex: 0 }; // fallback frame in case of crash play frame 0 and keep running
  }

  let start  = tag.from;
  let end    = tag.to;
  let length = end - start + 1; // so length could = 15-10 +1 = 6 frames total 

 
  let frameIndex = start + (floor(frameCount / 6) % length);  // use p5js framecount and slow it down by diving it by 6 then flooring it
                                                              //%legnth turns 0 1 2 3 4 5 6 into 0 1 2 3 ,0 1 2 3 if length = 4

  return { sheet: loopSheet, data: loopData, frameIndex }; // <-- loop sheet
}





function drawFrame(sheet, data, index, x, y) {
  let f = data.frames[index].frame; // so were saying let f hold a line of json data like "frame": { "x": 128, "y": 32, "w": 16, "h": 16 }

  // p5 image() signature: image(img, dx, dy, dw, dh, sx, sy, sw, sh)
  // d = destination (where on canvas), s = source (where on spritesheet)
  // multiply dw/dh by SCALE to zoom the sprite up from 16x16 to 96x96

  
  image(
    sheet,
    x, y,
    f.w * SCALE, f.h * SCALE, //x and y are actual location while f.w and f.h are the width and height and or zoom or scale of the fish

    f.x, f.y,  //start at frame f.x, f.y we get from first line so this starts at whichever frame we need
    f.w, f.h // size of the cut
  );
}