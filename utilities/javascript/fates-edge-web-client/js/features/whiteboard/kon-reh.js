// ============================================================
//  KON'REH ENGINE — implementation of the official LaTeX rulebook
//  ("Corpus Canré Scholiatum" / Kon'reh Core Rules §1–9)
// ============================================================
//
// Board: 8x8 grid, logical (x,y) both in [0,7].
//   Player 1 Home Apex = (0,0)   Player 2 Home Apex = (7,7)
//   Sanctums            = (0,7) and (7,0)
//   Central Four (Cross)= (3,3) (3,4) (4,3) (4,4)
//
// Movement (the defining mechanic of this ruleset): every piece has an
// ONWARD distance (exact — must travel the full distance, no shorter
// stop permitted) along the two lanes leading away from its own Home
// Apex, and a HOMEWARD distance (up to — may stop at any square from 1
// up to the max) along the two lanes leading back toward its own Home
// Apex. A move can never pass through an occupied square, and entering
// enemy Zone of Control (ZoC) — the four orthogonally-adjacent squares
// around every enemy piece — ends the move immediately, so an "exact"
// onward move that would be interrupted early by a blocker or ZoC
// simply has no legal destination in that lane at all.
//
// Red/Orange/Green capture by displacement (landing on the enemy
// square) on either lane. Blue's own onward/homeward slide can only
// land on EMPTY squares — Blue captures exclusively through its two
// per-life specials, Displacement and Hop.
//
// This file has ZERO DOM dependencies so it can be unit tested with
// plain Node, then reused verbatim inside the browser UI module.

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const ONWARD_DIST = { red: 2, orange: 3, green: 4, blue: 5 };
export const HOMEWARD_DIST = { red: 1, orange: 2, green: 3, blue: 4 };

export class KonrehEngine {
  constructor() { this.reset(); }

  reset() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.pieces = [];
    this.turn = 1;
    this.winner = null;          // null | 1 | 2 | 'draw'
    this.winReason = null;       // human readable reason

    // --- Opening double-move (Player 2 only, once, at the very start) ---
    this.openingDoubleMoveDone = false; // becomes true forever once P2's opening double-move completes
    this.firstMoveDone = false;         // within the opening double-move: has move #1 happened?
    this.doubleMoveUsed = new Set();    // piece ids already used during the opening double-move

    this.reforgeCountdown = { 1: 0, 2: 0 };
    this.blueAlive = { 1: true, 2: true };
    this.greenCount = 0;
    this.moveHistory = [];
    this.pendingReforge = null;  // { player, options: [...] } while awaiting a UI choice

