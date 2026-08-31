// Renders a correctly-guessed novel as a styled text card in the cell.
// Always sets data-answer so game-state saving/loading and the endgame
// summary have a reliable place to read the answer from.
function renderCellAnswer(cell, title) {
  cell.dataset.answer = title;
  cell.innerHTML = `<div class="cell-full-image cell-answer-text">${title}</div>`;
  cell.classList.add("correct");
}

// ======= Helpers: Path-based routing =======
function getGridNumberFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? parseInt(last, 10) : null;
}

// ======= Label Loader from daily-authors.json =======
async function loadGridByDay(day) {
  try {
    const res = await fetch("daily-authors.json", { cache: "no-cache" });
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
    console.error("Failed to load daily-authors.json", e);
  }
}

// ======= Global State =======
// NOTE: adjust this to whenever Authors Grid actually launches.
const launchDate = new Date("September 1, 2026 00:00:00");
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay;

let bookData = []; // { author, title, year }
const today = currentDay;

// ======= CSV Loader =======
async function loadBooks() {
  return new Promise((resolve, reject) => {
    Papa.parse("classic-authors-novels.csv", {
      header: true,
      download: true,
      complete: (results) => {
        bookData = results.data
          .map(row => ({
            author: (row["Author"] || "").trim(),
            title: (row["Title"] || "").trim(),
            year: parseInt(row["Year"]) || null,
          }))
          .filter(b => b.author && b.title);
        resolve();
      },
      error: reject
    });
  });
}

// ======= Letter-bucket + Match Logic =======
// Finds the first alphabetic character in the title and buckets it A-J or K-Z.
// Leading articles ("The", "A", "An") are stripped first, so "The Shining"
// counts as S and "A Tale of Two Cities" counts as T — this matches the
// exact rule used to generate daily-authors.json.
function stripLeadingArticle(title) {
  return title.replace(/^\s*(the|an|a)\s+/i, "");
}

function titleLetterBucket(title) {
  const stripped = stripLeadingArticle(title);
  const match = stripped.match(/[A-Za-z]/);
  if (!match) return null;
  const c = match[0].toUpperCase();
  return (c >= "A" && c <= "J") ? "AJ" : "KZ";
}

function matchesRowLabel(book, rowLabel) {
  if (!book || !rowLabel) return false;
  return book.author.trim().toLowerCase() === rowLabel.trim().toLowerCase();
}

