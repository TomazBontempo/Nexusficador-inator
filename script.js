// ===== Global State =====
let fastaData = null;
let parsedData = null;
let currentBiomes = [];
let selectedLocation = null; // 'location01' or 'location02'
let hasDualLocations = false;
let hasAmbiguousChars = false;
let ambiguousChars = { N: false, gap: false };

// ===== DOM Elements =====
const elements = {
  dropZone: document.getElementById("dropZone"),
  formatInstructions: document.querySelector(".format-instructions"),
  fastaInput: document.getElementById("fastaInput"),
  selectFileBtn: document.getElementById("selectFileBtn"),
  fileCard: document.getElementById("fileCard"),
  fileName: document.getElementById("fileName"),
  fileSize: document.getElementById("fileSize"),
  fileStats: document.getElementById("fileStats"),
  seqCount: document.getElementById("seqCount"),
  seqLength: document.getElementById("seqLength"),
  hapCount: document.getElementById("hapCount"),
  removeFileBtn: document.getElementById("removeFileBtn"),
  optionsSection: document.getElementById("optionsSection"),
  includeTraits: document.getElementById("includeTraits"),
  biomeConfig: document.getElementById("biomeConfig"),
  biomeList: document.getElementById("biomeList"),
  previewSection: document.getElementById("previewSection"),
  haplotypePreview: document.getElementById("haplotypePreview"),
  traitsPreview: document.getElementById("traitsPreview"),
  actionSection: document.getElementById("actionSection"),
  generateBtn: document.getElementById("generateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  errorDisplay: document.getElementById("errorDisplay"),
  errorMessage: document.getElementById("errorMessage"),
  loadingSpinner: document.getElementById("loadingSpinner"),
  successToast: document.getElementById("successToast"),
  toastMessage: document.getElementById("toastMessage"),
  // Ambiguity modal elements
  ambiguityModal: document.getElementById("ambiguityModal"),
  ambiguityMessage: document.getElementById("ambiguityMessage"),
  countAsDifferencesBtn: document.getElementById("countAsDifferencesBtn"),
  replaceWithMostFrequentBtn: document.getElementById(
    "replaceWithMostFrequentBtn"
  ),
  // Tie resolution modal
  tieModal: document.getElementById("tieModal"),
  tieMessage: document.getElementById("tieMessage"),
  nucleotideButtons: document.querySelectorAll(".nucleotide-btn"),
};

// ===== Initialize =====
function init() {
  setupEventListeners();

  // Toggle biome config visibility
  elements.includeTraits.addEventListener("change", (e) => {
    elements.biomeConfig.style.display = e.target.checked ? "block" : "none";
  });
}

// ===== Event Listeners =====
function setupEventListeners() {
  // File selection
  elements.selectFileBtn.addEventListener("click", () =>
    elements.fastaInput.click()
  );
  elements.dropZone.addEventListener("click", (e) => {
    if (e.target !== elements.selectFileBtn) {
      elements.fastaInput.click();
    }
  });

  // Drag and drop
  elements.dropZone.addEventListener("dragover", handleDragOver);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleDrop);

  // File input change
  elements.fastaInput.addEventListener("change", handleFileSelect);

  // Remove file
  elements.removeFileBtn.addEventListener("click", resetAll);

  // Action buttons
  elements.generateBtn.addEventListener("click", generateNexus);
  elements.resetBtn.addEventListener("click", resetAll);

  // Ambiguity modal buttons
  elements.countAsDifferencesBtn.addEventListener("click", () =>
    handleAmbiguityChoice(true)
  );
  elements.replaceWithMostFrequentBtn.addEventListener("click", () =>
    handleAmbiguityChoice(false)
  );

  // Tie resolution buttons
  elements.nucleotideButtons.forEach((btn) => {
    btn.addEventListener("click", (e) =>
      handleNucleotideChoice(e.target.dataset.nucleotide)
    );
  });
}

// ===== Drag and Drop Handlers =====
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.dropZone.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.dropZone.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.dropZone.classList.remove("drag-over");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    processFile(file);
  }
}

