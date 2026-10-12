import { describe, it, assert, assertEqual } from '../runner.js';
import { createLocalController } from '../../js/features/kon-reh/toll-and-veil.js';
import { TollVeilEngine, legalPlaysForSeat, aiChoosePlay } from '../../js/features/kon-reh/toll-and-veil-engine.js';
import { readFileSync } from 'node:fs';

describe('Games room and private card table', () => {
    it('hands off every human seat without exposing the next hand during updates', () => {
        const c = createLocalController({ numSeats: 3 });
        try {
            assert(c.getView().needsHandoff);
            assertEqual(c.getView().myHand.length, 0);
            assertEqual(c.bid(0).ok, false);
            for (let i = 0; i < 3; i++) {
                const seat = c.localSeat;
                c.revealHand();
                assertEqual(c.getView().myHand.length, 10);
                assert(c.canBid());
                const views = [];
                const off = c.onChange(() => views.push(c.getView()));
                assert(c.bid(0).ok);
                off();
                assert(views.every(v => v.myHand.length === 0));
                assert(c.getView().needsHandoff);
                if (i < 2) assert(c.localSeat !== seat);
            }
            assertEqual(c.getView().phase, 'playing');
            for (let i = 0; i < 30; i++) {
                c.revealHand();
                const choice = aiChoosePlay(c._engine, c.localSeat);
                assert(c.play(choice.id, choice).ok);
                assertEqual(c.getView().myHand.length, 0);
            }
            assertEqual(c.getView().phase, 'bidding');
        } finally { c.destroy(); }
    });
    it('restores the revealed hand after an invalid bid and hides it on restart', () => {
        const c = createLocalController();
        try {
            c.revealHand();
            assertEqual(c.bid(99).ok, false);
            assertEqual(c.getView().myHand.length, 10);
            c.requestNewGame();
            assert(c.getView().needsHandoff);
        } finally { c.destroy(); }
    });
    it('solo mode retains its seat and never requests a human handoff', () => {
        const c = createLocalController({ numSeats: 3, aiSeats: [1, 2] });
        try {
            assertEqual(c.localSeat, 0);
            assertEqual(c.getView().myHand.length, 10);
            assertEqual(c.getView().needsHandoff, false);
        } finally { c.destroy(); }
    });
    it('offers early trump only while Leap is unspent, matching engine validation', () => {
        for (const spent of [false, true]) {
            const e = new TollVeilEngine(3);
            e.startHand(); e.phase = 'playing'; e.currentSeat = 0;
            e.trump = '♠'; e.trumpBroken = false; e.leadSuit = null;
            e.hands[0] = [{rank:'2',suit:'♠',value:2},{rank:'3',suit:'♣',value:3}];
            e.markerUsed[0].leap = spent;
            const trump = legalPlaysForSeat(e, 0).find(o => o.isTrump);
            assertEqual(!!trump, !spent);
            if (trump) { assert(trump.needsLeap); assert(e.playCard(0, '2♠', {leap:true}).ok); }
        }
    });
    it('provides keyboard cards, explicit confirmation and escaped remote table text', () => {
        const src = readFileSync(new URL('../../js/features/kon-reh/toll-and-veil.js', import.meta.url), 'utf8');
        assert(src.includes("interactive ? 'button' : 'span'"));
        assert(src.includes('id="tv-confirm"'));
        assert(src.includes('id="tv-setup-close"'));
        assert(src.includes('escapeHtml(l.msg)'));
        assert(src.includes('escapeHtml(controller.seatNames[seat]'));
    });
});
