(() => {
  document.documentElement.classList.add("js");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const cfg = window.QUICKREV || {};

  /* ---------- Besöksstatistik (Cloudflare Web Analytics, inga cookies) ---------- */
  if (cfg.statistikToken) {
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.dataset.cfBeacon = JSON.stringify({ token: cfg.statistikToken });
    document.head.append(s);
  }

  /* ---------- Innehåll som tonar in vid scroll ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    // Syskon som kommer in samtidigt får en kort fördröjning efter varandra (60 ms)
    const io = new IntersectionObserver((entries) => {
      let i = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty("--d", `${Math.min(i++, 5) * 60}ms`);
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Skylten lutar mot pekaren (fjäder, kritiskt dämpad) ---------- */
  const zone = document.querySelector("[data-tilt-zone]");
  const body = document.querySelector(".plaque__body");
  const sheen = document.querySelector(".plaque__sheen");
  if (zone && body) {
    const REST = { x: 6, y: -14, s: 30 };
    const RESPONSE = 0.55; // sekunder, Apple-stil "response"
    const k = Math.pow((2 * Math.PI) / RESPONSE, 2);
    const c = 2 * Math.sqrt(k); // dämpning 1.0, ingen överslängning
    const axes = {
      x: { v: REST.x, vel: 0, t: REST.x },
      y: { v: REST.y, vel: 0, t: REST.y },
      s: { v: REST.s, vel: 0, t: REST.s },
      p: { v: 1, vel: 0, t: 1 }, // tryck (skala)
    };
    let raf = 0;
    let last = 0;

    const render = () => {
      body.style.transform = `rotateX(${axes.x.v.toFixed(2)}deg) rotateY(${axes.y.v.toFixed(2)}deg) scale(${axes.p.v.toFixed(4)})`;
      if (sheen) sheen.style.setProperty("--sx", `${axes.s.v.toFixed(1)}%`);
    };

    const step = (now) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      let moving = false;
      for (const a of Object.values(axes)) {
        a.vel += (-k * (a.v - a.t) - c * a.vel) * dt;
        a.v += a.vel * dt;
        if (Math.abs(a.v - a.t) > 0.0005 || Math.abs(a.vel) > 0.0005) moving = true;
      }
      render();
      raf = moving ? requestAnimationFrame(step) : 0;
      if (!moving) last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

    const onMove = (e) => {
      const r = zone.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;  // -0.5 .. 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5;
      axes.y.t = REST.y + nx * 26;
      axes.x.t = REST.x - ny * 18;
      axes.s.t = 30 + nx * 70;
      kick();
    };
    const onLeave = () => {
      axes.x.t = REST.x; axes.y.t = REST.y; axes.s.t = REST.s;
      kick();
    };

    const bind = () => {
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      if (finePointer.matches && !reduceMotion.matches) {
        zone.addEventListener("pointermove", onMove, { passive: true });
        zone.addEventListener("pointerleave", onLeave);
      } else {
        onLeave();
      }
    };
    render();
    bind();
    finePointer.addEventListener?.("change", bind);
    reduceMotion.addEventListener?.("change", bind);

    // "Blippa" skylten: den trycks in lite (fjäder) och NFC-vågor går ut från ikonen
    const plaque = document.querySelector("[data-tilt]");
    const press = () => {
      if (!reduceMotion.matches) { axes.p.t = 0.965; kick(); }
      [0, 140, 280].forEach((delay) => {
        const w = document.createElement("span");
        w.className = "plaque__wave";
        w.style.setProperty("--wd", `${delay}ms`);
        w.addEventListener("animationend", () => w.remove(), { once: true });
        body.append(w);
      });
    };
    const release = () => { axes.p.t = 1; kick(); };
    const halo = () => {
      zone.classList.remove("is-blip");
      void zone.offsetWidth; // starta om animationen
      zone.classList.add("is-blip");
    };
    plaque.addEventListener("pointerdown", () => { press(); halo(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((t) => plaque.addEventListener(t, release));

    // Skylten "blippar" av sig själv då och då, så att man ser vad den gör.
    // Bara när den syns, när fliken är aktiv och inte vid minskad rörelse.
    if (!reduceMotion.matches && "IntersectionObserver" in window) {
      let visible = false;
      let timer = 0;
      const autoBlip = () => {
        if (visible && !document.hidden) {
          press(); halo();
          setTimeout(release, 160);
        }
        timer = setTimeout(autoBlip, 5200);
      };
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.5 }).observe(plaque);
      timer = setTimeout(autoBlip, 2600); // efter att skylten kommit in och reflexen svept förbi
      plaque.addEventListener("pointerdown", () => { clearTimeout(timer); timer = setTimeout(autoBlip, 8000); });
    }
  }

  /* ---------- Knappar: ljus som följer pekaren ---------- */
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--mx", `${e.clientX - r.left}px`);
      btn.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  });

  /* ---------- Krusning från klickpunkten ---------- */
  if (!reduceMotion.matches) {
    document.addEventListener("pointerdown", (e) => {
      const host = e.target.closest(".btn, .faq__item summary, .pills li, .quiz__opt, .deal");
      if (!host || e.button > 0) return;
      const r = host.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "ripple";
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      dot.style.setProperty("--rs", (Math.max(r.width, r.height) * 2.2) / 16);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      host.append(dot);
    });
  }

  /* ---------- Menyn markerar sektionen man är i ---------- */
  const navLinks = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  if ("IntersectionObserver" in window && navLinks.length) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.remove("is-active"));
        byId.get(entry.target.id)?.classList.add("is-active");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
    // Sektioner utan egen menylänk (t.ex. jämförelsen) markerar närmaste länk ovanför
    document.querySelectorAll("main > section:not([id])").forEach((s) => {
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        let prev = s.previousElementSibling;
        while (prev && !(prev.id && byId.has(prev.id))) prev = prev.previousElementSibling;
        navLinks.forEach((a) => a.classList.remove("is-active"));
        if (prev) byId.get(prev.id).classList.add("is-active");
      }, { rootMargin: "-45% 0px -50% 0px" }).observe(s);
    });
  }

  /* ---------- Mobilmeny ---------- */
  const toggle = document.querySelector("[data-menu-toggle]");
  const sheet = document.querySelector("[data-sheet]");
  if (toggle && sheet) {
    const iconOpen = toggle.querySelector("[data-icon-open]");
    const iconClose = toggle.querySelector("[data-icon-close]");
    let closeTimer = 0;

    const setOpen = (open) => {
      clearTimeout(closeTimer);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Stäng meny" : "Öppna meny");
      iconOpen.hidden = open;
      iconClose.hidden = !open;
      if (open) {
        sheet.hidden = false;
        sheet.dataset.state = "closed";
        requestAnimationFrame(() => requestAnimationFrame(() => { sheet.dataset.state = "open"; }));
      } else {
        sheet.dataset.state = "closed";
        closeTimer = setTimeout(() => { sheet.hidden = true; }, 260);
      }
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    sheet.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (toggle.getAttribute("aria-expanded") === "true" && !e.target.closest("[data-nav]")) setOpen(false);
    });
  }

  /* ---------- Kontaktuppgifter och Instagram från config.js ---------- */
  const icon = (name) => {
    const ic = document.createElement("span");
    ic.className = "ic";
    ic.style.setProperty("--i", `url(public/icons/${name}.svg)`);
    return ic;
  };
  const instaLink = () => {
    const a = document.createElement("a");
    a.className = "social__btn";
    a.href = `https://www.instagram.com/${cfg.instagram}/`;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", "QuickRev UF på Instagram");
    a.append(icon("instagram-logo"));
    return a;
  };

  const details = document.querySelector("[data-contact-details]");
  if (details) {
    const items = [];
    if (cfg.epost) items.push({ href: `mailto:${cfg.epost}`, text: cfg.epost, icon: "envelope-simple" });
    if (cfg.telefon) items.push({ href: `tel:${cfg.telefon.replace(/[^\d+]/g, "")}`, text: cfg.telefon, icon: "phone" });
    items.forEach(({ href, text, icon: name }) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.append(icon(name), document.createTextNode(text));
      li.append(a);
      details.append(li);
    });
    if (cfg.instagram) {
      const li = document.createElement("li");
      li.className = "contact__social";
      const label = document.createElement("span");
      label.textContent = "Frågor går också bra som DM:";
      li.append(label, instaLink());
      details.append(li);
    }
    details.hidden = details.children.length === 0;
  }

  document.querySelectorAll("[data-social]").forEach((wrap) => {
    if (cfg.instagram) wrap.append(instaLink());
    if (cfg.epost) {
      const mail = document.createElement("a");
      mail.className = "social__btn";
      mail.href = `mailto:${cfg.epost}`;
      mail.setAttribute("aria-label", `Mejla QuickRev UF på ${cfg.epost}`);
      mail.append(icon("envelope-simple"));
      wrap.append(mail);
    }
    wrap.hidden = wrap.children.length === 0;
  });

  /* ---------- Vändbara kort ---------- */
  document.querySelectorAll("[data-flip]").forEach((card) => {
    const front = card.querySelector(".flip__front");
    const back = card.querySelector(".flip__back");
    card.addEventListener("click", () => {
      const flipped = card.getAttribute("aria-pressed") !== "true";
      card.setAttribute("aria-pressed", String(flipped));
      front.setAttribute("aria-hidden", String(flipped));
      back.setAttribute("aria-hidden", String(!flipped));
    });
  });

  /* ---------- Passar skylten er? ---------- */
  const quiz = document.querySelector("[data-quiz]");
  if (quiz) {
    const steps = [...quiz.querySelectorAll("[data-step]")];
    const progress = quiz.querySelector("[data-quiz-progress]");
    const titleEl = quiz.querySelector("[data-result-title]");
    const textEl = quiz.querySelector("[data-result-text]");
    const badge = quiz.querySelector("[data-result-icon]");
    const cta = quiz.querySelector("[data-result-cta]");
    const answers = {};
    let current = steps[0];

    const TEXT = {
      plats: {
        dagligen: "Ni möter kunder varje dag, och många av dem går därifrån nöjda utan att någonsin skriva en recension. Med skylten vid kassan räcker det med ett blipp.",
        ibland: "Även om kunderna inte kommer in varje dag är det i mötet med er som de är som mest nöjda. Skylten fångar just det ögonblicket.",
      },
      antal: {
        inga: "Ni har mest att vinna. De första recensionerna gör störst skillnad för hur ni uppfattas när någon söker på er.",
        nagra: "Fler och nyare recensioner gör profilen mer trovärdig och hjälper er att synas när någon söker i närheten.",
        manga: "Ni har redan en bra grund. Skylten håller flödet av nya recensioner igång, så att profilen fortsätter kännas aktuell.",
      },
      profil: {
        nej: "Har ni ingen Google-företagsprofil än sätter vi upp en åt er. Skylt och profil tillsammans kostar 899 kr, 199 kr mindre än att köpa dem var för sig.",
        "vet-inte": "Osäkra på om ni har en Google-företagsprofil? Vi kollar det åt er när ni hör av er.",
      },
    };

    // Byte mellan frågor: den gamla glider ut åt vänster, den nya in från höger (samma riktning hela vägen)
    const show = (next) => {
      const prev = current;
      current = next;
      const swap = () => { prev.hidden = true; next.hidden = false; };
      if (reduceMotion.matches || !prev.animate) { swap(); return; }
      prev.animate(
        [{ opacity: 1, transform: "none", filter: "blur(0)" }, { opacity: 0, transform: "translateX(-16px)", filter: "blur(4px)" }],
        { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      ).onfinish = () => {
        swap();
        next.animate(
          [{ opacity: 0, transform: "translateX(16px)", filter: "blur(4px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
          { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
        );
      };
    };

    const para = (t) => { const p = document.createElement("p"); p.textContent = t; return p; };

    const result = () => {
      textEl.replaceChildren();
      if (answers.plats === "digitalt") {
        titleEl.textContent = "Skylten gör mest nytta på plats.";
        textEl.append(
          para("Skylten är byggd för ställen där kunden står framför er, som vid en kassa, disk eller entré."),
          para("Har ni ändå ett kontor, en monter på en mässa eller träffar kunder någon gång ibland kan den passa ändå. Skriv en rad i formuläret så tittar vi på det tillsammans.")
        );
        badge.classList.add("is-neutral");
        cta.hidden = true;
      } else {
        titleEl.textContent = "Ja, skylten passar er.";
        textEl.append(para(TEXT.plats[answers.plats]), para(TEXT.antal[answers.antal]));
        if (TEXT.profil[answers.profil]) textEl.append(para(TEXT.profil[answers.profil]));
        badge.classList.remove("is-neutral");
        cta.hidden = false;
      }
      progress.textContent = "Ert resultat";
      show(steps.find((s) => s.dataset.step === "result"));
    };

    quiz.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-answer]");
      if (!opt || opt.closest("[data-step]") !== current) return;
      answers[opt.dataset.answer] = opt.dataset.value;
      current.querySelectorAll(".quiz__opt").forEach((b) => b.classList.toggle("is-selected", b === opt));
      // Kort paus så att valet hinner synas innan nästa fråga
      setTimeout(() => {
        const n = Number(current.dataset.step);
        if (answers.plats === "digitalt" || n === 3) { result(); return; }
        progress.textContent = `Fråga ${n + 1} av 3`;
        show(steps.find((s) => s.dataset.step === String(n + 1)));
      }, reduceMotion.matches ? 0 : 220);
    });

    quiz.querySelector("[data-quiz-restart]").addEventListener("click", () => {
      Object.keys(answers).forEach((k) => delete answers[k]);
      quiz.querySelectorAll(".is-selected").forEach((b) => b.classList.remove("is-selected"));
      progress.textContent = "Fråga 1 av 3";
      show(steps[0]);
    });

    // Behöver de hjälp med Google-profilen följer det med till beställningssidan
    cta.addEventListener("click", () => {
      try {
        if (answers.profil === "nej") sessionStorage.setItem("qr-paket", "Skylt + Google-profil");
        else sessionStorage.removeItem("qr-paket");
      } catch {}
    });
  }

  // Paketerbjudandet i prisrutan förväljer paketet på beställningssidan
  document.querySelector("[data-deal]")?.addEventListener("click", () => {
    try { sessionStorage.setItem("qr-paket", "Skylt + Google-profil"); } catch {}
  });

  /* ---------- Beställningssidan: paketval ---------- */
  const paketRadios = [...document.querySelectorAll('input[name="paket"]')];
  if (paketRadios.length) {
    const antalField = document.querySelector("[data-antal-field]");
    const sync = () => {
      const val = paketRadios.find((r) => r.checked)?.value;
      if (antalField) antalField.hidden = val === "Bara Google-profil";
    };
    // Förval från paketlänken (?paket=skylt-profil) eller från testet
    let preset = new URLSearchParams(location.search).get("paket") === "skylt-profil" ? "Skylt + Google-profil" : null;
    try {
      preset = preset || sessionStorage.getItem("qr-paket");
      sessionStorage.removeItem("qr-paket");
    } catch {}
    const match = paketRadios.find((r) => r.value === preset);
    if (match) match.checked = true;
    paketRadios.forEach((r) => r.addEventListener("change", sync));
    document.querySelector("[data-form]")?.addEventListener("reset", () => setTimeout(sync));
    sync();
  }

  /* ---------- Integritetspolicyn: kontaktuppgift och formulärtjänst från config.js ---------- */
  const legalContact = document.querySelector("[data-legal-contact]");
  if (legalContact && cfg.epost) {
    const a = legalContact.querySelector("[data-legal-email]");
    a.href = `mailto:${cfg.epost}`;
    a.textContent = cfg.epost;
    legalContact.hidden = false;
  }
  const legalProcessor = document.querySelector("[data-legal-processor]");
  if (legalProcessor && cfg.formEndpoint) legalProcessor.hidden = false;
  if (cfg.statistikToken) {
    document.querySelector("[data-legal-stats]")?.removeAttribute("hidden");
    document.querySelector("[data-legal-nostats]")?.setAttribute("hidden", "");
  }

  /* ---------- Formulär ---------- */
  const form = document.querySelector("[data-form]");
  if (form) {
    const status = form.querySelector("[data-status]");
    const submit = form.querySelector("[data-submit]");
    const label = form.querySelector("[data-submit-label]");
    const required = [...form.querySelectorAll("[required]")];

    const check = (input) => {
      if (input.closest("[hidden]")) return true; // dolda fält (t.ex. antal vid bara profil) räknas inte
      const err = document.getElementById(`${input.id}-err`);
      let ok = input.value.trim() !== "";
      if (input.type === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      if (input.type === "number") ok = Number(input.value) >= 1;
      input.setAttribute("aria-invalid", String(!ok));
      if (err) err.hidden = ok;
      const hint = document.getElementById(`${input.id}-hint`);
      const ids = [hint && hint.id, !ok && err && err.id].filter(Boolean).join(" ");
      if (ids) input.setAttribute("aria-describedby", ids); else input.removeAttribute("aria-describedby");
      return ok;
    };

    form.querySelectorAll("[id$='-hint']").forEach((h) => {
      document.getElementById(h.id.replace(/-hint$/, ""))?.setAttribute("aria-describedby", h.id);
    });

    // Validera när man lämnar fältet, och rätta direkt medan man skriver om det redan var fel
    required.forEach((input) => {
      input.addEventListener("blur", () => { if (input.value !== "") check(input); });
      input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") check(input); });
    });

    const setStatus = (text, tone) => {
      status.textContent = text;
      if (tone) status.dataset.tone = tone; else delete status.dataset.tone;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const results = required.map(check);
      if (results.includes(false)) {
        required[results.indexOf(false)].focus();
        setStatus("Kolla de markerade fälten.", "err");
        return;
      }
      const data = new FormData(form);
      if (data.get("_gotcha")) return;

      if (cfg.formEndpoint) {
        submit.setAttribute("aria-busy", "true");
        label.textContent = "Skickar...";
        setStatus("");
        try {
          const res = await fetch(cfg.formEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error(String(res.status));
          form.reset();
          required.forEach((i) => i.removeAttribute("aria-invalid"));
          setStatus("Tack! Vi hör av oss så snart vi kan.", "ok");
        } catch {
          setStatus(cfg.epost ? `Det gick inte att skicka. Mejla oss gärna på ${cfg.epost}.` : "Det gick inte att skicka. Försök igen om en stund.", "err");
        } finally {
          submit.removeAttribute("aria-busy");
          label.textContent = "Skicka";
        }
        return;
      }

      if (cfg.epost) {
        const paket = data.get("paket") || "Skylt";
        const lines = [
          `Beställning: ${paket}`,
          `Namn: ${data.get("namn")}`,
          `Företag: ${data.get("foretag")}`,
          `E-post: ${data.get("epost")}`,
          `Telefon: ${data.get("telefon") || "-"}`,
          `Ort: ${data.get("ort")}`,
          paket === "Bara Google-profil" ? "" : `Antal skyltar: ${data.get("antal")}`,
          "",
          String(data.get("meddelande") || ""),
        ];
        const subject = `Beställning QuickRev: ${data.get("foretag")}`;
        window.location.href = `mailto:${cfg.epost}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
        setStatus("Ert mejlprogram öppnas med beställningen ifylld.", "ok");
        return;
      }

      setStatus("Formuläret är inte kopplat än. Lägg in e-post eller formEndpoint i config.js.", "err");
    });
  }
})();
