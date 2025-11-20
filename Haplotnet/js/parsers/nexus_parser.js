/**
 * Parses a NEXUS file content into a structured object.
 * Supports TAXA, CHARACTERS, and TRAITS blocks.
 */
export function parseNexus(content) {
    const lines = content.split('\n').map(l => l.trim());

    const taxa = parseTaxaBlock(lines);
    const characters = parseCharactersBlock(lines);
    const traits = parseTraitsBlock(lines);

    // Validate consistency
    if (characters.matrix.length !== taxa.length) {
        console.warn('Mismatch between TAXA count and CHARACTERS matrix size');
    }

    // Merge data
    // We need to map sequences to taxa names
    // In NEXUS, matrix usually uses taxa labels

    const sequences = characters.matrix.map(item => {
        const taxonIndex = taxa.indexOf(item.name);
        // if (taxonIndex === -1) throw new Error(`Taxon ${item.name} not found in TAXA block`);

        // Find traits for this taxon
        const taxonTraits = traits ? traits.matrix.find(t => t.name === item.name) : null;

        return {
            name: item.name,
            sequence: item.sequence,
            traits: taxonTraits ? taxonTraits.values : []
        };
    });

    return {
        taxa,
        sequences,
        traitLabels: traits ? traits.labels : [],
        ntax: taxa.length,
        nchar: characters.nchar
    };
}

function parseTaxaBlock(lines) {
    const taxa = [];
    let inTaxa = false;
    let inTaxLabels = false;

    for (const line of lines) {
        const upper = line.toUpperCase();

        if (upper.startsWith('BEGIN TAXA')) {
            inTaxa = true;
            continue;
        }

        if (!inTaxa) continue;

        if (upper.startsWith('END;')) {
            inTaxa = false;
            inTaxLabels = false;
            break; // End of TAXA block
        }

        if (upper.startsWith('TAXLABELS')) {
            inTaxLabels = true;
            // Check if labels are on the same line
            const parts = line.substring(9).trim().split(/\s+/);
            if (parts.length > 0 && parts[0] !== '') {
                parts.forEach(p => taxa.push(p));
            }
            continue;
        }

        if (inTaxLabels) {
            if (line.endsWith(';')) {
                // Last line of labels
                const clean = line.replace(';', '').trim();
                if (clean) {
                    const parts = clean.split(/\s+/);
                    parts.forEach(p => taxa.push(p));
                }
                inTaxLabels = false; // Implicit end of taxlabels
            } else {
                const parts = line.split(/\s+/);
                parts.forEach(p => {
                    if (p) taxa.push(p);
                });
            }
        }
    }

    return taxa;
}

function parseCharactersBlock(lines) {
    let inChars = false;
    let inMatrix = false;
    let nchar = 0;
    const matrix = [];

    for (const line of lines) {
        const upper = line.toUpperCase();

        if (upper.startsWith('BEGIN CHARACTERS') || upper.startsWith('BEGIN DATA')) {
            inChars = true;
            continue;
        }

        if (!inChars) continue;

        if (upper.startsWith('END;')) {
            break;
        }

        if (upper.includes('DIMENSIONS')) {
            const match = upper.match(/NCHAR\s*=\s*(\d+)/);
            if (match) nchar = parseInt(match[1], 10);
        }

        if (upper.startsWith('MATRIX')) {
            inMatrix = true;
            continue;
        }

        if (inMatrix) {
            if (line.endsWith(';')) {
                // Handle last line if it contains data
                const clean = line.replace(';', '').trim();
                if (clean) {
                    const parts = clean.split(/\s+/);
                    if (parts.length >= 2) {
                        matrix.push({ name: parts[0], sequence: parts[1] });
                    }
                }
                break;
            }

            if (line === '') continue;

            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                matrix.push({ name: parts[0], sequence: parts[1] });
            }
        }
    }

    // Handle MATCHCHAR ('.') - Expand to reference sequence (first sequence)
    if (matrix.length > 0) {
        const refSeq = matrix[0].sequence;
        for (let i = 1; i < matrix.length; i++) {
            let seq = matrix[i].sequence;
            let newSeq = '';
            for (let j = 0; j < seq.length; j++) {
                if (seq[j] === '.') {
                    // Ensure we don't go out of bounds if refSeq is shorter (shouldn't happen in valid NEXUS)
                    newSeq += (j < refSeq.length) ? refSeq[j] : '.';
                } else {
                    newSeq += seq[j];
                }
            }
            // Normalize to upper case to avoid case-sensitivity issues in MJ algorithm
            matrix[i].sequence = newSeq.toUpperCase();
        }
        // Ensure first sequence is also upper case
        matrix[0].sequence = matrix[0].sequence.toUpperCase();
    }

    return { nchar, matrix };
}

function parseTraitsBlock(lines) {
    let inTraits = false;
    let inMatrix = false;
    let labels = [];
    const matrix = [];

    for (const line of lines) {
        const upper = line.toUpperCase();

        if (upper.startsWith('BEGIN TRAITS')) {
            inTraits = true;
            continue;
        }

        if (!inTraits) continue;

        if (upper.startsWith('END;')) {
            break;
        }

        if (upper.startsWith('TRAITLABELS')) {
            // Extract labels
            // Format: TraitLabels Label1 Label2 ... ;
            let content = line.substring(11).trim();
            if (content.endsWith(';')) content = content.slice(0, -1);
            labels = content.split(/\s+/);
        }

        if (upper.startsWith('MATRIX')) {
            inMatrix = true;
            continue;
        }

        if (inMatrix) {
            if (line.endsWith(';')) {
                const clean = line.replace(';', '').trim();
                if (clean) {
                    const parts = clean.split(/\s+/);
                    if (parts.length >= 2) {
                        // Traits are usually comma separated in the second part
                        const values = parts[1].split(',').map(v => parseInt(v, 10));
                        matrix.push({ name: parts[0], values });
                    }
                }
                break;
            }

            if (line === '') continue;

            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                const values = parts[1].split(',').map(v => parseInt(v, 10));
                matrix.push({ name: parts[0], values });
            }
        }
    }

    if (matrix.length === 0) return null;

    return { labels, matrix };
}
