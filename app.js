/*
  PERCEPTION MAP CONFIGURATION
  ----------------------------
  axisMode options:
    "positive" = 0 to 100 on both axes, with the origin at the lower-left corner.
    "quadrants" = -100 to 100 on both axes, with zero at the center.

  Change the game list and labels below.
*/

const CONFIG = {
  title: "Place each video game on the map",
  instructions: "Drag every title onto the chart based on its mechanical fidelity and perceived player expression.",
  itemHeading: "Video game titles",

  axisMode: "positive",

  axes: {
    xLow: "0",
    xHigh: "Mechanical Fidelity",
    yLow: "0",
    yHigh: "Perceived Player Expression"
  },

  items: [
    "Minecraft",
    "The Legend of Zelda: Breath of the Wild",
    "Dark Souls",
    "Super Mario 64",
    "Super Mario Galaxy",
    "Super Mario Odyssey",
    "Chess",
    "Animal Crossing",
    "League of Legends",
    "Apex Legends",
    "SSB 64",
    "SSB: Melee",
    "SSB: Brawl",
    "SSB 4",
    "SSB: Ultimate",
    "Straight out of Neutch",
    "The Mix-ologist",
    "hyperkidmorph2mr.gunner",
    "Portal",
    "Hades",
    "Journey",
    "Half-Life 2",
    "Tetris",
    "Outer Wilds"
  ],

  // Paste the Google Apps Script deployment URL here.
  // Leave blank to test locally; submissions will download as JSON instead.
  endpointUrl: ""
};

const state = {
  placements: new Map(),
  unknownItems: new Set(),
  dragging: null
};

const plot = document.getElementById("plot");
const tray = document.getElementById("item-tray");
const submitButton = document.getElementById("submit-button");
const resetButton = document.getElementById("reset-button");
const progressCount = document.getElementById("progress-count");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const successDialog = document.getElementById("success-dialog");
const respondentNameInput = document.getElementById("respondent-name");

initialize();

function initialize() {
  document.getElementById("page-title").textContent = CONFIG.title;
  document.getElementById("instructions").textContent = CONFIG.instructions;
  document.getElementById("item-heading").textContent = CONFIG.itemHeading;
  document.getElementById("x-high-label").textContent = CONFIG.axes.xHigh;
  document.getElementById("y-high-label").textContent = CONFIG.axes.yHigh;
  document.getElementById("origin-label").textContent = "0";

  plot.classList.toggle("origin-corner", CONFIG.axisMode === "positive");
  plot.classList.toggle("origin-center", CONFIG.axisMode === "quadrants");

  CONFIG.items.forEach((label, index) => {
    const row = document.createElement("div");
    row.className = "title-row";
    row.dataset.item = label;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "movie-card";
    card.textContent = label;
    card.dataset.item = label;
    card.dataset.index = String(index);
    card.addEventListener("pointerdown", startDrag);

    const placeholder = document.createElement("div");
    placeholder.className = "movie-card-placeholder";
    placeholder.textContent = "Placed on chart";

    const unknownLabel = document.createElement("label");
    unknownLabel.className = "unknown-control";

    const unknownCheckbox = document.createElement("input");
    unknownCheckbox.type = "checkbox";
    unknownCheckbox.dataset.item = label;
    unknownCheckbox.setAttribute("aria-label", `I don't know ${label}`);
    unknownCheckbox.addEventListener("change", toggleUnknown);

    const unknownText = document.createElement("span");
    unknownText.textContent = "I don’t know this title";

    unknownLabel.appendChild(unknownCheckbox);
    unknownLabel.appendChild(unknownText);

    row.appendChild(card);
    row.appendChild(placeholder);
    row.appendChild(unknownLabel);
    tray.appendChild(row);
  });

  submitButton.addEventListener("click", submitPlacements);
  respondentNameInput.addEventListener("input", updateProgress);
  resetButton.addEventListener("click", resetPlacements);
  document.getElementById("close-dialog").addEventListener("click", () => successDialog.close());

  updateProgress();
}

function startDrag(event) {
  event.preventDefault();

  const card = event.currentTarget;
  if (state.unknownItems.has(card.dataset.item)) return;
  const originalRect = card.getBoundingClientRect();

  state.dragging = {
    card,
    pointerId: event.pointerId,
    offsetX: event.clientX - originalRect.left,
    offsetY: event.clientY - originalRect.top
  };

  card.classList.add("dragging");
  card.setPointerCapture(event.pointerId);
  card.addEventListener("pointermove", moveDrag);
  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);
}

