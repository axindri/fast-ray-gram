// Header oneko — patrols by day, sleeps on "m" at night, based on https://github.com/adryd325/oneko.js

const NEKO_GIF = "/assets/oneko.gif";
const NEKO_SIZE = 32;
const NEKO_HALF = NEKO_SIZE / 2;
const NEKO_SPEED = 8;

const spriteSets = {
  tired: [[-3, -2]],
  sleeping: [
    [-2, 0],
    [-2, -1],
  ],
  E: [
    [-3, 0],
    [-3, -1],
  ],
  W: [
    [-4, -2],
    [-4, -3],
  ],
};

let cleanupOneko = null;

function isSleepingHours(date = new Date()) {
  const hour = date.getHours();
  return hour >= 21 || hour <= 8;
}

export function initFooterOneko() {
  cleanupOneko?.();

  const topbar = document.querySelector(".topbar");
  const seat = document.querySelector(".oneko-seat");

  if (!topbar || !seat) {
    return;
  }

  cleanupOneko = startOneko(topbar, seat);
}

function startOneko(topbar, seat) {
  const nekoEl = document.createElement("div");
  let frameCount = 0;
  let sleepFrame = 0;
  let lastFrameTimestamp = 0;
  let rafId = 0;
  let sleeping = isSleepingHours();
  let patrolDirection = -1;
  let nekoPosX = 0;
  let nekoPosY = 0;

  nekoEl.id = "oneko";
  nekoEl.setAttribute("aria-hidden", "true");
  nekoEl.style.cssText = `
    width: ${NEKO_SIZE}px;
    height: ${NEKO_SIZE}px;
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    image-rendering: pixelated;
    z-index: 2;
    background-image: url(${NEKO_GIF});
  `;

  topbar.appendChild(nekoEl);

  function patrolBounds() {
    const minX = NEKO_HALF + 8;
    const maxX = topbar.clientWidth - NEKO_HALF - 8;
    const y = topbar.clientHeight - NEKO_HALF - 4;

    return {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      y: Math.max(NEKO_HALF, y),
    };
  }

  function sleepPosition() {
    const topbarRect = topbar.getBoundingClientRect();
    const seatRect = seat.getBoundingClientRect();
    const x = seatRect.left - topbarRect.left + seatRect.width / 2;
    const y = seatRect.top - topbarRect.top;

    nekoPosX = x;
    nekoPosY = y - NEKO_HALF + 16;
  }

  function setSprite(name, frame) {
    const sprite = spriteSets[name][frame % spriteSets[name].length];
    nekoEl.style.backgroundPosition = `${sprite[0] * NEKO_SIZE}px ${sprite[1] * NEKO_SIZE}px`;
  }

  function renderPosition() {
    nekoEl.style.left = `${nekoPosX - NEKO_HALF}px`;
    nekoEl.style.top = `${nekoPosY - NEKO_HALF}px`;
  }

  function initPatrolPosition() {
    const { maxX, y } = patrolBounds();
    nekoPosX = maxX;
    nekoPosY = y;
    patrolDirection = -1;
  }

  function patrolFrame() {
    const { minX, maxX, y } = patrolBounds();
    nekoPosY = y;

    nekoPosX += patrolDirection * NEKO_SPEED;

    if (nekoPosX <= minX) {
      nekoPosX = minX;
      patrolDirection = 1;
    }

    if (nekoPosX >= maxX) {
      nekoPosX = maxX;
      patrolDirection = -1;
    }

    setSprite(patrolDirection > 0 ? "E" : "W", frameCount);
    frameCount += 1;
  }

  function sleepFrameTick() {
    sleepPosition();

    if (sleepFrame < 8) {
      setSprite("tired", 0);
    } else {
      setSprite("sleeping", Math.floor(sleepFrame / 4));
    }

    sleepFrame += 1;
  }

  function renderFrame() {
    const nowSleeping = isSleepingHours();

    if (nowSleeping !== sleeping) {
      sleeping = nowSleeping;
      sleepFrame = 0;
      frameCount = 0;

      if (sleeping) {
        sleepPosition();
      } else {
        initPatrolPosition();
      }
    }

    if (sleeping) {
      sleepFrameTick();
      renderPosition();
      return;
    }

    patrolFrame();
    renderPosition();
  }

  function onAnimationFrame(timestamp) {
    if (!nekoEl.isConnected) {
      return;
    }

    if (!lastFrameTimestamp) {
      lastFrameTimestamp = timestamp;
    }

    if (timestamp - lastFrameTimestamp > 100) {
      lastFrameTimestamp = timestamp;
      renderFrame();
    }

    rafId = window.requestAnimationFrame(onAnimationFrame);
  }

  function onResize() {
    if (sleeping) {
      sleepPosition();
    } else {
      const { minX, maxX, y } = patrolBounds();
      nekoPosX = Math.min(Math.max(nekoPosX, minX), maxX);
      nekoPosY = y;
    }

    renderPosition();
  }

  if (sleeping) {
    sleepPosition();
  } else {
    initPatrolPosition();
  }

  renderFrame();
  window.addEventListener("resize", onResize);
  rafId = window.requestAnimationFrame(onAnimationFrame);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    nekoEl.remove();
  };
}
