// ===== Global State =====
let fastaData = null;
let parsedData = null;
let network = null;
let canvas = null;
let ctx = null;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let isDraggingNode = false;
let draggedNode = null;
let dragStartX = 0;
let dragStartY = 0;
let hoveredNode = null;
let selectedLocation = null;
let geoData = null;
let originalLayout = null; // Store original node positions
let renderScheduled = false; // Flag to prevent multiple render calls

// Multi-selection and panning state
let selectedNodes = [];
let isSelectingBox = false;
let selectionBoxStart = null;
let selectionBoxEnd = null;
let isSpacePressed = false;
let isPanning = false;

// Node size scaling (only for non-median nodes)
let nodeScale = 1.0;

let customColors = {
  locations: {}, // { locationName: "rgba(...)" }
  median: "rgba(255, 16, 240, 1)",
  edge: "#000000",
  background: "rgba(255, 255, 255, 0)",
  mutation: "rgba(148, 163, 184, 1)",
};

// Pickr instances
let pickrInstances = {
  background: null,
  edge: null,
  median: null,
  mutation: null,
};

// ===== DOM Elements =====
let elements = {};

// ===== Initialize =====
function init() {
  // Initialize DOM elements
  elements = {
    dropZone: document.getElementById("dropZone"),
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
    networkSection: document.getElementById("networkSection"),
    showMutations: document.getElementById("showMutations"),
    mutationToggle: document.getElementById("mutationToggle"),
    mutationColor: document.getElementById("mutationColor"),
    locationConfig: document.getElementById("locationConfig"),
    locationSelection: document.getElementById("locationSelection"),
    medianColor: document.getElementById("medianColor"),
    edgeColor: document.getElementById("edgeColor"),
    backgroundColor: document.getElementById("backgroundColor"),
    generateNetworkBtn: document.getElementById("generateNetworkBtn"),
    exportPNGBtn: document.getElementById("exportPNGBtn"),
    exportSVGBtn: document.getElementById("exportSVGBtn"),
    resetLayoutBtn: document.getElementById("resetLayoutBtn"),
    networkCanvas: document.getElementById("networkCanvas"),
    nodeCount: document.getElementById("nodeCount"),
    edgeCount: document.getElementById("edgeCount"),
    componentCount: document.getElementById("componentCount"),
    legend: document.getElementById("legend"),
    legendContent: document.getElementById("legendContent"),
    loadingSpinner: document.getElementById("loadingSpinner"),
    errorDisplay: document.getElementById("errorDisplay"),
    errorMessage: document.getElementById("errorMessage"),
    successToast: document.getElementById("successToast"),
    toastMessage: document.getElementById("toastMessage"),
    tooltip: document.getElementById("tooltip"),
    tipIcon: document.getElementById("tipIcon"),
    tipContent: document.getElementById("tipContent"),
    nodeSizeSlider: document.getElementById("nodeSizeSlider"),
  };

  canvas = elements.networkCanvas;
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  setupEventListeners();
  resizeCanvas();

  // Node size slider
  if (elements.nodeSizeSlider) {
    elements.nodeSizeSlider.addEventListener("input", (e) => {
      nodeScale = parseFloat(e.target.value);
      if (network) renderNetwork();
    });

    // Prevent space bar from being captured by the slider
    elements.nodeSizeSlider.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        // Blur the slider to return focus to the document
        elements.nodeSizeSlider.blur();
      }
    });
  }
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Tip icon toggle
  if (elements.tipIcon && elements.tipContent) {
    elements.tipIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = elements.tipContent.style.display !== "none";
      elements.tipContent.style.display = isVisible ? "none" : "block";
    });

    // Close tip when clicking outside
    document.addEventListener("click", (e) => {
      if (
        elements.tipContent.style.display === "block" &&
        !elements.tipContent.contains(e.target) &&
        !elements.tipIcon.contains(e.target)
      ) {
        elements.tipContent.style.display = "none";
      }
    });
  }

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

  // File input
  elements.fastaInput.addEventListener("change", handleFileSelect);
  elements.removeFileBtn.addEventListener("click", resetAll);

  // Generate network
  elements.generateNetworkBtn.addEventListener("click", generateNetwork);

  // Mutation toggle button
  elements.mutationToggle.addEventListener("click", () => {
    elements.mutationToggle.classList.toggle("ticks");
    if (network) renderNetwork();
  });

  // Show mutations checkbox
  elements.showMutations.addEventListener("change", () => {
    if (network) renderNetwork();
  });

  // Canvas interactions
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseleave", handleMouseLeave);
  canvas.addEventListener("wheel", handleWheel);

  // Keyboard events for space bar panning
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // Prevent space bar from scrolling the page globally
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
      }
    },
    true
  ); // Use capture phase to catch it early

  // Export buttons
  elements.resetLayoutBtn.addEventListener("click", resetLayout);
  elements.exportPNGBtn.addEventListener("click", exportPNG);
  elements.exportSVGBtn.addEventListener("click", exportSVG);

  // Resize
  window.addEventListener("resize", resizeCanvas);
}

// ===== File Handling =====
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

async function processFile(file) {
  if (file.size > 50 * 1024 * 1024) {
    showError("Arquivo muito grande. Tamanho máximo: 50MB");
    return;
  }

  const validExtensions = [".fas", ".fasta", ".fa", ".txt"];
  const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!validExtensions.includes(fileExt)) {
    showError("Formato inválido. Use .fas, .fasta ou .fa");
    return;
  }

  showLoading(true);
  hideError();

  try {
    const text = await readFileAsText(file);
    const parsed = parseFasta(text);

    if (!parsed || parsed.sequences.length === 0) {
      throw new Error("Nenhuma sequência válida encontrada");
    }

    const haplotypes = identifyHaplotypes(parsed.sequences);
    geoData = analyzeGeoData(parsed.sequences);

    fastaData = { file, text };
    parsedData = {
      sequences: parsed.sequences,
      sequenceLength: parsed.sequenceLength,
      haplotypes,
      geoData,
    };

    displayFileInfo(file, parsedData);
    renderLocationSelection();
    showLoading(false);

    // Scroll to options section
    elements.optionsSection.scrollIntoView({ behavior: "smooth" });
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

function parseFasta(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const sequences = [];
  let currentSeq = null;

  for (const line of lines) {
    if (line.startsWith(">")) {
      if (currentSeq) sequences.push(currentSeq);
      currentSeq = { name: line.substring(1).trim(), sequence: "" };
    } else if (currentSeq) {
      currentSeq.sequence += line.toUpperCase().replace(/\s/g, "");
    }
  }

  if (currentSeq) sequences.push(currentSeq);

  if (sequences.length === 0) {
    throw new Error("Nenhuma sequência encontrada");
  }

  const firstLength = sequences[0].sequence.length;
  const allSameLength = sequences.every(
    (s) => s.sequence.length === firstLength
  );

  if (!allSameLength) {
    throw new Error("Sequências devem ter o mesmo comprimento");
  }

  const validChars = /^[ATCGN-]+$/;
  for (const seq of sequences) {
    if (!validChars.test(seq.sequence)) {
      throw new Error(`Sequência "${seq.name}" contém caracteres inválidos`);
    }
  }

  return { sequences, sequenceLength: firstLength };
}

function identifyHaplotypes(sequences) {
  if (sequences.length === 0) return [];

  const seqLength = sequences[0].sequence.length;
  const validPositions = [];

  // Identify valid positions
  for (let pos = 0; pos < seqLength; pos++) {
    let isValid = true;
    for (const seq of sequences) {
      const char = seq.sequence[pos];
      if (char === "N" || char === "-") {
        isValid = false;
        break;
      }
    }
    if (isValid) {
      validPositions.push(pos);
    }
  }

  const getValidSequence = (sequence) => {
    return validPositions.map((pos) => sequence[pos]).join("");
  };

  const haplotypeMap = new Map();
  const haplotypes = [];
  let hapIndex = 1;

  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i];
    const validSeq = getValidSequence(seq.sequence);

    if (haplotypeMap.has(validSeq)) {
      const hapId = haplotypeMap.get(validSeq);
      const hap = haplotypes.find((h) => h.id === hapId);
      hap.indices.push(i + 1);
      hap.samples.push(seq.name);
    } else {
      const hapId = `H${hapIndex}`;
      haplotypeMap.set(validSeq, hapId);
      haplotypes.push({
        id: hapId,
        number: hapIndex,
        sequence: seq.sequence,
        validSequence: validSeq,
        validPositions: validPositions.length,
        totalPositions: seqLength,
        indices: [i + 1],
        samples: [seq.name],
        count: 1,
      });
      hapIndex++;
    }
  }

  haplotypes.forEach((hap) => {
    hap.count = hap.indices.length;
  });

  return haplotypes;
}