    this.setupDefaultBoard();
    this.startTurn();
  }

  // Official setup (Components & Setup): from each player's Home Apex
  // outward, four ranks of length 1-2-3-4:
  //   R1 (len 1): Blue on Home Apex
  //   R2 (len 2): 2 Oranges
  //   R3 (len 3): Red - Green - Red
  //   R4 (len 4): 4 Reds
  setupDefaultBoard() {
    // Player 1 — Home Apex (0,0), onward = +x / +y
    this.addPiece(1, 'blue', 0, 0);
    this.addPiece(1, 'orange', 1, 0);
    this.addPiece(1, 'orange', 0, 1);
    this.addPiece(1, 'red', 2, 0);
    this.addPiece(1, 'green', 1, 1);
    this.addPiece(1, 'red', 0, 2);
    this.addPiece(1, 'red', 3, 0);
    this.addPiece(1, 'red', 2, 1);
    this.addPiece(1, 'red', 1, 2);
    this.addPiece(1, 'red', 0, 3);

    // Player 2 — Home Apex (7,7), onward = -x / -y (mirrored)
    this.addPiece(2, 'blue', 7, 7);
    this.addPiece(2, 'orange', 6, 7);
    this.addPiece(2, 'orange', 7, 6);
    this.addPiece(2, 'red', 5, 7);
    this.addPiece(2, 'green', 6, 6);
    this.addPiece(2, 'red', 7, 5);
    this.addPiece(2, 'red', 4, 7);
    this.addPiece(2, 'red', 5, 6);
    this.addPiece(2, 'red', 6, 5);
    this.addPiece(2, 'red', 7, 4);
  }

  addPiece(player, type, x, y) {
    const p = {
      id: `p${this.pieces.length + 1}`,
      player, type, x, y, isAlive: true,
      crossStays: 0,
      crossExclusion: 0,
      crossExclusionJustSet: false, // internal: prevents the exclusion timer from being
                                     // decremented on the very turn it was set
      specialsUsed: [],             // e.g. ['S:D', 'S:H']
      rooted: false,
      mobilizationDelay: true,
      seedBanSanctum: null,         // e.g. '0,7' — set after a Reforge-to-Sanctum placement
    };
    this.pieces.push(p);
    this.board[y][x] = p.id;
    if (type === 'green') this.greenCount++;
    return p;
  }

  getPieceAt(x, y) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    const id = this.board[y][x];
    return id ? this.pieces.find(p => p.id === id) : null;
  }

  getBlue(player) {
    return this.pieces.find(p => p.type === 'blue' && p.player === player && p.isAlive);
  }

  // excludeId lets a walk ignore the ZoC contribution of one specific
  // piece — used so that a piece's own ZoC (projected onto the square
  // immediately before it) never blocks a straight-line slide from
  // reaching and capturing that very piece. Any OTHER piece's ZoC on
  // that same square still applies normally.
  isInEnemyZoc(x, y, player, excludeId) {
    for (const [dx, dy] of DIRS) {
      const p = this.getPieceAt(x + dx, y + dy);
      if (p && p.player !== player && p.isAlive && p.id !== excludeId) return true;
    }
    return false;
  }

  isCross(x, y) { return (x === 3 || x === 4) && (y === 3 || y === 4); }
  isSanctum(x, y) { return (x === 0 && y === 7) || (x === 7 && y === 0); }
  isHomeApex(x, y, player) {
    return (player === 1 && x === 0 && y === 0) ||
           (player === 2 && x === 7 && y === 7);
  }
  homeApexOf(player) { return player === 1 ? { x: 0, y: 0 } : { x: 7, y: 7 }; }
  enemyHomeApexOf(player) { return player === 1 ? { x: 7, y: 7 } : { x: 0, y: 0 }; }

  // The two Onward lanes (away from own Home Apex) and two Homeward
  // lanes (back toward own Home Apex) for a given player.
  lanesFor(player) {
    return player === 1
      ? { onward: [[1, 0], [0, 1]], homeward: [[-1, 0], [0, -1]] }
      : { onward: [[-1, 0], [0, -1]], homeward: [[1, 0], [0, 1]] };
  }

  // HOMEWARD ("up to") walk: a real slide with a genuine choice of how far
  // to travel, so ZoC behaves as normal — entering an enemy ZoC square
  // ends the move immediately (that square is still a legal landing spot,
  // it just can't be traveled past). Stops permanently on a friendly
  // blocker, the edge of the board, a capture (no passing through it), or
  // ZoC entry.
  walkHomeward(x, y, dx, dy, maxDist, player) {
    const results = [];
    for (let d = 1; d <= maxDist; d++) {
      const nx = x + dx * d, ny = y + dy * d;
      if (nx < 0 || nx > 7 || ny < 0 || ny > 7) break;
      const occ = this.getPieceAt(nx, ny);
      if (occ) {
        if (occ.player === player) break; // blocked by own piece — no passing through
        results.push({ x: nx, y: ny, dist: d, capture: true, targetId: occ.id, zoc: this.isInEnemyZoc(nx, ny, player) });
        break; // cannot pass through the captured square either
      }
      // An enemy occupying the very next square shouldn't have its own
      // ZoC (projected backward onto this empty square) block our
      // approach toward capturing it — see isInEnemyZoc's excludeId.
      // ZoC from any OTHER enemy on this square still ends the move.
      const aheadX = x + dx * (d + 1), aheadY = y + dy * (d + 1);
      const ahead = this.getPieceAt(aheadX, aheadY);
      const excludeId = (ahead && ahead.player !== player) ? ahead.id : null;
      const zoc = this.isInEnemyZoc(nx, ny, player, excludeId);
      results.push({ x: nx, y: ny, dist: d, capture: false, zoc });
      if (zoc) break; // entering ZoC ends the move immediately
    }
    return results;
  }

  // ONWARD ("exact") walk: there is only ever one legal distance, so there
  // is no notion of "choosing" to stop early. Only actual pieces (friendly
  // or enemy) block the path — "no passing through pieces" — for the
  // squares strictly before the required distance. ZoC does not force an
  // early stop here: since the penultimate square of ANY straight
  // approach is always orthogonally adjacent to (and so always inside the
  // ZoC of) whatever occupies the final square, treating ZoC as
  // path-blocking for exact-distance moves would make onward captures at
  // distance >= 2 impossible for every piece in the game — clearly not
  // the intent, since the rules explicitly describe onward captures.
  // ZoC still matters for whether Blue may chain a Special afterward
  // (tracked via the returned `zoc` flag on the result), just not for
  // whether the exact-distance square is reachable at all.
  // Returns the single landing point at exactDist if reachable, else null.
  walkOnwardExact(x, y, dx, dy, exactDist, player) {
    for (let d = 1; d < exactDist; d++) {
      const nx = x + dx * d, ny = y + dy * d;
      if (nx < 0 || nx > 7 || ny < 0 || ny > 7) return null;
      if (this.getPieceAt(nx, ny)) return null; // any piece — friend or foe — blocks passage
    }
    const fx = x + dx * exactDist, fy = y + dy * exactDist;
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    const occ = this.getPieceAt(fx, fy);
    if (occ && occ.player === player) return null; // cannot land on / capture own piece
    return { x: fx, y: fy, dist: exactDist, capture: !!occ, targetId: occ ? occ.id : undefined, zoc: this.isInEnemyZoc(fx, fy, player) };
  }

  // ---------- Turn management ----------
  startTurn() {
    if (this.winner) return;
    const blue = this.getBlue(this.turn);
    if (blue && blue.rooted) blue.rooted = false;

    // Stalemate safety net: if the side to move has no legal move anywhere,
    // the game is declared a draw rather than soft-locking.
    if (!this.pendingReforge && !this.hasAnyLegalMove(this.turn)) {
      this.winner = 'draw';
      this.winReason = `Player ${this.turn} has no legal move.`;
    }
  }

  hasAnyLegalMove(player) {
    for (const p of this.pieces) {
      if (p.isAlive && p.player === player) {
        if (this.getValidMoves(p.id).length > 0) return true;
      }
    }
    return false;
  }

  // Called once, exactly when a player's turn truly concludes (i.e. NOT after
  // move #1 of Player 2's opening double-move).
  applyEndOfTurnUpkeep(player) {
    // Cross exclusion ticks down once per the owner's own completed turn,
    // but never on the very turn it was just set (that turn is turn zero
    // of the two-turn ban, not the first tick).
    const blue = this.getBlue(player);
    if (blue) {
      if (blue.crossExclusionJustSet) {
        blue.crossExclusionJustSet = false;
      } else if (blue.crossExclusion > 0) {
        blue.crossExclusion--;
      }
    }

    // Reforge countdown: the captured side gets exactly 5 of its own turns
    // to plant. Decrement at the END of each such turn (after the attempt),
    // so all 5 turns are genuinely usable.
    if (!this.blueAlive[player] && this.reforgeCountdown[player] > 0) {
      this.reforgeCountdown[player]--;
      if (this.reforgeCountdown[player] === 0) {
        this.winner = player === 1 ? 2 : 1;
        this.winReason = `Player ${player} failed to Reforge in time.`;
      }
    }
  }

  endTurn() {
    if (this.winner) return;

    // Player 2's opening double-move: move #1 doesn't end the turn.
    if (this.turn === 2 && !this.openingDoubleMoveDone && !this.firstMoveDone) {
      this.firstMoveDone = true;
      return;
    }
    if (this.turn === 2 && !this.openingDoubleMoveDone && this.firstMoveDone) {
      this.openingDoubleMoveDone = true; // opening double-move is now permanently spent
    }

    const concludingPlayer = this.turn;
    this.applyEndOfTurnUpkeep(concludingPlayer);
    if (this.winner) return;

    this.turn = this.turn === 1 ? 2 : 1;
    this.firstMoveDone = false;
    this.doubleMoveUsed.clear();
    this.startTurn();
  }

  // ---------- Move generation ----------
  getValidMoves(pieceId) {
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.isAlive || this.winner || this.pendingReforge) return [];
    if (piece.player !== this.turn) return [];
    if (piece.rooted) return [];

    // During P2's opening double-move, the same piece can't be used twice.
    if (this.turn === 2 && !this.openingDoubleMoveDone && this.doubleMoveUsed.has(piece.id)) {
      return [];
    }

    let moves = [];

    if (piece.type === 'blue') {
      const slideBasis = this.getBlueSlides(piece);           // includes the 0-length "stay" basis
      const specials = this.getBlueSpecials(piece, slideBasis);
      const actualSlides = slideBasis
        .filter(s => !(s.x === piece.x && s.y === piece.y))
        .map(s => ({ x: s.x, y: s.y, capture: false }));
      moves = [...actualSlides, ...specials];
      moves = moves.filter(m => this.isValidBlueCrossMove(piece, m));
    } else {
      moves = this.getPieceMoves(piece);
    }

    return moves;
  }

  // Red / Orange / Green: exact-distance Onward, up-to-distance Homeward,
  // capture by displacement on either lane.
  getPieceMoves(piece) {
    const { onward, homeward } = this.lanesFor(piece.player);
    const onwardDist = ONWARD_DIST[piece.type];
    const homewardDist = HOMEWARD_DIST[piece.type];
    const moves = [];

    for (const [dx, dy] of onward) {
      const landing = this.walkOnwardExact(piece.x, piece.y, dx, dy, onwardDist, piece.player);
      if (landing) moves.push({ x: landing.x, y: landing.y, capture: landing.capture, targetId: landing.targetId });
    }
    for (const [dx, dy] of homeward) {
      const path = this.walkHomeward(piece.x, piece.y, dx, dy, homewardDist, piece.player);
      for (const step of path) {
        moves.push({ x: step.x, y: step.y, capture: step.capture, targetId: step.targetId });
      }
    }
    return moves;
  }

  // Blue's own plain slide (Onward exact-5 / Homeward up-to-4). Blue's
  // plain slide can only end on an EMPTY square — capture is reserved
  // for the Displacement/Hop specials — so any capture entries returned
  // by walkLane are simply not usable as Blue slide destinations.
  getBlueSlides(piece) {
    const basis = [{ x: piece.x, y: piece.y, slideEnteredZoc: false }];
    const { onward, homeward } = this.lanesFor(piece.player);
    const onwardDist = ONWARD_DIST.blue, homewardDist = HOMEWARD_DIST.blue;

    for (const [dx, dy] of onward) {
      const landing = this.walkOnwardExact(piece.x, piece.y, dx, dy, onwardDist, piece.player);
      if (landing && !landing.capture) {
        basis.push({ x: landing.x, y: landing.y, slideEnteredZoc: landing.zoc });
      }
    }
    for (const [dx, dy] of homeward) {
      const path = this.walkHomeward(piece.x, piece.y, dx, dy, homewardDist, piece.player);
      for (const step of path) {
        if (step.capture) continue; // Blue cannot capture via plain slide
        basis.push({ x: step.x, y: step.y, slideEnteredZoc: step.zoc });
      }
    }
    return basis;
  }

  getBlueSpecials(piece, slideBasis) {
    const moves = [];
    const validBasis = slideBasis.filter(s => !s.slideEnteredZoc);

    for (const slide of validBasis) {
      for (const [dx, dy] of DIRS) {
        if (!piece.specialsUsed.includes('S:D')) {
          const tx = slide.x + dx;
          const ty = slide.y + dy;
          const target = this.getPieceAt(tx, ty);
          if (target && target.player !== piece.player && target.isAlive) {
            moves.push({
              x: tx, y: ty,
              capture: true,
              targetId: target.id,
              slideEnd: { x: slide.x, y: slide.y },
              special: 'S:D'
            });
          }
        }
        if (!piece.specialsUsed.includes('S:H')) {
          const mx = slide.x + dx, my = slide.y + dy;
          const lx = slide.x + dx * 2, ly = slide.y + dy * 2;
          if (lx < 0 || lx > 7 || ly < 0 || ly > 7) continue;
          const mid = this.getPieceAt(mx, my);
          const land = this.getPieceAt(lx, ly);
          if (mid && mid.player !== piece.player && mid.isAlive && !land) {
            moves.push({
              x: lx, y: ly,
              capture: true,
              targetId: mid.id,
              slideEnd: { x: slide.x, y: slide.y },
              special: 'S:H'
            });
          }
        }
      }
    }
    return moves;
  }

  isValidBlueCrossMove(piece, move) {
    const isInCross = this.isCross(move.x, move.y);
    const wasInCross = this.isCross(piece.x, piece.y);
    if (isInCross && !wasInCross) {
      if (piece.crossExclusion > 0) return false;
      if (piece.crossStays >= 3) return false;
    } else if (isInCross && wasInCross) {
      if (piece.crossStays >= 3) return false;
    }
    return true;
  }

  // ---------- Execute a move ----------
  makeMove(pieceId, move) {
    if (this.winner || this.pendingReforge) return false;
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.isAlive || piece.rooted) return false;
    if (piece.player !== this.turn) return false;

    const withinOpeningDoubleMove = this.turn === 2 && !this.openingDoubleMoveDone;
    if (withinOpeningDoubleMove) this.doubleMoveUsed.add(piece.id);

    const prevX = piece.x, prevY = piece.y;
    const wasInCross = this.isCross(prevX, prevY);
    const runnerWasGreenBeforeCapture = piece.type === 'green';

    // 1. Slide (Blue specials pivot through an intermediate slide-end square)
    if (move.slideEnd) {
      this.board[piece.y][piece.x] = null;
      piece.x = move.slideEnd.x;
      piece.y = move.slideEnd.y;
      this.board[piece.y][piece.x] = piece.id;
    }

    // 2. Capture
    if (move.capture) {
      const target = this.pieces.find(p => p.id === move.targetId);
      if (target && target.isAlive) {
        this.board[target.y][target.x] = null;
        target.isAlive = false;
        if (target.type === 'green') this.greenCount--;
        if (target.type === 'blue') {
          this.blueAlive[target.player] = false;
          this.reforgeCountdown[target.player] = 5;
        }
      }
    }

    // 3. Move to final square
    this.board[piece.y][piece.x] = null;
    piece.x = move.x;
    piece.y = move.y;
    this.board[piece.y][piece.x] = piece.id;

    // 4. Blue post-move effects
    if (piece.type === 'blue') {
      if (move.special) {
        if (!piece.specialsUsed.includes(move.special)) piece.specialsUsed.push(move.special);
        if (piece.specialsUsed.length >= 2) piece.rooted = true; // Crown Stagger
      }

      const home = this.homeApexOf(piece.player);
      const wasMobilizationDelay = piece.mobilizationDelay;
      if (piece.mobilizationDelay && (piece.x !== home.x || piece.y !== home.y)) {
        piece.mobilizationDelay = false; // this Blue has now made its first departure from Home
      }

      // Cross Stay: consecutive turns ended inside the Cross. Resets to 0
      // the moment Blue ends a turn outside it, so each fresh visit (after
      // satisfying the exclusion cooldown) gets its own full 3-turn budget.
      const nowInCross = this.isCross(piece.x, piece.y);
      if (nowInCross) {
        piece.crossStays++;
      } else if (wasInCross) {
        piece.crossStays = 0;
      }

      piece.crossExclusionJustSet = false;
      if (wasInCross && !nowInCross) {
        piece.crossExclusion = 2;
        piece.crossExclusionJustSet = true;
      }

      // Twin Apex Seed
      if (this.isSanctum(piece.x, piece.y)) {
        const oppX = piece.x === 0 ? 7 : 0;
        const oppY = piece.y === 7 ? 0 : 7;
        const oppEmpty = !this.getPieceAt(oppX, oppY);
        const canSeed =
          !wasMobilizationDelay &&
          this.greenCount < 6 &&
          piece.seedBanSanctum !== `${piece.x},${piece.y}` &&
          oppEmpty;
        if (canSeed) {
          this.addPiece(piece.player, 'green', oppX, oppY);
          piece.rooted = true;
        }
      }
    }

    // 5. Reforge planting: any piece (not just Blue) ending on the enemy Home
    //    Apex while its own Blue is dead plants the banner.
    if (!this.blueAlive[piece.player]) {
      const enemyHome = this.enemyHomeApexOf(piece.player);
      if (piece.x === enemyHome.x && piece.y === enemyHome.y) {
        piece.isAlive = false;
        this.board[piece.y][piece.x] = null;
        if (piece.type === 'green') this.greenCount--;

        const options = this.getReforgeOptions(piece.player, enemyHome, runnerWasGreenBeforeCapture);
        this.pendingReforge = { player: piece.player, options };
        this.moveHistory.push({ pieceId, move, plant: true });
        return true; // turn does NOT end until the Reforge placement is chosen
      }
    }

    this.moveHistory.push({ pieceId, move });
    this.endTurn();
    return true;
  }

  getReforgeOptions(player, enemyHomeSquare, runnerWasGreen) {
    const options = [];

    const greens = this.pieces.filter(p => p.isAlive && p.player === player && p.type === 'green');
    if (runnerWasGreen || greens.length > 0) {
      options.push({
        key: 'opposing',
        label: 'Opposing Apex (costs 1 Green)',
        x: enemyHomeSquare.x, y: enemyHomeSquare.y,
        costGreenId: runnerWasGreen ? null : greens[0].id,
      });
    }

    const home = this.homeApexOf(player);
    if (!this.getPieceAt(home.x, home.y)) {
      options.push({ key: 'home', label: 'Home Apex (free)', x: home.x, y: home.y });
    }

    for (const [sx, sy] of [[0, 7], [7, 0]]) {
      if (!this.getPieceAt(sx, sy)) {
        options.push({
          key: `sanctum:${sx},${sy}`,
          label: `Sanctum (${sx},${sy}) — no future Seed from here`,
          x: sx, y: sy,
          sanctum: `${sx},${sy}`,
        });
      }
    }

    // Safety net: this should not happen in normal play, but guarantee the
    // game can never soft-lock with a dead Blue and nowhere legal to return.
    if (options.length === 0) {
      options.push({ key: 'home', label: 'Home Apex (forced)', x: home.x, y: home.y, forced: true });
    }
    return options;
  }

  resolveReforge(optionKey) {
    if (!this.pendingReforge) return false;
    const { player, options } = this.pendingReforge;
    const opt = options.find(o => o.key === optionKey);
    if (!opt) return false;

    const blue = this.pieces.find(p => p.type === 'blue' && p.player === player);
    if (!blue) return false;

    if (opt.forced) {
      const occupant = this.getPieceAt(opt.x, opt.y);
      if (occupant) {
        occupant.isAlive = false;
        this.board[occupant.y][occupant.x] = null;
        if (occupant.type === 'green') this.greenCount--;
      }
    }

    if (opt.costGreenId) {
      const g = this.pieces.find(p => p.id === opt.costGreenId);
      if (g && g.isAlive) {
        g.isAlive = false;
        this.board[g.y][g.x] = null;
        this.greenCount--;
      }
    }

    blue.isAlive = true;
    blue.x = opt.x; blue.y = opt.y;
    blue.specialsUsed = [];
    blue.crossStays = 0;
    blue.crossExclusion = 0;
    blue.crossExclusionJustSet = false;
    blue.rooted = false;
    blue.mobilizationDelay = true;
    blue.seedBanSanctum = opt.sanctum || null;
    this.board[blue.y][blue.x] = blue.id;

    this.blueAlive[player] = true;
    this.reforgeCountdown[player] = 0;

    this.pendingReforge = null;
    this.endTurn();
    return true;
  }

  // ---------- Status helpers ----------
  getStatus() {
    if (this.winner === 'draw') return `🤝 Draw — ${this.winReason || 'no legal moves'}`;
    if (this.winner) return `🏆 Player ${this.winner} Wins! ${this.winReason || ''}`.trim();
    if (this.pendingReforge) return `Player ${this.pendingReforge.player}: choose where Blue returns…`;

    let text = `Player ${this.turn}'s Turn`;
    if (this.turn === 2 && !this.openingDoubleMoveDone) {
      text += this.firstMoveDone ? ' (Move 2 of 2)' : ' (Move 1 of 2)';
    }
    if (!this.blueAlive[1]) text += ` | P1 Reforge: ${this.reforgeCountdown[1]} turns`;
    if (!this.blueAlive[2]) text += ` | P2 Reforge: ${this.reforgeCountdown[2]} turns`;
    const blue = this.getBlue(this.turn);
    if (blue) {
      text += ` | Cross ${blue.crossStays}/3${blue.crossExclusion ? `, excl ${blue.crossExclusion}` : ''}`;
      text += ` | Green ${this.greenCount}/6`;
      text += ` | Specials: ${blue.specialsUsed.join(',') || 'none'}`;
      if (blue.rooted) text += ' | ROOTED';
    }
    return text;
  }
}

