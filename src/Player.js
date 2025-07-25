import * as THREE from 'three';

const GRAVITY              = -15;
const JUMP_FORCE           = 8;
const RAYCAST_HEIGHT       = 5.0;
const GROUNDED_BUFFER_TIME = 0.2;
const GROUND_TOLERANCE     = 0.1;
const SPAWN_ALTITUDE       = 240;
const SPAWN_INITIAL_VELOCITY = -1.0;
// FIX: Add constants for movement speeds.
const WALK_SPEED           = 2.5;
const SPRINT_SPEED         = 5.0;

export class Player {
    constructor(scene) {
        this.scene   = scene;
        this.model   = null;
        this.mixer   = null;
        this.animations = {};
        this.currentAnimation = null;
        this.spawnPoint = new THREE.Vector3();

        this.state = {
            idle      : false,
            walking   : false,
            sprinting : false,
            jumping   : true,
            falling   : true,
        };

        this.verticalVelocity  = SPAWN_INITIAL_VELOCITY;
        this.walkToSprintTime  = 0;
        this.timeSinceGrounded = GROUNDED_BUFFER_TIME + 0.01;

        this.feetOffset = 0;
    }

    /*───────────────────────────────────────────────────────────────────────
     * LOAD THE PLAYER MODEL & ANIMATIONS
     *───────────────────────────────────────────────────────────────────────*/
    async load(gltf, mapCollider) {
        this.model = gltf.scene;
        this.model.scale.set(0.5, 0.5, 0.5);

        this.model.traverse(node => {
            if (!node.isMesh) return;
            node.castShadow    = true;
            node.receiveShadow = true;
        });

        const bbox = new THREE.Box3().setFromObject(this.model);
        this.feetOffset = -bbox.min.y;

        /*───────────── spawn position ─────────────*/
        const worldBox = new THREE.Box3();
        for (const mesh of mapCollider) worldBox.expandByObject(mesh);
        const center = worldBox.getCenter(new THREE.Vector3());

        this.spawnPoint.set(center.x, worldBox.max.y + SPAWN_ALTITUDE, center.z);
        this.model.position.copy(this.spawnPoint);
        this.model.rotation.y = Math.PI;
        this.scene.add(this.model);

        /*───────────── animations ────────────────*/
        this.mixer = new THREE.AnimationMixer(this.model);
        gltf.animations.forEach(clip => {
            const name = clip.name.split('|')[1]?.toLowerCase() || clip.name.toLowerCase();
            if (name === 'grounded') return;    // skip faulty clip
            this.animations[name] = this.mixer.clipAction(clip);
        });
        Object.values(this.animations).forEach(a => a.stop());
        this._switchAnimation('jump', 0);
    }

    reset() {
        if (!this.model) return;
        this.model.position.copy(this.spawnPoint);
        this.model.rotation.x = 0; // Reset dive tilt
        this.model.rotation.y = Math.PI; // Flip player on respawn
        this.verticalVelocity  = SPAWN_INITIAL_VELOCITY;
        this.timeSinceGrounded = GROUNDED_BUFFER_TIME + 0.01;
        this.state = { idle: false, walking: false, sprinting: false, jumping: true, falling: true };
        this._switchAnimation('jump', 0.1);
    }

