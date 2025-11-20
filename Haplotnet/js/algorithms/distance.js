/**
 * Calculates pairwise distances between sequences.
 * Ported from HapNet.cpp pairwiseDistance
 */

export function computeDistanceMatrix(sequences) {
    const n = sequences.length;
    const distMatrix = new Array(n * n).fill(0);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < i; j++) {
            const dist = pairwiseDistance(sequences[i].sequence, sequences[j].sequence);
            distMatrix[i * n + j] = dist;
            distMatrix[j * n + i] = dist;
        }
    }

    return distMatrix;
}

export function pairwiseDistance(seq1, seq2) {
    if (seq1.length !== seq2.length) {
        console.warn('Sequences have different lengths');
        // return Infinity; // Or handle gracefully
    }

    let dist = 0;
    const len = Math.min(seq1.length, seq2.length);

    for (let i = 0; i < len; i++) {
        const c1 = seq1[i].toUpperCase();
        const c2 = seq2[i].toUpperCase();

        // Skip if either is ambiguous/gap
        if (isAmbiguous(c1) || isAmbiguous(c2)) continue;

        if (c1 !== c2) {
            // Check for IUPAC ambiguities if needed (R, Y, etc.)
            // PopART checks for R (A/G) and Y (C/T) specifically for DNA
            // For now, we'll implement strict mismatch for non-ambiguous bases
            // TODO: Implement full IUPAC matching if required
            dist++;
        }
    }

    return dist;
}

function isAmbiguous(char) {
    // PopART treats '-', '?', 'N' as ambiguous/missing
    return char === '-' || char === '?' || char === 'N' || char === '.';
}
