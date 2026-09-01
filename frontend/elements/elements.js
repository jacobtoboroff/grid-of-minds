// ======= Cell Answer Renderer =======
// Renders a correctly-guessed element using a local image from the
// /images folder, named by atomic number (e.g. "26.png" for Iron).
// Falls back automatically to a styled text card if that specific image
// is missing, so one missing file never breaks the cell.
function renderCellAnswer(cell, el) {
  const display = `${el.name} (${el.symbol})`;
  cell.dataset.answer = display;
  cell.dataset.answerName = el.name;
  cell.classList.add("correct");
  cell.innerHTML = "";

  const img = document.createElement("img");
  img.src = `../images/${el.num}.png`;
  img.alt = display;
  img.className = "cell-full-image";
  img.onerror = () => {
    cell.innerHTML = `<div class="cell-full-image cell-answer-text">${display}</div>`;
  };
  cell.appendChild(img);
}

// ======= Helpers: Path-based routing =======
function getGridNumberFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? parseInt(last, 10) : null;
}

// ======= Label Loader from daily-elements.json =======
async function loadGridByDay(day) {
  try {
    const res = await fetch("daily-elements.json", { cache: "no-cache" });
    const data = await res.json();
    const grid = data[day];
    if (!grid) return;

    const header = document.getElementById("grid-number");
    if (header) header.textContent = `GRID #${String(day).padStart(3, "0")}`;

    document.querySelectorAll(".row-label").forEach((el, i) => {
      el.textContent = grid.rows[i] || "";
    });
    document.querySelectorAll(".col-label").forEach((el, i) => {
      el.textContent = grid.columns[i] || "";
    });

    window.__CURRENT_GRID__ = day;
    window.viewingPastGrid = (typeof currentDay === "number") ? (day !== currentDay) : false;
  } catch (e) {
    console.error("Failed to load daily-elements.json", e);
  }
}

// ======= Global State =======
// NOTE: adjust this to whenever Elements Grid actually launches.
const launchDate = new Date("September 1, 2026 00:00:00");
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay;

let elementData = []; // { num, symbol, name, category, state, natural, year, person, place, symlen, diatomic }
const today = currentDay;

// ======= CSV Loader =======
async function loadElements() {
  return new Promise((resolve, reject) => {
    Papa.parse("elements.csv", {
      header: true,
      download: true,
      complete: (results) => {
        elementData = results.data
          .map(row => ({
            num: parseInt(row["AtomicNumber"]),
            symbol: (row["Symbol"] || "").trim(),
            name: (row["Name"] || "").trim(),
            category: (row["Category"] || "").trim(),
            state: (row["PhysicalState"] || "").trim(),
            natural: (row["NaturallyOccurring"] || "").trim(),
            year: parseInt(row["DiscoveryYear"]) || null,
            person: (row["NamedAfterPerson"] || "").trim(),
            place: (row["NamedAfterPlace"] || "").trim(),
            symlen: parseInt(row["SymbolLength"]) || (row["Symbol"] || "").trim().length,
            diatomic: (row["DiatomicInNature"] || "").trim(),
          }))
          .filter(e => e.name && !isNaN(e.num));
        resolve();
      },
      error: reject
    });
  });
}

// ======= Atomic number bucket ranges (must match the generator) =======
const NUM_BUCKET_RANGE = {
  "Atomic Number 1-20": [1, 20],
  "Atomic Number 1-30": [1, 30],
  "Atomic Number 1-40": [1, 40],
  "Atomic Number 1-50": [1, 50],
  "Atomic Number 1-60": [1, 60],
  "Atomic Number 1-70": [1, 70],
  "Atomic Number 40-100": [40, 100],
  "Atomic Number 50-100": [50, 100],
  "Atomic Number 50-118": [50, 118],
  "Atomic Number 60-100": [60, 100],
  "Atomic Number 60-118": [60, 118],
  "Atomic Number 70-118": [70, 118],
  "Atomic Number 80-118": [80, 118],
  "Atomic Number 95-118": [95, 118],
};

function letterBucket(name) {
  const c = name.charAt(0).toUpperCase();
  return (c >= "A" && c <= "J") ? "AJ" : "KZ";
}

function isVowelStart(name) {
  return "AEIOU".includes(name.charAt(0).toUpperCase());
}

