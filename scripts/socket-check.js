import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
const clients=[];
const connect=async()=>{const s=io('http://localhost:3001',{transports:['websocket'],forceNew:true});clients.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
const emit=(s,event,data)=>new Promise((resolve,reject)=>{s.timeout(3000).emit(event,data,(err,result)=>err?reject(err):resolve(result));});
const state=s=>new Promise(resolve=>s.once('state',resolve));
try{const a=await connect();let update=state(a);assert.equal((await emit(a,'join',{name:'A'})).ok,true);let room=await update;const code=room.code;
for(let i=0;i<4;i++){const s=await connect();assert.equal((await emit(s,'join',{name:`P${i}`,code})).ok,true);}
const sixth=await connect();assert.match((await emit(sixth,'join',{code})).error,/가득/);update=state(a);assert.equal((await emit(a,'start',{})).ok,true);room=await update;assert.equal(room.players.length,5);assert.equal(room.players.filter(p=>p.id!==a.id).every(p=>p.cards.every(c=>c===null)),true);
let turns=0;while(room.phase!=='showdown'&&turns++<30){const s=clients.find(s=>s.id===room.turn);update=state(a);assert.equal((await emit(s,'action',{type:'call'})).ok,true);room=await update;}
assert.equal(room.phase,'showdown');assert.equal(room.players.reduce((n,p)=>n+p.balance,0),500000000);
update=state(a);assert.equal((await emit(a,'start',{})).ok,true);room=await update;
const folded=room.turn;update=state(a);await emit(clients.find(s=>s.id===folded),'action',{type:'fold'});room=await update;
assert.equal(room.phase,'preflop');assert.ok(room.turn!==folded);
const departed=room.turn,observer=clients.find(s=>s.connected&&s.id!==departed&&room.players.some(p=>p.id===s.id));
update=state(observer);clients.find(s=>s.id===departed).disconnect();room=await update;
assert.equal(room.phase,'preflop');assert.ok(room.turn!==departed);assert.ok(room.players.find(p=>p.id===departed).disconnected);
turns=0;while(room.phase!=='showdown'&&turns++<30){update=state(observer);await emit(clients.find(s=>s.id===room.turn),'action',{type:'call'});room=await update;}
assert.equal(room.phase,'showdown');assert.equal(room.players.reduce((n,p)=>n+p.balance,0),500000000);assert.ok(!room.winners.some(w=>[folded,departed].includes(w.id)));
const solo=await connect();update=state(solo);await emit(solo,'join',{});const soloRoom=await update;assert.match(soloRoom.players[0].name,/\d{2}$/);assert.ok(soloRoom.players[0].avatar>=0);
console.log('Socket integration passed: capacity, private cards, winner details, fold/departure continuation, random identity.');
}finally{clients.forEach(s=>s.disconnect());}
