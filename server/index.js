import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
import { createRoom,player,start,act,view,depart } from './game.js';
const app=express(),http=createServer(app),io=new Server(http);const rooms=new Map(),timers=new Map();
app.use(express.static('dist'));app.get('/health',(_,res)=>res.json({ok:true}));
function broadcast(r){for(const p of r.players)if(!p.bot)io.to(p.id).emit('state',view(r,p.id));clearTimeout(timers.get(r.code));if(r.turn==='bot')timers.set(r.code,setTimeout(()=>{try{const bot=r.players.find(p=>p.bot);act(r,'bot',r.currentBet-bot.bet>5_000_000&&Math.random()<.3?'fold':'call');broadcast(r);}catch{}},1100));}
function leave(socket) {
 const r=rooms.get(socket.data.code);if(!r)return;
 depart(r,socket.id);socket.leave(r.code);socket.data.code=null;
 if(!r.players.some(p=>!p.bot&&!p.disconnected)){clearTimeout(timers.get(r.code));rooms.delete(r.code);}
 else broadcast(r);
}
io.on('connection',socket=>{
 socket.on('join',(data={},reply=()=>{})=>{try{const name=String(data.name||'').trim().slice(0,16);let code=String(data.code||'').trim().toUpperCase();if(code&&!/^[A-Z0-9]{6}$/.test(code))throw Error('방 코드는 영문/숫자 6자리입니다.');let r=rooms.get(code);if(code&&!r)throw Error('해당 방을 찾을 수 없습니다.');if(r&&!['waiting','showdown'].includes(r.phase))throw Error('진행 중인 핸드가 끝난 뒤 참여하세요.');if(r&&r.players.filter(p=>!p.bot&&!p.disconnected).length>=5)throw Error('방이 가득 찼습니다. 최대 5명입니다.');if(socket.data.code===code)throw Error('이미 참여 중인 방입니다.');leave(socket);if(!r){do{code=randomInt(0,36**6).toString(36).toUpperCase().padStart(6,'0');}while(rooms.has(code));r=createRoom(code);rooms.set(code,r);}r.players=r.players.filter(p=>!p.bot);r.players.push(player(socket.id,name));socket.data.code=code;socket.join(code);reply({ok:true});broadcast(r);}catch(e){reply({error:e.message});}});
 socket.on('start',(_,reply=()=>{})=>{try{const r=rooms.get(socket.data.code);if(!r)throw Error('먼저 방에 참여하세요.');start(r);broadcast(r);reply({ok:true});}catch(e){reply({error:e.message});}});
 socket.on('action',(data={},reply=()=>{})=>{try{const r=rooms.get(socket.data.code);if(!r)throw Error('방에 참여하세요.');act(r,socket.id,data.type,data.amount);broadcast(r);reply({ok:true});}catch(e){reply({error:e.message});}});
 socket.on('leave',()=>leave(socket));socket.on('disconnect',()=>leave(socket));
});
http.listen(3001,'0.0.0.0',()=>console.log('Poker socket server: http://0.0.0.0:3001'));
