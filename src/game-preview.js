/*───────────────────────────────────────────────────────────
 *  src/viewer/game-preview.js  ─  HEADLESS ENGINE VERSION
 *
 *  This script exports a single function, `createGameViewer`.
 *  It initializes the 3D world and returns a controller object (API)
 *  to interact with the running simulation (e.g., restart, destroy).
 *  It makes no assumptions about UI elements like buttons or overlays.
 *───────────────────────────────────────────────────────────*/

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Player } from './Player.js';
import { GameCamera } from './GameCamera.js';
import { controlsState, initControls, destroyControls } from './ControlsManager.js';
import { GraphicsConfig } from './GraphicsConfig.js';
import { GraphicsManager } from './GraphicsManager.js';

/*═══════════════════════════════════════════════════════════
 *  MODULE STATE
 *  These variables hold the core components of the 3D world.
 *══════════════════════════════════════════════════════════*/
const CHARACTER_FILES = ['chicken_guy.glb', 'female_officer.glb', 'food_worker.glb'];
let scene, camera, renderer, clock, raycaster, sunLight, sunTarget, sunMesh,
    moonLight, ambientLight, starField, starMaterial, player, gameCamera,
    mapCollider, graphicsManager, animationFrameId = null, loadedWorldUrl = null;

/*═══════════════════════════════════════════════════════════
 *  PUBLIC API FACTORY
 *══════════════════════════════════════════════════════════*/

/**
 * Creates and initializes a game viewer instance.
 * @param {HTMLCanvasElement} canvas The canvas element to render on.
 * @param {object} mobileControls Optional object with DOM elements for mobile touch controls.
 * @param {string} worldUrl The public URL to the world's .glb file.
 * @returns {Promise<object>} A promise that resolves with the viewer's controller API.
 */
export async function createGameViewer(canvas, mobileControls, worldUrl) {
    // [+] ADDED LOG: Confirm the function was called with the correct URL
    console.log('[GamePreview] createGameViewer received world URL:', worldUrl);
    loadedWorldUrl = worldUrl;

    // --- 1. SETUP THE 3D WORLD ---
    _initScene(canvas);
    _initLights();
    _initStars();

    graphicsManager = new GraphicsManager(scene, camera, renderer, {
        sun: sunLight, moon: moonLight, ambient: ambientLight, sunMesh, sunTarget,
    }, { material: starMaterial });
    graphicsManager.init(GraphicsConfig);

    // --- 2. LOAD ASSETS ---
    try {
        // [+] ADDED LOG: Announce the loading of the map
        console.log(`[GamePreview] Attempting to load map from: ${worldUrl}`);
        const mapPromise = new GLTFLoader().loadAsync(worldUrl)
            .catch(error => {
                // [+] ADDED LOG: Specific error for map loading failure
                console.error(`[GamePreview] FAILED to load map glb from: ${worldUrl}`, error);
                // Re-throw with more context
                throw new Error(`MapLoadError: Could not load the main world file. ${error.message}`);
            });

        // The _loadRandomCharacter function now also has better logging
        const characterPromise = _loadRandomCharacter();

        const [mapGltf, heroGltf] = await Promise.all([mapPromise, characterPromise]);

        // [+] ADDED LOG: Confirm successful loading
        console.log('[GamePreview] Both map and character assets loaded successfully.');

    const mapCenter = _setupMap(mapGltf);
    graphicsManager.setMap(mapGltf.scene);
    graphicsManager.processObject(mapGltf.scene);

    // --- 3. SETUP PLAYER AND CONTROLS ---
    player = new Player(scene);
    await player.load(heroGltf, mapCollider);
    graphicsManager.processObject(player.model);

    gameCamera = new GameCamera(camera, player.model, mapCenter);

    initControls(canvas, mobileControls, (e) => {
        if (gameCamera && controlsState.mouseLookActive) {
            gameCamera.azimuth -= e.movementX * 0.002;
            gameCamera.polar = THREE.MathUtils.clamp(
                gameCamera.polar - e.movementY * 0.002,
                0.6,
                Math.PI / 2 - 0.1,
            );
        }
    });

    // --- 4. AUTO-START THE GAME LOOP ---
    if (!animationFrameId) {
        _animate();
    }
    } catch (error) {
        // This will now catch the more specific error from our promises
        console.error('[GamePreview] A critical asset failed to load, aborting initialization.', error);
        _destroyAll(); // Clean up the partially initialized scene
        throw error; // Re-throw to be caught by the Vue component
    }


    // --- 5. RETURN THE CONTROLLER API ---
    return {
        /** Restarts the player and camera to their initial positions. */
        restart: () => {
            if (player) player.reset();
            if (gameCamera) gameCamera.reset();
        },
        /** Triggers a browser download of the loaded world file. */
        download: () => {
            if (!loadedWorldUrl) {
                console.error("No world URL is available for download.");
                return;
            }
            const link = document.createElement('a');
            link.href = loadedWorldUrl;
            // Create a safe filename from the URL
            const filename = loadedWorldUrl.substring(loadedWorldUrl.lastIndexOf('/') + 1) || 'world.glb';
            link.download = filename;
            link.click();
        },
        /** Cleans up the scene, renderer, and all event listeners. */
        destroy: _destroyAll,
        /** Provides direct access to the player object for advanced control. */
        getPlayer: () => player,
        /** Provides direct access to the camera object. */
        getCamera: () => camera,
    };
}

