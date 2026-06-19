class Shark extends SwimmingEntity {
    constructor(x, y, loopSheet, loopData, transSheet, transData, biteSheet, biteData) {
        super(x, y, loopSheet, loopData, transSheet, transData);
        this.loopTagNames = {
            right:         "right_loop",
            up:            "up_loop",
            down:          "down_loop",
            left:          "left_loop",
            mirrored_down: "mirrored_down_loop",
            mirrored_up:   "mirrored_up_loop"
        };
        this.biteSheet = biteSheet;
        this.biteData  = biteData;
        this.currentLoopRelativeIndex = 0;
        this.loopAnchorFrame = 0; // lets getLoopFrameInfo count phase from a reset point instead of raw frameCount
        //tracking vars
        this.sharkRadius = 0;
        this.drawScale = (SCALE * 2)* 1.05;
        //biting vars
        this.isBiting = false;
        this.biteStartFrame = 0;
        this.currentBiteTag = null;
        this.biteStartRelIdx = 0;        // where in the bite tag we begin (continues from the loop's current head position)
        this.biteNeedsExtraLoop = false; // true if this bite started too late in the cycle and needs a bonus full pass
        this.biteExtraLoopQueued = false;
        
        // Map current directions to the tags in JSON
        this.biteTagNames = {
            right:         "right_bite",
            left:          "left_bite",
            up:            "up_bite",
            down:          "down_bite",
            mirrored_up:   "mirrored_up_bite",   // <-- Updated from "up_bite"
            mirrored_down: "mirrored_down_bite"  // <-- Updated from "down_bite"
        };

        // Tag-relative relIdx (0-indexed) past whiI ch starting a bite leaves too few
        // frames before the tag ends to read as a full bite — so we tack on one
        // extra full pass through the bite tag before returning to the loop.
        // right/left: derived from the head-flip boundary (relIdx 5/6) in those loops.
        // up/down: derived from your frame-35-in-up_loop example (relIdx 10 of 17).
        // mirrored_up/mirrored_down: mirrors up/down since they share the same length/shape.
        this.biteExtraLoopThreshold = {
            right:         4,
            left:          4,
            up:            4,
            down:          10,
            mirrored_up:   10,
            mirrored_down: 10
        };
    }

    drawFrame(sheet, data, index, x, y) {
    let f  = data.frames[index].frame;
    let s  = this.drawScale;
    // offset so position is the sprite center rather than top-left
    let ox = (f.w * s) / 2;
    let oy = (f.h * s) / 2;
    image(sheet, round(x - ox), round(y - oy), f.w * s, f.h * s,
          f.x, f.y, f.w, f.h);
}
    startBite() {
        // Prevent biting if already biting or mid-transition
        if (this.isBiting || this.isTransitioning) return;

        let tagName = this.biteTagNames[this.currentDirection];
        let tag = this.biteData.meta.frameTags.find(t => t.name === tagName);

        if (!tag) return; // Failsafe if tag isn't found

        this.currentBiteTag = tag;
        this.isBiting = true;
        this.biteStartFrame = frameCount;

        // --- NEW SEAMLESS BITE START LOGIC ---
        // Grab the current loop phase and add 1 so the bite smoothly continues the motion
        this.biteStartRelIdx = this.currentLoopRelativeIndex + 1;

        let biteLength = tag.to - tag.from + 1;
        // Failsafe: if +1 pushes us past the end of the tag, wrap it to 0
        if (this.biteStartRelIdx >= biteLength) {
            this.biteStartRelIdx = 0;
        }

        // --- NEW EXTRA LOOP LOGIC ---
        // Check against the 0-indexed thresholds you set up in the constructor.
        // (e.g., Aseprite frame 5 = 0-indexed relIdx 4. Threshold for right is 4.)
        let threshold = this.biteExtraLoopThreshold[this.currentDirection];
        
        if (this.currentLoopRelativeIndex >= threshold) {
            this.biteNeedsExtraLoop = true;
        } else {
            this.biteNeedsExtraLoop = false;
        }
        
        this.biteExtraLoopQueued = false;
    }

    resolveDirection(rawKey) {
    if (rawKey === 'left' || rawKey === 'right') return rawKey;

    let cur = this.isTransitioning ? this.targetDirection : this.currentDirection;

    // U-turn pairs: down ↔ mirrored_up cross the side boundary by design
    if (rawKey === 'up'   && cur === 'down')        return 'mirrored_up';
    if (rawKey === 'down' && cur === 'mirrored_up') return 'down';

    let onLeftSide = (cur === 'left' || cur === 'mirrored_up' || cur === 'mirrored_down');

    if (rawKey === 'up')   return onLeftSide ? 'mirrored_up'   : 'up';
    if (rawKey === 'down') return onLeftSide ? 'mirrored_down' : 'down';

    return rawKey;
}



    startTransition(from, to) {
    let wasAlreadyTransitioning = this.isTransitioning;   // capture before we modify state

    // --- BITE INTERRUPT LOGIC ---
    // If we're mid-bite, figure out exactly which relative frame of the bite
    // tag is currently showing, then cancel the bite. We'll resume the
    // animation one frame later in the transition tag, so the motion reads
    // as continuous instead of snapping or waiting for the bite to finish.
    let interruptedBiteRelIdx = null;
    if (this.isBiting) {
        let elapsed        = frameCount - this.biteStartFrame;
        let biteDivisor     = 6;
        let elapsedFrames   = floor(elapsed / biteDivisor);
        let biteLength      = this.currentBiteTag.to - this.currentBiteTag.from + 1;
        let currentRelIdx   = this.biteStartRelIdx + elapsedFrames;
        if (currentRelIdx >= biteLength) currentRelIdx = biteLength - 1;
        if (currentRelIdx < 0) currentRelIdx = 0;
        interruptedBiteRelIdx = currentRelIdx;

        this.isBiting              = false;
        this.biteStartFrame        = 0;
        this.currentBiteTag        = null;
        this.biteNeedsExtraLoop    = false;
        this.biteExtraLoopQueued   = false;
    }

    let headSide  = this.getHeadSide();
    let tagName   = this.getTransitionTagName(from, to, headSide);
    if (!tagName) return;

    let tag = this.transData.meta.frameTags.find(t => t.name === tagName);

    if (!tag && headSide) {
        let otherSide    = headSide === 'head_left' ? 'head_right' : 'head_left';
        let fallbackName = this.getTransitionTagName(from, to, otherSide);
        tag = this.transData.meta.frameTags.find(t => t.name === fallbackName);
    }

    if (!tag) return;

    this.currentTag = tag;   // must be set before calling getTransitionDivisor()

    let skipFrames;
    if (interruptedBiteRelIdx !== null) {
        // Resume one frame past where the bite was cut off — e.g. biting on
        // relIdx 5 of right_bite means we pick up at relIdx 6 of the
        // right_to_<dir> transition tag.
        skipFrames = interruptedBiteRelIdx + 1;
    } else {
        // Only apply the loop-based skip when starting fresh from the loop;
        // if we're already mid-transition and a new key arrives, just
        // restart cleanly from frame 0.
        skipFrames = wasAlreadyTransitioning ? 0 : this.getTransitionSkipFrames();
    }
    let maxSkip = tag.to - tag.from;
    skipFrames  = Math.min(skipFrames, maxSkip);

    let divisor           = this.getTransitionDivisor();
    this.transitionStartFrame = frameCount - Math.round(skipFrames * divisor);
    this.isTransitioning      = true;
}

    getTransitionDivisor() {
    let name;
    if (this.currentTag) {
        name = this.currentTag.name;
    } else {
        name = '';
    }
    const fastTags = [

        'up_to_down', 'down_to_up', 'down_to_right', 'down_to_left', 'right_to_down',
        'mirrored_up_to_down', 'down_to_mirrored_up',
        'mirrored_down_to_up', 'up_to_mirrored_down',
        'mirrored_down_to_left', 
        'mirrored_down_to_right', 'mirrored_up_to_left',
        'mirrored_up_to_right',
        'right_to_left', 'left_to_right'
    ];

    for (let ft of fastTags) {
        if (name.startsWith(ft)) {
            return 3.5;
        }
    }
        return 5;
    }

    getTransitionSkipFrames() {
    let dir    = this.currentDirection;
    let relIdx = this.currentLoopRelativeIndex;

    if (dir === 'right' || dir === 'left') {
        if (relIdx >= 1 && relIdx <= 5)  return relIdx - 1; // 0 at start of window, 4 at end
        if (relIdx >= 7 && relIdx <= 11) return relIdx - 7; // same for the other window
        // rel 0 or rel 6 (centered) → no skip
    }
    return 0;
}

    getHeadSide() {
    let dir    = this.currentDirection;
    let relIdx = this.currentLoopRelativeIndex;

    if (dir === 'right') {
        // rel 0 (centered, heading into head-left) + rel 1-5 (head-left) → head_left variant
        if (relIdx <= 5) return 'head_left';
        // rel 6 (centered, heading into head-right) + rel 7-11 (head-right) → head_right variant
        return 'head_right';
    }
    if (dir === 'left') {
        // Mirror of right: rel 0-5 → head_right, rel 6-11 → head_left
        if (relIdx <= 5) return 'head_right';
        return 'head_left';
    }
    return null;
}

   getFrameInfo() {
        // 1. Prioritize Biting Animation
        if (this.isBiting) {
            let elapsed = frameCount - this.biteStartFrame;
            let start = this.currentBiteTag.from;
            let end = this.currentBiteTag.to;
            let length = end - start + 1;

            let biteDivisor = 6;
            
            // Calculate how many frames of the bite animation have passed
            let elapsedFrames = floor(elapsed / biteDivisor);
            
            // Add the elapsed frames to our seamless starting index offset
            let currentBiteRelIdx = this.biteStartRelIdx + elapsedFrames;

            // Check if we've reached the end of the bite tag
            if (currentBiteRelIdx >= length) {
                
                // If we started late in the cycle and haven't done our extra loop yet...
                if (this.biteNeedsExtraLoop && !this.biteExtraLoopQueued) {
                    this.biteExtraLoopQueued = true;
                    
                    // Reset our offset to 0 so the extra loop plays from the very beginning
                    this.biteStartRelIdx = 0;
                    
                    // Reset the start frame to right now so our math restarts cleanly
                    this.biteStartFrame = frameCount; 
                    
                    return { sheet: this.biteSheet, data: this.biteData, frameIndex: start };
                } 
                // Otherwise, the bite sequence is completely finished!
                else {
                    this.isBiting = false;
                    this.biteStartFrame = 0;
                    this.biteNeedsExtraLoop = false;
                    this.biteExtraLoopQueued = false;

                    let tagName = this.loopTagNames[this.currentDirection];
                    let tag     = this.loopData.meta.frameTags.find(t => t.name === tagName);

                    if (tag) {
                        this.loopAnchorFrame = frameCount;
                        this.currentLoopRelativeIndex = 0;
                        return { sheet: this.loopSheet, data: this.loopData, frameIndex: tag.from };
                    }
                    return this.getLoopFrameInfo();
                }
            }
            
            // Calculate actual absolute frame index to draw
            let frameIndex = start + currentBiteRelIdx;
            return { sheet: this.biteSheet, data: this.biteData, frameIndex };
        }

        // 2. Transition Animation (Your existing code)
        if (this.isTransitioning) {
            let elapsed    = frameCount - this.transitionStartFrame;
            let start      = this.currentTag.from;
            let end        = this.currentTag.to;
            let divisor    = this.getTransitionDivisor(); 
            let frameIndex = start + floor(elapsed / divisor);

            if (frameIndex > end) {
                this.isTransitioning      = false;
                this.currentDirection     = this.targetDirection;
                this.transitionStartFrame = 0;
                return this.getLoopFrameInfo();
            }
            return { sheet: this.transSheet, data: this.transData, frameIndex };
        }
        
        // 3. Looping Animation (Your existing code)
        return this.getLoopFrameInfo();
    }

    getLoopFrameInfo() {
        let tagName = this.loopTagNames[this.currentDirection];
        let tag     = this.loopData.meta.frameTags.find(t => t.name === tagName);
        if (!tag) return { sheet: this.loopSheet, data: this.loopData, frameIndex: 0 };

        let start      = tag.from;
        let end        = tag.to;
        let length     = end - start + 1;
        let phaseFrame = frameCount - this.loopAnchorFrame;
        let relIdx     = floor(phaseFrame / 5) % length;
        if (relIdx < 0) relIdx += length;

        this.currentLoopRelativeIndex = relIdx;
        let frameIndex = start + relIdx; 
        return { sheet: this.loopSheet, data: this.loopData, frameIndex };
    }

   getTransitionTagName(from, to, headSide = null) {
    const toName = {
        right:         { up: "up", down: "down", left: "left", mirrored_up: "mirrored_up", mirrored_down: "mirrored_down" },
        left:          { up: "up", down: "down", right: "right", mirrored_up: "mirrored_up", mirrored_down: "mirrored_down" },
        up:            { down: "down", right: "right", left: "left" },
        down:          { up: "up", mirrored_up: "mirrored_up", right: "right", left: "left" },  // added mirrored_up
        mirrored_up:   { left: "left", right: "right", down: "down", mirrored_down: "mirrored_down" },  // added down
        mirrored_down: { left: "left", right: "right", mirrored_up: "mirrored_up" },
    };

    const resolvedTo = toName[from]?.[to];
    if (!resolvedTo) return null;

    let baseName = from + "_to_" + resolvedTo;

    if ((from === 'right' || from === 'left') && headSide) {
        baseName += "_" + headSide;
    }              

    return baseName;
}
    // -------------------------------------------------------------------------
    // Hitbox helpers
    // -------------------------------------------------------------------------

    // Returns the world-space position of the shark's mouth / head tip.
    // The sprite is 28px wide × 22px tall drawn at drawScale.
    // Offset reduced to 8 sprite-pixels (was 12) so the circle sits closer
    // to the snout rather than floating out in front of it.
    getMouthPosition() {
        const MOUTH_OFFSET = 8 * this.drawScale;

        // Direction vectors for each animation direction
        const offsets = {
            right:         createVector( MOUTH_OFFSET,  0),
            left:          createVector(-MOUTH_OFFSET,  0),
            up:            createVector( 0, -MOUTH_OFFSET),
            down:          createVector( 0,  MOUTH_OFFSET),
            mirrored_up:   createVector( 0, -MOUTH_OFFSET),
            mirrored_down: createVector( 0,  MOUTH_OFFSET),
        };

        // Use target direction during a transition so the mouth leads movement
        let dir = this.isTransitioning ? this.targetDirection : this.currentDirection;
        let off = offsets[dir] || createVector(MOUTH_OFFSET, 0);
        return p5.Vector.add(this.position, off);
    }

    // Radius of the active-bite hitbox circle (in screen pixels).
    // Reduced from 7 to 5 sprite-pixels so the outer reach comes in ~30%.
    getMouthRadius() {
        return 5 * this.drawScale;
    }

    // True only when the bite animation is in the "mouth open" window.
    // right/left tags are 12 frames (0-11); open window: relIdx 2–8.
    // up/down tags are 17 frames (0-16);   open window: relIdx 4–11.
    isBiteHitboxActive() {
        if (!this.isBiting || !this.currentBiteTag) return false;

        let elapsed       = frameCount - this.biteStartFrame;
        let biteDivisor   = 6;
        let currentRelIdx = this.biteStartRelIdx + floor(elapsed / biteDivisor);
        let tag           = this.currentBiteTag;
        let length        = tag.to - tag.from + 1;

        // Clamp to tag length so we don't read past the end
        if (currentRelIdx >= length) return false;

        // right_bite / left_bite: 12 frames, mouth open frames 2–8
        if (tag.name === 'right_bite' || tag.name === 'left_bite') {
            return currentRelIdx >= 2 && currentRelIdx <= 8;
        }
        // up_bite / down_bite: 17 frames, mouth open frames 4–11
        if (tag.name === 'up_bite' || tag.name === 'down_bite' || tag.name === 'mirrored_up_bite' || tag.name === 'mirrored_down_bite') {
            return currentRelIdx >= 4 && currentRelIdx <= 11;
        }
        return false;
    }

    //** Should be aligning with schools velocity/ position relative to how fast the shark should be allowed to move
update(schoolCenter) {
    let toSchoolCenter = p5.Vector.sub(schoolCenter, this.position);
    toSchoolCenter.normalize();

    let topSpeed   = 7.84;      
    let steerForce = 1.4;       
    let friction   = 0.85;

    this.vel.x += toSchoolCenter.x * steerForce;
    this.vel.y += toSchoolCenter.y * steerForce;
    this.vel.mult(friction);

    if (this.vel.mag() > topSpeed) {
        this.vel.normalize();
        this.vel.mult(topSpeed);
    }

    // --- AUTOMATED TRANSITIONS (ONLY WHEN SELECTING PREY) ---
    if (selectedMode === "prey") {
        
        // 1. School Mimicking
        let dirCounts = { left: 0, right: 0, up: 0, down: 0 };
        let totalFish = fishPositions.length;

        for (let f of fishPositions) {
            if (!f.isTransitioning && dirCounts[f.currentDirection] !== undefined) {
                dirCounts[f.currentDirection]++;
            }
        }

        let threshold = totalFish * 0.75;
        for (let dir in dirCounts) {
            if (dirCounts[dir] >= threshold) {
                let resolved = this.resolveDirection(dir);
                if (resolved !== this.currentDirection && !this.isTransitioning) {
                    this.targetDirection = resolved;
                    this.startTransition(this.currentDirection, resolved);
                }
            }
        }

        // 2. Wall turning 
        if (!this.isTransitioning) {
            let margin     = min(width, height) * 0.20;
            let onLeftSide = ['left','mirrored_up','mirrored_down'].includes(this.currentDirection);
            let newDir     = null;

            if (this.vel.x > 0.5 && this.position.x > width - margin) {
                newDir = 'left';
            } else if (this.vel.x < -0.5 && this.position.x < margin) {
                newDir = 'right';
            } else if (this.vel.y < -0.5 && this.position.y < margin) {
                newDir = onLeftSide ? 'mirrored_down' : 'down';
            } else if (this.vel.y > 0.5 && this.position.y > height - margin) {
                newDir = onLeftSide ? 'mirrored_up' : 'up';
            }

            if (newDir) {
                this.targetDirection = newDir;
                this.startTransition(this.currentDirection, newDir);
            }
        }
    }

    this.position.add(this.vel);
}

}