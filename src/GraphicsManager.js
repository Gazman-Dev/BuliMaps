// src/viewer/GraphicsManager.js

import { PostProcessingManager } from './graphics/PostProcessingManager.js';
import { DayNightCycleManager } from './graphics/DayNightCycleManager.js';
import { ShadowManager } from './graphics/ShadowManager.js';
import { MaterialManager } from './graphics/MaterialManager.js';
import { FogManager } from './graphics/FogManager.js';
import { ParticleManager } from './graphics/ParticleManager.js';

export class GraphicsManager {
    constructor(scene, camera, renderer, lights, stars) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.lights = lights;
        this.stars = stars;

        this.shadowManager = null;
        this.materialManager = null;
        this.fogManager = null;
        this.particleManager = null;
        this.dayNightCycleManager = null;
        this.postProcessingManager = null;
    }

    init(config) {
        console.log('[GraphicsManager] Initializing with config:', config);
        this.renderer.shadowMap.enabled = config.shadows.enabled;

        if (config.shadows.enabled) {
            this.shadowManager = new ShadowManager(this.scene, this.camera, this.renderer, this.lights.sun);
            this.shadowManager.init(config.shadows);
        }
        this.materialManager = new MaterialManager();
        this.materialManager.init(config.materials, this.shadowManager);

        if (config.environment.useAtmosphericFog) {
            this.fogManager = new FogManager(this.scene);
            this.fogManager.init();
        }
        if (config.environment.useParticleSystem) {
            this.particleManager = new ParticleManager(this.scene);
            this.particleManager.init();
        }
        // FIX: Corrected the typo from `_config` to `config`.
        if (config.environment.dayNightCycle.enabled) {
            this.dayNightCycleManager = new DayNightCycleManager(this.scene, this.lights, this.stars);
            this.dayNightCycleManager.init(config.environment.dayNightCycle);
        }
        if (config.postProcessing.enabled) {
            this.postProcessingManager = new PostProcessingManager(this.scene, this.camera, this.renderer);
            this.postProcessingManager.init(config.postProcessing.effects);
        }
    }

    /**
     * Orchestrate communication between managers after the map is loaded.
     * This ensures critical values like sun distance are consistent across modules.
     * @param {THREE.Object3D} mapObject The main scene object for the map.
     */
    setMap(mapObject) {
        if (this.shadowManager) {
            this.shadowManager.setMap(mapObject);

            // After the shadow manager calculates the optimal sun distance, we must
            // pass that value to the DayNightCycleManager. This synchronizes the
            // sun's physical position with the shadow camera's frustum settings.
            if (this.dayNightCycleManager) {
                const optimalDistance = this.shadowManager.getSunDistance();
                this.dayNightCycleManager.setSunDistance(optimalDistance);
            }
        }
    }

    processObject(object) {
        if (this.shadowManager) this.shadowManager.processObject(object);
        if (this.materialManager) this.materialManager.processObject(object);
    }

    update(delta, config, worldState) {
        if (this.dayNightCycleManager) this.dayNightCycleManager.update(delta, worldState.playerPosition);
        if (this.fogManager) this.fogManager.update(worldState);
        if (this.particleManager) this.particleManager.update(delta);
        if (this.shadowManager) this.shadowManager.update(delta, worldState);
        if (this.postProcessingManager) this.postProcessingManager.update(config.postProcessing.effects, worldState);

        if (config.postProcessing.enabled && this.postProcessingManager?.isActive()) {
            this.postProcessingManager.getComposer().render(delta);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onResize(width, height) {
        if (this.postProcessingManager) this.postProcessingManager.onResize(width, height);
    }

    dispose() {
        console.log('[GraphicsManager] Disposing all graphics modules.');
        this.shadowManager?.dispose();
        this.materialManager?.dispose();
        this.fogManager?.dispose();
        this.particleManager?.dispose();
        this.dayNightCycleManager?.dispose();
        this.postProcessingManager?.dispose();
    }
}