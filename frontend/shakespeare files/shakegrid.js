// ======= Cell Answer Renderer =======
// Renders a correctly-guessed play using a local image from the /images
// folder (shared with Elements Grid), named by exact play title —
// e.g. "Romeo and Juliet.png", "Cymbeline.png", "Richard III.png".
// Falls back automatically to a styled text card if that specific image
// is missing or misnamed, so one bad filename never breaks the cell.
function renderCellAnswer(cell, title) {
  cell.dataset.answer = title;
  cell.classList.add("correct");
  cell.innerHTML = "";

  const img = document.createElement("img");
  img.src = `../images/${encodeURIComponent(title)}.png`;
  img.alt = title;
  img.className = "cell-full-image";
  img.onerror = () => {
    cell.innerHTML = `<div class="cell-full-image cell-answer-text">${title}</div>`;
  };
  cell.appendChild(img);
}

// ======= Helpers: Path-based routing =======
function getGridNumberFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? parseInt(last, 10) : null;
}

// ======= Label Loader from shakegrid.json =======
async function loadGridByDay(day) {
  try {
    const res = await fetch("shakegrid.json", { cache: "no-cache" });
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
    console.error("Failed to load shakegrid.json", e);
  }
}

// ======= Global State =======
// NOTE: adjust this to whenever Shakespeare Grid actually launches.
const launchDate = new Date("September 1, 2026 00:00:00");
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay;

let playData = [];
const today = currentDay;

// ======= CSV Loader =======
async function loadPlays() {
  return new Promise((resolve, reject) => {
    Papa.parse("Shakespearegrid.csv", {
      header: true,
      download: true,
      complete: (results) => {
        playData = results.data.map(row => {
          const norm = (v) => (v || "").trim().toLowerCase();
          return {
            title: (row["Play Title"] || "").replace(/\s+/g, " ").trim(),
            history: norm(row["History"]),
            comedy: norm(row["Comedy"]),
            tragedy: norm(row["Tragedy"]),
            late_romance: norm(row["Late Romance"]),
            first_henriad: norm(row["First Henriad"]),
            second_henriad: norm(row["Second Henriad"]),
            falstaff: norm(row["Includes / Mentions John Falstaff"]),
            antonio: norm(row["Characted named Antonio"]),
            cross_dressing: norm(row["Cross-dressing"]),
            length_rank: parseInt(row["Length"]) || null,
            ghosts: norm(row["Ghosts, Spirits, or Fairies Appear"]),
            sibling_rivalry: norm(row["Sibling Rivalry"]),
            set_britain: norm(row["Set in Britain"]),
            set_italy: norm(row["Set in Italy"]),
            set_greece: norm(row["Set in Greece/ Turkey"]),
            char_name_in_title: norm(row["Character Name in Title"]),
            cuckold: norm(row["Cuckhold Theme"]),
            female_most_lines: norm(row["Female Character with Most Lines"]),
            titular_dies: norm(row["Titular Character Dies"]), // "yes" / "no" / "x"
            bastard: norm(row["Bastard Characters"]),
            play_within_play: norm(row["Play within a  Play"]),
            storms: norm(row["Storms / Shipwrecks"]),
            suicide: norm(row["Suicide Committed"]),
          };
        }).filter(p => p.title);
        resolve();
      },
      error: reject
    });
  });
}

