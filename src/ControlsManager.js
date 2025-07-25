// src/viewer/ControlsManager.js

export const controlsState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  mouseLookActive: false,
};

// THIS IS THE FIX (Part 1):
// Declare the event handler variables in the module scope, initially as null.
// This allows both `initControls` and `destroyControls` to access them.
let onMouseMoveCallback = null;
let boundKeyDown = null;
let boundKeyUp = null;
let boundMouseDown = null;
let boundMouseUp = null;
let boundMouseMove = null;
let boundContextMenu = null;
// We'll also need an array to keep track of the mobile button listeners to remove them.
let mobileListeners = [];


function setupKeyEvents() {
  // Assign the function to the module-scoped variable.
  boundKeyDown = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': controlsState.forward = true; break;
      case 'KeyS': case 'ArrowDown': controlsState.backward = true; break;
      case 'KeyA': case 'ArrowLeft': controlsState.left = true; break;
      case 'KeyD': case 'ArrowRight': controlsState.right = true; break;
      case 'Space': controlsState.jump = true; break;
    }
  };
  // Assign the function to the module-scoped variable.
  boundKeyUp = (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': controlsState.forward = false; break;
      case 'KeyS': case 'ArrowDown': controlsState.backward = false; break;
      case 'KeyA': case 'ArrowLeft': controlsState.left = false; break;
      case 'KeyD': case 'ArrowRight': controlsState.right = false; break;
      case 'Space': controlsState.jump = false; break;
    }
  };
  window.addEventListener('keydown', boundKeyDown);
  window.addEventListener('keyup', boundKeyUp);
}

function setupMouseEvents(canvas) {
    boundMouseDown = (e) => {
        if (e.button === 0) {
            canvas.requestPointerLock();
            controlsState.mouseLookActive = true;
        }
    };
    boundMouseUp = (e) => {
        if (e.button === 0) {
            document.exitPointerLock();
            controlsState.mouseLookActive = false;
        }
    };
    boundMouseMove = (e) => {
        if (document.pointerLockElement === canvas) {
            onMouseMoveCallback?.(e);
        }
    };
    canvas.addEventListener('mousedown', boundMouseDown);
    window.addEventListener('mouseup', boundMouseUp);
    window.addEventListener('mousemove', boundMouseMove);
}

function setupButtonEvents(mobileControls) {
    if (!mobileControls || !mobileControls.container) return;
    mobileListeners = []; // Clear any previous listeners

    const { forward, backward, left, right, jump } = mobileControls;

    const addListeners = (element, key) => {
        if (!element) return;
        const onStart = () => { controlsState[key] = true; };
        const onEnd = () => { controlsState[key] = false; };

        element.addEventListener('touchstart', onStart, { passive: true });
        element.addEventListener('touchend', onEnd);
        element.addEventListener('mousedown', onStart);
        element.addEventListener('mouseup', onEnd);

        // Keep track of what we added so we can remove it later.
        mobileListeners.push({ element, onStart, onEnd });
    };

    addListeners(forward, 'forward');
    addListeners(backward, 'backward');
    addListeners(left, 'left');
    addListeners(right, 'right');
    addListeners(jump, 'jump');
}


export function initControls(canvas, mobileControls, onMouseMove) {
    onMouseMoveCallback = onMouseMove;
    setupKeyEvents();
    setupMouseEvents(canvas);
    setupButtonEvents(mobileControls);

    boundContextMenu = (e) => e.preventDefault();
    window.addEventListener('contextmenu', boundContextMenu);
}

export function destroyControls() {
    // THIS IS THE FIX (Part 2):
    // Now this function can safely access the module-scoped variables
    // and remove the listeners. We also add checks to ensure they are not null.
    if (boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
    if (boundKeyUp) window.removeEventListener('keyup', boundKeyUp);
    // There's no direct way to remove the listener from the canvas if the
    // canvas element is gone, but we can remove the window listeners.
    if (boundMouseUp) window.removeEventListener('mouseup', boundMouseUp);
    if (boundMouseMove) window.removeEventListener('mousemove', boundMouseMove);
    if (boundContextMenu) window.removeEventListener('contextmenu', boundContextMenu);

    // Clean up mobile button listeners
    mobileListeners.forEach(({ element, onStart, onEnd }) => {
        element.removeEventListener('touchstart', onStart);
        element.removeEventListener('touchend', onEnd);
        element.removeEventListener('mousedown', onStart);
        element.removeEventListener('mouseup', onEnd);
    });

    // Reset all handler variables to null for a clean state
    boundKeyDown = boundKeyUp = boundMouseDown = boundMouseUp = boundMouseMove = boundContextMenu = null;
    mobileListeners = [];

    // Reset control state
    Object.keys(controlsState).forEach(key => controlsState[key] = false);
}