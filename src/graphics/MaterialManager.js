// src/viewer/graphics/MaterialManager.js

import * as THREE from 'three';

export class MaterialManager {
    constructor() {
        this.config = {};
        this.shadowManager = null;
    }

    init(config, shadowManager) {
        this.config = config;
        this.shadowManager = shadowManager; // Keep a reference to apply CSM to new materials
        console.log('[MaterialManager] Initialized.');
    }

    processObject(object) {
        if (!this.config.useEnhancedMaterials) return;

        object.traverse((node) => {
            if (!node.isMesh || !node.material) return;

            const oldMat = node.material;
            const newMat = new THREE.MeshStandardMaterial({
                color: oldMat.color || 0xffffff,
                map: oldMat.map || null,
                roughness: 0.7,
                metalness: 0.0,
                envMapIntensity: 1.0,
            });

            if (oldMat.map) {
                const normalMap = this._generateNormalMap(oldMat.map);
                if (normalMap) {
                    newMat.normalMap = normalMap;
                    newMat.normalScale = new THREE.Vector2(0.5, 0.5);
                }
            }

            if (oldMat.emissive && (oldMat.emissive.r > 0 || oldMat.emissive.g > 0 || oldMat.emissive.b > 0)) {
                newMat.emissive = oldMat.emissive;
                newMat.emissiveMap = oldMat.map || null;
                newMat.emissiveIntensity = 2.0;
            }

            node.material = newMat;

            // If the shadow manager is using CSM, it needs to know about the new material.
            if (this.shadowManager?.csm) {
                this.shadowManager.csm.setupMaterial(node.material);
            }

            oldMat.dispose();
        });
    }

    _getPixelBrightness(imageData, x, y) {
        const i = (y * imageData.width + x) * 4;
        return 0.2126 * imageData.data[i] + 0.7152 * imageData.data[i + 1] + 0.0722 * imageData.data[i + 2];
    }

    _generateNormalMap(texture) {
        const image = texture.image;
        if (!image || !image.width || image.width === 0) return null;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const normalData = ctx.createImageData(canvas.width, canvas.height);

        for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
                const idx = (y * canvas.width + x) * 4;
                const tl = this._getPixelBrightness(imageData, x - 1, y - 1), tm = this._getPixelBrightness(imageData, x, y - 1), tr = this._getPixelBrightness(imageData, x + 1, y - 1);
                const ml = this._getPixelBrightness(imageData, x - 1, y), mr = this._getPixelBrightness(imageData, x + 1, y);
                const bl = this._getPixelBrightness(imageData, x - 1, y + 1), bm = this._getPixelBrightness(imageData, x, y + 1), br = this._getPixelBrightness(imageData, x + 1, y + 1);
                const dX = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
                const dY = (bl + 2 * bm + br) - (tl + 2 * tm + tr);
                normalData.data[idx] = (dX + 255) * 0.5;
                normalData.data[idx + 1] = (dY + 255) * 0.5;
                normalData.data[idx + 2] = 255;
                normalData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(normalData, 0, 0);
        const newNormalTexture = new THREE.CanvasTexture(canvas);
        newNormalTexture.needsUpdate = true;
        return newNormalTexture;
    }

    dispose() {
        console.log('[MaterialManager] Disposed.');
    }
}