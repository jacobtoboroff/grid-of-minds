// ======= Cell Answer Renderer =======
// Renders a correctly-guessed case as a styled text card in the cell.
// Always sets data-answer so game-state saving/loading and the endgame
// summary have a reliable place to read the answer from.
function renderCellAnswer(cell, caseName) {
  cell.dataset.answer = caseName;
  cell.innerHTML = `<div class="cell-full-image cell-answer-text">${caseName}</div>`;
  cell.classList.add("correct");
}

// ======= Helpers: Path-based routing =======
function getGridNumberFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? parseInt(last, 10) : null;
}

// ======= Label Loader from daily-scotus.json =======
async function loadGridByDay(day) {
  try {
    const res = await fetch("daily-scotus.json", { cache: "no-cache" });
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
    console.error("Failed to load daily-scotus.json", e);
  }
}

// ======= Global State =======
// NOTE: adjust this to whenever Supreme Court Grid actually launches.
const launchDate = new Date("September 1, 2026 00:00:00");
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay;

let caseData = []; // { name, year, unanimous, amendment, area, overturned, newright, usparty, race }
const today = currentDay;

// ======= CSV Loader =======
async function loadCases() {
  return new Promise((resolve, reject) => {
    Papa.parse("scotus-cases.csv", {
      header: true,
      download: true,
      complete: (results) => {
        caseData = results.data
          .map(row => ({
            name: (row["Case"] || "").trim(),
            year: parseInt(row["YearDecided"]) || null,
            unanimous: (row["Unanimous"] || "").trim(),
            amendment: (row["Amendment"] || "").trim(),
            area: (row["AreaOfLaw"] || "").trim(),
            overturned: (row["OverturnedPriorPrecedent"] || "").trim(),
            newright: (row["EstablishedNewRight"] || "").trim(),
            usparty: (row["UnitedStatesParty"] || "").trim(),
            race: (row["RaceCentralIssue"] || "").trim(),
          }))
          .filter(c => c.name && c.year);
        resolve();
      },
      error: reject
    });
  });
}

function letterBucket(name) {
  const c = name.charAt(0).toUpperCase();
  return (c >= "A" && c <= "J") ? "AJ" : "KZ";
}

