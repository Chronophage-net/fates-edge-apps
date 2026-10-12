import { describe, it, assert, assertEqual } from '../runner.js';
import { KonrehEngine } from '../../js/features/kon-reh/index.js';
import { konrehResult } from '../../js/features/kon-reh/results.js';
import { storyRiskKey, storyPromise, storyMoment, storySettlement } from '../../js/features/kon-reh/story-stakes.js';
import { TollVeilEngine, aiChooseBid, aiChoosePlay } from '../../js/features/kon-reh/toll-and-veil-engine.js';
import { createTollVeilHost } from '../../js/features/kon-reh/toll-and-veil-connected.js';

function finish(e) {
    for (let i=0; i<500 && e.phase !== 'game_over'; i++) {
        const seat=e.currentSeat;
        if (e.phase === 'bidding') assert(e.makeBid(seat,aiChooseBid(e,seat)).ok);
        else { const c=aiChoosePlay(e,seat); assert(e.playCard(seat,c.id,c).ok); }
    }
    assertEqual(e.phase,'game_over');
}
describe('Game results and story stakes',()=>{
    it('never lets an AI winner collect connected story debts',()=>{
        const sent=[];
        const host=createTollVeilHost({send:m=>sent.push(m)},{numSeats:3,localSeat:0,stakeConfig:{mode:'string',storyRisk:'favor'}});
        try {
            const e=host.getEngine();
            e.gameWinner=1; e.phase='game_over'; e._fireUpdate();
            assertEqual(sent.filter(m=>m.t==='stake-string').length,0);
        } finally { host.destroy(); }
    });
    it('maps an actual Konreh terminal position to victory, defeat and shared results',()=>{
        const e=new KonrehEngine();
        assertEqual(konrehResult(e),null);
        e.pieces.filter(p=>p.player===2).forEach(p=>{p.isAlive=false;e.board[p.y][p.x]=null;});
        e.turn=2; e.startTurn();
        assertEqual(e.winner,1);
        assertEqual(konrehResult(e,1).result,'win');
        assertEqual(konrehResult(e,2).result,'lose');
        assertEqual(konrehResult(e).result,'neutral');
        assertEqual(konrehResult(e).stats[1].value,0);
        e.winner='draw'; assertEqual(konrehResult(e,1).result,'draw');
    });
    it('retains a truthful final hand recap with independent public copies',()=>{
        const e=new TollVeilEngine(3,{winningScore:1}); e.startHand(); finish(e);
        const v=e.getPublicState();
        assertEqual(v.lastHandSummary.length,3);
        assertEqual(v.lastHandSummary.reduce((n,r)=>n+r.tricks,0),10);
        v.lastHandSummary.forEach(r=>assertEqual(r.total,e.scores[r.seat]));
        v.lastHandSummary[0].bid=999;
        assert(e.lastHandSummary[0].bid!==999);
    });
    it('uses bounded agreed promises, excludes AI parties, and leaves points-only play alone',()=>{
        assertEqual(storyRiskKey('<img>'),'favor');
        assert(storyPromise({storyRisk:'rumor'}).includes('theirs to choose'));
        const v={numSeats:3,gameWinner:1};
        assertEqual(storySettlement(v,{mode:'points'}),'');
        assert(storySettlement(v,{mode:'string'},[],[0]).includes('No player-to-player debt'));
        const debt=storySettlement(v,{mode:'string',storyRisk:'passage'},['Ada','Bea','AI'],[0,1]);
        assert(debt.includes('Ada → Bea')); assert(!debt.includes('AI →'));
        assert(debt.includes('introduction'));
    });
    it('ties scene prompts to bid progress and actual marker use',()=>{
        const v={bids:[{seat:0,bid:3}],tricksWon:[1],markerUsed:[{}]};
        assert(storyMoment(v,0).includes('2 trick(s) short'));
        v.markerUsed[0]={cut:true,leap:true};
        assert(storyMoment(v,0).includes('Rooted'));
    });
    it('settles connected story stakes once with the agreed promise, never a random demand',()=>{
        const sent=[];
        const host=createTollVeilHost({send:m=>sent.push(m)},{numSeats:3,localSeat:0,seatIds:{1:'guest1',2:'guest2'},winningScore:1,stakeConfig:{mode:'string',storyRisk:'rumor'}});
        try {
            finish(host.getEngine());
            const debts=sent.filter(m=>m.t==='stake-string');
            assertEqual(debts.length,2);
            assert(debts.every(d=>d.text===storyPromise({storyRisk:'rumor'})));
            host.getEngine()._fireUpdate();
            assertEqual(sent.filter(m=>m.t==='stake-string').length,2);
        } finally { host.destroy(); }
    });
});
