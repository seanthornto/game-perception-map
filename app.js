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
    "The Sims 4",
    "Super Mario Odyssey",
    "Baldur's Gate 3",
    "Call of Duty",
    "Stardew Valley"
  ],

  // Paste the Google Apps Script deployment URL here.
  // Leave blank to test locally; submissions will download as JSON instead.
  endpointUrl: "https://script.google.com/macros/s/AKfycbwO9Av9EIwMqmWkTpGUo7lpo4mWe9njnzZ0uZesdqrWUynpuk6QnvhE2Q59A2HSsG5AHQ/exec"
};

const state = {
  placements: new Map(),
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
    const card = document.createElement("button");
    card.type = "button";
    card.className = "movie-card";
    card.textContent = label;
    card.dataset.item = label;
    card.dataset.index = String(index);
    card.addEventListener("pointerdown", startDrag);
    tray.appendChild(card);
  });

  submitButton.addEventListener("click", submitPlacements);
  resetButton.addEventListener("click", resetPlacements);
  document.getElementById("close-dialog").addEventListener("click", () => successDialog.close());

  updateProgress();
}

function startDrag(event) {
  event.preventDefault();

  const card = event.currentTarget;
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
  } else {
    tray.appendChild(card);
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
  const total = CONFIG.items.length;
  progressCount.textContent = `${placed} / ${total} placed`;

  const complete = placed === total;
  submitButton.disabled = !complete;
  statusTitle.textContent = complete
    ? "Everything is placed."
    : `Place ${total - placed} more ${total - placed === 1 ? "title" : "titles"} to continue.`;

  statusMessage.textContent = complete
    ? "Review your map, then submit when ready."
    : "Your vote is not submitted until you press the button.";
}

function resetPlacements() {
  state.placements.clear();
  document.querySelectorAll(".movie-card").forEach(card => {
    tray.appendChild(card);
    card.classList.remove("placed", "dragging");
    card.style.left = "";
    card.style.top = "";
  });
  updateProgress();
}

async function submitPlacements() {
  const range = CONFIG.axisMode === "quadrants" ? "-100 to 100" : "0 to 100";

  const payload = {
    surveyTitle: CONFIG.title,
    axisMode: CONFIG.axisMode,
    coordinateRange: range,
    respondent: document.getElementById("respondent-name").value.trim() || "Anonymous",
    submittedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    placements: CONFIG.items.map(item => ({
      item,
      x: state.placements.get(item).x,
      y: state.placements.get(item).y
    }))
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
