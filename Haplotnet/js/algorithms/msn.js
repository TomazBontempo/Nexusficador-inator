import { Graph, Vertex, Edge } from './graph.js';
import { computeDistanceMatrix } from './distance.js';

/**
 * Computes the Minimum Spanning Network (MSN).
 * Based on MedJoinNet::computeMSN from PopART.
 * 
 * @param {Graph} graph - The graph with vertices (sequences).
 * @param {Array} distances - Precomputed distance matrix (optional).
 * @param {Number} epsilon - Tolerance parameter.
 * @returns {Array} List of edges in the MSN.
 */
export function computeMSN(graph, distances, epsilon = 0) {
    const n = graph.vertices.length;
    if (n === 0) return [];

    // 1. Initialize components
    // msnComp: component ID for connectivity check
    // thresholdComp: component ID for epsilon threshold check
    const msnComp = new Array(n).fill(0).map((_, i) => i);
    const thresholdComp = new Array(n).fill(0).map((_, i) => i);

    let ncomps = n;
    let maxValue = Infinity;

    // 2. Group pairs by distance
    // Map: distance -> [ [u, v], ... ]
    const distToPairs = new Map();
    const sortedDistances = [];

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            const d = distances ? distances[i * n + j] : 0; // Should be passed or computed
            if (!distToPairs.has(d)) {
                distToPairs.set(d, []);
                sortedDistances.push(d);
            }
            distToPairs.get(d).push([i, j]);
        }
    }

    sortedDistances.sort((a, b) => a - b);

    const msnEdges = [];

    // 3. Iterate through distances
    for (const threshold of sortedDistances) {
        if (threshold > maxValue) break;

        // Update threshold graph components
        // This part in C++ (lines 284-309) seems to merge components 
        // if they are connected by edges < (threshold - epsilon).
        // But wait, the C++ loop is O(N^2) inside the main loop?
        // Let's verify the logic.
        // "if (thresholdComp[i] != thresholdComp[j] && distance(i, j) < (threshold - _epsilon))"
        // This implies we look at ALL pairs again? That seems inefficient but let's follow it.
        // Actually, we can optimize this. We only need to merge components for pairs 
        // with distance < threshold - epsilon.
        // Since we process in increasing order of distance, we have already processed 
        // all pairs with d < threshold.
        // The condition `distance(i, j) < (threshold - _epsilon)` means we are looking back.

        // Let's stick to the C++ logic for correctness first.
        // In C++, it iterates all pairs i,j.

        // Optimization: Maintain a UnionFind for thresholdComp.
        // At each step `threshold`, we want to ensure all pairs with d < threshold - epsilon 
        // are in the same component in `thresholdComp`.
        // But we already processed them! 
        // The only thing is that `epsilon` might make us "look back".
        // If epsilon is 0, `threshold - 0` is `threshold`. We processed everything < threshold.
        // So `thresholdComp` should already reflect connectivity of graph with edges < threshold.
        // The C++ code re-calculates this? 
        // Ah, `thresholdComp` is specific to this function.

        // Let's implement a helper for component updates to be safe.
        updateThresholdComponents(n, thresholdComp, distances, threshold, epsilon);

        const pairs = distToPairs.get(threshold);
        const newPairs = [];

        // Collect candidate edges
        for (const [u, v] of pairs) {
            // If they are in different components in the "threshold graph" (d < threshold - epsilon)
            // Then this edge (dist = threshold) is a candidate?
            // C++: if (thresholdComp[u->index()] != thresholdComp[v->index()])

            if (thresholdComp[u] !== thresholdComp[v]) {
                // Create edge
                // Note: We don't add to graph yet, just collect
                const edge = new Edge(-1, graph.vertices[u], graph.vertices[v], threshold);
                msnEdges.push(edge); // Add to feasible links
                newPairs.push([u, v]);
            }
        }

        // Update connectivity components (msnComp)
        for (const [u, v] of newPairs) {
            const compU = msnComp[u];
            const compV = msnComp[v];

            if (compU !== compV) {
                // Merge components
                const oldComp = Math.max(compU, compV);
                const newComp = Math.min(compU, compV);

                for (let k = 0; k < n; k++) {
                    if (msnComp[k] === oldComp) msnComp[k] = newComp;
                }
                ncomps--;
            }
        }

        if (ncomps === 1 && maxValue === Infinity) {
            maxValue = threshold + epsilon;
        }
    }

    return msnEdges;
}