function moveDrag(event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;

  const { card } = state.dragging;
  const plotRect = plot.getBoundingClientRect();

  if (card.parentElement !== plot) {
    plot.appendChild(card);
    card.classList.add("placed");
  }

  const x = clamp(event.clientX - plotRect.left, 0, plotRect.width);
  const y = clamp(event.clientY - plotRect.top, 0, plotRect.height);

  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

function endDrag(event) {
  if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;

  const { card } = state.dragging;
  card.releasePointerCapture(event.pointerId);
  card.removeEventListener("pointermove", moveDrag);
  card.removeEventListener("pointerup", endDrag);
  card.removeEventListener("pointercancel", endDrag);
  card.classList.remove("dragging");

  const plotRect = plot.getBoundingClientRect();
  const insidePlot =
    event.clientX >= plotRect.left &&
    event.clientX <= plotRect.right &&
    event.clientY >= plotRect.top &&
    event.clientY <= plotRect.bottom;

  if (insidePlot) {
    const xPct = clamp((event.clientX - plotRect.left) / plotRect.width * 100, 0, 100);
    const yFromTopPct = clamp((event.clientY - plotRect.top) / plotRect.height * 100, 0, 100);
    const yPct = 100 - yFromTopPct;

    let xValue;
    let yValue;

    if (CONFIG.axisMode === "quadrants") {
      xValue = xPct * 2 - 100;
      yValue = yPct * 2 - 100;
    } else {
      xValue = xPct;
      yValue = yPct;
    }

    card.style.left = `${xPct}%`;
    card.style.top = `${yFromTopPct}%`;
    card.classList.add("placed");

    state.placements.set(card.dataset.item, {
      x: round(xValue, 2),
      y: round(yValue, 2)
    });

    const row = getTitleRow(card.dataset.item);
    if (row) row.classList.add("is-placed");
  } else {
    const row = getTitleRow(card.dataset.item);
    if (row) {
      row.insertBefore(card, row.firstChild);
      row.classList.remove("is-placed");
    }
    card.classList.remove("placed");
    card.style.left = "";
    card.style.top = "";
    state.placements.delete(card.dataset.item);
  }

  state.dragging = null;
  updateProgress();
}

function updateProgress() {
  const placed = state.placements.size;
  const unknown = state.unknownItems.size;
  const resolved = placed + unknown;
  const total = CONFIG.items.length;
  const hasName = respondentNameInput.value.trim().length > 0;

  progressCount.textContent = `${resolved} / ${total} completed`;

  const titlesComplete = resolved === total;
  const ready = titlesComplete && hasName;
  submitButton.disabled = !ready;

  if (!hasName && !titlesComplete) {
    statusTitle.textContent = `Enter your name and complete ${total - resolved} more ${total - resolved === 1 ? "title" : "titles"}.`;
    statusMessage.textContent = "Place each known title or mark it as unknown.";
  } else if (!hasName) {
    statusTitle.textContent = "Enter your name to continue.";
    statusMessage.textContent = "The name is used only to label your row in the Google Sheet.";
  } else if (!titlesComplete) {
    statusTitle.textContent = `Complete ${total - resolved} more ${total - resolved === 1 ? "title" : "titles"} to continue.`;
    statusMessage.textContent = "Place each known title or mark it as unknown.";
  } else {
    statusTitle.textContent = "Everything is ready.";
    statusMessage.textContent = `${placed} placed and ${unknown} marked unknown. Review, then submit.`;
  }
}

function resetPlacements() {
  state.placements.clear();
  state.unknownItems.clear();

  document.querySelectorAll(".title-row").forEach(row => {
    row.classList.remove("is-placed", "is-unknown");

    const card = row.querySelector(".movie-card");
    const checkbox = row.querySelector(".unknown-control input");

    row.insertBefore(card, row.firstChild);
    card.classList.remove("placed", "dragging");
    card.style.left = "";
    card.style.top = "";
    card.disabled = false;
    checkbox.checked = false;
  });

  updateProgress();
}

function toggleUnknown(event) {
  const checkbox = event.currentTarget;
  const item = checkbox.dataset.item;
  const row = getTitleRow(item);
  const card = document.querySelector(`.movie-card[data-item="${cssEscape(item)}"]`);

  if (checkbox.checked) {
    state.unknownItems.add(item);
    state.placements.delete(item);

    if (row && card) {
      row.insertBefore(card, row.firstChild);
      row.classList.remove("is-placed");
      row.classList.add("is-unknown");
      card.classList.remove("placed", "dragging");
      card.style.left = "";
      card.style.top = "";
      card.disabled = true;
    }
  } else {
    state.unknownItems.delete(item);

    if (row && card) {
      row.classList.remove("is-unknown");
      card.disabled = false;
    }
  }

  updateProgress();
}

function getTitleRow(item) {
  return document.querySelector(`.title-row[data-item="${cssEscape(item)}"]`);
}

function cssEscape(value) {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

async function submitPlacements() {
  const respondent = respondentNameInput.value.trim();

  if (!respondent) {
    respondentNameInput.focus();
    statusTitle.textContent = "Please enter your name.";
    statusMessage.textContent = "The name is required so your response can be labeled in the Google Sheet.";
    return;
  }

  if (state.placements.size + state.unknownItems.size !== CONFIG.items.length) {
    updateProgress();
    return;
  }

  const range = CONFIG.axisMode === "quadrants" ? "-100 to 100" : "0 to 100";

  const payload = {
    surveyTitle: CONFIG.title,
    axisMode: CONFIG.axisMode,
    coordinateRange: range,
    respondent,
    submittedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    placements: CONFIG.items.map(item => {
      const placement = state.placements.get(item);
      const known = !state.unknownItems.has(item);

      return {
        item,
        known,
        x: known && placement ? placement.x : null,
        y: known && placement ? placement.y : null
      };
    })
  };

  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";
  statusMessage.textContent = "Saving your placements.";

  try {
    if (!CONFIG.endpointUrl) {
      downloadJson(payload);
    } else {
      await fetch(CONFIG.endpointUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
    }

    successDialog.showModal();
    statusTitle.textContent = "Submission complete.";
    statusMessage.textContent = "Thank you for participating.";
  } catch (error) {
    console.error(error);
    statusTitle.textContent = "The submission did not go through.";
    statusMessage.textContent = "Check the endpoint URL and deployment permissions, then try again.";
    submitButton.disabled = false;
  } finally {
    submitButton.textContent = "Submit placements";
  }
}

function downloadJson(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `perception-map-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
