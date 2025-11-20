import { Graph, Vertex, Edge } from './graph.js';
import { computeDistanceMatrix, pairwiseDistance } from './distance.js';
import { computeMSN_Optimized } from './msn.js';

/**
 * Computes the Median-Joining Network.
 * @param {Array} initialSequences - List of sequence objects {name, sequence, traits}
 * @param {Number} epsilon - Tolerance parameter
 * @returns {Graph} The computed MJN graph
 */
export function computeMJN(initialSequences, epsilon) {
    const graph = new Graph();
    let medianCount = 0;

    // Initialize graph with original sequences
    initialSequences.forEach((seq, i) => {
        const v = new Vertex(i, seq.name, seq.sequence);
        v.data.isOriginal = true;
        v.data.traits = seq.traits;
        graph.addVertex(v);
    });

    const allSeqSet = new Set(initialSequences.map(s => s.sequence));
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Safety break

    // Main MJ Loop
    while (changed) {
        iterations++;
        if (iterations > MAX_ITERATIONS) {
            console.warn('MJ Algorithm reached max iterations. Stopping loop to prevent freeze.');
            break;
        }

        console.log(`MJ Iteration ${iterations}: Vertices: ${graph.vertices.length}`);
        changed = false;

        // Remove all edges (conceptually, we rebuild connectivity)
        graph.clearEdges();

        // Compute Distances
        console.log('  Computing distance matrix...');
        const currentVertices = graph.vertices;
        const distMatrix = computeDistanceMatrix(currentVertices);

        // Compute MSN (Feasible Links)
        console.log('  Computing MSN...');
        const feasibleEdges = computeMSN_Optimized(graph, distMatrix, epsilon);
        console.log(`  MSN computed. Edges: ${feasibleEdges.length}`);

        // Add feasible edges to graph temporarily to find neighbors
        feasibleEdges.forEach(e => graph.addEdge(e.u, e.v, e.weight));

        // Remove Obsolete Vertices
        console.log('  Checking obsolete vertices...');
        if (removeObsoleteVerts(graph)) {
            console.log('  Removed obsolete vertices');
            changed = true;
            continue;
        }

        console.log('  Finding medians...');

        let globalMinCost = Infinity;
        const potentialMedians = []; // { seq, cost }

        const evaluateTriplet = (u, v, w) => {
            const seqU = u.sequence;
            const seqV = v.sequence;
            const seqW = w.sequence;

            const medians = computeQuasiMedianSeqs(seqU, seqV, seqW);
            for (const medSeq of medians) {
                if (allSeqSet.has(medSeq)) continue;
                const cost = computeCost(seqU, seqV, seqW, medSeq);
                if (cost < globalMinCost) globalMinCost = cost;
                potentialMedians.push({ seq: medSeq, cost });
            }
        };

        // Iterate all connected triplets
        let tripletCount = 0;
        for (const u of graph.vertices) {
            const neighbors = graph.getNeighbors(u);
            if (neighbors.length < 2) continue;

            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    tripletCount++;
                    if (tripletCount % 1000 === 0) console.log(`  Evaluated ${tripletCount} triplets...`);
                    evaluateTriplet(neighbors[i], u, neighbors[j]);
                }
            }
        }
        console.log(`  Total triplets evaluated: ${tripletCount}`);

        // Add candidates
        let addedCount = 0;
        for (const pm of potentialMedians) {
            if (pm.cost <= globalMinCost + epsilon) {
                if (!allSeqSet.has(pm.seq)) {
                    const newV = new Vertex(graph.vertices.length, `mv${++medianCount}`, pm.seq);
                    newV.data.isMedian = true;
                    graph.addVertex(newV);
                    allSeqSet.add(pm.seq);
                    changed = true;
                    addedCount++;
                }
            }
        }
        if (addedCount > 0) {
            console.log(`  Added ${addedCount} median vectors`);
        }
    }

    // Final Cleanup
    console.log('  Starting Final Cleanup...');
    // 1. Clear edges
    graph.clearEdges();
    // 2. Compute final MSN
    console.log('  Computing final MSN...');
    const finalDistMatrix = computeDistanceMatrix(graph.vertices);
    const finalEdges = computeMSN_Optimized(graph, finalDistMatrix, epsilon);
    finalEdges.forEach(e => graph.addEdge(e.u, e.v, e.weight));

    // 3. Remove obsolete (one last time)
    console.log('  Removing obsolete vertices...');
    let loopCount = 0;
    while (removeObsoleteVerts(graph)) {
        loopCount++;
        if (loopCount > 100) {
            console.warn('  Infinite loop detected in removeObsoleteVerts cleanup');
            break;
        }
        console.log(`  Cleanup loop ${loopCount}: removed vertices`);
    }
    console.log('  Final Cleanup complete.');

    return graph;
}

