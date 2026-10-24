const fs=require('fs'),cp=require('child_process'),path=require('path');
const cases=[
 ['symbolic base, ordinary variable mode','a',0],
 ['symbolic base, complex variable mode','a',1],
 ['positive integer base','2',1],
 ['identity base','1',1],
 ['positive fractional base','1/2',1],
 ['negative real base','-2',1],
 ['imaginary base','i',1],
 ['nonreal base','1+i',1],
];
if(process.argv[2]==='--worker'){
 const index=Number(process.argv[3]),[name,base,complexVariables]=cases[index];
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
 const g=require('../test_runtime/giac.js'),ev=g.cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');ev(`complex_variables(${complexVariables})`);console.log('STAGE modes set');
 ev(['scalar','matrix','presentation','posthoc','unified'].map(x=>fs.readFileSync(path.join(__dirname,x+'.cas'),'utf8')).join('\n'));console.log('STAGE modules compiled');
 const nativeSource=`exp([[1,1],[2,3]]*ln(${base}))`;
 const ep=`exp((2+sqrt(3))*ln(${base}))`,em=`exp((2-sqrt(3))*ln(${base}))`;
 // The upstream native matrix exponential itself throws for unknown complex a.
 // Its exact spectral form exercises XSIMP independently of that earlier failure.
 const source=index===1?`[[(3-sqrt(3))*${ep}/6+(3+sqrt(3))*${em}/6,sqrt(3)*(${ep}-${em})/6],[sqrt(3)*(${ep}-${em})/3,(3+sqrt(3))*${ep}/6+(3-sqrt(3))*${em}/6]]`:nativeSource;
 const L=`ln(${base})`,u=`sqrt(3)*${L}`;
 const expected=`exp(2*${L})*[[cosh(${u})-sinh(${u})/sqrt(3),sinh(${u})/sqrt(3)],[2*sinh(${u})/sqrt(3),cosh(${u})+sinh(${u})/sqrt(3)]]`;
 const started=Date.now();console.log('STAGE before raw expression');const raw=ev('sbraw:='+source);console.log('STAGE raw expression complete');if(index===1&&process.env.XS_PROBE){for(const probe of ['xsppa(sbraw[1,1],0)','xsppsafe(sbraw[1,1],0)','normal((op(xsppa(sbraw[1,1],0)[1])+op(xsppa(sbraw[1,1],0)[2]))/2)','xsclean(exp(2*ln(a)))','xsppostscalar(sbraw[1,1])','re(sqrt(3)*ln(a))','simplify(re(sqrt(3)*ln(a)))','xspimagwalk(xsppostscalar(sbraw[1,1]),0)','xsptext(xsppostscalar(sbraw[1,1]),0)','xspresent(xsppostscalar(sbraw[1,1]))']){console.log('PROBE BEFORE '+probe);console.log('PROBE AFTER '+ev(probe));}}const actual=ev('sbactual:=XSIMP(sbraw)');console.log('STAGE XSIMP unquoted complete');const quoted=ev('sbquoted:=XSIMP('+JSON.stringify(nativeSource)+')');console.log('STAGE XSIMP quoted complete');
 const result={index,name,base,complexVariables,source,inputRoute:index===1?'explicit exact spectral matrix; native symbolic complex exp baseline throws before XSIMP':'native matrix exponential',raw,actual,quoted,rawLength:raw.length,actualLength:actual.length,quotedLength:quoted.length,ms:Date.now()-started};
 console.log('PARTIAL '+JSON.stringify(result));
 result.nativeAlreadyApproximate=/\d+\.\d+/.test(raw);
 if(result.nativeAlreadyApproximate){
  result.proof=result.quotedProof='Not an exact proof: native input is already approximate.';
 }else{
  result.proof=ev(`xsmzero(simplify(texpand(hyp2exp(pow2exp(sbactual)))-texpand(hyp2exp(pow2exp(${expected}))))))`);
  result.quotedProof=ev('xsmzero(simplify(texpand(hyp2exp(pow2exp(sbactual)))-texpand(hyp2exp(pow2exp(sbquoted))))))');
 }
 if(base!=='a'&&(result.proof!=='1'||result.quotedProof!=='1')){
  ev(`sbdiff:=evalf(sbactual-(${expected}))`);
  result.numericError=ev('max([abs(sbdiff[1,1]),abs(sbdiff[1,2]),abs(sbdiff[2,1]),abs(sbdiff[2,2])])');
  ev('sbdiff:=evalf(sbactual-sbquoted)');
  result.quotedNumericError=ev('max([abs(sbdiff[1,1]),abs(sbdiff[1,2]),abs(sbdiff[2,1]),abs(sbdiff[2,2])])');
  result.numericPass=Number(result.numericError)<1e-9&&Number(result.quotedNumericError)<1e-9;
 }
 result.compact=base==='1'||actual.includes('cosh')||actual.includes('sinh')||actual.includes('cos(')||actual.includes('sin(');
 result.pass=result.proof==='1'&&result.quotedProof==='1'&&result.compact||result.nativeAlreadyApproximate&&result.actual===result.raw&&result.numericPass;
 result.validation=result.nativeAlreadyApproximate?'Numeric consistency only; approximate native input retained.':'Exact symbolic equality and compact representation.';
 result.ms=Date.now()-started;console.log('RESULT '+JSON.stringify(result));process.exit(result.pass?0:1);
}
let next=0;const results=[];
async function run(){while(next<cases.length){const index=next++;const result=await new Promise(resolve=>{
 const p=cp.spawn(process.execPath,[__filename,'--worker',String(index)],{stdio:['ignore','pipe','pipe']});let out='',err='',timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;p.kill('SIGKILL');},25000);
 p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>{err+=b;if(err.length>12000)err=err.slice(-12000)});
 p.on('close',code=>{clearTimeout(timer);const lines=out.split('\n'),final=lines.findLast(s=>s.startsWith('RESULT ')),partial=lines.findLast(s=>s.startsWith('PARTIAL '));
 const r=final?JSON.parse(final.slice(7)):partial?JSON.parse(partial.slice(8)):{index,name:cases[index][0]};
 if(!final){r.pass=false;r.status=timedOut?'25s test timeout':'runtime exited before completion';r.stderrTail=err.slice(-400);}
 resolve(r);});
 });results.push(result);console.log(JSON.stringify(result));}}
Promise.all([run(),run()]).then(()=>{results.sort((a,b)=>a.index-b.index);fs.writeFileSync(path.join(__dirname,'symbolic_base_results.json'),JSON.stringify({runtime:'Upstream Giac, calc_mode(-38), original one-based modules; not HP firmware',domain:'The input contains ln(a); comparison is on its original domain a != 0, with the same complex logarithm branch.',nativeBaselineBoundary:{command:'complex_variables(1); exp([[1,1],[2,3]]*ln(a))',status:'Upstream native CAS throws before XSIMP. This boundary is not counted as a passing case.',stageLog:'symbolic_base_complex_stages.log'},posthoc_sha256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'posthoc.cas'))).digest('hex'),summary:{total:results.length,exactPass:results.filter(x=>x.pass&&!x.nativeAlreadyApproximate).length,numericConsistencyOnly:results.filter(x=>x.pass&&x.nativeAlreadyApproximate).length,failed:results.filter(x=>!x.pass).length},cases:results},null,2));if(results.some(x=>!x.pass))process.exitCode=1;});
