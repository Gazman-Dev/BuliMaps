// src/viewer/graphics/DayNightCycleManager.js

import * as THREE from 'three';

export class DayNightCycleManager {
    constructor(scene, lights, stars) {
        this.scene = scene;
        this.lights = lights; // { sun, moon, ambient, sunMesh, sunTarget }
        this.stars = stars;   // { material }

        this.timeOfDay = Math.PI / 3; // Start in the morning
        this.config = {};
        // FIX: Add a property to hold the sun distance, which may be updated dynamically.
        this.sunDistance = 600;
    }

    /**
     * Initializes the manager with settings from the main config.
     * @param {object} config The dayNightCycle section from GraphicsConfig.
     */
    init(config) {
        this.config = config;
        // Initialize sun distance from config, but it can be overridden later.
        this.sunDistance = config.sunDistance;
        console.log('[DayNightCycleManager] Initialized.');
    }

    /**
     * FIX: Add a setter so the GraphicsManager can synchronize the sun distance.
     * @param {number} distance The optimal sun distance calculated by the ShadowManager.
     */
    setSunDistance(distance) {
        this.sunDistance = distance;
    }

    /**
     * Updates the position and intensity of lights, sky color, and stars.
     * @param {number} delta Time since the last frame.
     * @param {THREE.Vector3} playerPosition The current position of the player.
     */
    update(delta, playerPosition) {
        if (!this.config.enabled) return;

        this.timeOfDay += delta * this.config.cycleSpeed;

        // FIX: Use the class property for sun distance, not the static config value.
        const sunDistance = this.sunDistance;
        const groundTargetPosition = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);

        const sunOrbitalOffset = new THREE.Vector3(
            sunDistance * Math.cos(this.timeOfDay),
            sunDistance * Math.sin(this.timeOfDay),
            100 // Keep sun slightly offset on the Z-axis for better shadow angles
        );

        // Update light and mesh positions
        this.lights.sun.position.copy(playerPosition).add(sunOrbitalOffset);
        this.lights.sunTarget.position.copy(groundTargetPosition);
        this.lights.sunMesh.position.copy(this.lights.sun.position);
        this.lights.moon.position.copy(playerPosition).sub(sunOrbitalOffset);

        // Calculate the day factor (0 for night, 1 for day)
        const dayFactor = THREE.MathUtils.clamp((this.lights.sun.position.y - playerPosition.y) / sunDistance, 0, 1);

        // Update light intensities
        this.lights.sun.intensity = 8.0 * Math.sqrt(dayFactor);
        this.lights.moon.intensity = 3 * Math.sqrt(1 - dayFactor);
        this.lights.ambient.intensity = 0.5 + 0.5 * dayFactor;

        // Update environment colors
        const nightColor = new THREE.Color(0x0d0d1a);
        const dayColor = new THREE.Color(0x87ceeb);
        this.scene.background.copy(dayColor).lerp(nightColor, 1 - dayFactor);

        if (this.scene.fog) {
            this.scene.fog.color.copy(this.scene.background);
        }

        // Update star visibility
        this.stars.material.opacity = THREE.MathUtils.clamp(1 - dayFactor * 2.0, 0, 1);
    }

    dispose() {
        console.log('[DayNightCycleManager] Disposed.');
    }
}