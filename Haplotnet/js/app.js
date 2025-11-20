import { parseNexus } from './parsers/nexus_parser.js';
import { computeMSN_Optimized as computeMSN } from './algorithms/msn.js';
import { computeMJN } from './algorithms/mj.js';
import { drawNetwork } from './visualization/network_viewer.js';
import { computeDistanceMatrix } from './algorithms/distance.js';
import { Graph, Vertex } from './algorithms/graph.js';

const state = {
    nexusData: null,
    network: null,
    zoomControls: null,
    config: {
        algorithm: 'mj', // 'mj' or 'msn'
        epsilon: 0,
        showLabels: true,
        showMutations: true
    }
};

console.log('Haplotnet app.js loaded');

let elements = {};

function init() {
    console.log('Initializing Haplotnet...');
    try {
        elements = {
            nexusInput: document.getElementById('nexusInput'),
            selectFileBtn: document.getElementById('selectFileBtn'),
            fileName: document.getElementById('fileName'),
            algorithmSelect: document.getElementById('algorithmSelect'),
            epsilonInput: document.getElementById('epsilonInput'),
            epsilonControl: document.getElementById('epsilonControl'),
            showLabels: document.getElementById('showLabels'),
            showMutations: document.getElementById('showMutations'),
            redrawBtn: document.getElementById('redrawBtn'),
            vizContainer: document.getElementById('vizContainer'),
            placeholderState: document.getElementById('placeholderState'),
            networkCanvas: document.getElementById('networkCanvas'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingMessage: document.getElementById('loadingMessage'),
            // Zoom btns
            zoomInBtn: document.getElementById('zoomInBtn'),
            zoomOutBtn: document.getElementById('zoomOutBtn'),
            fitBtn: document.getElementById('fitBtn'),
            legendContainer: document.getElementById('legendContainer')
        };

        // Verify critical elements
        if (!elements.nexusInput || !elements.selectFileBtn) {
            console.error('Critical elements missing:', elements);
            alert('Erro crítico: Elementos da interface não encontrados.');
            return;
        }

        setupEventListeners();
        checkSessionData();
        console.log('Haplotnet initialized successfully');
    } catch (e) {
        console.error('Error during initialization:', e);
        alert('Erro ao inicializar aplicação: ' + e.message);
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners');
    // File Upload
    if (elements.selectFileBtn) {
        elements.selectFileBtn.addEventListener('click', () => {
            console.log('Select file button clicked');
            elements.nexusInput.click();
        });
    }

    if (elements.nexusInput) {
        elements.nexusInput.addEventListener('change', (e) => {
            console.log('File input changed', e.target.files);
            handleFileUpload(e);
        });
    }

    // Algorithm Settings
    elements.algorithmSelect.addEventListener('change', (e) => {
        state.config.algorithm = e.target.value;
        elements.epsilonControl.style.display = state.config.algorithm === 'mj' ? 'block' : 'none';
    });

    elements.epsilonInput.addEventListener('change', (e) => {
        state.config.epsilon = parseInt(e.target.value, 10) || 0;
    });

    // Visualization Settings
    elements.showLabels.addEventListener('change', (e) => {
        state.config.showLabels = e.target.checked;
        if (state.network) updateVisualization();
    });

    elements.showMutations.addEventListener('change', (e) => {
        state.config.showMutations = e.target.checked;
        if (state.network) updateVisualization();
    });

    elements.redrawBtn.addEventListener('click', generateNetwork);

    // Zoom Controls
    elements.zoomInBtn.addEventListener('click', () => state.zoomControls && state.zoomControls.zoomIn());
    elements.zoomOutBtn.addEventListener('click', () => state.zoomControls && state.zoomControls.zoomOut());
    elements.fitBtn.addEventListener('click', () => state.zoomControls && state.zoomControls.fit());
}

function checkSessionData() {
    const sessionNexus = sessionStorage.getItem('nexusData');
    const sessionFileName = sessionStorage.getItem('nexusFileName');

    if (sessionNexus) {
        loadNexusData(sessionNexus, sessionFileName || 'Gerado pelo Nexusficador');
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        showLoading(true, 'Lendo arquivo...');
        const text = await readFileAsText(file);
        loadNexusData(text, file.name);
    } catch (error) {
        console.error(error);
        alert('Erro ao ler arquivo: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erro na leitura do arquivo'));
        reader.readAsText(file);
    });
}

function loadNexusData(nexusContent, fileName) {
    try {
        state.nexusData = parseNexus(nexusContent);
        elements.fileName.textContent = fileName;
        elements.placeholderState.style.display = 'none';

        console.log('NEXUS Parsed:', state.nexusData);
        renderLegend();
        generateNetwork();
    } catch (error) {
        console.error(error);
        alert('Erro ao processar NEXUS: ' + error.message);
        elements.fileName.textContent = 'Erro no arquivo';
    }
}

function renderLegend() {
    elements.legendContainer.innerHTML = '';
    if (!state.nexusData || !state.nexusData.traitLabels) return;

    const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

    state.nexusData.traitLabels.forEach((label, i) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        const color = colors[i % colors.length];
        item.innerHTML = `<div class="legend-color" style="background-color: ${color}"></div><span>${label}</span>`;
        elements.legendContainer.appendChild(item);
    });
}

async function generateNetwork() {
    if (!state.nexusData) return;

    showLoading(true, 'Gerando rede...');

    // Allow UI to update before heavy calculation
    setTimeout(() => {
        try {
            const sequences = state.nexusData.sequences;
            const epsilon = state.config.epsilon;

            console.log('Generating network...', state.config);

            if (state.config.algorithm === 'mj') {
                state.network = computeMJN(sequences, epsilon);
            } else {
                // For MSN, we construct graph manually first
                const graph = new Graph();
                sequences.forEach((seq, i) => {
                    const v = new Vertex(i, seq.name, seq.sequence);
                    v.data.isOriginal = true;
                    v.data.traits = seq.traits;
                    graph.addVertex(v);
                });

                const distMatrix = computeDistanceMatrix(graph.vertices);
                const edges = computeMSN(graph, distMatrix, epsilon); // Using optimized MSN
                edges.forEach(e => graph.addEdge(e.u, e.v, e.weight));
                state.network = graph;
            }

            updateVisualization();

        } catch (error) {
            console.error(error);
            alert('Erro ao gerar rede: ' + error.message);
        } finally {
            showLoading(false);
        }
    }, 100);
}

function updateVisualization() {
    if (!state.network) return;
    state.zoomControls = drawNetwork(state.network, elements.networkCanvas, state.config);

    // Auto-fit after a short delay to allow simulation to expand slightly
    setTimeout(() => {
        if (state.zoomControls) {
            console.log('Auto-fitting network...');
            state.zoomControls.fit();
        }
    }, 500);
}

function showLoading(show, message = 'Processando...') {
    elements.loadingMessage.textContent = message;
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Start app
// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
