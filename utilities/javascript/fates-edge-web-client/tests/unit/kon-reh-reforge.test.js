import { describe, it, assertTrue, assertEqual } from '../runner.js';
import { KonrehEngine, chooseAiMove, evaluate, reforgeOutlook, apexThreats, stateTags, SCHOOLS } from '../../js/features/kon-reh/index.js';

// ---------------------------------------------------------------------------
// The five-turn Reforge race is Kon'reh's most distinctive mechanic, and it
// was the one the AI could not play. With the old Manhattan-distance term it
// would drift sideways for five turns and lose on the clock without ever
// contesting the banner -- a real logged game ended
//
//   Stall -> (2,6), Stall -> (0,6), Stall -> (0,7), Stall -> (1,7), Barker -> (1,3)
//
// which is a shuffle, not a race: turns 3 and 4 move *away* from the apex at
// (0,0). These tests pin the behaviour that replaced it.
// ---------------------------------------------------------------------------

// A board stripped to a single race: P2's Blue is dead, the clock is running,
// and P2 has one runner plus enough of P1 around to make the lanes matter.
function raceBoard({ runnerType = 'green', at = { x: 4, y: 4 } } = {}) {
    const e = new KonrehEngine();
    e.pieces = [];
    e.board = Array(8).fill(null).map(() => Array(8).fill(null));
    e.greenCount = 0;

    e.addPiece(1, 'blue', 0, 0);   // P1's Blue sits on its own apex
    e.addPiece(1, 'red', 5, 0);
    e.addPiece(2, runnerType, at.x, at.y);

    e.blueAlive[2] = false;
    e.reforgeCountdown[2] = 5;
    e.openingDoubleMoveDone = true;
    e.turn = 2;
    return e;
}

// Play the position out as a real game: P2 races, P1 plays its own best
// moves and is free to try to stop it. Returns whether P2 planted, and how
// many of its own turns it used. The earlier version of this helper only
// moved P2, which meant chooseAiMove() returned null the moment the turn
// passed to P1 and the "race" was one move long.
function playRace(e, { turns = 5, school = 'vilikari', depth = 3 } = {}) {
    const log = [];
    let p2Turns = 0;
    while (p2Turns < turns && !e.winner && !e.pendingReforge) {
        const mover = e.turn;
        const cand = chooseAiMove(e, mover, school, depth);
        if (!cand) break;
        const piece = e.pieces.find(x => x.id === cand.pieceId);
        log.push(`P${mover} ${piece.type} (${piece.x},${piece.y})->(${cand.move.x},${cand.move.y})`);
        if (mover === 2) p2Turns++;
        e.makeMove(cand.pieceId, cand.move);
    }
    return { planted: !!e.pendingReforge, p2Turns, log };
}

function distToP2Goal(p) {
    // P2 runs at P1's Home Apex, (0,0).
    return Math.abs(p.x - 0) + Math.abs(p.y - 0);
}

