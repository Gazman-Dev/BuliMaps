// src/viewer/graphics/PostProcessingManager.js

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export class PostProcessingManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.composer = null;
        this.passes = {}; // To hold references to each pass for runtime toggling
    }

    init(config) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // --- Initialize passes based on config ---
        if (config.ssao.enabled) this.addSSAOPass(config.ssao);
        if (config.bloom.enabled) this.addBloomPass(config.bloom);
        if (config.bokeh.enabled) this.addBokehPass(config.bokeh);
        if (config.godRays.enabled) this.addGodRaysPass(config.godRays);
        if (config.smaa.enabled) this.addSMAAPass();
        if (config.colorGrading.enabled) this.addColorGradingPass(config.colorGrading);

        console.log('[PostProcessingManager] Initialized with passes:', Object.keys(this.passes));
    }

    /**
     * Checks if the post-processing pipeline is active and has passes.
     */
    isActive() {
        return this.composer && this.composer.passes.length > 1;
    }

    getComposer() {
        return this.composer;
    }

    /**
     * Updates pass uniforms and handles runtime toggling of effects.
     * @param {object} config The `effects` object from GraphicsConfig.
     * @param {object} worldState Contains dynamic data like sun position.
     */
    update(config, worldState) {
        // Example of updating a uniform every frame
        if (this.passes.godRays && config.godRays.enabled) {
            const screenPos = worldState.sunPosition.clone().project(this.camera);
            this.passes.godRays.uniforms.lightPosition.value.set(
                (screenPos.x + 1) / 2,
                (screenPos.y + 1) / 2
            );
        }

        // Example of toggling an effect at runtime
        for (const key in this.passes) {
            if (config[key]) {
                this.passes[key].enabled = config[key].enabled;
            }
        }
    }

    onResize(width, height) {
        this.composer.setSize(width, height);
        // Some passes might need individual resizing
        if (this.passes.smaa) {
            this.passes.smaa.setSize(width * this.renderer.getPixelRatio(), height * this.renderer.getPixelRatio());
        }
    }

    dispose() {
        for (const pass of Object.values(this.passes)) {
            // Custom dispose logic might be needed for some passes
            if (pass.dispose) pass.dispose();
        }
        this.composer.dispose();
        console.log('[PostProcessingManager] Disposed.');
    }

    // --- Pass Creation Methods ---

    addSSAOPass(cfg) {
        const pass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
        pass.kernelRadius = cfg.kernelRadius;
        pass.minDistance = cfg.minDistance;
        pass.maxDistance = cfg.maxDistance;
        this.composer.addPass(pass);
        this.passes.ssao = pass;
    }

    addBloomPass(cfg) {
        const pass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), cfg.strength, cfg.radius, cfg.threshold);
        this.composer.addPass(pass);
        this.passes.bloom = pass;
    }

    addGodRaysPass(cfg) {
        const godRaysShader = {
            uniforms: { tDiffuse: { value: null }, lightPosition: { value: new THREE.Vector2(0.5, 0.5) }, exposure: { value: cfg.exposure }, decay: { value: cfg.decay }, density: { value: cfg.density }, weight: { value: cfg.weight }, samples: { value: 100 } },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 lightPosition; uniform float exposure; uniform float decay; uniform float density; uniform float weight; uniform int samples; varying vec2 vUv; void main() { vec2 texCoord = vUv; vec2 deltaTextCoord = texCoord - lightPosition; deltaTextCoord *= 1.0 / float(samples) * density; vec4 color = texture2D(tDiffuse, texCoord); float illuminationDecay = 1.0; for(int i = 0; i < 100; i++) { if(i >= samples) break; texCoord -= deltaTextCoord; vec4 samp = texture2D(tDiffuse, texCoord); samp *= illuminationDecay * weight; color += samp; illuminationDecay *= decay; } gl_FragColor = color * exposure; }`
        };
        const pass = new ShaderPass(godRaysShader);
        this.composer.addPass(pass);
        this.passes.godRays = pass;
    }

    addBokehPass(cfg) {
        const pass = new BokehPass(this.scene, this.camera, {
            focus: cfg.focus, aperture: cfg.aperture, maxblur: cfg.maxblur,
            width: window.innerWidth, height: window.innerHeight
        });
        this.composer.addPass(pass);
        this.passes.bokeh = pass;
    }

    addColorGradingPass(cfg) {
        const colorShader = {
            uniforms: { tDiffuse: { value: null }, contrast: { value: cfg.contrast }, brightness: { value: cfg.brightness }, saturation: { value: cfg.saturation }, vignette: { value: cfg.vignette } },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast; uniform float brightness; uniform float saturation; uniform float vignette; varying vec2 vUv; vec3 adjustSaturation(vec3 color, float sat) { float grey = dot(color, vec3(0.2126, 0.7152, 0.0722)); return mix(vec3(grey), color, sat); } void main() { vec4 tex = texture2D(tDiffuse, vUv); vec3 color = tex.rgb; color = (color - 0.5) * contrast + 0.5 + brightness; color = adjustSaturation(color, saturation); vec2 coord = (vUv - 0.5) * 2.0; float vignetteFactor = 1.0 - dot(coord, coord) * vignette; color *= vignetteFactor; gl_FragColor = vec4(color, tex.a); }`
        };
        const pass = new ShaderPass(colorShader);
        this.composer.addPass(pass);
        this.passes.colorGrading = pass;
    }

    addSMAAPass() {
        const pass = new SMAAPass(window.innerWidth * this.renderer.getPixelRatio(), window.innerHeight * this.renderer.getPixelRatio());
        this.composer.addPass(pass);
        this.passes.smaa = pass;
    }
}