// ===== File Processing =====
async function processFile(file) {
  // Validate file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    showError("Arquivo muito grande. Tamanho máximo: 50MB");
    return;
  }

  // Validate file extension
  const validExtensions = [".fas", ".fasta", ".fa", ".txt"];
  const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!validExtensions.includes(fileExt)) {
    showError("Formato de arquivo inválido. Use arquivos .fas, .fasta ou .fa");
    return;
  }

  showLoading(true);
  hideError();

  try {
    const text = await readFileAsText(file);
    const parsed = parseFasta(text);

    if (!parsed || parsed.sequences.length === 0) {
      throw new Error("Nenhuma sequência válida encontrada no arquivo FASTA");
    }

    // Handle ambiguous characters if present
    if (parsed.hasAmbiguousChars) {
      const shouldCountAsDifferences = await showAmbiguityModal();

      if (!shouldCountAsDifferences) {
        // Replace ambiguous characters with most frequent nucleotides
        await replaceAmbiguousChars(parsed.sequences);
      }
    }

    // Now proceed with haplotype identification and geographic data extraction
    const haplotypes = identifyHaplotypes(parsed.sequences);
    const geoData = extractGeographicData(parsed.sequences, haplotypes);

    const finalParsedData = {
      sequences: parsed.sequences,
      sequenceLength: parsed.sequenceLength,
      haplotypes,
      geoData,
    };

    fastaData = { file, text };
    parsedData = finalParsedData;

    displayFileInfo(file, finalParsedData);
    showLoading(false);
  } catch (error) {
    showLoading(false);
    showError(error.message);
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}

// ===== FASTA Parser =====
function parseFasta(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const sequences = [];
  let currentSeq = null;

  for (const line of lines) {
    if (line.startsWith(">")) {
      if (currentSeq) {
        sequences.push(currentSeq);
      }
      currentSeq = {
        name: line.substring(1).trim(),
        sequence: "",
      };
    } else if (currentSeq) {
      currentSeq.sequence += line.toUpperCase().replace(/\s/g, "");
    }
  }

  if (currentSeq) {
    sequences.push(currentSeq);
  }

  // Validate sequences
  if (sequences.length === 0) {
    throw new Error("Nenhuma sequência encontrada no arquivo");
  }

  // Check sequence lengths
  const firstLength = sequences[0].sequence.length;
  const allSameLength = sequences.every(
    (s) => s.sequence.length === firstLength
  );

  if (!allSameLength) {
    throw new Error(
      "As sequências devem ter o mesmo comprimento (alinhamento necessário)"
    );
  }

  // Validate DNA characters and detect ambiguities
  const validChars = /^[ATCGN-]+$/;
  ambiguousChars = { N: false, gap: false };

  for (const seq of sequences) {
    if (!validChars.test(seq.sequence)) {
      throw new Error(
        `Sequência "${seq.name}" contém caracteres inválidos. Use apenas ATCGN-`
      );
    }

    // Check for ambiguous characters
    if (seq.sequence.includes("N")) ambiguousChars.N = true;
    if (seq.sequence.includes("-")) ambiguousChars.gap = true;
  }

  hasAmbiguousChars = ambiguousChars.N || ambiguousChars.gap;

  return {
    sequences,
    sequenceLength: firstLength,
    hasAmbiguousChars,
    ambiguousChars,
  };
}

// ===== Haplotype Identification =====
function identifyHaplotypes(sequences) {
  const haplotypeMap = new Map();
  const haplotypes = [];
  let hapIndex = 1;

  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i];
    const seqString = seq.sequence;

    if (haplotypeMap.has(seqString)) {
      // Sequence already seen
      const hapId = haplotypeMap.get(seqString);
      haplotypes.find((h) => h.id === hapId).indices.push(i + 1);
      haplotypes.find((h) => h.id === hapId).samples.push(seq.name);
    } else {
      // New haplotype
      const hapId = `H${hapIndex}`;
      haplotypeMap.set(seqString, hapId);
      haplotypes.push({
        id: hapId,
        number: hapIndex,
        sequence: seqString,
        indices: [i + 1],
        samples: [seq.name],
        count: 1,
      });
      hapIndex++;
    }
  }

  // Update counts
  haplotypes.forEach((hap) => {
    hap.count = hap.indices.length;
  });

  return haplotypes;
}

