import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
let html=await readFile('src/cafe-original.html','utf8');
const replace=(old,value)=>{if(!html.includes(old))throw Error('Missing source: '+old.slice(0,80));html=html.replace(old,value);};
const between=(a,b,value)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);if(start<0||end<0)throw Error('Missing section '+a);html=html.slice(0,start)+value+'\n'+html.slice(end);};
const section=(page,body)=>{const re=new RegExp('<section class="report-page" data-page="'+page+'"[^>]*>[\\s\\S]*?</section>');if(!re.test(html))throw Error('Missing page');html=html.replace(re,body);};
replace('  const FIXTURES=[', '  const FIXTURES=['); // Anchor checked before replacing the demo dataset.
between('  const FIXTURES=[','  function initialBoard()',`  const FIXTURES=[];let liveReport=null,variationFixture=null,liveStatus='';`);
between('  FIXTURES.forEach(replayFixture);','  const GLYPHS=',`  const fixtureById=id=>FIXTURES.find(f=>f.id===id)||FIXTURES[0]||{id:'empty',name:'No game',eco:'—',moves:[],notation:[],positions:[initialBoard()],fens:['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']};`);
between('  function makeRecords(n){','  const escapeHTML=',`  function makeRecords(){return liveReport?.games||[];}`);
between('  function stats(gs){','  function groupOpenings',`  function stats(gs){return OpeningRoastLive.summarize(gs);}`);
between('  function groupOpenings(gs){','  function comparisonHTML',`  function groupOpenings(gs){const map=new Map();for(const g of gs){if(!map.has(g.openingKey))map.set(g.openingKey,[]);map.get(g.openingKey).push(g);}return [...map.values()].map(games=>({f:games[0],games,...stats(games)})).sort((a,b)=>b.n-a.n);}`);
between('  function selection() {','  function brew(e)',`  function selection(){requestedGames=Math.max(20,Math.min(300,Math.round(Number($('count').value)||100)));included=$('auto').checked?['Rapid','Blitz','Bullet','Daily']:['Rapid','Blitz','Bullet','Daily'].filter(n=>$('mode'+n).checked);selectedGames=requestedGames;}`);
replace("$('error').textContent='';progress=0;mode='demo';", "$('error').textContent='';progress=0;mode='external';liveStatus='Connecting to Chess.com…';");
replace("    write('Cup Crema',{visible:true});\n  }\n  function complete()",`    write('Cup Crema',{visible:true});
    runLive();
  }
  async function runLive(){
    try{
      const result=await OpeningRoastLive.run({user:player,own,count:requestedGames,manual:$('auto').checked?null:included,engineBase:window.__engineBase,onProgress(p){
        if(p.stage==='import'){liveStatus='Importing '+p.user+': '+p.games+' / '+p.requested+' games';progress=.02;}
        if(p.stage==='engine'){liveStatus='Loading Stockfish on this device…';progress=.04;}
        if(p.stage==='analysis'){progress=.05+.94*p.done/p.total;liveStatus=p.completed+' / '+p.games+' games · '+p.done+' / '+p.total+' positions'+(p.cacheUnavailable?' · storage unavailable':'');}
        $('selection').textContent='Keep this page open. Completed games are cached when browser storage is available.';
      }});
      liveReport=result;FIXTURES.splice(0,FIXTURES.length,...result.games);included=result.modes;selectedGames=result.games.length;progress=1;complete();
    }catch(error){if(error.name!=='AbortError')fail(error.message);}
  }
  function complete()`);