// ======= Match Label Function =======
// Mirrors the criteria used to generate shakegrid.json — keep these in sync
// if you ever add new label types to the grid generator.
function matchMatchesLabel(p, label) {
  if (!p || !label) return false;
  const l = label.toLowerCase().trim();
  const total = playData.length || 38;

  if (l === "history play") return p.history === "yes";
  if (l === "comedy") return p.comedy === "yes";
  if (l === "tragedy") return p.tragedy === "yes";
  if (l === "late romance") return p.late_romance === "yes";
  if (l === "part of the first henriad") return p.first_henriad === "yes";
  if (l === "part of the second henriad") return p.second_henriad === "yes";
  if (l === "features john falstaff") return p.falstaff === "yes";
  if (l === "no john falstaff") return p.falstaff === "no";
  if (l === "character named antonio") return p.antonio === "yes";
  if (l === "no character named antonio") return p.antonio === "no";
  if (l === "features cross-dressing") return p.cross_dressing === "yes";
  if (l === "no cross-dressing") return p.cross_dressing === "no";
  if (l === "ghosts, spirits, or fairies appear") return p.ghosts === "yes";
  if (l === "no ghosts, spirits, or fairies") return p.ghosts === "no";
  if (l === "sibling rivalry theme") return p.sibling_rivalry === "yes";
  if (l === "set in britain") return p.set_britain === "yes";
  if (l === "set in italy") return p.set_italy === "yes";
  if (l === "set in greece or turkey") return p.set_greece === "yes";
  if (l === "character's name in the title") return p.char_name_in_title === "yes";
  if (l === "no character name in the title") return p.char_name_in_title === "no";
  if (l === "cuckold theme") return p.cuckold === "yes";
  if (l === "female character has the most lines") return p.female_most_lines === "yes";
  if (l === "male character has the most lines") return p.female_most_lines === "no";
  if (l === "titular character dies") return p.titular_dies === "yes";
  if (l === "titular character survives") return p.titular_dies === "no";
  if (l === "features a bastard character") return p.bastard === "yes";
  if (l === "play within a play") return p.play_within_play === "yes";
  if (l === "storm or shipwreck occurs") return p.storms === "yes";
  if (l === "suicide is committed") return p.suicide === "yes";
  if (l === "no suicide committed") return p.suicide === "no";
  if (l === "title starts with a-j") {
    const c = p.title.charAt(0).toUpperCase();
    return c >= "A" && c <= "J";
  }
  if (l === "title starts with k-z") {
    const c = p.title.charAt(0).toUpperCase();
    return c >= "K" && c <= "Z";
  }
  if (l === "title starts with a vowel") {
    const c = p.title.charAt(0).toUpperCase();
    return ["A", "E", "I", "O", "U"].includes(c);
  }
  if (l === "title starts with a consonant") {
    const c = p.title.charAt(0).toUpperCase();
    return /[A-Z]/.test(c) && !["A", "E", "I", "O", "U"].includes(c);
  }

  return false;
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
    if (val.length < 2) {
      box.style.display = "none";
      return;
    }

    const matches = playData
      .filter(p => {
        const searchTerms = val.toLowerCase().split(" ");
        const titleParts = p.title.toLowerCase().split(" ");
        return searchTerms.every(term =>
          titleParts.some(part => part.startsWith(term)) || p.title.toLowerCase().includes(val)
        );
      })
      .filter((p, index, self) =>
        index === self.findIndex(other => other.title === p.title)
      );

    if (!matches.length) {
      box.style.display = "none";
      return;
    }

    matches.forEach(p => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.title;
      const guessBtn = document.createElement("button");
      guessBtn.textContent = "Guess";
      guessBtn.className = "autocomplete-select-btn";
      const alreadyUsed = usedPlays.has(p.title);
      if (guessesLeft === 0) {
        guessBtn.disabled = true;
        guessBtn.classList.add("disabled");
      } else if (alreadyUsed) {
        guessBtn.disabled = true;
        guessBtn.classList.add("disabled");
        guessBtn.textContent = "Used";
      } else {
        guessBtn.textContent = "Guess";
        guessBtn.addEventListener("click", () => handleGuess(p.title));
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
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent || "";
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent || "";
      guessContext.textContent = `${rowLabel} × ${colLabel}`;
    });
  });

  let guessesLeft = 10;
  const usedPlays = new Set();

  function saveGameState() {
    const gridData = [...document.querySelectorAll(".cell")].map(cell => cell.dataset.answer || null);
    const gameState = {
      guessesLeft,
      usedPlays: Array.from(usedPlays),
      gridData,
      gameOver: guessesLeft === 0,
      currentDay
    };
    localStorage.setItem("gridOfMindsShakespeareGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("gridOfMindsShakespeareGame");
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      localStorage.removeItem("gridOfMindsShakespeareGame");
      return;
    }
    guessesLeft = state.guessesLeft ?? 10;
    document.querySelector(".guesses-count").textContent = guessesLeft;
    (state.usedPlays || []).forEach(name => usedPlays.add(name));
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

  function handleGuess(inputName) {
    const guess = inputName.toLowerCase();
    const match = playData.find(p => p.title.toLowerCase() === guess);
    guessesLeft = Math.max(guessesLeft - 1, 0);
    document.querySelector(".guesses-count").textContent = guessesLeft;

    if (guessesLeft === 0) {
      box.innerHTML = "";
      setTimeout(showEndgameSummary, 300);
    }

    guessModal.style.display = "none";
    box.style.display = "none";
    guessError.style.display = "none";
    if (guessesLeft === 0) {
      setTimeout(showEndgameSummary, 300);
    }
    if (!match || usedPlays.has(match.title)) {
      saveGameState();
      return;
    }
    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;
    if (matchMatchesLabel(match, rowLabel) && matchMatchesLabel(match, colLabel)) {
      renderCellAnswer(activeCell, match.title);
      usedPlays.add(match.title);
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
  loadPlays().then(async () => {
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
      localStorage.removeItem("gridOfMindsShakespeareGame");
      const gc = document.querySelector(".guesses-count");
      if (gc) gc.textContent = "10";
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
    let output = `Shakespeare Grid Results\n${finalScoreText.textContent}\n\n`;
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
      navigator.share({ title: "Shakespeare Grid Results", text: output }).catch(err => {
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
      const validAnswers = playData.filter(p =>
        matchMatchesLabel(p, rowLabel) && matchMatchesLabel(p, colLabel)
      );
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      answerList.innerHTML = "";
      const seen = new Set();
      validAnswers.forEach(p => {
        if (!seen.has(p.title)) {
          seen.add(p.title);
          const li = document.createElement("li");
          li.textContent = p.title;
          answerList.appendChild(li);
        }
      });
      document.getElementById("answers-modal-title").textContent = `${rowLabel} × ${colLabel}`;
      modal.style.display = "block";
    });
    resultGrid.appendChild(resultCell);
  });

  document.getElementById("play-again-btn").addEventListener("click", () => {
    localStorage.removeItem("gridOfMindsShakespeareGame");
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

  const GRID_JSON_URL = "shakegrid.json";
  let gridsCache = null;
  let latestGrid = null;

  async function fetchAllGrids() {
    if (gridsCache) return gridsCache;
    const res = await fetch(GRID_JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to fetch shakegrid.json");
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
    window.location.href = "shakegrid.html?grid=" + String(n);
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