/*══════════════════════════════════════════════════════════
 *  CORE & LIFECYCLE
 *══════════════════════════════════════════════════════════*/

function _animate() {
    animationFrameId = requestAnimationFrame(_animate);
    const dt = clock.getDelta();

    // Update game objects
    if (player) player.update(dt, controlsState, mapCollider, raycaster);
    if (gameCamera) {
        gameCamera.checkLanding(player.timeSinceGrounded < 0.2);
        gameCamera.update(dt);
    }

    // Update graphics and render the frame
    if (graphicsManager) {
        graphicsManager.update(dt, GraphicsConfig, {
            sunPosition: sunLight.position,
            sunTargetPosition: sunTarget.position,
            playerPosition: player.model.position,
        });
    } else {
        renderer.render(scene, camera);
    }
}

function _destroyAll() {
    if (animationFrameId != null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    destroyControls();
    window.removeEventListener('resize', _onWindowResize);
    if (graphicsManager) graphicsManager.dispose();

    if (scene) {
        scene.traverse((obj) => {
            if (obj.isMesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((m) => m.dispose());
                } else if (obj.material?.isMaterial) {
                    obj.material.dispose();
                }
            }
        });
    }
    starField?.geometry?.dispose();
    starMaterial?.dispose();
    if (renderer) renderer.dispose();

    // Clear all state variables
    scene = camera = renderer = clock = raycaster = sunLight = sunTarget = sunMesh =
    moonLight = ambientLight = starField = starMaterial = player = gameCamera =
    mapCollider = graphicsManager = loadedWorldUrl = null;
    console.log('[GamePreview] Instance destroyed.');
}

/*══════════════════════════════════════════════════════════
 *  INTERNAL HELPERS
 *══════════════════════════════════════════════════════════*/

function _initScene(canvas) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const useBuiltInAA = !(GraphicsConfig.postProcessing.enabled && GraphicsConfig.postProcessing.effects.smaa.enabled);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: useBuiltInAA, logarithmicDepthBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    window.addEventListener('resize', _onWindowResize);
}

function _onWindowResize() {
    if (!renderer || !camera) return;
    const { innerWidth: w, innerHeight: h } = window;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (graphicsManager) graphicsManager.onResize(w, h);
}

function _initLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    sunLight = new THREE.DirectionalLight(0xffffff, 4.0);
    sunTarget = new THREE.Object3D();
    sunLight.target = sunTarget;
    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff5c2 }));
    moonLight = new THREE.DirectionalLight(0xbfd4ff, 0);
    scene.add(ambientLight, sunLight, sunTarget, sunMesh, moonLight);
}

function _initStars() {
    const COUNT = 2000;
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 2000;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 2000;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 2000;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0 });
    starField = new THREE.Points(geo, starMaterial);
    scene.add(starField);
}

function _loadRandomCharacter() {
    const filename = CHARACTER_FILES[Math.floor(Math.random() * CHARACTER_FILES.length)];
    // Assumes characters are in a relative 'assets/characters' folder
    const characterPath = `/assets/characters/${filename}`;

    // [+] ADDED LOG: Announce the loading of the character
    console.log(`[GamePreview] Attempting to load character from: ${characterPath}`);

    return new GLTFLoader().loadAsync(characterPath)
        .catch(error => {
            // [+] ADDED LOG: Specific error for character loading failure
            console.error(`[GamePreview] FAILED to load character glb from: ${characterPath}`, error);
            // Re-throw with more context
            throw new Error(`CharacterLoadError: Could not load the character file. ${error.message}`);
        });
}

function _setupMap(gltf) {
    const map = gltf.scene;
    const meshes = [];
    map.traverse((n) => n.isMesh && meshes.push(n));
    mapCollider = meshes;
    scene.add(map);
    return new THREE.Box3().setFromObject(map).getCenter(new THREE.Vector3());
}