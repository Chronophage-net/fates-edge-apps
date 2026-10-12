// Narrative prompts only: no changes to scores, XP, character sheets or rules.
export const STORY_STAKES = {
    favor: { label: 'A small favor', promise: 'Each losing player owes the winner one small, safe favor, agreed by both players before it is called in.' },
    rumor: { label: 'A useful rumor', promise: 'Each losing player shares one useful in-character rumor; its content is theirs to choose and the GM confirms what is true.' },
    passage: { label: 'An introduction', promise: 'Each losing player offers the winner an introduction or a lead toward a contact, subject to the GM and fiction.' },
};
export const storyRiskKey = value => Object.hasOwn(STORY_STAKES, value) ? value : 'favor';
export const storyPromise = config => STORY_STAKES[storyRiskKey(config?.storyRisk)].promise;

export function storyMoment(view, seat) {
    if (seat == null) return 'Watch who keeps a promise and who spends both markers. Let the play inspire the next scene.';
    const bid = view.bids?.find(b => b.seat === seat)?.bid;
    const taken = view.tricksWon?.[seat] || 0;
    const markers = view.markerUsed?.[seat] || {};
    if (markers.cut && markers.leap) return 'Both markers spent: Rooted passes the lead on your first trick win after spending both. What did your character overcommit to?';
    if (bid === 0 && taken === 0) return 'A Veil bid: you have promised to take nothing. What are you trying not to reveal?';
    if (bid != null && taken < bid) return `${bid - taken} trick(s) short of your promise. What temptation would make you risk Leap or Cut?`;
    if (bid != null) return 'Your bid is covered. Do you press for more, or let a rival save face?';
    return 'Before bidding, name what this promise means to your character. The cards decide the score; the table decides the fiction.';
}

export function storySettlement(view, config, names = [], humanSeats = null) {
    if (config?.mode !== 'string' || view.gameWinner == null) return '';
    const winner = view.gameWinner;
    const label = seat => String(names[seat] || `Seat ${seat + 1}`);
    if (humanSeats && !humanSeats.includes(winner)) return 'The computer won. No player-to-player debt is created; use the result as an optional scene prompt.';
    const losers = Array.from({length:view.numSeats}, (_,i)=>i).filter(i=>i !== winner && (!humanSeats || humanSeats.includes(i)));
    if (!losers.length) return 'No other human seat owes a debt. Use the result as an optional scene prompt.';
    return `${losers.map(label).join(', ')} → ${label(winner)}\n${storyPromise(config)}\nChoose when it comes due together. No forced secrets, unsafe tasks, or automatic character-sheet changes.`;
}