// ======= Match Label Function =======
// Mirrors the criteria used to generate daily-scotus.json — keep these in
// sync if you ever add new label types to the grid generator.
function matchMatchesLabel(caseObj, label) {
  if (!caseObj || !label) return false;

  switch (label) {
    case "Unanimous Decision": return caseObj.unanimous === "Yes";
    case "Not a Unanimous Decision": return caseObj.unanimous === "No";
    case "Decided Before 1970": return caseObj.year < 1970;
    case "Decided 1970 or Later": return caseObj.year >= 1970;
    case "Involves the 1st Amendment": return caseObj.amendment === "1st";
    case "Involves the 2nd Amendment": return caseObj.amendment === "2nd";
    case "Involves the 4th Amendment": return caseObj.amendment === "4th";
    case "Involves the 5th Amendment": return caseObj.amendment === "5th";
    case "Involves the 6th Amendment": return caseObj.amendment === "6th";
    case "Involves the 14th Amendment": return caseObj.amendment === "14th";
    case "No Amendment Directly Involved": return caseObj.amendment === "None";
    case "Criminal Procedure Case": return caseObj.area === "Criminal Procedure";
    case "Equal Protection/Civil Rights Case": return caseObj.area === "Equal Protection/Civil Rights";
    case "Executive Power Case": return caseObj.area === "Executive Power";
    case "Federalism/Government Structure Case": return caseObj.area === "Federalism/Government Structure";
    case "Elections & Voting Case": return caseObj.area === "Elections & Voting";
    case "Individual Rights & Privacy Case": return caseObj.area === "Individual Rights & Privacy";
    case "Overturned a Prior Precedent": return caseObj.overturned === "Yes";
    case "Did Not Overturn a Prior Precedent": return caseObj.overturned === "No";
    case "Established a New Right": return caseObj.newright === "Yes";
    case "Did Not Establish a New Right": return caseObj.newright === "No";
    case "United States Named as a Party": return caseObj.usparty === "Yes";
    case "United States Not a Party": return caseObj.usparty === "No";
    case "Race Was a Central Issue": return caseObj.race === "Yes";
    case "Race Was Not a Central Issue": return caseObj.race === "No";
    case "Case Name Starts with A-J": return letterBucket(caseObj.name) === "AJ";
    case "Case Name Starts with K-Z": return letterBucket(caseObj.name) === "KZ";
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
  const TOTAL_CELLS = 4; // 2 rows x 2 columns
  const NUM_COLS = 2;

  rulesLink.onclick = () => (rulesModal.style.display = "block");
  closeRules.onclick = () => (rulesModal.style.display = "none");

  const box = document.createElement("div");
  box.id = "autocomplete-box";
  guessInput.insertAdjacentElement("afterend", box);

  // "United States" is a special case: several unrelated cases contain the
  // phrase mid-name (Schenck v. United States, Katz v. United States, etc.),
  // so while someone is clearly typing toward "united states" specifically,
  // we require the case name to START with it — which narrows to just
  // United States v. Nixon. Any other search still matches anywhere in the
  // name, so "Wade" still finds Roe v. Wade, "Nixon" still finds this case
  // too, etc.
  const UNITED_STATES_PREFIX = "united states";

  guessInput.addEventListener("input", () => {
    const val = guessInput.value.trim().toLowerCase();
    box.innerHTML = "";
    if (val.length < 1) {
      box.style.display = "none";
      return;
    }

    const useStartsWith = UNITED_STATES_PREFIX.startsWith(val);

    const matches = caseData
      .filter(c => {
        const name = c.name.toLowerCase();
        return useStartsWith ? name.startsWith(val) : name.includes(val);
      })
      .slice(0, 25);

    if (!matches.length) {
      box.style.display = "none";
      return;
    }

    matches.forEach(c => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = c.name;
      const guessBtn = document.createElement("button");
      guessBtn.textContent = "Guess";
      guessBtn.className = "autocomplete-select-btn";
      const alreadyUsed = usedCases.has(c.name);
      if (guessesLeft === 0) {
        guessBtn.disabled = true;
        guessBtn.classList.add("disabled");
      } else if (alreadyUsed) {
        guessBtn.disabled = true;
        guessBtn.classList.add("disabled");
        guessBtn.textContent = "Used";
      } else {
        guessBtn.textContent = "Guess";
        guessBtn.addEventListener("click", () => handleGuess(c));
      }

      item.appendChild(nameSpan);
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
      const row = Math.floor(idx / NUM_COLS);
      const col = idx % NUM_COLS;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent || "";
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent || "";
      guessContext.textContent = `${rowLabel} × ${colLabel}`;
    });
  });

  let guessesLeft = TOTAL_CELLS;
  const usedCases = new Set();

  function saveGameState() {
    const gridData = [...document.querySelectorAll(".cell")].map(cell => cell.dataset.answer || null);
    const gameState = {
      guessesLeft,
      usedCases: Array.from(usedCases),
      gridData,
      gameOver: guessesLeft === 0,
      currentDay
    };
    localStorage.setItem("gridOfMindsScotusGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("gridOfMindsScotusGame");
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      localStorage.removeItem("gridOfMindsScotusGame");
      return;
    }
    guessesLeft = state.guessesLeft ?? TOTAL_CELLS;
    document.querySelector(".guesses-count").textContent = guessesLeft;
    (state.usedCases || []).forEach(name => usedCases.add(name));
    const cells = document.querySelectorAll(".cell");
    state.gridData.forEach((name, i) => {
      if (name && cells[i]) {
        renderCellAnswer(cells[i], name);
      }
    });
    if (state.gameOver) {
      setTimeout(showEndgameSummary, 300);
    }
  }

  function handleGuess(caseObj) {
    guessesLeft = Math.max(guessesLeft - 1, 0);
    document.querySelector(".guesses-count").textContent = guessesLeft;

    if (guessesLeft === 0) {
      box.innerHTML = "";
      setTimeout(showEndgameSummary, 300);
    }

    guessModal.style.display = "none";
    box.style.display = "none";
    guessError.style.display = "none";

    if (!caseObj || usedCases.has(caseObj.name)) {
      saveGameState();
      return;
    }

    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / NUM_COLS);
    const col = idx % NUM_COLS;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;

    if (matchMatchesLabel(caseObj, rowLabel) && matchMatchesLabel(caseObj, colLabel)) {
      renderCellAnswer(activeCell, caseObj.name);
      usedCases.add(caseObj.name);
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
  loadCases().then(async () => {
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
      localStorage.removeItem("gridOfMindsScotusGame");
      const gc = document.querySelector(".guesses-count");
      if (gc) gc.textContent = String(TOTAL_CELLS);
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
  const NUM_COLS = 2;

  shareBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `Supreme Court Grid Results\n${finalScoreText.textContent}\n\n`;
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / NUM_COLS);
      const col = i % NUM_COLS;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent.trim() || `Row ${row + 1}`;
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent.trim() || `Col ${col + 1}`;
      const guess = cells[i].textContent || "—";
      const isCorrect = cells[i].classList.contains("correct");
      const mark = isCorrect ? "✅" : "❌";
      output += `${rowLabel} × ${colLabel}: ${guess} ${mark}\n`;
    }
    if (navigator.share) {
      navigator.share({ title: "Supreme Court Grid Results", text: output }).catch(err => {
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
      const rowIndex = Math.floor(resultIndex / NUM_COLS);
      const colIndex = resultIndex % NUM_COLS;
      const rowLabel = document.querySelectorAll(".row-label")[rowIndex]?.textContent;
      const colLabel = document.querySelectorAll(".col-label")[colIndex]?.textContent;
      const validAnswers = caseData.filter(c =>
        matchMatchesLabel(c, rowLabel) && matchMatchesLabel(c, colLabel)
      );
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      answerList.innerHTML = "";
      const seen = new Set();
      validAnswers.forEach(c => {
        if (!seen.has(c.name)) {
          seen.add(c.name);
          const li = document.createElement("li");
          li.textContent = c.name;
          answerList.appendChild(li);
        }
      });
      document.getElementById("answers-modal-title").textContent = `${rowLabel} × ${colLabel}`;
      modal.style.display = "block";
    });
    resultGrid.appendChild(resultCell);
  });

  document.getElementById("play-again-btn").addEventListener("click", () => {
    localStorage.removeItem("gridOfMindsScotusGame");
    location.reload();
  });

  finalScoreText.textContent = `You got ${correctCount} out of 4 correct!`;
  endgameModal.style.display = "block";

  copyBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `${finalScoreText.textContent}\n\nYour Answers:\n`;
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / NUM_COLS);
      const col = i % NUM_COLS;
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

  const GRID_JSON_URL = "daily-scotus.json";
  let gridsCache = null;
  let latestGrid = null;

  async function fetchAllGrids() {
    if (gridsCache) return gridsCache;
    const res = await fetch(GRID_JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to fetch daily-scotus.json");
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
    window.location.href = "scotusgrid.html?grid=" + String(n);
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