function extractLocationsFromName(name) {
  const parts = name.split("-");

  if (parts.length < 2) {
    return { location01: null, location02: null };
  }

  const cleanPart = (part) => {
    const cleaned = part
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "")
      .trim();
    return cleaned || null;
  };

  if (parts.length === 2) {
    return {
      location01: cleanPart(parts[1]),
      location02: null,
    };
  } else {
    return {
      location01: cleanPart(parts[parts.length - 2]),
      location02: cleanPart(parts[parts.length - 1]),
    };
  }
}

function analyzeGeoData(sequences) {
  const location01Set = new Set();
  const location02Set = new Set();
  let hasDualLocations = false;

  sequences.forEach((seq) => {
    const locations = extractLocationsFromName(seq.name);
    if (locations.location01) location01Set.add(locations.location01);
    if (locations.location02) {
      location02Set.add(locations.location02);
      hasDualLocations = true;
    }
  });

  return {
    location01: Array.from(location01Set),
    location02: Array.from(location02Set),
    hasDualLocations,
  };
}

// ===== Location Selection =====
function renderLocationSelection() {
  if (!parsedData || !geoData) return;

  elements.locationSelection.innerHTML = "";

  if (geoData.hasDualLocations) {
    elements.locationConfig.style.display = "block";

    const selectionHTML = `
      <div class="location-selection-warning">
        ⚠️ Detectadas duas localidades nos nomes das sequências. Selecione qual lista usar:
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
            <input type="radio" name="locationChoice" value="location02" class="location-radio" checked>
            <span class="location-title">Localidade 02</span>
          </label>
          <div class="location-tags" id="location02Tags"></div>
        </div>
      </div>
    `;

    elements.locationSelection.innerHTML = selectionHTML;

    // Default to location02
    selectedLocation = "location02";

    // Render tags for location01
    const location01Container = document.getElementById("location01Tags");
    if (geoData.location01.length > 0) {
      geoData.location01.forEach((loc) => {
        const tag = document.createElement("div");
        tag.className = "location-tag";
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
        tag.className = "location-tag";
        tag.textContent = loc;
        location02Container.appendChild(tag);
      });
    } else {
      location02Container.innerHTML =
        '<p style="color: var(--text-secondary); font-style: italic;">Nenhuma localidade detectada</p>';
    }

    // Add event listeners
    document
      .querySelectorAll('input[name="locationChoice"]')
      .forEach((radio) => {
        radio.addEventListener("change", handleLocationSelection);
      });
  } else if (geoData.location01.length > 0) {
    // Single location detected
    selectedLocation = "location01";
    elements.locationConfig.style.display = "block";

    const tagsHTML = geoData.location01
      .map((loc) => `<div class="location-tag">${loc}</div>`)
      .join("");

    elements.locationSelection.innerHTML = `
      <div class="location-tags">${tagsHTML}</div>
    `;
  } else {
    elements.locationConfig.style.display = "none";
    selectedLocation = null;
  }
}

function handleLocationSelection(e) {
  selectedLocation = e.target.value;

  // If network is already rendered, regenerate with new colors
  if (network) {
    renderNetwork();
    updateLegend();
  }
}

// ===== Display Functions =====
function displayFileInfo(file, parsed) {
  elements.dropZone.style.display = "none";
  elements.fileCard.style.display = "flex";
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);
  elements.seqCount.textContent = parsed.sequences.length;
  elements.seqLength.textContent = parsed.sequenceLength;
  elements.hapCount.textContent = parsed.haplotypes.length;
  elements.fileStats.style.display = "flex";
  elements.optionsSection.style.display = "block";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ===== Network Generation =====
function generateNetwork() {
  if (!parsedData) return;

  showLoading(true);

  setTimeout(() => {
    try {
      const epsilon = 0; // Can be made configurable later

      console.log("🔷 Generating Median-Joining Network");
      console.log(
        "Haplotypes:",
        parsedData.haplotypes.length,
        "Epsilon:",
        epsilon
      );

      network = buildNetwork(parsedData.haplotypes, epsilon);

      console.log("✅ Network generated:", network);
      console.log(
        "Nodes:",
        network.nodes.length,
        "Edges:",
        network.edges.length
      );

      if (network.edges.length === 0) {
        showError("Nenhuma conexão encontrada. Verifique seus dados.");
        showLoading(false);
        return;
      }

      // Show network section FIRST so canvas has dimensions
      elements.networkSection.style.display = "block";

      // Wait for browser to render and calculate dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double RAF to ensure layout is complete
          resizeCanvas();
          console.log("Canvas dimensions:", canvas.width, canvas.height);
          initializeLayout(network);
          console.log("Layout initialized");
          renderNetwork();
          console.log("Network rendered");

          elements.nodeCount.textContent = network.nodes.length;
          elements.edgeCount.textContent = network.edges.length;
          elements.componentCount.textContent = countComponents(network);

          displayLegend();

          showToast("Rede gerada com sucesso!");
          showLoading(false);

          // Scroll to network
          elements.networkSection.scrollIntoView({ behavior: "smooth" });
        });
      });
    } catch (error) {
      console.error("Error generating network:", error);
      showLoading(false);
      showError(error.message);
    }
  }, 100);
}

function buildNetwork(haplotypes, epsilon = 0) {
  const nodes = haplotypes.map((hap, idx) => ({
    id: hap.id,
    label: hap.id,
    index: idx,
    size: Math.max(20, Math.sqrt(hap.count) * 15),
    count: hap.count,
    samples: hap.samples,
    sequence: hap.validSequence,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isMedian: false,
  }));

  return buildMedianJoiningNetwork(nodes, epsilon);
}

// ===== MEDIAN-JOINING NETWORK (MJN) =====
// Based on Bandelt, Forster & Röhl 1999
// Implements full MJN algorithm with quasi-medians and iterative refinement

function buildMedianJoiningNetwork(initialNodes, epsilon = 0) {
  console.log("🔷 Building Median-Joining Network...");
  console.log("Initial haplotypes:", initialNodes.length, "Epsilon:", epsilon);

  let nodes = JSON.parse(JSON.stringify(initialNodes)); // Deep copy
  let allSequences = new Set(nodes.map((n) => n.sequence));
  let medianCounter = 0;
  let iteration = 0;
  const MAX_ITERATIONS = 20;

  let changed = true;

  while (changed && iteration < MAX_ITERATIONS) {
    iteration++;
    changed = false;
    console.log(`\n📍 Iteration ${iteration}:`);

    // 1. Compute distance matrix (includes new medians)
    const distances = computeFullDistanceMatrix(nodes);

    // 2. Build MSN with feasible links
    console.log("  Building MSN...");
    const { edges, feasibleLinks } = computeMSNWithFeasible(
      nodes,
      distances,
      epsilon
    );
    console.log(`  MSN: ${edges.length} edges, ${feasibleLinks.size} feasible`);

    // 3. Remove obsolete vertices (degree < 2, non-sampled)
    const removed = removeObsoleteVertices(nodes, edges);
    if (removed > 0) {
      console.log(`  Removed ${removed} obsolete vertices`);
      changed = true;
      continue; // Restart with cleaner graph
    }

    // 4. Find minimum cost for quasi-medians
    const minCost = findMinimumCost(nodes, edges, distances, allSequences);
    console.log(`  Min cost for new medians: ${minCost}`);

    // 5. Generate quasi-medians from connected triplets
    const newMedians = [];

    // Process only feasible triplets (connected via feasible edges)
    for (const [edgeId1, edge1] of feasibleLinks) {
      const [u_id, v_id] = [edge1.source, edge1.target];
      const u = nodes.find((n) => n.id === u_id);
      const v = nodes.find((n) => n.id === v_id);

      if (!u || !v) continue;

      for (const [edgeId2, edge2] of feasibleLinks) {
        if (edgeId2 <= edgeId1) continue; // Avoid duplicates

        let w = null;
        if (edge2.source === u.id || edge2.source === v.id) {
          w = nodes.find((n) => n.id === edge2.target);
        } else if (edge2.target === u.id || edge2.target === v.id) {
          w = nodes.find((n) => n.id === edge2.source);
        }

        if (!w || w.id === u.id || w.id === v.id) continue;

        // Compute quasi-medians for triplet (u, v, w)
        const quasiMedians = computeQuasiMedians(
          u.sequence,
          v.sequence,
          w.sequence
        );

        for (const medianSeq of quasiMedians) {
          if (!allSequences.has(medianSeq)) {
            const cost = computeMedianCost(
              u.sequence,
              v.sequence,
              w.sequence,
              medianSeq
            );

            if (cost <= minCost + epsilon) {
              newMedians.push({
                sequence: medianSeq,
                cost,
                triplet: [u.id, v.id, w.id],
              });
              allSequences.add(medianSeq);
            }
          }
        }
      }
    }

    // Add new median nodes
    if (newMedians.length > 0) {
      console.log(`  Adding ${newMedians.length} new median vectors`);
      for (const median of newMedians) {
        medianCounter++;
        nodes.push({
          id: `MV${medianCounter}`,
          label: `MV${medianCounter}`,
          index: nodes.length,
          size: 6,
          count: 0,
          samples: [],
          sequence: median.sequence,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          isMedian: true,
        });
      }
      changed = true;
    }
  }

  console.log(`\n✅ MJN converged after ${iteration} iterations`);
  console.log(
    `Final network: ${nodes.length} nodes (${medianCounter} medians)`
  );

  // Final MSN computation
  const distances = computeFullDistanceMatrix(nodes);
  const { edges } = computeMSNWithFeasible(nodes, distances, epsilon);

  // Remove non-feasible edges
  const { feasibleLinks: finalFeasible } = computeMSNWithFeasible(
    nodes,
    distances,
    epsilon
  );
  const finalEdges = edges.filter((_, idx) => finalFeasible.has(idx));

  console.log(`Final edges: ${finalEdges.length}`);

  return { nodes, edges: finalEdges };
}

