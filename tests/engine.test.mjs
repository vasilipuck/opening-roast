import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import {readFile,writeFile} from 'node:fs/promises';import {UCIEngine,analyzeGames} from '../src/engine.mjs';import {parseGame,summarize,chooseModes,VERSION} from '../src/core.mjs';import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
function nodeEngine(){const child=spawn(process.execPath,['public/engine/stockfish-19-lite-single.js'],{stdio:['pipe','pipe','pipe']});const lines=createInterface({input:child.stdout});return new UCIEngine({send:s=>child.stdin.write(s+'\n'),listen:f=>lines.on('line',f),close:()=>{child.kill();lines.close();}},45000);}
test('real Stockfish: winning mate, terminal mate and completed public games', {timeout:180000},async()=>{
 const engine=nodeEngine();try{await engine.ready();const mate=await engine.evaluate('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');assert.ok(mate.cp>10000);const terminal=await engine.evaluate('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');assert.ok(terminal.cp>10000);assert.equal(terminal.best,null);
 const results={version:VERSION,players:{}};
 for(const user of ['FrancisBiz','BlebJeb']){
  let source;try{source=JSON.parse(await readFile('tests/'+user+'.json','utf8'));}catch{continue;}
  const games=source.games.filter(g=>g.rules==='chess').sort((a,b)=>b.end_time-a.end_time).map(g=>parseGame(g,user)).filter(Boolean).slice(0,100);
  assert.ok(games.length>0);const modes=chooseModes(games);const selected=games.filter(g=>modes.includes(g.mode));
  const cacheMap=new Map(),cache={get:async k=>cacheMap.get(k),put:async(k,v)=>{cacheMap.set(k,v);return true;}};
  const sample=selected.slice(0,1);await analyzeGames(sample,engine,{cache});
  assert.equal(sample[0].analysis.positions.length,sample[0].fens.length);assert.ok(Number.isFinite(sample[0].accuracy));
  const before=JSON.stringify(sample[0].analysis);let cached=false;await analyzeGames(sample,engine,{cache,onProgress:p=>cached||=p.cached});assert.equal(cached,true);assert.equal(JSON.stringify(sample[0].analysis),before);
  results.players[user]={imported:games.length,modes,selected:selected.length,summary:summarize(selected),fullGameAnalyzed:sample[0].id,positions:sample[0].fens.length,accuracy:sample[0].accuracy,opening:sample[0].opening};
 }
 await writeFile('tests/live-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{engine.close();}
});
