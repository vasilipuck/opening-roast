import {NODES,VERSION,attachAnalysis} from './core.mjs';
export class UCIEngine {
 constructor(transport,timeout=45000){this.transport=transport;this.timeout=timeout;this.waiter=null;this.info=null;this.busy=false;transport.listen(line=>this.line(line));}
 line(line){
  if(typeof line!=='string')return;
  if(line.startsWith('info ')&&/\bscore (cp|mate) /.test(line)&&!/(upperbound|lowerbound)/.test(line)){
   const score=line.match(/score (cp|mate) (-?\d+)/),pv=line.match(/\bpv (.+)/)?.[1].trim().split(/\s+/)||[];
   this.info={cp:score[1]==='cp'?Number(score[2]):Number(score[2])<=0?-100000:100000,mate:score[1]==='mate'?Number(score[2]):null,pv,best:pv[0]||null,depth:Number(line.match(/depth (\d+)/)?.[1]||0)};
  }
  if(this.waiter?.match(line)){const {resolve,timer}=this.waiter;clearTimeout(timer);this.waiter=null;resolve(line);}
 }
 send(command,match){
  if(this.waiter)throw Error('An engine command is already pending.');
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiter=null;this.transport.close();reject(Error('Stockfish timed out. Retry analysis.'));},this.timeout);this.waiter={resolve,reject,match,timer};this.transport.send(command);});
 }
 async ready(){await this.send('uci',s=>s==='uciok');this.transport.send('setoption name Hash value 16');this.transport.send('setoption name Threads value 1');await this.send('isready',s=>s==='readyok');}
 async evaluate(fen){
  if(this.busy)throw Error('Stockfish is already analyzing.');this.busy=true;
  try{this.info=null;this.transport.send('position fen '+fen);const last=await this.send('go nodes '+NODES,s=>s.startsWith('bestmove '));
   const best=last.split(' ')[1];const info=this.info;
   if(!info)throw Error('Stockfish returned no evaluation.');const sign=fen.split(' ')[1]==='w'?1:-1;
   return {...info,cp:info.cp*sign,mate:info.mate===null?null:info.mate*sign,best:best==='(none)'||best==='0000'?null:best};
  }finally{this.busy=false;}
 }
 close(){if(this.waiter){clearTimeout(this.waiter.timer);this.waiter.reject(new DOMException('Analysis cancelled','AbortError'));this.waiter=null;}this.transport.close();}
}
export async function browserEngine(base){
 const url=new URL('stockfish-19-lite-single.js',base),wasm=new URL('stockfish-19-lite-single.wasm',base);
 // A Blob worker can be created inside the Spline overlay; the engine accepts its WASM URL in the fragment.
 const response=await fetch(url);if(!response.ok)throw Error('Could not download Stockfish.');
 const blob=URL.createObjectURL(new Blob([await response.text()],{type:'text/javascript'}));
 const worker=new Worker(blob+'#'+encodeURIComponent(wasm.href));
 let engine;const transport={send:s=>worker.postMessage(s),listen:f=>{worker.onmessage=e=>f(e.data);worker.onerror=()=>{if(engine?.waiter){clearTimeout(engine.waiter.timer);engine.waiter.reject(Error('Stockfish failed to load. Check your connection and retry.'));engine.waiter=null;}};},close:()=>{worker.terminate();URL.revokeObjectURL(blob);}};
 engine=new UCIEngine(transport);try{await engine.ready();return engine;}catch(error){transport.close();throw error;}
}
export async function cacheKey(game){const bytes=new TextEncoder().encode(game.pgn);const hash=await crypto.subtle.digest('SHA-256',bytes);return VERSION+':'+[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function analysisCache(){
 let dbPromise;
 const db=()=>dbPromise??=new Promise((resolve,reject)=>{const request=indexedDB.open('opening-roast',1);request.onupgradeneeded=()=>request.result.createObjectStore('analyses');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 return {async get(key){try{const d=await db();return await new Promise((resolve,reject)=>{const r=d.transaction('analyses').objectStore('analyses').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}catch{return undefined;}},async put(key,value){try{const d=await db();await new Promise((resolve,reject)=>{const t=d.transaction('analyses','readwrite');t.objectStore('analyses').put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});return true;}catch{return false;}}};
}
export async function analyzeGames(games,engine,{signal,onProgress=()=>{},cache=analysisCache()}={}){
 const total=games.reduce((n,g)=>n+g.fens.length,0);let done=0,completed=0,cacheUnavailable=false;
 for(const g of games){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const key=await cacheKey(g),saved=await cache.get(key);
  if(saved?.version===VERSION&&saved.positions?.length===g.fens.length){attachAnalysis(g,saved.positions);done+=g.fens.length;completed++;onProgress({done,total,completed,games:games.length,cached:true,cacheUnavailable});continue;}
  engine.transport.send('ucinewgame');const positions=[];
  for(const fen of g.fens){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');positions.push(await engine.evaluate(fen));done++;onProgress({done,total,completed,games:games.length,cacheUnavailable});}
  attachAnalysis(g,positions);completed++;if(!await cache.put(key,g.analysis))cacheUnavailable=true;
  onProgress({done,total,completed,games:games.length,cacheUnavailable});
 }return games;
}
