// features/whiteboard/kon-reh.js

// ============================================================
//  KON'REH ENGINE (Corrected)
// ============================================================

class KonrehEngine {
  constructor() { this.reset(); }

  reset() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.pieces = [];
    this.turn = 1;
    this.winner = null;
    this.firstMoveDone = false;          // true after P2's first double-move
    this.doubleMoveUsed = new Set();     // track pieces moved during P2's double-turn
    this.reforgeCountdown = { 1: 0, 2: 0 };
    this.blueAlive = { 1: true, 2: true };
    this.greenCount = 0;
    this.moveHistory = [];
    this.setupDefaultBoard();
    this.startTurn(); // initialise current player's turn state
  }

  setupDefaultBoard() {
    this.addPiece(1, 'blue', 0, 0);
    this.addPiece(2, 'blue', 7, 7);
    this.addPiece(1, 'red', 1, 0);
    this.addPiece(1, 'orange', 0, 1);
    this.addPiece(2, 'red', 6, 7);
    this.addPiece(2, 'orange', 7, 6);
  }

  addPiece(player, type, x, y) {
    const p = {
      id: `p${this.pieces.length + 1}`,
      player, type, x, y, isAlive: true,
      crossStays: 0,
      crossExclusion: 0,
      specialsUsed: [],        // e.g. ['S:D', 'S:H']
      rooted: false,
      mobilizationDelay: true,
      seedBanSanctum: null,    // e.g. '0,7' or '7,0'
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

  isInEnemyZoc(x, y, player) {
    const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
    for (const [dx, dy] of dirs) {
      const p = this.getPieceAt(x + dx, y + dy);
      if (p && p.player !== player && p.isAlive) return true;
    }
    return false;
  }

  isCross(x, y) { return (x === 3 || x === 4) && (y === 3 || y === 4); }
  isSanctum(x, y) { return (x === 0 && y === 7) || (x === 7 && y === 0); }
  isHomeApex(x, y, player) {
    return (player === 1 && x === 0 && y === 0) ||
           (player === 2 && x === 7 && y === 7);
  }

  // ---------- Turn management ----------
  startTurn() {
    const blue = this.getBlue(this.turn);
    if (blue) {
      if (blue.rooted) blue.rooted = false;
      if (blue.crossExclusion > 0) blue.crossExclusion--;
    }
    // Reforge countdown only on the captured player's turns
    if (!this.blueAlive[this.turn] && this.reforgeCountdown[this.turn] > 0) {
      this.reforgeCountdown[this.turn]--;
      if (this.reforgeCountdown[this.turn] === 0) {
        this.winner = this.turn === 1 ? 2 : 1;
      }
    }
  }

  endTurn() {
    if (this.turn === 2 && !this.firstMoveDone) {
      this.firstMoveDone = true;
      return; // P2 gets another move
    }
    this.turn = this.turn === 1 ? 2 : 1;
    this.firstMoveDone = false;
    this.doubleMoveUsed.clear();
    this.startTurn();
  }

  // ---------- Move generation ----------
  getValidMoves(pieceId) {
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.isAlive || this.winner) return [];
    if (piece.rooted) return [];

    // P2 double-move: cannot reuse the same piece
    if (this.turn === 2 && !this.firstMoveDone && this.doubleMoveUsed.has(piece.id)) {
      return [];
    }

    let moves = [];
    const dirs = [[1,0], [-1,0], [0,1], [0,-1]];

    if (piece.type === 'blue') {
      const slides = this.getBlueSlides(piece);
      const specials = this.getBlueSpecials(piece, slides);
      moves = [...slides, ...specials];
    } else {
      for (const [dx, dy] of dirs) {
        for (let s = 1; s < 8; s++) {
          const nx = piece.x + dx * s;
          const ny = piece.y + dy * s;
          if (nx < 0 || nx > 7 || ny < 0 || ny > 7) break;
          const target = this.getPieceAt(nx, ny);
          const inZoc = this.isInEnemyZoc(nx, ny, piece.player);
          if (target) {
            if (target.player !== piece.player) {
              moves.push({ x: nx, y: ny, capture: true, targetId: target.id });
            }
            break;
          }
          if (inZoc) {
            moves.push({ x: nx, y: ny, capture: false });
            break;
          }
          moves.push({ x: nx, y: ny, capture: false });
        }
      }
    }

    // Filter Cross legality for Blue moves
    if (piece.type === 'blue') {
      moves = moves.filter(m => this.isValidBlueCrossMove(piece, m));
    }
    return moves;
  }

  getBlueSlides(piece) {
    const slides = [{ x: piece.x, y: piece.y, slideEnteredZoc: false, special: null }];
    const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
    for (const [dx, dy] of dirs) {
      let enteredZoc = false;
      for (let s = 1; s < 8; s++) {
        const nx = piece.x + dx * s;
        const ny = piece.y + dy * s;
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) break;
        if (this.getPieceAt(nx, ny)) break;
        const inZoc = this.isInEnemyZoc(nx, ny, piece.player);
        if (inZoc) enteredZoc = true;
        slides.push({ x: nx, y: ny, slideEnteredZoc: enteredZoc, special: null });
        if (inZoc) break;
      }
    }
    return slides;
  }

  getBlueSpecials(piece, slides) {
    const moves = [];
    const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
    const validSlides = slides.filter(s => !s.slideEnteredZoc);

    for (const slide of validSlides) {
      for (const [dx, dy] of dirs) {
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
          const mx = slide.x + dx;
          const my = slide.y + dy;
          const lx = slide.x + dx * 2;
          const ly = slide.y + dy * 2;
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
    if (this.winner) return false;
    const piece = this.pieces.find(p => p.id === pieceId);
    if (!piece || !piece.isAlive || piece.rooted) return false;

    if (this.turn === 2 && !this.firstMoveDone) {
      this.doubleMoveUsed.add(piece.id);
    }

    const prevX = piece.x, prevY = piece.y;
    const wasInCross = this.isCross(prevX, prevY);

    // 1. Slide
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
        if (!piece.specialsUsed.includes(move.special)) {
          piece.specialsUsed.push(move.special);
        }
        if (piece.specialsUsed.length >= 2) {
          piece.rooted = true;
        }
      }

      const homeX = piece.player === 1 ? 0 : 7;
      const homeY = piece.player === 1 ? 0 : 7;
      if (piece.mobilizationDelay && (piece.x !== homeX || piece.y !== homeY)) {
        piece.mobilizationDelay = false;
      }

      const nowInCross = this.isCross(piece.x, piece.y);
      if (nowInCross) {
        piece.crossStays++;
      }
      if (wasInCross && !nowInCross) {
        piece.crossExclusion = 2;
      }

      // Seed
      if (this.isSanctum(piece.x, piece.y)) {
        const oppX = piece.x === 0 ? 7 : 0;
        const oppY = piece.y === 7 ? 0 : 7;
        const oppEmpty = !this.getPieceAt(oppX, oppY);
        const canSeed =
          !piece.mobilizationDelay &&
          this.greenCount < 6 &&
          piece.seedBanSanctum !== `${piece.x},${piece.y}` &&
          oppEmpty;
        if (canSeed) {
          this.addPiece(piece.player, 'green', oppX, oppY);
          piece.rooted = true;
        }
      }
    }

    // 5. Reforge planting
    if (!this.blueAlive[piece.player]) {
      const enemyHomeX = piece.player === 1 ? 7 : 0;
      const enemyHomeY = piece.player === 1 ? 7 : 0;
      if (piece.x === enemyHomeX && piece.y === enemyHomeY) {
        // Plant successful
        piece.isAlive = false;
        this.board[piece.y][piece.x] = null;
        if (piece.type === 'green') this.greenCount--;

        const blue = this.getBlue(piece.player);
        if (blue) {
          blue.isAlive = true;
          blue.x = piece.player === 1 ? 0 : 7;
          blue.y = piece.player === 1 ? 0 : 7;
          blue.specialsUsed = [];
          blue.crossStays = 0;
          blue.crossExclusion = 0;
          blue.rooted = false;
          blue.mobilizationDelay = true;
          // For simplicity we always return to Home Apex (free)
          // Future: add UI to choose Opposing/Sanctum/Home
          this.board[blue.y][blue.x] = blue.id;
          this.blueAlive[piece.player] = true;
          this.reforgeCountdown[piece.player] = 0;
        }
      }
    }

    this.endTurn();
    return true;
  }

  // ---------- Status helpers ----------
  getStatus() {
    let text = `Player ${this.turn}'s Turn`;
    if (this.winner) {
      text = `🏆 Player ${this.winner} Wins!`;
    } else {
      if (this.turn === 2 && !this.firstMoveDone) text += ' (Move 1 of 2)';
      if (!this.blueAlive[1]) text += ` | P1 Reforge: ${this.reforgeCountdown[1]} turns`;
      if (!this.blueAlive[2]) text += ` | P2 Reforge: ${this.reforgeCountdown[2]} turns`;
      const blue = this.getBlue(this.turn);
      if (blue) {
        text += ` | Cross: ${blue.crossStays}/3 stays, Excl: ${blue.crossExclusion}`;
        text += ` | Green: ${this.greenCount}/6`;
        text += ` | Specials: ${blue.specialsUsed.join(',') || 'none'}`;
      }
    }
    return text;
  }
}

