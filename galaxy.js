(() => {
  const cfg = window.GIFT_CONFIG;
  const canvas = document.querySelector("#galaxy");
  const ctx = canvas.getContext("2d");
  const intro = document.querySelector("#intro");
  const enter = document.querySelector("#enter");
  const hint = document.querySelector("#hint");
  const modal = document.querySelector("#message");
  const modalTitle = document.querySelector("#message-title");
  const modalText = document.querySelector("#message-text");
  const close = document.querySelector("#close-message");
  const music = document.querySelector("#music");
  const zoomIn = document.querySelector("#zoom-in");
  const zoomOut = document.querySelector("#zoom-out");
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  let bgCache = null, coreCache = null, bgW = 0, bgH = 0;
  let w = 0,
    h = 0,
    dpr = 1,
    yaw = 0.2,
    pitch = -0.36,
    zoom = 1,
    zoomTarget = 1,
    vy = 0,
    vp = 0,
    drag = false,
    moved = false,
    lastX = 0,
    lastY = 0,
    startX = 0,
    startY = 0,
    lastT = 0,
    active = false,
    interactive = false;
  const audio = new Audio(encodeURI("assets/Camilo Séptimo - Órbita.mp3"));
  audio.loop = true;
  audio.preload = "metadata";
  audio.volume = 0.4;
  let playing = false,
    pinchDistance = 0,
    pinchZoom = 1;
  const pointers = new Map();
  const stars = [],
    dust = [],
    objects = [],
    hits = [];
  const sprites = [
    "assets/sunflower-bouquet.webp",
    "assets/rose-bouquet.webp",
    "assets/tulip-bouquet.webp",
  ].map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    dpr = isMobile ? Math.min(devicePixelRatio || 1, 1.5) : Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCache = null;
    coreCache = null;
  }
  function rotate(p) {
    let x = p.x,
      y = p.y,
      z = p.z;
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    [x, z] = [x * cy - z * sy, x * sy + z * cy];
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    return { x, y, z };
  }
  function project(p) {
    const q = rotate(p),
      depth = 4.2 - q.z,
      scale = (Math.min(w, h) * 0.2 * zoom) / depth;
    return { x: w / 2 + q.x * scale, y: h / 2 + q.y * scale, z: q.z, scale };
  }
  function makeSpace() {
    for (let i = 0; i < (isMobile ? 900 : 1750); i++) {
      const arm = i % 4,
        a = (arm * Math.PI) / 2 + rand(-0.22, 0.22),
        r = Math.pow(Math.random(), 0.64) * 11.5;
      stars.push({
        x: Math.cos(a + r * 0.48) * r,
        y: rand(-0.24, 0.24) * (1 - r / 14),
        z: Math.sin(a + r * 0.48) * r,
        s: rand(0.55, 1.95),
        a: rand(0.3, 1),
        c: Math.random() > 0.28 ? cfg.accent : "#fff",
      });
    }
    for (let i = 0; i < (isMobile ? 160 : 360); i++) {
      const a = rand(0, Math.PI * 2),
        u = rand(-1, 1),
        r = rand(11, 20);
      dust.push({
        x: Math.cos(a) * Math.sqrt(1 - u * u) * r,
        y: u * r,
        z: Math.sin(a) * Math.sqrt(1 - u * u) * r,
        s: rand(0.3, 1.1),
      });
    }
    const layout = [
      [-7.4, -1.5, -1.4],
      [-5, -2.7, 1.2],
      [0, -3.1, -1.2],
      [5, -2.7, 1.4],
      [7.4, 1.2, -1.4],
      [4.8, 2.7, 1.2],
      [0, 3.1, -1.2],
      [-5, 2.7, 1.2],
    ];
    cfg.messages.forEach((m, i) => {
      const p = layout[i % layout.length];
      objects.push({
        x: p[0],
        y: p[1],
        z: p[2],
        message: m,
        kind: i % 6,
        phase: rand(0, 6.28),
      });
    });
  }
  function petal(x, y, rx, ry, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.45, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  function rose(x, y, r, rot, alpha, kind) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.shadowColor = cfg.glow;
    ctx.shadowBlur = r * 0.78;
    const stem = () => {
      ctx.strokeStyle = "#6fa45f";
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.45);
      ctx.quadraticCurveTo(r * 0.2, r, r * 0.02, r * 1.65);
      ctx.stroke();
    };
    const center = (cx = 0, cy = 0, rr = 0.2) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * rr, 0, 7);
      ctx.fillStyle = cfg.center;
      ctx.fill();
    };
    if (kind === 0) {
      for (let layer = 0; layer < 4; layer++)
        for (let i = 0; i < 7 + layer * 2; i++)
          petal(
            0,
            0,
            r * (0.13 + layer * 0.035),
            r * (0.28 + layer * 0.085),
            (i * Math.PI) / (3.5 + layer) + layer * 0.28,
            layer > 1 ? cfg.flower2 : cfg.flower,
          );
      center(0, 0, 0.17);
    } else if (kind === 1) {
      for (let i = 0; i < 17; i++)
        petal(
          0,
          0,
          r * 0.15,
          r * 0.72,
          (i * Math.PI) / 8.5,
          i % 2 ? cfg.flower : cfg.flower2,
        );
      center(0, 0, 0.34);
    } else if (kind === 2) {
      stem();
      for (let j = 0; j < 3; j++) {
        const ox = (j - 1) * r * 0.64,
          oy = ((j % 2) - 0.5) * r * 0.36;
        for (let i = 0; i < 9; i++)
          petal(ox, oy, r * 0.16, r * 0.54, (i * Math.PI) / 4.5, cfg.flower2);
        center(ox, oy, 0.16);
      }
    } else if (kind === 3) {
      stem();
      for (let j = -1; j <= 1; j++) {
        const ox = j * r * 0.48,
          oy = Math.abs(j) * r * 0.18;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(j * 0.18);
        ctx.beginPath();
        ctx.moveTo(-r * 0.34, 0);
        ctx.quadraticCurveTo(-r * 0.26, -r * 0.75, 0, -r * 0.82);
        ctx.quadraticCurveTo(r * 0.26, -r * 0.75, r * 0.34, 0);
        ctx.quadraticCurveTo(0, r * 0.25, -r * 0.34, 0);
        ctx.fillStyle = j ? cfg.flower2 : cfg.flower;
        ctx.fill();
        ctx.restore();
      }
    } else if (kind === 4) {
      stem();
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3,
          ox = Math.cos(a) * r * 0.42,
          oy = Math.sin(a) * r * 0.32;
        for (let i = 0; i < 6; i++)
          petal(ox, oy, r * 0.11, r * 0.36, (i * Math.PI) / 3, cfg.flower2);
        center(ox, oy, 0.12);
      }
    } else {
      ctx.strokeStyle = "#78a968";
      ctx.lineWidth = Math.max(1, r * 0.07);
      for (let j = 0; j < 7; j++) {
        const a = -1.05 + j * 0.35,
          ox = Math.sin(a) * r * 0.75,
          oy = Math.cos(a) * r * 0.48;
        ctx.beginPath();
        ctx.moveTo(0, r * 1.5);
        ctx.lineTo(ox, oy);
        ctx.stroke();
        for (let i = 0; i < 8; i++)
          petal(
            ox,
            oy,
            r * 0.13,
            r * 0.42,
            (i * Math.PI) / 4,
            j % 2 ? cfg.flower2 : cfg.flower,
          );
        center(ox, oy, 0.13);
      }
      ctx.fillStyle = "rgba(255,244,184,.9)";
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, r * 0.72);
      ctx.lineTo(0, r * 1.58);
      ctx.lineTo(r * 0.72, r * 0.72);
      ctx.quadraticCurveTo(0, r * 1.18, -r * 0.72, r * 0.72);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawHeart(x, y, r, label, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = cfg.glow;
    ctx.shadowBlur = r * 0.2;
    const layers = isMobile ? 2 : 3, pts = isMobile ? 80 : 150;
    for (let layer = 0; layer < layers; layer++) {
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2,
          hx = 16 * Math.sin(a) ** 3,
          hy =
            13 * Math.cos(a) -
            5 * Math.cos(2 * a) -
            2 * Math.cos(3 * a) -
            Math.cos(4 * a),
          j = Math.sin(i * 12.37 + layer * 8.1) * r * 0.022,
          px = (hx * r) / 18 + j,
          py = (-hy * r) / 18 + j * 0.4;
        ctx.globalAlpha = 0.42 + ((i + layer) % 7) / 12;
        ctx.fillStyle = (i + layer) % 5 ? cfg.accent : "#fffbd7";
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.7, r * (0.008 + (i % 4) * 0.003)), 0, 7);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fffbdc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(12, r * 0.2)}px system-ui`;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  function drawSpiral() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i < 80; i++) {
        const rr = 0.18 + i * 0.026,
          a = (arm * Math.PI * 2) / 3 + rr * 3.2,
          p = project({ x: Math.cos(a) * rr, y: 0, z: Math.sin(a) * rr });
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle =
        arm === 1 ? "rgba(255,255,220,.82)" : "rgba(255,224,70,.72)";
      ctx.lineWidth = Math.max(1.4, Math.min(w, h) * 0.005);
      ctx.shadowColor = cfg.glow;
      ctx.shadowBlur = 18;
      ctx.stroke();
    }
    ctx.restore();
  }
  function frame(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!bgCache) {
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72);
      bg.addColorStop(0, cfg.bgCenter);
      bg.addColorStop(0.42, cfg.bgMid);
      bg.addColorStop(1, cfg.bgEdge);
      bgCache = bg;
    }
    ctx.fillStyle = bgCache;
    ctx.fillRect(0, 0, w, h);
    zoom += (zoomTarget - zoom) * 0.075;
    if (!drag && interactive) {
      yaw += vy;
      pitch += vp;
      vy *= 0.94;
      vp *= 0.91;
      if (Math.abs(vy) < 0.00002) vy = 0;
      if (Math.abs(vp) < 0.00002) vp = 0;
    }
    pitch = Math.max(-0.82, Math.min(0.82, pitch));
    const allStars = [...dust, ...stars]
      .map((s) => ({ s, p: project(s) }))
      .sort((a, b) => a.p.z - b.p.z);
    for (const { s, p } of allStars) {
      if (p.scale < 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20)
        continue;
      const near = Math.max(0.15, Math.min(1, (p.z + 9) / 16));
      ctx.globalAlpha = (s.a || 0.35) * near;
      ctx.fillStyle = s.c || cfg.dust;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.35, s.s * p.scale * 0.035), 0, 7);
      ctx.fill();
    }
    if (!coreCache) {
      const core = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.2);
      core.addColorStop(0, cfg.core);
      core.addColorStop(0.18, cfg.coreSoft);
      core.addColorStop(1, "rgba(0,0,0,0)");
      coreCache = core;
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = coreCache;
    ctx.fillRect(0, 0, w, h);
    drawSpiral();
    const hp = project({ x: 0, y: -1.65, z: 0 });
    drawHeart(
      hp.x,
      hp.y,
      Math.max(36, Math.min(104, hp.scale * 0.92)),
      `Para ${cfg.name || "ti"}`,
      t,
    );
    hits.length = 0;
    const sorted = objects
      .map((o) => ({ o, p: project(o) }))
      .sort((a, b) => a.p.z - b.p.z);
    for (const { o, p } of sorted) {
      if (p.z > 3.85) continue;
      const r = Math.max(22, Math.min(54, p.scale * 0.4)),
        alpha = Math.max(0.42, Math.min(1, (p.z + 6) / 7)),
        img = sprites[o.kind % 3],
        factor = [0.86, 0.78, 0.72, 0.66, 0.6, 0.94][o.kind];
      let hitR = Math.max(38, r * 1.55);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = cfg.glow;
      ctx.shadowBlur = r * 0.6;
      if (img.complete && img.naturalWidth) {
        const iw = r * 2.8 * factor,
          ih = (iw * img.naturalHeight) / img.naturalWidth;
        ctx.drawImage(img, p.x - iw / 2, p.y - ih * 0.55, iw, ih);
        hitR = Math.max(iw * 0.42, ih * 0.38);
      } else rose(p.x, p.y, r, 0, alpha, o.kind);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.max(11, Math.min(15, r * 0.32))}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff8d3";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 8;
      ctx.fillText(o.message.title, p.x, p.y + hitR * 0.98);
      ctx.restore();
      hits.push({ x: p.x, y: p.y, r: Math.max(40, hitR), o });
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  function findHit(x, y) {
    let best = null,
      bd = 1e9;
    for (const hit of hits) {
      const d = Math.hypot(x - hit.x, y - hit.y);
      if (d < hit.r && d < bd) {
        best = hit;
        bd = d;
      }
    }
    return best;
  }
  function show(o) {
    modalTitle.textContent = o.message.title;
    modalText.textContent = o.message.text;
    if (typeof modal.showModal === "function") {
      if (!modal.open) modal.showModal();
    } else modal.setAttribute("open", "");
    burst(hits.find((h) => h.o === o));
  }
  function burst(hit) {
    if (!hit) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("i");
      s.className = "burst";
      s.textContent = i % 3 ? "âœ¦" : "â™¡";
      s.style.left = hit.x + "px";
      s.style.top = hit.y + "px";
      s.style.setProperty("--x", rand(-110, 110) + "px");
      s.style.setProperty("--y", rand(-110, 110) + "px");
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1200);
    }
  }
  function point(e) {
    return { x: e.clientX, y: e.clientY };
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!interactive) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, point(e));
    drag = true;
    moved = false;
    const p = point(e);
    lastX = startX = p.x;
    lastY = startY = p.y;
    lastT = performance.now();
    vy = vp = 0;
    if (pointers.size === 2) {
      const p2 = [...pointers.values()];
      pinchDistance = Math.hypot(p2[0].x - p2[1].x, p2[0].y - p2[1].y);
      pinchZoom = zoom;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = point(e);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2) {
      const ps = [...pointers.values()],
        d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      zoom = Math.max(
        0.62,
        Math.min(1.75, (pinchZoom * d) / Math.max(20, pinchDistance)),
      );
      moved = true;
      return;
    }
    const now = performance.now(),
      dx = p.x - lastX,
      dy = p.y - lastY,
      dt = Math.max(8, now - lastT);
    if (Math.hypot(p.x - startX, p.y - startY) > 7) moved = true;
    yaw += dx * 0.014;
    pitch += dy * 0.011;
    vy = (dx / dt) * 0.034;
    vp = (dy / dt) * 0.025;
    lastX = p.x;
    lastY = p.y;
    lastT = now;
  });
  canvas.addEventListener("pointerup", (e) => {
    pointers.delete(e.pointerId);
    drag = pointers.size > 0;
    if (!moved && !drag) {
      const p = point(e),
        hit = findHit(p.x, p.y);
      if (hit) show(hit.o);
    }
  });
  canvas.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    drag = pointers.size > 0;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (interactive) {
        zoomTarget = zoom = Math.max(
          0.62,
          Math.min(1.75, zoom - e.deltaY * 0.0007),
        );
      }
    },
    { passive: false },
  );
  zoomIn.addEventListener("click", () => {
    if (interactive) zoomTarget = zoom = Math.min(1.75, zoom + 0.18);
  });
  zoomOut.addEventListener("click", () => {
    if (interactive) zoomTarget = zoom = Math.max(0.62, zoom - 0.18);
  });
  async function startMusic() {
    try {
      await audio.play();
      playing = true;
      music.textContent = "Pausar";
      music.setAttribute("aria-pressed", "true");
    } catch (error) {
      playing = false;
      music.textContent = "Reproducir";
      music.setAttribute("aria-pressed", "false");
      console.error(
        "No se pudo reproducir Camilo Septimo - orbita.mp3:",
        error,
      );
    }
  }
  function stopMusic() {
    audio.pause();
    playing = false;
    music.textContent = "Musica";
    music.setAttribute("aria-pressed", "false");
  }
  audio.addEventListener("error", () => {
    playing = false;
    music.textContent = "Archivo no encontrado";
    music.setAttribute("aria-pressed", "false");
  });
  enter.addEventListener("click", () => {
    active = true;
    interactive = false;
    zoom = 0.26;
    zoomTarget = 1;
    intro.classList.add("away");
    music.hidden = false;
    startMusic();
    setTimeout(() => {
      interactive = true;
      hint.classList.add("show");
    }, 950);
    setTimeout(() => hint.classList.remove("show"), 6000);
  });
  music.addEventListener("click", () => (playing ? stopMusic() : startMusic()));
  close.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
  resize();
  makeSpace();
  addEventListener("resize", resize);
  requestAnimationFrame(frame);
})();