// ===== Geographic Data Extraction =====
function extractGeographicData(sequences, haplotypes) {
  const location01Set = new Set();
  const location02Set = new Set();
  let hasAnyDualLocation = false;

  // First pass: extract all unique locations from sequence names
  sequences.forEach((seq) => {
    const locations = extractLocationsFromName(seq.name);

    if (locations.location01) {
      location01Set.add(locations.location01);
    }

    if (locations.location02) {
      location02Set.add(locations.location02);
      hasAnyDualLocation = true;
    }
  });

  // Convert Sets to sorted Arrays
  const location01List = Array.from(location01Set).sort();
  const location02List = Array.from(location02Set).sort();

  // Determine if we need user selection
  hasDualLocations = hasAnyDualLocation && location02List.length > 0;

  // Build distribution for both location sets
  const buildDistribution = (locationList) => {
    const distribution = {};

    haplotypes.forEach((hap) => {
      distribution[hap.id] = {};
      locationList.forEach((location) => {
        distribution[hap.id][location] = 0;
      });
    });

    sequences.forEach((seq, idx) => {
      const seqIndex = idx + 1;
      const hap = haplotypes.find((h) => h.indices.includes(seqIndex));

      if (hap) {
        const locations = extractLocationsFromName(seq.name);
        const location =
          locationList === location01List
            ? locations.location01
            : locations.location02;

        if (location && locationList.includes(location)) {
          distribution[hap.id][location]++;
        }
      }
    });

    return distribution;
  };

  const distribution01 = buildDistribution(location01List);
  const distribution02 = buildDistribution(location02List);

  // Set default currentBiomes based on detection
  if (hasDualLocations) {
    // Dual location detected - wait for user selection
    currentBiomes = [];
    selectedLocation = null;
  } else {
    // Single location - auto-select location01
    currentBiomes = location01List;
    selectedLocation = "location01";
  }

  return {
    location01: location01List,
    location02: location02List,
    distribution01: distribution01,
    distribution02: distribution02,
    hasDualLocations: hasDualLocations,
    // Legacy compatibility
    biomes: currentBiomes,
    distribution: hasDualLocations ? {} : distribution01,
  };
}

// ===== Extract Locations from Sequence Name =====
function extractLocationsFromName(name) {
  // Expected formats:
  // Nome-Localidade01 → { location01: "Localidade01", location02: null }
  // Nome-Localidade01-Localidade02 → { location01: "Localidade01", location02: "Localidade02" }

  const parts = name.split("-");

  if (parts.length < 2) {
    return { location01: null, location02: null }; // Not enough parts
  }

  const cleanPart = (part) => {
    const cleaned = part
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "")
      .trim();
    return cleaned || null;
  };

  if (parts.length === 2) {
    // Format: Nome-Localidade01
    return {
      location01: cleanPart(parts[1]),
      location02: null,
    };
  } else {
    // Format: Nome-Localidade01-Localidade02 (or more parts)
    return {
      location01: cleanPart(parts[parts.length - 2]),
      location02: cleanPart(parts[parts.length - 1]),
    };
  }
}

// ===== Backward compatibility function =====
function extractBiomeFromName(name) {
  const locations = extractLocationsFromName(name);
  // For backward compatibility, return location02 if available, otherwise location01
  return locations.location02 || locations.location01;
}

// ===== Identify Variable Sites =====
function identifyVariableSites(haplotypes) {
  if (haplotypes.length === 0) return { sites: [], matrix: [] };

  const seqLength = haplotypes[0].sequence.length;
  const variableSites = [];

  // Check each position
  for (let pos = 0; pos < seqLength; pos++) {
    const chars = new Set();
    haplotypes.forEach((hap) => {
      chars.add(hap.sequence[pos]);
    });

    // If more than one unique character, it's a variable site
    if (chars.size > 1) {
      variableSites.push(pos);
    }
  }

  // Create matrix with only variable sites
  const matrix = haplotypes.map((hap) => {
    const variableSeq = variableSites.map((pos) => hap.sequence[pos]).join("");
    return {
      id: hap.id,
      sequence: variableSeq,
    };
  });

  return { sites: variableSites, matrix };
}

