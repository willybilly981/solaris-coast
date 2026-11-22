// Keyboard and mouse state. Edge presses are consumed with take(); held keys are read with down().

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function createInput(canvas) {
  const held = new Set();
  const edge = new Set();
  const mouse = { left: false, right: false, dx: 0, dy: 0, locked: false };

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) edge.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.left = false;
    mouse.right = false;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
    edge.add(`Mouse${e.button}`);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });

  return {
    mouse,
    down: (code) => held.has(code),
    take: (code) => edge.delete(code),
    lock() {
      try {
        const p = canvas.requestPointerLock?.();
        if (p && p.catch) p.catch(() => {});
      } catch {
        // pointer lock is optional; arrow keys also turn the camera
      }
    },
    look() {
      const out = { dx: mouse.dx, dy: mouse.dy };
      mouse.dx = 0;
      mouse.dy = 0;
      return out;
    },
    clearEdges: () => edge.clear(),
  };
}
