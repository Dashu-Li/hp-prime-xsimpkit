'use strict';
// Angle-dependent trig must not change the meaning of the angle-independent exp.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime}=require('./runtime_loader.cjs');
const {executeChild}=require('../tools/benchmark.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/hyperbolic-pairs-20261026'));
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const angleModes=[{name:'radians',value:1,straightAngle:'π'}, {name:'degrees',value:0,straightAngle:'180'}, {name:'gradians',value:2,straightAngle:'200'}];
const input='exp(i*x)+exp(-i*x)';
function worker(index){
 const mode=angleModes[index];
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables(0)');
 const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8')),source=sources.join('\n\n');const loadEvidence=loadRuntime(ev,{root:ROOT,sources});
 ev('angle_radian('+mode.value+')');ev('zzangsentinel:=1729');ev('assume(zzangpositive>0)');
 const state=()=>({angle:ev('angle_radian()'),straightAngle:ev('acos(-1)'),complex:ev('complex_variables()'),sentinel:ev('zzangsentinel'),assumption:ev('string(about(quote(zzangpositive)))')});
 const before=state(),radianProbe=ev('xsmpisradian(0)'),cases=[];
 for(const entry of ['native','string','quote','final_selector']){
  const arg=entry==='string'?JSON.stringify(input):entry==='quote'?'quote('+input+')':input;
  const command=entry==='final_selector'?'xsuend(quote('+input+'))':'XSIMP('+arg+')';
  const display=ev('zzangresult:='+command),type=ev('type(zzangresult)'),approx=ev('xsapproxstate(zzangresult,0)');
  const difference=ev('evalf(abs(subst(zzangresult,x,1)-(exp(i)+exp(-i))))');
  const after=state();
  const checks={mode_requested:before.angle===String(mode.value),mode_verified:before.straightAngle===mode.straightAngle,radian_guard:(mode.value===1?['1','true']:['0','false']).includes(radianProbe),state_preserved:JSON.stringify(before)===JSON.stringify(after),exact:approx==='0',not_error:type!=='DOM_STRING',numeric_value:Number.isFinite(Number(difference))&&Number(difference)<1e-12};
  cases.push({mode:mode.name,entry,command,display,type,approx,difference,before,after,radianProbe,checks,pass:Object.values(checks).every(Boolean)});
 }
 console.log('ANGLE_RESULT '+JSON.stringify({mode:mode.name,loadEvidence,cases,sourceSha256:sha(source),modules:Object.fromEntries(MODS.map((n,i)=>[n,sha(sources[i])]))}));
}
async function main(){
 const report={scope:'Isolated upstream Giac HP-mode angle tests of final five-module src; exp arguments are in radians independently of trig angle mode; not native/G2',cases:[],workers:[]};
 for(let i=0;i<angleModes.length;i++){
  const r=await executeChild([__filename,'--worker',String(i)],30000);
  let row;try{row=JSON.parse(r.stdout.split(/\r?\n/).find(s=>s.startsWith('ANGLE_RESULT ')).slice(13));}catch{row={mode:angleModes[i].name,pass:false,...r};}
  report.workers.push(row);if(row.cases)report.cases.push(...row.cases);else report.cases.push({mode:row.mode,pass:false,status:'worker_error'});
 }
 report.summary={total:report.cases.length,passed:report.cases.filter(c=>c.pass).length,failed:report.cases.filter(c=>!c.pass).length};
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'angle-modes.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(Number(process.argv[3]));}catch(e){console.error(e);process.exitCode=1;}}else main().catch(e=>{console.error(e);process.exitCode=1;});
