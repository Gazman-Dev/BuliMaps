// src/viewer/GraphicsConfig.js

export const GraphicsConfig = {
    // --- Shadow System ---
    shadows: {
        enabled: true,
        useCascadedShadows: false,
        shadowMapSize: 2048,
        csm: { cascades: 4, mode: 'practical' },
        fallback: { altitudeCutoff: 100, updateFrequency: 0.5 },
    },

    // --- Material Enhancements ---
    materials: {
        useEnhancedMaterials: false,
    },

    // --- Environmental Effects ---
    environment: {
        useAtmosphericFog: true,
        useParticleSystem: false,
        dayNightCycle: {
            enabled: true,
            cycleSpeed: 0.05,
            sunDistance: 600,
        },
    },

    // --- Post-Processing ---
    postProcessing: {
        enabled: true,
        effects: {
            smaa: { enabled: true },
            ssao: { enabled: false, kernelRadius: 0.8, minDistance: 0.001, maxDistance: 0.1 },
            bloom: { enabled: false, strength: 1.2, radius: 0.5, threshold: 0.85 },
            godRays: { enabled: false, exposure: 0.4, decay: 0.95, density: 0.8, weight: 0.5 },
            colorGrading: { enabled: true, contrast: 1.1, brightness: 0.1, saturation: 1.2, vignette: 0.4 },
            bokeh: { enabled: false, focus: 50.0, aperture: 0.00005, maxblur: 0.01 },
        }
    },
};