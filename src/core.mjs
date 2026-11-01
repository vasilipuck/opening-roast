import {Chess} from './chess.mjs';
import openings from './openings.json' with {type:'json'};

export const VERSION='sf19-lite-nodes12000-score1';
export const NODES=12000;
export const chance=cp=>1/(1+10**(-Math.max(-4000,Math.min(4000,cp))/400));
export const ratingExpectation=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?1/(1+10**((b-a)/400)):null;
const title=s=>s.charAt(0).toUpperCase()+s.slice(1);
const draws=new Set(['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient']);
const losses=new Set(['checkmated','resigned','timeout','abandoned','lose','bughousepartnerlose']);
export function resultOf(s){return s==='win'?'Win':draws.has(s)?'Draw':losses.has(s)?'Loss':'Unknown';}
export function chooseModes(games,manual=null){
 const counts={};for(const g of games)counts[g.mode]=(counts[g.mode]||0)+1;
 return manual??Object.keys(counts).filter(m=>counts[m]/games.length>=.1);
}
let trie;
export function openingTrie(){
 if(trie)return trie;trie={next:{}};
 for(const opening of openings){
  const chess=new Chess();try{chess.loadPgn(opening.pgn);}catch{continue;}
  let node=trie;for(const move of chess.history({verbose:true})){
   const u=move.from+move.to+(move.promotion||'');node=node.next[u]??=( {next:{}} );
  }node.opening={name:opening.name,eco:opening.eco};
 }return trie;
}
export function parseGame(raw,user){
 if(raw.rules!=='chess'||!raw.pgn)return null;
 const white=raw.white?.username?.toLowerCase()===user.toLowerCase();
 if(!white&&raw.black?.username?.toLowerCase()!==user.toLowerCase())return null;
 const me=white?raw.white:raw.black,other=white?raw.black:raw.white;
 const chess=new Chess();chess.loadPgn(raw.pgn);const history=chess.history({verbose:true});
 if(!history.length)return null;
 const headers=chess.getHeaders();const first=history[0].before;
 const moves=history.map(m=>m.from+m.to+(m.promotion||'')),fens=[first,...history.map(m=>m.after)];
 const positions=fens.map(fen=>new Chess(fen).board().flat().map(p=>p?(p.color==='w'?p.type.toUpperCase():p.type):''));
 let node=openingTrie(),opening={name:'Unclassified opening',eco:headers.ECO||'—'},bookPlies=0;
 for(let i=0;i<moves.length;i++){node=node?.next[moves[i]];if(!node)break;bookPlies=i+1;if(node.opening)opening=node.opening;}
 const id=raw.uuid||raw.url?.split('/').pop();if(!id)throw Error('Game has no public identifier');
 return {id:String(id),fixture:String(id),name:opening.name,opening:opening.name,eco:opening.eco,
  openingKey:opening.eco+' '+opening.name,moves,notation:history.map(m=>m.san),positions,fens,full:true,
  bookPlies,mode:title(raw.time_class||'unknown'),color:white?'White':'Black',result:resultOf(me.result),
  date:new Date(raw.end_time*1000).toISOString().slice(0,10),endTime:raw.end_time,
  opponent:other.username,rating:me.rating,opponentRating:other.rating,expected:ratingExpectation(me.rating,other.rating),
  url:raw.url,pgn:raw.pgn,accuracy:null,analysis:null};
}
export async function getJSON(url,{signal,fetcher=fetch}={}){
 for(let attempt=0;attempt<4;attempt++){
  const response=await fetcher(url,{signal});
  if(response.status===429||response.status>=500){if(attempt===3)throw Error('Chess.com is busy. Please retry shortly.');const delay=Math.min(10000,Number(response.headers.get('retry-after'))*1000||500*2**attempt);await new Promise((resolve,reject)=>{const timer=setTimeout(done,delay);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));}signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});continue;}
  if(response.status===404)throw Error('Chess.com username or archive was not found.');
  if(!response.ok)throw Error('Chess.com request failed ('+response.status+').');
  return response.json();
 }
}
export async function importPlayer(user,count=100,options={}){
 if(!/^[a-z0-9_-]{2,50}$/i.test(user))throw Error('Enter a valid Chess.com username.');
 count=Math.max(1,Math.min(300,Math.round(count)||100));
 const base='https://api.chess.com/pub/player/'+encodeURIComponent(user.toLowerCase());
 const profile=await getJSON(base,options),ratings=await getJSON(base+'/stats',options),index=await getJSON(base+'/games/archives',options);
 const games=[],seen=new Set(),warnings=[];let skipped=0;
 for(const archive of [...index.archives].reverse()){
  if(!/^https:\/\/api\.chess\.com\/pub\/player\/[a-z0-9_-]+\/games\/\d{4}\/\d{2}$/i.test(archive))throw Error('Unexpected archive URL.');
  const month=await getJSON(archive,options);
  const eligible=(month.games||[]).filter(g=>g.rules==='chess'&&g.end_time).sort((a,b)=>b.end_time-a.end_time);
  for(const raw of eligible){const key=raw.uuid||raw.url;if(seen.has(key))continue;seen.add(key);try{const game=parseGame(raw,user);if(game)games.push(game);else skipped++;}catch{skipped++;}if(games.length>=count)break;}
  options.onProgress?.({stage:'import',games:games.length,requested:count,user});
  if(games.length>=count)break;
 }
 games.sort((a,b)=>b.endTime-a.endTime);
 if(skipped)warnings.push(skipped+' games had missing or unreadable PGN and were skipped.');
 if(games.length<count)warnings.push('Only '+games.length+' readable standard games were available.');
 if(!games.length)throw Error('No completed standard chess games with readable PGN were found.');
 return {user,profile,ratings,games:games.slice(0,count),warnings,fetchedAt:new Date().toISOString()};
}
export function summarize(games){
 const known=games.filter(g=>g.result!=='Unknown'),wins=known.filter(g=>g.result==='Win').length,draws=known.filter(g=>g.result==='Draw').length;
 const scores=games.map(g=>g.accuracy).filter(Number.isFinite);
 const adjusted=known.filter(g=>g.expected!==null);
 return {n:games.length,wins,draws,losses:known.length-wins-draws,unknown:games.length-known.length,
  rate:known.length?wins/known.length*100:0,accuracy:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,
  analyzed:scores.length,adjustedN:adjusted.length,adjusted:adjusted.length?adjusted.reduce((s,g)=>s+(g.result==='Win'?1:g.result==='Draw'?.5:0)-g.expected,0)/adjusted.length:null};
}
export function moveGrade(loss,best,book){
 if(loss>=.18)return 'Blunder';if(loss>=.08)return 'Mistake';if(loss>=.04)return 'Inaccuracy';
 if(book)return 'Book';if(best)return 'Best';if(loss<.005)return 'Excellent';if(loss<.015)return 'Good';return 'Okay';
}
export function attachAnalysis(game,positions){
 if(positions.length!==game.fens.length||positions.some(p=>!Number.isFinite(p.cp)))throw Error('Incomplete engine analysis.');
 const moves=game.moves.map((uci,i)=>{
  const sign=game.fens[i].split(' ')[1]==='w'?1:-1;
  const before=chance(sign*positions[i].cp),after=chance(sign*positions[i+1].cp),loss=Math.max(0,before-after);
  return {ply:i+1,loss,before,after,label:moveGrade(loss,uci===positions[i].best,i<game.bookPlies),
   best:positions[i].best,pv:positions[i].pv||[],phase:i<20?'Opening':material(game.fens[i])<=13?'Endgame':'Middlegame'};
 });
 const own=moves.filter((m,i)=>game.fens[i].split(' ')[1]===(game.color==='White'?'w':'b'));
 const accuracy=own.length?own.reduce((s,m)=>s+100*Math.exp(-6*m.loss),0)/own.length:0;
 game.analysis={version:VERSION,positions,moves};game.accuracy=accuracy;return game;
}
function material(fen){return [...fen.split(' ')[0].toLowerCase()].reduce((s,p)=>s+({p:1,n:3,b:3,r:5,q:9}[p]||0),0);}
export function sanLine(fen,pv){const c=new Chess(fen),line=[];for(const u of pv.slice(0,8)){try{const m=c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});if(!m)break;line.push(m.san);}catch{break;}}return line.join(' ');}
export function findings(games,ownGames=[]){
 const phases={},critical=[],repeats=new Map();
 for(const g of games){if(!g.analysis)continue;
  for(const m of g.analysis.moves){const i=m.ply-1;if(g.fens[i].split(' ')[1]!== (g.color==='White'?'w':'b'))continue;
   const s=phases[m.phase]??={n:0,loss:0,errors:0};s.n++;s.loss+=m.loss;if(m.loss>=.08)s.errors++;
   if(m.loss>=.08)critical.push({game:g,move:m});
   const key=g.fens[i].split(' ').slice(0,4).join(' ');let r=repeats.get(key);if(!r){r={game:g,move:m,count:0,totalLoss:0};repeats.set(key,r);}r.count++;r.totalLoss+=m.loss;
  }
 }
 critical.sort((a,b)=>b.move.loss-a.move.loss);
 const recurring=[...repeats.values()].filter(r=>r.count>=2&&r.totalLoss/r.count>=.04).sort((a,b)=>b.totalLoss/b.count-a.totalLoss/a.count);
 const ownOpenings=new Set(ownGames.map(g=>g.openingKey));
 const overlap=games.filter(g=>ownOpenings.has(g.openingKey));
 return {phases,critical:critical.slice(0,12),recurring:recurring.slice(0,3),overlap:overlap.length,
  avgBook:games.length?games.reduce((s,g)=>s+g.bookPlies,0)/games.length:0,
  lostWins:games.reduce((n,g)=>n+(g.analysis?.moves.filter((m,i)=>g.fens[i].split(' ')[1]===(g.color==='White'?'w':'b')&&m.before>=.75&&m.after<.55).length||0),0)};
}
