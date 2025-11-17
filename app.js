/* Configuration */
const BASE_PATH = "./contents/images"; // directory containing 1.svg, 2.svg, ...
const EXT = "svg";
const START_INDEX = 1;
const MAX_AUTO_DETECT = 200; // upper bound for auto detection (change if needed)
const SCROLL_PER_IMAGE_VH = 70; // scroll distance per image transition (smaller = faster transition)

/* DOM refs */
const stage = document.getElementById("stage");
const stack = document.getElementById("stack");

/* Utility: check if a file exists using HEAD, with an img() fallback for servers that don't allow HEAD */
async function exists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (res.ok) return true;
    // Some servers return 405 for HEAD; fallback to GET with no-store and abort quickly on non-OK
    if (res.status === 405) {
      const resGet = await fetch(url, { method: "GET", cache: "no-store" });
      return resGet.ok;
    }
    return false;
  } catch {
    // Fallback to Image object check (works same-origin on GitHub Pages)
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url + `?t=${Date.now()}`; // bust cache
    });
  }
}

/* Auto-detect sequential files: 1.svg, 2.svg, ... stops at first miss after at least one hit */
async function detectSequentialFilenames(basePath, startIdx, ext, maxProbe) {
  const urls = [];
  for (let i = startIdx; i < startIdx + maxProbe; i++) {
    const url = `${basePath}/${i}.${ext}`;
    // For a strict contiguous sequence, stop at the first miss after the first hit
    const ok = await exists(url);
    if (ok) {
      urls.push(url);
    } else {
      // Stop when we hit the first gap (assuming contiguous numbering)
      if (urls.length > 0) break;
      // If we haven't found any yet, continue to next (in case numbering starts later).
      // But since requirement is from 1.svg upward, we can break here as well:
      break;
    }
  }
  return urls;
}

/* Create <img> nodes for each URL and append to stack */
function buildImageStack(urls) {
  const images = urls.map((url, idx) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = url.split("/").pop() || `image-${idx + 1}`;
    img.style.opacity = idx === 0 ? "1" : "0";
    stack.appendChild(img);
    return img;
  });
  return images;
}

/* Crossfade controller */
function createCrossfadeController(images) {
  let ticking = false;

  function update() {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const total = Math.max(rect.height - vh, 0); // total scrollable distance inside sticky
    const scrolled = Math.min(Math.max(-rect.top, 0), total);
    const progress = total > 0 ? scrolled / total : 0; // 0 → 1

    const n = images.length;
    if (n === 0) return;
    if (n === 1) {
      images[0].style.opacity = "1";
      return;
    }

    const seg = 1 / (n - 1);           // segment size for each transition
    const idx = Math.min(Math.floor(progress / seg), n - 2); // current transition index [0..n-2]
    const local = (progress - seg * idx) / seg;              // local 0..1 within segment

    // Reset all
    for (let i = 0; i < n; i++) images[i].style.opacity = "0";

    // Active crossfade: idx → idx+1
    images[idx].style.opacity = String(1 - local);
    images[idx + 1].style.opacity = String(local);
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  // Initial paint
  update();
}

/* Main init */
(async function init() {
  try {
    const urls = await detectSequentialFilenames(BASE_PATH, START_INDEX, EXT, MAX_AUTO_DETECT);

    if (urls.length === 0) {
      stack.innerHTML = "";
      const msg = document.createElement("div");
      msg.style.color = "#fff";
      msg.style.font = "14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      msg.style.padding = "1rem 1.25rem";
      msg.textContent = `No sequential SVGs found at ${BASE_PATH}/1.${EXT} …`;
      stack.appendChild(msg);
      return;
    }

    // Set stage height dynamically: n images → (approx) SCROLL_PER_IMAGE_VH each
    const n = urls.length;
    const stageHeightVH = Math.max(n * SCROLL_PER_IMAGE_VH, 100); // keep at least one viewport tall
    stage.style.height = `${stageHeightVH}vh`;

    // Build images and start crossfade controller
    const images = buildImageStack(urls);
    createCrossfadeController(images);
  } catch (e) {
    stack.innerHTML = "";
    const err = document.createElement("div");
    err.style.color = "#fff";
    err.style.font = "14px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
    err.style.padding = "1rem 1.25rem";
    err.textContent = `Error initializing viewer: ${e && e.message ? e.message : e}`;
    stack.appendChild(err);
  }
})();