describe('Kon\'reh — Reforge race', () => {
    it('the AI closes on the enemy Home Apex instead of shuffling', () => {
        const e = raceBoard();
        const runner = e.pieces.find(p => p.player === 2);
        const startDist = distToP2Goal(runner);

        // Five breaths, exactly as the rules give it.
        const { planted, log } = playRace(e);

        const survivor = e.pieces.find(p => p.player === 2 && p.isAlive);
        const endDist = planted ? 0 : (survivor ? distToP2Goal(survivor) : startDist);

        // The specific regression: the AI must not end the race further from
        // the banner than it started. (It should in fact plant -- asserted
        // separately below -- but this is the claim the old log violated.)
        assertTrue(endDist < startDist,
            `runner should close on (0,0): started ${startDist} away, ended ${endDist}\n${log.join('\n')}`);
    });

    it('a Green with a clear run plants the banner inside the clock', () => {
        // Green covers 4 onward. From (4,4) the lane to (0,0) is open, so a
        // competent player gets there in two moves. A search that cannot find
        // that is not playing the endgame.
        const e = raceBoard({ runnerType: 'green', at: { x: 4, y: 4 } });
        const { planted, p2Turns, log } = playRace(e);
        assertTrue(planted,
            `Green runner should reach (0,0) and plant within 5 turns (used ${p2Turns})\n${log.join('\n')}`);
    });

    it('a slower Red still walks the right way', () => {
        // Red covers only 2 onward, so it cannot always make it -- but every
        // move it makes should still be progress, which is precisely what the
        // old gradient failed to guarantee once ZoC or the edge got involved.
        const e = raceBoard({ runnerType: 'red', at: { x: 4, y: 4 } });
        const before = distToP2Goal(e.pieces.find(p => p.player === 2));
        const cand = chooseAiMove(e, 2, 'vilikari', 3);
        assertTrue(!!cand, 'a move should exist');
        e.makeMove(cand.pieceId, cand.move);
        const after = distToP2Goal(e.pieces.find(p => p.player === 2 && p.isAlive));
        assertTrue(after < before, `Red should close, not drift: ${before} -> ${after}`);
    });

    it('prefers the runner that actually has a path over the merely nearer one', () => {
        // A Red parked one square from the apex but sealed behind P1's Blue
        // has no plan; a Green further out with a clean lane does. Manhattan
        // distance sees only the Red.
        const e = new KonrehEngine();
        e.pieces = [];
        e.board = Array(8).fill(null).map(() => Array(8).fill(null));
        e.greenCount = 0;
        e.addPiece(1, 'blue', 0, 0);
        e.addPiece(1, 'red', 0, 2);      // seals the file below the apex
        e.addPiece(2, 'red', 0, 3);      // nearest, but boxed in
        e.addPiece(2, 'green', 4, 4);    // further, but has the lane
        e.blueAlive[2] = false;
        e.reforgeCountdown[2] = 5;
        e.openingDoubleMoveDone = true;
        e.turn = 2;

        const cand = chooseAiMove(e, 2, 'vilikari', 3);
        assertTrue(!!cand, 'a move should exist');
        const moved = e.pieces.find(p => p.id === cand.pieceId);
        assertEqual(moved.type, 'green', 'should move the runner with a real path, not the nearest one');
    });

    it('scores planting the banner as a success, not as losing the runner', () => {
        // The regression: planting removes the runner from the board and
        // leaves blueAlive false until the placement resolves, so an
        // evaluation that just counts runners reads the winning move as
        // "Blue dead, nobody left to run" and scores it catastrophically.
        // Measured before the fix: the plant scored -2640 while a sideways
        // shuffle scored -360, so the search avoided the win.
        const e = raceBoard({ runnerType: 'green', at: { x: 0, y: 4 } });
        const runner = e.pieces.find(p => p.player === 2);
        const w = SCHOOLS.vilikari.weights;
        const before = evaluate(e, w, 2);

        const planting = e.getValidMoves(runner.id).find(m => m.x === 0 && m.y === 0);
        assertTrue(!!planting, 'the Green should be able to reach (0,0) from (0,4)');
        e.makeMove(runner.id, planting);

        assertTrue(!!e.pendingReforge, 'reaching the apex should plant the banner');
        assertTrue(evaluate(e, w, 2) > before,
            'the planted position must score better than the position before the plant');
    });

    it('reports an unreachable apex honestly rather than inventing a plan', () => {
        // The cliff the old term never managed to express. A Red covers 2
        // squares per Onward move, so from the far corner it needs seven of
        // them; with two breaths left there is no plan, and the evaluation
        // must say null rather than report a shrinking distance as progress.
        const e = raceBoard({ runnerType: 'red', at: { x: 7, y: 7 } });
        e.reforgeCountdown[2] = 2;
        const { turns, optimisticTurns } = reforgeOutlook(e, 2);
        assertEqual(turns, null, 'a Red 14 squares out cannot arrive in 2 turns');
        assertEqual(optimisticTurns, null, 'and clearing the board would not save it either');
    });
});

describe('Kon\'reh — move-log state tags', () => {
    // The point of these is auditability: "I beat the CPU" vs "I beat the CPU
    // and can show the engine was keeping the timers the rules ask for".
    const plain = g => g.replace(/<[^>]*>/g, '');

    it('reports the Green dial on every move', () => {
        const e = new KonrehEngine();
        assertTrue(plain(stateTags(e, 1)).includes('[G:1-1]'),
            `each side opens with one Green: ${plain(stateTags(e, 1))}`);
    });

    it('reports the Cross clock, exclusion and spent specials', () => {
        const e = new KonrehEngine();
        const blue = e.getBlue(1);
        blue.crossStays = 2;
        blue.crossExclusion = 1;
        blue.specialsUsed.push('S:D');
        blue.rooted = true;
        const out = plain(stateTags(e, 1));
        assertTrue(out.includes('[CF:in 2/3]'), `cross stay: ${out}`);
        assertTrue(out.includes('[Excl:1]'), `exclusion: ${out}`);
        assertTrue(out.includes('[S:D]'), `specials: ${out}`);
        assertTrue(out.includes('[Rooted]'), `rooted: ${out}`);
    });

    it('reports the Reforge countdown, labelled by side', () => {
        const e = new KonrehEngine();
        const b2 = e.getBlue(2);
        e.board[b2.y][b2.x] = null;
        b2.isAlive = false;
        e.blueAlive[2] = false;
        e.reforgeCountdown[2] = 4;
        const out = plain(stateTags(e, 1));
        assertTrue(out.includes('[RC P2 4/5]'),
            `both sides can be racing at once, so the tag names the side: ${out}`);
    });
});

