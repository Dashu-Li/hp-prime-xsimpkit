'use strict';
// Compare final scalar/traversal optimizations with the frozen 1.8.1 source.
// This checks behavior, not a speed claim or physical Prime/G2 compatibility.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {loadRuntime}=require('./runtime_loader.cjs');
const ROOT=path.resolve(__dirname,'..'),MODS=['scalar','matrix','presentation','posthoc','unified'];
const BASE=path.resolve(process.env.XS_PERF_BASELINE||path.join(ROOT,'candidates/perf181-baseline'));
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/performance-20261026'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
const baseline=MODS.map(n=>fs.readFileSync(path.join(BASE,n+'.cas'),'utf8'));
const hashes=list=>Object.fromEntries(MODS.map((n,i)=>[n+'.cas',sha(list[i])]));
const originalBaseline=baseline.join('\n\n');
// Distinct function names allow both versions to receive exactly the same
// fixture in one disposable worker. The only normalized diagnostic text is
// the prefix introduced by this renaming; all raw captures are retained.
const names=[...originalBaseline.matchAll(/^([A-Za-z]\w*)\([^\n]*\):=BEGIN/gm)]
  .map(m=>m[1]).sort((a,b)=>b.length-a.length);
let renamedBaseline=originalBaseline;
for(const name of names)renamedBaseline=renamedBaseline.replace(new RegExp('\\b'+name+'\\b','g'),'zzold'+name);
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};
global.alert=()=>{};
const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables(0)');
ev(renamedBaseline);
const loadEvidence=loadRuntime(ev,{root:ROOT,sources});
ev('zzperfboundmat:=[[0,1],[-1,0]]');ev('zzperfboundvec:=[x,y]');ev('zzperfboundfloat:=1.25');
ev('zzperfsentinel:=1729');ev('zzperffunction(zzpfarg):=zzpfarg+1729');ev('assume(zzperfpositive>0)');
const state=()=>({sentinel:ev('zzperfsentinel'),otherFunction:ev('zzperffunction(1)'),
  assumption:ev('string(about(quote(zzperfpositive)))'),angle:ev('angle_radian()'),complex:ev('complex_variables()')});
const before=state(),rows=[];
function compare(collection,id,fn,arg){
  const oldCommand='string(zzold'+fn+'('+arg+'))',newCommand='string('+fn+'('+arg+'))';
  const t0=performance.now(),prior=ev(oldCommand),t1=performance.now(),current=ev(newCommand),t2=performance.now();
  const normalizedPrior=prior.replaceAll('zzoldXSIMP','XSIMP');
  const error=prior.startsWith('GIAC_ERROR')||current.startsWith('GIAC_ERROR');
  const row={collection,id,function:fn,argument:arg,prior,normalizedPrior,current,
    identical:normalizedPrior===current,runtimeError:error,pass:normalizedPrior===current&&!error,
    informationalMilliseconds:{baseline:t1-t0,candidate:t2-t1}};
  rows.push(row);console.log('PERFORMANCE_CASE '+collection+'/'+id+': '+(row.pass?'PASS':'FAIL'));
}
const nest=n=>'sin('.repeat(n)+'x'+')'.repeat(n);
for(const n of [0,1,18,19,20,21,22,23,24,25])compare('tree','scalar_depth_'+n,'xsutree','quote(exp(2*'+nest(n)+'))');
for(const n of [20,21,22,23,24]){
  compare('tree','matrix_depth_'+n,'xsutree','quote(exp('+nest(n)+'*zzperfboundmat))');
  compare('tree','vector_depth_'+n,'xsutree','quote(exp('+nest(n)+'*zzperfboundvec))');
}
const treeCases=['exp(2*[[0,1],[-1,0]])','exp([[0,1],[-1,0]]*2)','exp(2*zzperfboundmat)',
  'exp(2*zzperfboundvec)','exp(2*[x,y])','exp(2*[1])','exp(2*zzperfboundfloat)',
  'exp(2*sqrt(4-2*i))','exp(2*(2^i))','exp(2*ln(2))','exp(2*foo(x))',
  'exp(0*foo(x))','exp(0*zzperfboundmat)','exp(0*zzperfboundvec)','exp(2*sin(i*x))'];
