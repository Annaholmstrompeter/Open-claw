(function () {
  "use strict";

  let issues = [];
  let parties = [];
  let currentIndex = 0;
  const answers = {}; // issueId -> { score, weight }
  const chatHistory = [];

  const screens = {
    intro: document.getElementById("screen-intro"),
    quiz: document.getElementById("screen-quiz"),
    results: document.getElementById("screen-results"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadData() {
    const [issuesRes, partiesRes] = await Promise.all([
      fetch("/data/issues.json"),
      fetch("/data/parties.json"),
    ]);
    issues = await issuesRes.json();
    parties = await partiesRes.json();
  }

  function ensureAnswer(issueId) {
    if (!answers[issueId]) {
      answers[issueId] = { score: 0, weight: 2 };
    }
    return answers[issueId];
  }

  function renderQuestion() {
    const issue = issues[currentIndex];
    const a = ensureAnswer(issue.id);

    document.getElementById("progress-fill").style.width =
      ((currentIndex) / issues.length) * 100 + "%";
    document.getElementById("progress-label").textContent =
      `Fråga ${currentIndex + 1} av ${issues.length}`;

    document.getElementById("question-title").textContent = issue.title;
    document.getElementById("question-factbrief").textContent = issue.factbrief;

    const sourcesEl = document.getElementById("question-sources");
    sourcesEl.innerHTML = "";
    (issue.factbrief_sources || []).forEach((s, i) => {
      const link = document.createElement("a");
      link.href = s.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = s.label;
      sourcesEl.appendChild(link);
      if (i < issue.factbrief_sources.length - 1) sourcesEl.append(" · ");
    });

    document.getElementById("label-low").textContent = issue.axis_label_low;
    document.getElementById("label-high").textContent = issue.axis_label_high;

    const slider = document.getElementById("answer-slider");
    slider.value = a.score;

    document.querySelectorAll(".weight-chip").forEach((chip) => {
      chip.classList.toggle("selected", Number(chip.dataset.weight) === a.weight);
    });

    document.getElementById("btn-prev").disabled = currentIndex === 0;
    document.getElementById("btn-next").textContent =
      currentIndex === issues.length - 1 ? "Se resultat" : "Nästa";
  }

  function computeResults() {
    const maxDiff = 4; // score range -2..2
    return parties
      .map((party) => {
        let weightedDiffSum = 0;
        let weightSum = 0;
        issues.forEach((issue) => {
          const a = answers[issue.id];
          const pos = issue.positions[party.id];
          if (!a || !pos) return;
          const diff = Math.abs(a.score - pos.score);
          weightedDiffSum += diff * a.weight;
          weightSum += maxDiff * a.weight;
        });
        const matchFraction = weightSum > 0 ? 1 - weightedDiffSum / weightSum : 0;
        return { party, pct: Math.round(matchFraction * 100) };
      })
      .sort((a, b) => b.pct - a.pct);
  }

  function renderResults() {
    const ranked = computeResults();
    const container = document.getElementById("party-results");
    container.innerHTML = "";

    ranked.forEach(({ party, pct }) => {
      const card = document.createElement("div");
      card.className = "party-result";

      const head = document.createElement("div");
      head.className = "party-result-head";
      head.innerHTML = `
        <span class="party-swatch" style="background:${party.color}"></span>
        <span class="party-name">${party.name}</span>
        <span class="party-pct">${pct}%</span>
      `;

      const barTrack = document.createElement("div");
      barTrack.className = "party-bar-track";
      const barFill = document.createElement("div");
      barFill.className = "party-bar-fill";
      barFill.style.width = pct + "%";
      barFill.style.background = party.color;
      barTrack.appendChild(barFill);

      const detail = document.createElement("div");
      detail.className = "party-detail";
      issues.forEach((issue) => {
        const pos = issue.positions[party.id];
        if (!pos) return;
        const row = document.createElement("div");
        row.className = "detail-issue";
        const sourceHtml = pos.source && pos.source.url
          ? ` <a class="source-link" href="${pos.source.url}" target="_blank" rel="noopener">Källa: ${pos.source.label}</a>`
          : "";
        row.innerHTML = `<div class="issue-name">${issue.title}</div><div class="stance-text">${pos.stance}${sourceHtml}</div>`;
        detail.appendChild(row);
      });

      head.addEventListener("click", () => detail.classList.toggle("open"));

      card.appendChild(head);
      card.appendChild(barTrack);
      card.appendChild(detail);
      container.appendChild(card);
    });

    const methodologyEl = document.getElementById("methodology-text");
    fetch("/data/METHODOLOGY.md")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        methodologyEl.textContent = text;
      })
      .catch(() => {
        methodologyEl.textContent =
          "Matchningen räknas ut genom att jämföra dina svar (viktade efter hur viktig du sa att frågan var) mot varje partis källbelagda position i samma sakfråga.";
      });
  }

  function next() {
    const issue = issues[currentIndex];
    const slider = document.getElementById("answer-slider");
    ensureAnswer(issue.id).score = Number(slider.value);

    if (currentIndex < issues.length - 1) {
      currentIndex += 1;
      renderQuestion();
    } else {
      renderResults();
      showScreen("results");
    }
  }

  function prev() {
    if (currentIndex === 0) return;
    currentIndex -= 1;
    renderQuestion();
  }

  function appendChatMessage(role, text) {
    const log = document.getElementById("chat-log");
    const el = document.createElement("div");
    el.className = "chat-msg " + role;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  async function sendChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    appendChatMessage("user", text);
    chatHistory.push({ role: "user", content: text });

    const hint = document.getElementById("chat-hint");
    hint.textContent = "Tänker…";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });
      const data = await res.json();
      if (!res.ok) {
        hint.textContent = data.error || "Något gick fel.";
        return;
      }
      hint.textContent = "";
      appendChatMessage("assistant", data.reply);
      chatHistory.push({ role: "assistant", content: data.reply });
    } catch (e) {
      hint.textContent = "Kunde inte nå servern.";
    }
  }

  function init() {
    document.getElementById("btn-start").addEventListener("click", async () => {
      currentIndex = 0;
      renderQuestion();
      showScreen("quiz");
    });

    document.getElementById("btn-next").addEventListener("click", next);
    document.getElementById("btn-prev").addEventListener("click", prev);

    document.getElementById("weight-options").addEventListener("click", (e) => {
      const chip = e.target.closest(".weight-chip");
      if (!chip) return;
      const issue = issues[currentIndex];
      ensureAnswer(issue.id).weight = Number(chip.dataset.weight);
      document.querySelectorAll(".weight-chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    });

    document.getElementById("btn-restart").addEventListener("click", (e) => {
      e.preventDefault();
      currentIndex = 0;
      Object.keys(answers).forEach((k) => delete answers[k]);
      chatHistory.length = 0;
      document.getElementById("chat-log").innerHTML = "";
      showScreen("intro");
    });

    document.getElementById("chat-send").addEventListener("click", sendChat);
    document.getElementById("chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });

    loadData();
  }

  init();
})();
