import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM,VirtualConsole} from 'jsdom';import {readFile} from 'node:fs/promises';import {parseGame,attachAnalysis,findings} from '../src/core.mjs';
const source={rules:'chess',uuid:'one',pgn:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *',white:{username:'FrancisBiz',result:'win',rating:1500},black:{username:'Example',result:'resigned',rating:1600},time_class:'rapid',end_time:1700000000,url:'https://www.chess.com/game/live/1'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('report flow uses real records, complete board, engine alternatives and filters',{timeout:10000},async()=>{
 const errors=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));virtualConsole.on('error',(...e)=>errors.push(e.join(' ')));
 const dom=new JSDOM(await readFile('dist/index.html','utf8'),{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false,json:async()=>({})});w.HTMLElement.prototype.scrollIntoView=()=>{};}});
 try{const w=dom.window;await delay(50);assert.ok(w.openingRoast);assert.equal(w.document.getElementById('order').hidden,false);assert.equal(w.document.getElementById('username').value,'FrancisBiz');
 const g=parseGame(source,'FrancisBiz');attachAnalysis(g,g.fens.map((f,i)=>({cp:i%2?20:0,mate:null,best:g.moves[i]||null,pv:g.moves.slice(i,i+3)})));
 w.OpeningRoastLive.run=async({onProgress})=>{onProgress({stage:'analysis',done:7,total:7,completed:1,games:1});return{games:[g],modes:['Rapid'],imported:{games:[g],warnings:[],ratings:{chess_rapid:{last:{rating:1500}}},fetchedAt:new Date().toISOString()},ownImport:{user:'BlebJeb',games:[g]},findings:findings([g],[g])};};
 w.document.getElementById('order').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await delay(1900);assert.equal(w.openingRoast.getState().phase,'served');w.openingRoast.openReport();await delay(1500);
 assert.equal(w.openingRoast.getState().phase,'report');assert.equal(w.document.getElementById('metricCount').textContent,'1');assert.equal(w.document.querySelectorAll('#gameList .game-item').length,1);
 assert.equal(w.document.querySelectorAll('#chessboard .square').length,64);assert.equal(w.document.querySelectorAll('#chessboard .chess-piece').length,32);
 w.openingRoastDiagnostic.setPly(6);assert.match(w.document.getElementById('moveHeading').textContent,/Bc5/);w.openingRoastDiagnostic.setPly(0);w.document.getElementById('comparison').click();assert.match(w.document.getElementById('reviewTitle').textContent,/Engine alternative/);w.document.getElementById('returnMainline').click();
 const color=w.document.getElementById('reportColor');color.value='Black';color.dispatchEvent(new w.Event('change'));assert.equal(w.document.getElementById('metricCount').textContent,'0');assert.match(w.document.getElementById('liveCritical').textContent,/No mistakes/);w.document.getElementById('clearReportFilters').click();assert.equal(w.document.getElementById('metricCount').textContent,'1');
 w.document.getElementById('reportHome').click();assert.equal(w.openingRoast.getState().phase,'input');assert.equal(errors.length,0,errors.join('\n'));
 }finally{dom.window.close();}
});