// ===== Quasi-Median Computation =====
function computeQuasiMedians(seqA, seqB, seqC) {
  const medians = new Set();
  let qmSeq = "";
  let ambiguityPositions = [];

  // Build quasi-median with ambiguities marked
  for (let i = 0; i < seqA.length; i++) {
    const a = seqA[i];
    const b = seqB[i];
    const c = seqC[i];

    if (a === b || a === c) {
      qmSeq += a;
    } else if (b === c) {
      qmSeq += b;
    } else {
      // Ambiguity: all three differ
      qmSeq += "*";
      ambiguityPositions.push({ pos: i, chars: [a, b, c] });
    }
  }

  // No ambiguities: single quasi-median
  if (ambiguityPositions.length === 0) {
    medians.add(qmSeq);
    return medians;
  }

  // Resolve ambiguities by generating all combinations
  // Limit to prevent explosion: max 3^5 = 243 combinations
  if (ambiguityPositions.length > 5) {
    console.warn(
      `Too many ambiguities (${ambiguityPositions.length}), using only first 5`
    );
    ambiguityPositions = ambiguityPositions.slice(0, 5);
  }

  const numCombinations = Math.pow(3, ambiguityPositions.length);

  for (let i = 0; i < numCombinations; i++) {
    let seq = qmSeq;
    let combo = i;

    for (let j = ambiguityPositions.length - 1; j >= 0; j--) {
      const choice = combo % 3;
      combo = Math.floor(combo / 3);
      const char = ambiguityPositions[j].chars[choice];
      const pos = ambiguityPositions[j].pos;
      seq = seq.substring(0, pos) + char + seq.substring(pos + 1);
    }

    medians.add(seq);
  }

  return medians;
}

// ===== Median Cost Computation =====
function computeMedianCost(seqU, seqV, seqW, median) {
  return (
    hammingDistance(seqU, median) +
    hammingDistance(seqV, median) +
    hammingDistance(seqW, median)
  );
}

// ===== Minimum Spanning Network with Feasible Links =====
function computeMSNWithFeasible(nodes, distances, epsilon) {
  const n = nodes.length;
  const edges = [];
  const feasibleLinks = new Map();

  // MSN components (Union-Find)
  const msnComp = Array(n)
    .fill(0)
    .map((_, i) => i);

  // Threshold graph components
  const thresholdComp = Array(n)
    .fill(0)
    .map((_, i) => i);

  // Collect all pairs with distances
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({ i, j, dist: distances[i][j] });
    }
  }

  // Sort by distance
  pairs.sort((a, b) => a.dist - b.dist);

  let ncomps = n;
  let maxValue = Infinity;

  for (const { i, j, dist } of pairs) {
    if (dist > maxValue) break;

    // Update threshold graph components (dist < threshold - epsilon)
    for (let u = 0; u < n; u++) {
      for (let v = u + 1; v < n; v++) {
        if (
          thresholdComp[u] !== thresholdComp[v] &&
          distances[u][v] < dist - epsilon
        ) {
          const oldComp = Math.max(thresholdComp[u], thresholdComp[v]);
          const newComp = Math.min(thresholdComp[u], thresholdComp[v]);

          for (let k = 0; k < n; k++) {
            if (thresholdComp[k] === oldComp) {
              thresholdComp[k] = newComp;
            } else if (thresholdComp[k] > oldComp) {
              thresholdComp[k]--;
            }
          }
        }
      }
    }

    // Add edge to MSN
    const edgeId = edges.length;
    edges.push({
      source: nodes[i].id,
      target: nodes[j].id,
      distance: dist,
    });

    // Mark as feasible if connects different threshold components
    if (thresholdComp[i] !== thresholdComp[j]) {
      feasibleLinks.set(edgeId, edges[edgeId]);
    }

    // Update MSN components
    const compI = findRoot(msnComp, i);
    const compJ = findRoot(msnComp, j);

    if (compI !== compJ) {
      const oldComp = Math.max(compI, compJ);
      const newComp = Math.min(compI, compJ);

      for (let k = 0; k < n; k++) {
        const root = findRoot(msnComp, k);
        if (root === oldComp) {
          msnComp[k] = newComp;
        } else if (root > oldComp) {
          msnComp[k]--;
        }
      }

      ncomps--;
    }

    // Stop when MSN is connected
    if (ncomps === 1 && maxValue === Infinity) {
      maxValue = dist + epsilon;
    }
  }

  return { edges, feasibleLinks };
}

function findRoot(comp, i) {
  while (comp[i] !== i && comp[comp[i]] !== comp[i]) {
    i = comp[i];
  }
  return comp[i];
}

// ===== Remove Obsolete Vertices =====
function removeObsoleteVertices(nodes, edges) {
  const originalCount = nodes.length;

  // Build adjacency list to compute degrees
  const degree = new Map();
  nodes.forEach((n) => degree.set(n.id, 0));

  edges.forEach((edge) => {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  });

  // Remove median nodes with degree < 2
  const toRemove = [];
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.isMedian && (degree.get(node.id) || 0) < 2) {
      toRemove.push(i);
    }
  }

  // Remove in reverse order to preserve indices
  toRemove.forEach((idx) => nodes.splice(idx, 1));

  // Remove edges connected to removed nodes
  const remainingIds = new Set(nodes.map((n) => n.id));
  edges.splice(
    0,
    edges.length,
    ...edges.filter(
      (e) => remainingIds.has(e.source) && remainingIds.has(e.target)
    )
  );

  return originalCount - nodes.length;
}

// ===== Find Minimum Cost =====
function findMinimumCost(nodes, edges, distances, allSequences) {
  let minCost = Infinity;

  // Build adjacency for quick neighbor lookup
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    adj.get(e.source).push(e.target);
    adj.get(e.target).push(e.source);
  });

  // Sample triplets to find minimum cost
  for (let i = 0; i < Math.min(nodes.length, 50); i++) {
    const u = nodes[i];
    const neighbors = adj.get(u.id) || [];

    for (let j = 0; j < Math.min(neighbors.length, 10); j++) {
      const v = nodes.find((n) => n.id === neighbors[j]);
      if (!v) continue;

      const vNeighbors = adj.get(v.id) || [];
      for (let k = 0; k < Math.min(vNeighbors.length, 10); k++) {
        const w = nodes.find((n) => n.id === vNeighbors[k]);
        if (!w || w.id === u.id) continue;

        const quasiMedians = computeQuasiMedians(
          u.sequence,
          v.sequence,
          w.sequence
        );
        for (const median of quasiMedians) {
          if (!allSequences.has(median)) {
            const cost = computeMedianCost(
              u.sequence,
              v.sequence,
              w.sequence,
              median
            );
            minCost = Math.min(minCost, cost);
          }
        }
      }
    }
  }

  return minCost === Infinity ? 0 : minCost;
}

// ===== Full Distance Matrix =====
function computeFullDistanceMatrix(nodes) {
  const n = nodes.length;
  const matrix = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = hammingDistance(nodes[i].sequence, nodes[j].sequence);
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
}

