class Fish extends SwimmingEntity {
    constructor(x, y, loopSheet, loopData, transSheet, transData, bias, noisePhase, id) {
        super(x, y, loopSheet, loopData, transSheet, transData);
        this.bias       = bias;
        this.noisePhase = noisePhase;
        this.id         = id;
    }

   
     // Returns the screen-space radius of this fish's body hitbox.
    // The fish sprite is 16×16 pixels drawn at SCALE, so the rendered body
    // fits comfortably inside a circle of about 7 sprite-pixels × SCALE.
    getHitRadius() {
        return 7 * SCALE;
    }

    update(neighbors) {
        let movementDirection = this.isTransitioning ? this.targetDirection : this.currentDirection;
        let isHorizontal = (movementDirection === "left" || movementDirection === "right");
        let minDistance  = (isHorizontal ? 78 : 80) * SCHOOL_SCALE;
        let visualRange  = (isHorizontal ? 320 : 290) * SCHOOL_SCALE;
        let globalCenter = createVector(width / 2, height / 2);
        let desired      = directionVectors[movementDirection];
        let innerMargin  = min(width, height) * 0.18;

        let centerX = 0, centerY = 0;
        let avgDX   = 0, avgDY   = 0;
        let moveX   = 0, moveY   = 0;
        let numNeighbors = 0;

        for (let other of neighbors) {
            if (other === this) continue;

            let d = p5.Vector.dist(this.position, other.position);

            if (d < visualRange) {
                centerX += other.position.x;
                centerY += other.position.y;
                avgDX   += other.vel.x;
                avgDY   += other.vel.y;
                numNeighbors++;
            }

            if (d < minDistance) {
                moveX += this.position.x - other.position.x;
                moveY += this.position.y - other.position.y;
            }
        }

        // Cohesion — steer toward local flock centre
        let cohesionStrength = isHorizontal ? 0.0015 : 0.003;
        if (numNeighbors > 0) {
            centerX /= numNeighbors;
            centerY /= numNeighbors;
            this.vel.x += (centerX - this.position.x) * cohesionStrength;
            this.vel.y += (centerY - this.position.y) * cohesionStrength;
        }

        // Global cohesion — gentle pull toward canvas centre
        this.vel.x += (globalCenter.x - this.position.x) * 0.00022;
        this.vel.y += (globalCenter.y - this.position.y) * 0.00022;

        // Separation — project out any backward component
        let sepStrength = isHorizontal ? 0.048 : 0.065;
        let sepX = moveX * sepStrength;
        let sepY = moveY * sepStrength;

        let dot = sepX * desired.x + sepY * desired.y;
        if (dot < 0) {
            sepX -= dot * desired.x;
            sepY -= dot * desired.y;
        }

        this.vel.x += sepX;
        this.vel.y += sepY;

        // Alignment — match velocity of local neighbours
        if (numNeighbors > 0) {
            avgDX /= numNeighbors;
            avgDY /= numNeighbors;
            let alignStrength = isHorizontal ? 0.028 : 0.05;
            this.vel.x += (avgDX - this.vel.x) * alignStrength;
            this.vel.y += (avgDY - this.vel.y) * alignStrength;
        }

        // Directional steering — constant push in the current travel direction
        this.vel.x += desired.x * 0.18 * this.bias;
        this.vel.y += desired.y * 0.18 * this.bias;

        // Perpendicular Perlin drift — organic wavering across the school
        let t             = frameCount * 0.006;
        let drift         = (noise(t, this.noisePhase) - 0.5) * 2;
        let driftStrength = isHorizontal ? 0.11 : 0.06;
        if (isHorizontal) {
            this.vel.y += drift * driftStrength;
        } else {
            this.vel.x += drift * driftStrength;
        }

        // Per-fish random jitter
        let jitter = 0.18;
        if (isHorizontal) {
            this.vel.y += random(-jitter, jitter);
        } else {
            this.vel.x += random(-jitter, jitter);
        }

        // Speed limit
        let speedLimit = 8 * this.bias;
        let speed      = this.vel.mag();
        if (speed > speedLimit) {
            this.vel.normalize();
            this.vel.mult(speedLimit);
        }

        // Boundarys indicating transition point
       // Wall turning — trigger direction reversal at boundary
        if (!this.isTransitioning) {
            if (movementDirection === 'right' && this.position.x > width - innerMargin) {
                this.targetDirection = 'left';
                this.startTransition(this.currentDirection, 'left');
            } else if (movementDirection === 'left' && this.position.x < innerMargin) {
                this.targetDirection = 'right';
                this.startTransition(this.currentDirection, 'right');
            } else if (movementDirection === 'up' && this.position.y < innerMargin) {
                this.targetDirection = 'down';
                this.startTransition(this.currentDirection, 'down');
            } else if (movementDirection === 'down' && this.position.y > height - innerMargin) {
                this.targetDirection = 'up';
                this.startTransition(this.currentDirection, 'up');
            }
        }

        this.position.add(this.vel);

        this.position.add(this.vel);
    }
}