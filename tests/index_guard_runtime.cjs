'use strict';
// Isolated host check of the zero-based-index guard and explicit recovery.
// The optional manifest loader exercises CAS parsing only, not the Prime PPL
// to CAS bridge or native calculator compatibility.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime}=require('./runtime_loader.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/installer-20261026'));
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const trace=[],partial={rows:[]};
fs.mkdirSync(OUT,{recursive:true});
const saveTrace=()=>fs.writeFileSync(path.join(OUT,'index-guard-trace.json'),JSON.stringify(trace,null,2)+'\n');
function main(){
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(value){return value}};global.alert=()=>{};
const rawEv=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
const ev=command=>{
 const item={command:command.length>200?command.slice(0,200)+'...':command,commandSha256:sha(command),status:'started'};trace.push(item);saveTrace();
 try{const result=rawEv(command);item.status='returned';item.result=result;saveTrace();return result;}
 catch(error){item.status='runtime_error';item.error=String(error);saveTrace();throw error;}
};
ev('calc_mode(-38)');ev('of:=1');ev('angle_radian(1)');ev('complex_variables(0)');
const sources=MODS.map(name=>fs.readFileSync(path.join(ROOT,'src',name+'.cas'),'utf8'));
const loadEvidence=loadRuntime(ev,{root:ROOT,sources,useCommands:Boolean(process.env.XS_LOADER_COMMANDS)});
partial.loadEvidence=loadEvidence;
ev('zzigsentinel:=1729');ev('zzigvalue:=7');ev('assume(zzigpositive>0)');
const snapshot=()=>({indexProbe:ev('[17,23][1]'),radians:ev('angle_radian()'),complexVariables:ev('complex_variables()'),sentinel:ev('zzigsentinel'),boundValue:ev('zzigvalue'),assumption:ev('string(about(quote(zzigpositive)))'),rational:ev('string(1/3)')});
const rows=partial.rows;
function test(id,command,want){
 const before=snapshot(),actual=ev(command),after=snapshot();
 const checks={expected_result:want.includes(actual),state_preserved:JSON.stringify(before)===JSON.stringify(after)};
 rows.push({id,command,actual,want,before,after,checks,pass:Object.values(checks).every(Boolean)});
}
const initial=snapshot();
const setZero=ev('of:=0'),zero=snapshot();
const warning=JSON.stringify('XSIMP 1.8.7: CAS index starts at 0; run of:=1');
// XSCHECK's readiness guard runs before core, so index0 now gets the refresh prompt.
const refresh=JSON.stringify('XSIMP 1.8.7: run XSIMPKIT187 from Program Catalog to refresh CAS functions');
test('index0_selfcheck','XSCHECK(0)',[refresh]);
test('index0_core','xsucorecheck(0)',[warning]);
const gain='sinh(x)+i*sin(i*x)';
for(const [entry,argument] of [['native',gain],['string',JSON.stringify(gain)],['quote','quote('+gain+')']]){
 test('index0_'+entry,'XSIMP('+argument+')',[warning]);
}
test('index0_guard','xsuindexok(0)',['0','false']);
const afterGuard=snapshot(),setOne=ev('of:=1'),restored=snapshot();
test('restored_guard','xsuindexok(0)',['1','true']);
test('restored_selfcheck','XSCHECK(0)',['"XSIMP 1.8.7 CHECK OK"']);
for(const [entry,argument] of [['native',gain],['string',JSON.stringify(gain)],['quote','quote('+gain+')']]){
 test('restored_'+entry,'XSIMP('+argument+')',['0']);
}
test('restored_bound_value','XSIMP("zzigvalue")',['7']);
const final=snapshot();
const transitionChecks={initial_one_based:initial.indexProbe==='17',zero_based_set:zero.indexProbe==='23',zero_based_preserved:afterGuard.indexProbe==='23',one_based_restored:restored.indexProbe==='17',restored_state_matches_initial:JSON.stringify(initial)===JSON.stringify(restored),final_state_matches_initial:JSON.stringify(initial)===JSON.stringify(final)};
rows.push({id:'explicit_index_transitions',setZero,setOne,initial,zero,afterGuard,restored,final,checks:transitionChecks,pass:Object.values(transitionChecks).every(Boolean)});
const report={scope:'Upstream Giac HP mode only: zero-based-index safety guard, explicit of:=1 recovery, and optional per-definition expr manifest loading. This is not native Prime/G2 compatibility or PPL bridge validation.',loadEvidence,sourceSha256:sha(sources.join('\n\n')),modules:Object.fromEntries(MODS.map((name,index)=>[name,sha(sources[index])])),rows,summary:{total:rows.length,passed:rows.filter(row=>row.pass).length,failed:rows.filter(row=>!row.pass).length}};
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'index-guard.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.summary.failed)process.exitCode=1;
}
try{main();}catch(error){
 const report={scope:'Upstream Giac HP mode only, index guard runtime probe; no native/G2 compatibility claim',...partial,status:'runtime_error',error:String(error),traceFile:'index-guard-trace.json',lastCommand:trace.at(-1),summary:{total:partial.rows.length+1,passed:partial.rows.filter(row=>row.pass).length,failed:partial.rows.filter(row=>!row.pass).length+1}};
 fs.writeFileSync(path.join(OUT,'index-guard.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=1;
}
