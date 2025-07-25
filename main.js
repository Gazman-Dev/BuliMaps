import { createGameViewer } from './src/game-preview.js';

// --- STANDALONE TEMPLATE CONFIG ---

// The local asset path for the 3D world model.
// IMPORTANT: You must have a file at './assets/map.glb' for this to work.
const worldUrl = 'assets/map.glb';

// --- APPLICATION STARTUP ---

document.addEventListener('DOMContentLoaded', async () => {
    // The `async` keyword is used because createGameViewer is an async function.

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Fatal Error: Canvas element with ID "game-canvas" was not found in the DOM.');
        return;
    }

    // Example of how to enable mobile controls:
    // 1. Uncomment the #mobile-controls div in index.html.
    // 2. Uncomment the following lines.
    /*
    const mobileControls = {
        container: document.getElementById('mobile-controls'),
        forward: document.getElementById('move-forward'),
        backward: document.getElementById('move-backward'),
        left: document.getElementById('turn-left'),
        right: document.getElementById('turn-right'),
        jump: document.getElementById('jump-btn')
    };
    */

    try {
        // Create the game viewer instance.
        // Pass `null` for mobileControls if they are not enabled.
        const gameController = await createGameViewer(canvas, null /* or mobileControls */, worldUrl);

        // For easy debugging, we can attach the controller to the window object.
        // This allows developers to open the browser console and type `window.game.restart()` etc.
        window.game = gameController;
        console.log("Game viewer created successfully. Access the controller API via `window.game`.");

        // As a best practice, clean up the viewer when the page is closed.
        window.addEventListener('beforeunload', () => {
            window.game?.destroy(); // Use optional chaining for safety
        });

    } catch (error) {
        console.error("Failed to create the game viewer:", error);
        // You could display a user-friendly error message on the page here.
    }
});