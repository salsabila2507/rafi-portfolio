/* ============================================================
   RАFI — Bikini Bottom portfolio interactions
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- rising bubbles canvas ---------- */
  var canvas = document.getElementById("bubble-canvas");
  var ctx = canvas.getContext("2d");
  var bubbles = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var rafId = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeBubble(initial) {
    return {
      x: Math.random() * window.innerWidth,
      y: initial ? Math.random() * window.innerHeight : window.innerHeight + 20 + Math.random() * 200,
      r: 2 + Math.random() * 11,
      speed: 0.25 + Math.random() * 0.85,
      drift: (Math.random() - 0.5) * 0.4,
      alpha: 0.18 + Math.random() * 0.45
    };
  }

  function seed() {
    var count = Math.min(Math.round(window.innerWidth / 22), 46);
    bubbles = [];
    for (var i = 0; i < count; i++) bubbles.push(makeBubble(true));
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.y -= b.speed;
      b.x += b.drift + Math.sin((b.y + i * 30) / 90) * 0.22;

      if (b.y + b.r < 0 || b.x < -40 || b.x > window.innerWidth + 40) {
        bubbles[i] = makeBubble(false);
        continue;
      }

      var g = ctx.createRadialGradient(
        b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1,
        b.x, b.y, b.r
      );
      g.addColorStop(0, "rgba(255,255,255," + b.alpha + ")");
      g.addColorStop(0.55, "rgba(160,225,255," + b.alpha * 0.45 + ")");
      g.addColorStop(1, "rgba(120,200,240,0)");

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255," + b.alpha * 0.55 + ")";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    rafId = window.requestAnimationFrame(draw);
  }

  resize();
  seed();

  if (reduceMotion) {
    draw();
    window.cancelAnimationFrame(rafId);
  } else {
    draw();
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { resize(); seed(); }, 180);
  });

  /* ---------- scroll reveal ---------- */
  var revealTargets = document.querySelectorAll(
    ".card, .tile, .stat, .dispatch, .contact-card, .about-note, .section-title, .section-sub"
  );

  revealTargets.forEach(function (el) { el.classList.add("reveal"); });

  function show(el) {
    el.classList.add("is-visible");
    window.setTimeout(function () {
      if (parseFloat(getComputedStyle(el).opacity) < 0.9) {
        el.classList.add("reveal-done");
      }
    }, 1500);
  }

  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    revealTargets.forEach(function (el, i) {
      el.style.animationDelay = (i % 4) * 70 + "ms";
      revealObserver.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add("is-visible", "reveal-done");
    });
  }

  /* ---------- animated counters ---------- */
  function formatNumber(n) {
    return n.toLocaleString("en-US");
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var divide = parseFloat(el.getAttribute("data-divide") || "1");
    var suffix = el.getAttribute("data-suffix") || "";
    var start = null;
    var duration = 1500;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNumber(Math.round((target * eased) / divide)) + suffix;
      if (p < 1) window.requestAnimationFrame(step);
      else el.textContent = formatNumber(target / divide) + suffix;
    }
    window.requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll(".stat-num");
  if ("IntersectionObserver" in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (reduceMotion) {
          entry.target.textContent =
            formatNumber(parseFloat(entry.target.getAttribute("data-count")) /
              parseFloat(entry.target.getAttribute("data-divide") || "1")) +
            (entry.target.getAttribute("data-suffix") || "");
        } else {
          countUp(entry.target);
        }
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (c) { countObserver.observe(c); });
  }

  /* ---------- parallax tilt on the hero visual ---------- */
  var visual = document.querySelector(".hero-visual");
  if (visual && !reduceMotion && window.matchMedia("(pointer:fine)").matches) {
    window.addEventListener("mousemove", function (e) {
      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      var dx = (e.clientX - cx) / cx;
      var dy = (e.clientY - cy) / cy;
      visual.style.transform =
        "perspective(1000px) rotateY(" + dx * 7 + "deg) rotateX(" + -dy * 7 + "deg)";
    });
  }

  /* ---------- footer year ---------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
