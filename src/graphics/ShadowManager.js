// src/viewer/graphics/ShadowManager.js

import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';

export class ShadowManager {
    constructor(scene, camera, renderer, sunLight) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.sunLight = sunLight;

        this.config = {};
        this.csm = null;

        this.fallbackState = {
            mapBounds: null,
            lastPlayerPosition: new THREE.Vector3(),
            timeSinceLastUpdate: 0,
            shadowsActive: false,
            sunDistance: 600,
        };
    }

    init(config) {
        this.config = config;
        this.renderer.shadowMap.type = config.useCascadedShadows ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;

        if (config.useCascadedShadows) {
            this.initCSM();
        } else {
            this.initFallbackShadows();
        }
    }

    initCSM() {
        this.csm = new CSM({
            maxFar: this.camera.far,
            cascades: this.config.csm.cascades,
            mode: this.config.csm.mode,
            parent: this.scene,
            shadowMapSize: this.config.shadowMapSize,
            lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
            camera: this.camera
        });
        this.csm.fade = true;
        this.sunLight.castShadow = false;
        console.log('[ShadowManager] Initialized with Cascaded Shadow Maps (CSM).');
    }

    initFallbackShadows() {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(this.config.shadowMapSize, this.config.shadowMapSize);
        this.sunLight.shadow.bias = -0.0005 / (this.config.shadowMapSize / 2048);
        this.sunLight.shadow.normalBias = 0.01;

        const initialSunDistance = this.fallbackState.sunDistance;
        this.sunLight.shadow.camera.near = initialSunDistance - 200;
        this.sunLight.shadow.camera.far  = initialSunDistance + 200;
        this.sunLight.shadow.camera.updateProjectionMatrix();

        console.log(`[ShadowManager] Initialized with Fallback shadow system.`);
    }

    setMap(mapObject) {
        if (!this.config.useCascadedShadows) {
            this.fallbackState.mapBounds = new THREE.Box3().setFromObject(mapObject);

            const mapSize = this.fallbackState.mapBounds.getSize(new THREE.Vector3());
            const radius = Math.max(mapSize.x, mapSize.z) * 0.6;
            const sizeFactor = Math.min(radius / 50, 4);
            this.fallbackState.sunDistance = 400 + (sizeFactor * 150);

            const mapCenter = this.fallbackState.mapBounds.getCenter(new THREE.Vector3());
            mapCenter.y = 0;

            this.updateFallbackFrustum(mapCenter, true);
        }
    }

    /**
     * FIX: Add a getter to expose the calculated sun distance to other modules.
     * @returns {number} The optimal sun distance for the current map.
     */
    getSunDistance() {
        return this.fallbackState.sunDistance;
    }

    processObject(object) {
        object.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (this.csm && node.material) {
                    this.csm.setupMaterial(node.material);
                }
            }
        });
    }

    update(delta, worldState) {
        if (this.csm) {
            const lightDir = new THREE.Vector3().subVectors(this.sunLight.position, worldState.sunTargetPosition).normalize();
            this.csm.lightDirection = lightDir.multiplyScalar(-1);
            this.csm.update();
        } else {
            this.updateFallbackSystem(delta, worldState.playerPosition);
        }
    }

    updateFallbackSystem(delta, playerPosition) {
        this.fallbackState.timeSinceLastUpdate += delta;
        const playerIsHigh = playerPosition.y > this.config.fallback.altitudeCutoff;

        if (playerIsHigh && this.fallbackState.shadowsActive) {
            this.sunLight.castShadow = false;
            this.fallbackState.shadowsActive = false;
        } else if (!playerIsHigh && !this.fallbackState.shadowsActive) {
            this.sunLight.castShadow = true;
            this.fallbackState.shadowsActive = true;
        }

        if (this.fallbackState.shadowsActive) {
            this.updateFallbackFrustum(playerPosition);
        }
    }

    getOptimalShadowBoxSize(mapBounds, playerPosition) {
        const baseSize = 25;
        const mapCenter = mapBounds.getCenter(new THREE.Vector3());
        const mapSize = mapBounds.getSize(new THREE.Vector3());
        const mapRadius = Math.max(mapSize.x, mapSize.z) * 0.6;
        const mapSizeFactor = Math.min(mapRadius / 30, 2.5);

        const distanceFromCenter = playerPosition.distanceTo(mapCenter);
        const edgeProximityFactor = Math.min(distanceFromCenter / mapRadius, 1) * 0.3;

        return baseSize + (mapSizeFactor * 15) + (edgeProximityFactor * 10);
    }

    updateFallbackFrustum(playerPosition, force = false) {
        const state = this.fallbackState;
        if (!state.mapBounds) return;
        if (!force && state.timeSinceLastUpdate < this.config.fallback.updateFrequency) return;

        const movementThreshold = 5;
        if (!force && state.lastPlayerPosition.distanceTo(playerPosition) < movementThreshold) return;

        const optimalBoxSize = this.getOptimalShadowBoxSize(state.mapBounds, playerPosition);
        const currentSize = (this.sunLight.shadow.camera.right - this.sunLight.shadow.camera.left) / 2;
        const newSize = THREE.MathUtils.lerp(currentSize, optimalBoxSize, 0.1);

        this.sunLight.shadow.camera.left   = -newSize;
        this.sunLight.shadow.camera.right  =  newSize;
        this.sunLight.shadow.camera.top    =  newSize;
        this.sunLight.shadow.camera.bottom = -newSize;

        const sunDistance = state.sunDistance;
        const mapHeight = state.mapBounds.getSize(new THREE.Vector3()).y;
        const depthRange = Math.min(200, mapHeight + 100);
        this.sunLight.shadow.camera.near = sunDistance - depthRange * 0.6;
        this.sunLight.shadow.camera.far  = sunDistance + depthRange * 0.4;

        this.sunLight.shadow.camera.updateProjectionMatrix();

        state.lastPlayerPosition.copy(playerPosition);
        state.timeSinceLastUpdate = 0;
    }

    dispose() {
        if (this.csm) this.csm.dispose();
        console.log('[ShadowManager] Disposed.');
    }
}