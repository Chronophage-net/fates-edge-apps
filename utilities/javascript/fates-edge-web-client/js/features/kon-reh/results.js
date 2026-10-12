export function konrehResult(game, localPlayer = null) {
    if (game.winner == null) return null;
    const result = game.winner === 'draw' ? 'draw' : localPlayer == null ? 'neutral' : game.winner === localPlayer ? 'win' : 'lose';
    return {
        result, game: 'Kon’reh',
        title: result === 'draw' ? 'A standstill' : result === 'win' ? 'Victory' : result === 'lose' ? 'Defeat' : `Player ${game.winner} wins`,
        subtitle: game.winReason || 'The contest is decided.',
        details: 'Review the final position and move log, or begin a fresh contest.',
        stats: [1,2].map(player=>({label:`Player ${player} pieces remaining`, value:game.pieces.filter(p=>p.player===player && p.isAlive).length})),
    };
}
