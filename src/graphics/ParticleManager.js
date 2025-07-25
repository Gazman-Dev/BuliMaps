// src/viewer/graphics/ParticleManager.js

import * as THREE from 'three';

export class ParticleManager {
    constructor(scene) {
        this.scene = scene;
        this.particleSystem = null;
    }

    init() {
        const count = 1000;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = Math.random() * 100;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
            velocities[i * 3] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 1] = -Math.random() * 0.2;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

        const material = new THREE.PointsMaterial({
            size: 0.5, color: 0xffffff, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending,
            map: new THREE.TextureLoader().load('/assets/particle.png'), // Ensure /public/particle.png exists
            depthWrite: false,
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
        console.log('[ParticleManager] Initialized.');
    }

    update(delta) {
        if (!this.particleSystem) return;
        const positions = this.particleSystem.geometry.attributes.position.array;
        const velocities = this.particleSystem.geometry.attributes.velocity.array;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i] * delta;
            positions[i + 1] += velocities[i + 1] * delta;
            positions[i + 2] += velocities[i + 2] * delta;

            if (positions[i + 1] < 0) {
                positions[i + 1] = 100;
                positions[i] = (Math.random() - 0.5) * 200;
                positions[i + 2] = (Math.random() - 0.5) * 200;
            }
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        if (this.particleSystem) {
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
            this.scene.remove(this.particleSystem);
        }
        console.log('[ParticleManager] Disposed.');
    }
}