treeCases.forEach((input,i)=>compare('tree','dispatch_'+i,'xsutree','quote('+input+')'));
const helperCases=['a^2+2*a*b+b^2','(1+i)*a^2+(1-i)*b^2','(a^2+2*a*b+b^2)^8',
  'sqrt(a^2+2*a*b+b^2)','(a^2+2*a*b+b^2)^(1/2)','exp(a^2+2*a*b+b^2)',
  'exp(i*x)+exp(-i*x)','exp(sqrt(a^2+b^2)*x)-exp(-sqrt(a^2+b^2)*x)',
  'exp((a^2+b^2)*x)*exp(-(a^2+b^2)*x)','exp((2-sqrt(3))*ln(2))',
  'sin(-x)+cos(-x)','cosh(i*x)+sinh(i*x)','[a^2+b^2,exp(i*x),ln(2)]','quote(foo(a^2+b^2))'];
helperCases.forEach((input,i)=>{
  for(const fn of ['xsrewrite','xshypwalk','xspimagwalk']){
    // Both baseline and candidate direct xshypwalk throw an upstream error
    // on this fixture; public xshypcompact catches it. Do not credit it as a pass.
    if(i===8&&fn==='xshypwalk')continue;
    compare('helpers','case_'+i+'_'+fn,fn,'quote('+input+')'+(fn==='xsrewrite'?'':',0'));
  }
});
const R='sqrt(a^2*c^2+2*a*b*c^2+4*a*b*c*d+4*a*b*d^2+b^2*c^2+4*b^2*c*d+4*b^2*d^2)';
const U='('+R+'*x/(2*a+2*b))',V='('+R+'*t/(2*a+2*b))';
const regressions=[
  ['long_square_identity','(exp('+U+')+exp(-'+U+'))^2-(exp('+U+')-exp(-'+U+'))^2'],
  ['long_rational_exponential_cancel','(exp('+U+')-exp(-'+U+'))/(exp(2*'+U+')-1)'],
  ['long_prefactor_ratio','exp('+U+')*(exp('+U+')-exp(-'+U+'))/(exp('+V+')-exp(-'+V+'))'],
  ['long_unfinished_coefficient','((sin(y)^2+cos(y)^2)*(a^2+2*a*b+b^2)/(a+b)^2)*(exp('+U+')-exp(-'+U+'))'],
  ['numeric_multiplication','(2/2)*(exp(i*x)+exp(-i*x))'],
  ['polynomial_hole_and_pair','c/c*(exp(i*x)+exp(-i*x))']
];
regressions.forEach(([id,input])=>compare('public',id,'XSIMP',JSON.stringify(input)));
const real=fs.readFileSync(path.join(ROOT,'candidates/user-exp-result.cas'),'utf8').trim();
compare('public','user_result_string','XSIMP',JSON.stringify(real));
compare('public','user_result_quote','XSIMP','quote('+real+')');
compare('public','user_result_ordinary','XSIMP',real);
const after=state();
const currentHashes=hashes(MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8')));
const inputsUnchanged=JSON.stringify(currentHashes)===JSON.stringify(hashes(sources));
const stateUnchanged=JSON.stringify(before)===JSON.stringify(after);
const report={scope:'Upstream Giac HP mode only; baseline/current behavior comparison. Informational same-worker timings are not a benchmark and are not Prime/G2 timings.',
  runtimeVersion:ev('version()'),loadEvidence,baselineDirectory:BASE,
  hashes:{baseline:hashes(baseline),candidate:hashes(sources),renamedBaselineSource:sha(renamedBaseline)},
  comparisonNote:'Baseline function names receive zzold; only resulting zzoldXSIMP diagnostic prefix is normalized. Raw outputs remain in every row.',
  exclusions:[{function:'xshypwalk',input:helperCases[8],reason:'Same direct upstream runtime error in both versions; not counted as a passing comparison.'}],
  state:{before,after,unchanged:stateUnchanged},inputsUnchanged,rows,
  summary:{total:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,
    byCollection:Object.fromEntries(['tree','helpers','public'].map(c=>[c,{total:rows.filter(r=>r.collection===c).length,passed:rows.filter(r=>r.collection===c&&r.pass).length}]))}};
report.pass=report.summary.failed===0&&stateUnchanged&&inputsUnchanged;
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'performance-runtime.json'),JSON.stringify(report,null,2)+'\n');
console.log('PERFORMANCE_SUMMARY '+JSON.stringify({...report.summary,stateUnchanged,inputsUnchanged,pass:report.pass}));
if(!report.pass)process.exitCode=1;