// ======= Match Label Function =======
// Mirrors the criteria used to generate daily-elements.json — keep these in
// sync if you ever add new label types to the grid generator.
function matchMatchesLabel(el, label) {
  if (!el || !label) return false;

  if (NUM_BUCKET_RANGE[label]) {
    const [lo, hi] = NUM_BUCKET_RANGE[label];
    return el.num >= lo && el.num <= hi;
  }

  switch (label) {
    case "Noble Gas": return el.category === "Noble Gas";
    case "Alkali Metal": return el.category === "Alkali Metal";
    case "Alkaline Earth Metal": return el.category === "Alkaline Earth Metal";
    case "Transition Metal": return el.category === "Transition Metal";
    case "Post-Transition Metal": return el.category === "Post-Transition Metal";
    case "Metalloid": return el.category === "Metalloid";
    case "Nonmetal": return el.category === "Nonmetal";
    case "Halogen": return el.category === "Halogen";
    case "Lanthanide": return el.category === "Lanthanide";
    case "Actinide": return el.category === "Actinide";
    case "Gas at Room Temperature": return el.state === "Gas";
    case "Solid at Room Temperature": return el.state === "Solid";
    case "Naturally Occurring": return el.natural === "Yes";
    case "Only Made in a Lab": return el.natural === "No";
    case "Named After a Person": return el.person === "Yes";
    case "Named After a Place": return el.place === "Yes";
    case "One-Letter Symbol": return el.symlen === 1;
    case "Two-Letter Symbol": return el.symlen === 2;
    case "Diatomic in Nature": return el.diatomic === "Yes";
    case "Name Starts with A-J": return letterBucket(el.name) === "AJ";
    case "Name Starts with K-Z": return letterBucket(el.name) === "KZ";
    case "Name Starts with a Vowel": return isVowelStart(el.name);
    case "Name Starts with a Consonant": return !isVowelStart(el.name);
    default: return false;
  }
}

// ======= DOM Ready =======
document.addEventListener("DOMContentLoaded", () => {
  const rulesModal = document.getElementById("rules-modal");
  const guessModal = document.getElementById("guess-modal");
  const rulesLink = document.getElementById("rules-link");
  const guessInput = document.getElementById("guess-input");
  const guessContext = document.getElementById("guess-context");
  const guessError = document.getElementById("guess-error");
  const closeGuess = document.getElementById("close-guess");
  const closeRules = document.getElementById("close-rules");
  const closeAnswers = document.getElementById("close-answers");
  const answersModal = document.getElementById("answers-modal");

  closeAnswers.onclick = () => {
    answersModal.style.display = "none";
  };
  const closeEndgame = document.getElementById("close-endgame");
  const endgameModal = document.getElementById("endgame-modal");
  closeEndgame.onclick = () => {
    endgameModal.style.display = "none";
  };

  let activeCell = null;
  const giveUpButton = document.querySelector(".give-up-btn");
  giveUpButton.addEventListener("click", () => {
    guessesLeft = 0;
    document.querySelector(".guesses-count").textContent = guessesLeft;
    saveGameState();
    showEndgameSummary();
  });

  const gridLabel = document.getElementById("grid-number");

  rulesLink.onclick = () => (rulesModal.style.display = "block");
  closeRules.onclick = () => (rulesModal.style.display = "none");

  const box = document.createElement("div");
  box.id = "autocomplete-box";
  guessInput.insertAdjacentElement("afterend", box);

  guessInput.addEventListener("input", () => {
    const val = guessInput.value.trim().toLowerCase();
    box.innerHTML = "";
    if (val.length < 1) {
      box.style.display = "none";
      return;
    }

    const matches = elementData
      .filter(el =>
        el.name.toLowerCase().startsWith(val) ||
        el.symbol.toLowerCase() === val
      )
      .slice(0, 25);

    if (!matches.length) {
      box.style.display = "none";
      return;
    }

    matches.forEach(el => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";

      const textWrap = document.createElement("div");
      textWrap.className = "autocomplete-text";
      const strong = document.createElement("strong");
      strong.textContent = el.name;
      const span = document.createElement("span");
      textWrap.appendChild(strong);
      textWrap.appendChild(span);

      const guessBtn = document.createElement("button");
      guessBtn.className = "autocomplete-select-btn";
      const alreadyUsed = usedElements.has(el.name);
      if (guessesLeft === 0) {
        guessBtn.disabled = true;
        guessBtn.classList.add("disabled");
        guessBtn.textContent = "Guess";
      } else if (alreadyUsed) {
        guessBtn.disabled = true;
        guessBtn.classList.add("disabled");
        guessBtn.textContent = "Used";
      } else {
        guessBtn.textContent = "Guess";
        guessBtn.addEventListener("click", () => handleGuess(el));
      }

      item.appendChild(textWrap);
      item.appendChild(guessBtn);
      box.appendChild(item);
    });

    box.style.display = "block";
  });

  document.addEventListener("click", e => {
    if (!box.contains(e.target) && e.target !== guessInput) box.style.display = "none";
  });

  document.querySelectorAll(".cell").forEach((cell, idx) => {
    cell.addEventListener("click", () => {
      if (cell.classList.contains("correct")) return;
      activeCell = cell;
      guessInput.value = "";
      guessError.style.display = "none";
      guessModal.style.display = "block";
      guessInput.focus();
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent || "";
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent || "";
      guessContext.textContent = `${rowLabel} × ${colLabel}`;
    });
  });

  let guessesLeft = 9;
  const usedElements = new Set(); // element names already used

  function saveGameState() {
    const gridData = [...document.querySelectorAll(".cell")].map(cell => cell.dataset.answerName || null);
    const gameState = {
      guessesLeft,
      usedElements: Array.from(usedElements),
      gridData,
      gameOver: guessesLeft === 0,
      currentDay
    };
    localStorage.setItem("gridOfMindsElementsGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("gridOfMindsElementsGame");
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      localStorage.removeItem("gridOfMindsElementsGame");
      return;
    }
    guessesLeft = state.guessesLeft ?? 9;
    document.querySelector(".guesses-count").textContent = guessesLeft;
    (state.usedElements || []).forEach(name => usedElements.add(name));
    const cells = document.querySelectorAll(".cell");
    state.gridData.forEach((name, i) => {
      if (name && cells[i]) {
        const el = elementData.find(e => e.name === name);
        if (el) renderCellAnswer(cells[i], el);
      }
    });
    if (state.gameOver) {
      setTimeout(showEndgameSummary, 300);
    }
  }

  function handleGuess(el) {
    guessesLeft = Math.max(guessesLeft - 1, 0);
    document.querySelector(".guesses-count").textContent = guessesLeft;

    if (guessesLeft === 0) {
      box.innerHTML = "";
      setTimeout(showEndgameSummary, 300);
    }

    guessModal.style.display = "none";
    box.style.display = "none";
    guessError.style.display = "none";

    if (!el || usedElements.has(el.name)) {
      saveGameState();
      return;
    }

    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;

    if (matchMatchesLabel(el, rowLabel) && matchMatchesLabel(el, colLabel)) {
      renderCellAnswer(activeCell, el);
      usedElements.add(el.name);
      saveGameState();
    }
  }

  closeGuess.onclick = () => (guessModal.style.display = "none");
  window.onclick = e => {
    if (e.target === guessModal) guessModal.style.display = "none";
    if (e.target === rulesModal) rulesModal.style.display = "none";
    if (e.target === answersModal) answersModal.style.display = "none";
    if (e.target === endgameModal) endgameModal.style.display = "none";
  };

  // Load data first, then decide which grid to show
  loadElements().then(async () => {
    let num = getGridNumberFromPath();

    if (!num) {
      const params = new URLSearchParams(window.location.search);
      const gridParam = params.get("grid");
      if (gridParam && !isNaN(gridParam)) {
        num = parseInt(gridParam, 10);
      }
    }

    if (!num) {
      num = today;
    }

    if (gridLabel) gridLabel.textContent = `GRID #${String(num).padStart(3, "0")}`;
    window.__CURRENT_GRID__ = num;

    if (num === today) {
      loadGameState();
    } else {
      localStorage.removeItem("gridOfMindsElementsGame");
      const gc = document.querySelector(".guesses-count");
      if (gc) gc.textContent = "9";
      document.querySelectorAll(".main-grid .cell").forEach(c => {
        c.textContent = "";
        c.className = "cell";
      });
    }

    await loadGridByDay(num);
  });
});

