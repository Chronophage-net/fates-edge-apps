// modules/fog.js
import { state, ctx, canvas } from './state.js';
import { isVttPlayer, canControlFog } from './combat.js';
import { playerViewActive } from './state.js'; // these will be imported from ui

// ── Raycasting ──
export function raySegmentIntersect(rx, ry, rdx, rdy, x1, y1, x2, y2) {
    const sdx = x2 - x1;
    const sdy = y2 - y1;
    const denom = rdx * sdy - rdy * sdx;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((x1 - rx) * sdy - (y1 - ry) * sdx) / denom;
    const s = ((x1 - rx) * rdy - (y1 - ry) * rdx) / denom;
    if (t < 0 || s < 0 || s > 1) return null;
    return t;
}

// ── Fog "memory" (explored-but-not-currently-visible cells) ──
// fog.explored is the persisted, serializable list of "gx,gy" cell keys.
// We keep a Set cache per fog object (not persisted) purely so repeated
// membership checks each frame are O(1) instead of re-scanning the array.
const exploredSetCache = new WeakMap();
function getExploredSet(fog) {
    let set = exploredSetCache.get(fog);
    if (!set || set.__len !== fog.explored.length) {
        set = new Set(fog.explored);
        set.__len = fog.explored.length;
        exploredSetCache.set(fog, set);
    }
    return set;
}

function markExplored(fog, cx, cy, radius, cellSize) {
    if (!fog.explored) fog.explored = [];
    const set = getExploredSet(fog);
    const gx0 = Math.floor((cx - radius) / cellSize);
    const gx1 = Math.floor((cx + radius) / cellSize);
    const gy0 = Math.floor((cy - radius) / cellSize);
    const gy1 = Math.floor((cy + radius) / cellSize);
    for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
            const px = gx * cellSize + cellSize / 2;
            const py = gy * cellSize + cellSize / 2;
            if (Math.hypot(px - cx, py - cy) <= radius) {
                const key = gx + ',' + gy;
                if (!set.has(key)) {
                    set.add(key);
                    set.__len++;
                    fog.explored.push(key);
                }
            }
        }
    }
}

// Traces the current path for a light source's reach: a plain circle if
// there are no walls, or a wall-occluded visibility polygon (same raycast
// technique used for token vision) so LoS walls actually block light instead
// of the light bleeding straight through them.
function traceLightPath(ctx, light, walls) {
    const radius = Math.max(light.radius, 1);
    ctx.beginPath();
    if (walls && walls.length > 0) {
        const poly = computeLineOfSight(light.x, light.y, radius, walls);
        if (poly.length > 0) {
            ctx.moveTo(poly[0].x, poly[0].y);
            for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
            ctx.closePath();
        }
    } else {
        ctx.arc(light.x, light.y, radius, 0, Math.PI * 2);
    }
}

export function computeLineOfSight(cx, cy, maxRange, walls) {
    const numRays = 72;
    const points = [];
    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let hitDist = maxRange;
        for (const wall of walls) {
            const dist = raySegmentIntersect(cx, cy, dx, dy, wall.x1, wall.y1, wall.x2, wall.y2);
            if (dist !== null && dist < hitDist) hitDist = dist;
        }
        points.push({ x: cx + dx * hitDist, y: cy + dy * hitDist });
    }
    return points;
}