function computeDistanceMatrix(haplotypes) {
  const edges = [];
  const componentIDs = nodes.map((_, i) => i);
  const distanceMatrix = computeDistanceMatrix(haplotypes);

  console.log("Building TCS network:", {
    numHaplotypes: haplotypes.length,
  });

  // Group pairs by distance (all pairs, no limit)
  const pairsByDistance = new Map();

  for (let i = 0; i < haplotypes.length; i++) {
    for (let j = i + 1; j < haplotypes.length; j++) {
      const dist = distanceMatrix[i][j];
      if (!pairsByDistance.has(dist)) {
        pairsByDistance.set(dist, []);
      }
      pairsByDistance.get(dist).push([i, j]);
    }
  }

  // Show distance distribution
  const sortedDists = Array.from(pairsByDistance.entries()).sort(
    (a, b) => a[0] - b[0]
  );
  console.log("Distance distribution (first 20):");
  sortedDists.slice(0, 20).forEach(([d, pairs]) => {
    console.log(`  ${d} mutações: ${pairs.length} pares`);
  });

  console.log(`Processing ${sortedDists.length} distance levels...`);

  // Sort distances
  const sortedDistances = Array.from(pairsByDistance.keys()).sort(
    (a, b) => a - b
  );

  // Process pairs by increasing distance
  for (const dist of sortedDistances) {
    const pairs = pairsByDistance.get(dist);
    let compA = -1,
      compB = -1;

    for (const [i, j] of pairs) {
      const compI = findComponent(componentIDs, i);
      const compJ = findComponent(componentIDs, j);

      // Skip if already in same component
      if (compI === compJ) continue;

      // Ensure compI < compJ
      let [u, v] = compI < compJ ? [i, j] : [j, i];
      const [compU, compV] = compI < compJ ? [compI, compJ] : [compJ, compI];

      // Set first pair of this distance level
      if (compA < 0) {
        compA = compU;
        compB = compV;
      }

      // Only connect pairs between same components
      if (compU === compA && compV === compB) {
        if (dist === 1) {
          console.log("Creating direct edge:", nodes[u].id, "→", nodes[v].id);
          edges.push({
            source: nodes[u].id,
            target: nodes[v].id,
            distance: 1,
          });
        } else {
          // Create intermediate median vectors
          const medians = createMedianPath(nodes, u, v, dist);
          medians.forEach((edge) => edges.push(edge));
        }
      }
    }

    // Merge components
    if (compA >= 0) {
      mergeComponents(componentIDs, compA, compB);
    }
  }

  console.log("TCS network built:", {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    edges: edges.slice(0, 5), // First 5 edges for debug
  });

  // Count components to check connectivity
  const numComponents = new Set(
    componentIDs.map((_, i) => findComponent(componentIDs, i))
  ).size;
  console.log(`Network has ${numComponents} disconnected components`);

  if (edges.length === 0) {
    console.warn("⚠️ NENHUMA ARESTA FOI CRIADA! Possíveis causas:");
    console.warn("  - Distância máxima muito baixa para o seu dataset");
    console.warn("  - Haplótipos muito distantes entre si");
    console.warn(
      "  - Sugestão: Aumente a 'Distância máxima' ou use algoritmo MST"
    );
  } else if (numComponents > 1) {
    console.warn(`⚠️ Rede tem ${numComponents} componentes desconectados!`);
    console.warn(
      `  - Aumente a 'Distância máxima' para conectar mais haplótipos`
    );
    console.warn(`  - Ou use o algoritmo MST que garante uma rede conectada`);
  }

  return { nodes, edges };
}

function findComponent(componentIDs, index) {
  let root = index;
  while (componentIDs[root] !== root) {
    root = componentIDs[root];
  }

  // Path compression
  let current = index;
  while (componentIDs[current] !== root) {
    const next = componentIDs[current];
    componentIDs[current] = root;
    current = next;
  }

  return root;
}

function mergeComponents(componentIDs, compA, compB) {
  for (let i = 0; i < componentIDs.length; i++) {
    const comp = findComponent(componentIDs, i);
    if (comp === compB) {
      componentIDs[i] = compA;
    }
  }
}

function createMedianPath(nodes, startIdx, endIdx, distance) {
  const edges = [];
  const startNode = nodes[startIdx];
  const endNode = nodes[endIdx];

  // Create intermediate median vectors
  let prevId = startNode.id;

  for (let step = 1; step < distance; step++) {
    // Create median node
    const medianId = `MV${nodes.length}_${step}`;
    const medianNode = {
      id: medianId,
      label: "",
      index: nodes.length,
      size: 8, // Smaller size for median vectors
      count: 0,
      samples: [],
      sequence: interpolateSequence(
        startNode.sequence,
        endNode.sequence,
        step / distance
      ),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      isMedian: true,
    };

    nodes.push(medianNode);

    edges.push({
      source: prevId,
      target: medianId,
      distance: 1,
    });

    prevId = medianId;
  }

  // Final edge to end node
  edges.push({
    source: prevId,
    target: endNode.id,
    distance: 1,
  });

  return edges;
}

function interpolateSequence(seq1, seq2, fraction) {
  // Simple interpolation: favor seq1 early, seq2 later
  let result = "";
  for (let i = 0; i < seq1.length; i++) {
    if (seq1[i] === seq2[i]) {
      result += seq1[i];
    } else {
      result += Math.random() < fraction ? seq2[i] : seq1[i];
    }
  }
  return result;
}

function hammingDistance(seq1, seq2) {
  let distance = 0;
  for (let i = 0; i < seq1.length; i++) {
    if (seq1[i] !== seq2[i]) distance++;
  }
  return distance;
}

function countComponents(network) {
  const visited = new Set();
  let components = 0;

  const adjacency = new Map();
  network.nodes.forEach((node) => adjacency.set(node.id, []));
  network.edges.forEach((edge) => {
    adjacency.get(edge.source).push(edge.target);
    adjacency.get(edge.target).push(edge.source);
  });

  function dfs(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    adjacency.get(nodeId).forEach((neighbor) => dfs(neighbor));
  }

  network.nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      components++;
      dfs(node.id);
    }
  });

  return components;
}

// ===== Layout =====
// Improved force-directed layout based on Tunkelang (PopART's approach)
function initializeLayout(network) {
  // Ensure canvas has proper dimensions
  resizeCanvas();

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) * 0.6;

  console.log("Canvas center:", centerX, centerY, "Radius:", radius);

  // Initial circular layout
  network.nodes.forEach((node, i) => {
    const angle = (i / network.nodes.length) * 2 * Math.PI;
    node.x = centerX + radius * Math.cos(angle);
    node.y = centerY + radius * Math.sin(angle);
    node.vx = 0;
    node.vy = 0;
  });

  // Build adjacency map for faster lookups
  const adjacency = new Map();
  network.nodes.forEach((node) => adjacency.set(node.id, []));
  network.edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source).push(edge.target);
    adjacency.get(edge.target).push(edge.source);
  });

  // Force-directed layout with adaptive parameters
  const EDGE_LENGTH = 80; // Ideal edge length
  const REPULSION_STRENGTH = 8000;
  const ATTRACTION_STRENGTH = 0.05;
  const DAMPING = 0.85;
  const MAX_ITERATIONS = 150;
  const CONVERGENCE_THRESHOLD = 0.5;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let maxDisplacement = 0;

    // Apply repulsive forces (Coulomb's law)
    for (let i = 0; i < network.nodes.length; i++) {
      network.nodes[i].fx = 0;
      network.nodes[i].fy = 0;

      for (let j = 0; j < network.nodes.length; j++) {
        if (i === j) continue;

        const nodeA = network.nodes[i];
        const nodeB = network.nodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

        // Stronger repulsion for closer nodes
        const repulsionForce = REPULSION_STRENGTH / (dist * dist);
        nodeA.fx -= (dx / dist) * repulsionForce;
        nodeA.fy -= (dy / dist) * repulsionForce;
      }
    }

    // Apply attractive forces along edges (Hooke's law)
    network.edges.forEach((edge) => {
      const source = network.nodes.find((n) => n.id === edge.source);
      const target = network.nodes.find((n) => n.id === edge.target);

      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

      // Spring force proportional to edge weight
      const idealLength = EDGE_LENGTH * edge.distance;
      const displacement = dist - idealLength;
      const attractionForce = ATTRACTION_STRENGTH * displacement;

      const fx = (dx / dist) * attractionForce;
      const fy = (dy / dist) * attractionForce;

      source.fx += fx;
      source.fy += fy;
      target.fx -= fx;
      target.fy -= fy;
    });

    // Update positions with velocity and damping
    network.nodes.forEach((node) => {
      node.vx = (node.vx + node.fx) * DAMPING;
      node.vy = (node.vy + node.fy) * DAMPING;

      // Limit maximum velocity
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      const maxSpeed = 15;
      if (speed > maxSpeed) {
        node.vx = (node.vx / speed) * maxSpeed;
        node.vy = (node.vy / speed) * maxSpeed;
      }

      node.x += node.vx;
      node.y += node.vy;

      maxDisplacement = Math.max(
        maxDisplacement,
        Math.abs(node.vx),
        Math.abs(node.vy)
      );
    });

    // Check for convergence
    if (maxDisplacement < CONVERGENCE_THRESHOLD) {
      console.log(`Layout converged at iteration ${iteration}`);
      break;
    }
  }

  // Center the network in canvas
  centerNetwork(network);

  // Save original layout for reset functionality
  saveOriginalLayout(network);

  // Initialize zoom/pan
  scale = 1;
  offsetX = 0;
  offsetY = 0;
}