// ============================================================
//  MODAL UI
// ============================================================

export function openKonrehModal() {
  const existing = document.getElementById('konreh-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'konreh-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center;
    z-index: 10000; font-family: sans-serif;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #1a1a24; border: 1px solid #d4af37; border-radius: 8px;
    padding: 20px; display: flex; gap: 20px; max-width: 900px; width: 90%; color: #eee;
    box-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
  `;

  // Game Area
  const gameArea = document.createElement('div');
  gameArea.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center;';
  
  const title = document.createElement('h2');
  title.textContent = "🌀 Kon'reh: Apex, Sanctum, and Reforge";
  title.style.cssText = 'color: #d4af37; margin-bottom: 10px;';
  gameArea.appendChild(title);

  const canvas = document.createElement('canvas');
  canvas.width = 500; canvas.height = 500;
  canvas.style.cssText = 'border: 1px solid #333; background: #111; cursor: pointer; border-radius: 4px;';
  gameArea.appendChild(canvas);

  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = 'margin-top: 10px; font-size: 14px; color: #ccc; text-align: center; min-height: 40px;';
  gameArea.appendChild(statusDiv);

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.style.cssText = 'width: 280px; display: flex; flex-direction: column; gap: 10px;';
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = 'background: #333; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; align-self: flex-end;';
  closeBtn.onclick = () => modal.remove();
  sidebar.appendChild(closeBtn);

  const rulesDiv = document.createElement('div');
  rulesDiv.style.cssText = 'font-size: 12px; line-height: 1.5; max-height: 400px; overflow-y: auto; background: #222; padding: 10px; border-radius: 4px; border: 1px solid #333;';
  rulesDiv.innerHTML = getRulesText();
  sidebar.appendChild(rulesDiv);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '🔄 New Game';
  resetBtn.style.cssText = 'background: #d4af37; color: #000; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-top: auto;';
  sidebar.appendChild(resetBtn);

  content.appendChild(gameArea);
  content.appendChild(sidebar);
  modal.appendChild(content);
  document.body.appendChild(modal);

  // --- Game Engine & UI ---
  const ctx = canvas.getContext('2d');
  const scale = 28;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  
  let game = new KonrehEngine();
  let selectedPiece = null;
  let validMoves = [];

  function gridToScreen(x, y) {
    return {
      sx: cx + (x - y) * scale,
      sy: cy + (x + y - 7) * scale
    };
  }

  function screenToGrid(sx, sy) {
    const dx = (sx - cx) / scale;
    const dy = (sy - cy) / scale;
    const x = Math.round((dx + dy + 7) / 2);
    const y = Math.round((dy - dx + 7) / 2);
    return { x, y };
  }

  function drawDiamond(x, y, fillColor, borderColor) {
    const { sx, sy } = gridToScreen(x, y);
    ctx.beginPath();
    ctx.moveTo(sx, sy - scale);
    ctx.lineTo(sx + scale, sy);
    ctx.lineTo(sx, sy + scale);
    ctx.lineTo(sx - scale, sy);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = borderColor || '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHighlight(x, y, color) {
    const { sx, sy } = gridToScreen(x, y);
    ctx.beginPath();
    ctx.moveTo(sx, sy - scale);
    ctx.lineTo(sx + scale, sy);
    ctx.lineTo(sx, sy + scale);
    ctx.lineTo(sx - scale, sy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPiece(p) {
    const { sx, sy } = gridToScreen(p.x, p.y);
    ctx.beginPath();
    ctx.arc(sx, sy, scale * 0.6, 0, Math.PI * 2);
    
    let color = '#d4af37';
    if (p.type === 'blue') color = p.player === 1 ? '#4a90d9' : '#d94a4a';
    if (p.type === 'red') color = '#d94a4a';
    if (p.type === 'orange') color = '#d9a54a';
    if (p.type === 'green') color = '#4ad97a';
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type.charAt(0).toUpperCase(), sx, sy);
    
    if (p.type === 'blue' && p.rooted) {
      ctx.beginPath();
      ctx.arc(sx, sy, scale * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = '#888';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawZones() {
    for (const p of game.pieces) {
      if (!p.isAlive) continue;
      const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
      for (const [dx, dy] of dirs) {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
          if (!game.getPieceAt(nx, ny)) {
            const { sx, sy } = gridToScreen(nx, ny);
            ctx.beginPath();
            ctx.arc(sx, sy, scale * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = p.player === 1 ? 'rgba(74, 144, 217, 0.15)' : 'rgba(217, 74, 74, 0.15)';
            ctx.fill();
          }
        }
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        let color = ((x + y) % 2 === 0) ? '#2a2a35' : '#22222b';
        if ((x === 0 && y === 0) || (x === 7 && y === 7)) color = '#3d3d1f';
        if ((x === 0 && y === 7) || (x === 7 && y === 0)) color = '#1f3d3d';
        if (game.isCross(x, y)) color = '#2e2e1a';
        drawDiamond(x, y, color);
      }
    }
    
    if (selectedPiece) {
      for (const move of validMoves) {
        drawHighlight(move.x, move.y, move.capture ? 'rgba(217, 74, 74, 0.4)' : 'rgba(74, 217, 100, 0.2)');
      }
    }
    
    drawZones();
    
    for (const p of game.pieces) {
      if (p.isAlive) drawPiece(p);
    }
    
    statusDiv.textContent = game.getStatus();
  }

  canvas.addEventListener('click', (e) => {
    if (game.winner) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    
    if (x < 0 || x > 7 || y < 0 || y > 7) {
      selectedPiece = null;
      validMoves = [];
      render();
      return;
    }
    
    if (selectedPiece) {
      const move = validMoves.find(m => m.x === x && m.y === y);
      if (move) {
        game.makeMove(selectedPiece.id, move);
        selectedPiece = null;
        validMoves = [];
        render();
        return;
      } else {
        // Clicked on invalid square – clear selection
        selectedPiece = null;
        validMoves = [];
        render();
        return;
      }
    } else {
      const piece = game.getPieceAt(x, y);
      if (piece && piece.player === game.turn && !piece.rooted) {
        selectedPiece = piece;
        validMoves = game.getValidMoves(piece.id);
        render();
        return;
      }
    }
  });

  resetBtn.addEventListener('click', () => {
    game = new KonrehEngine();
    selectedPiece = null;
    validMoves = [];
    render();
  });

  render();
}

// ============================================================
//  RULES TEXT (for sidebar)
// ============================================================

function getRulesText() {
  return `
    <h3 style="color:#d4af37;">Kon'reh Quick Rules</h3>
    <p><b>Goal:</b> Capture enemy Blue. If your Blue is captured, you have 5 turns to move a piece to the enemy Home Apex to Reforge it.</p>
    <p><b>Board:</b> 8x8 diamond. Corners are Home Apexes (top/bottom) and Sanctums (left/right).</p>
    <p><b>Movement:</b> Pieces slide along lanes (N,S,E,W on the diamond). Slides stop at enemy Zone of Control (ZoC).</p>
    <p><b>Captures:</b> Red/Orange/Green capture by stepping onto an adjacent enemy.</p>
    <p><b>Blue (Arbiter):</b> Cannot capture normally. On its turn, it slides, then may use one Special.</p>
    <ul>
      <li><b>S:D (Displacement):</b> Step 1 onto adjacent enemy to capture.</li>
      <li><b>S:H (Hop-capture):</b> Jump over adjacent enemy to empty square.</li>
      <li>If Blue entered enemy ZoC during its slide, it cannot Special.</li>
      <li>Using a 2nd distinct Special Roots Blue until your next turn.</li>
    </ul>
    <p><b>Seed (Green):</b> If Blue ends on a Sanctum, and opposite Sanctum is empty, you may place a Green there (Roots Blue).</p>
    <p><b>The Cross:</b> The 2x2 center. Blue may end at most 3 turns here per life. After leaving, it cannot re-enter for 2 turns.</p>
    <p><b>Turn Order:</b> P1 moves. P2 gets 2 moves on their first turn. Then alternate.</p>
  `;
}