replace("$('selection').textContent=included.join(', ')+' · '+selectedGames+' qualifying demo games from '+requestedGames;", "$('selection').textContent='Importing the latest '+requestedGames+' standard chess games.';");
replace("player+' · '+selectedGames+' demo games · '+included.join(', ')","player+' · '+selectedGames+' analyzed games · '+included.join(', ')");
replace("$('personal').textContent=own?'Preparation will be tailored to '+own+' when analysis is connected.':'Add your own username to tailor future preparation.';", "$('personal').textContent='Chess.com public games · Stockfish 19 lite · local analysis';");
replace("$('reportDetail').textContent=included.join(', ')+' · '+selectedGames+' qualifying games in the demo sample';", "$('reportDetail').textContent=included.join(', ')+' · '+selectedGames+' analyzed games';");
replace("$('cancel').onclick=()=>{resetVisuals();form();};", "$('cancel').onclick=()=>{OpeningRoastLive.cancel();resetVisuals();form();};");
replace("for(const n of ['Rapid','Blitz','Bullet'])$('mode'+n).disabled", "for(const n of ['Rapid','Blitz','Bullet','Daily'])$('mode'+n).disabled");
replace("recordSample=requestedGames;records=makeRecords(recordSample).filter(g=>included.includes(g.mode));", "if(!liveReport)return;recordSample=liveReport.imported.games.length;records=liveReport.games;");
replace("FIXTURES.map(f=>'<option value=", "groupOpenings(records).map(({f})=>'<option value=");
replace("$('reportDetail').textContent=included.join(', ')+' · '+records.length+' qualifying simulated games from the latest '+recordSample;", "$('reportDetail').textContent=included.join(', ')+' · '+records.length+' analyzed of '+recordSample+' imported games · '+new Date(liveReport.imported.fetchedAt).toLocaleString();");
replace("$('prepPersonal').textContent=own?'Comparison mode: '+own+' vs. '+player+'. Recommendations below remain illustrative until both players’ games are connected.':'Add your own username through Edit / Brew again for future recommendations that fit your repertoire.';", "renderFindings();");
replace("'From '+recordSample+' recent simulated games'", "'From '+recordSample+' imported games'");
replace("' selected sample records. Start your review with the lines this player model returns to most.'", "' selected games. Review these actual positions before preparing a response.'");
replace("g.fixture===$('reviewOpening').value", "g.openingKey===fixtureById($('reviewOpening').value).openingKey");
replace("b.date.localeCompare(a.date)||Number(a.id.slice(5))-Number(b.id.slice(5))", "b.endTime-a.endTime");
between('  function currentFixture(){','  function setPly(p)',`  function currentFixture(){return variation?variationFixture:fixtureById(activeGame?.fixture);}
  function evaluation(f,p){return f.analysis?.positions[p]?.cp/100||0;}
  function quality(f,p){return p?(f.analysis?.moves[p-1]?.label||'Engine continuation'):'Starting position';}`);
