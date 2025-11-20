import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function drawNetwork(graph, container, config) {
    // Clear previous
    container.innerHTML = '';

    let width = container.clientWidth;
    let height = container.clientHeight;

    console.log(`NetworkViewer: Container dimensions: ${width}x${height}`);

    if (height === 0) {
        console.warn('Container height is 0, using fallback height of 600px');
        height = 600;
        // Force container style?
        container.style.height = '600px';
    }
    if (width === 0) {
        width = 800;
    }

    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Zoom behavior
    const g = svg.append("g");
    const zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    // Prepare data for D3
    const nodes = graph.vertices.map(v => ({
        id: v.id,
        label: v.label,
        isMedian: v.data.isMedian,
        isOriginal: v.data.isOriginal,
        traits: v.data.traits || [], // Array of counts per trait
        // Initial position (optional)
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100
    }));

    const links = graph.edges.map(e => ({
        source: e.u.id,
        target: e.v.id,
        weight: e.weight,
        id: e.id
    }));

    // Simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(d => d.weight * 20 + 30)) // Distance based on mutations
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(20));

    // Render Links
    const link = g.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.weight) + 1);

    // Link Labels (Mutations)
    let linkLabels;
    if (config.showMutations) {
        linkLabels = g.append("g")
            .attr("class", "link-labels")
            .selectAll("text")
            .data(links)
            .join("text")
            .attr("dy", -5)
            .attr("text-anchor", "middle")
            .text(d => d.weight)
            .attr("fill", "#555")
            .attr("font-size", "10px");
    }

    // Render Nodes
    const node = g.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("g")
        .data(nodes)
        .join("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Draw Pie Charts or Circles
    node.each(function (d) {
        const el = d3.select(this);

        if (d.isMedian) {
            // Median vector: small black circle
            el.append("circle")
                .attr("r", 4)
                .attr("fill", "black");
        } else {
            // Haplotype
            const radius = 10 + Math.log(d.traits ? d3.sum(d.traits) + 1 : 1) * 5;

            if (d.traits && d.traits.length > 0 && d3.sum(d.traits) > 0) {
                // Pie Chart
                const pie = d3.pie();
                const arc = d3.arc().innerRadius(0).outerRadius(radius);
                const colors = d3.schemeCategory10; // Or custom palette

                const arcs = pie(d.traits);

                el.selectAll("path")
                    .data(arcs)
                    .join("path")
                    .attr("d", arc)
                    .attr("fill", (d, i) => colors[i % 10]);
            } else {
                // Default circle if no traits
                el.append("circle")
                    .attr("r", radius)
                    .attr("fill", "#69b3a2");
            }
        }
    });

    // Node Labels
    if (config.showLabels) {
        node.append("text")
            .text(d => d.isMedian ? "" : d.label)
            .attr("x", 12)
            .attr("y", 3)
            .attr("stroke", "none")
            .attr("fill", "black")
            .attr("font-size", "12px")
            .style("pointer-events", "none");
    }

    // Tooltip
    node.append("title")
        .text(d => d.label + (d.isMedian ? " (Median)" : ""));

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        if (linkLabels) {
            linkLabels
                .attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2);
        }

        node
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    // Expose zoom controls
    return {
        zoomIn: () => svg.transition().call(zoom.scaleBy, 1.2),
        zoomOut: () => svg.transition().call(zoom.scaleBy, 0.8),
        fit: () => {
            const bounds = g.node().getBBox();
            const fullWidth = width;
            const fullHeight = height;
            const midX = bounds.x + bounds.width / 2;
            const midY = bounds.y + bounds.height / 2;
            if (bounds.width == 0 || bounds.height == 0) return; // nothing to fit
            const scale = 0.9 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight);
            const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        }
    };
}
