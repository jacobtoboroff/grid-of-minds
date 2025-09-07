/******************************
 * GEO GRID — v1 (Data + Guess)
 * Step 1: CSV loader, state, autocomplete, basic guess placement
 ******************************/

// ======= Helpers: Path-based routing (same pattern as presidents) =======
function getGridNumberFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? parseInt(last, 10) : null;
}
// If your site is served from a subfolder, set base to that (e.g. '/gom')
const BASE_PATH = "/"; 
function buildGridPath(n) {
  return BASE_PATH.replace(/\/$/, "") + "/" + String(n);
}
window.buildGridPath = buildGridPath;


async function loadGeoGridByDay(day) {
  try {
    const res = await fetch("daily-geogrids.json", { cache: "no-cache" });
    const data = await res.json();
    const grid = data[day];
    if (!grid) return;

    // Header
    const header = document.getElementById("grid-number");
    if (header) header.textContent = `GRID #${String(day).padStart(3, "0")}`;

    // Labels
    document.querySelectorAll(".row-label").forEach((el, i) => {
      el.textContent = grid.rows[i] || "";
    });
    document.querySelectorAll(".col-label").forEach((el, i) => {
      el.textContent = grid.columns[i] || "";
    });

    window.__CURRENT_GRID__ = day;
    window.viewingPastGrid = (typeof currentDay === "number") ? (day !== currentDay) : false;
  } catch (e) {
    console.error("Failed to load daily-geogrids.json", e);
  }
}

// ======= Global Day State (same approach) =======
const launchDate = new Date("August 20, 2025 00:00:00");
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay;

// ======= Dataset =======
let countryData = [];
const today = currentDay;

// ======= CSV Loader (Papa.parse) =======
async function loadCountries() {
  return new Promise((resolve, reject) => {
    Papa.parse("geo-data/countries.csv", {
      header: true,
      download: true,
      complete: (results) => {
        const yes = (v) => String(v || "").trim().toLowerCase() === "yes";
        const num = (v) => {
          const n = parseInt(String(v || "").replace(/[^0-9-]/g, ""), 10);
          return Number.isFinite(n) ? n : null;
        };

        countryData = results.data
          .map(r => {
            const name = (r["Country Name"] || r["Country"] || "").trim();
            if (!name) return null;

            const capital = (r["Capital"] || "").trim();
            const nameInCapital = yes(r["Country Name in Capital"]); // C
            const continent = (r["Continent"] || r["continent"] || "").trim();
            const region = (r["Region"] || "").trim();

            // Ranks
            const populationRank = num(r["Population #"]);   // F (India 1)
            const areaRank       = num(r["Largest Country"]); // G (Russia 1)

            // Binaries (robust to minor header typos you mentioned)
            const landlocked     = yes(r["Landlocked"] || r["Landloicked"]);
            const primaryReligion= (r["Primary Religion"] || "").trim();
            const onEquator      = yes(r["Countries on the equator"]);
            const islandNation   = yes(r["Island nation"] || r["Island Nation"]);
            const bordersChina   = yes(r["Borders China"]);
            const bordersRussia  = yes(r["Border Russia"] || r["Borders Russia"]);
            const borderCount    = num(r["Number of bordering countries"]);
            const hostsOlympics  = yes(r["To his olympics"] || r["Hosts Olympics"]);
            const worldCupWinner = yes(r["World Culp Winner"] || r["World Cup Winner"]);
            const natoMember     = yes(r["Nato Membership"] || r["NATO Membership"]);

            // Flag / image
            const imageUrl = (r["image url"] || r["Image URL"] || r["Flag URL"] || "").trim();

            return {
              // basics
              name,
              name_lc: name.toLowerCase(),
              capital,
              capital_lc: capital.toLowerCase(),

              // geo tags
              continent,
              continent_lc: continent.toLowerCase(),
              region,
              region_lc: region.toLowerCase(),

              // ranks / counts
              population_rank: populationRank,   // integer or null
              area_rank: areaRank,               // integer or null
              border_count: borderCount,         // integer or null

              // booleans
              name_in_capital: nameInCapital,
              landlocked,
              on_equator: onEquator,
              island_nation: islandNation,
              borders_china: bordersChina,
              borders_russia: bordersRussia,
              hosts_olympics: hostsOlympics,
              world_cup_winner: worldCupWinner,
              nato: natoMember,

              primary_religion: primaryReligion,

              // media
              image_url: imageUrl,

              // keep full original if needed later
              _row: r
            };
          })
          .filter(Boolean);

        resolve();
      },
      error: reject
    });
  });
}

