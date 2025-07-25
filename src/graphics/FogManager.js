// src/viewer/graphics/FogManager.js

import * as THREE from 'three';

export class FogManager {
    constructor(scene) {
        this.scene = scene;
    }

    init() {
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);
        console.log('[FogManager] Initialized.');
    }

    update(worldState) {
        // Sync fog color with the background color from DayNightCycle
        if (this.scene.fog) {
            this.scene.fog.color.copy(this.scene.background);
        }
    }

    dispose() {
        this.scene.fog = null;
        console.log('[FogManager] Disposed.');
    }
}