function saveOriginalLayout(network) {
  originalLayout = network.nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
  }));
}

function centerNetwork(network) {
  if (network.nodes.length === 0) return;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  network.nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const networkCenterX = (minX + maxX) / 2;
  const networkCenterY = (minY + maxY) / 2;
  const canvasCenterX = canvas.width / 2;
  const canvasCenterY = canvas.height / 2;

  const offsetX = canvasCenterX - networkCenterX;
  const offsetY = canvasCenterY - networkCenterY;

  network.nodes.forEach((node) => {
    node.x += offsetX;
    node.y += offsetY;
  });
}

// ===== Rendering =====
function renderNetwork() {
  if (!network || !ctx) {
    console.error("Cannot render: network or ctx is null");
    return;
  }

  // Prevent multiple render calls in the same frame
  if (renderScheduled) return;
  renderScheduled = true;

  requestAnimationFrame(() => {
    renderScheduled = false;
    doRender();
  });
}

function doRender() {
  if (!network || !ctx) return;

  // ALWAYS clear the canvas first to prevent ghosting
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Then apply background color (already in rgba format)
  ctx.fillStyle = customColors.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw edges
  network.edges.forEach((edge, idx) => {
    const source = network.nodes.find((n) => n.id === edge.source);
    const target = network.nodes.find((n) => n.id === edge.target);

    if (!source || !target) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = customColors.edge;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw mutation count or ticks
    if (elements.showMutations.checked && edge.distance > 0) {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;

      if (elements.mutationToggle.classList.contains("ticks")) {
        // Draw ticks perpendicular to edge
        drawMutationTicks(ctx, source, target, edge.distance);
      } else {
        // Draw number
        ctx.fillStyle = customColors.mutation;
        ctx.font = "12px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(edge.distance.toString(), midX, midY);
      }
    }
  });

  // Draw nodes
  network.nodes.forEach((node) => {
    const isBeingDragged = isDraggingNode && draggedNode === node;
    const isSelected = selectedNodes.includes(node);

    // Apply nodeScale only to non-median nodes
    const effectiveSize = node.isMedian ? node.size : node.size * nodeScale;

    // Check if node has multiple locations (for pie chart)
    const locationData = getNodeLocationData(node);

    if (locationData.multipleLocations) {
      // Draw pie chart for nodes with multiple locations
      const scaledNode = { ...node, size: effectiveSize };
      drawPieChartNode(ctx, scaledNode, locationData, isBeingDragged);
    } else {
      // Draw solid color node
      const color = getNodeColor(node);

      ctx.beginPath();
      ctx.arc(node.x, node.y, effectiveSize, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Different styling for median vectors vs observed haplotypes
      if (node.isMedian) {
        // Median vectors: small black circles
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
      } else {
        // Observed haplotypes: border uses customColors.edge
        const isHighlighted = hoveredNode === node || isBeingDragged;
        ctx.strokeStyle = isHighlighted ? "#f1f5f9" : customColors.edge;
        ctx.lineWidth = isHighlighted ? 3 : 2;
      }
      ctx.stroke();

      // Add glow effect when dragging
      if (isBeingDragged) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(node.x, node.y, effectiveSize, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Draw selection highlight
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, effectiveSize + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ffc107";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Draw label only for non-median nodes
    if (!node.isMedian && node.label) {
      const fontSize = 14 * nodeScale; // Scale font with node size
      ctx.fillStyle = customColors.edge;
      ctx.font = `bold ${fontSize}px Inter`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y);
    }
  });

  // Draw selection box
  if (isSelectingBox && selectionBoxStart && selectionBoxEnd) {
    const minX = Math.min(selectionBoxStart.x, selectionBoxEnd.x);
    const minY = Math.min(selectionBoxStart.y, selectionBoxEnd.y);
    const width = Math.abs(selectionBoxEnd.x - selectionBoxStart.x);
    const height = Math.abs(selectionBoxEnd.y - selectionBoxStart.y);

    ctx.strokeStyle = "#ffc107";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(minX, minY, width, height);

    ctx.fillStyle = "rgba(255, 193, 7, 0.1)";
    ctx.fillRect(minX, minY, width, height);
    ctx.setLineDash([]);
  }

  ctx.restore();
  console.log("Network rendered successfully");
}

// ===== Node Location Data =====
function getNodeLocationData(node) {
  if (node.isMedian || !node.samples || node.samples.length === 0) {
    return { multipleLocations: false, locations: {} };
  }

  if (!geoData || !selectedLocation) {
    return { multipleLocations: false, locations: {} };
  }

  // Count samples per location
  const locationCounts = {};

  node.samples.forEach((sampleName) => {
    const locations = extractLocationsFromName(sampleName);
    const location =
      selectedLocation === "location01"
        ? locations.location01
        : locations.location02;

    if (location) {
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    }
  });

  const uniqueLocations = Object.keys(locationCounts);

  return {
    multipleLocations: uniqueLocations.length > 1,
    locations: locationCounts,
    total: node.samples.length,
  };
}

// ===== Draw Mutation Ticks =====
function drawMutationTicks(ctx, source, target, mutationCount) {
  // Calculate edge midpoint
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  // Calculate edge direction
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Calculate perpendicular direction (rotated 90 degrees)
  const perpX = -dy / length;
  const perpY = dx / length;

  // Tick parameters
  const tickLength = 8;
  const tickSpacing = 5;

  // Calculate total width of all ticks
  const totalWidth = (mutationCount - 1) * tickSpacing;

  // Draw ticks centered at midpoint
  ctx.strokeStyle = customColors.mutation;
  ctx.lineWidth = 1.5;

  for (let i = 0; i < mutationCount; i++) {
    // Calculate offset from center
    const offset = (i - (mutationCount - 1) / 2) * tickSpacing;

    // Calculate tick center position along the edge
    const tickCenterX = midX + (dx / length) * offset;
    const tickCenterY = midY + (dy / length) * offset;

    // Calculate tick endpoints perpendicular to edge
    const x1 = tickCenterX - perpX * (tickLength / 2);
    const y1 = tickCenterY - perpY * (tickLength / 2);
    const x2 = tickCenterX + perpX * (tickLength / 2);
    const y2 = tickCenterY + perpY * (tickLength / 2);

    // Draw tick
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// ===== Draw Pie Chart Node =====
function drawPieChartNode(ctx, node, locationData, isBeingDragged = false) {
  const { locations, total } = locationData;
  const locationList =
    selectedLocation === "location01" ? geoData.location01 : geoData.location02;

  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f59e0b",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
  ];

  // Sort locations by count for consistent rendering
  const sortedLocations = Object.entries(locations).sort((a, b) => b[1] - a[1]);

  let startAngle = -Math.PI / 2; // Start at top

  sortedLocations.forEach(([location, count]) => {
    const proportion = count / total;
    const endAngle = startAngle + proportion * 2 * Math.PI;

    // Use custom color if available
    let color = customColors.locations[location];

    if (!color) {
      // Fallback to default colors
      const locationIndex = locationList.indexOf(location);
      const defaultColors = [
        "#6366f1",
        "#8b5cf6",
        "#ec4899",
        "#f43f5e",
        "#f59e0b",
        "#10b981",
        "#14b8a6",
        "#06b6d4",
        "#3b82f6",
        "#6366f1",
      ];
      color =
        locationIndex >= 0
          ? defaultColors[locationIndex % defaultColors.length]
          : "#6366f1";
    }

    // Draw pie slice
    ctx.beginPath();
    ctx.moveTo(node.x, node.y);
    ctx.arc(node.x, node.y, node.size, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle = endAngle;
  });

  // Draw border
  const isHighlighted = hoveredNode === node || isBeingDragged;
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
  ctx.strokeStyle = isHighlighted ? "#f1f5f9" : "#1e293b";
  ctx.lineWidth = isHighlighted ? 3 : 2;
  ctx.stroke();

  // Add glow effect when dragging
  if (isBeingDragged) {
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function getNodeColor(node) {
  // Median vectors use custom median color
  if (node.isMedian) {
    return customColors.median;
  }

  if (!geoData || !selectedLocation) {
    return "#6366f1";
  }

  // No samples means it's a median vector
  if (!node.samples || node.samples.length === 0) {
    return customColors.median;
  }

  // Extract location from first sample
  const firstSample = node.samples[0];
  const locations = extractLocationsFromName(firstSample);
  const location =
    selectedLocation === "location01"
      ? locations.location01
      : locations.location02;

  if (!location) return "#6366f1";

  // Use custom color if available, otherwise use default
  if (customColors.locations[location]) {
    return customColors.locations[location];
  }

  // Fallback to default colors
  const locationList =
    selectedLocation === "location01" ? geoData.location01 : geoData.location02;

  const locationIndex = locationList.indexOf(location);
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f59e0b",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
  ];

  return locationIndex >= 0 ? colors[locationIndex % colors.length] : "#6366f1";
}

function displayLegend() {
  if (!geoData || !selectedLocation) {
    elements.legend.style.display = "none";
    disableGlobalColorPickers();
    return;
  }

  const locationList =
    selectedLocation === "location01" ? geoData.location01 : geoData.location02;

  if (locationList.length === 0) {
    elements.legend.style.display = "none";
    disableGlobalColorPickers();
    return;
  }

  elements.legendContent.innerHTML = "";

  const defaultColors = [
    "rgba(99, 102, 241, 1)",
    "rgba(139, 92, 246, 1)",
    "rgba(236, 72, 153, 1)",
    "rgba(244, 63, 94, 1)",
    "rgba(245, 158, 11, 1)",
    "rgba(16, 185, 129, 1)",
    "rgba(20, 184, 166, 1)",
    "rgba(6, 182, 212, 1)",
    "rgba(59, 130, 246, 1)",
    "rgba(99, 102, 241, 1)",
  ];

  locationList.forEach((location, i) => {
    // Initialize color if not set
    if (!customColors.locations[location]) {
      customColors.locations[location] =
        defaultColors[i % defaultColors.length];
    }

    const item = document.createElement("div");
    item.className = "legend-item";

    // Create container for Pickr
    const pickerContainer = document.createElement("div");
    pickerContainer.className = "location-color-picker";
    pickerContainer.id = `location-picker-${i}`;

    const label = document.createElement("span");
    label.textContent = location;

    item.appendChild(pickerContainer);
    item.appendChild(label);
    elements.legendContent.appendChild(item);

    // Create Pickr instance for this location
    const pickr = Pickr.create({
      el: `#location-picker-${i}`,
      theme: "monolith",
      position: "top-middle",
      default: customColors.locations[location],
      defaultRepresentation: "HEXA",
      components: {
        preview: true,
        opacity: true,
        hue: true,
        interaction: {
          hex: true,
          rgba: true,
          input: true,
          save: false,
        },
      },
    });

    pickr.on("change", (color) => {
      if (color) {
        customColors.locations[location] = color.toRGBA().toString();
        // Atualizar a cor do botão em tempo real
        pickr.applyColor(true);
        if (network) renderNetwork();
      }
    });

    // Inicializar com a cor atual
    pickr.setColor(customColors.locations[location], true);
  });

  elements.legend.style.display = "block";
  enableGlobalColorPickers();
}

function enableGlobalColorPickers() {
  // Destroy old instances if they exist
  if (pickrInstances.background) pickrInstances.background.destroyAndRemove();
  if (pickrInstances.edge) pickrInstances.edge.destroyAndRemove();
  if (pickrInstances.median) pickrInstances.median.destroyAndRemove();
  if (pickrInstances.mutation) pickrInstances.mutation.destroyAndRemove();

  // Create Pickr instance for background color
  pickrInstances.background = Pickr.create({
    el: "#backgroundColor",
    theme: "monolith",
    position: "top-middle",
    default: customColors.background,
    defaultRepresentation: "HEXA",
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        hex: true,
        rgba: true,
        input: true,
        save: false,
      },
    },
  });

  pickrInstances.background.on("change", (color) => {
    if (color) {
      customColors.background = color.toRGBA().toString();
      // Atualizar a cor do botão em tempo real
      pickrInstances.background.applyColor(true);
      if (network) renderNetwork();
    }
  });

  // Inicializar com a cor atual
  pickrInstances.background.setColor(customColors.background, true);

  // Create Pickr instance for edge color
  pickrInstances.edge = Pickr.create({
    el: "#edgeColor",
    theme: "monolith",
    position: "top-middle",
    default: customColors.edge,
    defaultRepresentation: "HEXA",
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        hex: true,
        rgba: true,
        input: true,
        save: false,
      },
    },
  });

  pickrInstances.edge.on("change", (color) => {
    if (color) {
      customColors.edge = color.toRGBA().toString();
      // Atualizar a cor do botão em tempo real
      pickrInstances.edge.applyColor(true);
      if (network) renderNetwork();
    }
  });

  // Inicializar com a cor atual
  pickrInstances.edge.setColor(customColors.edge, true);

  // Create Pickr instance for median color
  pickrInstances.median = Pickr.create({
    el: "#medianColor",
    theme: "monolith",
    position: "top-middle",
    default: customColors.median,
    defaultRepresentation: "HEXA",
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        hex: true,
        rgba: true,
        input: true,
        save: false,
      },
    },
  });

  pickrInstances.median.on("change", (color) => {
    if (color) {
      customColors.median = color.toRGBA().toString();
      // Atualizar a cor do botão em tempo real
      pickrInstances.median.applyColor(true);
      if (network) renderNetwork();
    }
  });

  // Inicializar com a cor atual
  pickrInstances.median.setColor(customColors.median, true);

  // Create Pickr instance for mutation color
  pickrInstances.mutation = Pickr.create({
    el: "#mutationColor",
    theme: "monolith",
    position: "top-middle",
    default: customColors.mutation,
    defaultRepresentation: "HEXA",
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        hex: true,
        rgba: true,
        input: true,
        save: false,
      },
    },
  });

  pickrInstances.mutation.on("change", (color) => {
    if (color) {
      customColors.mutation = color.toRGBA().toString();
      // Atualizar a cor do botão em tempo real
      pickrInstances.mutation.applyColor(true);
      if (network) renderNetwork();
    }
  });

  // Inicializar com a cor atual
  pickrInstances.mutation.setColor(customColors.mutation, true);
}

