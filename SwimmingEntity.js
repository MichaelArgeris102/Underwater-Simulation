class SwimmingEntity {
    constructor(x, y, loopSheet, loopData, transSheet, transData) {
        this.position = createVector(x, y);
        this.vel      = createVector(0, 0);

        this.loopSheet  = loopSheet;
        this.loopData   = loopData;
        this.transSheet = transSheet;
        this.transData  = transData;

        this.currentDirection     = "right";
        this.targetDirection      = "right";
        this.isTransitioning      = false;
        this.currentTag           = null;
        this.transitionStartFrame = 0;
    }

    update() {}

    // -------------------------------------------------------------------------
    // Direction helpers
    // -------------------------------------------------------------------------

    getTransitionTagName(from, to) {
        const toName = {
            right: { up: "up",           down: "down",          left: "left",  right: null },
            up:    { right: "right",      down: "down",          left: "left",  up: null   },
            down:  { right: "right",      up:   "up",            left: "left",  down: null },
            left:  { up: "mirrored_up",   down: "mirrored_down", right: "right",left: null },
        };
        const resolvedTo = toName[from][to];
        if (!resolvedTo) return null;
        return from + "_to_" + resolvedTo;
    }

    startTransition(from, to) {
        let tagName = this.getTransitionTagName(from, to);
        if (!tagName) return;
        let tag = this.transData.meta.frameTags.find(t => t.name === tagName);
        if (!tag) return;
        this.currentTag           = tag;
        this.transitionStartFrame = frameCount;
        this.isTransitioning      = true;
    }

    // -------------------------------------------------------------------------
    // Animation
    // -------------------------------------------------------------------------

    getFrameInfo() {
        if (this.isTransitioning) {
            let elapsed          = frameCount - this.transitionStartFrame;
            let start            = this.currentTag.from;
            let end              = this.currentTag.to;
            let fromIsHorizontal = (this.currentDirection === "left" || this.currentDirection === "right");
            let divisor          = fromIsHorizontal ? 4 : 6;
            let frameIndex       = start + floor(elapsed / divisor);

            if (frameIndex > end) {
                this.isTransitioning      = false;
                this.currentDirection     = this.targetDirection;
                this.transitionStartFrame = 0;
                return this.getLoopFrameInfo();
            }
            return { sheet: this.transSheet, data: this.transData, frameIndex };
        } else {
            return this.getLoopFrameInfo();
        }
    }

    getLoopFrameInfo() {
        let tagName = loopTagNames[this.currentDirection];
        let tag     = this.loopData.meta.frameTags.find(t => t.name === tagName);
        if (!tag) return { sheet: this.loopSheet, data: this.loopData, frameIndex: 0 };

        let start      = tag.from;
        let end        = tag.to;
        let length     = end - start + 1;
        let frameIndex = start + (floor(frameCount / 6) % length);
        return { sheet: this.loopSheet, data: this.loopData, frameIndex };
    }

    shouldCropLeftEdge(data, index) {
        let tags = data.meta && data.meta.frameTags;
        if (!tags) return false;

        return tags.some(tag =>
            (tag.name === "right_loop" || tag.name === "left_loop") &&
            index >= tag.from &&
            index <= tag.to
        );
    }

    drawFrame(sheet, data, index, x, y) {
        let f = data.frames[index].frame;
        let cropLeft = this.shouldCropLeftEdge(data, index) ? 1 : 0;

        image(
            sheet,
            round(x + cropLeft * SCALE),
            round(y),
            (f.w - cropLeft) * SCALE,
            f.h * SCALE,
            f.x + cropLeft,
            f.y,
            f.w - cropLeft,
            f.h
        );
    }
}
