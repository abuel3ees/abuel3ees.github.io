/* ==========================================================================
   The Creation — shared engine
   Smooth scroll, cursor, dust, reveals, page transitions, generative art.
   Every block is guarded so a page only pays for what it uses.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  if (!hasGSAP || reduced) doc.classList.add("no-motion");
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Seeded RNG (stable art between visits) ---------- */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Theme ---------- */
  function setTheme(t) {
    doc.setAttribute("data-theme", t);
    try { localStorage.setItem("ae-theme", t); } catch (e) {}
  }
  $$(".theme-toggle").forEach(function (b) {
    b.addEventListener("click", function () {
      setTheme(doc.getAttribute("data-theme") === "light" ? "dark" : "light");
    });
  });

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, smoothWheel: true });
    window.__lenis = lenis;
    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var el = $(id);
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
      else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* ---------- Nav state ---------- */
  var nav = $(".nav");
  if (nav) {
    var lastY = 0;
    var onScroll = function () {
      var y = window.scrollY;
      nav.classList.toggle("is-scrolled", y > 40);
      nav.classList.toggle("is-hidden", y > lastY && y > 400);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Cursor ---------- */
  var mouse = { x: -999, y: -999 };
  window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  if (finePointer && !reduced) {
    var ring = document.createElement("div");
    ring.className = "cursor";
    ring.innerHTML = "<span>View</span>";
    var dot = document.createElement("div");
    dot.className = "cursor-dot";
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    var rx = -999, ry = -999;
    (function loop() {
      rx += (mouse.x - rx) * 0.16;
      ry += (mouse.y - ry) * 0.16;
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      dot.style.transform = "translate3d(" + mouse.x + "px," + mouse.y + "px,0)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("pointerover", function (e) {
      var v = e.target.closest("[data-cursor='view']");
      var l = e.target.closest("a,button,[data-cursor='link']");
      ring.classList.toggle("is-view", !!v);
      ring.classList.toggle("is-link", !v && !!l);
      if (v) ring.querySelector("span").textContent = v.getAttribute("data-cursor-label") || "View";
    });

    /* magnetic elements */
    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = "translate(" + dx * 0.25 + "px," + dy * 0.3 + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
      el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
    });
  }

  /* ---------- Gold dust (1x canvas, sprite blits, paused when hidden) ---------- */
  var dust = $("#dust");
  if (dust && !reduced) {
    var ctx = dust.getContext("2d", { alpha: true });
    var W, H, motes = [];
    var sprite = document.createElement("canvas");
    var paintSprite = function () {
      var light = doc.getAttribute("data-theme") === "light";
      /* a project theme can re-tint the dust through --dust-rgb */
      var rgb = document.body && document.body.classList.contains("themed")
        ? getComputedStyle(document.body).getPropertyValue("--dust-rgb").trim() : "";
      sprite.width = sprite.height = 16;
      var sc = sprite.getContext("2d");
      var g = sc.createRadialGradient(8, 8, 0, 8, 8, 8);
      if (rgb) {
        g.addColorStop(0, "rgba(" + rgb + ",.95)");
        g.addColorStop(0.35, "rgba(" + rgb + ",.45)");
        g.addColorStop(1, "rgba(" + rgb + ",0)");
      } else {
        g.addColorStop(0, light ? "rgba(140,105,45,.9)" : "rgba(255,240,205,1)");
        g.addColorStop(0.35, light ? "rgba(140,105,45,.45)" : "rgba(232,205,146,.55)");
        g.addColorStop(1, "rgba(232,205,146,0)");
      }
      sc.clearRect(0, 0, 16, 16);
      sc.fillStyle = g;
      sc.fillRect(0, 0, 16, 16);
    };
    paintSprite();
    new MutationObserver(paintSprite).observe(doc, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("ae:theme", paintSprite);
    var resize = function () {
      W = dust.width = innerWidth;
      H = dust.height = innerHeight;
      var n = Math.round(Math.min(60, (innerWidth * innerHeight) / 22000));
      motes = [];
      for (var i = 0; i < n; i++) {
        motes.push({
          x: Math.random() * W, y: Math.random() * H, s: Math.random() * 5 + 3,
          vx: (Math.random() - 0.5) * 0.12, vy: -Math.random() * 0.25 - 0.05,
          a: Math.random() * 0.6 + 0.2, p: Math.random() * 6.28
        });
      }
    };
    resize();
    var rT;
    window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(resize, 150); });
    var running = true;
    var draw = function (t) {
      if (!running) return;
      requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      var mx = mouse.x, my = mouse.y;
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        var dx = m.x - mx, dy = m.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 19600) {
          var d = Math.sqrt(d2) + 1, f = (1 - d / 140) * 1.8;
          m.x += (dx / d) * f; m.y += (dy / d) * f;
        }
        m.x += m.vx; m.y += m.vy;
        if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
        if (m.x < -10) m.x = W + 10; else if (m.x > W + 10) m.x = -10;
        ctx.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(t * 0.0015 + m.p));
        ctx.drawImage(sprite, m.x - m.s / 2, m.y - m.s / 2, m.s, m.s);
      }
      ctx.globalAlpha = 1;
    };
    document.addEventListener("visibilitychange", function () { var was = running; running = !document.hidden; if (running && !was) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  /* ---------- Split text into masked words ---------- */
  function splitWords(el) {
    if (el.__split) return el.__split;
    var out = [];
    var walk = function (node, parent) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var m = document.createElement("span");
            m.className = "line-mask";
            m.style.display = "inline-block";
            m.style.verticalAlign = "top";
            var inner = document.createElement("span");
            inner.className = "line-inner";
            inner.textContent = p;
            m.appendChild(inner);
            frag.appendChild(m);
            out.push(inner);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          walk(n);
        }
      });
    };
    walk(el);
    el.__split = out;
    return out;
  }
  window.__splitWords = splitWords;

  /* ---------- Reveals ---------- */
  function initReveals() {
    if (!hasGSAP || reduced) return;
    $$("[data-split]").forEach(function (el) {
      if (el.hasAttribute("data-split-manual")) return;
      var words = splitWords(el);
      gsap.set(words, { yPercent: 110 });
      ScrollTrigger.create({
        trigger: el, start: "top 88%", once: true,
        onEnter: function () {
          gsap.to(words, { yPercent: 0, duration: 1.15, ease: "expo.out", stagger: 0.028 });
        }
      });
    });
    ScrollTrigger.batch(".rv", {
      start: "top 90%", once: true,
      onEnter: function (els) {
        gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.08, overwrite: true });
      }
    });
    $$(".sec-head__rule").forEach(function (r) {
      gsap.fromTo(r, { scaleX: 0 }, { scaleX: 1, ease: "expo.out", duration: 1.6, scrollTrigger: { trigger: r, start: "top 92%", once: true } });
    });
    $$("[data-parallax]").forEach(function (el) {
      var amt = parseFloat(el.getAttribute("data-parallax")) || 12;
      gsap.fromTo(el, { yPercent: -amt }, { yPercent: amt, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
    $$("[data-count]").forEach(function (el) {
      var end = parseFloat(el.getAttribute("data-count"));
      var dec = (el.getAttribute("data-count").split(".")[1] || "").length;
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 90%", once: true,
        onEnter: function () {
          gsap.to(o, { v: end, duration: 2, ease: "expo.out", onUpdate: function () { el.textContent = o.v.toFixed(dec); } });
        }
      });
    });
    $$(".bar i").forEach(function (b) {
      gsap.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: b, start: "top 92%", once: true } });
    });
  }
  if (!hasGSAP || reduced) doc.classList.remove("js");

  /* ==========================================================================
     Generative art
     ========================================================================== */

  /* Routes: a capacitated sweep → nearest-neighbour fleet, drawn like ink */
  function buildRoutes(el) {
    var seed = parseInt(el.getAttribute("data-seed") || "7", 10);
    var R = rng(seed);
    var W = 800, H = 600, cx = W / 2, cy = H / 2;
    var N = parseInt(el.getAttribute("data-n") || "56", 10), K = parseInt(el.getAttribute("data-k") || "6", 10);
    var pts = [];
    for (var i = 0; i < N; i++) {
      var a = R() * Math.PI * 2, rr = Math.pow(R(), 0.7) * 250 + 30;
      pts.push({ x: cx + Math.cos(a) * rr * 1.25, y: cy + Math.sin(a) * rr * 0.9 });
    }
    pts.forEach(function (p) { p.ang = Math.atan2(p.y - cy, p.x - cx); });
    pts.sort(function (a, b) { return a.ang - b.ang; });
    var per = Math.ceil(N / K), routes = [];
    for (var k = 0; k < K; k++) {
      var group = pts.slice(k * per, (k + 1) * per);
      var cur = { x: cx, y: cy }, order = [];
      while (group.length) {
        var bi = 0, bd = Infinity;
        for (var j = 0; j < group.length; j++) {
          var d = Math.hypot(group[j].x - cur.x, group[j].y - cur.y);
          if (d < bd) { bd = d; bi = j; }
        }
        cur = group.splice(bi, 1)[0];
        order.push(cur);
      }
      routes.push(order);
    }
    var cols = ["var(--gold-2)", "var(--gold)", "var(--blood-2)", "var(--ink)", "var(--gold-3)", "var(--ink-soft)", "var(--gold-2)", "var(--blood-2)"];
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    for (var gx = 0; gx <= W; gx += 40) s += '<line class="grid" x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '"/>';
    for (var gy = 0; gy <= H; gy += 40) s += '<line class="grid" x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '"/>';
    routes.forEach(function (r, k) {
      var d = "M" + cx + " " + cy + r.map(function (p) { return " L" + p.x.toFixed(1) + " " + p.y.toFixed(1); }).join("") + " L" + cx + " " + cy;
      s += '<path class="route" d="' + d + '" stroke="' + cols[k % cols.length] + '"/>';
    });
    pts.forEach(function (p) { s += '<circle class="cust" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>'; });
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="18" fill="none" stroke="var(--gold)" stroke-opacity=".4"/>';
    s += '<rect class="depot" x="' + (cx - 7) + '" y="' + (cy - 7) + '" width="14" height="14" transform="rotate(45 ' + cx + " " + cy + ')"/>';
    s += "</svg>";
    el.innerHTML = s;
    var paths = $$(".route", el);
    paths.forEach(function (p) {
      var L = p.getTotalLength();
      p.style.strokeDasharray = L;
      p.style.strokeDashoffset = reduced || !hasGSAP ? 0 : L;
    });
    if (hasGSAP && !reduced) {
      var tl = gsap.timeline({ paused: true });
      tl.from($$(".cust", el), { scale: 0, transformOrigin: "50% 50%", duration: 0.6, stagger: { each: 0.01, from: "random" }, ease: "back.out(3)" });
      tl.to(paths, { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut", stagger: 0.18 }, 0.2);
      ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, horizontal: false, onEnter: function () { tl.play(); } });
      el.__tl = tl;
    }
  }

  /* Pipeline: IF → ID → EX → MEM → WB with forwarding arcs and travelling instructions */
  function buildPipeline(el) {
    var st = [["IF", "FETCH"], ["ID", "DECODE"], ["EX", "EXECUTE"], ["MEM", "MEMORY"], ["WB", "WRITE-BACK"]];
    var x0 = 30, w = 150, gap = 44, y = 110, h = 150;
    var s = '<svg viewBox="0 0 1000 380" aria-hidden="true">';
    s += '<path class="bus" d="M10 ' + (y + h / 2) + " H990" + '"/>';
    st.forEach(function (t, i) {
      var x = x0 + i * (w + gap);
      s += '<rect class="stage" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2"/>';
      s += '<text class="stage-l" x="' + (x + 16) + '" y="' + (y + 44) + '">' + t[0] + "</text>";
      s += '<text class="stage-s" x="' + (x + 16) + '" y="' + (y + h - 16) + '">' + t[1] + "</text>";
      if (i < 4) s += '<rect class="reg" x="' + (x + w + gap / 2 - 3) + '" y="' + (y - 14) + '" width="6" height="' + (h + 28) + '"/>';
    });
    var exX = x0 + 2 * (w + gap) + w / 2;
    var memX = x0 + 3 * (w + gap) + w / 2;
    var wbX = x0 + 4 * (w + gap) + w / 2;
    s += '<path class="fwd" d="M' + memX + " " + (y + h) + " C" + memX + " " + (y + h + 80) + " " + exX + " " + (y + h + 80) + " " + exX + " " + (y + h) + '"/>';
    s += '<path class="fwd" d="M' + wbX + " " + (y + h) + " C" + wbX + " " + (y + h + 110) + " " + exX + " " + (y + h + 110) + " " + exX + " " + (y + h + 4) + '"/>';
    s += '<text class="stage-s" x="' + (exX + 30) + '" y="' + (y + h + 104) + '">FORWARDING · EX/MEM · MEM/WB → EX</text>';
    s += '<path class="fwd" style="stroke:var(--gold)" d="M' + (x0 + w / 2 + (w + gap)) + " " + y + " C" + (x0 + w / 2 + (w + gap)) + " " + (y - 70) + " " + (x0 + w / 2) + " " + (y - 70) + " " + (x0 + w / 2) + " " + y + '"/>';
    s += '<text class="stage-s" x="' + (x0 + 10) + '" y="' + (y - 52) + '">HAZARD UNIT · STALL</text>';
    for (var p = 0; p < 4; p++) {
      s += '<circle class="pulse" r="5" cy="' + (y + h / 2) + '"><animate attributeName="cx" from="10" to="990" dur="4s" begin="' + p + 's" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.05;.92;1" dur="4s" begin="' + p + 's" repeatCount="indefinite"/></circle>';
    }
    s += "</svg>";
    el.innerHTML = s;
  }

  /* QR-ish glyph (decorative; not a real code) */
  function buildQR(el) {
    var R = rng(42), n = 21, html = "";
    var finder = function (x, y) {
      var corners = [[0, 0], [n - 7, 0], [0, n - 7]];
      for (var c = 0; c < 3; c++) {
        var fx = x - corners[c][0], fy = y - corners[c][1];
        if (fx >= 0 && fx < 7 && fy >= 0 && fy < 7) {
          var edge = fx === 0 || fy === 0 || fx === 6 || fy === 6;
          var core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
          return edge || core ? 1 : 0;
        }
        if (fx >= -1 && fx <= 7 && fy >= -1 && fy <= 7) return 0;
      }
      return -1;
    };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var f = finder(x, y);
      var on = f === -1 ? R() > 0.52 : f === 1;
      html += on ? "<i></i>" : '<i class="o"></i>';
    }
    el.innerHTML = html;
  }

  /* Liquid-glass palette that cycles tools on its own */
  function animateGlass(el) {
    var keys = $$("b", el);
    if (!keys.length) return;
    var i = 0;
    setInterval(function () {
      if (el.__manual && Date.now() - el.__manual < 4000) return;
      if (el.closest(".is-offscreen")) return;
      keys.forEach(function (k) { k.classList.remove("on"); });
      keys[i % keys.length].classList.add("on");
      i++;
    }, 1300);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle("is-offscreen", !e.isIntersecting);
        var svg = e.target.querySelector("svg");
        if (svg && svg.pauseAnimations) { if (e.isIntersecting) svg.unpauseAnimations(); else svg.pauseAnimations(); }
      });
    }, { rootMargin: "100px" });
    setTimeout(function () { $$(".art-pipe, .art-jads, .art-glass, .marquee").forEach(function (el) { io.observe(el); }); }, 0);
  }
  $$("[data-art='routes']").forEach(buildRoutes);
  $$("[data-art='pipeline']").forEach(buildPipeline);
  $$("[data-art='qr']").forEach(buildQR);
  $$(".glass-pal").forEach(animateGlass);
  window.__art = { routes: buildRoutes, rng: rng };

  /* ==========================================================================
     Home page choreography
     ========================================================================== */
  function initHome() {
    var hero = $(".hero");
    if (!hero || !hasGSAP) return;

    /* Hands meet → spark */
    if (!reduced) {
      var tl = gsap.timeline({
        scrollTrigger: { trigger: hero, start: "top top", end: "+=120%", scrub: true, pin: true, anticipatePin: 1 }
      });
      tl.to(".hero .hand--l", { x: "0vw", ease: "power2.inOut", duration: 1, force3D: true }, 0)
        .to(".hero .hand--r", { x: "0vw", ease: "power2.inOut", duration: 1, force3D: true }, 0)
        .to(".hero__title", { yPercent: 18, opacity: 0.08, ease: "power1.in", duration: 0.9 }, 0)
        .to(".hero__top", { opacity: 0, duration: 0.4 }, 0)
        .to(".spark", { opacity: 1, scale: 1, duration: 0.15, ease: "power2.out", onStart: function () { $(".spark").classList.add("lit"); }, onReverseComplete: function () { $(".spark").classList.remove("lit"); } }, 0.88)
        .to(".spark", { scale: 2.2, duration: 0.12 }, 1.0)
        .to(".hero__caption", { opacity: 1, y: 0, duration: 0.2 }, 0.95);
      gsap.set(".hero__caption", { y: 20 });
    }
    /* idle drift on the hands so the hero is alive before scrolling */
    if (!reduced) {
      gsap.to(".hero .hand--l img", { y: -8, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut", force3D: true });
    }

    /* Opera: horizontal gallery */
    var pin = $(".opera__pin"), track = $(".opera__track");
    if (pin && track) {
      ScrollTrigger.matchMedia({
        "(min-width: 901px)": function () {
          var dist = function () { return track.scrollWidth - innerWidth; };
          var t = gsap.to(track, {
            x: function () { return -dist(); }, ease: "none",
            scrollTrigger: {
              trigger: pin, start: "top top", end: function () { return "+=" + dist(); }, scrub: true, pin: true, invalidateOnRefresh: true, anticipatePin: 1,
              onUpdate: function (self) {
                gsap.set(".opera__progress i", { scaleX: self.progress });
                var total = $$(".plate:not(.plate--end)").length;
                var n = Math.min(total, Math.floor(self.progress * (total + 0.6)) + 1);
                var c = $(".opera__count b");
                var RN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
                if (c && c.textContent !== RN[n - 1]) c.textContent = RN[n - 1];
              }
            }
          });
          /* start each plate's art when it slides into view */
          $$(".plate [data-art='routes']").forEach(function (el) {
            if (!el.__tl) return;
            ScrollTrigger.create({ trigger: el, containerAnimation: t, start: "left 80%", once: true, onEnter: function () { el.__tl.play(); } });
          });
          $$(".plate__title").forEach(function (h, i) {
            var w = splitWords(h);
            var st = i === 0
              ? { trigger: pin, start: "top 60%", once: true }
              : { trigger: h, containerAnimation: t, start: "left 90%", once: true };
            gsap.from(w, { yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.05, scrollTrigger: st });
          });
        }
      });
    }

    /* Cursus: gold thread */
    var line = $(".cursus__line i");
    if (line) {
      gsap.to(line, { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".cursus", start: "top 70%", end: "bottom 60%", scrub: true } });
      $$(".epoch").forEach(function (e) {
        ScrollTrigger.create({ trigger: e, start: "top 62%", onEnter: function () { e.classList.add("on"); }, onLeaveBack: function () { e.classList.remove("on"); } });
      });
    }

    /* Contact: hands drift together */
    var ch = $(".contact__hands");
    if (ch && !reduced) {
      var imgs = $$(".hand", ch);
      gsap.fromTo(imgs[0], { x: "-14vw" }, { x: "0vw", ease: "none", scrollTrigger: { trigger: ".contact", start: "top bottom", end: "center center", scrub: true } });
      gsap.fromTo(imgs[1], { x: "14vw" }, { x: "0vw", ease: "none", scrollTrigger: { trigger: ".contact", start: "top bottom", end: "center center", scrub: true } });
    }
  }

  /* ---------- Intro (home loader or case-page entrance) ---------- */
  function intro(done) {
    var loader = $(".loader");
    var heroWords = $$("[data-hero-split]").reduce(function (acc, el) { return acc.concat(splitWords(el)); }, []);
    if (!hasGSAP || reduced) {
      if (loader) loader.classList.add("done");
      done();
      return;
    }
    gsap.set(heroWords, { yPercent: 115 });
    var tl = gsap.timeline({ onComplete: done });
    var cameFromTransition = false;
    try { cameFromTransition = sessionStorage.getItem("ae-nav") === "1"; sessionStorage.removeItem("ae-nav"); } catch (e) {}

    if (loader && !cameFromTransition) {
      var num = $(".loader__num"), o = { v: 0 };
      var roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      tl.to(o, { v: 10, duration: 1.4, ease: "power2.inOut", onUpdate: function () { num.textContent = roman[Math.round(o.v)] || "·"; } }, 0)
        .to(".loader__bar i", { scaleX: 1, duration: 1.4, ease: "power2.inOut" }, 0)
        .to(loader, { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "+=0.15")
        .add(function () { loader.classList.add("done"); });
    } else if (loader) {
      loader.classList.add("done");
    }
    var curtain = $(".curtain");
    if (curtain && cameFromTransition) {
      gsap.set($$("i", curtain), { scaleY: 1, transformOrigin: "top" });
      tl.to($$("i", curtain), { scaleY: 0, duration: 0.9, ease: "expo.inOut", stagger: 0.06 }, 0);
    }
    tl.to(heroWords, { yPercent: 0, duration: 1.3, ease: "expo.out", stagger: 0.04 }, loader && !cameFromTransition ? "-=0.6" : 0.25);
    tl.from(".hero .hand--l", { opacity: 0, xPercent: -30, duration: 1.8, ease: "expo.out", clearProps: "opacity" }, "<");
    tl.from(".hero .hand--r", { opacity: 0, xPercent: 30, duration: 1.8, ease: "expo.out", clearProps: "opacity" }, "<");
    tl.from(".hero__top > *, .case-hero__crumb > *, .case-hero__opus, .case-hero__sub > *", { opacity: 0, y: 16, duration: 1, stagger: 0.08, ease: "expo.out" }, "<0.2");
  }

  /* ---------- Page transitions ---------- */
  var curtain = $(".curtain");
  if (curtain && hasGSAP && !reduced) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(mailto|tel|https?):/i.test(href)) return;
      e.preventDefault();
      try { sessionStorage.setItem("ae-nav", "1"); } catch (err) {}
      gsap.set($$("i", curtain), { transformOrigin: "bottom" });
      gsap.to($$("i", curtain), {
        scaleY: 1, duration: 0.7, ease: "expo.inOut", stagger: 0.05,
        onComplete: function () { window.location.href = href; }
      });
    });
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) gsap.set($$("i", curtain), { scaleY: 0 });
    });
  }

  /* ---------- Project theme: museum → project once past the hero ---------- */
  function initProjectTheme() {
    var body = document.body, project = body.getAttribute("data-project");
    var banner = $(".case-banner");
    if (!project || !banner) return;
    var tex = document.createElement("div");
    tex.className = "theme-tex";
    tex.setAttribute("aria-hidden", "true");
    body.insertBefore(tex, body.firstChild);

    /* fetch the theme's fonts now so the swap never shows a fallback face */
    if (document.fonts && document.fonts.load) {
      (body.getAttribute("data-fonts") || "").split("|").forEach(function (f) {
        if (!f) return;
        document.fonts.load('400 1em "' + f + '"');
        document.fonts.load('700 1em "' + f + '"');
      });
    }

    var content = $$(".case-hero .wrap, .case-hero__crumb, main > .wrap, .next, .nav, .foot");
    var on = false, busy = false, ticking = false;
    var apply = function (next) {
      if (next === on || busy) return;
      on = next;
      var swap = function () {
        body.classList.toggle("themed", on);
        document.dispatchEvent(new CustomEvent("ae:theme", { detail: { on: on } }));
      };
      if (!hasGSAP || reduced) { swap(); return; }
      busy = true;
      /* colours crossfade via @property; type swaps while the text dips */
      gsap.timeline({ onComplete: function () { busy = false; check(); } })
        .to(content, { opacity: 0.12, duration: 0.22, ease: "power2.in" })
        .add(swap)
        .to(content, { opacity: 1, duration: 0.6, ease: "power2.out", clearProps: "opacity" }, "+=0.05")
        .add(function () { ScrollTrigger.refresh(); });
    };
    /* hysteresis: enter when the banner passes 45% of the viewport, leave only below 70% */
    var check = function () {
      ticking = false;
      var top = banner.getBoundingClientRect().top, vh = innerHeight;
      if (!on && top < vh * 0.45) apply(true);
      else if (on && top > vh * 0.7) apply(false);
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }, { passive: true });
    check();
  }

  /* ---------- Boot ---------- */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    initHome();
    initProjectTheme();
    intro(function () {
      initReveals();
      if (hasGSAP) ScrollTrigger.refresh();
      document.dispatchEvent(new CustomEvent("ae:ready"));
    });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
    setTimeout(boot, 2500);
  } else {
    window.addEventListener("load", boot);
  }

  /* ---------- Year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
