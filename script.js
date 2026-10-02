document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const menuButton = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  /* ---------- Light / dark theme ---------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = () => { try { return localStorage.getItem("ukmc-theme"); } catch (e) { return null; } };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    const dark = theme === "dark";
    themeToggle?.setAttribute("aria-pressed", String(dark));
    themeToggle?.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#08131c" : "#0B1B28");
  };

  applyTheme(savedTheme() === "dark" ? "dark" : "light");

  themeToggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("ukmc-theme", next); } catch (e) { /* storage unavailable */ }
  });

  /* ---------- Mobile menu ---------- */
  const setMenu = (open) => {
    mobileMenu?.classList.toggle("open", open);
    menuButton?.setAttribute("aria-expanded", String(open));
    menuButton?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  menuButton?.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });

  mobileMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileMenu?.classList.contains("open")) {
      setMenu(false);
      menuButton?.focus();
    }
  });

  window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => {
    if (e.matches) setMenu(false);
  });

  /* ---------- Headline letter reveal ---------- */
  $$("[data-split]").forEach((el) => {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    let i = 0;
    const splitNode = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const word = document.createElement("span");
            word.className = "w";
            [...part].forEach((c) => {
              const ch = document.createElement("span");
              ch.className = "ch";
              ch.textContent = c;
              ch.style.animationDelay = `${120 + i++ * 24}ms`;
              word.appendChild(ch);
            });
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          splitNode(child);
        }
      });
    };
    splitNode(el);
    [...el.children].forEach((c) => c.setAttribute("aria-hidden", "true"));
  });

  /* ---------- Pointer effects: spotlight, magnetic buttons, card glow ---------- */
  if (finePointer && !reduceMotion) {
    $$(".spotlight").forEach((section) => {
      section.addEventListener("pointermove", (e) => {
        const r = section.getBoundingClientRect();
        section.style.setProperty("--sx", `${e.clientX - r.left}px`);
        section.style.setProperty("--sy", `${e.clientY - r.top}px`);
        section.classList.add("is-lit");
      });
      section.addEventListener("pointerleave", () => section.classList.remove("is-lit"));
    });

    $$(".magnetic").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
        btn.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.setProperty("--mx", "0px");
        btn.style.setProperty("--my", "0px");
      });
    });

    $$(".benefit-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--gx", `${e.clientX - r.left}px`);
        card.style.setProperty("--gy", `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Hero funding estimator ---------- */
  const CASHFLOW_MIN = 5000;
  const CASHFLOW_MAX = 1000000;
  const FUNDING_MULTIPLE = 1.5;
  const FUNDING_CAP = 1000000;

  const cashflowRange = document.getElementById("cashflowRange");
  const plot = document.querySelector(".calc-plot");
  const cashflowOut = document.getElementById("cashflowOutput");
  const fundingOut = document.getElementById("fundingOutput");
  const fundingBadge = document.getElementById("fundingBadge");

  // Slider position t (0–1) maps to cash flow on a squared scale for finer control at lower amounts.
  const cashflowAt = (t) => CASHFLOW_MIN + t * t * (CASHFLOW_MAX - CASHFLOW_MIN);
  const fundingFor = (cashflow) => Math.min(cashflow * FUNDING_MULTIPLE, FUNDING_CAP);
  const roundCashflow = (value) => {
    const step = value < 50000 ? 1000 : value < 250000 ? 5000 : 10000;
    return Math.round(value / step) * step;
  };

  const tickers = new Map();
  const tick = (el, to) => {
    if (!el) return;
    const prev = tickers.get(el);
    const from = prev ? prev.value : to;
    if (prev) cancelAnimationFrame(prev.raf);
    const state = { value: from, raf: 0 };
    tickers.set(el, state);
    if (reduceMotion || from === to) { state.value = to; el.textContent = money.format(to); return; }
    const start = performance.now();
    const step = (now) => {
      const p = clamp((now - start) / 420, 0, 1);
      state.value = from + (to - from) * (1 - Math.pow(1 - p, 3));
      el.textContent = money.format(Math.round(state.value));
      if (p < 1) state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  };

  const drawCurve = () => {
    const points = [];
    for (let i = 0; i <= 100; i += 1) {
      const t = i / 100;
      const y = 100 - (fundingFor(cashflowAt(t)) / FUNDING_CAP) * 100;
      points.push(`${(t * 100).toFixed(2)},${y.toFixed(2)}`);
    }
    const line = `M${points.join(" L")}`;
    document.getElementById("calcLine")?.setAttribute("d", line);
    document.getElementById("calcArea")?.setAttribute("d", `${line} L100,100 L0,100 Z`);
  };

  const updateEstimator = () => {
    if (!cashflowRange || !plot) return;
    const t = Number(cashflowRange.value) / Number(cashflowRange.max);
    const cashflow = roundCashflow(cashflowAt(t));
    const funding = fundingFor(cashflow);
    const capped = cashflow * FUNDING_MULTIPLE >= FUNDING_CAP;

    tick(cashflowOut, cashflow);
    tick(fundingOut, funding);
    fundingBadge.textContent = capped ? "MAX £1M" : `${FUNDING_MULTIPLE}×`;
    fundingBadge.classList.toggle("is-max", capped);

    plot.style.setProperty("--px", `${t * 100}%`);
    plot.style.setProperty("--py", `${100 - (funding / FUNDING_CAP) * 100}%`);
    cashflowRange.style.setProperty("--fill", `${t * 100}%`);
    cashflowRange.setAttribute("aria-valuetext", `Monthly cash flow ${money.format(cashflow)}, estimated funding ${money.format(funding)}`);
  };

  const calcHint = document.getElementById("calcHint");
  const dismissHint = () => {
    calcHint?.classList.add("is-hidden");
    cashflowRange?.classList.remove("is-untouched");
  };

  drawCurve();
  cashflowRange?.addEventListener("input", updateEstimator);
  ["input", "pointerdown", "keydown"].forEach((type) => cashflowRange?.addEventListener(type, dismissHint, { once: true }));

  const tiltWrap = document.getElementById("tiltWrap");
  const calcCard = $(".calc-card");
  if (finePointer && !reduceMotion && tiltWrap && calcCard) {
    tiltWrap.addEventListener("pointermove", (e) => {
      const r = calcCard.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width, 0, 1);
      const y = clamp((e.clientY - r.top) / r.height, 0, 1);
      calcCard.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
      calcCard.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
      calcCard.style.setProperty("--gx", `${x * 100}%`);
      calcCard.style.setProperty("--gy", `${y * 100}%`);
    });
    tiltWrap.addEventListener("pointerleave", () => {
      calcCard.style.setProperty("--rx", "0deg");
      calcCard.style.setProperty("--ry", "0deg");
    });
  }

  /* ---------- Carry the estimate through to the form ---------- */
  const heroCtaLabel = document.getElementById("heroCtaLabel");
  const amountRadios = $$('input[name="amount"]');
  const estimateNote = document.getElementById("estimateNote");
  const estimateNoteValue = document.getElementById("estimateNoteValue");
  const estimateField = document.getElementById("f-estimate");
  const AMOUNT_BAND_LIMITS = [10000, 50000, 100000, 250000, Infinity];
  let amountChosenManually = false;

  amountRadios.forEach((radio) => radio.addEventListener("change", () => { amountChosenManually = true; }));

  const carryEstimate = () => {
    const t = Number(cashflowRange.value) / Number(cashflowRange.max);
    const funding = fundingFor(roundCashflow(cashflowAt(t)));
    const label = money.format(funding);
    if (heroCtaLabel) heroCtaLabel.textContent = `Request ${label}`;
    if (estimateNote && estimateNoteValue) {
      estimateNoteValue.textContent = label;
      estimateNote.hidden = false;
    }
    if (estimateField) estimateField.value = label;
    if (!amountChosenManually) {
      const band = amountRadios[AMOUNT_BAND_LIMITS.findIndex((limit) => funding <= limit)];
      if (band) band.checked = true;
    }
  };

  cashflowRange?.addEventListener("input", carryEstimate);
  updateEstimator();

  /* ---------- Scroll: header, progress, CTA, process ---------- */
  const hero = document.querySelector(".hero");
  const applySection = document.getElementById("apply");
  const mobileCta = document.querySelector(".mobile-cta");
  const backToTop = document.getElementById("backToTop");
  $$('a[href="#top"]').forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }));
  const scrollBar = document.getElementById("scrollBar");
  const processLayout = document.getElementById("process");
  const steps = $$(".process-layout .step");
  const processBar = document.getElementById("processBar");
  const stepNow = document.getElementById("stepNow");
  let applyInView = false;
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;

    header?.classList.toggle("is-scrolled", y > 8);
    backToTop?.classList.toggle("is-visible", y > vh);
    if (scrollBar) scrollBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (mobileCta && hero) {
      const pastHero = hero.getBoundingClientRect().bottom < 0;
      mobileCta.classList.toggle("is-visible", pastHero && !applyInView);
    }

    if (processLayout && steps.length) {
      let idx = 0;
      steps.forEach((s, i) => { if (s.getBoundingClientRect().top < vh * 0.55) idx = i; });
      steps.forEach((s, i) => s.classList.toggle("is-active", i === idx));
      const r = processLayout.getBoundingClientRect();
      const p = clamp((vh * 0.55 - r.top) / Math.max(r.height - vh * 0.35, 1), 0, 1);
      if (processBar) processBar.style.transform = `scaleX(${p})`;
      if (stepNow) stepNow.textContent = String(idx + 1).padStart(2, "0");
    }
  };

  const requestScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  };

  if (applySection && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      applyInView = entry.isIntersecting;
      requestScroll();
    }, { threshold: 0.05 }).observe(applySection);
  }

  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll);
  onScroll();

  /* ---------- Active nav link (scroll spy) ---------- */
  const navLinks = [...document.querySelectorAll(".desktop-nav a")];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === `#${entry.target.id}`;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- Weekly repayment simulator ---------- */
  const WEEK = [["MON", 1180], ["TUE", 1340], ["WED", 1260], ["THU", 1720], ["FRI", 2640], ["SAT", 3180], ["SUN", 1490]];
  const WEEK_TOTAL = WEEK.reduce((sum, [, v]) => sum + v, 0);
  const simChart = document.getElementById("simChart");
  const rateRange = document.getElementById("rateRange");
  const volRange = document.getElementById("volRange");
  const rateOut = document.getElementById("rateOut");
  const volOut = document.getElementById("volOut");
  const simSales = document.getElementById("simSales");
  const simRepaid = document.getElementById("simRepaid");
  const simKept = document.getElementById("simKept");

  if (simChart && rateRange && volRange) {
    const peak = (Math.max(...WEEK.map(([, v]) => v)) / WEEK_TOTAL) * Number(volRange.max);
    simChart.innerHTML = WEEK.map(([day]) => `
      <div class="sim-bar">
        <span class="sim-val"></span>
        <div class="sim-stack"><div class="sim-repay"></div><div class="sim-keep"></div></div>
        <span class="sim-day">${day}</span>
      </div>`).join("");
    const bars = $$(".sim-bar", simChart);

    const updateSim = () => {
      const rate = Number(rateRange.value) / 100;
      const weekly = Number(volRange.value);
      rateOut.textContent = `${rateRange.value}%`;
      volOut.textContent = money.format(weekly);
      [rateRange, volRange].forEach((r) => {
        r.style.setProperty("--fill", `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
      });

      let sales = 0;
      let repaid = 0;
      WEEK.forEach(([, base], i) => {
        const daySales = i === WEEK.length - 1 ? weekly - sales : Math.round((base / WEEK_TOTAL) * weekly);
        const dayRepay = Math.round(daySales * rate);
        sales += daySales;
        repaid += dayRepay;
        const bar = bars[i];
        $(".sim-stack", bar).style.height = `${Math.max((daySales / peak) * 170, 4)}px`;
        $(".sim-repay", bar).style.height = `${rate * 100}%`;
        $(".sim-val", bar).textContent = money.format(daySales);
        bar.title = `${WEEK[i][0]}: ${money.format(daySales)} sales, ${money.format(dayRepay)} repaid`;
      });

      repaid = Math.round(sales * rate);
      tick(simSales, sales);
      tick(simRepaid, repaid);
      tick(simKept, sales - repaid);
      simChart.setAttribute("aria-label", `Illustrative week: ${money.format(sales)} card sales, ${money.format(repaid)} repaid at ${rateRange.value}%, ${money.format(sales - repaid)} kept`);
    };

    [rateRange, volRange].forEach((r) => r.addEventListener("input", updateSim));
    updateSim();
  }

  /* ---------- Count-up numbers ---------- */
  const runCount = (el) => {
    const to = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = String(to); return; }
    const start = performance.now();
    const step = (now) => {
      const p = clamp((now - start) / 1400, 0, 1);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- Multi-step application form ---------- */
  const form = document.getElementById("applicationForm");
  const panels = form ? $$(".form-panel", form) : [];
  const stepLabels = form ? $$(".fs", form) : [];
  const formBar = document.getElementById("formBar");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitButton = document.getElementById("submitBtn");
  const formError = document.getElementById("formError");
  let stepIndex = 0;

  const messages = {
    name: "Please enter your name.",
    business: "Please enter your business name.",
    sector: "Please choose your sector.",
    email: "Please enter a valid email address.",
    phone: "Please enter a valid UK phone number.",
    amount: "Please choose a funding range."
  };

  const validateField = (field) => {
    const wrapper = field.closest(".field");
    const error = wrapper?.querySelector(".field-error");
    if (field.name === "phone") field.value = field.value.replace(/[^\d+\s]/g, "");
    const valid = field.checkValidity();
    wrapper?.classList.toggle("has-error", !valid);
    field.setAttribute("aria-invalid", String(!valid));
    if (error) error.textContent = valid ? "" : (messages[field.name] || field.validationMessage);
    return valid;
  };

  const validatePanel = (panel) => {
    const seenGroups = new Set();
    const invalid = $$("[required]", panel).filter((field) => {
      if (field.type === "radio") {
        if (seenGroups.has(field.name)) return false;
        seenGroups.add(field.name);
      }
      return !validateField(field);
    });
    invalid[0]?.focus();
    return invalid.length === 0;
  };

  form?.querySelectorAll("[required]").forEach((field) => {
    if (field.type !== "radio") field.addEventListener("blur", () => validateField(field));
    field.addEventListener("input", () => {
      if (field.closest(".field")?.classList.contains("has-error")) validateField(field);
    });
  });
  amountRadios.forEach((radio) => radio.addEventListener("change", () => validateField(amountRadios[0])));

  const showStep = (index) => {
    stepIndex = index;
    panels.forEach((panel, i) => panel.classList.toggle("is-active", i === index));
    stepLabels.forEach((label, i) => {
      label.classList.toggle("is-active", i === index);
      label.classList.toggle("is-done", i < index);
    });
    if (formBar) formBar.style.width = `${((index + 1) / panels.length) * 100}%`;
    prevBtn.hidden = index === 0;
    nextBtn.hidden = index === panels.length - 1;
    submitButton.hidden = index !== panels.length - 1;
  };

  nextBtn?.addEventListener("click", () => {
    if (!validatePanel(panels[stepIndex])) return;
    showStep(stepIndex + 1);
    $("input:not([type=hidden]), select", panels[stepIndex])?.focus({ preventScroll: true });
  });
  prevBtn?.addEventListener("click", () => showStep(stepIndex - 1));
  form?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName !== "TEXTAREA" && stepIndex < panels.length - 1) {
      event.preventDefault();
      nextBtn.click();
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validatePanel(panels[stepIndex])) return;

    const data = Object.fromEntries(new FormData(form));
    if (data.website) return; // honeypot filled – likely a bot
    delete data.website;

    const endpoint = form.dataset.endpoint;
    submitButton.disabled = true;
    submitButton.firstChild.textContent = "Sending… ";
    formError.hidden = true;

    try {
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ ...data, source: window.location.href, submittedAt: new Date().toISOString() })
        });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      }

      panels.forEach((panel) => panel.classList.remove("is-active"));
      [$(".form-nav", form), $(".form-steps", form), $(".form-progress", form), estimateNote].forEach((el) => { if (el) el.hidden = true; });
      document.getElementById("successTitle").textContent = `Thanks, ${data.name.split(" ")[0]}.`;
      document.getElementById("formSuccess").hidden = false;
    } catch (error) {
      console.error(error);
      submitButton.disabled = false;
      submitButton.firstChild.textContent = "Request a call ";
      formError.textContent = "Sorry, something went wrong sending your enquiry. Please try again in a moment.";
      formError.hidden = false;
    }
  });

  /* ---------- Footer year ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  const revealItems = document.querySelectorAll(".benefit-card, .stat, .flex-demo, .terms-card, .compare-wrap");
  const counters = $$("[data-count]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        $$("[data-count]", entry.target).forEach(runCount);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item, i) => {
      item.classList.add("reveal");
      item.style.transitionDelay = `${(i % 3) * 80}ms`;
      observer.observe(item);
    });
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    counters.forEach(runCount);
  }
});