function showEndgameSummary() {
  const playerGrid = document.getElementById("player-summary-grid");
  const resultGrid = document.getElementById("result-summary-grid");
  const finalScoreText = document.getElementById("final-score-text");
  const copyBtn = document.getElementById("copy-results-btn");
  const copyConfirm = document.getElementById("copy-confirmation");
  const endgameModal = document.getElementById("endgame-modal");
  const shareBtn = document.getElementById("share-results-btn");

  shareBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `Elements Grid Results\n${finalScoreText.textContent}\n\n`;
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent.trim() || `Row ${row + 1}`;
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent.trim() || `Col ${col + 1}`;
      const guess = cells[i].textContent || "—";
      const isCorrect = cells[i].classList.contains("correct");
      const mark = isCorrect ? "✅" : "❌";
      output += `${rowLabel} × ${colLabel}: ${guess} ${mark}\n`;
    }
    if (navigator.share) {
      navigator.share({ title: "Elements Grid Results", text: output }).catch(err => {
        alert("Sharing failed: " + err.message);
      });
    } else {
      alert("Sharing not supported on this device.");
    }
  };

  const cells = document.querySelectorAll(".main-grid .cell");
  playerGrid.innerHTML = "";
  resultGrid.innerHTML = "";
  let correctCount = 0;

  cells.forEach(cell => {
    const playerCell = document.createElement("div");
    playerCell.className = "cell";
    if (cell.dataset.answer) {
      playerCell.textContent = cell.dataset.answer;
      playerCell.classList.add("correct");
      correctCount++;
    } else {
      playerCell.textContent = "";
      playerCell.classList.add("empty");
    }
    playerGrid.appendChild(playerCell);

    const resultCell = document.createElement("div");
    resultCell.className = "cell view-answers";
    resultCell.textContent = "View Answers";
    resultCell.addEventListener("click", () => {
      const resultIndex = Array.from(resultGrid.children).indexOf(resultCell);
      const rowIndex = Math.floor(resultIndex / 3);
      const colIndex = resultIndex % 3;
      const rowLabel = document.querySelectorAll(".row-label")[rowIndex]?.textContent;
      const colLabel = document.querySelectorAll(".col-label")[colIndex]?.textContent;
      const validAnswers = elementData.filter(el =>
        matchMatchesLabel(el, rowLabel) && matchMatchesLabel(el, colLabel)
      );
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      answerList.innerHTML = "";
      const seen = new Set();
      validAnswers.forEach(el => {
        if (!seen.has(el.name)) {
          seen.add(el.name);
          const li = document.createElement("li");
          li.textContent = `${el.name} (${el.symbol})`;
          answerList.appendChild(li);
        }
      });
      document.getElementById("answers-modal-title").textContent = `${rowLabel} × ${colLabel}`;
      modal.style.display = "block";
    });
    resultGrid.appendChild(resultCell);
  });

  document.getElementById("play-again-btn").addEventListener("click", () => {
    localStorage.removeItem("gridOfMindsElementsGame");
    location.reload();
  });

  finalScoreText.textContent = `You got ${correctCount} out of 9 correct!`;
  endgameModal.style.display = "block";

  copyBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `${finalScoreText.textContent}\n\nYour Answers:\n`;
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent.trim() || `Row ${row + 1}`;
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent.trim() || `Col ${col + 1}`;
      const guess = cells[i].textContent || "—";
      const isCorrect = cells[i].classList.contains("correct");
      const mark = isCorrect ? "✅" : "❌";
      output += `${rowLabel} × ${colLabel}: ${guess} ${mark}\n`;
    }
    navigator.clipboard.writeText(output).then(() => {
      copyConfirm.style.display = "block";
      setTimeout(() => (copyConfirm.style.display = "none"), 2000);
    });
  };
}