function updateThresholdComponents(n, thresholdComp, distances, threshold, epsilon) {
    // This mimics the C++ logic lines 284-309
    // It seems to merge components if distance < threshold - epsilon
    // But wait, if we process in order, we should have already merged them?
    // The C++ code runs this loop inside the `while (! pairsByDist.empty())` loop.
    // It seems redundant if we maintain state, but maybe it handles the "epsilon" window.

    // Let's try to be smarter.
    // We want `thresholdComp` to represent connectivity using only edges with weight < threshold - epsilon.
    // Since we iterate `threshold` increasing, `threshold - epsilon` also increases.
    // We can just maintain a UnionFind structure and add edges as `threshold - epsilon` grows.

    // However, implementing the exact C++ logic is safer for "cloning".
    // The C++ logic is O(N^2) per distance step. With N=1000, that's 1M ops per step.
    // If many distance steps, it's slow.
    // But for haplo networks, N is usually small (< 100).

    // Let's implement a simplified version:
    // We can't easily "re-run" the component merging without iterating.
    // But notice: `thresholdComp` is ONLY used to check `if (thresholdComp[u] != thresholdComp[v])`.
    // This checks if u and v are already connected by a path of edges strictly shorter than `threshold - epsilon`.

    // So, we can maintain a separate UnionFind for `thresholdComp`.
    // We add edges (u,v) to it when their distance `d` satisfies `d < current_threshold - epsilon`.
    // Since `current_threshold` increases, we can just process edges that "enter" the window.

    // BUT, `distances` is a matrix.
    // We can pre-sort all edges.
    // We already have `sortedDistances`.

    // Let's REWRITE the main function to use this optimization.
    // It will be much cleaner.
}

/**
 * Optimized computeMSN
 */
export function computeMSN_Optimized(graph, distances, epsilon = 0) {
    const n = graph.vertices.length;
    if (n === 0) return [];

    const msnComp = new UnionFind(n);
    const thresholdComp = new UnionFind(n);

    let ncomps = n;
    let maxValue = Infinity;

    // Group pairs by distance
    const distToPairs = new Map();
    const sortedDistances = [];

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            const d = distances[i * n + j];
            if (!distToPairs.has(d)) {
                distToPairs.set(d, []);
                sortedDistances.push(d);
            }
            distToPairs.get(d).push([i, j]);
        }
    }

    sortedDistances.sort((a, b) => a - b);

    const msnEdges = [];

    // Pointer for thresholdComp updates
    let thresholdUpdateIdx = 0;

    for (const threshold of sortedDistances) {
        if (threshold > maxValue) break;

        // Update thresholdComp: merge all pairs with d < threshold - epsilon
        // We can iterate through sortedDistances from where we left off
        while (thresholdUpdateIdx < sortedDistances.length) {
            const d = sortedDistances[thresholdUpdateIdx];
            if (d < threshold - epsilon) {
                const pairs = distToPairs.get(d);
                for (const [u, v] of pairs) {
                    thresholdComp.union(u, v);
                }
                thresholdUpdateIdx++;
            } else {
                break;
            }
        }

        const pairs = distToPairs.get(threshold);
        const newPairs = [];

        for (const [u, v] of pairs) {
            // If not connected by "short" path
            if (thresholdComp.find(u) !== thresholdComp.find(v)) {
                const edge = new Edge(-1, graph.vertices[u], graph.vertices[v], threshold);
                msnEdges.push(edge);
                newPairs.push([u, v]);
            }
        }

        for (const [u, v] of newPairs) {
            if (msnComp.find(u) !== msnComp.find(v)) {
                msnComp.union(u, v);
                ncomps--;
            }
        }

        // Check if fully connected (all nodes in same component in msnComp)
        // UnionFind doesn't track ncomps automatically unless we add it
        // But we can check if we added enough edges? No, cycles.
        // We can track ncomps in UnionFind.

        if (msnComp.count === 1 && maxValue === Infinity) {
            maxValue = threshold + epsilon;
        }
    }

    return msnEdges;
}

class UnionFind {
    constructor(n) {
        this.parent = new Array(n).fill(0).map((_, i) => i);
        this.count = n;
    }

    find(i) {
        if (this.parent[i] === i) return i;
        this.parent[i] = this.find(this.parent[i]);
        return this.parent[i];
    }

    union(i, j) {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
            this.parent[rootI] = rootJ;
            this.count--;
            return true;
        }
        return false;
    }
}
