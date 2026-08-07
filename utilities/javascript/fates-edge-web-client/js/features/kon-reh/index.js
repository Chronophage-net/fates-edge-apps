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

    if (!this.pendingReforge) {
      // A side with zero pieces left on the board (their Blue was just
      // captured and it was their last piece) can never move and can
      // never Reforge either — Reforge requires walking a living piece
      // onto the enemy Home Apex. This is a decisive loss for them, NOT
      // a stalemate draw. Without this check, hasAnyLegalMove() below
      // trivially returns false for a side with no pieces, and the game
      // would call that a draw — which in turn taught every AI School's
      // search to actively AVOID capturing an opponent's last piece,
      // since a draw (score 0) looked worse than just sitting on a
      // material/mobility advantage forever.
      const aliveCount = this.pieces.filter(p => p.isAlive && p.player === this.turn).length;
      if (aliveCount === 0) {
        this.winner = this.turn === 1 ? 2 : 1;
        this.winReason = `Player ${this.turn} has no pieces remaining.`;
        return;
      }

      // Stalemate safety net: if the side to move has pieces but genuinely
      // no legal move anywhere, the game is declared a draw rather than
      // soft-locking.
      if (!this.hasAnyLegalMove(this.turn)) {
        this.winner = 'draw';
        this.winReason = `Player ${this.turn} has no legal move.`;
      }
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

  // ---------- Cloning (for AI search — cheap, avoids re-running setup) ----------
  clone() {
    const copy = Object.create(KonrehEngine.prototype);
    copy.board = this.board.map(row => row.slice());
    copy.pieces = this.pieces.map(p => ({ ...p, specialsUsed: [...p.specialsUsed] }));
    copy.turn = this.turn;
    copy.winner = this.winner;
    copy.winReason = this.winReason;
    copy.openingDoubleMoveDone = this.openingDoubleMoveDone;
    copy.firstMoveDone = this.firstMoveDone;
    copy.doubleMoveUsed = new Set(this.doubleMoveUsed);
    copy.reforgeCountdown = { ...this.reforgeCountdown };
    copy.blueAlive = { ...this.blueAlive };
    copy.greenCount = this.greenCount;
    copy.moveHistory = []; // not needed for search; skip for speed
    copy.pendingReforge = this.pendingReforge
      ? { player: this.pendingReforge.player, options: this.pendingReforge.options.map(o => ({ ...o })) }
      : null;
    return copy;
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
//  KON'REH AI — "Schools" opponent
// ============================================================
//
// Implements alpha-beta search with iterative deepening, move ordering,
// and a quiescence extension on captures, whose leaf evaluation is
// weighted differently per "School," so that each School plays with a
// genuinely different style rather than just a different name. The
// core rules never change — only how a School *values* a position:
// how much it cares about material, mobility/denial, forcing threats,
// its own Blue's safety, Central Four presence and control, piece
// advancement, and Reforge urgency. This mirrors the Concordance's own
// framing of Schools as doctrines, not rule variants.
//
// STRATEGY UPGRADES over the previous version:
//   1. Move ordering (captures/specials/advances scored and searched
//      first) so alpha-beta prunes far more of the tree.
//   2. Iterative deepening: search depth 1, 2, 3... up to the target
//      depth, re-using the previous iteration's best move as the first
//      move tried (principal-variation ordering) at the next depth.
//   3. Quiescence search: when the main search bottoms out, capturing
//      sequences are extended a few more plies so a piece that looks
//      "free" only because the horizon cut the search early is still
//      seen to be lost. This fixes the classic horizon-effect blunder
//      where the AI walks a piece into a capture it "didn't see."
//   4. Richer evaluation: threats are weighted by the VALUE of the
//      piece threatened (not just counted), a Blue under attack from
//      multiple pieces at once is treated as more dangerous than one
//      attacker, non-Blue pieces are rewarded for controlling/occupying
//      the Cross and its border, and pieces are rewarded for advancing
//      down the board toward the enemy Home Apex (rather than the AI
//      being indifferent between a piece sitting at home and one
//      pressing forward).
//   5. Game-phase awareness: Kon'reh plays as three distinct phases —
//      an OPENING Sanctum-tempo race (the shared 6-Green cap means every
//      Seed you land is one the opponent can never have), a MIDGAME of
//      tactical/material pressure once both Blues are developed, and an
//      ENDGAME dominated by Reforge math the instant a Blue falls. A
//      single static weight blend for the whole game undervalues Seed
//      tempo early and undervalues Reforge urgency late. `gamePhase()`
//      classifies the current position and `PHASE_MULTIPLIER` re-weights
//      evaluate()'s terms accordingly — on top of, not instead of, each
//      School's own doctrine. NOTE: Blue is not a king to be hidden away.
//      It is the only piece that can Seed, the only piece the Cross's
//      special stay/exclusion rules even apply to, and (per the
//      rulebook) the piece a strong player spends most actively — the
//      evaluation below treats it that way: an asset to deploy for
//      tempo and center leverage, with `blueSafety` pricing the real
//      risk of that instead of arguing for permanent caution.
//
// This file has zero DOM dependencies (pure logic over KonrehEngine),
// so it can be unit tested the same way as engine.mjs.

export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---- School definitions with their weight vectors ----
// All Schools have `reforge: 4.0` so they urgently race to save their
// Blue the moment it dies, rather than drifting toward the enemy Home
// Apex only once the countdown is nearly out.
//
// Two new weights have been added to every School:
//   control  — how much the School values occupying/bordering the Cross
//              with non-Blue pieces (denying the center to the enemy)
//   advance  — how much the School values pushing pieces forward along
//              the board rather than leaving them undeveloped at home
export const SCHOOLS = {
  ykrul: {
    name: 'Ykrul',
    tagline: 'Control before contact — count exits, not victims.',
    weights: { material: 0.8, mobility: 2.0, aggression: 0.5, blueSafety: 1.5, cross: -1.5, cap: 0.5, reforge: 4.0, rooted: 1.0, control: 1.5, advance: 0.6 },
  },
  vilikari: {
    name: 'Vilikari',
    tagline: 'Tempo theft and misdirection — sell them the hour you stole.',
    weights: { material: 0.8, mobility: 1.0, aggression: 2.0, blueSafety: 0.8, cross: 1.2, cap: 0.6, reforge: 4.0, rooted: 0.6, control: 0.6, advance: 1.2 },
  },
  thepyrgosi: {
    name: 'Thepyrgosi',
    tagline: 'Proof and parity — refuse noise, prove inevitability.',
    weights: { material: 1.0, mobility: 1.5, aggression: 0.3, blueSafety: 2.0, cross: -0.8, cap: 0.7, reforge: 4.0, rooted: 1.5, control: 0.8, advance: 0.5 },
  },
  aeler: {
    name: 'Aeler',
    tagline: 'Ledger and toll — every square pays, or closes.',
    weights: { material: 1.2, mobility: 0.8, aggression: 0.7, blueSafety: 1.0, cross: -0.3, cap: 2.0, reforge: 4.0, rooted: 0.8, control: 1.0, advance: 0.7 },
  },
  lethai: {
    name: 'Lethai',
    tagline: 'Single-Stroke — win by inevitability, not attrition.',
    weights: { material: 0.5, mobility: 1.8, aggression: 0.2, blueSafety: 1.8, cross: -1.0, cap: 0.4, reforge: 4.0, rooted: 1.2, control: 0.7, advance: 1.0 },
  },
  vhasian: {
    name: 'Vhasian',
    tagline: 'Honor as bait — polish the helm in public, strike in private.',
    weights: { material: 0.7, mobility: 0.8, aggression: 1.6, blueSafety: 0.7, cross: 1.5, cap: 0.6, reforge: 4.0, rooted: 0.5, control: 0.5, advance: 1.3 },
  },
};

// NEW: Table Talk — a pool of in-character lines per School, used instead
// of always repeating the same tagline whenever the AI speaks up. A mix of
// verbatim (or lightly trimmed) lines from the Concordance's own School
// writings, plus a few new lines written to match each School's voice.
// See TABLE_TALK_OPENING for the one-off line said at game start.
export const TABLE_TALK = {
  ykrul: [
    'Count exits, not victims.',
    'A house with one door is already mine.',
    'I did not chase your Blue. I closed the road it needed.',
    'Close the corridor, spare the village.',
    'The stone that never moves controls more than the one that runs.',
    'Every square you cannot reach is a square I already own.',
  ],
  vilikari: [
    'Sell them the hour you stole.',
    "By the third beat, the lane you needed is already for sale.",
    "I don't take pieces. I take minutes.",
    'You blinked. I moved twice.',
    'A gale ignores charts.',
    'Tempo spends the same as material — I just spend it faster.',
  ],
  thepyrgosi: [
    'Q.E.D.',
    'Brush the sand until only one path remains.',
    'Inevitability needs no applause.',
    'The proof finished three moves ago. This is just the reading aloud.',
    'I do not gamble. I demonstrate.',
    'Refuse the noise. Prove the silence.',
  ],
  aeler: [
    'Every square pays, or closes.',
    'I weigh your step like coin.',
    'I do not bleed for a road. I bankrupt it first.',
    'Patience is the only currency that never depreciates.',
    'The toll is due, one way or another.',
    "Every profitable road already belongs to me.",
  ],
  lethai: [
    'One clean stroke ends the poem.',
    'The pond holds its face until the moon moves.',
    "I have said nothing all game. Now I don't need to.",
    'When it breaks once, everything is already over.',
    'Win by inevitability, not attrition.',
    'Mud the water, then hold still.',
  ],
  vhasian: [
    'The helm is for the crowd. The blade is for you.',
    'Polish the helm in public, strike in shadow.',
    'You admired the pageant. You missed the alley.',
    'No pageants. Only blades.',
    'Honor is the bait. The knife was never lost.',
    'Bright brass up top; the true cut lands where no one is looking.',
  ],
};

// One-off greeting said at the start of a vs-Computer game, before any
// captures have happened — keeps Table Talk from feeling purely reactive.
export const TABLE_TALK_OPENING = {
  ykrul: "Let's see how many exits you think you have.",
  vilikari: "Clock's already running. Try to keep up.",
  thepyrgosi: 'State your opening. I will state the refutation.',
  aeler: "Every move you make from here on out, I'm billing you for.",
  lethai: 'Play quietly. I only need one stroke.',
  vhasian: 'Welcome to the table — mind the pageantry.',
};

function randomSaying(schoolId) {
  const pool = TABLE_TALK[schoolId] || [];
  if (!pool.length) return SCHOOLS[schoolId]?.tagline || '';
  return pool[Math.floor(Math.random() * pool.length)];
}

const PIECE_VALUE = { red: 100, orange: 180, green: 140, blue: 300 };

// School-flavored piece titles, drawn directly from the Concordance's
// "Quick reference: piece titles per school" table. Purely cosmetic — used
// by the UI in move logs and descriptions for whichever side a School is
// controlling; gameplay never depends on these.
export const PIECE_TITLES = {
  ykrul:      { blue: 'Warlord',      orange: 'Shaman',      red: 'Picket',       green: 'Raider' },
  vilikari:   { blue: 'Boss',         orange: 'Barker',      red: 'Stall',        green: 'Runner' },
  thepyrgosi: { blue: 'Arbiter',      orange: 'Corollary',   red: 'Lemma',        green: 'Q.E.D.' },
  aeler:      { blue: 'Auditor',      orange: 'Factor',      red: 'Roadwright',   green: 'Courier' },
  lethai:     { blue: 'Quiet Stroke', orange: 'Waiting Lid', red: "Alder's Knot", green: "Sparrow's Flight" },
  vhasian:    { blue: 'Champion',     orange: 'Herald',      red: 'Retainer',     green: 'Duelist' },
};

// Move generation identical to engine.getValidMoves, but turn-agnostic —
// used so the evaluator can measure BOTH sides' mobility/threats at a
// given node regardless of whose turn it technically is.
function pseudoMoves(engine, piece) {
  if (!piece.isAlive || piece.rooted) return [];
  if (piece.type === 'blue') {
    const slideBasis = engine.getBlueSlides(piece);
    const specials = engine.getBlueSpecials(piece, slideBasis);
    const actualSlides = slideBasis
      .filter(s => !(s.x === piece.x && s.y === piece.y))
      .map(s => ({ x: s.x, y: s.y, capture: false }));
    let moves = [...actualSlides, ...specials];
    moves = moves.filter(m => engine.isValidBlueCrossMove(piece, m));
    return moves;
  }
  return engine.getPieceMoves(piece);
}

// How far a piece has progressed from its own Home Apex toward the
// enemy Home Apex, as a 0..1 fraction of the total board diagonal (14
// squares). 0 = still at home, 1 = sitting on the enemy Apex. Used to
// reward development/advancement instead of the AI being indifferent
// between a piece that never left home and one pressing the attack.
function pieceProgress(engine, p) {
  const home = engine.homeApexOf(p.player);
  const enemyHome = engine.enemyHomeApexOf(p.player);
  const total = Math.abs(enemyHome.x - home.x) + Math.abs(enemyHome.y - home.y); // 14
  const remaining = Math.abs(p.x - enemyHome.x) + Math.abs(p.y - enemyHome.y);
  return total > 0 ? Math.max(0, Math.min(1, (total - remaining) / total)) : 0;
}

// Whether a square is inside the Cross or orthogonally borders it —
// used for the new "control" evaluation term, which rewards non-Blue
// pieces for contesting the center rather than only Blue caring about it.
function isNearCross(engine, x, y) {
  if (engine.isCross(x, y)) return true;
  for (const [dx, dy] of DIRS4) {
    if (engine.isCross(x + dx, y + dy)) return true;
  }
  return false;
}

// FIX: turn-agnostic Exit Certainty (XS), used by evaluate()'s Cross term
// below. This mirrors computeExitCertainty() (used for the live Coach
// hint) but drives it off pseudoMoves() instead of getValidMoves(), so it
// works regardless of whose turn the evaluated node happens to be on —
// exactly like pieceProgress()/isNearCross() already do for their terms.
// Per the rulebook's own "XS (Exit Certainty)" heuristic: "count legal
// exits before entering the Cross. One is playable; two is safe."
function blueExitCertainty(engine, blue) {
  if (!blue || blue.rooted) return 0;
  return pseudoMoves(engine, blue).filter(m => !engine.isCross(m.x, m.y)).length;
}

// ---- Game phase detection ----
// The rulebook itself is structured as three phases even though the core
// rules never branch on a turn counter: an OPENING Sanctum-tempo race
// (the 6-Green cap is GLOBAL and shared, so every Seed you land is one
// the opponent can never have — see KonrehEngine.addPiece/makeMove), a
// MIDGAME of tactical/material pressure once both Blues are developed,
// and an ENDGAME dominated entirely by Reforge math the instant a Blue
// falls ("Reforge math beats material"). `evaluate()` used to apply one
// static blend of a School's weights for the whole game, which is why
// the AI both under-raced the opening Seed window and under-prioritized
// Reforge once it actually mattered. `gamePhase()` classifies the
// current position; `PHASE_MULTIPLIER` re-weights specific evaluation
// terms on top of (never instead of) each School's own doctrine.
export function gamePhase(engine) {
  // ENDGAME: either side's Blue is already down and racing the 5-turn
  // Reforge clock, or the board has thinned out enough (rulebook's own
  // "as material thins, hunting the enemy Blue matters more" heuristic)
  // that every remaining piece and every remaining turn counts far more
  // than opening-style development ever could.
  if (!engine.blueAlive[1] || !engine.blueAlive[2]) return 'endgame';
  const totalNonBlue = engine.pieces.filter(p => p.isAlive && p.type !== 'blue').length;
  if (totalNonBlue <= 8) return 'endgame';

  // OPENING: neither side has Seeded yet (greenCount is still at the
  // starting 2 — one Green per side) and the game is still young by move
  // count. This is the window where reaching a Sanctum first actually
  // denies the opponent a Green they can never get back, per the shared
  // global cap — the single highest-leverage tempo play early on.
  if (engine.greenCount <= 2 && engine.moveHistory.length < 16) return 'opening';

  return 'midgame';
}

const PHASE_MULTIPLIER = {
  // Opening: Seed tempo and Cross leverage matter most; go easy on
  // all-out aggression and on babying Blue's safety before there's even
  // been contact.
  opening: { cap: 1.8, control: 1.4, advance: 1.3, cross: 1.3, reforge: 1.0, aggression: 0.8, blueSafety: 0.9 },
  // Midgame: this is the tactical/material fight — threats, mobility,
  // and Blue danger dominate; Seed tempo matters less once the race is
  // largely decided (either the cap is close to full or both sides have
  // already banked their early Seeds).
  midgame: { cap: 1.0, control: 1.0, advance: 1.0, cross: 1.0, reforge: 1.1, aggression: 1.25, blueSafety: 1.15 },
  // Endgame: Reforge math swamps everything else the moment a Blue
  // falls, and Blue's own safety/positioning matters more with fewer
  // pieces left to cover for a mistake. Seed tempo is nearly worthless
  // this late — there usually isn't time left to enjoy it.
  endgame: { cap: 0.5, control: 0.7, advance: 0.8, cross: 0.8, reforge: 2.2, aggression: 1.1, blueSafety: 1.3 },
};

// ---- Evaluation function ----
// Material, mobility, threat-value-weighted aggression, multi-attacker
// Blue danger, Cross control, piece advancement, Cross/Rooted status for
// Blue specifically, Green cap parity, Sanctum Seed tempo/anti-camping,
// and a steep Reforge-urgency term (including a large bonus for already
// standing on the enemy Apex, ready to plant immediately) — all of it
// re-weighted per `gamePhase()` above.
function evaluate(engine, weights, me) {
  if (engine.winner === me) return 1_000_000;
  if (engine.winner === 'draw') return 0;
  if (engine.winner) return -1_000_000;

  const opp = me === 1 ? 2 : 1;
  let score = 0;

  // Phase-aware re-weighting — see gamePhase()/PHASE_MULTIPLIER above.
  const phase = gamePhase(engine);
  const pm = PHASE_MULTIPLIER[phase];

  let myMobility = 0, oppMobility = 0;
  let myThreatValue = 0, oppThreatValue = 0;
  let myBlueAttackers = 0, oppBlueAttackers = 0;
  let myCrossControl = 0, oppCrossControl = 0;
  const myBlue = engine.getBlue(me);
  const oppBlue = engine.getBlue(opp);

  // FIX: "struggles with the endgame" — as material thins out, hunting the
  // enemy Blue and actually firing off Blue's own specials matter more
  // (fewer pieces means fewer future chances, and the rulebook's own
  // heuristics say to trade freely once a Reforge race is in reach). Scale
  // the two new bonuses below up when few non-Blue pieces remain. This is
  // now folded into phase detection too (`phase === 'endgame'` covers the
  // same threshold) but kept as its own factor since it should ramp with
  // material count rather than snap on/off at the phase boundary.
  const totalNonBluePieces = engine.pieces.filter(p => p.isAlive && p.type !== 'blue').length;
  const endgameFactor = totalNonBluePieces <= 8 ? 1.6 : 1.0;

  for (const p of engine.pieces) {
    if (!p.isAlive) continue;
    const val = PIECE_VALUE[p.type] * weights.material;
    score += p.player === me ? val : -val;

    if (isNearCross(engine, p.x, p.y)) {
      if (p.player === me) myCrossControl++; else oppCrossControl++;
    }

    if (p.type !== 'blue') {
      const progress = pieceProgress(engine, p) * 25;
      score += p.player === me ? weights.advance * pm.advance * progress : -weights.advance * pm.advance * progress;
    }

    const moves = pseudoMoves(engine, p);
    const mobility = moves.length;
    if (p.player === me) myMobility += mobility; else oppMobility += mobility;

    for (const m of moves) {
      if (!m.capture) continue;
      const target = engine.pieces.find(pp => pp.id === m.targetId);
      const targetValue = target ? PIECE_VALUE[target.type] : 0;
      if (p.player === me) myThreatValue += targetValue; else oppThreatValue += targetValue;

      // FIX: "not taking blues" — capturing/threatening the enemy Blue is
      // worth far more than its raw material value suggests, since it
      // forces a whole Reforge race (rulebook: "Reforge math beats
      // material — if you can force a failed Reforge, trade pieces
      // freely"). The generic material-weighted threatValue term above
      // already counts it once at PIECE_VALUE.blue; this adds a large,
      // aggression-scaled bonus on top so even low-aggression Schools
      // still go looking for it.
      if (target && target.type === 'blue') {
        const blueHuntBonus = weights.aggression * pm.aggression * 90 * endgameFactor;
        score += p.player === me ? blueHuntBonus : -blueHuntBonus;
      }

      // FIX: "not USING the blue (it's a tactical nuke)" — Blue's S:D/S:H
      // specials are its only way to ever capture anything, each usable
      // once per life. A cautious School (low `aggression`) would
      // otherwise happily sit on both specials forever purely to dodge
      // the Crown Stagger `rooted` penalty below. Give any available
      // special-capture its own explicit incentive, independent of that
      // caution, so the piece actually gets used as the powerful (if
      // risky) weapon it is rather than hoarded.
      if (m.special) {
        const specialBonus = weights.aggression * pm.aggression * 30 * endgameFactor;
        score += p.player === me ? specialBonus : -specialBonus;
      }

      if (p.player === opp && myBlue && m.targetId === myBlue.id) myBlueAttackers++;
      if (p.player === me && oppBlue && m.targetId === oppBlue.id) oppBlueAttackers++;
    }
  }

  score += weights.mobility * (myMobility - oppMobility);
  // Threats are now weighted by the value of what's threatened, not just
  // counted — a School that "sees" it can win a Blue for a Red values
  // that far more than winning a Red for a Red.
  score += weights.aggression * pm.aggression * (myThreatValue - oppThreatValue) / 40;

  // A doubly (or triply) attacked Blue is meaningfully more dangerous
  // than a singly attacked one — extra attackers mean fewer safe replies.
  if (myBlueAttackers > 0) score -= weights.blueSafety * pm.blueSafety * 250 * myBlueAttackers;
  if (oppBlueAttackers > 0) score += weights.blueSafety * pm.blueSafety * 250 * oppBlueAttackers;

  // FIX: "not utilizing the cross" — this used to be a blanket bonus/
  // penalty from weights.cross alone, and most Schools carry a NEGATIVE
  // cross weight, which coded in blanket avoidance of the center. But the
  // rulebook treats the Cross as "leverage with a fuse": valuable to
  // occupy for the lane pressure it gives Blue, risky only if you don't
  // have a safe way back out ("Enter to pivot, not to pose" / "enter only
  // with XS >= 1"). So instead of a flat weight, scale by exit certainty
  // (XS): a Blue holding the Cross with a certified exit is a real asset;
  // one with none is a real liability. |weights.cross| now just controls
  // how much a School cares about Cross outcomes at all, not which way.
  // Scaled by pm.cross so this actually matters most in the opening/
  // midgame tempo fight, not equally throughout the whole game.
  if (myBlue) {
    if (engine.isCross(myBlue.x, myBlue.y)) {
      const xs = Math.min(blueExitCertainty(engine, myBlue), 2);
      score += Math.abs(weights.cross) * pm.cross * (10 + xs * 20 - myBlue.crossStays * 8);
    }
    if (myBlue.rooted) score -= weights.rooted * pm.blueSafety * 60;
  }
  if (oppBlue) {
    if (engine.isCross(oppBlue.x, oppBlue.y)) {
      const xs = Math.min(blueExitCertainty(engine, oppBlue), 2);
      score -= Math.abs(weights.cross) * pm.cross * (10 + xs * 20 - oppBlue.crossStays * 8);
    }
    if (oppBlue.rooted) score += weights.rooted * pm.blueSafety * 60;
  }

  // Central control: non-Blue presence in/around the Cross, contesting
  // the board's most valuable real estate rather than leaving it open.
  score += weights.control * pm.control * 15 * (myCrossControl - oppCrossControl);

  const myGreens = engine.pieces.filter(p => p.isAlive && p.player === me && p.type === 'green').length;
  const oppGreens = engine.pieces.filter(p => p.isAlive && p.player === opp && p.type === 'green').length;
  score += weights.cap * pm.cap * 30 * (myGreens - oppGreens);

  // FIX: "Blue should be incentivized to out-spawn Greens and utilize the
  // Cross" — the green-count differential above only rewards Seeding
  // AFTER it already happened. Because the 6-Green cap is GLOBAL (shared
  // by both players — see KonrehEngine.makeMove's Twin Apex Seed check),
  // reaching a live Sanctum first is a genuine race: every Green you Seed
  // is one the opponent can never have, not just one more piece for you.
  // Give this real lookahead pressure instead of leaving it to be
  // discovered only once it's already on the board:
  //   - `canSeedNow`: a direct, large bonus when Blue could Seed THIS
  //     ply (a real Seed opportunity available right now beats "material
  //     is roughly equal" in most opening positions).
  //   - `sanctumTempo`: a smaller, distance-graded bonus for closing on
  //     ANY Sanctum that's still live to Seed from, so the search has a
  //     gradient to climb turns before the opportunity is actually there.
  // Both reuse weights.cap (the School's existing "green race" weight)
  // rather than adding a new per-School tunable, and are phase-scaled via
  // pm.cap so they matter most during the opening race and taper off
  // once the cap is nearly spent or the game has moved on.
  function blueCanSeedNow(blue) {
    if (!blue || blue.rooted || engine.greenCount >= 6) return false;
    return pseudoMoves(engine, blue).some(m => {
      if (!engine.isSanctum(m.x, m.y)) return false;
      const oppX = m.x === 0 ? 7 : 0, oppY = m.y === 7 ? 0 : 7;
      return !engine.getPieceAt(oppX, oppY) && blue.seedBanSanctum !== `${m.x},${m.y}` && !blue.mobilizationDelay;
    });
  }
  function sanctumTempo(blue) {
    if (!blue || blue.mobilizationDelay || engine.greenCount >= 6) return null;
    let best = Infinity;
    for (const [sx, sy] of [[0, 7], [7, 0]]) {
      if (blue.seedBanSanctum === `${sx},${sy}`) continue;
      const oppX = sx === 0 ? 7 : 0, oppY = sy === 7 ? 0 : 7;
      if (engine.getPieceAt(oppX, oppY)) continue; // opposite corner occupied — not live right now
      const d = Math.abs(blue.x - sx) + Math.abs(blue.y - sy);
      if (d < best) best = d;
    }
    return best === Infinity ? null : best;
  }
  if (myBlue && blueCanSeedNow(myBlue)) score += weights.cap * pm.cap * 45;
  if (oppBlue && blueCanSeedNow(oppBlue)) score -= weights.cap * pm.cap * 45;
  const myTempo = myBlue ? sanctumTempo(myBlue) : null;
  const oppTempo = oppBlue ? sanctumTempo(oppBlue) : null;
  if (myTempo !== null) score += weights.cap * pm.cap * Math.max(0, 10 - myTempo) * 2.5;
  if (oppTempo !== null) score -= weights.cap * pm.cap * Math.max(0, 10 - oppTempo) * 2.5;

  // FIX: "Blue shouldn't just be able to camp — there's a limit to how
  // safe it is in its Sanctum." Sanctum squares carry NO special
  // protection from ordinary capture (the myBlueAttackers/blueSafety
  // terms above already apply there exactly as anywhere else), and the
  // rulebook is explicit that treating a Sanctum as a hideout is a
  // mistake ("no camping," "Seed on a pull, not a push"). Without this
  // term the search had no reason to ever move Blue OFF a Sanctum once
  // it got there and wasn't under immediate attack — Seed tempo alone
  // doesn't punish idling. Penalize a Blue parked on a Sanctum with no
  // live Seed available (cap maxed, opposite occupied, or still under
  // Mobilization Delay): it isn't accomplishing anything and isn't any
  // safer than the open board.
  function sanctumIdle(blue) {
    if (!blue || !engine.isSanctum(blue.x, blue.y)) return false;
    return !blueCanSeedNow(blue);
  }
  if (myBlue && sanctumIdle(myBlue)) score -= weights.cap * pm.cap * 25;
  if (oppBlue && sanctumIdle(oppBlue)) score += weights.cap * pm.cap * 25;

  // --- Reforge urgency: quadratic penalty for the player whose Blue is dead ---
  // FIX: changed from urgency^2 to (urgency+1)^2 so the very first turn
  // after a Blue capture already carries a meaningful swing (80 instead of
  // 30 at urgency=1), not just once the countdown is nearly out. Capturing
  // Blue should look clearly good to the AI immediately, not only in
  // hindsight a few turns later — see "Reforge math beats material" above.
  // Now also scaled by pm.reforge (2.2x in the endgame phase), on top of
  // the quadratic urgency curve, so nothing else in the evaluation can
  // ever outweigh actually racing the clock once it's running.
  if (!engine.blueAlive[me]) {
    const urgency = 6 - engine.reforgeCountdown[me]; // 1 at start, 5 at last turn
    score -= weights.reforge * pm.reforge * (urgency + 1) * (urgency + 1) * 20;
  }
  if (!engine.blueAlive[opp]) {
    const urgency = 6 - engine.reforgeCountdown[opp];
    score += weights.reforge * pm.reforge * (urgency + 1) * (urgency + 1) * 20;
  }

  // --- Proximity bonus for the player in Reforge: encourage moving toward the enemy Home Apex ---
  // FIX: "the coach doesn't seem to understand the need to re-forge" — the
  // per-square gradient below is now scaled by pm.reforge too (so it's the
  // dominant concern in the endgame phase, not just a tie-breaker), and a
  // feasibility cliff has been added: once the fastest possible runner can
  // no longer reach the enemy Home Apex within the turns actually left on
  // the clock, that's a losing Reforge, and the evaluation should say so
  // loudly rather than let some unrelated tactical nicety look better by
  // comparison. (See also chooseAiMove/updateCoachHint, which now search
  // deeper specifically in the endgame phase so this gradient is visible
  // far enough ahead to actually steer toward the winning path.)
  if (!engine.blueAlive[me]) {
    const enemyHome = engine.enemyHomeApexOf(me);
    let bestDist = Infinity;
    for (const p of engine.pieces) {
      if (p.isAlive && p.player === me) {
        const d = Math.abs(p.x - enemyHome.x) + Math.abs(p.y - enemyHome.y);
        if (d < bestDist) bestDist = d;
      }
    }
    if (bestDist !== Infinity) {
      // Bonus: (max possible distance = 14) - current distance, scaled by
      // 20 and by pm.reforge (dominant in the endgame phase).
      score += (14 - bestDist) * 20 * pm.reforge;
      // Extra large bonus if already on the Apex (ready to plant)
      if (bestDist === 0) score += 1000 * pm.reforge;
      // Feasibility cliff: 5 is the fastest any piece can ever cover in a
      // single turn (Blue's own Onward distance — the ceiling for every
      // piece type). If the remaining distance can no longer be covered
      // in the turns actually left, the Reforge is failing.
      const turnsLeft = engine.reforgeCountdown[me];
      if (turnsLeft > 0 && bestDist > turnsLeft * 5) {
        score -= 400 * pm.reforge;
      }
    }
  }
  if (!engine.blueAlive[opp]) {
    const enemyHome = engine.enemyHomeApexOf(opp);
    let bestDist = Infinity;
    for (const p of engine.pieces) {
      if (p.isAlive && p.player === opp) {
        const d = Math.abs(p.x - enemyHome.x) + Math.abs(p.y - enemyHome.y);
        if (d < bestDist) bestDist = d;
      }
    }
    if (bestDist !== Infinity) {
      score -= (14 - bestDist) * 20 * pm.reforge;
      if (bestDist === 0) score -= 1000 * pm.reforge;
      const turnsLeft = engine.reforgeCountdown[opp];
      if (turnsLeft > 0 && bestDist > turnsLeft * 5) {
        score += 400 * pm.reforge;
      }
    }
  }

  return score;
}

function candidateMoves(engine, player) {
  const out = [];
  for (const piece of engine.pieces) {
    if (!piece.isAlive || piece.player !== player) continue;
    for (const mv of engine.getValidMoves(piece.id)) out.push({ pieceId: piece.id, move: mv });
  }
  return out;
}

// Cheap static score used purely to ORDER moves before searching them,
// so alpha-beta sees the strongest-looking moves first and prunes far
// more of the tree. This is not the real evaluation — it never touches
// the engine state — just a fast heuristic guess (MVV-LVA-flavored: a
// big capture by a small piece ranks above a small capture by a big one).
function moveOrderScore(engine, cand) {
  const piece = engine.pieces.find(p => p.id === cand.pieceId);
  if (!piece) return 0;
  let s = 0;
  if (cand.move.capture) {
    const target = engine.pieces.find(p => p.id === cand.move.targetId);
    const targetVal = target ? PIECE_VALUE[target.type] : 0;
    const moverVal = PIECE_VALUE[piece.type];
    s += 1000 + targetVal * 2 - moverVal / 10;
    // FIX: always examine a shot at the enemy Blue first — alpha-beta
    // prunes far more when the actually-best move (which a Blue capture
    // almost always is) is searched first at each node.
    if (target && target.type === 'blue') s += 500;
  }
  // FIX: bumped from 50 — Blue's own specials are rare, decisive, and
  // easy for a shallow search to underrate against ordinary captures.
  if (cand.move.special) s += 150;
  const enemyHome = engine.enemyHomeApexOf(piece.player);
  const dPrev = Math.abs(piece.x - enemyHome.x) + Math.abs(piece.y - enemyHome.y);
  const dNew = Math.abs(cand.move.x - enemyHome.x) + Math.abs(cand.move.y - enemyHome.y);
  s += (dPrev - dNew); // small nudge toward moves that advance
  return s;
}

function orderedCandidateMoves(engine, player) {
  const moves = candidateMoves(engine, player);
  moves.sort((a, b) => moveOrderScore(engine, b) - moveOrderScore(engine, a));
  return moves;
}

const QUIESCENCE_DEPTH = 3;

// Quiescence search: once the main search bottoms out, keep extending
// through CAPTURES ONLY for a few more plies before trusting the static
// evaluation. This is the standard fix for the "horizon effect," where a
// fixed-depth search stops looking exactly one ply before a piece it
// just moved gets recaptured, making a bad trade look free. Non-capture
// moves are never extended here — only forcing sequences.
function quiescence(engine, alpha, beta, weights, me, qDepth) {
  const standPat = evaluate(engine, weights, me);
  if (engine.winner || qDepth <= 0 || engine.pendingReforge) return standPat;

  const maximizing = engine.turn === me;
  if (maximizing) {
    if (standPat >= beta) return standPat;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return standPat;
    beta = Math.min(beta, standPat);
  }

  const player = engine.turn;
  const captureMoves = candidateMoves(engine, player).filter(c => c.move.capture);
  if (captureMoves.length === 0) return standPat;
  captureMoves.sort((a, b) => moveOrderScore(engine, b) - moveOrderScore(engine, a));

  let best = standPat;
  for (const cand of captureMoves) {
    const clone = engine.clone();
    clone.makeMove(cand.pieceId, cand.move);
    const val = quiescence(clone, alpha, beta, weights, me, qDepth - 1);
    if (maximizing) {
      best = Math.max(best, val);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, val);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function search(engine, depth, alpha, beta, weights, me) {
  if (engine.winner) return evaluate(engine, weights, me);
  if (depth <= 0) return quiescence(engine, alpha, beta, weights, me, QUIESCENCE_DEPTH);

  if (engine.pendingReforge) {
    const player = engine.pendingReforge.player;
    const maximizing = player === me;
    let best = maximizing ? -Infinity : Infinity;
    for (const opt of engine.pendingReforge.options) {
      const clone = engine.clone();
      clone.resolveReforge(opt.key);
      const val = search(clone, depth - 1, alpha, beta, weights, me);
      if (maximizing) { best = Math.max(best, val); alpha = Math.max(alpha, val); }
      else { best = Math.min(best, val); beta = Math.min(beta, val); }
      if (beta <= alpha) break;
    }
    return best;
  }

  const player = engine.turn;
  const maximizing = player === me;
  const moves = orderedCandidateMoves(engine, player);
  if (moves.length === 0) return evaluate(engine, weights, me);

  let best = maximizing ? -Infinity : Infinity;
  for (const cand of moves) {
    const clone = engine.clone();
    clone.makeMove(cand.pieceId, cand.move);
    const val = search(clone, depth - 1, alpha, beta, weights, me);
    if (maximizing) { best = Math.max(best, val); alpha = Math.max(alpha, val); }
    else { best = Math.min(best, val); beta = Math.min(beta, val); }
    if (beta <= alpha) break;
  }
  return best;
}

// Picks a move for `player`, styled by `schoolId`. Uses iterative
// deepening: it searches depth 1, then 2, ... up to the requested depth,
// each time trying the previous iteration's best move first. This gives
// alpha-beta a strong first guess to prune against at every depth, so
// the search explores its time budget far more efficiently than a single
// fixed-depth pass with arbitrary move order. Returns null if the player
// genuinely has no legal move anywhere (shouldn't normally be called in
// that case — the engine itself declares a draw first).
export function chooseAiMove(engine, player, schoolId, depth = 3) {
  const school = SCHOOLS[schoolId] || SCHOOLS.ykrul;
  const weights = school.weights;
  let moves = orderedCandidateMoves(engine, player);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  let bestMoves = [moves[0]];
  let pv = null;

  for (let d = 1; d <= depth; d++) {
    if (pv) {
      const idx = moves.findIndex(c => c.pieceId === pv.pieceId && c.move.x === pv.move.x && c.move.y === pv.move.y && c.move.special === pv.move.special);
      if (idx > 0) {
        const [found] = moves.splice(idx, 1);
        moves.unshift(found);
      }
    }

    let alpha = -Infinity;
    const beta = Infinity;
    let bestScore = -Infinity;
    let iterBestMoves = [];

    for (const cand of moves) {
      const clone = engine.clone();
      clone.makeMove(cand.pieceId, cand.move);
      const score = search(clone, d - 1, alpha, beta, weights, player);
      if (score > bestScore + 1e-6) {
        bestScore = score;
        iterBestMoves = [cand];
      } else if (Math.abs(score - bestScore) <= 1e-6) {
        iterBestMoves.push(cand);
      }
      alpha = Math.max(alpha, bestScore);
    }

    if (iterBestMoves.length > 0) {
      bestMoves = iterBestMoves;
      pv = bestMoves[0];
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Picks a Reforge placement for the pending player, styled by schoolId.
export function chooseAiReforgeChoice(engine, schoolId, depth = 2) {
  if (!engine.pendingReforge) return null;
  const school = SCHOOLS[schoolId] || SCHOOLS.ykrul;
  const weights = school.weights;
  const player = engine.pendingReforge.player;

  let bestScore = -Infinity;
  let bestOpt = null;
  for (const opt of engine.pendingReforge.options) {
    const clone = engine.clone();
    clone.resolveReforge(opt.key);
    const score = search(clone, depth, -Infinity, Infinity, weights, player);
    if (score > bestScore) { bestScore = score; bestOpt = opt; }
  }
  return bestOpt;
}

// ============================================================
//  DESCRIPTION HELPERS
// ============================================================

const TYPE_LABEL = { blue: 'B', orange: 'O', red: 'R', green: 'G' };
const TYPE_NAME = { blue: 'Blue', orange: 'Orange', red: 'Red', green: 'Green' };

function describeMove(game, piece, move, titleFn) {
  const nameOf = (t) => (titleFn ? titleFn(t) : TYPE_NAME[t.type]);
  if (move.special === 'S:D') {
    const t = game.pieces.find(p => p.id === move.targetId);
    return `Displacement — capture ${t ? nameOf(t) : 'piece'} at (${move.x},${move.y})`;
  }
  if (move.special === 'S:H') {
    const t = game.pieces.find(p => p.id === move.targetId);
    return `Hop-capture — jump ${t ? nameOf(t) : 'piece'} at (${t ? t.x : '?'},${t ? t.y : '?'}), land (${move.x},${move.y})`;
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
//  COACH HINTS (approximate SSI / XS, live)
// ============================================================
// These are simplified, single-ply approximations of the Concordance's
// own named heuristics — not the full multi-ply lookahead a strong human
// player would do. They're meant as a live, honest nudge in the stat
// panel, not a rigorous solver.

function computeExitCertainty(game, blue) {
  if (!blue || blue.rooted) return 0;
  const moves = game.getValidMoves(blue.id);
  return moves.filter(m => !game.isCross(m.x, m.y)).length;
}

function computeSeedSafety(game, blue) {
  const enemyPlayer = blue.player === 1 ? 2 : 1;
  const enemyBlue = game.getBlue(enemyPlayer);
  if (!enemyBlue) return 2; // enemy Blue is off the board (mid-Reforge) — safe
  const specialsLeft = 2 - enemyBlue.specialsUsed.length;
  const dist = Math.abs(enemyBlue.x - blue.x) + Math.abs(enemyBlue.y - blue.y);
  if (specialsLeft > 0 && dist <= 6) return 0;
  if (specialsLeft > 0 || dist <= 8) return 1;
  return 2;
}

const HINT_QUALIFIER = { 0: 'risky', 1: 'playable', 2: 'safe' };

// ============================================================
//  NETWORK STATE (SERIALIZE / LOAD) — used by connected mode
// ============================================================
// Plain-data snapshot of everything a KonrehEngine needs to resume from,
// safe to JSON.stringify (the only non-JSON-safe field, doubleMoveUsed,
// is a Set — converted to/from a plain array here).

function serializeGameState(game) {
  return {
    board: game.board,
    pieces: game.pieces,
    turn: game.turn,
    winner: game.winner,
    winReason: game.winReason,
    openingDoubleMoveDone: game.openingDoubleMoveDone,
    firstMoveDone: game.firstMoveDone,
    doubleMoveUsed: [...game.doubleMoveUsed],
    reforgeCountdown: game.reforgeCountdown,
    blueAlive: game.blueAlive,
    greenCount: game.greenCount,
    pendingReforge: game.pendingReforge,
  };
}

function loadGameStateInto(game, state) {
  game.board = state.board.map(row => row.slice());
  game.pieces = state.pieces.map(p => ({ ...p, specialsUsed: [...p.specialsUsed] }));
  game.turn = state.turn;
  game.winner = state.winner;
  game.winReason = state.winReason;
  game.openingDoubleMoveDone = state.openingDoubleMoveDone;
  game.firstMoveDone = state.firstMoveDone;
  game.doubleMoveUsed = new Set(state.doubleMoveUsed);
  game.reforgeCountdown = { ...state.reforgeCountdown };
  game.blueAlive = { ...state.blueAlive };
  game.greenCount = state.greenCount;
  game.moveHistory = [];
  game.pendingReforge = state.pendingReforge
    ? { player: state.pendingReforge.player, options: state.pendingReforge.options.map(o => ({ ...o })) }
    : null;
}

// ============================================================
//  MODAL UI (with Coach glow and destination highlight)
// ============================================================

export function openKonrehModal(netConfig = null) {
  const existing = document.getElementById('konreh-modal');
  if (existing) existing.remove();

  // ---- Injected styles ----
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
    #konreh-modal .kr-coach-tip { background:#1a2a1a; border-left: 3px solid #4ecdc4; padding: 6px 10px; border-radius: 4px; font-size: 12px; color: #b8e6e0; margin-top: 6px; min-height: 28px; transition: all 0.15s; }
  `;
  document.head.appendChild(style);

  // ---- Inline editor screen (not a pop-up) ----
  const modal = document.createElement('div');
  modal.id = 'konreh-modal';
  modal.className = 'editor-screen-host';
  modal.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px 0;
  `;

  let konrehHiddenSiblings = null;
  const closeKonrehModal = () => {
    modal.remove();
    if (konrehHiddenSiblings) {
      konrehHiddenSiblings.forEach(ch => { ch.style.display = ''; });
      konrehHiddenSiblings = null;
    }
  };

  const content = document.createElement('div');
  content.style.cssText = `
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 20px; display: flex; gap: 20px; max-width: 980px; width: 100%; color: var(--ink);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 92vh; overflow: auto; flex-wrap: wrap;
  `;

  // ---- Game column ----
  const gameArea = document.createElement('div');
  gameArea.style.cssText = 'flex: 1 1 480px; display: flex; flex-direction: column; align-items: center; min-width: 340px;';

  // Title row with close button
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
  closeBtnTop.onclick = () => { stopCoachAnimation(); closeKonrehModal(); };
  titleRow.appendChild(closeBtnTop);
  gameArea.appendChild(titleRow);

  // ---- Setup screen (choose mode) ----
  const setupScreen = document.createElement('div');
  setupScreen.style.cssText = 'width:100%; display:flex; flex-direction:column; align-items:center; gap:14px; padding: 18px 0 8px;';

  const setupIntro = document.createElement('div');
  setupIntro.style.cssText = 'text-align:center; color:var(--muted); font-size:13px;';
  setupIntro.textContent = 'Choose how to play.';
  setupScreen.appendChild(setupIntro);

  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex; gap:10px;';
  const twoPlayerBtn = document.createElement('button');
  twoPlayerBtn.className = 'kr-btn primary';
  twoPlayerBtn.textContent = '👥 Two Players';
  const vsAiBtn = document.createElement('button');
  vsAiBtn.className = 'kr-btn';
  vsAiBtn.textContent = '🤖 vs Computer';
  modeRow.appendChild(twoPlayerBtn);
  modeRow.appendChild(vsAiBtn);
  setupScreen.appendChild(modeRow);

  // ---- Coach Mode panel (always visible) ----
  const coachPanel = document.createElement('div');
  coachPanel.style.cssText = 'width:100%; max-width:460px; display:flex; flex-direction:column; gap:8px; align-items:center; padding: 4px 0;';
  const coachToggleRow = document.createElement('div');
  coachToggleRow.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted);';
  const coachCheck = document.createElement('input');
  coachCheck.type = 'checkbox';
  coachCheck.id = 'kr-coach-toggle';
  const coachLabelEl = document.createElement('label');
  coachLabelEl.htmlFor = 'kr-coach-toggle';
  coachLabelEl.style.cursor = 'pointer';
  coachLabelEl.textContent = '💡 Coach Mode — live move suggestions & teaching';
  coachToggleRow.appendChild(coachCheck);
  coachToggleRow.appendChild(coachLabelEl);
  coachPanel.appendChild(coachToggleRow);

  const coachSchoolRow = document.createElement('div');
  coachSchoolRow.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted);';
  const coachSchoolLabel = document.createElement('span');
  coachSchoolLabel.textContent = 'Coached by:';
  const coachSchoolSelect = document.createElement('select');
  coachSchoolSelect.id = 'kr-coach-school';
  coachSchoolSelect.disabled = true;
  coachSchoolSelect.style.cssText = 'background:#101119; color:var(--ink); border:1px solid var(--line); border-radius:6px; padding:5px 8px; font-size:12px;';
  Object.entries(SCHOOLS).forEach(([id, school]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${school.name} — ${school.tagline}`;
    coachSchoolSelect.appendChild(opt);
  });
  coachSchoolRow.appendChild(coachSchoolLabel);
  coachSchoolRow.appendChild(coachSchoolSelect);
  coachPanel.appendChild(coachSchoolRow);

  coachCheck.addEventListener('change', () => {
    coachSchoolSelect.disabled = !coachCheck.checked;
  });

  setupScreen.appendChild(coachPanel);

  // ---- School selection panel (hidden until vs AI clicked) ----
  const schoolPanel = document.createElement('div');
  schoolPanel.style.cssText = 'width:100%; max-width:460px; display:none; flex-direction:column; gap:12px; align-items:center;';
  setupScreen.appendChild(schoolPanel);

  const schoolLabel = document.createElement('div');
  schoolLabel.style.cssText = 'color:var(--gold); font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; align-self:flex-start;';
  schoolLabel.textContent = 'Choose a School';
  schoolPanel.appendChild(schoolLabel);

  const schoolGrid = document.createElement('div');
  schoolGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%;';
  schoolPanel.appendChild(schoolGrid);

  let chosenSchool = 'ykrul';
  let chosenAiPlayer = 2;
  let aiDepth = 3; // default medium
  let coachMode = false;
  let coachSchoolId = 'ykrul';
  const schoolCards = {};
  Object.entries(SCHOOLS).forEach(([id, school]) => {
    const card = document.createElement('button');
    card.className = 'kr-btn';
    card.style.cssText = 'text-align:left; padding:10px 12px; display:flex; flex-direction:column; gap:3px; border:1px solid #3a3b4a;';
    card.innerHTML = `<div style="font-weight:700; color:var(--gold);">${school.name}</div><div style="font-size:11px; color:var(--muted); font-weight:400;">${school.tagline}</div>`;
    card.onclick = () => {
      chosenSchool = id;
      Object.values(schoolCards).forEach(c => c.style.borderColor = '#3a3b4a');
      card.style.borderColor = 'var(--gold)';
    };
    schoolGrid.appendChild(card);
    schoolCards[id] = card;
  });
  schoolCards[chosenSchool].style.borderColor = 'var(--gold)';

  // Depth selector
  const depthRow = document.createElement('div');
  depthRow.style.cssText = 'display:flex; gap:16px; align-items:center; font-size:12px; color:var(--muted); width:100%; justify-content:center; padding:4px 0;';
  depthRow.innerHTML = `
    <span style="font-weight:600;">Difficulty:</span>
    <label><input type="radio" name="kr-depth" value="2"> Easy</label>
    <label><input type="radio" name="kr-depth" value="3" checked> Medium</label>
    <label><input type="radio" name="kr-depth" value="4"> Hard</label>
    <label><input type="radio" name="kr-depth" value="5"> Expert</label>
  `;
  schoolPanel.appendChild(depthRow);

  // Side selection for AI
  const sideRow = document.createElement('div');
  sideRow.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted); flex-wrap:wrap; justify-content:center;';
  const sideLabel = document.createElement('span');
  sideLabel.textContent = 'Computer plays:';
  const p1SideBtn = document.createElement('button');
  p1SideBtn.className = 'kr-btn';
  p1SideBtn.textContent = 'Player 1 (first)';
  const p2SideBtn = document.createElement('button');
  p2SideBtn.className = 'kr-btn primary';
  p2SideBtn.textContent = 'Player 2 (second, opening double-move)';
  p1SideBtn.onclick = () => { chosenAiPlayer = 1; p1SideBtn.className = 'kr-btn primary'; p2SideBtn.className = 'kr-btn'; };
  p2SideBtn.onclick = () => { chosenAiPlayer = 2; p2SideBtn.className = 'kr-btn primary'; p1SideBtn.className = 'kr-btn'; };
  sideRow.appendChild(sideLabel);
  sideRow.appendChild(p1SideBtn);
  sideRow.appendChild(p2SideBtn);
  schoolPanel.appendChild(sideRow);

  const startBtn = document.createElement('button');
  startBtn.className = 'kr-btn primary';
  startBtn.textContent = '▶ Start Game';
  startBtn.style.cssText = 'margin-top:4px;';
  schoolPanel.appendChild(startBtn);

  gameArea.appendChild(setupScreen);

  // ---- Board container (hidden until game starts) ----
  const boardContainer = document.createElement('div');
  boardContainer.style.cssText = 'width:100%; display:none; flex-direction:column; align-items:center;';

  const canvas = document.createElement('canvas');
  canvas.width = 520; canvas.height = 520;
  canvas.style.cssText = 'border: 1px solid var(--line); background: #0c0d12; cursor: pointer; border-radius: 8px; max-width:100%; height:auto;';
  boardContainer.appendChild(canvas);

  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'margin-top: 12px; font-size: 13.5px; color: var(--ink); text-align: center; min-height: 22px; font-weight:600;';
  boardContainer.appendChild(statusDiv);

  // Coach tip div – shows the suggestion and also the selected piece coordinates
  const coachTipDiv = document.createElement('div');
  coachTipDiv.className = 'kr-coach-tip';
  coachTipDiv.textContent = '💡 Coach will suggest moves when it\'s your turn.';
  coachTipDiv.style.display = 'none';
  boardContainer.appendChild(coachTipDiv);

  // Info grid for stats
  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = 'width:100%; display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; font-size:12px;';
  boardContainer.appendChild(infoGrid);

  // Choice panel (for multiple moves on same square)
  const choicePanel = document.createElement('div');
  choicePanel.style.cssText = 'width:100%; margin-top:10px; display:none;';
  boardContainer.appendChild(choicePanel);

  // Controls row
  const controlsRow = document.createElement('div');
  controlsRow.style.cssText = 'width:100%; display:flex; gap:8px; margin-top:14px; justify-content:center;';
  const resetBtn = document.createElement('button');
  resetBtn.className = 'kr-btn';
  resetBtn.textContent = '🔄 New Game';
  controlsRow.appendChild(resetBtn);
  boardContainer.appendChild(controlsRow);

  gameArea.appendChild(boardContainer);

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

  const talkHeader = document.createElement('div');
  talkHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;';
  talkHeader.innerHTML = `<span style="color:var(--gold); font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">Table Talk</span><span id="kr-talk-caret" style="color:var(--muted); font-size:11px;">▸ show</span>`;
  sidebar.appendChild(talkHeader);

  const talkBody = document.createElement('div');
  talkBody.style.cssText = 'display:none; flex-direction:column; gap:6px;';
  sidebar.appendChild(talkBody);

  const talkLog = document.createElement('div');
  talkLog.className = 'kr-log kr-scroll';
  talkLog.style.cssText = 'background:#101119; border:1px solid var(--line); border-radius:6px; padding:8px 10px; height:90px; overflow-y:auto; font-size:11.5px;';
  talkBody.appendChild(talkLog);

  const talkInputRow = document.createElement('div');
  talkInputRow.style.cssText = 'display:flex; gap:6px;';
  const talkInput = document.createElement('input');
  talkInput.type = 'text';
  talkInput.placeholder = 'Say something…';
  talkInput.maxLength = 140;
  talkInput.style.cssText = 'flex:1; min-width:0; background:#101119; border:1px solid var(--line); border-radius:6px; padding:6px 8px; color:var(--ink); font-size:12px;';
  const talkSendBtn = document.createElement('button');
  talkSendBtn.className = 'kr-btn';
  talkSendBtn.textContent = 'Send';
  talkInputRow.appendChild(talkInput);
  talkInputRow.appendChild(talkSendBtn);
  talkBody.appendChild(talkInputRow);

  let talkOpen = false;
  const talkCaret = talkHeader.querySelector('#kr-talk-caret');
  talkHeader.addEventListener('click', () => {
    talkOpen = !talkOpen;
    talkBody.style.display = talkOpen ? 'flex' : 'none';
    talkCaret.textContent = talkOpen ? '▾ hide' : '▸ show';
  });

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
  const konrehHost = document.getElementById('app-content') || document.body;
  konrehHiddenSiblings = Array.from(konrehHost.children);
  konrehHiddenSiblings.forEach(ch => { ch.style.display = 'none'; });
  konrehHost.appendChild(modal);
  window.scrollTo({ top: 0 });

  // ---- Game Engine & UI state ----
  const ctx = canvas.getContext('2d');
  const scale = 29;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  let game = new KonrehEngine();
  let selectedPiece = null;
  let validMoves = [];
  let pendingChoice = null;
  let aiConfig = null;      // { schoolId, player, depth }
  let aiThinking = false;

  // Coach: a cached { piece, move } suggestion, keyed off the current
  // game state so we only re-run the search when something actually
  // changed, plus a rAF handle so the on-screen arrow can pulse smoothly
  // without re-searching every frame.
  let coachHint = null;
  let coachHintKey = null;
  let coachAnimHandle = null;

  const isNetworked = !!netConfig;
  const localPlayer = netConfig ? netConfig.localPlayer : null;
  let localSeq = 0;

  // ---- Helper functions ----
  function pieceTitle(piece) {
    if (aiConfig && aiConfig.player === piece.player && PIECE_TITLES[aiConfig.schoolId]) {
      return PIECE_TITLES[aiConfig.schoolId][piece.type];
    }
    return TYPE_NAME[piece.type];
  }

  function log(html) {
    const line = document.createElement('div');
    line.innerHTML = html;
    logDiv.appendChild(line);
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function talkLine(html) {
    const line = document.createElement('div');
    line.innerHTML = html;
    talkLog.appendChild(line);
    talkLog.scrollTop = talkLog.scrollHeight;
  }

  function sendTalk(text) {
    text = (text || '').trim();
    if (!text) return;
    const who = isNetworked ? `Player ${localPlayer}` : 'You';
    talkLine(`<span class="p${isNetworked ? localPlayer : game.turn}">${who}</span>: ${escapeHtml(text)}`);
    talkInput.value = '';
    if (isNetworked && netConfig.onLocalChat) netConfig.onLocalChat(text);
  }

  talkSendBtn.addEventListener('click', () => sendTalk(talkInput.value));
  talkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendTalk(talkInput.value);
  });

  function beginGame() {
    game = new KonrehEngine();
    selectedPiece = null; validMoves = []; pendingChoice = null; aiThinking = false;
    coachHint = null; coachHintKey = null;
    logDiv.innerHTML = '';
    setupScreen.style.display = 'none';
    boardContainer.style.display = 'flex';
    coachTipDiv.style.display = coachMode ? 'block' : 'none';
    if (aiConfig) {
      const depthLabel = aiConfig.depth === 2 ? 'Easy' : aiConfig.depth === 3 ? 'Medium' : aiConfig.depth === 4 ? 'Hard' : 'Expert';
      log(`<i>Game started — vs computer (${SCHOOLS[aiConfig.schoolId].name}, ${depthLabel}).</i>`);
      const opening = TABLE_TALK_OPENING[aiConfig.schoolId];
      if (opening) talkLine(`<i style="color:var(--muted);">${SCHOOLS[aiConfig.schoolId].name}: "${opening}"</i>`);
    } else {
      log('<i>Game started — Player 1 to move.</i>');
    }
    render();
    maybeTriggerAiMove();
  }

  function maybeTriggerAiMove() {
    if (!aiConfig || game.winner || aiThinking) return;
    const activePlayer = game.pendingReforge ? game.pendingReforge.player : game.turn;
    if (activePlayer !== aiConfig.player) return;

    aiThinking = true;
    statusDiv.textContent = `${SCHOOLS[aiConfig.schoolId].name} is thinking…`;
    setTimeout(() => {
      if (game.winner) { aiThinking = false; render(); return; }
      if (game.pendingReforge) {
        const player = game.pendingReforge.player;
        const reforgeDepth = aiConfig.depth <= 2 ? 1 : aiConfig.depth === 3 ? 2 : aiConfig.depth === 4 ? 3 : 4;
        const opt = chooseAiReforgeChoice(game, aiConfig.schoolId, reforgeDepth);
        if (opt) {
          game.resolveReforge(opt.key);
          log(`<span class="p${player}">P${player} (${SCHOOLS[aiConfig.schoolId].name})</span> Reforge → <b>${opt.label}</b>`);
        }
        aiThinking = false;
        render();
        maybeTriggerAiMove();
        return;
      }
      const player = game.turn;
      // FIX: "the endgame needs refinement" — a fixed search depth can be
      // too shallow to actually see the Reforge path once a Blue is down
      // (the enemy Home Apex can be up to 14 squares away, and the
      // per-square Reforge-proximity gradient in evaluate() only steers
      // the search toward it if the search is deep enough to notice it
      // moving). Search one ply deeper, capped at 5, whenever either
      // Blue is dead so the AI reliably finds/commits to the beeline.
      const isReforgeRace = !game.blueAlive[1] || !game.blueAlive[2];
      const moveDepth = isReforgeRace ? Math.min(5, aiConfig.depth + 1) : aiConfig.depth;
      const cand = chooseAiMove(game, player, aiConfig.schoolId, moveDepth);
      aiThinking = false;
      if (!cand) { render(); return; }
      const piece = game.pieces.find(p => p.id === cand.pieceId);
      executeMove(cand.move, piece);
    }, 450);
  }

  // ---- Coordinate conversions ----
  function gridToScreen(x, y) {
    return { sx: cx + (x - y) * scale, sy: cy + (x + y - 7) * scale };
  }
  function screenToGrid(sx, sy) {
    const dx = (sx - cx) / scale, dy = (sy - cy) / scale;
    return { x: Math.round((dx + dy + 7) / 2), y: Math.round((dy - dx + 7) / 2) };
  }

  // ---- Drawing helpers ----
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

  // ---- Small rounded label pill used by the coach overlay (e.g. "MOVE THIS", "TO HERE") ----
  function drawPillLabel(sx, sy, text, color) {
    ctx.save();
    ctx.font = 'bold 10px sans-serif';
    const paddingX = 6;
    const textWidth = ctx.measureText(text).width;
    const w = textWidth + paddingX * 2, h = 15;
    const rx = sx - w / 2, ry = Math.max(2, sy) - h / 2, r = 6;
    ctx.fillStyle = 'rgba(10,11,16,0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + w, ry, rx + w, ry + h, r);
    ctx.arcTo(rx + w, ry + h, rx, ry + h, r);
    ctx.arcTo(rx, ry + h, rx, ry, r);
    ctx.arcTo(rx, ry, rx + w, ry, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, ry + h / 2 + 1);
    ctx.restore();
  }

  // ---- Coach overlay: one unambiguous "move THIS piece to HERE" visual —
  // a pulsing ring + tag on the source piece, a pulsing target + tag on
  // the destination square, and an arrow connecting the two so there's
  // never any doubt about which piece goes where. ----
  function drawCoachOverlay(hint, pulsePhase) {
    const { piece, move } = hint;
    const p = 0.7 + 0.3 * Math.sin(pulsePhase); // 0.4..1.0 pulse factor
    const from = gridToScreen(piece.x, piece.y);
    const to = gridToScreen(move.x, move.y);

    ctx.save();

    const dist = Math.hypot(to.sx - from.sx, to.sy - from.sy) || 1;
    const angle = Math.atan2(to.sy - from.sy, to.sx - from.sx);
    const trimStart = Math.min(scale * 0.85, dist * 0.3);
    const trimEnd = Math.min(scale * 1.05, dist * 0.3);
    const x1 = from.sx + Math.cos(angle) * trimStart, y1 = from.sy + Math.sin(angle) * trimStart;
    const x2 = to.sx - Math.cos(angle) * trimEnd, y2 = to.sy - Math.sin(angle) * trimEnd;

    // Connecting arrow shaft
    ctx.strokeStyle = `rgba(255,215,0,${0.5 + 0.35 * p})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const headLen = Math.min(11 + 3 * p, dist * 0.22);
    ctx.fillStyle = `rgba(255,215,0,${0.55 + 0.4 * p})`;
    ctx.beginPath();
    ctx.moveTo(x2 + Math.cos(angle) * 5, y2 + Math.sin(angle) * 5);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Source marker: pulsing gold ring around the piece to move
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20 * p;
    ctx.beginPath();
    ctx.arc(from.sx, from.sy, scale * 0.88, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${0.85 * p + 0.15})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawPillLabel(from.sx, from.sy - scale - 13, 'MOVE THIS', '#ffd700');

    // Destination marker: pulsing cyan target on the landing square
    ctx.shadowColor = '#4ecdc4';
    ctx.shadowBlur = 20 * p;
    diamondPath(move.x, move.y);
    ctx.strokeStyle = `rgba(78,205,196,${0.85 * p + 0.15})`;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(to.sx, to.sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#4ecdc4';
    ctx.fill();
    drawPillLabel(to.sx, to.sy - scale - 13, 'TO HERE', '#4ecdc4');

    ctx.restore();
  }

  // ---- Coach hint: recompute only when the game state actually changed
  // (turn, move count, or coached school), never on every animation frame ----
  function updateCoachHint() {
    if (!coachMode) { coachHint = null; coachHintKey = null; return; }
    const isHumanTurn = !aiConfig || game.turn !== aiConfig.player;
    const isLocalTurn = !isNetworked || game.turn === localPlayer;
    if (game.winner || game.pendingReforge || aiThinking || !isHumanTurn || !isLocalTurn) {
      coachHint = null; coachHintKey = null;
      return;
    }
    const key = `${game.moveHistory.length}:${game.turn}:${coachSchoolId}`;
    if (key === coachHintKey && coachHint) return; // cached suggestion is still valid
    coachHintKey = key;
    // FIX: "the coach doesn't seem to understand the need to re-forge" —
    // the coach used to always search at a flat depth of 3, which is
    // often too shallow to see far enough toward the enemy Home Apex once
    // your own Blue is down (a Reforge run can be up to 14 squares).
    // Search one ply deeper during a Reforge race so the suggested move
    // actually commits to the beeline instead of defaulting to whatever
    // ordinary tactical move happens to look best 3 plies out.
    const isReforgeRace = !game.blueAlive[1] || !game.blueAlive[2];
    const coachDepth = isReforgeRace ? 4 : 3;
    const result = chooseAiMove(game, game.turn, coachSchoolId, coachDepth);
    if (!result) { coachHint = null; return; }
    const piece = game.pieces.find(p => p.id === result.pieceId);
    coachHint = piece ? { piece, move: result.move } : null;
  }

  function coachTipText() {
    if (!coachMode) return '💡 Coach will suggest moves when it\'s your turn.';
    const isHumanTurn = !aiConfig || game.turn !== aiConfig.player;
    const isLocalTurn = !isNetworked || game.turn === localPlayer;
    if (game.winner || game.pendingReforge || aiThinking || !isHumanTurn || !isLocalTurn) {
      return '⏳ Waiting for your turn...';
    }
    if (!coachHint) return '🤔 No strong suggestions available.';
    const { piece, move } = coachHint;
    const coachSchool = SCHOOLS[coachSchoolId] || SCHOOLS.ykrul;
    // FIX: "the coach doesn't seem to understand the need to re-forge" —
    // surface the Reforge race explicitly in the coach's own reasoning,
    // not just in its move choice, so a player watching the hint text
    // actually understands WHY the suggested move heads where it does.
    if (!game.blueAlive[game.turn]) {
      const turnsLeft = game.reforgeCountdown[game.turn];
      const enemyHome = game.enemyHomeApexOf(game.turn);
      const dist = Math.abs(move.x - enemyHome.x) + Math.abs(move.y - enemyHome.y);
      let urgent = `💡 ${coachSchool.name}: your Blue is down — Reforge race, ${turnsLeft} turn${turnsLeft === 1 ? '' : 's'} left. `;
      urgent += `Run the ${TYPE_NAME[piece.type]} at (${piece.x},${piece.y}) to (${move.x},${move.y})`;
      urgent += dist === 0
        ? ` — plants the banner on the enemy Home Apex right now!`
        : ` — ${dist} square${dist === 1 ? '' : 's'} left to the enemy Home Apex.`;
      return urgent;
    }
    let reason = `${coachSchool.name}: move the ${TYPE_NAME[piece.type]} at (${piece.x},${piece.y}) to (${move.x},${move.y})`;
    if (move.capture) {
      const target = game.pieces.find(p => p.id === move.targetId);
      if (target) reason += ` — captures ${TYPE_NAME[target.type]}!`;
    }
    if (move.special === 'S:D') reason += ` — Displacement (steps onto an adjacent enemy).`;
    if (move.special === 'S:H') reason += ` — Hop (jumps an adjacent enemy to the square beyond).`;
    if (piece.type === 'blue' && game.isCross(move.x, move.y) && !game.isCross(piece.x, piece.y)) {
      reason += ` — enters the Cross (up to 3 consecutive turns, then a 2‑turn ban).`;
    }
    if (piece.type === 'blue' && game.isSanctum(move.x, move.y)) reason += ` — lands on a Sanctum (may Seed a Green).`;
    if (piece.type !== 'blue') {
      const onwardLane = (game.lanesFor(piece.player).onward).some(([dx, dy]) => move.x === piece.x + dx * ONWARD_DIST[piece.type] && move.y === piece.y + dy * ONWARD_DIST[piece.type]);
      reason += onwardLane ? ` — full Onward distance (exact, no shorter stop allowed).` : ` — Homeward (chose to stop partway).`;
    }
    return `💡 ${reason}`;
  }

  // ---- Board drawing split into small pieces so the coach animation loop
  // can redraw just the canvas (fast) without touching DOM stats/log ----
  function drawBoardCells() {
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
  }

  function drawSelectionHighlights() {
    if (!selectedPiece) return;
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

  function drawAllPieces() {
    for (const p of game.pieces) if (p.isAlive) drawPiece(p);
  }

  function coachPulsePhase() { return Date.now() / 450; }

  function drawBoardOnly() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoardCells();
    drawSelectionHighlights();
    drawAllPieces();
    if (coachMode && coachHint) drawCoachOverlay(coachHint, coachPulsePhase());
  }

  // ---- Keeps the coach arrow gently pulsing via requestAnimationFrame,
  // WITHOUT re-running the AI search every frame (that only happens in
  // updateCoachHint, which is cached). Starts/stops itself as needed. ----
  function syncCoachAnimation() {
    const shouldAnimate = coachMode && !!coachHint && !game.winner;
    if (shouldAnimate && coachAnimHandle == null) {
      const tick = () => {
        if (!coachMode || !coachHint || game.winner) { coachAnimHandle = null; return; }
        drawBoardOnly();
        coachAnimHandle = requestAnimationFrame(tick);
      };
      coachAnimHandle = requestAnimationFrame(tick);
    } else if (!shouldAnimate && coachAnimHandle != null) {
      cancelAnimationFrame(coachAnimHandle);
      coachAnimHandle = null;
    }
  }

  function stopCoachAnimation() {
    if (coachAnimHandle != null) {
      cancelAnimationFrame(coachAnimHandle);
      coachAnimHandle = null;
    }
  }

  // ---- Main render function ----
  function render() {
    updateCoachHint();
    drawBoardOnly();
    renderStatus();
    syncCoachAnimation();

    // Update status with selected piece coords (if any)
    if (selectedPiece) {
      statusDiv.textContent += `  |  Selected: (${selectedPiece.x}, ${selectedPiece.y})`;
    }
  }

  // ---- Status rendering (DOM only — drawing happens in drawBoardOnly) ----
  function renderStatus() {
    let statusText = game.getStatus();
    if (aiConfig && !game.winner && !game.pendingReforge && game.turn === aiConfig.player) {
      statusText = statusText.replace(`Player ${game.turn}'s Turn`, `Player ${game.turn}'s Turn (${SCHOOLS[aiConfig.schoolId].name})`);
    }
    statusDiv.textContent = statusText;

    coachTipDiv.style.display = coachMode ? 'block' : 'none';
    coachTipDiv.textContent = coachTipText();

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
      const turnLabel = (aiConfig && game.turn === aiConfig.player)
        ? `Player ${game.turn} (${SCHOOLS[aiConfig.schoolId].name})`
        : `Player ${game.turn}`;
      addStat('Turn', turnLabel);
      addStat('Green Pool', `${game.greenCount} / 6`);
      if (activeBlue) {
        addStat('Cross Stay', `${activeBlue.crossStays} / 3${activeBlue.crossExclusion ? ` (excl ${activeBlue.crossExclusion})` : ''}`);
        addStat('Specials Used', activeBlue.specialsUsed.length ? activeBlue.specialsUsed.join(', ') : 'none');

        const nearCross = game.isCross(activeBlue.x, activeBlue.y) ||
          game.getValidMoves(activeBlue.id).some(m => game.isCross(m.x, m.y));
        if (nearCross) {
          const xs = computeExitCertainty(game, activeBlue);
          addStat('Exit Certainty (XS)', `${xs} — ${HINT_QUALIFIER[Math.min(xs, 2)]}`);
        }
        if (game.isSanctum(activeBlue.x, activeBlue.y)) {
          const ssi = computeSeedSafety(game, activeBlue);
          addStat('Seed Safety (SSI)', `${ssi} — ${HINT_QUALIFIER[ssi]}`);
        }
      }
      if (!game.blueAlive[1]) addStat('P1 Reforge', `${game.reforgeCountdown[1]} turns left`);
      if (!game.blueAlive[2]) addStat('P2 Reforge', `${game.reforgeCountdown[2]} turns left`);
    }

    // Reforge choice panel
    if (game.pendingReforge) {
      choicePanel.style.display = 'block';
      const isAiReforge = aiConfig && game.pendingReforge.player === aiConfig.player;
      const isRemoteReforge = isNetworked && game.pendingReforge.player !== localPlayer;
      if (isAiReforge) {
        choicePanel.innerHTML = `<div style="color:var(--gold); font-weight:700; text-align:center;">
            ${SCHOOLS[aiConfig.schoolId].name} is choosing where Blue returns…</div>`;
      } else if (isRemoteReforge) {
        choicePanel.innerHTML = `<div style="color:var(--gold); font-weight:700; text-align:center;">
            Player ${game.pendingReforge.player} is choosing where Blue returns…</div>`;
      } else {
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
            localSeq++;
            if (isNetworked && netConfig.onLocalReforge) netConfig.onLocalReforge(opt.key, localSeq);
            render();
            maybeTriggerAiMove();
          };
          choicePanel.appendChild(btn);
        }
      }
    } else if (!pendingChoice) {
      choicePanel.style.display = 'none';
      choicePanel.innerHTML = '';
    }

    if (pendingChoice) {
      choicePanel.style.display = 'block';
      choicePanel.innerHTML = `<div style="color:var(--gold); font-weight:700; margin-bottom:8px; text-align:center;">
          Multiple moves to (${pendingChoice.x},${pendingChoice.y}) — choose one</div>`;
      for (const mv of pendingChoice.moves) {
        const btn = document.createElement('button');
        btn.className = 'kr-btn choice-btn kr-choice';
        btn.textContent = describeMove(game, selectedPiece, mv, pieceTitle);
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

  // ---- Execute a move ----
  function executeMove(move, movingPiece, moveOpts = {}) {
    const { isRemote = false } = moveOpts;
    const piece = movingPiece || selectedPiece;
    const player = piece.player;
    const greenBefore = game.greenCount;
    const blueAliveBefore = { 1: game.blueAlive[1], 2: game.blueAlive[2] };

    game.makeMove(piece.id, move);

    const isAiMove = aiConfig && aiConfig.player === player;
    const schoolTag = isAiMove ? ` <span class="kr-badge">${SCHOOLS[aiConfig.schoolId].name}</span>` : '';
    const moverName = isAiMove ? pieceTitle(piece) : TYPE_LABEL[piece.type];
    let entry = `<span class="p${player}">P${player} ${moverName}</span>${schoolTag} ${describeMove(game, piece, move, pieceTitle)}`;
    if (game.greenCount > greenBefore) entry += ' <span class="kr-badge">Seed</span>';
    const blueJustCaptured = blueAliveBefore[player === 1 ? 2 : 1] && !game.blueAlive[player === 1 ? 2 : 1];
    if (blueJustCaptured) {
      entry += ' <span class="kr-badge">Blue captured!</span>';
    }
    if (game.pendingReforge) entry += ' <span class="kr-badge">Banner planted</span>';
    log(entry);

    if (isAiMove) {
      // Capturing the enemy Blue is the biggest moment in the game — always
      // say something, and prefer a dedicated line if the School has one.
      if (blueJustCaptured) {
        talkLine(`<i style="color:var(--muted);">${SCHOOLS[aiConfig.schoolId].name}: "${randomSaying(aiConfig.schoolId)}"</i>`);
      } else if ((move.capture || move.special) && Math.random() < 0.35) {
        talkLine(`<i style="color:var(--muted);">${SCHOOLS[aiConfig.schoolId].name}: "${randomSaying(aiConfig.schoolId)}"</i>`);
      }
    }

    selectedPiece = null; validMoves = []; pendingChoice = null;
    localSeq++;
    if (isNetworked && !isRemote && netConfig.onLocalMove) netConfig.onLocalMove(piece.id, move, localSeq);
    render();
    if (!isRemote) maybeTriggerAiMove();
  }

  // ---- Canvas click handler ----
  canvas.addEventListener('click', (e) => {
    if (game.winner || game.pendingReforge) return;
    if (aiConfig && game.turn === aiConfig.player) return;
    if (isNetworked && game.turn !== localPlayer) return;
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

  // ---- UI event handlers ----
  function readCoachSettings() {
    coachMode = coachCheck.checked;
    coachSchoolId = coachSchoolSelect.value;
  }

  twoPlayerBtn.addEventListener('click', () => {
    aiConfig = null;
    readCoachSettings();
    beginGame();
  });

  vsAiBtn.addEventListener('click', () => {
    schoolPanel.style.display = schoolPanel.style.display === 'none' ? 'flex' : 'none';
  });

  startBtn.addEventListener('click', () => {
    const depthRadios = document.querySelectorAll('input[name="kr-depth"]');
    for (const r of depthRadios) if (r.checked) aiDepth = parseInt(r.value, 10);
    readCoachSettings();
    aiConfig = { schoolId: chosenSchool, player: chosenAiPlayer, depth: aiDepth };
    beginGame();
  });

  resetBtn.addEventListener('click', () => {
    stopCoachAnimation();
    if (isNetworked) {
      game = new KonrehEngine();
      selectedPiece = null; validMoves = []; pendingChoice = null; localSeq = 0;
      coachHint = null; coachHintKey = null;
      logDiv.innerHTML = '';
      log(`<i>New game started — you are Player ${localPlayer}.</i>`);
      if (netConfig.onLocalNewGame) netConfig.onLocalNewGame();
      render();
      return;
    }
    boardContainer.style.display = 'none';
    setupScreen.style.display = 'flex';
    schoolPanel.style.display = 'none';
  });

  // ---- Networked mode initialisation ----
  if (isNetworked) {
    setupScreen.style.display = 'none';
    boardContainer.style.display = 'flex';
    if (netConfig.initialState) {
      loadGameStateInto(game, netConfig.initialState);
      localSeq = netConfig.initialSeq || 0;
      log(`<i>Connected — synced to the current game. You are Player ${localPlayer}.</i>`);
    } else {
      log(`<i>Connected — new game started. You are Player ${localPlayer}.</i>`);
    }
    render();

    return {
      applyRemoteMove(pieceId, move) {
        const piece = game.pieces.find(p => p.id === pieceId);
        if (!piece || !piece.isAlive) return false;
        executeMove(move, piece, { isRemote: true });
        return true;
      },
      applyRemoteReforge(optionKey) {
        if (!game.pendingReforge) return false;
        const opt = game.pendingReforge.options.find(o => o.key === optionKey);
        if (!opt) return false;
        const player = game.pendingReforge.player;
        game.resolveReforge(optionKey);
        log(`<span class="p${player}">P${player}</span> Reforge → <b>${opt.label}</b>`);
        localSeq++;
        render();
        return true;
      },
      applyRemoteNewGame() {
        game = new KonrehEngine();
        selectedPiece = null; validMoves = []; pendingChoice = null; localSeq = 0;
        coachHint = null; coachHintKey = null;
        logDiv.innerHTML = '';
        log(`<i>Opponent started a new game. You are Player ${localPlayer}.</i>`);
        render();
      },
      applyRemoteChat(text, fromPlayer) {
        const p = fromPlayer || (localPlayer === 1 ? 2 : 1);
        talkLine(`<span class="p${p}">Player ${p}</span>: ${escapeHtml(String(text || ''))}`);
      },
      getState() { return serializeGameState(game); },
      loadState(state, seq) {
        loadGameStateInto(game, state);
        localSeq = typeof seq === 'number' ? seq : localSeq;
        selectedPiece = null; validMoves = []; pendingChoice = null;
        render();
      },
      getSeq() { return localSeq; },
      destroy() { stopCoachAnimation(); closeKonrehModal(); },
    };
  }
}

// ============================================================
//  RULES TEXT (for sidebar)
// ============================================================

function getRulesText() {
  return `
    <p><b>Goal:</b> Capture the enemy Blue. Losing yours doesn't end the game — see <b>Reforge</b> below.</p>
    <p><b>Setup:</b> each side starts with 1 Blue, 2 Oranges, 6 Reds, and 1 Green in a tight 4-rank pyramid at its Home Apex. Almost everything starts boxed in, so the first move or two usually comes from an outer Red.</p>
    <p><b>Turn order:</b> Player 1 moves once. Player 2 then gets <b>two</b> moves (two different pieces) on their very first turn only. After that, players alternate one move per turn.</p>
    <p><b>How pieces move — the core rhythm:</b> every piece has two lanes pointing <i>away</i> from its own Home Apex (Onward) and two lanes pointing <i>back</i> toward it (Homeward). The two directions behave differently:</p>
    <ul>
      <li><b>Onward = exact distance.</b> You must travel the piece's full Onward distance, in one straight line, along one of its two Onward lanes — you can't stop early. If something blocks that exact square (or the path to it), that lane simply has no legal move this turn.</li>
      <li><b>Homeward = up to that distance.</b> You may stop anywhere from 1 square up to the piece's Homeward distance, like a normal slide — stopping short is fine.</li>
      <li><b>Distances by piece</b> (Onward / Homeward): Red 2 / 1 &nbsp;•&nbsp; Orange 3 / 2 &nbsp;•&nbsp; Green 4 / 3 &nbsp;•&nbsp; Blue 5 / 4.</li>
    </ul>
    <p><b>Zone of Control (ZoC):</b> every piece "controls" the 4 squares directly next to it. A Homeward slide that crosses into an enemy-controlled square must stop there — it's still a legal landing, you just can't continue past it. No piece, friend or foe, can ever be moved through (jumped over), except for Blue's Hop special below.</p>
    <p><b>Capturing:</b> Red, Orange, and Green capture the normal way — land on a square an enemy occupies, on either an Onward or Homeward move. <b>Blue is different: its slide alone never captures.</b> Blue can only remove enemy pieces using one of its two Specials, below.</p>
    <p><b>Blue's turn:</b> Blue may slide (Onward 5 exact, or Homeward up to 4), then optionally use <b>one</b> Special — each of the two is usable only once per Blue "life" (i.e., until it's captured and later Reforged):</p>
    <ul>
      <li><b>Displacement:</b> step onto an adjacent enemy square, capturing it.</li>
      <li><b>Hop:</b> jump over an adjacent enemy into the empty square just beyond it, capturing the piece jumped.</li>
      <li>A Special isn't available if Blue's slide that turn ended by entering enemy ZoC. Using <i>both</i> Specials across the same life Roots Blue (it can't move) until your next turn — this is called Crown Stagger.</li>
    </ul>
    <p><b>Seeding new Greens:</b> if Blue ends its move on a Sanctum (one of the two side-corner squares) and the opposite Sanctum is empty, a new Green spawns there (there's a cap of 6 Greens total) and Blue becomes Rooted for a turn. This can't happen on the very first turn Blue ever leaves Home.</p>
    <p><b>The Cross:</b> the central 2×2 block of squares. Blue may spend up to 3 <i>consecutive</i> turns sitting there; leaving resets that counter for its next visit. Once Blue leaves the Cross, it's barred from re-entering for the next 2 full turns — so don't drift in without a way back out.</p>
    <p><b>Reforge — losing your Blue isn't fatal:</b> once your Blue is captured, you have <b>5 of your own turns</b> to plant any piece on the enemy's Home Apex and bring it back. You choose where it returns: Home (free, no cost), a Sanctum (free, but blocks future Seeding there), or the enemy's Apex itself (costs one Green). If the 5 turns run out with no piece planted, the game is over.</p>
    <p><b>Playing against the computer:</b> pick a School — Ykrul, Vilikari, Thepyrgosi, Aeler, Lethai, or Vhasian — and the computer plays that side in that School's style. The rules never change; only how the AI weighs risk, tempo, material, and the Cross changes from School to School.</p>
    <p style="color:var(--muted); font-size:11px;">To move: click a piece, then click a highlighted destination square. If a square has more than one legal move onto it, it shows a number — click it to pick which one.</p>
  `;
}

// ============================================================
//  ROUTER INTEGRATION – default export
// ============================================================

let currentModal = null;          // DOM element of the modal
let currentModalAPI = null;       // API object returned by openKonrehModal

function closeModal() {
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
    currentModalAPI = null;
  }
  // Also ensure any leftover modal is gone
  const existing = document.getElementById('konreh-modal');
  if (existing) existing.remove();
}

export default {
  /**
   * Called by the router when the user navigates to #kon-reh.
   * Opens the modal (or re‑opens if closed).
   */
  render(container) {
    // Ignore container – the game is a full‑screen overlay.
    // But we do need to clean up any previous modal.
    closeModal();

    // Open the modal (no network config = local play)
    const api = openKonrehModal(null);
    currentModalAPI = api;

    // The modal is created asynchronously; grab its element after a tick.
    setTimeout(() => {
      const el = document.getElementById('konreh-modal');
      if (el) currentModal = el;
    }, 50);
  },

  /**
   * Called when the route becomes active – ensure the modal is open.
   */
  onActivate() {
    if (!currentModal || !document.getElementById('konreh-modal')) {
      this.render();
    }
  },

  /**
   * Called when the route is deactivated – close the modal.
   */
  onDeactivate() {
    closeModal();
  },

  /**
   * Refresh – just re‑render.
   */
  refresh() {
    this.render();
  }
};
