import {Chess} from './chess.mjs';
import * as core from './core.mjs';
import {browserEngine,analyzeGames} from './engine.mjs';
let controller,engine;
export function cancel(){controller?.abort();engine?.close();engine=null;}
export async function run({user,own,count=100,manual=null,onProgress=()=>{},engineBase}){
 cancel();controller=new AbortController();const signal=controller.signal;
 const imported=await core.importPlayer(user,count,{signal,onProgress});
 const modes=core.chooseModes(imported.games,manual),games=imported.games.filter(g=>modes.includes(g.mode));
 if(!games.length)throw Error('None of the imported games match the selected modes.');
 let ownImport=null,ownWarning='';
 if(own){try{ownImport=own.toLowerCase()===user.toLowerCase()?imported:await core.importPlayer(own,count,{signal,onProgress});}catch(error){if(error.name==='AbortError')throw error;ownWarning='Your games could not be loaded: '+error.message;}}
 onProgress({stage:'engine',games:games.length});
 const localEngine=await browserEngine(engineBase||'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/');
 if(signal.aborted){localEngine.close();throw new DOMException('Cancelled','AbortError');}engine=localEngine;
 try{await analyzeGames(games,localEngine,{signal,onProgress:p=>onProgress({...p,stage:'analysis'})});}
 finally{localEngine.close();if(engine===localEngine)engine=null;}
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 return {imported,ownImport,ownWarning,modes,games,findings:core.findings(games,ownImport?.games||[])};
}
export function variation(game,ply){
 const pv=game.analysis?.positions[ply]?.pv;if(!pv?.length)return null;
 const c=new Chess(game.fens[ply]),positions=[game.positions[ply]],fens=[game.fens[ply]],moves=[],notation=[];
 for(const u of pv.slice(0,12)){try{const m=c.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});if(!m)break;moves.push(u);notation.push(m.san);fens.push(c.fen());positions.push(c.board().flat().map(p=>p?(p.color==='w'?p.type.toUpperCase():p.type):''));}catch{break;}}
 return moves.length?{id:'variation',name:'Engine alternative from move '+Math.floor(ply/2+1),eco:'—',moves,notation,positions,fens,full:false,bookPlies:0}:null;
}
window.OpeningRoastLive={...core,run,cancel,variation};