function disableGlobalColorPickers() {
  // Destroy Pickr instances
  if (pickrInstances.background) {
    pickrInstances.background.destroyAndRemove();
    pickrInstances.background = null;
  }
  if (pickrInstances.edge) {
    pickrInstances.edge.destroyAndRemove();
    pickrInstances.edge = null;
  }
  if (pickrInstances.median) {
    pickrInstances.median.destroyAndRemove();
    pickrInstances.median = null;
  }
  if (pickrInstances.mutation) {
    pickrInstances.mutation.destroyAndRemove();
    pickrInstances.mutation = null;
  }
}

function updateLegend() {
  displayLegend();
}

// ===== Canvas Interactions =====
function resizeCanvas() {
  if (!canvas) return;
  const container = canvas.parentElement;
  if (!container) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  console.log("Canvas resized to:", canvas.width, canvas.height);

  if (network) {
    renderNetwork();
  }
}

function handleMouseDown(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - offsetX) / scale;
  const y = (e.clientY - rect.top - offsetY) / scale;

  hoveredNode = getNodeAtPosition(x, y);

  // Panning mode (space pressed)
  if (isSpacePressed) {
    isPanning = true;
    dragStartX = e.clientX - offsetX;
    dragStartY = e.clientY - offsetY;
    canvas.style.cursor = "grabbing";
    return;
  }

  // Clicked on a node
  if (hoveredNode) {
    if (e.shiftKey) {
      // Shift + click: toggle node selection
      const index = selectedNodes.indexOf(hoveredNode);
      if (index > -1) {
        selectedNodes.splice(index, 1);
      } else {
        selectedNodes.push(hoveredNode);
      }
      renderNetwork();
    } else {
      // Regular click on node
      if (!selectedNodes.includes(hoveredNode)) {
        // If clicking on unselected node, select only this one
        selectedNodes = [hoveredNode];
      }
      // Start dragging node(s)
      isDraggingNode = true;
      draggedNode = hoveredNode;
      dragStartX = x;
      dragStartY = y;
      canvas.style.cursor = "grabbing";
    }
  } else {
    // Clicked on empty space
    if (!e.shiftKey) {
      // Clear selection if not holding shift
      selectedNodes = [];
    }
    // Start selection box
    isSelectingBox = true;
    selectionBoxStart = { x, y };
    selectionBoxEnd = { x, y };
    renderNetwork();
  }
}

