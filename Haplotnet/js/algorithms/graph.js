/**
 * Graph data structures.
 * Ported/Adapted from Graph.h, Vertex.h, Edge.h
 */

export class Graph {
    constructor() {
        this.vertices = [];
        this.edges = [];
        this.adj = new Map(); // vertexId -> [Edge]
    }

    addVertex(vertex) {
        this.vertices.push(vertex);
        this.adj.set(vertex.id, []);
        return vertex;
    }

    addEdge(u, v, weight) {
        const edge = new Edge(this.edges.length, u, v, weight);
        this.edges.push(edge);

        this.adj.get(u.id).push(edge);
        this.adj.get(v.id).push(edge);

        return edge;
    }

    getNeighbors(vertex) {
        return this.adj.get(vertex.id).map(edge => {
            return edge.u === vertex ? edge.v : edge.u;
        });
    }

    getIncidentEdges(vertex) {
        return this.adj.get(vertex.id) || [];
    }

    removeEdge(edgeIndex) {
        // This is O(N) or worse depending on implementation, 
        // but for small graphs it's fine.
        // In PopART they swap with last and pop_back, but indices change.
        // We'll just mark as removed or filter.
        // For now, let's filter.
        const edge = this.edges.find(e => e.id === edgeIndex);
        if (!edge) return;

        this.edges = this.edges.filter(e => e.id !== edgeIndex);

        // Update adjacency
        this.adj.set(edge.u.id, this.adj.get(edge.u.id).filter(e => e.id !== edgeIndex));
        this.adj.set(edge.v.id, this.adj.get(edge.v.id).filter(e => e.id !== edgeIndex));
    }

    clearEdges() {
        this.edges = [];
        this.vertices.forEach(v => this.adj.set(v.id, []));
    }
}

export class Vertex {
    constructor(id, label, sequence) {
        this.id = id;
        this.label = label;
        this.sequence = sequence;
        this.data = {}; // For storing traits, frequencies, etc.
    }
}

export class Edge {
    constructor(id, u, v, weight) {
        this.id = id;
        this.u = u; // Vertex
        this.v = v; // Vertex
        this.weight = weight;
    }
}
