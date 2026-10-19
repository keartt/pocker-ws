import { randomInt } from 'node:crypto';
export const INITIAL=100_000_000, SB=500_000, BB=1_000_000;
export const names=['하이 카드','원 페어','투 페어','트리플','스트레이트','플러시','풀 하우스','포 카드','스트레이트 플러시'];
export function evaluate(cards){
 let best=[-1];
 for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
 const hand=[cards[a],cards[b],cards[c],cards[d],cards[e]], values=hand.map(c=>c.rank).sort((a,b)=>b-a), counts=new Map();values.forEach(v=>counts.set(v,(counts.get(v)||0)+1));
 const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]), flush=hand.every(c=>c.suit===hand[0].suit), unique=[...new Set(values)];if(unique[0]===14)unique.push(1);
 let straight=0;for(let i=0;i<=unique.length-5;i++)if(unique[i]-unique[i+4]===4)straight=unique[i];
 let score=flush&&straight?[8,straight]:groups[0][1]===4?[7,groups[0][0],groups[1][0]]:groups[0][1]===3&&groups[1][1]===2?[6,groups[0][0],groups[1][0]]:flush?[5,...values]:straight?[4,straight]:groups[0][1]===3?[3,...groups.map(g=>g[0])]:groups[0][1]===2&&groups[1][1]===2?[2,...groups.map(g=>g[0])]:groups[0][1]===2?[1,...groups.map(g=>g[0])]:[0,...values];
 if(compare(score,best)>0)best=score;
 }return best[0]<0?[0,...cards.map(c=>c.rank).sort((a,b)=>b-a)]:best;
}
export function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return diff;}return 0;}
export function winningHand(cards) {
 let best = null;
 for (let a=0;a<cards.length-4;a++) for (let b=a+1;b<cards.length-3;b++)
 for (let c=b+1;c<cards.length-2;c++) for (let d=c+1;d<cards.length-1;d++)
 for (let e=d+1;e<cards.length;e++) {
  const hand=[cards[a],cards[b],cards[c],cards[d],cards[e]], score=evaluate(hand);
  if (!best || compare(score,best.score)>0) best={cards:hand,score};
 }
 return {cards:best?.cards || cards, handName:names[(best?.score || evaluate(cards))[0]]};
}
const randomNames=['달빛 여우','럭키 고양이','우주 곰','포커 펭귄','별빛 토끼','리버 부엉이','느긋한 판다','블러프 호랑이'];
export function player(id,name,bot=false) {
 const avatar=randomInt(8);
 return {id,name:name?.trim() || `${randomNames[avatar]} ${randomInt(10,100)}`,avatar,bot,balance:INITIAL,cards:[],bet:0,total:0,folded:false,disconnected:false};
}
export function createRoom(code) {
 return {code,players:[],phase:'waiting',board:[],pot:0,currentBet:0,minRaise:BB,turn:null,dealer:-1,pending:[],acted:[],winners:[],event:null,eventSeq:0,log:[],message:'테이블이 준비되었습니다. 첫 핸드를 시작하세요.',hand:0};
}
function note(r,s){r.message=s;r.log.unshift(s);r.log=r.log.slice(0,12);}
function pay(r,p,n){n=Math.min(n,p.balance);p.balance-=n;p.bet+=n;p.total+=n;r.pot+=n;return n;}
const eligible=r=>r.players.filter(p=>!p.folded&&!p.disconnected&&p.balance>0);
function next(r,after){for(let i=1;i<=r.players.length;i++){const p=r.players[(after+i)%r.players.length];if(r.pending.includes(p.id))return p.id;}return null;}
function result(p,amount,reason){return {id:p.id,name:p.name,avatar:p.avatar,amount,reason,...winningHand(p.cards)};}
export function start(r) {
 if(!['waiting','showdown'].includes(r.phase))throw Error('이미 게임이 진행 중입니다.');
 r.players=r.players.filter(p=>!p.disconnected&&(!p.bot||p.balance>0));
 let active=r.players.filter(p=>p.balance>0);
 if(!active.some(p=>!p.bot))throw Error('참여 가능한 잔액이 없습니다. 새 테이블에서 시작하세요.');
 if(active.length===1&&r.players.length<5){const bot=player('bot','',true);bot.name+=' · CPU';r.players.push(bot);active.push(bot);}
 if(active.length<2)throw Error('잔액이 있는 플레이어가 2명 이상 필요합니다.');
 r.deck=[];for(const suit of ['♠','♥','♦','♣'])for(let rank=2;rank<=14;rank++)r.deck.push({rank,suit});
 for(let i=r.deck.length-1;i>0;i--){const j=randomInt(i+1);[r.deck[i],r.deck[j]]=[r.deck[j],r.deck[i]];}
 r.board=[];r.pot=0;r.currentBet=BB;r.minRaise=BB;r.phase='preflop';r.hand++;r.winners=[];r.event=null;r.acted=[];
 r.pending=active.map(p=>p.id);r.dealer=r.players.findIndex(p=>p.id===next(r,r.dealer));
 r.players.forEach(p=>{p.cards=p.balance>0?[r.deck.pop(),r.deck.pop()]:[];p.bet=0;p.total=0;p.folded=p.balance===0;});
 const small=active.length===2?r.dealer:r.players.findIndex(p=>p.id===next(r,r.dealer));
 const big=r.players.findIndex(p=>p.id===next(r,small));
 pay(r,r.players[small],SB);pay(r,r.players[big],BB);
 r.pending=eligible(r).map(p=>p.id);r.turn=next(r,big);note(r,'새 핸드 시작 · 내 카드와 콜 금액을 확인하세요.');advance(r);
}
export function act(r,id,type,amount) {
 const p=r.players.find(p=>p.id===id);
 if(!p||r.turn!==id||!['preflop','flop','turn','river'].includes(r.phase))throw Error('내 차례에만 액션할 수 있습니다.');
 let paid=0;
 if(type==='fold')p.folded=true;
 else if(type==='call')paid=pay(r,p,Math.max(0,r.currentBet-p.bet));
 else if(type==='raise'||type==='allin') {
  const target=type==='allin'?p.bet+p.balance:Number(amount), increase=target-r.currentBet;
  if(!Number.isSafeInteger(target)||target<=p.bet||target>p.bet+p.balance)throw Error('잔액 내의 올바른 베팅 금액을 입력하세요.');
  if(type==='raise'&&(increase<r.minRaise||target%SB!==0))throw Error(`최소 레이즈 증액은 ${r.minRaise/10000}만 원이며, 50만 단위로 입력하세요.`);
  if(increase>0&&(r.acted.includes(id)||!eligible(r).some(q=>q.id!==id)))throw Error('지금은 추가 레이즈할 수 없습니다. 체크/콜 또는 폴드를 선택하세요.');
  paid=pay(r,p,target-p.bet);
  if(increase>0) {
   if(increase>=r.minRaise){r.minRaise=increase;r.acted=[];r.pending=eligible(r).filter(q=>q.id!==id).map(q=>q.id);}
   else r.pending=[...new Set([...r.pending,...eligible(r).filter(q=>q.id!==id&&q.bet<target).map(q=>q.id)])];
   r.currentBet=target;
  }
 } else throw Error('잘못된 액션입니다.');
 r.acted.push(id);r.pending=r.pending.filter(x=>x!==id);
 const label=type==='fold'?'폴드':type==='allin'?'올인':type==='raise'?'레이즈':paid?'콜':'체크';
 note(r,`${p.name} · ${label}${paid?` ${paid/10000}만 원`:''}`);
 r.event={seq:++r.eventSeq,playerId:id,type,amount:paid};r.turn=next(r,r.players.indexOf(p));advance(r);
}
export function depart(r,id) {
 const p=r.players.find(p=>p.id===id);if(!p)return;
 if(['waiting','showdown'].includes(r.phase)){r.players=r.players.filter(p=>p.id!==id);return;}
 p.disconnected=true;p.folded=true;r.pending=r.pending.filter(x=>x!==id);
 if(r.turn===id)r.turn=next(r,r.players.indexOf(p));
 note(r,`${p.name} 퇴장 · 남은 플레이어로 계속 진행합니다.`);advance(r);
}
function advance(r) {
 const alive=r.players.filter(p=>!p.folded);
 if(alive.length<=1) {
  if(alive.length){const p=alive[0],amount=r.pot;p.balance+=amount;r.winners=[{...result(p,amount,'상대 전원 폴드'),...winningHand([...p.cards,...r.board])}];note(r,`${p.name} 승리 · 상대 전원 폴드`);}
  r.pot=0;r.phase='showdown';r.turn=null;return;
 }
 r.pending=r.pending.filter(id=>eligible(r).some(p=>p.id===id));
 const active=eligible(r);
 if(active.length===1&&active[0].bet>=Math.max(...alive.filter(p=>p.id!==active[0].id).map(p=>p.bet)))r.pending=[];
 if(r.pending.length){r.turn=r.turn&&r.pending.includes(r.turn)?r.turn:next(r,r.dealer);return;}
 if(r.phase==='river'){settle(r);return;}
 r.phase={preflop:'flop',flop:'turn',turn:'river'}[r.phase];
 for(let i=0;i<(r.phase==='flop'?3:1);i++)r.board.push(r.deck.pop());
 r.players.forEach(p=>p.bet=0);r.currentBet=0;r.minRaise=BB;r.acted=[];
 r.pending=active.length>1?active.map(p=>p.id):[];r.turn=next(r,r.dealer);
 note(r,`${r.phase.toUpperCase()} · 공용 카드가 공개되었습니다.`);if(!r.pending.length)advance(r);
}
export function settle(r) {
 const levels=[...new Set(r.players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b);let previous=0;const payouts=new Map();
 for(const level of levels) {
  const contributors=r.players.filter(p=>p.total>=level),amount=(level-previous)*contributors.length,increment=level-previous;previous=level;
  if(contributors.length===1){contributors[0].balance+=amount;continue;}
  const alive=contributors.filter(p=>!p.folded);
  if(!alive.length){contributors.forEach(p=>p.balance+=increment);continue;}
  let best=alive[0];alive.forEach(p=>{if(compare(evaluate([...p.cards,...r.board]),evaluate([...best.cards,...r.board]))>0)best=p;});
  const ties=alive.filter(p=>compare(evaluate([...p.cards,...r.board]),evaluate([...best.cards,...r.board]))===0);
  ties.forEach((p,i)=>{const won=Math.floor(amount/ties.length)+(i<amount%ties.length?1:0);p.balance+=won;payouts.set(p.id,(payouts.get(p.id)||0)+won);});
 }
 r.winners=[...payouts].map(([id,amount])=>{const p=r.players.find(p=>p.id===id);return {...result(p,amount,'쇼다운'),...winningHand([...p.cards,...r.board])};});
 note(r,`${r.winners.map(w=>`${w.name} (${w.handName})`).join(', ')} 승리 · 쇼다운 정산 완료`);
 r.pot=0;r.phase='showdown';r.turn=null;
}
export function view(r,id) {
 return {code:r.code,phase:r.phase,board:r.board,pot:r.pot,currentBet:r.currentBet,minRaise:r.minRaise,turn:r.turn,dealer:r.dealer,message:r.message,log:r.log,hand:r.hand,winners:r.winners,event:r.event,
 players:r.players.map(p=>({...p,canRaise:!r.acted.includes(p.id)&&eligible(r).some(q=>q.id!==p.id),cards:p.id===id||r.phase==='showdown'&&(!p.folded||r.winners.some(w=>w.id===p.id))?p.cards:p.cards.map(()=>null)}))};
}
