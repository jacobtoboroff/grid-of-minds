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

// ======= Helpers: Path-based routing =======
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

// ======= Label Loader from daily-pgrids.json =======
async function loadGridByDay(day) {
  try {
    const res = await fetch("daily-pgrids.json", { cache: "no-cache" });
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

    // Let Archives know what we're on
    window.__CURRENT_GRID__ = day;

    // Optional: mark if viewing a past grid
    window.viewingPastGrid = (typeof currentDay === "number") ? (day !== currentDay) : false;
  } catch (e) {
    console.error("Failed to load daily-pgrids.json", e);
  }
}

// ======= Card Renderer (unused by archives, kept as-is) =======
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
const launchDate = new Date("August 12, 2025 00:00:00");
const now = new Date();
// Midnight local
const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const msInDay = 24 * 60 * 60 * 1000;
const currentDay = Math.floor((todayMidnight - launchDate) / msInDay) + 1;
window.TODAYS_GRID = currentDay; // <-- add this line

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
          first_name_vowel: /^[aeiou]/i.test((p["First Name"] || "").trim()),
          last_name_vowel: /^[aeiou]/i.test((p["Last Name"] || "").trim()),
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
        
          founding_father: (() => {
            const key = Object.keys(p).find(k => {
              const n = String(k).toLowerCase().replace(/\s+/g, "");
              return n.includes("foundingfather") || n.includes("foundngfather");
            }) || "Foundng father";
            const raw = key && p[key] !== undefined ? p[key] : "";
            const v = String(raw || "").trim().toLowerCase();
            if (v === "y") return "yes";
            if (v === "n") return "no";
            return v;
          })(),
        
          has_facial_hair: (() => {
            const key = Object.keys(p).find(k => {
              const n = String(k).toLowerCase().replace(/\s+/g, "");
              return n.includes("hasfacialhair");
            }) || "Has Facial Hair";
            const raw = key && p[key] !== undefined ? p[key] : "";
            const v = String(raw || "").trim().toLowerCase();
            if (v === "y") return "yes";
            if (v === "n") return "no";
            return v;
          })(),
        
          college_degree: (() => {
            const key = Object.keys(p).find(k => String(k).toLowerCase().trim() === "college degree");
            const raw = key ? p[key] : "";
            const v = String(raw || "").trim().toLowerCase();
            if (v === "y") return "yes";
            if (v === "n") return "no";
            return v;
          })(),
        
          died_in_office: (p["Died in Office"] || "").trim().toLowerCase(),
          vice_president: (p["Serve as Vice President"] || "").trim().toLowerCase(),
          secretary_state: (() => {
            const key =
              Object.keys(p).find(k =>
                String(k).toLowerCase().replace(/\s+/g, " ").includes("secretary of state")
              ) ||
              "Served as Secretary of State" ||
              "Serve as Secretary of State" ||
              "Secretary of State";
            const raw = key && p[key] !== undefined ? p[key] : "";
            return String(raw || "").trim().toLowerCase();
          })(),
        
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
          born_1900_2000: (p["Born 1900-2000"] || "").trim().toLowerCase(),
        
          height_in: parseFloat(p["Height (inches)"] || p["Height Inches"] || p["Height"] || "") || null,
          weight_lbs: parseFloat((p["Weight (lbs)"] ?? p["Weight (pounds)"] ?? p["Weight Lbs"] ?? p["Weight"] ?? "")) || null,
        
          met_queen_elizabeth_ii: (p["Met Queen Elizabeth II"] || "").trim().toLowerCase(),
        
          unmarried_while_in_office: (() => {
            const key = Object.keys(p).find(
              k => String(k).toLowerCase().trim() === "unmarried while in office"
                || String(k).toLowerCase().trim() === "unmarried in office"
            );
            const raw = key ? p[key] : "";
            return String(raw || "").trim().toLowerCase();
          })(),
        
          tied_war_1812: (() => {
            const key = Object.keys(p).find(k => {
              const s = String(k).toLowerCase().replace(/\s+/g, " ").trim();
              return s === "tied to war of 1812" || s === "war of 1812 tied" || s.includes("war of 1812");
            });
            const raw = key ? p[key] : "";
            const v = String(raw || "").trim().toLowerCase();
            if (v === "y") return "yes";
            if (v === "n") return "no";
            return v;
          })(),
        
          // >>> NEW FIELDS <<<
          related_to_president: (() => {
            const key = Object.keys(p).find(k => {
              const s = String(k).toLowerCase().replace(/[_\s]+/g, " ").trim();
              return s === "related to another president" || s === "related to president" || s.includes("related to") && s.includes("president");
            });
            const raw = key ? p[key] : "";
            const v = String(raw || "").trim().toLowerCase();
            if (v === "y") return "yes";
            if (v === "n") return "no";
            return v; // expect "yes"/"no"
          })(),
        
          alliterative_name: (() => {
            const key = Object.keys(p).find(k => {
              const s = String(k).toLowerCase().replace(/[_\s]+/g, " ").trim();
              return s === "alliterative name" || s === "alliterative";
            });
            const raw = key ? p[key] : "";
            const v = String(raw || "").trim().toLowerCase();
            if (v === "y") return "yes";
            if (v === "n") return "no";
            return v; // expect "yes"/"no"
          })()
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

  const l = label
    .toLowerCase()
    .replace(/–/g, "-")
    .replace(/“|”/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  const safe = (val) => (val || "").toLowerCase().trim();
  const name = safe(p.name);
  const firstName = safe(p.first_name);
  const lastName = safe(p.last_name);
  const party = safe(p.party);
  const start = parseInt(p.term_start) || 0;
  const end = parseInt(p.term_end) || 0;
  const years = parseFloat(p.years_in_office) || 0;
  const age = parseInt(p.age_at_start) || 0;

// Names
if (l.includes("first name starts with a-j") || l.includes("first name a-j")) {
  const firstChar = firstName.charAt(0).toUpperCase();
  return firstChar >= "A" && firstChar <= "J";
}
if (l.includes("first name starts with k-z") || l.includes("first name k-z")) {
  const firstChar = firstName.charAt(0).toUpperCase();
  return firstChar >= "K" && firstChar <= "Z";
}
if (l.includes("first name starts with vowel") || l.includes("first name vowel")) {
  return p.first_name_vowel;  // already normalized above
}
if (
  l.includes("last name starts with vowel") ||
  l.includes("last name vowel") ||
  l.includes("last name begins with vowel")   // optional alias
) {
  return p.last_name_vowel;  // use normalized boolean
}
if (l.includes("served past 1850")) return start > 1850;
if (l.includes("served past 1900")) return start > 1900;

if (l.includes("last name a-j")) {
  const firstChar = lastName.charAt(0).toUpperCase();
  return firstChar >= "A" && firstChar <= "J";
}
if (l.includes("last name k-z")) {
  const firstChar = lastName.charAt(0).toUpperCase();
  return firstChar >= "K" && firstChar <= "Z";
}

const nameMatch = l.match(/name\s+([a-z\s]+)/i);
if (nameMatch) {
  const targetName = nameMatch[1].trim().toLowerCase();
  return name.includes(targetName) || lastName.includes(targetName);
}

  // Party
  if (l.includes("federalist")) return party.includes("federalist");
  if (l.includes("democratic-republican")) return party.includes("democratic-republican");
  if (l.includes("republican")) return party === "republican";
  if (l.includes("democratic")) return party === "democratic";
  if (l.includes("whig")) return party === "whig";
  if (l.includes("none") || l.includes("independent")) return party === "none" || party === "";

  // Year filters
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

  // Presidency number range
  const presNum = p.presidency_number || 0;
  const presRangeMatch = l.match(/presidency number\s*(\d+)\s*[-–to]+\s*(\d+)/i);
  if (presRangeMatch) {
    const min = parseInt(presRangeMatch[1]);
    const max = parseInt(presRangeMatch[2]);
    return presNum >= min && presNum <= max;
  }

  // Years in office
  if (l.includes("served more than 5 years")) return years > 5;
  if (l.includes("served less than 5 years")) return years < 5;
  if (l.includes("served more than 4 years")) return years > 4;
  if (l.includes("served less than 4 years")) return years < 4;

  const yearsMoreMatch = l.match(/years in office\s*>\s*(\d+(\.\d+)?)/i);
  if (yearsMoreMatch) return years > parseFloat(yearsMoreMatch[1]);

  const yearsLessMatch = l.match(/years in office\s*<\s*(\d+(\.\d+)?)/i);
  if (yearsLessMatch) return years < parseFloat(yearsLessMatch[1]);

  // Age at start
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

// Binary flags
const yes = ["yes", "true", "1"];
const no = ["no", "false", "0"];

// Normalize helper
const norm = (s) => String(s || "").trim().toLowerCase();

// Helper to check flags
function checkFlag(val, isNegated) {
  const v = norm(val);
  return isNegated ? no.includes(v) : yes.includes(v);
}

// Normalize label once
const L = norm(l);

// Figure out if the label is negated (support a bunch of forms)
const neg = /\b(not|no|did not|does not|was not|is not|didn['’]t|doesn['’]t|isn['’]t)\b/i.test(l);

// --- Binary categories (use broad, tense-agnostic keywords) ---
if (L.includes("assassin")) return checkFlag(p.assassinated, neg);

if (/die(d)? in office/.test(L)) return checkFlag(p.died_in_office, neg);

if (/serve(d)? in (the )?military/.test(L)) return checkFlag(p.military_service, neg);
if (/serve(d)? in (the )?congress/.test(L)) return checkFlag(p.served_in_congress, neg);
if (/serve(d)? in (the )?house/.test(L)) return checkFlag(p.served_in_house, neg);
if (/serve(d)? in (the )?senate/.test(L)) return checkFlag(p.served_in_senate, neg);

if (/serve(d)? as (the )?vice president/.test(L) || L.includes("vice president"))
  return checkFlag(p.vice_president, neg);

if (L.includes("facial hair"))
  return checkFlag(p.has_facial_hair, neg);

if (L.includes("founding father"))
  return checkFlag(p.founding_father, neg);

if (/serve(d)? as (the )?secretary of state/.test(L) || L.includes("secretary of state"))
  return checkFlag(p.secretary_state, neg);

if (L.includes("governor")) return checkFlag(p.governor, neg);

if (L.includes("ivy")) return checkFlag(p.ivy_league, neg);

if (L.includes("nobel")) return checkFlag(p.nobel, neg);

if (L.includes("impeach")) return checkFlag(p.impeached, neg);

if (L.includes("college degree"))
  return checkFlag(p.college_degree, neg);

if (L.includes("without popular vote") || L.includes("lost popular vote"))
  return checkFlag(p.lost_popular_vote, neg);

if (L.includes("cold war")) return checkFlag(p.cold_war, neg);

if (L.includes("currency")) return checkFlag(p.on_currency, neg);

if (L.includes("mount rushmore")) return checkFlag(p.mount_rushmore, neg);

if (L.includes("met queen elizabeth ii")) return checkFlag(p.met_queen_elizabeth_ii, neg);

// Unmarried while in Office
if (
  L.includes("unmarried while in office") ||
  L.includes("unmarried in office") ||
  L.includes("no spouse in office")
) {
  return checkFlag(p.unmarried_while_in_office, neg);
}

// Tied to War of 1812
if (
  L.includes("tied to war of 1812") ||
  L.includes("related to the war of 1812") ||
  (L.includes("war of 1812") && (L.includes("tied") || L.includes("related")))
) {
  return checkFlag(p.tied_war_1812, neg);
}

// >>> NEW: Related to another president (handles a few phrasings)
if (
  L.includes("related to another president") ||
  L.includes("related to a president") ||
  L.includes("related to president") ||
  L.includes("presidential relative") ||
  L.includes("family of a president")
) {
  return checkFlag(p.related_to_president, neg);
}

// >>> NEW: Alliterative name (first & last share the same initial)
if (
  L.includes("alliterative name") ||
  L.includes("alliterative") ||
  L.includes("same first and last initial") ||
  L.includes("matching initials")
) {
  return checkFlag(p.alliterative_name, neg);
}

// --- Height buckets ---
if (
  L.includes("6 feet or taller") ||
  L.includes("at least 6 feet") ||
  L.includes(">= 6 feet") ||
  L.includes("six feet or taller")
) {
  return p.height_in !== null && p.height_in >= 72;
}
if (
  L.includes("shorter than 6 feet") ||
  L.includes("under 6 feet") ||
  L.includes("< 6 feet") ||
  L.includes("under six feet")
) {
  return p.height_in !== null && p.height_in < 72;
}
function extractPounds(label) {
  const m = label.match(/(\d+)\s*(pounds|pound|lbs?)/i);
  return m ? parseInt(m[1], 10) : null;
}
if (L.includes("pound") || L.includes("lbs")) {
  const n = extractPounds(L);
  if (n !== null) {
    // Greater-or-equal style
    if (
      L.includes("or greater") ||
      L.includes("or more") ||
      L.includes("at least") ||
      L.includes(">=") ||
      /greater\s+than\s+or\s+equal/.test(L)
    ) {
      return p.weight_lbs !== null && p.weight_lbs >= n;
    }
    if (/\s>\s*\d+/.test(L) || /greater\s+than\s+\d+/.test(L)) {
      return p.weight_lbs !== null && p.weight_lbs > n;
    }

    // Less-than style
    if (
      L.includes("less than") ||
      L.includes("under") ||
      L.includes("<")
    ) {
      return p.weight_lbs !== null && p.weight_lbs < n;
    }

    // Fallback: exact match if someone writes "exactly 180 pounds"
    if (L.includes("exactly")) {
      return p.weight_lbs !== null && p.weight_lbs === n;
    }
  }
}

// --- Re-election ---
if (L.includes("won re-election") || L.includes("won reelection"))
  return yes.includes(norm(p.re_elected));

if (L.includes("not re-elected") || L.includes("not reelected") || /lost re-?election/.test(L))
  return norm(p.re_elected) === "no";

// --- Birth year ranges ---
if (L.includes("born before 1800")) return yes.includes(norm(p.born_before_1800));
if (L.includes("born 1800 - 1900")) return yes.includes(norm(p.born_1800_1900));
if (L.includes("born 1900-2000")) return yes.includes(norm(p.born_1900_2000));

// --- Birth state ---
const stateMatch = L.match(/born in\s+([a-z\s]+)/i);
if (stateMatch) {
  const targetState = stateMatch[1].trim().toLowerCase();
  return norm(p.birth_state).includes(targetState);
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
      currentDay
    };
    localStorage.setItem("gridOfMindsGame", JSON.stringify(gameState));
  }

  function loadGameState() {
    const saved = localStorage.getItem("gridOfMindsGame");
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.currentDay !== currentDay) {
      localStorage.removeItem("gridOfMindsGame");
      return;
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
      setTimeout(showEndgameSummary, 300);
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

    if (guessesLeft === 0) {
      box.innerHTML = "";
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
      saveGameState();
      return;
    }
    const idx = [...document.querySelectorAll(".cell")].indexOf(activeCell);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const rowLabel = document.querySelectorAll(".row-label")[row]?.textContent;
    const colLabel = document.querySelectorAll(".col-label")[col]?.textContent;
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

  // Load data first, then decide which grid to show based on PATH
  loadPresidents().then(async () => {
    let num = getGridNumberFromPath();
    if (!num) {
      // no number in path → show today's grid (no redirect here)
      num = today;
    }

    // Header + labels for this grid
    if (gridLabel) gridLabel.textContent = `GRID #${String(num).padStart(3, "0")}`;
    window.__CURRENT_GRID__ = num;

    // Only load saved game state on today's grid
    if (num === today) {
      loadGameState();
    } else {
      // Past grids → keep board clean
      localStorage.removeItem("gridOfMindsGame");
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
      navigator.share({ title: "Grid of Minds Results", text: output }).catch(err => {
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

// ================================
// Archives Modal Logic (list from min(latest, currentDay) → 1)
// ================================
(function () {
  const archivesLink   = document.getElementById("archives-link");
  const archivesModal  = document.getElementById("archives-modal");
  const closeArchives  = document.getElementById("close-archives");
  const archivesList   = document.getElementById("archives-list");
  const gridNumberEl   = document.getElementById("grid-number");

  if (!archivesLink || !archivesModal || !closeArchives || !archivesList) return;

  const GRID_JSON_URL = "daily-pgrids.json";
  let __gridsCache = null;
  let __latestGrid = null;

  async function fetchAllGrids() {
    if (__gridsCache) return __gridsCache;
    const res = await fetch(GRID_JSON_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to fetch daily-pgrids.json");
    __gridsCache = await res.json();
    return __gridsCache;
  }

  async function getLatestGridNumber() {
    if (typeof __latestGrid === "number") return __latestGrid;
    const data = await fetchAllGrids();
    const nums = Object.keys(data).map(k => parseInt(k, 10)).filter(n => !isNaN(n));
    __latestGrid = nums.length ? Math.max(...nums) : 1;
    return __latestGrid;
  }

  function selectArchive(n) {
    closeModal();
    // Prefer pretty paths if available; fallback to ?grid= for local dev
    if (typeof window.buildGridPath === "function") {
      window.location.href = window.buildGridPath(n);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("grid", String(n));
      window.location.href = url.toString();
    }
  }

  function buttonFor(n) {
    const btn = document.createElement("button");
    btn.className = "archive-item";
    btn.textContent = `Grid #${String(n).padStart(3, "0")}`;
    btn.style.display = "block";
    btn.style.width   = "100%";
    btn.style.margin  = "6px 0";
    btn.style.padding = "10px 12px";
    btn.style.border  = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor  = "pointer";
    btn.onclick = () => selectArchive(n);
    return btn;
  }

  async function populateArchivesFromCap() {
    const latest = await getLatestGridNumber();
  
    // Read the global we set after computing currentDay
    const effectiveToday = Number(window.TODAYS_GRID) || 1;
  
    // Cap to the smaller of (latest in JSON) and (today)
    const cap = Math.min(latest, effectiveToday);
  
    // Debug so you can verify in DevTools console
    console.log("[Archives] latest in JSON =", latest, " | today =", effectiveToday, " | cap =", cap);
  
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
    await populateArchivesFromCap();
    archivesModal.style.display = "block";
  }
  function closeModal() {
    archivesModal.style.display = "none";
  }

  // Events
  archivesLink.addEventListener("click", (e) => { e.preventDefault(); openModal(); });

  if (gridNumberEl) {
    gridNumberEl.style.cursor = "pointer";
    gridNumberEl.title = "View archives";
    gridNumberEl.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
  }

  closeArchives.addEventListener("click", closeModal);
  window.addEventListener("click", (e) => { if (e.target === archivesModal) closeModal(); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && archivesModal.style.display === "block") closeModal();
  });
})();