// ============================================================
//  DESCRIPTION HELPERS
// ============================================================

const TYPE_LABEL = { blue: 'B', orange: 'O', red: 'R', green: 'G' };
const TYPE_NAME = { blue: 'Blue', orange: 'Orange', red: 'Red', green: 'Green' };

function describeMove(game, piece, move) {
  if (move.special === 'S:D') {
    const t = game.pieces.find(p => p.id === move.targetId);
    return `Displacement — capture ${t ? TYPE_NAME[t.type] : 'piece'} at (${move.x},${move.y})`;
  }
  if (move.special === 'S:H') {
    const t = game.pieces.find(p => p.id === move.targetId);
    return `Hop-capture — jump ${t ? TYPE_NAME[t.type] : 'piece'} at (${t ? t.x : '?'},${t ? t.y : '?'}), land (${move.x},${move.y})`;
  }
  if (move.capture) return `Slide & capture at (${move.x},${move.y})`;
  return `Slide to (${move.x},${move.y})`;
}

function moveKind(move) {
  if (move.special === 'S:D') return 'special-d';
  if (move.special === 'S:H') return 'special-h';
  if (move.capture) return 'capture';
  return 'slide';
}

// ============================================================
//  MODAL UI
// ============================================================

export function openKonrehModal() {
  const existing = document.getElementById('konreh-modal');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'konreh-style';
  style.textContent = `
    #konreh-modal * { box-sizing: border-box; }
    #konreh-modal { --gold:#d4af37; --bg:#14151c; --panel:#1b1c26; --line:#2c2d3a;
                    --ink:#e8e6df; --muted:#9a9aa8; }
    #konreh-modal .kr-btn { background:#2a2b38; color:#e8e6df; border:1px solid #3a3b4a;
                    padding:7px 14px; border-radius:6px; cursor:pointer; font-size:13px;
                    transition: background .15s ease; }
    #konreh-modal .kr-btn:hover { background:#34364a; }
    #konreh-modal .kr-btn.primary { background:var(--gold); color:#1a1400; border-color:var(--gold); font-weight:600; }
    #konreh-modal .kr-btn.primary:hover { background:#e6c250; }
    #konreh-modal .kr-choice { display:block; width:100%; text-align:left; margin-bottom:6px; }
    #konreh-modal .kr-badge { display:inline-block; font-size:11px; padding:1px 6px; border-radius:10px;
                    background:#2a2b38; color:var(--muted); margin-left:6px; }
    #konreh-modal .kr-log { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:11.5px;
                    line-height:1.55; color:#b9b8c8; }
    #konreh-modal .kr-log .p1 { color:#e9c46a; }
    #konreh-modal .kr-log .p2 { color:#e18a95; }
    #konreh-modal .kr-scroll::-webkit-scrollbar { width:8px; }
    #konreh-modal .kr-scroll::-webkit-scrollbar-thumb { background:#3a3b4a; border-radius:4px; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'konreh-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(6,6,10,0.88); display: flex;
    align-items: center; justify-content: center; z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 20px; display: flex; gap: 20px; max-width: 980px; width: 100%; color: var(--ink);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 92vh; overflow: auto; flex-wrap: wrap;
  `;

  // ---- Game column ----
  const gameArea = document.createElement('div');
  gameArea.style.cssText = 'flex: 1 1 480px; display: flex; flex-direction: column; align-items: center; min-width: 340px;';

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
  const title = document.createElement('h2');
  title.textContent = "Kon'reh";
  title.style.cssText = 'color: var(--gold); margin:0; font-size:20px; letter-spacing:0.02em;';
  const subtitle = document.createElement('span');
  subtitle.textContent = 'Apex, Sanctum, and Reforge';
  subtitle.style.cssText = 'color: var(--muted); font-size:12px;';
  const titleWrap = document.createElement('div');
  titleWrap.appendChild(title);
  titleWrap.appendChild(document.createElement('br'));
  titleWrap.appendChild(subtitle);
  titleRow.appendChild(titleWrap);

  const closeBtnTop = document.createElement('button');
  closeBtnTop.className = 'kr-btn';
  closeBtnTop.textContent = '✕';
  closeBtnTop.title = 'Close';
  closeBtnTop.onclick = () => modal.remove();
  titleRow.appendChild(closeBtnTop);
  gameArea.appendChild(titleRow);

  const canvas = document.createElement('canvas');
  canvas.width = 520; canvas.height = 520;
  canvas.style.cssText = 'border: 1px solid var(--line); background: #0c0d12; cursor: pointer; border-radius: 8px; max-width:100%; height:auto;';
  gameArea.appendChild(canvas);

  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'margin-top: 12px; font-size: 13.5px; color: var(--ink); text-align: center; min-height: 22px; font-weight:600;';
  gameArea.appendChild(statusDiv);

  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = 'width:100%; display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; font-size:12px;';
  gameArea.appendChild(infoGrid);

  const choicePanel = document.createElement('div');
  choicePanel.style.cssText = 'width:100%; margin-top:10px; display:none;';
  gameArea.appendChild(choicePanel);

  const controlsRow = document.createElement('div');
  controlsRow.style.cssText = 'width:100%; display:flex; gap:8px; margin-top:14px; justify-content:center;';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'kr-btn';
  resetBtn.textContent = '🔄 New Game';
  controlsRow.appendChild(resetBtn);
  gameArea.appendChild(controlsRow);

  // ---- Sidebar ----
  const sidebar = document.createElement('div');
  sidebar.style.cssText = 'flex: 1 1 260px; min-width:240px; display: flex; flex-direction: column; gap: 12px; max-height: 84vh;';

  const logHeader = document.createElement('div');
  logHeader.textContent = 'Move Log';
  logHeader.style.cssText = 'color:var(--gold); font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;';
  sidebar.appendChild(logHeader);

  const logDiv = document.createElement('div');
  logDiv.className = 'kr-log kr-scroll';
  logDiv.style.cssText = 'background:#101119; border:1px solid var(--line); border-radius:6px; padding:8px 10px; height:150px; overflow-y:auto;';
  sidebar.appendChild(logDiv);

  const rulesHeader = document.createElement('div');
  rulesHeader.textContent = 'Quick Rules';
  rulesHeader.style.cssText = 'color:var(--gold); font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; margin-top:4px;';
  sidebar.appendChild(rulesHeader);

  const rulesDiv = document.createElement('div');
  rulesDiv.className = 'kr-scroll';
  rulesDiv.style.cssText = 'font-size: 12px; line-height: 1.55; overflow-y: auto; background: #101119; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--line); flex:1;';
  rulesDiv.innerHTML = getRulesText();
  sidebar.appendChild(rulesDiv);

  content.appendChild(gameArea);
  content.appendChild(sidebar);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // --- Game Engine & UI state ---
  const ctx = canvas.getContext('2d');
  const scale = 29;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  let game = new KonrehEngine();
  let selectedPiece = null;
  let validMoves = [];
  let pendingChoice = null; // { x, y, moves: [...] } awaiting disambiguation

  function log(html) {
    const line = document.createElement('div');
    line.innerHTML = html;
    logDiv.appendChild(line);
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  function gridToScreen(x, y) {
    return { sx: cx + (x - y) * scale, sy: cy + (x + y - 7) * scale };
  }
  function screenToGrid(sx, sy) {
    const dx = (sx - cx) / scale, dy = (sy - cy) / scale;
    return { x: Math.round((dx + dy + 7) / 2), y: Math.round((dy - dx + 7) / 2) };
  }

  function diamondPath(x, y) {
    const { sx, sy } = gridToScreen(x, y);
    ctx.beginPath();
    ctx.moveTo(sx, sy - scale);
    ctx.lineTo(sx + scale, sy);
    ctx.lineTo(sx, sy + scale);
    ctx.lineTo(sx - scale, sy);
    ctx.closePath();
  }

  function drawCell(x, y, fill, edge) {
    diamondPath(x, y);
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = edge || '#2c2d3a'; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawHighlight(x, y, color, dashed) {
    diamondPath(x, y);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLabel(x, y, text, color) {
    const { sx, sy } = gridToScreen(x, y);
    ctx.fillStyle = color || 'rgba(255,255,255,0.35)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy);
  }

  function drawPiece(p) {
    const { sx, sy } = gridToScreen(p.x, p.y);
    const isP1 = p.player === 1;
    const resolvedFill = isP1 ? '#e9c46a' : '#c1495a';
    const resolvedEdge = isP1 ? '#5c4413' : '#5c1c26';
    const resolvedText = isP1 ? '#241a05' : '#fbeee9';

    if (p.type === 'blue') {
      ctx.beginPath();
      ctx.arc(sx, sy, scale * 0.82, 0, Math.PI * 2);
      ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(sx, sy, scale * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = resolvedFill;
    ctx.fill();
    ctx.strokeStyle = resolvedEdge;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = resolvedText;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(TYPE_LABEL[p.type], sx, sy);

    if (p.rooted) {
      ctx.beginPath();
      ctx.arc(sx, sy, scale * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = '#888'; ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let fill = ((x + y) % 2 === 0) ? '#1c1d28' : '#181923';
        if (game.isHomeApex(x, y, 1) || game.isHomeApex(x, y, 2)) fill = '#3a331a';
        if (game.isSanctum(x, y)) fill = '#173535';
        if (game.isCross(x, y)) fill = '#2c2818';
        drawCell(x, y, fill);
      }
    }

    drawLabel(0, 0, 'P1');
    drawLabel(7, 7, 'P2');
    drawLabel(0, 7, 'S');
    drawLabel(7, 0, 'S');

    if (selectedPiece) {
      const byKind = { slide: 'rgba(90,200,120,0.28)', capture: 'rgba(217,74,74,0.35)',
                       'special-d': 'rgba(180,110,230,0.35)', 'special-h': 'rgba(120,150,240,0.35)' };
      const grouped = {};
      for (const m of validMoves) {
        const key = `${m.x},${m.y}`;
        grouped[key] = grouped[key] || [];
        grouped[key].push(m);
      }
      for (const key in grouped) {
        const list = grouped[key];
        const [mx, my] = key.split(',').map(Number);
        const kind = moveKind(list[0]);
        drawHighlight(mx, my, byKind[kind] || 'rgba(255,255,255,0.2)', list.length > 1);
        if (list.length > 1) drawLabel(mx, my, `${list.length}`, '#fff');
      }
      diamondPath(selectedPiece.x, selectedPiece.y);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    }

    for (const p of game.pieces) if (p.isAlive) drawPiece(p);

    renderStatus();
  }

  function renderStatus() {
    statusDiv.textContent = game.getStatus();

    infoGrid.innerHTML = '';
    const addStat = (label, value, cls) => {
      const box = document.createElement('div');
      box.style.cssText = 'background:#101119; border:1px solid var(--line); border-radius:6px; padding:6px 8px;';
      box.innerHTML = `<div style="color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">${label}</div>
                        <div style="margin-top:2px; font-weight:600;" class="${cls || ''}">${value}</div>`;
      infoGrid.appendChild(box);
    };

    if (!game.winner && !game.pendingReforge) {
      const activeBlue = game.getBlue(game.turn);
      addStat('Turn', `Player ${game.turn}`);
      addStat('Green Pool', `${game.greenCount} / 6`);
      if (activeBlue) {
        addStat('Cross Stay', `${activeBlue.crossStays} / 3${activeBlue.crossExclusion ? ` (excl ${activeBlue.crossExclusion})` : ''}`);
        addStat('Specials Used', activeBlue.specialsUsed.length ? activeBlue.specialsUsed.join(', ') : 'none');
      }
      if (!game.blueAlive[1]) addStat('P1 Reforge', `${game.reforgeCountdown[1]} turns left`);
      if (!game.blueAlive[2]) addStat('P2 Reforge', `${game.reforgeCountdown[2]} turns left`);
    }

    // Reforge choice panel
    if (game.pendingReforge) {
      choicePanel.style.display = 'block';
      choicePanel.innerHTML = `<div style="color:var(--gold); font-weight:700; margin-bottom:8px; text-align:center;">
          Player ${game.pendingReforge.player}: choose where Blue returns</div>`;
      for (const opt of game.pendingReforge.options) {
        const btn = document.createElement('button');
        btn.className = 'kr-btn primary kr-choice';
        btn.textContent = opt.label;
        btn.onclick = () => {
          const player = game.pendingReforge.player;
          game.resolveReforge(opt.key);
          log(`<span class="p${player}">P${player}</span> Reforge → <b>${opt.label}</b>`);
          selectedPiece = null; validMoves = [];
          choicePanel.style.display = 'none';
          render();
        };
        choicePanel.appendChild(btn);
      }
    } else if (!pendingChoice) {
      choicePanel.style.display = 'none';
      choicePanel.innerHTML = '';
    }

    // Move disambiguation panel (reuses the same panel area)
    if (pendingChoice) {
      choicePanel.style.display = 'block';
      choicePanel.innerHTML = `<div style="color:var(--gold); font-weight:700; margin-bottom:8px; text-align:center;">
          Multiple moves to (${pendingChoice.x},${pendingChoice.y}) — choose one</div>`;
      for (const mv of pendingChoice.moves) {
        const btn = document.createElement('button');
        btn.className = 'kr-btn choice-btn kr-choice';
        btn.textContent = describeMove(game, selectedPiece, mv);
        btn.onclick = () => { executeMove(mv); };
        choicePanel.appendChild(btn);
      }
      const cancel = document.createElement('button');
      cancel.className = 'kr-btn kr-choice';
      cancel.textContent = 'Cancel';
      cancel.onclick = () => { pendingChoice = null; render(); };
      choicePanel.appendChild(cancel);
    }
  }

  function executeMove(move) {
    const piece = selectedPiece;
    const player = piece.player;
    const greenBefore = game.greenCount;
    const blueAliveBefore = { 1: game.blueAlive[1], 2: game.blueAlive[2] };

    game.makeMove(piece.id, move);

    let entry = `<span class="p${player}">P${player} ${TYPE_LABEL[piece.type]}</span> ${describeMove(game, piece, move)}`;
    if (game.greenCount > greenBefore) entry += ' <span class="kr-badge">Seed</span>';
    if (blueAliveBefore[player === 1 ? 2 : 1] && !game.blueAlive[player === 1 ? 2 : 1]) {
      entry += ' <span class="kr-badge">Blue captured!</span>';
    }
    if (game.pendingReforge) entry += ' <span class="kr-badge">Banner planted</span>';
    log(entry);

    selectedPiece = null; validMoves = []; pendingChoice = null;
    render();
  }

  canvas.addEventListener('click', (e) => {
    if (game.winner || game.pendingReforge) return;
    const rect = canvas.getBoundingClientRect();
    const scaleFactor = canvas.width / rect.width;
    const { x, y } = screenToGrid((e.clientX - rect.left) * scaleFactor, (e.clientY - rect.top) * scaleFactor);

    if (pendingChoice) { pendingChoice = null; render(); return; }

    if (x < 0 || x > 7 || y < 0 || y > 7) {
      selectedPiece = null; validMoves = []; render(); return;
    }

    if (selectedPiece) {
      if (x === selectedPiece.x && y === selectedPiece.y) {
        selectedPiece = null; validMoves = []; render(); return;
      }
      const matches = validMoves.filter(m => m.x === x && m.y === y);
      if (matches.length === 1) {
        executeMove(matches[0]);
        return;
      } else if (matches.length > 1) {
        pendingChoice = { x, y, moves: matches };
        render();
        return;
      } else {
        const piece = game.getPieceAt(x, y);
        if (piece && piece.player === game.turn && !piece.rooted) {
          selectedPiece = piece;
          validMoves = game.getValidMoves(piece.id);
        } else {
          selectedPiece = null; validMoves = [];
        }
        render();
        return;
      }
    } else {
      const piece = game.getPieceAt(x, y);
      if (piece && piece.player === game.turn && !piece.rooted) {
        selectedPiece = piece;
        validMoves = game.getValidMoves(piece.id);
      }
      render();
    }
  });

  resetBtn.addEventListener('click', () => {
    game = new KonrehEngine();
    selectedPiece = null; validMoves = []; pendingChoice = null;
    logDiv.innerHTML = '';
    log('<i>New game started.</i>');
    render();
  });

  log('<i>Game started — Player 1 to move.</i>');
  render();
}

// ============================================================
//  RULES TEXT (for sidebar)
// ============================================================

function getRulesText() {
  return `
    <p><b>Goal:</b> Capture the enemy Blue. If yours is captured, plant any piece on the enemy Home Apex within <b>5 of your own turns</b> to Reforge it back, choosing Home (free), a Sanctum (bars future Seed there), or the Opposing Apex (costs a Green).</p>
    <p><b>Movement — Onward (exact) / Homeward (up to):</b> Every piece has two Onward lanes (away from your Home Apex) and two Homeward lanes (back toward it).</p>
    <ul>
      <li><b>Onward is exact:</b> you must travel the piece's full Onward distance in one of those two lanes — no shorter stop is allowed. If anything blocks the path before that exact square, that lane has no legal move at all this turn.</li>
      <li><b>Homeward is "up to":</b> you may stop at any square from 1 up to the piece's Homeward distance, same as a normal slide.</li>
      <li><b>Distances:</b> Red 2 / 1 &nbsp; Orange 3 / 2 &nbsp; Green 4 / 3 &nbsp; Blue 5 / 4 (Onward / Homeward).</li>
    </ul>
    <p><b>Zone of Control (ZoC):</b> every piece controls its 4 adjacent squares. A Homeward slide that enters enemy ZoC stops there (that square is still a legal landing, you just can't continue past it). No piece — friend or foe — can ever be passed through.</p>
    <p><b>Captures:</b> Red/Orange/Green capture by landing on an enemy square, on either lane. <b>Blue's own slide cannot capture</b> — Blue only captures via its Specials below.</p>
    <p><b>Blue:</b> May slide (Onward 5 exact / Homeward up to 4), then use one Special per turn (each usable once per life):</p>
    <ul>
      <li><b>Displacement:</b> step onto an adjacent enemy.</li>
      <li><b>Hop:</b> jump an adjacent enemy to the empty square beyond.</li>
      <li>No Special if the slide entered ZoC. Using both Specials in one life Roots Blue until your next turn (Crown Stagger).</li>
    </ul>
    <p><b>Seed:</b> Ending on a Sanctum with the opposite Sanctum empty spawns a Green there (cap 6 total) and Roots Blue. Blocked on the very first turn Blue ever leaves Home.</p>
    <p><b>The Cross:</b> Center 2×2. A Blue may stay up to 3 <i>consecutive</i> turns there; leaving resets that count to 0 for its next visit. After leaving, it's barred from re-entry for 2 full turns.</p>
    <p><b>Setup:</b> each side has 1 Blue, 2 Oranges, 6 Reds, and 1 Green in a tight 4-rank pyramid from its Home Apex — expect the very first move or two to come from the outer Reds, since everything else starts boxed in.</p>
    <p><b>Turn order:</b> P1 moves once; P2 then gets two moves (different pieces) on their first turn only; alternate afterward.</p>
    <p style="color:var(--muted); font-size:11px;">Click a piece, then a highlighted square. Squares with several legal moves show a number — click it to choose.</p>
  `;
}