     /*───────────────────────────────────────────────────────────────────────
      * MAIN UPDATE LOOP  —  COPY‑PASTE OVER THE CURRENT METHOD
      *───────────────────────────────────────────────────────────────────────*/
     update(delta, controls, mapCollider, raycaster) {
         if (!this.model || !this.mixer) return;

         /*────────────────── constants ──────────────────*/
         const AIR_CONTROL_FACTOR   = 0.6;   // ≤ 1.0  (horizontal speed in air)
         const TERMINAL_VELOCITY    = -45;   // m/s downward cap
         const FALL_ANIM_DELAY      = 0.40;  // keep “jump” clip this long

         /*────────────────── ground check ───────────────*/
         const wasGrounded = this.timeSinceGrounded < GROUNDED_BUFFER_TIME;

         const rayOrigin = this.model.position.clone();
         rayOrigin.y += RAYCAST_HEIGHT;
         raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
         const hits = raycaster.intersectObjects(mapCollider, true);
         const grounded = hits.length > 0 &&
                          hits[0].distance <
                          (RAYCAST_HEIGHT + this.feetOffset + GROUND_TOLERANCE);

         if (grounded) {
             this.timeSinceGrounded = 0;
             if (this.state.falling || this.state.jumping) {
                 this.state.falling  = false;
                 this.state.jumping  = false;
                 this.model.rotation.x = 0;  // clear dive tilt
             }
         } else {
             this.timeSinceGrounded += delta;
             if (this.timeSinceGrounded > GROUNDED_BUFFER_TIME && !this.state.jumping) {
                 this.state.falling = true;
             }
         }

         const justLeftGround = !grounded &&  wasGrounded;
         const justLanded    =  grounded && !wasGrounded;

         /*────────────────── leave ground ───────────────*/
         if (justLeftGround) {
             // stop walk / sprint clips but **do not clear sprint flag or timer**
             if (this.currentAnimation === 'walk' || this.currentAnimation === 'sprint') {
                 this._switchAnimation('idle', 0.15);   // idle = fall placeholder
             }
             this.state.walking = false;   // airborne ≠ walking
             // note: this.state.sprinting stays as‑is ─ important!
         }

         /*────────────────── jump input ────────────────*/
         if (grounded && controls.jump) {
             this.verticalVelocity = JUMP_FORCE;
             this._switchAnimation('jump', 0.1);

             // Preserve sprint flag; clear only 'walking'
             this.state = {
                 idle: false,
                 walking: false,
                 sprinting: this.state.sprinting,
                 jumping: true,
                 falling: false,
             };
         }

         /*────────────────── movement input ─────────────*/
         let moving = false;
         const dir = new THREE.Vector3();
         if (controls.forward)  { dir.z =  1; moving = true; }
         if (controls.backward) { dir.z = -1; moving = true; }

         // allow turning mid‑air
         if (controls.left)  this.model.rotation.y += 3 * delta;
         if (controls.right) this.model.rotation.y -= 3 * delta;

         if (moving) {
             const baseSpeed   = this.state.sprinting ? SPRINT_SPEED : WALK_SPEED;
             const speedFactor = grounded ? 1.0 : AIR_CONTROL_FACTOR;
             dir.normalize()
                .applyQuaternion(this.model.quaternion)
                .multiplyScalar(baseSpeed * speedFactor * delta);
             this.model.position.add(dir);
         }

         /*────────────────── vertical physics ───────────*/
         this.verticalVelocity += GRAVITY * delta;
         if (this.verticalVelocity < TERMINAL_VELOCITY) {
             this.verticalVelocity = TERMINAL_VELOCITY;
         }

         if (grounded && this.verticalVelocity < 0) {
             this.verticalVelocity = 0;
             this.model.position.y = hits[0].point.y + this.feetOffset;
         }
         this.model.position.y += this.verticalVelocity * delta;

         /*────────────────── animation state machine ───*/
         // jump → fall placeholder after short delay
         if (!grounded &&
             this.currentAnimation === 'jump' &&
             this.timeSinceGrounded > FALL_ANIM_DELAY &&
             this.verticalVelocity < -0.1) {
             this._switchAnimation('idle', 0.25);       // idle = “fall” clip
         }

         if (grounded) {
             if (moving) {                       // player is moving on the ground
                 const desiredAnim = this.state.sprinting ? 'sprint' : 'walk';

                 if (this.currentAnimation !== desiredAnim) {
                     this._switchAnimation(desiredAnim, 0.15);
                 }

                 // Handle automatic sprint ramp‑up *only* if not already sprinting
                 if (!this.state.sprinting) {
                     this.walkToSprintTime += delta;
                     if (this.walkToSprintTime > 1.0) {
                         this.state.sprinting = true;
                         this._switchAnimation('sprint', 0.2);
                     }
                 }

                 this.state.idle    = false;
                 this.state.walking = !this.state.sprinting;
             } else {                            // standing still
                 if (this.currentAnimation !== 'idle') {
                     this._switchAnimation('idle', 0.3);
                 }
                 this.walkToSprintTime = 0;
                 this.state = { ...this.state,
                     idle: true, walking: false, sprinting: false };
             }
         }

         /*────────────────── housekeeping ───────────────*/
         if (this.model.position.y < -50) { this.reset(); return; }
         this.mixer.update(delta);
     }





    /*───────────────────────────────────────────────────────────────────────
     * Cross-fade to another animation
     *───────────────────────────────────────────────────────────────────────*/
    _switchAnimation(name, fade) {
        const target = this.animations[name];
        if (!target) { console.warn(`[Animation] '${name}' not found`); return; }
        if (this.currentAnimation === name) return;

        const previous = this.animations[this.currentAnimation];
        this.currentAnimation = name;

        if (previous) previous.stop();
        target.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();

        if (name === 'jump') {
            target.setLoop(THREE.LoopOnce, 1);
            target.clampWhenFinished = true;
        }
    }
}