// ================================
// Archives Modal Logic
// ================================
(function () {
  const archivesLink   = document.getElementById("archives-link");
  const archivesModal  = document.getElementById("archives-modal");
  const closeArchives  = document.getElementById("close-archives");
  const archivesList   = document.getElementById("archives-list");
  const gridNumberEl   = document.getElementById("grid-number");

  if (!archivesLink || !archivesModal || !closeArchives || !archivesList) return;

  const GRID_JSON_URL = "daily-elements.json";
  let gridsCache = null;
  let latestGrid = null;

  async function fetchAllGrids() {
    if (gridsCache) return gridsCache;
    const res = await fetch(GRID_JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to fetch daily-elements.json");
    gridsCache = await res.json();
    return gridsCache;
  }

  async function getLatestGridNumber() {
    if (typeof latestGrid === "number") return latestGrid;
    const data = await fetchAllGrids();
    const nums = Object.keys(data)
      .map(k => parseInt(k, 10))
      .filter(n => !isNaN(n));
    latestGrid = nums.length ? Math.max(...nums) : 1;
    return latestGrid;
  }

  function selectArchive(n) {
    closeModal();
    window.location.href = "elements.html?grid=" + String(n);
  }

  function buttonFor(n) {
    const btn = document.createElement("button");
    btn.className = "archive-item";
    btn.textContent = `Grid #${String(n).padStart(3, "0")}`;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.margin = "6px 0";
    btn.style.padding = "10px 12px";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";
    btn.onclick = () => selectArchive(n);
    return btn;
  }

  async function populateArchives() {
    const latest = await getLatestGridNumber();
    const effectiveToday = Number(window.TODAYS_GRID) || 1;
    const cap = Math.min(latest, effectiveToday);

    archivesList.innerHTML = "";

    for (let n = cap; n >= 1; n--) {
      archivesList.appendChild(buttonFor(n));
    }

    if (archivesList.children.length === 0) {
      const p = document.createElement("p");
      p.textContent = "No grids available yet.";
      archivesList.appendChild(p);
    }
  }

  async function openModal() {
    await populateArchives();
    archivesModal.style.display = "block";
  }

  function closeModal() {
    archivesModal.style.display = "none";
  }

  archivesLink.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  if (gridNumberEl) {
    gridNumberEl.style.cursor = "pointer";
    gridNumberEl.title = "View archives";
    gridNumberEl.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  }

  closeArchives.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === archivesModal) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && archivesModal.style.display === "block") closeModal();
  });
})();