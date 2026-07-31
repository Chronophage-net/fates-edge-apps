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
        ctx.beginPath();
        ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
        ctx.fill();
    }

    if (fog.mode === 'token-vision' || fog.mode === 'line-of-sight') {
        const tokens = state.gridCombat.tokens || [];
        for (const t of tokens) {
            if (t.faction !== 'ally' && t.faction !== 'player') continue;
            const visionCells = t.vision > 0 ? t.vision : 3;
            const visionRadius = cellSize * visionCells;
            const cx = t.x + cellSize / 2;
            const cy = t.y + cellSize / 2;
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
        ctx.beginPath();
        ctx.arc(light.x, light.y, Math.max(light.radius, 1), 0, Math.PI * 2);
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
export function paintFogCell(pos, cellSize, reveal) {
    const fog = state.gridCombat.fogOfWar;
    if (!fog) return;
    const cx = Math.floor(pos.x / cellSize) * cellSize;
    const cy = Math.floor(pos.y / cellSize) * cellSize;
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
    // Re-render without saving (caller will save)
}
