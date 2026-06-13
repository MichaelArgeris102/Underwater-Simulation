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
        this.sharkRadius = 0;
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

    // Only apply the skip when starting fresh from the loop; if we're already
    // mid-transition and a new key arrives, just restart cleanly from frame 0.
    let skipFrames = wasAlreadyTransitioning ? 0 : this.getTransitionSkipFrames();
    let maxSkip    = tag.to - tag.from;
    skipFrames     = Math.min(skipFrames, maxSkip);

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
        'mirrored_down_to_right', 
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
        return this.getLoopFrameInfo();
    }

    getLoopFrameInfo() {
        let tagName = this.loopTagNames[this.currentDirection];
        let tag     = this.loopData.meta.frameTags.find(t => t.name === tagName);
        if (!tag) return { sheet: this.loopSheet, data: this.loopData, frameIndex: 0 };

        let start      = tag.from;
        let end        = tag.to;
        let length     = end - start + 1;
        let relIdx     = floor(frameCount / 5) % length;

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
    //** Should be aligning with schools velocity/ position relative to how fast the shark should be allowed to move
    update(schoolCenter) {
       let toSchoolCenter = p5.Vector.sub(schoolCenter,this.position);
       toSchoolCenter.normalize();
       let movementDir;

       if (this.isTransitioning){
        movementDir = this.targetDirection;
       } else {
        movementDir = this.currentDirection;
       }
       let desired = toSchoolCenter;

       let topSpeed = 4;
       let steerForce = 0.4;
       let friction = 0.82;

       if (desired){
        this.vel.x += desired.x * steerForce;
        this.vel.y += desired.y * steerForce;
       }
       this.vel.mult(friction);

       let mag = this.vel.mag();

       if(mag > topSpeed){
        this.vel.normalize();
        this.vel.mult(topSpeed);
       }
        this.position.add(this.vel); //this line should be the start of shark tracking school
    }
    
}