function matchesColumnLabel(book, colLabel) {
  if (!book || !colLabel) return false;
  const l = colLabel.toLowerCase();
  const bucket = titleLetterBucket(book.title);
  if (!bucket) return false;
  if (l.includes("a-j")) return bucket === "AJ";
  if (l.includes("k-z")) return bucket === "KZ";
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
  const TOTAL_CELLS = 6; // 3 rows x 2 columns

  rulesLink.onclick = () => (rulesModal.style.display = "block");
  closeRules.onclick = () => (rulesModal.style.display = "none");

  const box = document.createElement("div");
  box.id = "autocomplete-box";
  guessInput.insertAdjacentElement("afterend", box);

  // Books are keyed by "title|||author" since two different authors could
  // (in principle) share a title, and it disambiguates which exact book
  // was guessed.
  const bookKey = (b) => `${b.title}|||${b.author}`;

  guessInput.addEventListener("input", () => {
    const val = guessInput.value.trim().toLowerCase();
    box.innerHTML = "";
    if (val.length < 2) {
      box.style.display = "none";
      return;
    }

    const matches = bookData
      .filter(b => {
        const searchTerms = val.split(" ");
        const titleParts = b.title.toLowerCase().split(" ");
        return searchTerms.every(term =>
          titleParts.some(part => part.startsWith(term))
        ) || b.title.toLowerCase().includes(val);
      })
      .filter((b, index, self) => index === self.findIndex(other => bookKey(other) === bookKey(b)))
      .slice(0, 25);

    if (!matches.length) {
      box.style.display = "none";
      return;
    }

    matches.forEach(b => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";

      const textWrap = document.createElement("div");
      textWrap.className = "autocomplete-text";
      const strong = document.createElement("strong");
      strong.textContent = b.title;
      const span = document.createElement("span");
      span.textContent = b.author;
      textWrap.appendChild(strong);
      textWrap.appendChild(span);

      const guessBtn = document.createElement("button");
      guessBtn.className = "autocomplete-select-btn";
      const alreadyUsed = usedBooks.has(bookKey(b));
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
        guessBtn.addEventListener("click", () => handleGuess(b));
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
      const numCols = 2;
      const row = Math.floor(idx / numCols);
      const col = idx % numCols;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent || "";
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent || "";
      guessContext.textContent = `${rowLabel} × ${colLabel}`;
    });
  });

  let guessesLeft = TOTAL_CELLS;
  const usedBooks = new Set(); // keys of "title|||author"

  function saveGameState() {
    const gridData = [...document.querySelectorAll(".cell")].map(cell => cell.dataset.answer || null);
    const gameState = {
      guessesLeft,
      usedBooks: Array.from(usedBooks),
      gridData,
      gameOver: guessesLeft === 0,
      currentDay
    };
    localStorage.setItem("gridOfMindsAuthorsGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("gridOfMindsAuthorsGame");
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      localStorage.removeItem("gridOfMindsAuthorsGame");
      return;
    }
    guessesLeft = state.guessesLeft ?? TOTAL_CELLS;
    document.querySelector(".guesses-count").textContent = guessesLeft;
    (state.usedBooks || []).forEach(key => usedBooks.add(key));
    const cells = document.querySelectorAll(".cell");
    state.gridData.forEach((title, i) => {
      if (title && cells[i]) {
        renderCellAnswer(cells[i], title);
      }
    });
    if (state.gameOver) {
      setTimeout(showEndgameSummary, 300);
    }
  }

  function handleGuess(book) {
    guessesLeft = Math.max(guessesLeft - 1, 0);
    document.querySelector(".guesses-count").textContent = guessesLeft;

    if (guessesLeft === 0) {
      box.innerHTML = "";
      setTimeout(showEndgameSummary, 300);
    }

    guessModal.style.display = "none";
    box.style.display = "none";
    guessError.style.display = "none";

    if (!book || usedBooks.has(bookKey(book))) {
      saveGameState();
      return;
    }

    const numCols = 2;
    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / numCols);
    const col = idx % numCols;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;

    if (matchesRowLabel(book, rowLabel) && matchesColumnLabel(book, colLabel)) {
      renderCellAnswer(activeCell, book.title);
      usedBooks.add(bookKey(book));
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
  loadBooks().then(async () => {
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
      localStorage.removeItem("gridOfMindsAuthorsGame");
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
  const numCols = 2;

  shareBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `Classic Authors Grid Results\n${finalScoreText.textContent}\n\n`;
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / numCols);
      const col = i % numCols;
      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent.trim() || `Row ${row + 1}`;
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent.trim() || `Col ${col + 1}`;
      const guess = cells[i].textContent || "—";
      const isCorrect = cells[i].classList.contains("correct");
      const mark = isCorrect ? "✅" : "❌";
      output += `${rowLabel} × ${colLabel}: ${guess} ${mark}\n`;
    }
    if (navigator.share) {
      navigator.share({ title: "Classic Authors Grid Results", text: output }).catch(err => {
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
      const rowIndex = Math.floor(resultIndex / numCols);
      const colIndex = resultIndex % numCols;
      const rowLabel = document.querySelectorAll(".row-label")[rowIndex]?.textContent;
      const colLabel = document.querySelectorAll(".col-label")[colIndex]?.textContent;
      const validAnswers = bookData.filter(b =>
        matchesRowLabel(b, rowLabel) && matchesColumnLabel(b, colLabel)
      );
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      answerList.innerHTML = "";
      const seen = new Set();
      validAnswers.forEach(b => {
        if (!seen.has(b.title)) {
          seen.add(b.title);
          const li = document.createElement("li");
          li.textContent = b.title;
          answerList.appendChild(li);
        }
      });
      document.getElementById("answers-modal-title").textContent = `${rowLabel} × ${colLabel}`;
      modal.style.display = "block";
    });
    resultGrid.appendChild(resultCell);
  });

  document.getElementById("play-again-btn").addEventListener("click", () => {
    localStorage.removeItem("gridOfMindsAuthorsGame");
    location.reload();
  });

  finalScoreText.textContent = `You got ${correctCount} out of 6 correct!`;
  endgameModal.style.display = "block";

  copyBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `${finalScoreText.textContent}\n\nYour Answers:\n`;
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / numCols);
      const col = i % numCols;
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

  const GRID_JSON_URL = "daily-authors.json";
  let gridsCache = null;
  let latestGrid = null;

  async function fetchAllGrids() {
    if (gridsCache) return gridsCache;
    const res = await fetch(GRID_JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to fetch daily-authors.json");
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
    window.location.href = "authors.html?grid=" + String(n);
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