// ── Drawing Fog Overlay ──
export function drawFogOfWar(cellSize) {
    if (!ctx) return;
    const fog = state.gridCombat.fogOfWar;
    if (!fog || !fog.enabled) return;

    // Determine perspective
    const isPlayer = isVttPlayer() || (playerViewActive && canControlFog());

    ctx.save();
    // Draw darkness overlay
    if (isPlayer) {
        ctx.fillStyle = `rgba(5, 5, 12, ${fog.darkness})`;
    } else {
        ctx.fillStyle = `rgba(5, 5, 12, ${fog.darkness * 0.35})`;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut holes
    ctx.globalCompositeOperation = 'destination-out';
    for (const r of (fog.revealed || [])) {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    for (const light of (fog.lightSources || [])) {
        const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.max(light.radius, 1));
        const alpha = light.intensity ?? 1;
        grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
        grad.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        traceLightPath(ctx, light, fog.walls);
        ctx.fill();
    }

    if (fog.mode === 'token-vision' || fog.mode === 'line-of-sight') {
        const tokens = state.gridCombat.tokens || [];

        // "Memory" pass: dim (not pitch-black) any cell a token has ever
        // seen, so previously-explored rooms don't vanish the instant a
        // token turns away. Cut before the live-vision holes below so
        // currently-visible cells still end up fully revealed.
        if (fog.rememberExplored !== false && fog.explored && fog.explored.length) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            for (const key of fog.explored) {
                const [gx, gy] = key.split(',').map(Number);
                ctx.fillRect(gx * cellSize, gy * cellSize, cellSize, cellSize);
            }
            ctx.restore();
        }

        for (const t of tokens) {
            if (t.faction !== 'ally' && t.faction !== 'player') continue;
            // Nullish check on purpose: a token explicitly set to 0 vision
            // (e.g. blinded) must stay blind, not silently fall back to 3.
            const visionCells = typeof t.vision === 'number' ? t.vision : 3;
            if (visionCells <= 0) continue;
            const visionRadius = cellSize * visionCells;
            const cx = t.x + cellSize / 2;
            const cy = t.y + cellSize / 2;
            if (fog.rememberExplored !== false) markExplored(fog, cx, cy, visionRadius, cellSize);
            if (fog.mode === 'line-of-sight' && (fog.walls || []).length > 0) {
                const poly = computeLineOfSight(cx, cy, visionRadius, fog.walls || []);
                if (poly.length > 0) {
                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visionRadius);
                    grad.addColorStop(0, 'rgba(0,0,0,0.9)');
                    grad.addColorStop(0.8, 'rgba(0,0,0,0.4)');
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(poly[0].x, poly[0].y);
                    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
                    ctx.closePath();
                    ctx.fill();
                }
            } else {
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, visionRadius);
                grad.addColorStop(0, 'rgba(0,0,0,0.9)');
                grad.addColorStop(0.8, 'rgba(0,0,0,0.4)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, visionRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.restore();

    // Additive light tint
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const light of (fog.lightSources || [])) {
        const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.max(light.radius, 1));
        grad.addColorStop(0, light.color || 'rgba(255, 220, 150, 0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        traceLightPath(ctx, light, fog.walls);
        ctx.fill();
    }
    ctx.restore();

    // GM markers
    if (canControlFog() && !isPlayer) {
        ctx.save();
        ctx.strokeStyle = 'rgba(196, 90, 90, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        for (const wall of (fog.walls || [])) {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();

        ctx.save();
        for (const light of (fog.lightSources || [])) {
            ctx.beginPath();
            ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(light.x, light.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    } else if (isPlayer) {
        ctx.save();
        for (const light of (fog.lightSources || [])) {
            ctx.beginPath();
            ctx.arc(light.x, light.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 100, 0.4)';
            ctx.fill();
        }
        ctx.restore();
    }
}

// ── Painting fog cells ──
// brushCells: side length of the square brush, in grid cells (default 1 = a
// single cell, matching the previous behavior). Lets the GM reveal/hide a
// whole room in a couple of drags instead of one cell per stroke.
export function paintFogCell(pos, cellSize, reveal, brushCells = 1) {
    const fog = state.gridCombat.fogOfWar;
    if (!fog) return;
    const n = Math.max(1, Math.round(brushCells));
    const half = Math.floor(n / 2);
    const originGx = Math.floor(pos.x / cellSize) - half;
    const originGy = Math.floor(pos.y / cellSize) - half;

    for (let dx = 0; dx < n; dx++) {
        for (let dy = 0; dy < n; dy++) {
            const cx = (originGx + dx) * cellSize;
            const cy = (originGy + dy) * cellSize;
            if (reveal) {
                const exists = (fog.revealed || []).some(r =>
                    r.x === cx && r.y === cy && r.w === cellSize && r.h === cellSize
                );
                if (!exists) fog.revealed.push({ x: cx, y: cy, w: cellSize, h: cellSize });
            } else {
                fog.revealed = (fog.revealed || []).filter(r =>
                    !(r.x === cx && r.y === cy)
                );
            }
        }
    }
    // Re-render without saving (caller will save)
}