between('  function renderBoard(){','  function showEvidence(',`  function renderBoard(){
    const f=currentFixture();if(!f)return;ply=Math.min(ply,f.moves.length);
    const b=f.positions[ply],last=ply?f.moves[ply-1]:null,from=last?squareIndex(last.slice(0,2)):-1,to=last?squareIndex(last.slice(2,4)):-1;
    let html='';for(let r=0;r<8;r++)for(let c=0;c<8;c++){const row=flipped?7-r:r,col=flipped?7-c:c,index=row*8+col,p=b[index];html+='<div class="square'+((row+col)%2?' dark':'')+(index===from||index===to?' last':'')+'">'+(p?pieceSVG(p):'')+(r===7?'<span class="coordinate file">'+'abcdefgh'[col]+'</span>':'')+(c===0?'<span class="coordinate rank">'+(8-row)+'</span>':'')+'</div>';}
    $('chessboard').innerHTML=html;$('chessboard').setAttribute('aria-label',f.name+', after '+ply+' half moves. '+(f.fens[ply].split(' ')[1]==='w'?'White':'Black')+' to move.');
    const ev=f.analysis?.positions[ply],cp=ev?.cp||0;
    $('evalNumber').textContent=ev?(ev.mate!==null?'M'+ev.mate:(cp>0?'+':'')+(cp/100).toFixed(2)):'—';
    $('evalWhite').style.height=(ev?50+Math.tanh(cp/400)*48:50)+'%';$('evalBar').setAttribute('aria-label',ev?'Stockfish evaluation from White perspective':'Not evaluated');
    $('reviewTitle').textContent=f.name;$('reviewMeta').textContent=activeGame?activeGame.opponent+' · '+activeGame.mode+' · '+activeGame.color+' · '+activeGame.result+' · '+activeGame.accuracy.toFixed(1)+'% app accuracy':'No matching game';
    $('movePosition').textContent=ply+' / '+f.moves.length;$('moveStart').disabled=$('movePrevious').disabled=ply===0;$('moveEnd').disabled=$('moveNext').disabled=ply===f.moves.length;$('movePlay').disabled=!activeGame;
    const q=quality(f,ply),m=f.analysis?.moves[ply-1];$('moveQuality').textContent=q;$('moveQuality').className='quality-tag '+q.toLowerCase();
    $('moveHeading').textContent=ply?Math.ceil(ply/2)+(ply%2?'. ':'... ')+f.notation[ply-1]:'The starting position';
    $('moveExplanation').textContent=m?'Expected-score loss: '+(100*m.loss).toFixed(1)+' percentage points. Best engine line before this move: '+OpeningRoastLive.sanLine(f.fens[ply-1],m.pv)+'. Labels are approximate at this search budget.':variation?'Legal continuation suggested by Stockfish from the selected position. Continuation moves have not been independently evaluated.':'Select a move to inspect its engine evaluation, label and suggested continuation.';
    let list='';for(let i=0;i<f.notation.length;i+=2){list+='<span class="move-number">'+(i/2+1)+'.</span>';for(let j=i;j<i+2;j++)list+=j<f.notation.length?'<button class="move-button'+(ply===j+1?' selected':'')+'" data-move="'+(j+1)+'">'+f.notation[j]+'</button>':'<span></span>';}$('moveList').innerHTML=list;
    const keys=(f.analysis?.moves||[]).filter(m=>m.loss>=.08).sort((a,b)=>b.loss-a.loss).slice(0,5);$('keyMoments').innerHTML=keys.length?keys.map(k=>'<button class="text-button" data-move="'+k.ply+'">'+k.label+' · '+Math.ceil(k.ply/2)+(k.ply%2?'. ':'... ')+f.notation[k.ply-1]+'</button>').join(''):'<p>No major errors found at this search budget.</p>';
    const points=(f.analysis?.positions||[]).map((v,i)=>({x:i/Math.max(1,f.moves.length)*600,y:50-Math.tanh(v.cp/400)*44}));$('evalGraph').innerHTML='<line x1="0" y1="50" x2="600" y2="50" stroke="#c4aa81" stroke-dasharray="4 4"/><polyline points="'+points.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="#87613a" stroke-width="2.5"/>'+points.map((p,i)=>'<circle data-move="'+i+'" cx="'+p.x+'" cy="'+p.y+'" r="'+(i===ply?5:8)+'" fill="'+(i===ply?'#80582f':'transparent')+'"/>').join('');
    $('replayNotice').replaceChildren();if(activeGame){const a=document.createElement('a');a.href=activeGame.url;a.textContent='Full original game on Chess.com ↗';a.target='_blank';a.rel='noopener noreferrer';$('replayNotice').append(a);} $('returnMainline').hidden=!variation;$('comparison').disabled=!ev?.pv?.length;
  }`);