function removeObsoleteVerts(graph) {
    let removed = false;
    // Filter vertices
    // Obsolete: degree < 2 AND not original
    const toRemove = graph.vertices.filter(v => {
        const degree = graph.getIncidentEdges(v).length;
        return !v.data.isOriginal && degree < 2;
    });

    if (toRemove.length > 0) {
        toRemove.forEach(v => {
            // Remove edges
            const edges = graph.getIncidentEdges(v);
            edges.forEach(e => graph.removeEdge(e.id));

            // Remove vertex from array
            const idx = graph.vertices.indexOf(v);
            if (idx > -1) graph.vertices.splice(idx, 1);
        });

        // Re-index vertices to match array position
        graph.vertices.forEach((v, i) => v.id = i);

        // Full Rebuild of Adjacency
        const newAdj = new Map();
        graph.vertices.forEach(v => newAdj.set(v.id, []));

        graph.edges.forEach(e => {
            newAdj.get(e.u.id).push(e);
            newAdj.get(e.v.id).push(e);
        });
        graph.adj = newAdj;

        removed = true;
    }

    return removed;
}

function computeQuasiMedianSeqs(seqA, seqB, seqC) {
    const medians = new Set();
    const len = seqA.length;
    let qmSeq = '';
    let hasStar = false;

    // First pass: identify fixed positions and stars
    const stars = []; // indices

    for (let i = 0; i < len; i++) {
        const a = seqA[i];
        const b = seqB[i];
        const c = seqC[i];

        if (a === b || a === c) {
            qmSeq += a;
        } else if (b === c) {
            qmSeq += b;
        } else {
            qmSeq += '*';
            stars.push(i);
            hasStar = true;
        }
    }

    if (!hasStar) {
        medians.add(qmSeq);
        return medians;
    }

    // Expand stars
    let combinations = 0;
    const MAX_COMBINATIONS = 1000;

    const expand = (currentSeq, starIdx) => {
        if (combinations > MAX_COMBINATIONS) return;

        if (starIdx >= stars.length) {
            medians.add(currentSeq);
            combinations++;
            return;
        }

        const pos = stars[starIdx];
        const chars = [seqA[pos], seqB[pos], seqC[pos]];

        // Filter out ambiguous characters from expansion candidates
        const isAmbiguousChar = c => c === '?' || c === '-' || c === 'N';
        let uniqueChars = [...new Set(chars)];

        const validChars = uniqueChars.filter(c => !isAmbiguousChar(c));

        if (validChars.length > 0) {
            uniqueChars = validChars;
        }

        for (const char of uniqueChars) {
            const nextSeq = currentSeq.substring(0, pos) + char + currentSeq.substring(pos + 1);
            expand(nextSeq, starIdx + 1);
        }
    };

    expand(qmSeq, 0);
    return medians;
}

function computeCost(seqU, seqV, seqW, med) {
    return pairwiseDistance(seqU, med) +
        pairwiseDistance(seqV, med) +
        pairwiseDistance(seqW, med);
}