function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - offsetX) / scale;
  const y = (e.clientY - rect.top - offsetY) / scale;

  // Panning the network
  if (isPanning) {
    e.preventDefault();
    offsetX = e.clientX - dragStartX;
    offsetY = e.clientY - dragStartY;
    renderNetwork();
    return;
  }

  // Dragging node(s)
  if (isDraggingNode && draggedNode) {
    e.preventDefault();
    const dx = x - dragStartX;
    const dy = y - dragStartY;

    // Move all selected nodes
    selectedNodes.forEach((node) => {
      node.x += dx;
      node.y += dy;
    });

    dragStartX = x;
    dragStartY = y;
    renderNetwork();
    hideTooltip();
    return;
  }

  // Drawing selection box
  if (isSelectingBox) {
    e.preventDefault();
    selectionBoxEnd = { x, y };
    renderNetwork();
    return;
  }

  // Hover detection
  const node = getNodeAtPosition(x, y);

  // Update cursor
  if (isSpacePressed) {
    canvas.style.cursor = "grab";
  } else if (node) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = "default";
  }

  if (node !== hoveredNode) {
    hoveredNode = node;
    if (hoveredNode) renderNetwork();
  }

  if (node) {
    showTooltip(e.clientX, e.clientY, node);
  } else {
    hideTooltip();
  }
}

function handleMouseUp() {
  // End panning
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = isSpacePressed ? "grab" : "default";
    return;
  }

  // End node dragging
  if (isDraggingNode) {
    isDraggingNode = false;
    draggedNode = null;
    canvas.style.cursor = isSpacePressed
      ? "grab"
      : hoveredNode
      ? "move"
      : "default";
    return;
  }

  // End selection box
  if (isSelectingBox) {
    isSelectingBox = false;

    // Select nodes within the box
    if (selectionBoxStart && selectionBoxEnd) {
      const minX = Math.min(selectionBoxStart.x, selectionBoxEnd.x);
      const maxX = Math.max(selectionBoxStart.x, selectionBoxEnd.x);
      const minY = Math.min(selectionBoxStart.y, selectionBoxEnd.y);
      const maxY = Math.max(selectionBoxStart.y, selectionBoxEnd.y);

      const nodesInBox = network.nodes.filter((node) => {
        return (
          node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
        );
      });

      // Add to selection (if shift was held during drag, nodes are already preserved)
      nodesInBox.forEach((node) => {
        if (!selectedNodes.includes(node)) {
          selectedNodes.push(node);
        }
      });
    }

    selectionBoxStart = null;
    selectionBoxEnd = null;
    renderNetwork();
    return;
  }

  canvas.style.cursor = isSpacePressed
    ? "grab"
    : hoveredNode
    ? "move"
    : "default";
}

function handleMouseLeave() {
  isDragging = false;
  isDraggingNode = false;
  draggedNode = null;
  hoveredNode = null;
  isPanning = false;
  isSelectingBox = false;
  selectionBoxStart = null;
  selectionBoxEnd = null;
  hideTooltip();
  canvas.style.cursor = "default";
  renderNetwork();
}

function handleKeyDown(e) {
  // Check if input/textarea is focused (but exclude range slider for Space key)
  const activeElement = document.activeElement;
  const isInputFocused =
    activeElement &&
    (activeElement.tagName === "TEXTAREA" ||
      activeElement.isContentEditable ||
      (activeElement.tagName === "INPUT" && activeElement.type !== "range")); // Exclude range slider

  if (e.code === "Space" && !isSpacePressed && !isInputFocused) {
    e.preventDefault(); // Prevent page scroll
    isSpacePressed = true;
    if (canvas) {
      canvas.style.cursor = "grab";
    }
  }

  // ESC to clear selection
  if (e.code === "Escape") {
    selectedNodes = [];
    renderNetwork();
  }
}

function handleKeyUp(e) {
  if (e.code === "Space") {
    e.preventDefault();
    isSpacePressed = false;
    isPanning = false;
    if (canvas) {
      canvas.style.cursor = hoveredNode ? "move" : "default";
    }
  }
}

function handleWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.1, Math.min(5, scale * delta));

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
  offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
  scale = newScale;

  renderNetwork();
}

function getNodeAtPosition(x, y) {
  if (!network) return null;

  for (const node of network.nodes) {
    const dx = x - node.x;
    const dy = y - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Use effective size (scaled for non-median nodes)
    const effectiveSize = node.isMedian ? node.size : node.size * nodeScale;
    if (dist <= effectiveSize) {
      return node;
    }
  }
  return null;
}

// ===== Tooltip =====
function showTooltip(x, y, node) {
  if (node.isMedian) {
    // Tooltip for median vectors
    elements.tooltip.innerHTML = `
      <div class="tooltip-title">Median Vector</div>
      <div class="tooltip-content">
        Haplótipo inferido (não observado)<br>
        Conecta haplótipos distantes
      </div>
    `;
  } else {
    // Get location distribution
    const locationData = getNodeLocationData(node);
    let locationInfo = "";

    if (locationData.multipleLocations) {
      const sortedLocs = Object.entries(locationData.locations).sort(
        (a, b) => b[1] - a[1]
      );

      locationInfo =
        '<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.2);">';
      locationInfo += "<strong>Distribuição:</strong><br>";
      sortedLocs.forEach(([loc, count]) => {
        const pct = ((count / locationData.total) * 100).toFixed(0);
        locationInfo += `${loc}: ${count} (${pct}%)<br>`;
      });
      locationInfo += "</div>";
    }

    // Tooltip for observed haplotypes
    elements.tooltip.innerHTML = `
      <div class="tooltip-title">${node.label}</div>
      <div class="tooltip-content">
        Amostras: ${node.count}<br>
        ${node.samples.slice(0, 3).join("<br>")}
        ${
          node.samples.length > 3
            ? `<br>+${node.samples.length - 3} mais...`
            : ""
        }
        ${locationInfo}
      </div>
    `;
  }
  elements.tooltip.style.left = x + 15 + "px";
  elements.tooltip.style.top = y + 15 + "px";
  elements.tooltip.style.display = "block";
}

function hideTooltip() {
  elements.tooltip.style.display = "none";
}

// ===== Export Functions =====
function resetLayout() {
  if (!network || !originalLayout) {
    showError("Nenhum layout para restaurar");
    return;
  }

  // Restore original positions
  network.nodes.forEach((node) => {
    const original = originalLayout.find((o) => o.id === node.id);
    if (original) {
      node.x = original.x;
      node.y = original.y;
      node.vx = 0;
      node.vy = 0;
    }
  });

  // Reset zoom and pan
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  renderNetwork();
  showToast("Layout restaurado!");
}