// ===== Generate NEXUS File =====
function generateNexus() {
  if (!parsedData) return;

  const outputMode = document.querySelector(
    'input[name="outputMode"]:checked'
  ).value;
  const includeTraits = elements.includeTraits.checked;

  let nexusContent = "#NEXUS\n\n";

  // TAXA block
  nexusContent += "BEGIN TAXA;\n";
  nexusContent += `DIMENSIONS NTAX=${parsedData.haplotypes.length};\n`;
  nexusContent += "TAXLABELS\n";
  parsedData.haplotypes.forEach((hap) => {
    nexusContent += `${hap.id}\n`;
  });
  nexusContent += "\n;\nEND;\n\n";

  // CHARACTERS block
  nexusContent += "BEGIN CHARACTERS;\n";

  if (outputMode === "popart") {
    // PopArt mode: only variable sites
    const variableData = identifyVariableSites(parsedData.haplotypes);
    nexusContent += `DIMENSIONS NCHAR=${variableData.sites.length};\n`;
    nexusContent += "FORMAT DATATYPE=DNA  MISSING=? GAP=- MATCHCHAR=.;\n\n";
    nexusContent += "MATRIX\n";

    // First sequence as reference
    const reference = variableData.matrix[0];
    nexusContent += `${reference.id}\t${reference.sequence}\n`;

    // Subsequent sequences with matchchar
    for (let i = 1; i < variableData.matrix.length; i++) {
      const hap = variableData.matrix[i];
      let compactSeq = "";
      for (let j = 0; j < hap.sequence.length; j++) {
        compactSeq +=
          hap.sequence[j] === reference.sequence[j] ? "." : hap.sequence[j];
      }
      nexusContent += `${hap.id}\t${compactSeq}\n`;
    }
  } else {
    // Complete mode: full sequences
    nexusContent += `DIMENSIONS NCHAR=${parsedData.sequenceLength};\n`;
    nexusContent += "FORMAT DATATYPE=DNA  MISSING=? GAP=-;\n\n";
    nexusContent += "MATRIX\n";

    parsedData.haplotypes.forEach((hap) => {
      nexusContent += `${hap.id}\t${hap.sequence}\n`;
    });
  }

  nexusContent += "\n;\nEND;\n";

  // TRAITS block
  if (includeTraits) {
    nexusContent += "\nBEGIN TRAITS;\n\n";
    nexusContent += `  Dimensions NTRAITS=${currentBiomes.length};\n`;
    nexusContent += "  Format labels=yes missing=? separator=Comma;\n";
    nexusContent += "  TraitLabels " + currentBiomes.join(" ") + " \n\n";
    nexusContent += ";\n";
    nexusContent += "  Matrix\n";

    parsedData.haplotypes.forEach((hap) => {
      const counts = currentBiomes.map((biome) => {
        return parsedData.geoData.distribution[hap.id][biome] || 0;
      });
      nexusContent += `${hap.id}\t${counts.join(",")}\n`;
    });

    nexusContent += "\n\n;\nEND;\n";
  }

  // Download file
  downloadNexus(nexusContent, outputMode);
}

