import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,compare,createRoom,player,start,act,settle,view,INITIAL,depart,winningHand} from '../server/game.js';
const c=(rank,suit='♠')=>({rank,suit});
test('hand ranking: wheel, full house, two triples, flush and kicker',()=>{
 assert.deepEqual(evaluate([14,2,3,4,5].map(n=>c(n))),[8,5]);
 assert.equal(evaluate([c(14),c(14,'♥'),c(14,'♦'),c(13),c(13,'♥'),c(13,'♦'),c(2)])[0],6);
 assert.equal(evaluate([c(2),c(4),c(7),c(9),c(11),c(14,'♥'),c(14,'♦')])[0],5);
 assert.ok(compare([1,14,13,10,8],[1,14,12,11,9])>0);
});
test('solo game adds bot, hides cards and conserves chips through showdown',()=>{
 for(let n=0;n<50;n++){const r=createRoom('TEST01');r.players=[player('human','You')];start(r);assert.equal(r.players.length,2);assert.equal(new Set(r.players.flatMap(p=>p.cards.map(c=>c.rank+c.suit))).size,4);assert.deepEqual(view(r,'human').players[1].cards,[null,null]);let turns=0;while(r.phase!=='showdown'&&turns++<20)act(r,r.turn,'call');assert.equal(r.phase,'showdown');assert.equal(r.players.reduce((s,p)=>s+p.balance,0),INITIAL*2);assert.equal(r.board.length,5);}
});
test('turn and raise validation do not change balances',()=>{const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B')];start(r);assert.throws(()=>act(r,r.players.find(p=>p.id!==r.turn).id,'call'));assert.throws(()=>act(r,r.turn,'raise',1));assert.equal(r.pot,1500000);act(r,r.turn,'fold');assert.equal(r.phase,'showdown');assert.equal(r.players.reduce((s,p)=>s+p.balance,0),2*INITIAL);});
test('all-in side pots pay only eligible players',()=>{const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B'),player('c','C')];r.board=[c(2,'♥'),c(5,'♦'),c(7,'♣'),c(9,'♠'),c(11,'♥')];r.players.forEach((p,i)=>{p.total=[10,20,20][i];p.balance=0;p.cards=[c([14,13,12][i],'♦'),c([14,13,12][i],'♣')];});r.pot=50;settle(r);assert.deepEqual(r.players.map(p=>p.balance),[30,20,0]);});

test('winning hand identifies exactly the strongest five cards',()=>{
 const cards=[c(14),c(13),c(12),c(11),c(10),c(2,'♥'),c(3,'♦')];
 const winner=winningHand(cards);assert.equal(winner.handName,'스트레이트 플러시');assert.deepEqual(winner.cards,cards.slice(0,5));
});
test('explicit all-in runs out the board, reports winner and preserves funds',()=>{
 const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B')];start(r);
 act(r,r.turn,'allin');assert.equal(r.event.type,'allin');assert.ok(r.event.amount>0);
 act(r,r.turn,'allin');assert.equal(r.phase,'showdown');assert.equal(r.board.length,5);
 assert.ok(r.winners.length);assert.ok(r.winners.every(w=>w.cards.length===5&&w.handName&&w.name));
 assert.equal(r.players.reduce((sum,p)=>sum+p.balance,0),2*INITIAL);
});
test('busted player spectates while other players start the next hand',()=>{
 const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B'),player('c','C')];r.players[0].balance=0;start(r);
 assert.equal(r.players[0].cards.length,0);assert.equal(r.players[0].folded,true);assert.ok(!r.pending.includes('a'));
 while(r.phase!=='showdown')act(r,r.turn,'call');start(r);assert.equal(r.players[0].cards.length,0);
});
test('fold and departure keep the remaining players in the current hand',()=>{
 for(const exiting of ['fold','depart']){
 const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B'),player('c','C')];start(r);
 const id=r.turn;if(exiting==='fold')act(r,id,'fold');else depart(r,id);
 assert.equal(r.phase,'preflop');assert.ok(r.turn!==id);assert.equal(r.hand,1);
 while(r.phase!=='showdown')act(r,r.turn,'call');
 assert.equal(r.players.reduce((sum,p)=>sum+p.balance,0),3*INITIAL);assert.ok(!r.winners.some(w=>w.id===id));
 if(exiting==='depart'){start(r);assert.ok(!r.players.some(p=>p.id===id));}
 }
});
test('short all-in requires calls without reopening a previous players raise',()=>{
 const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B'),player('c','C')];r.players[1].balance=3500000;start(r);
 act(r,'a','raise',3000000);act(r,'b','allin');assert.equal(r.currentBet,3500000);assert.equal(r.minRaise,2000000);
 act(r,'c','call');assert.equal(r.turn,'a');assert.equal(view(r,'a').players[0].canRaise,false);
 const pot=r.pot;assert.throws(()=>act(r,'a','raise',5500000));assert.equal(r.pot,pot);act(r,'a','call');
 assert.equal(r.phase,'flop');while(r.phase!=='showdown')act(r,r.turn,'call');
 assert.equal(r.players.reduce((sum,p)=>sum+p.balance,0),203500000);
});
test('empty names receive random names and avatars; explicit names stay intact',()=>{
 const p=player('a','  ');assert.match(p.name,/\d{2}$/);assert.ok(p.avatar>=0&&p.avatar<8);assert.equal(player('b','친구').name,'친구');
});
test('shared board splits a tied pot and highlights the same five cards',()=>{
 const r=createRoom('TEST01');r.players=[player('a','A'),player('b','B')];r.board=[10,11,12,13,14].map(n=>c(n));
 r.players.forEach((p,i)=>{p.cards=[c(2+i,'♥'),c(4+i,'♦')];p.balance-=1000000;p.total=1000000;});r.pot=2000000;settle(r);
 assert.equal(r.winners.length,2);assert.ok(r.winners.every(w=>w.amount===1000000&&w.handName==='스트레이트 플러시'));
 assert.equal(r.players.reduce((sum,p)=>sum+p.balance,0),2*INITIAL);
});
