// ======= Wikipedia Thumbnail Fetcher =======
async function fetchWikipediaImage(title) {
  const normalizedTitle = title.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (normalizedTitle === "george hw bush") {
    return "images/George_H._W._Bush_presidential_portrait_(cropped).jpg";
  }
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&titles=${encodeURIComponent(title)}&pithumbsize=400`;
  try {
    const response = await fetch(url);
    const json = await response.json();
    const pages = json.query.pages;
    const firstPage = Object.values(pages)[0];
    if (firstPage.thumbnail) {
      return firstPage.thumbnail.source;
    } else if (title.includes("Trump")) {
      return "https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg";
    } else if (title.includes("Biden")) {
      return "https://upload.wikimedia.org/wikipedia/commons/6/68/Joe_Biden_presidential_portrait.jpg";
    }
    return "https://via.placeholder.com/400x260?text=No+Image";
  } catch {
    return "https://via.placeholder.com/400x260?text=No+Image";
  }
}

function loadGridByDay(day) {
  fetch("daily-pgrids.json")
    .then(res => res.json())
    .then(data => {
      const grid = data[day];
      if (!grid) return;

      document.getElementById("grid-number").textContent = `Grid #${String(day).padStart(3, "0")}`;
      document.querySelectorAll(".row-label").forEach((el, i) => el.textContent = grid.rows[i] || "");
      document.querySelectorAll(".col-label").forEach((el, i) => el.textContent = grid.columns[i] || "");

      // Optional: prevent interactivity for past grids
      window.viewingPastGrid = day !== currentDay;
    });
}