function downloadNexus(content, mode) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const baseName = fastaData.file.name.replace(/\.(fas|fasta|fa|txt)$/i, "");
  const suffix = mode === "popart" ? "_PopArt" : "_Complete";
  a.download = `Nexusficadorinator_${baseName}${suffix}.nex`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Arquivo NEXUS gerado com sucesso!`);
}

// ===== Display File Info =====
function displayFileInfo(file, parsed) {
  // Hide drop zone, show file card
  elements.dropZone.style.display = "none";
  if (elements.formatInstructions)
    elements.formatInstructions.style.display = "none";
  elements.fileCard.style.display = "block";

  // File details
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);

  // Stats
  elements.seqCount.textContent = parsed.sequences.length;
  elements.seqLength.textContent = parsed.sequenceLength;
  elements.hapCount.textContent = parsed.haplotypes.length;
  elements.fileStats.style.display = "flex";

  // Show sections
  elements.optionsSection.style.display = "block";
  elements.previewSection.style.display = "block";
  elements.actionSection.style.display = "block";

  // Enable/disable generate button based on location selection
  updateGenerateButtonState();

  // Render location selection UI
  renderLocationSelection();

  // Update previews
  updatePreviews(parsed);
}

function updatePreviews(parsed) {
  // Haplotype preview (all)
  const hapPreview = parsed.haplotypes
    .map((hap) => {
      return `${hap.id}: ${hap.count} seq(s) - ${hap.samples
        .slice(0, 3)
        .join(", ")}${hap.samples.length > 3 ? "..." : ""}`;
    })
    .join("\n");

  elements.haplotypePreview.textContent = hapPreview;

  // Traits preview (all)
  const traitsPreview = parsed.haplotypes
    .map((hap) => {
      const counts = currentBiomes.map((biome) => {
        return parsed.geoData.distribution[hap.id][biome] || 0;
      });
      return `${hap.id}: ${counts.join(", ")}`;
    })
    .join("\n");

  elements.traitsPreview.textContent = `Localidades: ${currentBiomes.join(
    ", "
  )}\n\n${traitsPreview}`;
}

// ===== Location Selection UI =====
function renderLocationSelection() {
  elements.biomeList.innerHTML = "";

  if (!parsedData || !parsedData.geoData) return;

  const geoData = parsedData.geoData;

  if (geoData.hasDualLocations) {
    // Show dual location selection interface
    const selectionHTML = `
      <div class="location-selection-warning">
        ⚠️ Detectadas duas localidades nos nomes das sequências. Selecione qual lista usar para o bloco TRAITS:
      </div>
      
      <div class="location-options">
        <div class="location-option">
          <label class="location-radio-label">
            <input type="radio" name="locationChoice" value="location01" class="location-radio">
            <span class="location-title">Localidade 01</span>
          </label>
          <div class="location-tags" id="location01Tags"></div>
        </div>
        
        <div class="location-option">
          <label class="location-radio-label">
            <input type="radio" name="locationChoice" value="location02" class="location-radio">
            <span class="location-title">Localidade 02</span>
          </label>
          <div class="location-tags" id="location02Tags"></div>
        </div>
      </div>
    `;

    elements.biomeList.innerHTML = selectionHTML;

    // Render tags for location01
    const location01Container = document.getElementById("location01Tags");
    if (geoData.location01.length > 0) {
      geoData.location01.forEach((loc) => {
        const tag = document.createElement("div");
        tag.className = "biome-tag";
        tag.textContent = loc;
        location01Container.appendChild(tag);
      });
    } else {
      location01Container.innerHTML =
        '<p style="color: var(--text-secondary); font-style: italic;">Nenhuma localidade detectada</p>';
    }

    // Render tags for location02
    const location02Container = document.getElementById("location02Tags");
    if (geoData.location02.length > 0) {
      geoData.location02.forEach((loc) => {
        const tag = document.createElement("div");
        tag.className = "biome-tag";
        tag.textContent = loc;
        location02Container.appendChild(tag);
      });
    } else {
      location02Container.innerHTML =
        '<p style="color: var(--text-secondary); font-style: italic;">Nenhuma localidade detectada</p>';
    }

    // Add event listeners for radio buttons
    document
      .querySelectorAll('input[name="locationChoice"]')
      .forEach((radio) => {
        radio.addEventListener("change", handleLocationSelection);
      });
  } else {
    // Single location - just display the tags
    renderBiomeTags();
  }
}

function handleLocationSelection(e) {
  selectedLocation = e.target.value;

  if (selectedLocation === "location01") {
    currentBiomes = parsedData.geoData.location01;
    parsedData.geoData.distribution = parsedData.geoData.distribution01;
  } else {
    currentBiomes = parsedData.geoData.location02;
    parsedData.geoData.distribution = parsedData.geoData.distribution02;
  }

  parsedData.geoData.biomes = currentBiomes;

  // Update button state and preview
  updateGenerateButtonState();
  updatePreviews(parsedData);
}

function updateGenerateButtonState() {
  if (!parsedData) {
    elements.generateBtn.disabled = true;
    return;
  }

  if (hasDualLocations && !selectedLocation) {
    elements.generateBtn.disabled = true;
    elements.generateBtn.title = "Selecione uma localidade antes de gerar";
  } else {
    elements.generateBtn.disabled = false;
    elements.generateBtn.title = "";
  }
}

// ===== Biome Display (for single location mode) =====
function renderBiomeTags() {
  elements.biomeList.innerHTML = "";

  if (currentBiomes.length === 0) {
    elements.biomeList.innerHTML =
      '<p style="color: var(--text-secondary); font-style: italic;">Nenhuma localidade detectada. Verifique se os nomes das sequências seguem o padrão Nome-Localidade ou Nome-Localidade01-Localidade02.</p>';
    return;
  }

  currentBiomes.forEach((biome) => {
    const tag = document.createElement("div");
    tag.className = "biome-tag";
    tag.textContent = biome;
    elements.biomeList.appendChild(tag);
  });
}

// ===== Utility Functions =====
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function showLoading(show) {
  elements.loadingSpinner.style.display = show ? "flex" : "none";
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorDisplay.style.display = "flex";
  setTimeout(() => {
    elements.errorDisplay.style.display = "none";
  }, 5000);
}

function hideError() {
  elements.errorDisplay.style.display = "none";
}

function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.successToast.style.display = "flex";
  setTimeout(() => {
    elements.successToast.style.display = "none";
  }, 3000);
}

function resetAll() {
  fastaData = null;
  parsedData = null;
  currentBiomes = [];
  selectedLocation = null;
  hasDualLocations = false;
  hasAmbiguousChars = false;
  ambiguousChars = { N: false, gap: false };
  elements.fastaInput.value = "";

  // Reset UI
  elements.dropZone.style.display = "block";
  if (elements.formatInstructions)
    elements.formatInstructions.style.display = "block";
  elements.fileCard.style.display = "none";
  elements.optionsSection.style.display = "none";
  elements.previewSection.style.display = "none";
  elements.actionSection.style.display = "none";

  hideError();
}

// ===== Ambiguity Handling =====
function showAmbiguityModal() {
  return new Promise((resolve) => {
    // Set message based on what was found
    let message = "";
    if (ambiguousChars.N && ambiguousChars.gap) {
      message = "Nucleotídeos N e - encontrados";
    } else if (ambiguousChars.N) {
      message = "Nucleotídeo N encontrado";
    } else if (ambiguousChars.gap) {
      message = "Nucleotídeo - encontrado";
    }

    message += ". Essas posições contam como diferenças válidas?";

    elements.ambiguityMessage.textContent = message;
    elements.ambiguityModal.style.display = "flex";

    // Store resolve function to call later
    window.ambiguityResolve = resolve;
  });
}

function handleAmbiguityChoice(countAsDifferences) {
  elements.ambiguityModal.style.display = "none";
  window.ambiguityResolve(countAsDifferences);
}

// ===== Ambiguous Character Replacement =====
async function replaceAmbiguousChars(sequences) {
  if (sequences.length === 0) return;

  const seqLength = sequences[0].sequence.length;
  const replacementMap = {};

  // For each position, calculate most frequent nucleotide
  for (let pos = 0; pos < seqLength; pos++) {
    const counts = { A: 0, T: 0, C: 0, G: 0 };
    const affectedSequences = [];
    let hasAmbiguous = false;

    // Count valid nucleotides at this position and track affected sequences
    sequences.forEach((seq) => {
      const char = seq.sequence[pos];
      if (char === "N" || char === "-") {
        hasAmbiguous = true;
        affectedSequences.push(seq.name);
      } else if (counts.hasOwnProperty(char)) {
        counts[char]++;
      }
    });

    // Only replace if there are ambiguous characters at this position
    if (hasAmbiguous) {
      const maxCount = Math.max(...Object.values(counts));
      const candidates = Object.keys(counts).filter(
        (nuc) => counts[nuc] === maxCount
      );

      let replacement;
      if (candidates.length === 1) {
        // No tie
        replacement = candidates[0];
      } else {
        // Tie - ask user with more detailed information
        replacement = await showTieModal(
          pos + 1,
          candidates,
          affectedSequences
        );
      }

      replacementMap[pos] = replacement;
    }
  }

  // Apply replacements
  sequences.forEach((seq) => {
    let newSeq = "";
    for (let pos = 0; pos < seqLength; pos++) {
      const char = seq.sequence[pos];
      if ((char === "N" || char === "-") && replacementMap[pos]) {
        newSeq += replacementMap[pos];
      } else {
        newSeq += char;
      }
    }
    seq.sequence = newSeq;
  });
}

function showTieModal(position, candidates, affectedSequences) {
  return new Promise((resolve) => {
    const sequenceList = affectedSequences.slice(0, 3).join(", ");
    const moreCount =
      affectedSequences.length > 3
        ? ` (+${affectedSequences.length - 3} outras)`
        : "";

    elements.tieMessage.textContent = `Empate na posição ${position} (sequência: ${sequenceList}${moreCount}). Qual nucleotídeo usar para substituir N/-?`;

    // Show only candidate buttons
    elements.nucleotideButtons.forEach((btn) => {
      const nucleotide = btn.dataset.nucleotide;
      btn.style.display = candidates.includes(nucleotide)
        ? "inline-block"
        : "none";
    });

    elements.tieModal.style.display = "flex";

    // Store resolve function
    window.tieResolve = resolve;
  });
}

function handleNucleotideChoice(nucleotide) {
  elements.tieModal.style.display = "none";
  window.tieResolve(nucleotide);
}

// ===== Initialize on load =====
document.addEventListener("DOMContentLoaded", init);