replace("g.fixture===id)||records.find(g=>g.fixture===id)", "g.openingKey===fixtureById(id).openingKey)||records.find(g=>g.fixture===id)");
between("  $('comparison').onclick=()=>{","  $('returnMainline').onclick",`  $('comparison').onclick=()=>{if(!activeGame)return;variationFixture=OpeningRoastLive.variation(currentFixture(),ply);if(!variationFixture)return;comparisonSaved={game:activeGame,ply};variation=true;ply=0;playing=false;renderBoard();};`);
replace("    player=$('username').value.trim()||'CaféStrategist';$('username').value=player;own=$('own').value.trim();selection();if(!included.length)included=['Rapid','Blitz'];report();", "    if(liveReport)report();else form();");
replace("const label=progress<.12?'Finding recent games…':progress<.35?'Reviewing openings…':progress<.86?'Analyzing key positions…':'Preparing your game plan…';", "const label=liveStatus;");
replace("$('gameCount').textContent='Reviewing game '+Math.min(selectedGames,Math.floor(progress*selectedGames))+' of '+selectedGames+' · simulated';", "$('gameCount').textContent='Stockfish 19 lite · 12,000 nodes per position · keep this page open';");
replace("Interactive demo — no live games are retrieved yet.","Import public Chess.com games and analyze every position on this device. Large samples can take several minutes; keep this page open.");
replace('id="username" type="text"','id="username" value="FrancisBiz" type="text"');replace('id="own" type="text"','id="own" value="BlebJeb" type="text"');
replace('Demo distribution: 75% rapid, 20% blitz, 5% bullet.','Calculated from the actual imported sample, before filtering.');
replace(' disabled> Bullet</label>', ' disabled> Bullet</label><label><input id="modeDaily" type="checkbox" disabled> Daily</label>');
replace('Demo brew in progress','Live analysis in progress');replace('Demo analysis progress','Engine analysis progress');
replace('Freshly served · demo','Freshly served · live analysis');
replace('DEMO REPORT','LIVE REPORT');
replace('Freshly brewed · sample data','Freshly brewed · public games');
replace('<head><meta charset="utf-8">','<head><meta charset="utf-8"><title>Opening Roast — Chess Scouting</title>');
replace('<div class="demo-notice"><strong>Illustrative demo.</strong> The entered username is a label, not a live lookup. Statistics use simulated records; evaluations, accuracy, move labels, and preparation findings are illustrative. Replay excerpts use predefined moves. Public profile photos load when available.</div>', '<div class="demo-notice"><strong>Real public games · local Stockfish 19 lite.</strong> Every imported move is replayed legally. Engine scores use 12,000 nodes per position and are approximate. Accuracy is this app’s own formula, not Chess.com’s. Completed games are saved on this device when storage is available. <span id="liveWarnings"></span></div>');
html=html.replaceAll('Application scoring · simulated','Application scoring · engine based').replaceAll('Illustrative evaluations & move labels','Stockfish evaluations & move labels').replaceAll('Illustrative evaluation graph','White-positive engine evaluation graph');
replace('Opponent-strength adjustment is not simulated.','<span id="adjustedResults"></span>');
replace('Ratings below are illustrative and kept separate by mode.','Current public ratings, kept separate by mode.');
replace('<div class="rating-row"><span>Rapid <b>1,640</b></span><span>Blitz <b>1,575</b></span><span>Bullet <b>1,490</b></span></div>','<div class="rating-row" id="liveRatings"></div>');
replace('data-evidence="opera" data-ply="31">Open a sample key moment →','data-go="patterns">Open critical moments →');
replace('Frequency and results are calculated from the simulated records. Theory-familiarity notes are example findings.','Frequency and results use the selected real games. Openings are matched to the Lichess opening database.');
html=html.replace(/<div class="paper-card theory-note">[\s\S]*?<\/div><\/section>/,'<div class="paper-card theory-note"><h3>Estimated theory familiarity</h3><p id="liveTheory"></p></div></section>');
section('patterns','<section class="report-page" data-page="patterns" hidden><div class="section-intro"><h2>What the games show.</h2></div><p class="muted">Move-loss measurements describe this sample; they do not prove a lasting personal weakness. Opening: first 20 half-moves. Endgame: 13 or fewer non-king material points. Otherwise: middlegame.</p><div id="livePhases" class="pattern-grid"></div><h3>Critical decisions</h3><div id="liveCritical" class="pattern-grid"></div></section>');
section('preparation','<section class="report-page" data-page="preparation" hidden><div class="section-intro"><h2>Prepare from the evidence.</h2></div><p id="prepPersonal" class="muted"></p><div id="livePrep" class="prep-list"></div><p class="note">Suggested lines are finite-search Stockfish continuations. Repertoire overlap shows shared opening names, not a guaranteed matchup. No claims about psychology or time management are inferred.</p><button id="downloadReport" class="secondary">Download report JSON</button></section>');
replace('Book, Best, Excellent, Good, Okay, Inaccuracy, Mistake, Blunder, Great, Brilliant. This demo uses illustrative labels and evaluations, not live Stockfish analysis or Chess.com accuracy scoring.', 'Accuracy is the mean of 100 × exp(−6 × expected-score loss) for the player’s moves. Expected score = 1 / (1 + 10^(−centipawns/400)). Loss thresholds: Inaccuracy ≥4%, Mistake ≥8%, Blunder ≥18%; otherwise Book (database prefix), Best (engine first choice), Excellent &lt;0.5%, Good &lt;1.5%, Okay. Great and Brilliant are not assigned. These are app labels, not Chess.com classifications.');
replace('    renderOpenings();renderGameList();','    renderOpenings();renderGameList();if(liveReport)renderFindings();');
replace("    const match=selectedRecords().find(g=>g.openingKey===fixtureById(id).openingKey)||records.find(g=>g.fixture===id);","    const match=records.find(g=>g.id===id)||selectedRecords().find(g=>g.openingKey===fixtureById(id).openingKey);");
const findingsCode=await readFile('src/findings-ui.txt','utf8');replace('  function reviewGames(){',findingsCode+'\n  function reviewGames(){');
// Reports need real data before opening, including the hidden developer preview.
replace("    $('start').focus();","    if(window.__standalone){form();}else $('start').focus();");
replace('  requestAnimationFrame(tick);\n})().catch',"  if(window.__standalone){form();}\n  requestAnimationFrame(tick);\n})().catch");
const bundle=await build({entryPoints:['src/live.mjs'],bundle:true,format:'iife',write:false,minify:true,target:'es2022'});
const script=bundle.outputFiles[0].text.replaceAll('</script','<\\/script');
replace('<script>\n(async () => {','<script>'+script+'</script>\n<script>\n(async () => {');
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
await writeFile('dist/spline-overlay.html',html);
const bridge=`<script>if(!window.spline){window.__standalone=true;window.__engineBase=new URL('./engine/',location.href).href;window.spline={ready:Promise.resolve(),getAllObjects:async()=>[],updateObject:async()=>{},addEventListener:()=>{}};}</script><style>html{background:#ead8ba}body{background:radial-gradient(ellipse at 35% 25%,#fff4dd,#d7bb92)!important}.scene-hit,#cupHotspot{display:none!important}#order{max-height:90vh;overflow:auto}.panel{z-index:40}#report{z-index:60}#report:not([hidden])~#standaloneLanding{display:none}.panel:not(#report):not(#transition){right:8vw;top:8vh;width:min(380px,42vw);max-height:84vh}#standaloneLanding{position:fixed;left:8vw;top:20vh;width:min(460px,42vw);pointer-events:none}#standaloneLanding h1{font-size:clamp(40px,5vw,76px);letter-spacing:-2px}#standaloneLanding .crest{font-size:86px;color:#765137;line-height:1}#standaloneLanding p{max-width:360px;color:#745f4c;font-size:16px}@media(max-width:700px){#standaloneLanding{display:none}.panel:not(#report):not(#transition){inset:20px 16px auto;width:calc(100vw - 32px);max-height:calc(100dvh - 40px);padding:22px}} </style><div id="standaloneLanding"><div class="crest">♞</div><span class="eyebrow">The Opening Roast</span><h1>Brew your next advantage.</h1><p>Real games. Clear patterns. A preparation plan grounded in the positions your opponent actually plays.</p><p class="muted">Chess.com public data · local Stockfish analysis</p></div>`;
html=html.replace('<script>'+script,bridge+'<script>'+script).replace('Click the mug to open your report.','Open your report to explore the games and preparation.');
await writeFile('dist/report.html',html);
const cafePublicURL=process.env.SPLINE_CAFE_URL?.trim();
if(cafePublicURL){
 const url=new URL(cafePublicURL);
 if(url.protocol!=='https:'||!['my.spline.design','prod.spline.design'].includes(url.hostname)||url.username||url.password)throw Error('SPLINE_CAFE_URL must be the HTTPS public Spline export URL, not the editor URL.');
 const source=url.href.replaceAll('&','&amp;').replaceAll('\"','&quot;').replaceAll('<','&lt;');
 const homepage=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Opening Roast — The Café</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#ead8ba}iframe{position:fixed;inset:0;width:100%;height:100%;height:100dvh;border:0}.report-link{position:fixed;right:14px;bottom:14px;z-index:2;background:#fff4e1ed;color:#543b29;border:1px solid #b79b79;border-radius:3px;padding:8px 12px;font:12px system-ui,sans-serif;text-decoration:none}.report-link:hover,.report-link:focus-visible{background:#f5e7cf;outline:2px solid #bd823b;outline-offset:2px}</style></head><body><iframe title="Opening Roast interactive café and chess diagnostic" src="${source}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><a class="report-link" href="/report.html">Report only ↗</a></body></html>`;
 await writeFile('dist/index.html',homepage);
}else await writeFile('dist/index.html',html);
console.log('Built café homepage connection, standalone report and Spline overlay.');
