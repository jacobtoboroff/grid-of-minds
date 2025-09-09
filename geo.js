/******************************
 * GEO GRID — v2 (flags in cells, give-up, flexible labels)
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

// ======= Label Loader from daily-geogrids.json =======
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

// ======= Global Day State =======
const launchDate = new Date("September 6, 2025 00:00:00");
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay;

let countryData = [];
const today = currentDay;

// ======= CSV Loader (Papa.parse) =======
async function loadCountries() {
  return new Promise((resolve, reject) => {
    Papa.parse("geo-data/countries.csv", {
      header: true,
      download: true,
      complete: (results) => {
        const yes = (v) => /^(yes|y|true|1)$/i.test(String(v || "").trim());
        const num = (v) => {
          const n = parseInt(String(v || "").replace(/[^0-9-]/g, ""), 10);
          return Number.isFinite(n) ? n : null;
        };
        const fixReligion = (v) => String(v || "").replace(/chirstianity/gi, "Christianity").trim();

        countryData = results.data
          .map(r => {
            const name = (r["Country Name"] || r["Country"] || "").trim();
            if (!name) return null;

            const capital = (r["Capital"] || "").trim();
            const nameInCapital = yes(r["Country Name in Capital"]); // binary
            const continent = (r["Continent"] || r["continent"] || "").trim();
            const region = (r["Region"] || "").trim();

            // Ranks
            const populationRank = num(r["Population #"]);   // India = 1
            const areaRank       = num(r["Largest Country"]); // Russia = 1

            // Binaries (robust to the typos mentioned)
            const landlocked      = yes(r["Landlocked"] || r["Landloicked"]);
            const primaryReligion = fixReligion(r["Primary Religion"]);
            const onEquator       = yes(r["Countries on the equator"]);
            const islandNation    = yes(r["Island nation"] || r["Island Nation"]);
            const bordersChina    = yes(r["Borders China"]);
            const bordersRussia   = yes(r["Border Russia"] || r["Borders Russia"]);
            const borderCount     = num(r["Number of Bordering Countries"] || r["Number of bordering countries"]);
            const hostsOlympics   = yes(r["To Host Olympics"] || r["Hosts Olympics"] || r["To his olympics"]);
            const worldCupWinner  = yes(r["World Cup Winner"] || r["World Culp Winner"]);
            const natoMember      = yes(r["NATO Member"] || r["Nato Membership"] || r["NATO Membership"]);

            // Flag / image
            const imageUrl = (r["Image Url"] || r["image url"] || r["Image URL"] || r["Flag URL"] || "").trim();

            return {
              // basics
              name,
              name_lc: name.toLowerCase(),
              capital,
              capital_lc: capital.toLowerCase(),

              // precomputed first letters + vowel flags (for fast matching)
              name_first: name.charAt(0).toUpperCase() || "",
              capital_first: capital.charAt(0).toUpperCase() || "",
              name_starts_vowel: /^[AEIOU]/i.test(name),
              capital_starts_vowel: /^[AEIOU]/i.test(capital),

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
              primary_religion_lc: primaryReligion.toLowerCase(),

              // autocomplete (endonyms/exonyms can be added later)
              aliases_lc: [],

              // media
              image_url: imageUrl,

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

// ======= Label Matching Utilities =======

// Parse letter ranges like "Country Name starts with A–J", "Country A-J", "Capital L–Z"
function parseLetterRange(l, keyword) {
  const rx = new RegExp(
    `(?:^|\\b)(?:${keyword}|${keyword.replace(" name","")})\\s*(?:name\\s*)?(?:starts(?:\\s*with)?\\s*)?([a-z])\\s*(?:–|-|to)\\s*([a-z])`,
    "i"
  );
  const m = l.match(rx);
  if (!m) return null;
  return [m[1].toUpperCase(), m[2].toUpperCase()];
}

// Rank matcher utility (population / area rank)
function rankMatch(l, prefixRegex, value) {
  if (value == null) return false;

  // Group the alternation so the suffix applies to all options
  const pr = `(?:${prefixRegex})`;

  // exact: "= N"
  let m = l.match(new RegExp(`${pr}\\s*=\\s*(\\d+)`, "i"));
  if (m) return value === parseInt(m[1], 10);

  // <=, >=, <, >
  m = l.match(new RegExp(`${pr}\\s*<=\\s*(\\d+)`, "i"));
  if (m) return value <= parseInt(m[1], 10);

  m = l.match(new RegExp(`${pr}\\s*>=\\s*(\\d+)`, "i"));
  if (m) return value >= parseInt(m[1], 10);

  m = l.match(new RegExp(`${pr}\\s*<\\s*(\\d+)`, "i"));
  if (m) return value < parseInt(m[1], 10);

  m = l.match(new RegExp(`${pr}\\s*>\\s*(\\d+)`, "i"));
  if (m) return value > parseInt(m[1], 10);

  // ranges "1–50", "from 1 to 50", "between 1-50"
  m = l.match(new RegExp(`${pr}\\s*(?:between|from)?\\s*(\\d+)\\s*(?:and|to|–|-)\\s*(\\d+)`, "i"));
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    return value >= Math.min(a, b) && value <= Math.max(a, b);
  }

  // aliases "Top 50 Population", "Top 50 Area / Largest Country"
  m = l.match(new RegExp(`top\\s*(\\d+)\\s*${pr}`, "i"));
  if (m) return value <= parseInt(m[1], 10);

  return false;
}

function matchGeoLabel(entity, label) {
  if (!entity || !label) return false;

  const l = label
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/“|”/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  // ---------- Country letter ranges & vowels ----------
  const countryRange = parseLetterRange(l, "country name");
  if (countryRange) {
    const ch = entity.name_first;
    return ch >= countryRange[0] && ch <= countryRange[1];
  }
  if (/(^|\b)(country|country name)\s*(starts\s*with\s*)?vowel\b/i.test(l)) {
    return !!entity.name_starts_vowel;
  }

  // ---------- Capital letter ranges & vowels ----------
  const capitalRange = parseLetterRange(l, "capital name");
  if (capitalRange) {
    const ch = entity.capital_first;
    return ch >= capitalRange[0] && ch <= capitalRange[1];
  }
  if (/(^|\b)(capital|capital name)\s*(starts\s*with\s*)?vowel\b/i.test(l)) {
    return !!entity.capital_starts_vowel;
  }

  // ---------- Continents ----------
  const bareCont = l.match(/^(africa|asia|europe|oceania|north america|south america|antarctica)$/i);
  if (bareCont) return entity.continent_lc === bareCont[1].toLowerCase();

  const contMatch = l.match(/(?:^| )(?:in|located in|continent[: ]+)\s*(africa|asia|europe|oceania|north america|south america|antarctica)/i);
  if (contMatch) {
    const target = contMatch[1].toLowerCase();
    return entity.continent_lc === target;
  }

  // ---------- Regions ----------
  const regMatch = l.match(/(?:^| )(?:region[: ]+|located in )\s*([a-z\s-]+)/i);
  if (regMatch) {
    const target = regMatch[1].trim().toLowerCase();
    return entity.region_lc.includes(target);
  }

  // ---------- Primary Religion ----------
  const relEq = l.match(/primary\s*religion[: ]+\s*([a-z\s-]+)/i);
  if (relEq) {
    const target = relEq[1].trim().toLowerCase();
    return entity.primary_religion_lc === target || entity.primary_religion_lc.includes(target);
  }
  const relContains = l.match(/religion\s*contains\s*([a-z\s-]+)/i);
  if (relContains) {
    const target = relContains[1].trim().toLowerCase();
    return entity.primary_religion_lc.includes(target);
  }
  if (/^islam primary religion$/i.test(label))         return /islam/.test(entity.primary_religion_lc);
  if (/^christianity primary religion$/i.test(label))  return /christian/.test(entity.primary_religion_lc);

  // ---------- Border count ----------
  let m = l.match(/borders\s*=\s*(\d+)/i);
  if (m && entity.border_count != null) return entity.border_count === parseInt(m[1], 10);
  m = l.match(/borders\s*>\s*(\d+)/i);
  if (m && entity.border_count != null) return entity.border_count > parseInt(m[1], 10);
  m = l.match(/borders\s*<\s*(\d+)/i);
  if (m && entity.border_count != null) return entity.border_count < parseInt(m[1], 10);
  m = l.match(/(?:borders|bordering countries)\s*(?:between|from)\s*(\d+)\s*(?:and|to|-)\s*(\d+)/i);
  if (m && entity.border_count != null) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    return entity.border_count >= Math.min(a, b) && entity.border_count <= Math.max(a, b);
  }
  m = l.match(/(\d+)\s*\+\s*bordering countries/i);
  if (m && entity.border_count != null) return entity.border_count >= parseInt(m[1], 10);
  m = l.match(/borders\s*more than\s*(\d+)\s*countries/i);
  if (m && entity.border_count != null) return entity.border_count > parseInt(m[1], 10);

  // ---------- Ranks ----------
  // Population: supports "Population Rank 1-50", "Most Populated 1-50", etc.
  if (/(?:population\s*rank|most\s*populated|population)\b/i.test(l)) {
    if (rankMatch(l, "population\\s*rank|most\\s*populated|population", entity.population_rank)) {
      return true;
    }
  }

// Area (Largest Country): accepts "Largest Country Rank 1-50" and "Largest Country 1-50"
if (/(?:area\s*rank|largest\s*country(?:\s*rank)?)\b/i.test(l)) {
  if (rankMatch(l, "area\\s*rank|largest\\s*country(?:\\s*rank)?", entity.area_rank)) {
    return true;
  }
}

  // ---------- Simple binaries & their negatives ----------
  if (/(^| )landlocked( |$)/.test(l))                                        return !!entity.landlocked;
  if (/^not landlocked$|does not have coastline/.test(l))                    return !entity.landlocked;

  if (/(^| )island nation( |$)/.test(l))                                     return !!entity.island_nation;
  if (/^not island nation$|land-connected/.test(l))                          return !entity.island_nation;

  if (/(^| )on the equator( |$)|(^| )equator( |$)/.test(l))                  return !!entity.on_equator;
  if (/^not on the equator$/.test(l))                                        return !entity.on_equator;

  if (/borders china/.test(l))                                               return !!entity.borders_china;
  if (/does not border china|no border with china/.test(l))                  return !entity.borders_china;

  if (/borders russia/.test(l))                                              return !!entity.borders_russia;
  if (/does not border russia|no border with russia/.test(l))                return !entity.borders_russia;

  // Hosted Olympics (your requested title)
  if (/hosted olympics|hosts olympics|olympics host/.test(l))                return !!entity.hosts_olympics;
  if (/did not host olympics|never hosted olympics/.test(l))                 return !entity.hosts_olympics;

  if (/world cup winner/.test(l))                                            return !!entity.world_cup_winner;
  if (/not world cup winner|never won world cup/.test(l))                    return !entity.world_cup_winner;

  if (/nato member|nato membership/.test(l))                                 return !!entity.nato;
  if (/not nato member|non-nato/.test(l))                                    return !entity.nato;

  if (/country name in capital/.test(l))                                     return !!entity.name_in_capital;
  if (/no country name in capital/.test(l))                                  return !entity.name_in_capital;

  // Capital contains phrase
  const capContainsMatch = l.match(/capital\s*contains\s*([a-z\s'-]+)/i);
  if (capContainsMatch) {
    const target = capContainsMatch[1].trim().toLowerCase();
    return entity.capital_lc.includes(target);
  }

  // ---------- Name CONTAINS ----------
  const nameContains = l.match(/(?:country\s*name|name)\s*(?:contains|includes)\s*([a-z\s-]+)/i);
  if (nameContains) {
    const target = nameContains[1].trim().toLowerCase();
    return entity.name_lc.includes(target);
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
  if (guessInput) guessInput.insertAdjacentElement("afterend", box);

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
          const aliasParts = (c.aliases_lc || []).flatMap(a => a.split(/\s+/));
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
      const name = cell.getAttribute("data-entity-name");
      return name || null;
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
    (state.usedEntities || []).forEach(n => usedEntities.add(n));
    const cells = document.querySelectorAll(".cell");
    (state.gridData || []).forEach((name, i) => {
      if (name && cells[i]) {
        const ent = countryData.find(c => c.name === name);
        const imgSrc = ent?.image_url || "https://via.placeholder.com/400x260?text=No+Image";
        cells[i].innerHTML = `<img src="${imgSrc}" alt="${name}" class="cell-full-image">`;
        cells[i].setAttribute("data-entity-name", name);
        cells[i].classList.add("correct");
      }
    });
    if (state.gameOver) {
      setTimeout(showEndgameSummary, 300);
    }
  }

  async function handleGuess(inputName) {
    const guess = String(inputName || "").toLowerCase().trim();
    const match = countryData.find(c => {
      if (c.name_lc === guess) return true;
      if ((c.aliases_lc || []).includes(guess)) return true;
      return false;
    });

    // Count every guess
    guessesLeft = Math.max(guessesLeft - 1, 0);
    const gc = document.querySelector(".guesses-count");
    if (gc) gc.textContent = guessesLeft;

    if (guessesLeft === 0) {
      const abox = document.getElementById("autocomplete-box");
      if (abox) abox.innerHTML = "";
    }

    if (guessModal) guessModal.style.display = "none";
    const ab = document.getElementById("autocomplete-box");
    if (ab) ab.style.display = "none";
    if (guessError) guessError.style.display = "none";

    if (!match || usedEntities.has(match.name)) {
      saveGameState();
      if (guessesLeft === 0) setTimeout(showEndgameSummary, 300);
      return;
    }

    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent || "";
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent || "";

    const okRow = matchGeoLabel(match, rowLabel);
    const okCol = matchGeoLabel(match, colLabel);

    if (okRow && okCol) {
      const imgSrc = match.image_url || "https://via.placeholder.com/400x260?text=No+Image";
      activeCell.innerHTML = `<img src="${imgSrc}" alt="${match.name}" class="cell-full-image">`;
      activeCell.setAttribute("data-entity-name", match.name);
      activeCell.classList.add("correct");
      usedEntities.add(match.name);
      saveGameState();
    } else {
      saveGameState();
    }

    if (guessesLeft === 0) setTimeout(showEndgameSummary, 300);
  }

  // Give Up button
  const giveUpButton = document.querySelector(".give-up-btn");
  if (giveUpButton) {
    giveUpButton.addEventListener("click", () => {
      guessesLeft = 0;
      const gc = document.querySelector(".guesses-count");
      if (gc) gc.textContent = guessesLeft;
      saveGameState();
      showEndgameSummary();
    });
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

      // Compute valid answers for this cell
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      if (!answerList || !modal) return;

      answerList.innerHTML = "";
      const seen = new Set();
      const valid = countryData.filter(c => matchGeoLabel(c, rowLabel) && matchGeoLabel(c, colLabel));
      valid.forEach(c => {
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