describe('Kon\'reh — the two-lane Reforge rule', () => {
    // The apex is reachable along exactly two straight lanes, and they are
    // disjoint except at the apex square itself. One defensive move occupies
    // one square, so it cannot answer two runners that are each one Onward
    // move from the apex on DIFFERENT lanes. Verified exhaustively below
    // against every legal reply, Blue's slide-then-special included.
    function board(p2pieces, clear = []) {
        const e = new KonrehEngine();
        for (const p of e.pieces) if (p.player === 2 && p.isAlive) { e.board[p.y][p.x] = null; p.isAlive = false; }
        for (const [x, y] of clear) { const q = e.getPieceAt(x, y); if (q) { e.board[y][x] = null; q.isAlive = false; } }
        e.greenCount = e.pieces.filter(q => q.isAlive && q.type === 'green').length;
        for (const [t, x, y] of p2pieces) e.addPiece(2, t, x, y);
        const b = e.getBlue(1); if (b) b.mobilizationDelay = false;
        e.blueAlive[2] = false;
        e.reforgeCountdown[2] = 5;
        e.openingDoubleMoveDone = true;
        e.turn = 2;
        return e;
    }
    const CLEAR_BOTH = [[0, 1], [0, 2], [0, 3], [1, 0], [2, 0], [3, 0]];

    it('counts threats by lane, not by piece', () => {
        // A Green threatens from exactly 4 out; a Red from exactly 2.
        assertEqual(apexThreats(board([['green', 0, 4]], CLEAR_BOTH), 2).live, 1);
        assertEqual(apexThreats(board([['green', 0, 4], ['green', 4, 0]], CLEAR_BOTH), 2).live, 2);
        assertEqual(apexThreats(board([['red', 0, 2], ['red', 2, 0]], [[0, 1], [1, 0]]), 2).live, 2);
        // Off-lane, or at the wrong distance, is not a threat at all.
        assertEqual(apexThreats(board([['green', 4, 4]], CLEAR_BOTH), 2).live, 0);
        assertEqual(apexThreats(board([['green', 0, 2]], CLEAR_BOTH), 2).standing, 0);
    });

    it('scores a blocked threat as pinning the blocker, not as a dead runner', () => {
        // The Green cannot advance, but P1's piece on (0,1) is nailed there
        // for as long as it stands. Treating that as worthless is what had
        // runners walking away from squares the defender was paying to hold.
        const e = board([['green', 0, 4]], [[0, 2], [0, 3]]);
        const t = apexThreats(e, 2);
        assertEqual(t.live, 0, 'the lane is plugged, so nothing is live');
        assertEqual(t.standing, 1, 'but the threat still stands');
        assertTrue(t.pinned >= 1, 'and it pins the blocker');
    });

    it('no single defensive reply can answer two lane-distinct threats', () => {
        // Exhaustive over every legal P1 move, Blue's specials included.
        const setups = [
            [[['green', 0, 4], ['green', 4, 0]], CLEAR_BOTH],
            [[['red', 0, 2], ['red', 2, 0]], [[0, 1], [1, 0]]],
            [[['green', 0, 4], ['red', 2, 0]], [[0, 1], [0, 2], [0, 3], [1, 0]]],
        ];
        for (const [runners, clear] of setups) {
            const probe = board(runners, clear);
            assertEqual(apexThreats(probe, 2).live, 2, 'setup should start with two live threats');
            probe.turn = 1; // so getValidMoves will enumerate the defender's replies
            let bestDefence = 2;
            for (const p of probe.pieces.filter(q => q.isAlive && q.player === 1)) {
                const key = [p.type, p.x, p.y];
                for (const mv of probe.getValidMoves(p.id)) {
                    const c = board(runners, clear);
                    c.turn = 1;
                    const cp = c.pieces.find(q => q.isAlive && q.player === 1
                        && q.type === key[0] && q.x === key[1] && q.y === key[2]);
                    if (!cp || !c.makeMove(cp.id, mv)) continue;
                    bestDefence = Math.min(bestDefence, apexThreats(c, 2).live);
                }
            }
            assertEqual(bestDefence, 1,
                'the best the defender can do is cut one lane, leaving one live threat');
        }
    });

    it('plants against a defender who moves first', () => {
        const e = board([['green', 0, 4], ['green', 4, 0]], CLEAR_BOTH);
        e.turn = 1; // let the defender try to stop it
        let p2 = 0;
        while (p2 < 5 && !e.winner && !e.pendingReforge) {
            const mover = e.turn;
            const c = chooseAiMove(e, mover, mover === 2 ? 'vilikari' : 'ykrul', 3);
            if (!c) break;
            if (mover === 2) p2++;
            e.makeMove(c.pieceId, c.move);
        }
        assertTrue(!!e.pendingReforge, 'two lane-distinct threats should force the banner through');
    });

    it('builds the second lane when the first is already threatened', () => {
        // Green on the y-lane threat square; a second Green that can step to
        // the x-lane threat square. Opening the SECOND lane is the winning
        // idea, and it is not the move that shortens any distance.
        const e = board([['green', 0, 4], ['green', 4, 4]], CLEAR_BOTH);
        const c = chooseAiMove(e, 2, 'vilikari', 3);
        assertTrue(!!c, 'a move should exist');
        assertTrue(c.move.x === 4 && c.move.y === 0,
            `should occupy the x-lane threat square (4,0), got (${c.move.x},${c.move.y})`);
    });
});