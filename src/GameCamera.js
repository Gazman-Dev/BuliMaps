import * as THREE from 'three';
import { controlsState } from './ControlsManager.js';

/*───────────────────────────────
 * CAMERA TUNING CONSTANTS
 *───────────────────────────────*/
// --- THE "BOOM ARM" ---
const CINEMATIC_RADIUS = 15.0; // The fixed distance (radius) from the player.

// --- CAMERA ORIENTATION (Vertical Angle) ---
const START_POLAR_ANGLE = Math.PI / 2.8; // Starts slightly high behind the player. (0 is top-down)
const END_POLAR_ANGLE = Math.PI / 4.5;   // Ends at a very high angle, more top-down.

// --- TRANSITION TIMING & SMOOTHING ---
const FALL_TRANSITION_DURATION = 2.0;
// FIX: A single smoothing factor for all camera movement. Lower is smoother.
const CAMERA_SMOOTHING = 0.03;

// --- THIRD-PERSON CAMERA ---
const CAMERA_DISTANCE = 0.0;
const CAMERA_ELEVATION = 6.0;
const CAMERA_LOOK_AT_HEIGHT = 2.0;

export class GameCamera {
    constructor(camera, target, mapCenter) {
        this.camera = camera;
        this.target = target;
        this.mapCenter = mapCenter || new THREE.Vector3(0, 0, 0);

        // FIX: Simplified camera modes. No more 'LANDING_TRANSITION'.
        this.mode = 'CINEMATIC_FALL';
        this.pivot = new THREE.Object3D();
        this.target.add(this.pivot);

        // Third-person state (used when grounded)
        this.distance = CAMERA_DISTANCE;
        this.polar = Math.PI / 3;
        this.azimuth = Math.PI;

        // Cinematic fall state
        this.cinematicTimer = 0;

        // Vector for smoothing the look-at point to prevent jitter.
        this.smoothedLookAt = new THREE.Vector3();
    }

    reset() {
        this.mode = 'CINEMATIC_FALL';
        this.azimuth = this.target ? this.target.rotation.y + Math.PI : Math.PI;
        this.cinematicTimer = 0;

        // Initialize smoothed look-at to the player's position
        if(this.target) {
            this.smoothedLookAt.copy(this.target.position);
        }

        // Force camera to its initial position without lerping
        this.update(0, true);
    }

    // FIX: Simplified method to just switch the mode.
    checkLanding(playerIsGrounded) {
        if (playerIsGrounded && this.mode === 'CINEMATIC_FALL') {
            this.mode = 'THIRD_PERSON';
            // Pre-calculate the final third-person azimuth to prevent a "swing"
            this.azimuth = this.target.rotation.y + Math.PI;
        }
    }

    _shortestAngleDiff(a, b) {
        let diff = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
        return diff < -Math.PI ? diff + Math.PI * 2 : diff;
    }

    lerpAngle(a, b, t) {
        const delta = this._shortestAngleDiff(a, b);
        return a + delta * t;
    }

    // FIX: The update method is now the core of the new unified system.
    update(delta, forceImmediate = false) {
        if (!this.target) return;

        const targetPosition = new THREE.Vector3();
        const targetLookAt = new THREE.Vector3();

        if (this.mode === 'CINEMATIC_FALL') {
            this.cinematicTimer += delta;
            const progress = Math.min(this.cinematicTimer / FALL_TRANSITION_DURATION, 1.0);
            const easeProgress = this.easeInOutCubic(progress);

            // Interpolate Polar Angle (vertical height)
            const currentPolar = THREE.MathUtils.lerp(START_POLAR_ANGLE, END_POLAR_ANGLE, easeProgress);
            // Interpolate Azimuth Angle (horizontal rotation)
            const startAzimuth = this.target.rotation.y + Math.PI;
            const endAzimuth = Math.atan2(this.target.position.x - this.mapCenter.x, this.target.position.z - this.mapCenter.z);
            const currentAzimuth = this.lerpAngle(startAzimuth, endAzimuth, easeProgress);

            // Calculate position from orientation
            const offset = new THREE.Vector3().setFromSphericalCoords(CINEMATIC_RADIUS, currentPolar, currentAzimuth);
            targetPosition.copy(this.target.position).add(offset);

            // Interpolate Look-At Target
            targetLookAt.lerpVectors(this.target.position, this.mapCenter, easeProgress);

        } else { // THIRD_PERSON
            if (!controlsState.mouseLookActive) {
                const desiredAzimuth = this.target.rotation.y + Math.PI;
                this.azimuth = this.lerpAngle(this.azimuth, desiredAzimuth, 0.1);
            }
            const offset = new THREE.Vector3(0, CAMERA_ELEVATION, this.distance);
            offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.polar);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.azimuth);
            targetPosition.copy(this.target.position).add(offset);

            if (targetPosition.y < 0.5) targetPosition.y = 0.5;

            targetLookAt.copy(this.target.position).add(new THREE.Vector3(0, CAMERA_LOOK_AT_HEIGHT, 0));
        }

        // --- UNIFIED SMOOTHING ---
        // This single block now handles all camera movement, including the transition.
        if (forceImmediate) {
            this.camera.position.copy(targetPosition);
            this.smoothedLookAt.copy(targetLookAt);
        } else {
            this.camera.position.lerp(targetPosition, CAMERA_SMOOTHING);
            this.smoothedLookAt.lerp(targetLookAt, CAMERA_SMOOTHING);
        }

        this.camera.lookAt(this.smoothedLookAt);
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}