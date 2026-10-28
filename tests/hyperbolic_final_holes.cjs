'use strict';
// Actual final selector, isolated from earlier legacy scalar cancellation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime}=require('./runtime_loader.cjs');
const {executeChild}=require('../tools/benchmark.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/hyperbolic-pairs-20261026'));
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const q=s=>JSON.stringify(s),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const cases=[
 {id:'c_hole_prefix',input:'c/c*(exp(i*x)+exp(-i*x))',bindings:['c',0,'x',1]},
 {id:'c_hole_suffix',input:'(exp(i*x)+exp(-i*x))*(c/c)',bindings:['c',0,'x',1]},
 {id:'sin_hole_prefix',input:'sin(c)/sin(c)*(exp(i*x)+exp(-i*x))',bindings:['c',0,'x',1]},
 {id:'sin_hole_suffix',input:'(exp(i*x)+exp(-i*x))*(sin(c)/sin(c))',bindings:['c',0,'x',1]},
 {id:'shift_hole_prefix',input:'(c-1)/(c-1)*(exp(i*x)+exp(-i*x))',bindings:['c',1,'x',1]},
 {id:'power_hole_prefix',input:'c^2/c^2*(exp(i*x)+exp(-i*x))',bindings:['c',0,'x',1]},
 {id:'real_hyp_hole',input:'c/c*(exp(q*x)+exp(-q*x))',bindings:['c',0,'q',1,'x',1]},
 {id:'nonzero_exp_coefficient',input:'exp(c)/exp(c)*(exp(i*x)+exp(-i*x))',gain:true},
 {id:'nonzero_numeric_coefficient',input:'(2/2)*(exp(i*x)+exp(-i*x))',gain:true}
];
function bindings(expr,list){let s=expr;for(let i=0;i<list.length;i+=2)s='subst('+s+','+list[i]+','+list[i+1]+')';return s;}
function worker(index){
 const c=cases[index];global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables(0)');
 const moduleSources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
 const source=moduleSources.join('\n\n');const loadEvidence=loadRuntime(ev,{root:ROOT,sources:moduleSources});
 if(ev('type(xsuholegate)')!=='DOM_FUNC')throw Error('final hole gate not present');
 const oracleLine=fs.readFileSync(path.join(ROOT,'tests/hyperbolic_pairs_runtime.cjs'),'utf8').split('\n').find(x=>x.includes("ev('zzhydenwalk("));new Function('ev',oracleLine)(ev);
 ev('zzhsentinel:=1729');ev('zzhinput:=expr('+q('quote('+c.input+')')+')');
 ev('zzhbase:=xspresent(zzhinput)');ev('zzhraw:=xsuhypcandidate(zzhinput,0)');ev('zzhcandidate:=xspresent(zzhraw)');ev('zzhresult:=xsuend(zzhinput)');
 const text=name=>ev('string('+name+')'),len=name=>Number(ev('size(string('+name+'))'));
 const input=text('zzhinput'),base=text('zzhbase'),raw=text('zzhraw'),candidate=text('zzhcandidate'),result=text('zzhresult');
 const gate=ev('xsuholegate(zzhraw,zzhcandidate)'),baseLen=len('zzhbase'),candidateLen=len('zzhcandidate'),resultLen=len('zzhresult');
 const checks=[],check=(id,pass,details)=>checks.push({id,pass,details});
 function zeroFactor(name){
  ev('zzhfactors:=zzhydenwalk('+name+',0)');const count=Number(ev('size(zzhfactors)')),values=[];let zero=false;
  for(let k=1;k<=count;k++){const value=ev('string(simplify('+bindings('zzhfactors['+k+']',c.bindings)+'))');values.push(value);if(value==='"0"')zero=true;}
  return {zero,values};
 }
 let poles=null;
 if(c.bindings){
  const original=zeroFactor('zzhinput'),before=zeroFactor('zzhbase'),proposed=zeroFactor('zzhcandidate'),after=zeroFactor('zzhresult');poles={original,before,proposed,after};
  check('original_fixture_has_hole',original.zero,{bindings:c.bindings,original});
  // Explicitly distinguish earlier legacy presentation loss from a new loss.
  check('no_new_presentation_hole_loss',!before.zero||after.zero,{before,after,legacyAlreadyLost:!before.zero});
  if(before.zero&&!proposed.zero){check('unsafe_candidate_rejected',gate==='0'||gate==='false',{gate});check('fallback_to_old_display',result===base,{base,result});}
 }
 check('exact_result',ev('xsapproxstate(zzhresult,0)')==='0',{});
 check('display_not_longer_than_old',resultLen<=baseLen,{baseLen,candidateLen,resultLen});
 const permitted=gate==='1'||gate==='true';check('selector_uses_length_and_domain',result===(candidateLen<baseLen&&permitted?candidate:base),{gate});
 if(c.gain)check('safe_coefficient_not_blanket_rejected',resultLen<baseLen,{baseLen,resultLen});
 const publicDisplay=ev('zzhpublic:=XSIMP('+q(c.input)+')'),publicText=text('zzhpublic');
 check('sentinel_unchanged',ev('zzhsentinel')==='1729',{});
 console.log('HOLE_RESULT '+JSON.stringify({id:c.id,loadEvidence,inputExpression:c.input,input,base,raw,candidate,result,baseLen,candidateLen,resultLen,gate,poles,publicDisplay,publicText,checks,pass:checks.every(x=>x.pass),sourceSha256:sha(source),modules:Object.fromEntries(MODS.map((n,i)=>[n,sha(moduleSources[i])])),scope:'Actual src selector; upstream HP mode only'}));
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});const report={scope:'Final display eligibility and domain-hole rejection; actual src only',cases:[]};
 for(let offset=0;offset<cases.length;offset+=2){
  const rows=await Promise.all(cases.slice(offset,offset+2).map(async(_,j)=>{
   const i=offset+j,r=await executeChild([__filename,'--worker',String(i)],20000);let row;try{row=JSON.parse(r.stdout.split(/\r?\n/).find(x=>x.startsWith('HOLE_RESULT ')).slice(12))}catch{row={id:cases[i].id,pass:false,status:'worker_error',...r};}if(r.timedOut)row={id:cases[i].id,pass:false,status:'timeout',...r};return row;
  }));
  for(const row of rows){report.cases.push(row);console.log(row.id+': '+(row.pass?'PASS':'FAIL'));fs.writeFileSync(path.join(OUT,'final-holes.json'),JSON.stringify(report,null,2)+'\n');}
 }
 report.summary={total:report.cases.length,passed:report.cases.filter(x=>x.pass).length,failed:report.cases.filter(x=>!x.pass).length};fs.writeFileSync(path.join(OUT,'final-holes.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(Number(process.argv[3]))}catch(e){console.log('HOLE_RESULT '+JSON.stringify({pass:false,status:'worker_error',error:String(e)}));process.exitCode=1}}else main().catch(e=>{console.error(e);process.exitCode=1});
