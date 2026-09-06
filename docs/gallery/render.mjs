// Presentation only. Reads canonical evidence; runs existing asserted scenarios.
// Pass a Playwright module path as argv[2], or install Playwright outside the repo.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = new URL('./', import.meta.url);
const replay = JSON.parse(await readFile(new URL('../evidence/replay.json', import.meta.url)));
const run = name => JSON.parse(execFileSync(process.execPath, ['--import','tsx',`src/${name}.ts`], {cwd:root,encoding:'utf8'}));
const ablation = run('ablation'), stalePlan = run('stale-plan-ablation'), degradation = run('degradation');
assert.equal(replay.action.intercepted, true);
assert.equal(replay.action.executedTool, 'request_corroboration');
assert.equal(ablation.concurrent.hypothesesAtBoundary, 3);
assert.equal(ablation.sequential.hypothesesAtBoundary, 1);
assert.equal(stalePlan.concurrent.proposalFresh, false);
assert.equal(stalePlan.sequential.proposalFresh, true);
assert.equal(degradation.gateAtBoundary, 'blocked');
const C={ink:'#111e25',paper:'#f4f3e9',teal:'#79d7c7',coral:'#ffa58f',green:'#b7e9be',muted:'#abbdbf',line:'#30454b'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=32,color=C.paper,weight=400,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${esc(s)}</text>`;
const rect=(x,y,w,h,fill,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const line=(x,y,x2,y2,color=C.line,width=2,extra='')=>`<path d="M${x} ${y} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const mark=(x,y)=>`<g transform="translate(${x} ${y})"><path d="M0 0 H18 L54 32 M0 32 H54 M0 64 H18 L54 32" fill="none" stroke="${C.teal}" stroke-width="7"/><path d="M65 0 V64" stroke="${C.coral}" stroke-width="8"/></g>`;
const header=(section)=>mark(64,52)+text(154,103,'IncidentMesh',54,C.paper,700)+text(1536,96,section,25,C.muted,500,'text-anchor="end"');
const footer=s=>line(64,817,1536,817)+text(64,860,s,24,C.muted)+text(1536,860,'MOZAIK / INCIDENTMESH',22,C.muted,500,'text-anchor="end"');
const svg=(title,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img"><title>${esc(title)}</title><g font-family="Arial, Helvetica, sans-serif">${rect(0,0,1600,900,C.ink)}${body}</g></svg>`;
let cover=mark(68,64)+text(165,124,'IncidentMesh',78,C.paper,700);
cover+=text(64,267,'Evidence before action.',104,C.paper,700)+text(70,329,'Concurrent incident response',40,C.teal);
for(const [i,label] of ['Trace','Dependency','Impact'].entries()){
 const y=437+i*112;
 cover+=text(70,y+16,label,51,C.teal,600)+line(410,y,525,y,C.teal,7)+`<path d="M525 ${y} Q565 ${y} 584 549" fill="none" stroke="${C.teal}" stroke-width="7"/>`;
}
cover+=line(584,549,639,549,C.teal,9)+`<path d="M622 531 L642 549 L622 567" fill="none" stroke="${C.teal}" stroke-width="8"/>`;
cover+=rect(658,383,878,273,C.coral,18)+text(700,444,'ACTION BOUNDARY',34,C.ink,700)+text(693,597,'BLOCKED',145,C.ink,800);
cover+=text(697,715,'rollback_production',52,C.paper,500)+rect(658,741,878,73,C.green,12)+text(681,794,'↓',61,C.ink,700)+text(737,794,'request_corroboration',52,C.ink,600);
cover+=text(70,864,'Mozaik rewrites the proposal.',30,C.muted);
const cards=[['jigjoy-01-cover','Evidence before action',cover]];
let compare=header('02 / STALE-PLAN CAUSAL ABLATION')+text(64,208,'The evidence changed while it was thinking.',65,C.paper,700)+text(66,262,'Same rev-1 plan · Same action · Same evidence · Only peer scheduling changes',29,C.muted);
for(const [i,key] of ['concurrent','sequential'].entries()){
 const d=stalePlan[key], x=64+i*756, isConcurrent=i===0;
 compare+=rect(x,304,716,468,C.paper,16)+text(x+32,356,key.toUpperCase(),31,C.ink,700);
 compare+=rect(x+32,390,248,76,C.ink,9)+text(x+57,441,`PLAN  rev ${d.firstPlanningRevision}`,34,C.paper,700);
 compare+=text(x+307,444,'→',52,C.ink,700)+rect(x+388,390,296,76,isConcurrent?C.coral:C.green,9)+text(x+414,441,`BOUNDARY  rev ${d.boundaryRevision}`,31,C.ink,700);
 compare+=text(x+32,552,isConcurrent?'STALE':'FRESH',83,isConcurrent?'#a63a25':'#22684f',800);
 compare+=text(x+32,606,'targeted_canary_probe',31,C.ink,600);
 compare+=rect(x+32,635,652,66,isConcurrent?C.green:C.teal,8)+text(x+52,681,isConcurrent?'→ request_corroboration':'BOUNDED PROBE CROSSES',34,C.ink,700);
 compare+=text(x+32,744,isConcurrent?'Fresh rev-3 replan sees conflict.':'Same conflict arrives later.',27,C.ink,600);
}
compare+=text(64,853,'CONCURRENCY CHANGES WHICH DECISIONS ARE STILL VALID.',36,C.teal,700);
cards.push(['jigjoy-02-ablation','Concurrency invalidates an in-flight stale plan',compare]);
let receipt=header('03 / CANONICAL RUNTIME RECEIPT')+text(64,210,'The call changes before it executes.',65,C.paper,700);
const sx=310, scale=2.8, boundary=sx+replay.action.boundaryMs*scale;
receipt+=rect(64,259,1000,282,C.paper,14);
for(const [i,span] of replay.spans.entries()){
 const y=315+i*78; receipt+=text(90,y+12,span.role[0].toUpperCase()+span.role.slice(1),29,C.ink,600)+rect(sx+span.startedAtMs*scale,y-20,(span.completedAtMs-span.startedAtMs)*scale,35,C.teal,5);
 const h=replay.hypotheses.find(h=>h.role===span.role);receipt+=`<circle cx="${sx+h.atMs*scale}" cy="${y-2}" r="9" fill="${C.ink}"/>`;
}
receipt+=line(boundary,272,boundary,523,'#c6553b',4,'stroke-dasharray="8 6"')+text(1098,300,'205 ms',51,C.coral,700)+text(1098,345,'configured boundary',27,C.paper)+text(1098,395,'BLOCKED',47,C.coral,700)+text(1098,440,'● hypothesis published',25,C.teal)+text(1098,483,'Bars: responder spans',25,C.muted);
const types=['mozaik.interception.started','mozaik.interception.rewritten','incident.action.safe-executed','incident.mitigation.replanned'];
const labels=['InterceptionHandler receives rollback_production','SafetyGateInterception → request_corroboration','Safe tool executes','Impact selects canary + targeted corroboration'];
types.forEach((type,i)=>{const e=replay.timeline.find(e=>e.type===type);assert.ok(e);const y=588+i*55;receipt+=text(64,y,`${e.atMs} ms`,28,C.teal,600)+text(230,y,labels[i],31,i===1?C.green:C.paper,i===1?700:400);});
receipt+=footer('Canonical deterministic-fixture times · Not MTTR · No production rollback');
cards.push(['jigjoy-03-interception','Canonical Mozaik interception evidence',receipt]);
let safety=header('04 / DEGRADATION RECEIPT')+text(64,216,'Missing evidence is not approval.',72,C.paper,700);
safety+=rect(64,281,640,462,C.paper,16)+text(100,338,'REQUIRED RESPONDERS',26,C.ink,700);
for(const [i,role] of ['Trace','Dependency','Impact'].entries()){
 const y=414+i*107,missing=degradation.missingRequiredRoles.includes(role.toLowerCase());safety+=text(100,y,role,43,C.ink,700)+text(100,y+40,missing?'TIMEOUT / DEGRADED':'Hypothesis available',26,missing?'#a63a25':'#22684f',600);
}
safety+=text(765,331,`${degradation.hypothesesAvailable.length} / 3 required hypotheses`,41,C.paper,600)+rect(762,370,774,157,C.coral,14)+text(800,485,'BLOCKED',113,C.ink,800)+text(764,580,degradation.gateReasonAtBoundary,32,C.coral,600)+text(764,644,'rollback_production intercepted',35,C.paper)+text(764,709,`→ ${degradation.executedTool}`,38,C.green,600)+text(67,792,'Safe plan: hold for missing evidence; request surviving-signal corroboration.',32,C.paper);
safety+=footer('Asserted dependency-timeout fixture · Proposal-only rollback · No provider claim');
cards.push(['jigjoy-04-safety-proof','Missing required evidence blocks rollback',safety]);
if(process.argv[2]==='--svg-only'){
 for(const [name,title,body] of cards){await writeFile(new URL(`${name}.svg`,out),svg(title,body));console.log(name,'svg');}
 process.exit(0);
}
const {chromium}=await import(process.argv[2] || 'playwright');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
 for(const [name,title,body] of cards){
  const source=svg(title,body); await writeFile(new URL(`${name}.svg`,out),source);
  await page.setContent('<style>body{margin:0}svg{display:block}</style>'+source); await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,out))});
  const size=(await stat(new URL(`${name}.png`,out))).size; assert.ok(size<5_000_000); console.log(name, '1600x900',size);
 }
} finally {await browser.close();}
