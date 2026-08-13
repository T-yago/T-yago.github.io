(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var timeline = document.querySelector(".experience .timeline");
    if (!timeline) return;

    var entries = Array.prototype.slice.call(timeline.querySelectorAll(".timeline-entry"));
    var details = Array.prototype.slice.call(timeline.querySelectorAll(".timeline-detail"));

    function measureOverflow(detail) {
      if (detail.classList.contains("is-expanded")) return;
      var text = detail.querySelector(".timeline-detail-text");
      if (!text) return;
      detail.classList.remove("no-overflow");
      // clientHeight can still reflect the previous expanded max-height
      // for one frame since it transitions. Reading it then would
      // wrongly mark the text as fitting and leave it stuck open, so
      // the transition is suspended for this measurement, then restored.
      var prevTransition = text.style.transition;
      text.style.transition = "none";
      // eslint-disable-next-line no-unused-expressions
      text.offsetHeight; // force layout to apply max-height without the transition
      var overflowing = text.scrollHeight > text.clientHeight + 1;
      text.style.transition = prevTransition;
      detail.classList.toggle("no-overflow", !overflowing);
    }

    details.forEach(function (detail) {
      var text = detail.querySelector(".timeline-detail-text");
      var toggle = detail.querySelector(".timeline-toggle");
      if (!text || !toggle) return;

      toggle.addEventListener("click", function () {
        var expanded = detail.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.textContent = expanded ? "Read less" : "Read more";
        if (!expanded) measureOverflow(detail);
      });

      measureOverflow(detail);
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        details.forEach(measureOverflow);
      }, 150);
    });

    // On mobile and tablet the connecting line starts fully painted at
    // the most recent entry and drains as the reader scrolls down toward
    // the oldest one, so moving up toward the present reads as progress.
    var mq = window.matchMedia("(max-width: 1024px)");
    var ticking = false;
    var dots = entries.map(function (entry) {
      return entry.querySelector(".timeline-dot");
    });

    function updateTimelineScroll() {
      if (!mq.matches) return;
      if (!dots.length || !dots[0]) return;

      var refY = window.innerHeight * 0.35;
      var firstY = dots[0].getBoundingClientRect().top;
      var lastY = dots[dots.length - 1].getBoundingClientRect().top;
      var span = lastY - firstY;

      // Drains faster than a plain one to one mapping to scroll distance,
      // so the whole sequence needs less scrolling to complete. That also
      // shortens how long a decelerating flick feels stuck on any one
      // entry near the end of the gesture.
      var DRAIN_SPEED = 1.7;
      var effectiveRefY = firstY + (refY - firstY) * DRAIN_SPEED;

      var progress = span > 0 ? Math.min(1, Math.max(0, (effectiveRefY - firstY) / span)) : 0;
      timeline.style.setProperty("--timeline-progress", progress.toFixed(4));

      // Each dot's fill state uses the same raw, unclamped reference line
      // the bar's fraction comes from, not the clamped progress used for
      // the bar's scaleY. The bar must clamp since a transform cannot
      // scale past empty, but clamping the dot boundary too meant the
      // last dot could never drain no matter how far past it you scrolled.
      var tops = dots.map(function (dot) {
        return dot ? dot.getBoundingClientRect().top : 0;
      });
      var activeIndex = -1;
      tops.forEach(function (top, i) {
        if (activeIndex === -1 && top >= effectiveRefY - 0.5) activeIndex = i;
      });
      entries.forEach(function (entry, i) {
        var filled = tops[i] >= effectiveRefY - 0.5;
        entry.classList.toggle("is-active", i === activeIndex);
        entry.classList.toggle("is-filled", filled && i !== activeIndex);
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        try {
          updateTimelineScroll();
        } finally {
          ticking = false;
        }
      });
    }

    function resetTimelineScroll() {
      entries.forEach(function (entry) {
        entry.classList.remove("is-active", "is-filled");
      });
      timeline.style.setProperty("--timeline-progress", "0");
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    if (mq.addEventListener) {
      mq.addEventListener("change", function () {
        if (mq.matches) {
          updateTimelineScroll();
        } else {
          resetTimelineScroll();
        }
      });
    }

    if (mq.matches) updateTimelineScroll();

    // On desktop the timeline reveals once, the first time it scrolls
    // into view. The connecting line sweeps right to left and each dot
    // lights up as the sweep reaches it. It never retriggers.
    var desktopMq = window.matchMedia("(min-width: 1025px)");
    var reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (desktopMq.matches && !reducedMotionMq.matches && "IntersectionObserver" in window) {
      var sweepDuration = 1.1;
      var dotDuration = 0.5;
      entries.forEach(function (entry, i) {
        var delay = entries.length > 1 ? (1 - i / (entries.length - 1)) * sweepDuration : 0;
        entry.style.setProperty("--reveal-delay", delay.toFixed(2) + "s");
      });

      timeline.classList.add("pre-reveal");

      var revealObserver = new IntersectionObserver(
        function (observedEntries) {
          observedEntries.forEach(function (item) {
            if (!item.isIntersecting) return;
            timeline.classList.remove("pre-reveal");
            timeline.classList.add("is-revealing");
            revealObserver.disconnect();

            // Once the single keyframe reveal has fully played out, let
            // go of it. A forwards filled animation otherwise keeps
            // overriding any later CSS change to the same properties,
            // which would silently block the hover interactivity set up
            // below from ever taking effect.
            var releaseAfter = (sweepDuration + dotDuration) * 1000 + 150;
            setTimeout(function () {
              timeline.classList.remove("is-revealing");
            }, releaseAfter);
          });
        },
        { threshold: 0.3 }
      );
      revealObserver.observe(timeline);
    }

    // On desktop the bar and dot fill track the mouse's exact x position
    // over the row, pixel for pixel, not which entry it happens to be
    // inside. It is anchored to the right, oldest edge, so purple always
    // spans from the cursor over to that edge, reading almost fully lit
    // near the left, most recent side and shrinking to a sliver near the
    // right, oldest side. Keyboard focus has no cursor to track, so it
    // falls back to snapping to whichever entry is focused, using its
    // own x position.
    if (desktopMq.matches) {
      function setFillAtX(clientX) {
        var rect = timeline.getBoundingClientRect();
        if (rect.width <= 0) return;
        var progress = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        timeline.style.setProperty("--timeline-progress", progress.toFixed(4));

        entries.forEach(function (entry, i) {
          var dot = dots[i];
          if (!dot) return;
          var dotRect = dot.getBoundingClientRect();
          var dotCenterX = dotRect.left + dotRect.width / 2;
          entry.classList.toggle("is-dimmed", dotCenterX < clientX);
        });
      }

      function clearHover() {
        timeline.style.removeProperty("--timeline-progress");
        entries.forEach(function (entry) {
          entry.classList.remove("is-dimmed");
        });
      }

      var hoverTicking = false;
      timeline.addEventListener(
        "mousemove",
        function (event) {
          if (hoverTicking) return;
          hoverTicking = true;
          var clientX = event.clientX;
          requestAnimationFrame(function () {
            setFillAtX(clientX);
            hoverTicking = false;
          });
        },
        { passive: true }
      );

      entries.forEach(function (entry, i) {
        entry.addEventListener("focus", function () {
          var dot = dots[i];
          if (!dot) return;
          var dotRect = dot.getBoundingClientRect();
          setFillAtX(dotRect.left + dotRect.width / 2);
        });
      });

      timeline.addEventListener("mouseleave", clearHover);
      timeline.addEventListener(
        "focusout",
        function (event) {
          if (!timeline.contains(event.relatedTarget)) clearHover();
        },
        true
      );

      // A tall entry can expand past the bottom of the viewport on
      // shorter screens even though nothing is actually clipped.
      // Nudge the page up once the reveal settles so the whole card
      // ends up visible.
      entries.forEach(function (entry) {
        var text = entry.querySelector(".timeline-detail-text");
        if (!text) return;
        text.addEventListener("transitionend", function (event) {
          if (event.propertyName !== "max-height") return;
          if (!entry.matches(":hover") && !entry.matches(":focus-within")) return;
          var rect = entry.getBoundingClientRect();
          var overflow = rect.bottom - window.innerHeight;
          if (overflow <= 12) return;
          var scrollAmount = Math.max(0, Math.min(overflow + 24, rect.top - 24));
          if (scrollAmount <= 0) return;
          window.scrollBy({
            top: scrollAmount,
            left: 0,
            behavior: reducedMotionMq.matches ? "auto" : "smooth"
          });
        });
      });
    }
  });
})();