// ======= Card Renderer =======
async function renderGrid(dataArray) {
  const grid = document.getElementById("card-grid");
  if (!grid) return;
  for (const item of dataArray) {
    const image = await fetchWikipediaImage(item.name || "");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${image}" alt="${item.name}" />
      <div class="card-body">
        <div class="card-title">${item.name}</div>
        <div class="card-subtitle">${item.party}</div>
        <div class="card-subtitle">Term: ${item.term_start}–${item.term_end}</div>
        <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(item.name)}" target="_blank">Wikipedia</a>
      </div>
    `;
    grid.appendChild(card);
  }
}

// ======= Global State =======
const launchDate = new Date("August 10, 2025 00:00:00");

// Normalize current time to today's midnight (local time)
const now = new Date();
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;

let presidentData = [];
const today = currentDay;

// ======= CSV Loader =======
async function loadPresidents() {
  return new Promise((resolve, reject) => {
    Papa.parse("presidents-data/presidentialdata.csv", {
      header: true,
      download: true,
      complete: (results) => {
        presidentData = results.data.map(p => ({
          first_name: (p["First Name"] || "").trim(),
          last_name: (p["Last Name"] || "").trim(),
          name: ((p["First Name"] || "") + " " + (p["Last Name"] || "")).trim(),
          party: (p["Political Party"] || "").trim(),
          term_start: parseInt(p["Start Year"]) || null,
          term_end: parseInt(p["End Year"]) || null,
          assassinated: (p["Assassinated"] || "").trim().toLowerCase(),
          birth_state: (p["Birth State"] || "").trim(),
          military_service: (p["Serve in Military"] || "").trim().toLowerCase(),
          presidency_number: parseInt(p["presidency number"]) || null,
          age_at_start: parseInt(p["Age at Start of presidency"]) || null,
          served_in_congress: (p["Served in Congress"] || "").trim().toLowerCase(),
          served_in_house: (p["Served in the House of Representatives"] || "").trim().toLowerCase(),
          served_in_senate: (p["Served in the Senate"] || "").trim().toLowerCase(),
          governor: (p["Former State Governors"] || "").trim().toLowerCase(),
          ivy_league: (p["Attended Ivy League School"] || "").trim().toLowerCase(),
          died_in_office: (p["Died in Office"] || "").trim().toLowerCase(),
          vice_president: (p["Serve as Vice President"] || "").trim().toLowerCase(),
          mount_rushmore: (p["Appears on Mount Rushmore"] || "").trim().toLowerCase(),
          years_in_office: parseFloat(p["Years in Office"]) || null,
          nobel: (p["Nobel Prize Winner"] || "").trim().toLowerCase(),
          impeached: (p["Impeached"] || "").trim().toLowerCase(),
          lost_popular_vote: (p["Won without Popular Vote"] || "").trim().toLowerCase(),
          cold_war: (p["Cold War President"] || "").trim().toLowerCase(),
          on_currency: (p["Appears on Currency"] || "").trim().toLowerCase(),
          re_elected: (p["Won Re-election"] || "").trim().toLowerCase(),
          born_before_1800: (p["Born Before 1800"] || "").trim().toLowerCase(),
          born_1800_1900: (p["Born 1800 - 1900"] || "").trim().toLowerCase(),
          born_1900_2000: (p["Born 1900-2000"] || "").trim().toLowerCase()
        })).filter(p => p.name);
        resolve();
      },
      error: reject
    });
  });
}

// ======= Match Label Function =======
function matchMatchesLabel(p, label) {
  if (!p || !label) return false;

  // Normalize label for consistent matching
  const l = label
    .toLowerCase()
    .replace(/–/g, "-")
    .replace(/“|”/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  // Handle null/undefined fields safely
  const safe = (val) => (val || "").toLowerCase().trim();
  const name = safe(p.name);
  const firstName = safe(p.first_name);
  const lastName = safe(p.last_name);
  const party = safe(p.party);
  const start = parseInt(p.term_start) || 0;
  const end = parseInt(p.term_end) || 0;
  const years = parseFloat(p.years_in_office) || 0;
  const age = parseInt(p.age_at_start) || 0;

  // ========== Name Filters ==========
  // First name range (e.g., "First Name Starts with A-J" or "First Name A-J")
  if (l.includes("first name starts with a-j") || l.includes("first name a-j")) {
    const firstChar = firstName.charAt(0).toUpperCase();
    console.log(`Checking first name A-J for ${name}: ${firstChar} -> ${firstChar >= "A" && firstChar <= "J"}`); // Debug
    return firstChar >= "A" && firstChar <= "J";
  }
  if (l.includes("first name starts with k-z") || l.includes("first name k-z")) {
    const firstChar = firstName.charAt(0).toUpperCase();
    console.log(`Checking first name K-Z for ${name}: ${firstChar} -> ${firstChar >= "K" && firstChar <= "Z"}`); // Debug
    return firstChar >= "K" && firstChar <= "Z";
  }
  if (l.includes("served past 1850")) return start > 1850;
  if (l.includes("served past 1900")) return start > 1900;

  // Last name range (e.g., "Last Name A-J" or "Last Name K-Z")
  if (l.includes("last name a-j")) {
    const firstChar = lastName.charAt(0).toUpperCase();
    console.log(`Checking last name A-J for ${name}: ${firstChar} -> ${firstChar >= "A" && firstChar <= "J"}`); // Debug
    return firstChar >= "A" && firstChar <= "J";
  }
  if (l.includes("last name k-z")) {
    const firstChar = lastName.charAt(0).toUpperCase();
    console.log(`Checking last name K-Z for ${name}: ${firstChar} -> ${firstChar >= "K" && firstChar <= "Z"}`); // Debug
    return firstChar >= "K" && firstChar <= "Z";
  }

  // Specific name match (e.g., "Name Lincoln")
  const nameMatch = l.match(/name\s+([a-z\s]+)/i);
  if (nameMatch) {
    const targetName = nameMatch[1].trim().toLowerCase();
    console.log(`Checking specific name for ${name}: ${targetName} -> ${name.includes(targetName) || lastName.includes(targetName)}`); // Debug
    return name.includes(targetName) || lastName.includes(targetName);
  }

  // ========== Political Party ==========
  if (l.includes("federalist")) return party.includes("federalist");
  if (l.includes("democratic-republican")) return party.includes("democratic-republican");
  if (l.includes("republican")) return party === "republican";
  if (l.includes("democratic")) return party === "democratic";
  if (l.includes("whig")) return party === "whig";
  if (l.includes("none") || l.includes("independent")) return party === "none" || party === "";

  // ========== Term Year Filters ==========
  const rangeMatch = l.match(/served.*?from\s*(\d{3,4})\s*[-–to]+\s*(\d{3,4}|present)/i);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1]);
    const max = rangeMatch[2].toLowerCase() === "present" ? new Date().getFullYear() + 1 : parseInt(rangeMatch[2]);
    return start >= min && start <= max;
  }

  if (l.includes("18th century")) return start >= 1701 && start <= 1800;
  if (l.includes("19th century")) return start >= 1801 && start <= 1900;
  if (l.includes("20th century")) return start >= 1901 && start <= 2000;
  if (l.includes("21st century")) return start >= 2001 && start <= 2100;

  const beforeMatch = l.match(/(served|started).*before\s*(\d{4})/i);
  if (beforeMatch) return start < parseInt(beforeMatch[2]);

  const afterMatch = l.match(/(served|started|began presidency|took office).*after\s*(\d{4})/i);
  if (afterMatch) return start > parseInt(afterMatch[2]);
  
  const pastMatch = l.match(/(began presidency|started|took office).*past\s*(\d{4})/i);
  if (pastMatch) return start > parseInt(pastMatch[2]);
  
  const endBeforeMatch = l.match(/(ended|end|served.*until).*before\s*(\d{4})/i);
  if (endBeforeMatch) return end < parseInt(endBeforeMatch[2]);

  const endAfterMatch = l.match(/(ended|end|served.*until).*after\s*(\d{4})/i);
  if (endAfterMatch) return end > parseInt(endAfterMatch[2]);

  const endRangeMatch = l.match(/end.*between\s*(\d{4})\s*(?:and|to|-|–)\s*(\d{4})/i);
  if (endRangeMatch) {
    const min = parseInt(endRangeMatch[1]);
    const max = parseInt(endRangeMatch[2]);
    return end >= min && end <= max;
  }

  if (l.includes("ended in 19th century")) return end >= 1801 && end <= 1900;
  if (l.includes("ended in 20th century")) return end >= 1901 && end <= 2000;
  if (l.includes("ended in 21st century")) return end >= 2001 && end <= 2100;

  // ========== Years in Office ==========
  if (l.includes("served more than 5 years")) return years > 5;
  if (l.includes("served less than 5 years")) return years < 5;

  const yearsMoreMatch = l.match(/years in office\s*>\s*(\d+(\.\d+)?)/i);
  if (yearsMoreMatch) return years > parseFloat(yearsMoreMatch[1]);

  const yearsLessMatch = l.match(/years in office\s*<\s*(\d+(\.\d+)?)/i);
  if (yearsLessMatch) return years < parseFloat(yearsLessMatch[1]);

  // ========== Age at Start ==========
  const ageMoreMatch = l.match(/age at start\s*>\s*(\d+)/i);
  if (ageMoreMatch) return age > parseInt(ageMoreMatch[1]);

  const ageLessMatch = l.match(/age at start\s*<\s*(\d+)/i);
  if (ageLessMatch) return age < parseInt(ageLessMatch[1]);

  const inauguratedOlderMatch = l.match(/inaugurated.*older than\s*(\d+)/i);
  if (inauguratedOlderMatch) return age > parseInt(inauguratedOlderMatch[1]);

  const inauguratedYoungerMatch = l.match(/inaugurated.*younger than\s*(\d+)/i);
  if (inauguratedYoungerMatch) return age < parseInt(inauguratedYoungerMatch[1]);

  const inauguratedAtAgeMatch = l.match(/inaugurated.*age\s*(\d+)/i);
  if (inauguratedAtAgeMatch) return age === parseInt(inauguratedAtAgeMatch[1]);

  // ========== Binary Flags ==========
  const yes = ["yes", "true", "1"];
  if (l.includes("assassinated")) return yes.includes(safe(p.assassinated));
  if (l.includes("died in office")) return yes.includes(safe(p.died_in_office));
  if (l.includes("served in military")) return yes.includes(safe(p.military_service));
  if (l.includes("served in congress")) return yes.includes(safe(p.served_in_congress));
  if (l.includes("served in the house")) return yes.includes(safe(p.served_in_house));
  if (l.includes("served in the senate")) return yes.includes(safe(p.served_in_senate));
  if (l.includes("served as vice president")) return yes.includes(safe(p.vice_president));
  if (l.includes("former state governor")) return yes.includes(safe(p.governor));
  if (l.includes("attended ivy league")) return yes.includes(safe(p.ivy_league));
  if (l.includes("nobel prize")) return yes.includes(safe(p.nobel));
  if (l.includes("impeached")) return yes.includes(safe(p.impeached));
  if (l.includes("without popular vote")) return yes.includes(safe(p.lost_popular_vote));
  if (l.includes("cold war")) return yes.includes(safe(p.cold_war));
  if (l.includes("appears on currency")) return yes.includes(safe(p.on_currency));
  if (l.includes("appears on mount rushmore")) return yes.includes(safe(p.mount_rushmore));
  if (l.includes("won re-election")) return yes.includes(safe(p.re_elected));
  if (l.includes("not re-elected") || l.includes("not reelected")) return safe(p.re_elected) === "no";
  if (l.includes("born before 1800")) return yes.includes(safe(p.born_before_1800));
  if (l.includes("born 1800 - 1900")) return yes.includes(safe(p.born_1800_1900));
  if (l.includes("born 1900-2000")) return yes.includes(safe(p.born_1900_2000));

  // ========== Birth State ==========
  const stateMatch = l.match(/born in\s+([a-z\s]+)/i);
  if (stateMatch) {
    const targetState = stateMatch[1].trim().toLowerCase();
    return safe(p.birth_state).includes(targetState);
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
    saveGameState(); // ✅ Save state with guessesLeft = 0
    showEndgameSummary();
  });

  const gridLabel = document.getElementById("grid-number");
  if (gridLabel) {
    gridLabel.textContent = `GRID #${String(currentDay).padStart(3, "0")}`;
  }

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

    const matches = presidentData
      .filter(p => {
        const searchTerms = val.toLowerCase().split(" ");
        const nameParts = p.name.toLowerCase().split(" ");
        return searchTerms.every(term =>
          nameParts.some(part => part.startsWith(term))
        );
      })
      .filter((p, index, self) =>
        index === self.findIndex(other => other.name === p.name)
      );

    if (!matches.length) {
      box.style.display = "none";
      return;
    }

    matches.forEach(p => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;
      const guessBtn = document.createElement("button");
      guessBtn.textContent = "Guess";
      guessBtn.className = "autocomplete-select-btn";
      const alreadyUsed = usedPresidents.has(p.name);
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
        guessBtn.addEventListener("click", () => handleGuess(p.name));
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

  let guessesLeft = 9;
  const usedPresidents = new Set();
  function saveGameState() {
    const gridData = [...document.querySelectorAll(".cell")].map(cell => {
      const img = cell.querySelector("img");
      return img ? img.alt : null;
    });
    const gameState = {
      guessesLeft,
      usedPresidents: Array.from(usedPresidents),
      gridData,
      gameOver: guessesLeft === 0,
      currentDay // Store the current day to track which grid the state belongs to
    };
    localStorage.setItem("gridOfMindsGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("gridOfMindsGame");
    if (!saved) return;

    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      // Clear localStorage if the saved day does not match the current day
      localStorage.removeItem("gridOfMindsGame");
      return; // Exit to start fresh with the new grid
    }

    guessesLeft = state.guessesLeft ?? 9;
    document.querySelector(".guesses-count").textContent = guessesLeft;

    state.usedPresidents.forEach(name => usedPresidents.add(name));

    const cells = document.querySelectorAll(".cell");
    state.gridData.forEach((name, i) => {
      if (name && cells[i]) {
        fetchWikipediaImage(name).then(imgUrl => {
          cells[i].innerHTML = `<img src="${imgUrl}" alt="${name}" class="cell-full-image">`;
          cells[i].classList.add("correct");
        });
      }
    });

    if (state.gameOver) {
      setTimeout(showEndgameSummary, 300); // Delay ensures DOM is ready
    }
  }

  async function handleGuess(inputName) {
    const guess = inputName.toLowerCase();
    const match = presidentData.find(p => {
      const full = p.name.toLowerCase();
      const last = (p.last_name || "").toLowerCase();
      return full === guess || last === guess;
    });
    guessesLeft = Math.max(guessesLeft - 1, 0);
    document.querySelector(".guesses-count").textContent = guessesLeft;

    // 🔒 Disable guess button if no guesses left
    if (guessesLeft === 0) {
      // Disable all future autocomplete buttons
      box.innerHTML = ""; // Clears autocomplete box
      setTimeout(showEndgameSummary, 300);
    }

    const guessRemaining = document.getElementById("guess-remaining");
    if (guessRemaining) guessRemaining.textContent = `Guesses left: ${guessesLeft}`;
    guessModal.style.display = "none";
    box.style.display = "none";
    guessError.style.display = "none";
    if (guessesLeft === 0) {
      setTimeout(showEndgameSummary, 300);
    }
    if (!match || usedPresidents.has(match.name)) {
      saveGameState(); // ✅ persist even if guess was incorrect or repeated
      return;
    }
    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;
    console.log(`Evaluating guess: ${match.name} for ${rowLabel} × ${colLabel}`); // Debug
    if (matchMatchesLabel(match, rowLabel) && matchMatchesLabel(match, colLabel)) {
      const img = await fetchWikipediaImage(match.name);
      activeCell.innerHTML = `<img src="${img}" alt="${match.name}" class="cell-full-image">`;
      activeCell.classList.add("correct");
      usedPresidents.add(match.name);
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
  loadPresidents().then(() => {
    loadGameState();
    loadGridByDay(currentDay);
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
    const rowLabels = ["Row 1", "Row 2", "Row 3"];
    const colLabels = ["Col 1", "Col 2", "Col 3"];
    const cells = [...playerGrid.children];

    let output = `Presidential Grid Results\n${finalScoreText.textContent}\n\n`;

    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;

      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent.trim() || `Row ${row + 1}`;
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent.trim() || `Col ${col + 1}`;

      const guess = cells[i].querySelector("img")?.alt || "—";
      const isCorrect = cells[i].classList.contains("correct");
      const mark = isCorrect ? "✅" : "❌";

      output += `${rowLabel} × ${colLabel}: ${guess} ${mark}\n`;
    }

    if (navigator.share) {
      navigator.share({
        title: 'Grid of Minds Results',
        text: output
      }).catch(err => {
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
    const img = cell.querySelector("img");
    if (img) {
      playerCell.textContent = img.alt;
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
      const validAnswers = presidentData.filter(p =>
        matchMatchesLabel(p, rowLabel) && matchMatchesLabel(p, colLabel)
      );
      const answerList = document.getElementById("answer-list");
      const modal = document.getElementById("answers-modal");
      answerList.innerHTML = "";
      const seen = new Set();
      validAnswers.forEach(p => {
        if (!seen.has(p.name)) {
          seen.add(p.name);
          const li = document.createElement("li");
          li.textContent = p.name;
          answerList.appendChild(li);
        }
      });
      document.getElementById("answers-modal-title").textContent = `${rowLabel} × ${colLabel}`;
      modal.style.display = "block";
    });
    resultGrid.appendChild(resultCell);
  });
  document.getElementById("play-again-btn").addEventListener("click", () => {
    localStorage.removeItem("gridOfMindsGame");
    location.reload(); // Reloads the page and resets everything
  });

  finalScoreText.textContent = `You got ${correctCount} out of 9 correct!`;
  endgameModal.style.display = "block";

  copyBtn.onclick = () => {
    const rowLabels = ["Row 1", "Row 2", "Row 3"];
    const colLabels = ["Col 1", "Col 2", "Col 3"];
    const cells = [...playerGrid.children];

    let output = `${finalScoreText.textContent}\n\nYour Answers:\n`;

    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;

      const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent.trim() || `Row ${row + 1}`;
      const colLabel = document.querySelectorAll(".col-label")[col]?.textContent.trim() || `Col ${col + 1}`;

      const guess = cells[i].querySelector("img")?.alt || "—";
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

// ======= Grid Loader =======
fetch("daily-pgrids.json")
  .then(res => res.json())
  .then(data => {
    const grid = data[currentDay];
    if (!grid) return;
    document.querySelectorAll(".row-label").forEach((el, i) => el.textContent = grid.rows[i] || "");
    document.querySelectorAll(".col-label").forEach((el, i) => el.textContent = grid.columns[i] || "");
  });