// ======= Label Matching (stub for Step 1) =======
// For now we only support exact-name cells (will expand next step to continents, population, etc.)
function matchGeoLabel(entity, label) {
  if (!entity || !label) return false;

  const l = label
    .toLowerCase()
    .replace(/–/g, "-")
    .replace(/“|”/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  // ---- Name contains
  const nameMatch = l.match(/name\s+([a-z\s]+)/i);
  if (nameMatch) {
    const target = nameMatch[1].trim().toLowerCase();
    return entity.name_lc.includes(target);
  }

  // ---- Continent (e.g., "in africa", "continent: europe")
  const contMatch = l.match(/(?:in|continent[: ]+)\s*(africa|asia|europe|oceania|north america|south america|antarctica)/i);
  if (contMatch) {
    const target = contMatch[1].toLowerCase();
    return entity.continent_lc === target;
  }

  // ---- Region contains (e.g., "region: southern europe")
  const regMatch = l.match(/region[: ]+\s*([a-z\s-]+)/i);
  if (regMatch) {
    const target = regMatch[1].trim().toLowerCase();
    return entity.region_lc.includes(target);
  }

  // ---- Simple binaries
  if (l.includes("landlocked"))           return !!entity.landlocked;
  if (l.includes("island nation"))        return !!entity.island_nation;
  if (l.includes("on the equator") || l.includes("equator")) return !!entity.on_equator;
  if (l.includes("borders china"))        return !!entity.borders_china;
  if (l.includes("borders russia"))       return !!entity.borders_russia;
  if (l.includes("hosts olympics") || l.includes("olympics host")) return !!entity.hosts_olympics;
  if (l.includes("world cup winner"))     return !!entity.world_cup_winner;
  if (l.includes("nato member") || l.includes("nato membership")) return !!entity.nato;

  // ---- Capital / Name relations
  if (l.includes("country name in capital")) return !!entity.name_in_capital;
  const capContainsMatch = l.match(/capital contains\s+([a-z\s'-]+)/i);
  if (capContainsMatch) {
    const target = capContainsMatch[1].trim().toLowerCase();
    return entity.capital_lc.includes(target);
  }

  // ---- Border count (e.g., "borders = 2", "borders > 5", "borders between 3-6")
  const eqBorders = l.match(/borders\s*=\s*(\d+)/i);
  if (eqBorders && entity.border_count != null) {
    return entity.border_count === parseInt(eqBorders[1], 10);
  }
  const gtBorders = l.match(/borders\s*>\s*(\d+)/i);
  if (gtBorders && entity.border_count != null) {
    return entity.border_count > parseInt(gtBorders[1], 10);
  }
  const ltBorders = l.match(/borders\s*<\s*(\d+)/i);
  if (ltBorders && entity.border_count != null) {
    return entity.border_count < parseInt(ltBorders[1], 10);
  }
  const betweenBorders = l.match(/borders\s*(?:between|from)\s*(\d+)\s*(?:and|to|-|–)\s*(\d+)/i);
  if (betweenBorders && entity.border_count != null) {
    const a = parseInt(betweenBorders[1], 10);
    const b = parseInt(betweenBorders[2], 10);
    return entity.border_count >= Math.min(a,b) && entity.border_count <= Math.max(a,b);
    }

  // ---- Rank filters (Population # or Largest Country rank)
  // Examples:
  //  "population rank = 1"  | "population rank <= 10" | "population rank between 1-20"
  //  "area rank = 1"        | "largest country rank 1-5"
  function rankMatch(prefix, value) {
    // value is entity.population_rank or entity.area_rank
    if (value == null) return false;
    const eq = l.match(new RegExp(prefix + "\\s*=\\s*(\\d+)", "i"));
    if (eq) return value === parseInt(eq[1], 10);
    const le = l.match(new RegExp(prefix + "\\s*<=\\s*(\\d+)", "i"));
    if (le) return value <= parseInt(le[1], 10);
    const ge = l.match(new RegExp(prefix + "\\s*>=\\s*(\\d+)", "i"));
    if (ge) return value >= parseInt(ge[1], 10);
    const lt = l.match(new RegExp(prefix + "\\s*<\\s*(\\d+)", "i"));
    if (lt) return value < parseInt(lt[1], 10);
    const gt = l.match(new RegExp(prefix + "\\s*>\\s*(\\d+)", "i"));
    if (gt) return value > parseInt(gt[1], 10);
    const between = l.match(new RegExp(prefix + "\\s*(?:between|from)\\s*(\\d+)\\s*(?:and|to|-|–)\\s*(\\d+)", "i"));
    if (between) {
      const a = parseInt(between[1], 10);
      const b = parseInt(between[2], 10);
      return value >= Math.min(a,b) && value <= Math.max(a,b);
    }
    return false;
  }

  if (l.includes("population rank")) {
    return rankMatch("population\\s*rank", entity.population_rank);
  }
  if (l.includes("area rank") || l.includes("largest country rank") || l.includes("largest country")) {
    return rankMatch("(?:area\\s*rank|largest\\s*country(?:\\s*rank)?)", entity.area_rank);
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
  const endgameModal = document.getElementById("endgame-modal");
  const closeEndgame = document.getElementById("close-endgame");
  const gridLabel = document.getElementById("grid-number");

  if (closeAnswers) closeAnswers.onclick = () => (answersModal.style.display = "none");
  if (closeEndgame) closeEndgame.onclick = () => (endgameModal.style.display = "none");

  rulesLink && (rulesLink.onclick = () => (rulesModal.style.display = "block"));
  closeRules && (closeRules.onclick = () => (rulesModal.style.display = "none"));

  // Autocomplete container (same UX pattern)
  const box = document.createElement("div");
  box.id = "autocomplete-box";
  guessInput && guessInput.insertAdjacentElement("afterend", box);

  // Autocomplete (prefix match on any word; includes aliases)
  function setupAutocomplete() {
    if (!guessInput) return;
    guessInput.addEventListener("input", () => {
      const val = guessInput.value.trim().toLowerCase();
      box.innerHTML = "";
      if (val.length < 2) {
        box.style.display = "none";
        return;
      }

      const matches = countryData
        .filter(c => {
          const terms = val.split(" ");
          const nameParts = c.name_lc.split(/\s+/);
          const aliasParts = c.aliases_lc.flatMap(a => a.split(/\s+/));
          const haystack = [...nameParts, ...aliasParts];
          return terms.every(term => haystack.some(part => part.startsWith(term)));
        })
        .filter((c, idx, self) => idx === self.findIndex(o => o.name === c.name));

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
        if (guessesLeft === 0 || usedEntities.has(c.name)) {
          guessBtn.disabled = true;
          guessBtn.classList.add("disabled");
          guessBtn.textContent = usedEntities.has(c.name) ? "Used" : "Guess";
        } else {
          guessBtn.addEventListener("click", () => handleGuess(c.name));
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
  }

  // Click-to-open cells
  let activeCell = null;
  document.querySelectorAll(".cell").forEach((cell, idx) => {
    cell.addEventListener("click", () => {
      if (cell.classList.contains("correct")) return;
      activeCell = cell;
      if (guessInput) guessInput.value = "";
      if (guessError) guessError.style.display = "none";
      if (guessModal) {
        guessModal.style.display = "block";
        guessInput && guessInput.focus();
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent || "";
        const colLabel = document.querySelectorAll(".col-label")[col]?.textContent || "";
        guessContext && (guessContext.textContent = `${rowLabel} × ${colLabel}`);
      }
    });
  });

  // Game state
  let guessesLeft = 9;
  const usedEntities = new Set();

  function saveGameState() {
    const gridData = [...document.querySelectorAll(".cell")].map(cell => {
      const filled = cell.getAttribute("data-entity-name");
      return filled || null;
    });
    const gameState = {
      guessesLeft,
      usedEntities: Array.from(usedEntities),
      gridData,
      gameOver: guessesLeft === 0,
      currentDay
    };
    localStorage.setItem("geoGridGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("geoGridGame");
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      localStorage.removeItem("geoGridGame");
      return;
    }
    guessesLeft = state.guessesLeft ?? 9;
    const gc = document.querySelector(".guesses-count");
    if (gc) gc.textContent = guessesLeft;
    state.usedEntities.forEach(n => usedEntities.add(n));
    const cells = document.querySelectorAll(".cell");
    state.gridData.forEach((name, i) => {
      if (name && cells[i]) {
        cells[i].textContent = name; // Step 1: text only; we’ll add flags/images later
        cells[i].setAttribute("data-entity-name", name);
        cells[i].classList.add("correct");
      }
    });
    if (state.gameOver) {
      setTimeout(showEndgameSummary, 300);
    }
  }

  async function handleGuess(inputName) {
    const guess = inputName.toLowerCase();
    const match = countryData.find(c => {
      if (c.name_lc === guess) return true;
      if (c.aliases_lc.includes(guess)) return true;
      return false;
    });

    guessesLeft = Math.max(guessesLeft - 1, 0);
    const gc = document.querySelector(".guesses-count");
    if (gc) gc.textContent = guessesLeft;

    if (guessesLeft === 0) {
      box.innerHTML = "";
      setTimeout(showEndgameSummary, 300);
    }

    if (guessModal) guessModal.style.display = "none";
    box.style.display = "none";
    guessError && (guessError.style.display = "none");

    if (!match || usedEntities.has(match.name)) {
      saveGameState();
      return;
    }

    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;

    // Step 1: require BOTH labels, but we only support name/contains right now.
    const okRow = matchGeoLabel(match, rowLabel) || /name/.test((rowLabel || "").toLowerCase()) ? true : matchGeoLabel(match, rowLabel);
    const okCol = matchGeoLabel(match, colLabel) || /name/.test((colLabel || "").toLowerCase()) ? true : matchGeoLabel(match, colLabel);

    if (okRow && okCol) {
      activeCell.textContent = match.name; // Step 1: text fill
      activeCell.setAttribute("data-entity-name", match.name);
      activeCell.classList.add("correct");
      usedEntities.add(match.name);
      saveGameState();
    } else {
      saveGameState();
    }
  }

  if (closeGuess) closeGuess.onclick = () => (guessModal.style.display = "none");
  window.onclick = e => {
    if (e.target === guessModal) guessModal.style.display = "none";
    if (e.target === rulesModal) rulesModal.style.display = "none";
    if (e.target === answersModal) answersModal.style.display = "none";
    if (e.target === endgameModal) endgameModal.style.display = "none";
  };

  // Load data first, then decide which grid to show based on PATH
  loadCountries().then(async () => {
    let num = getGridNumberFromPath();
    if (!num) num = today;

    if (gridLabel) gridLabel.textContent = `GRID #${String(num).padStart(3, "0")}`;
    window.__CURRENT_GRID__ = num;

    // Only load saved game state on today's grid
    if (num === today) {
      loadGameState();
    } else {
      localStorage.removeItem("geoGridGame");
      const gc = document.querySelector(".guesses-count");
      if (gc) gc.textContent = "9";
      document.querySelectorAll(".main-grid .cell").forEach(c => {
        c.textContent = "";
        c.removeAttribute("data-entity-name");
        c.className = "cell";
      });
    }

    await loadGeoGridByDay(num);
    setupAutocomplete();
  });
});

// ======= Endgame (reuse your existing modal & IDs) =======
function showEndgameSummary() {
  const playerGrid = document.getElementById("player-summary-grid");
  const resultGrid = document.getElementById("result-summary-grid");
  const finalScoreText = document.getElementById("final-score-text");
  const copyBtn = document.getElementById("copy-results-btn");
  const copyConfirm = document.getElementById("copy-confirmation");
  const endgameModal = document.getElementById("endgame-modal");
  const shareBtn = document.getElementById("share-results-btn");

  if (!playerGrid || !resultGrid || !finalScoreText || !endgameModal) return;

  shareBtn && (shareBtn.onclick = () => {
    const cells = [...playerGrid.children];
    let output = `Geography Grid Results\n${finalScoreText.textContent}\n\n`;
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
      navigator.share({ title: "Geography Grid Results", text: output }).catch(err => {
        alert("Sharing failed: " + err.message);
      });
    } else {
      alert("Sharing not supported on this device.");
    }
  });

  const cells = document.querySelectorAll(".main-grid .cell");
  playerGrid.innerHTML = "";
  resultGrid.innerHTML = "";
  let correctCount = 0;

  cells.forEach(cell => {
    const playerCell = document.createElement("div");
    playerCell.className = "cell";
    const name = cell.getAttribute("data-entity-name");
    if (name) {
      playerCell.textContent = name;
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

      // For Step 1 we don’t have full category logic yet; show *all* countries (or we can filter by "name contains")
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      if (!answerList || !modal) return;

      answerList.innerHTML = "";
      const seen = new Set();
      countryData.forEach(c => {
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

  const playAgain = document.getElementById("play-again-btn");
  playAgain && playAgain.addEventListener("click", () => {
    localStorage.removeItem("geoGridGame");
    location.reload();
  });

  finalScoreText.textContent = `You got ${correctCount} out of 9 correct!`;
  endgameModal.style.display = "block";

  copyBtn && (copyBtn.onclick = () => {
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
      const cc = document.getElementById("copy-confirmation");
      if (cc) {
        cc.style.display = "block";
        setTimeout(() => (cc.style.display = "none"), 2000);
      }
    });
  });
}