function exportPNG() {
  if (!network) {
    showError("Nenhuma rede para exportar");
    return;
  }

  // Calcular bounds da rede inteira
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  network.nodes.forEach((node) => {
    const margin = node.size + 30; // Margem extra para bordas e labels
    minX = Math.min(minX, node.x - margin);
    minY = Math.min(minY, node.y - margin);
    maxX = Math.max(maxX, node.x + margin);
    maxY = Math.max(maxY, node.y + margin);
  });

  const padding = 50; // Padding ao redor da rede
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  // Criar canvas temporário com tamanho da rede completa
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

  // Aplicar background
  tempCtx.clearRect(0, 0, width, height);
  tempCtx.fillStyle = customColors.background;
  tempCtx.fillRect(0, 0, width, height);

  // Transladar para centralizar a rede
  tempCtx.save();
  tempCtx.translate(-minX + padding, -minY + padding);

  // Desenhar edges
  network.edges.forEach((edge) => {
    const source = network.nodes.find((n) => n.id === edge.source);
    const target = network.nodes.find((n) => n.id === edge.target);

    if (!source || !target) return;

    tempCtx.beginPath();
    tempCtx.moveTo(source.x, source.y);
    tempCtx.lineTo(target.x, target.y);
    tempCtx.strokeStyle = customColors.edge;
    tempCtx.lineWidth = 2;
    tempCtx.stroke();

    // Mutation count or ticks
    if (elements.showMutations.checked && edge.distance > 0) {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;

      if (elements.mutationToggle.classList.contains("ticks")) {
        // Draw ticks perpendicular to edge
        drawMutationTicks(tempCtx, source, target, edge.distance);
      } else {
        // Draw number
        tempCtx.fillStyle = customColors.mutation;
        tempCtx.font = "12px Inter";
        tempCtx.textAlign = "center";
        tempCtx.textBaseline = "middle";
        tempCtx.fillText(edge.distance.toString(), midX, midY);
      }
    }
  });

  // Desenhar nodes
  network.nodes.forEach((node) => {
    const locationData = getNodeLocationData(node);

    if (locationData.multipleLocations) {
      drawPieChartNode(tempCtx, node, locationData, false);
    } else {
      const color = getNodeColor(node);

      tempCtx.beginPath();
      tempCtx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
      tempCtx.fillStyle = color;
      tempCtx.fill();

      if (node.isMedian) {
        tempCtx.strokeStyle = "#0f172a";
        tempCtx.lineWidth = 2;
      } else {
        tempCtx.strokeStyle = "#1e293b";
        tempCtx.lineWidth = 2;
      }
      tempCtx.stroke();
    }

    // Desenhar label do haplótipo dentro do nó
    if (!node.isMedian && node.label) {
      tempCtx.fillStyle = node.count > 5 ? "#ffffff" : "#0f172a";
      tempCtx.font = "bold 14px Inter";
      tempCtx.textAlign = "center";
      tempCtx.textBaseline = "middle";
      tempCtx.fillText(node.label, node.x, node.y);
    }
  });

  tempCtx.restore();

  // Converter para blob e forçar download
  tempCanvas.toBlob((blob) => {
    // Usar showSaveFilePicker se disponível (API moderna)
    if (window.showSaveFilePicker) {
      const options = {
        suggestedName: "haplotype_network.png",
        types: [
          {
            description: "PNG Image",
            accept: { "image/png": [".png"] },
          },
        ],
      };

      window
        .showSaveFilePicker(options)
        .then((handle) => {
          handle.createWritable().then((writable) => {
            writable.write(blob);
            writable.close();
            showToast("Rede completa exportada como PNG!");
          });
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Erro ao salvar:", err);
            // Fallback para método antigo
            downloadBlobFallback(blob, "haplotype_network.png");
          }
        });
    } else {
      // Fallback para navegadores antigos
      downloadBlobFallback(blob, "haplotype_network.png");
    }
  });
}

function downloadBlobFallback(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);

  showToast("Rede completa exportada como PNG!");
}

function exportSVG() {
  if (!network) {
    showError("Nenhuma rede para exportar");
    return;
  }

  // Calcular bounds da rede inteira
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  network.nodes.forEach((node) => {
    const margin = node.size + 30; // Margem extra para labels
    minX = Math.min(minX, node.x - margin);
    minY = Math.min(minY, node.y - margin);
    maxX = Math.max(maxX, node.x + margin);
    maxY = Math.max(maxY, node.y + margin);
  });

  const padding = 50;
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  // Criar SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      text { font-family: Inter, Arial, sans-serif; font-size: 12px; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${customColors.background}"/>
  
  <g transform="translate(${offsetX}, ${offsetY})">
`;

  // Desenhar edges
  network.edges.forEach((edge) => {
    const source = network.nodes.find((n) => n.id === edge.source);
    const target = network.nodes.find((n) => n.id === edge.target);

    if (!source || !target) return;

    svg += `    <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" 
          stroke="${customColors.edge}" stroke-width="2"/>\n`;

    // Mutation count or ticks
    if (elements.showMutations.checked && edge.distance > 0) {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;

      if (elements.mutationToggle.classList.contains("ticks")) {
        // Draw ticks perpendicular to edge
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        const perpX = -dy / length;
        const perpY = dx / length;

        const tickLength = 8;
        const tickSpacing = 5;

        for (let i = 0; i < edge.distance; i++) {
          const offset = (i - (edge.distance - 1) / 2) * tickSpacing;
          const tickCenterX = midX + (dx / length) * offset;
          const tickCenterY = midY + (dy / length) * offset;

          const x1 = tickCenterX - perpX * (tickLength / 2);
          const y1 = tickCenterY - perpY * (tickLength / 2);
          const x2 = tickCenterX + perpX * (tickLength / 2);
          const y2 = tickCenterY + perpY * (tickLength / 2);

          svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                stroke="${customColors.mutation}" stroke-width="1.5"/>\n`;
        }
      } else {
        // Draw number
        svg += `    <text x="${midX}" y="${midY}" text-anchor="middle" dominant-baseline="middle" 
              fill="${customColors.mutation}">${edge.distance}</text>\n`;
      }
    }
  });

  // Desenhar nodes
  network.nodes.forEach((node) => {
    const locationData = getNodeLocationData(node);

    if (locationData.multipleLocations) {
      // Pie chart para múltiplas localidades
      const { locations, total } = locationData;
      const locationList =
        selectedLocation === "location01"
          ? geoData.location01
          : geoData.location02;
      const sortedLocations = Object.entries(locations).sort(
        (a, b) => b[1] - a[1]
      );

      let startAngle = -Math.PI / 2;

      sortedLocations.forEach(([location, count]) => {
        const proportion = count / total;
        const endAngle = startAngle + proportion * 2 * Math.PI;

        let color = customColors.locations[location];
        if (!color) {
          const locationIndex = locationList.indexOf(location);
          const defaultColors = [
            "rgba(99, 102, 241, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(236, 72, 153, 1)",
            "rgba(244, 63, 94, 1)",
            "rgba(245, 158, 11, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(20, 184, 166, 1)",
            "rgba(6, 182, 212, 1)",
            "rgba(59, 130, 246, 1)",
          ];
          color =
            locationIndex >= 0
              ? defaultColors[locationIndex % defaultColors.length]
              : "rgba(99, 102, 241, 1)";
        }

        // Converter ângulos para coordenadas
        const x1 = node.x + node.size * Math.cos(startAngle);
        const y1 = node.y + node.size * Math.sin(startAngle);
        const x2 = node.x + node.size * Math.cos(endAngle);
        const y2 = node.y + node.size * Math.sin(endAngle);
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

        svg += `    <path d="M ${node.x} ${node.y} L ${x1} ${y1} A ${node.size} ${node.size} 0 ${largeArc} 1 ${x2} ${y2} Z" 
              fill="${color}"/>\n`;

        startAngle = endAngle;
      });
    } else {
      // Nó sólido
      const color = getNodeColor(node);
      const strokeColor = node.isMedian ? "#0f172a" : "#1e293b";

      svg += `    <circle cx="${node.x}" cy="${node.y}" r="${node.size}" 
            fill="${color}" stroke="${strokeColor}" stroke-width="2"/>\n`;
    }

    // Desenhar label do haplótipo dentro do nó (somente para nós não-medianos)
    if (!node.isMedian && node.label) {
      const fillColor = node.count > 5 ? "#ffffff" : "#0f172a";
      svg += `    <text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="middle" font-weight="bold" font-size="14" fill="${fillColor}">${node.label}</text>\n`;
    }
  });

  svg += `  </g>
</svg>`;

  // Criar blob e download
  const blob = new Blob([svg], { type: "image/svg+xml" });

  // Usar showSaveFilePicker se disponível
  if (window.showSaveFilePicker) {
    const options = {
      suggestedName: "haplotype_network.svg",
      types: [
        {
          description: "SVG Image",
          accept: { "image/svg+xml": [".svg"] },
        },
      ],
    };

    window
      .showSaveFilePicker(options)
      .then((handle) => {
        handle.createWritable().then((writable) => {
          writable.write(blob);
          writable.close();
          showToast("Rede completa exportada como SVG!");
        });
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Erro ao salvar:", err);
          downloadBlobFallback(blob, "haplotype_network.svg");
        }
      });
  } else {
    downloadBlobFallback(blob, "haplotype_network.svg");
  }
}

// ===== Utility Functions =====
// ===== Utility Functions =====
function resetAll() {
  fastaData = null;
  parsedData = null;
  network = null;
  elements.dropZone.style.display = "flex";
  elements.fileCard.style.display = "none";
  elements.fileStats.style.display = "none";
  elements.optionsSection.style.display = "none";
  elements.networkSection.style.display = "none";
  elements.fastaInput.value = "";
  hideError();
}

function showLoading(show) {
  elements.loadingSpinner.style.display = show ? "flex" : "none";
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorDisplay.style.display = "flex";
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

// ===== Initialize on load =====
document.addEventListener("DOMContentLoaded", init);
