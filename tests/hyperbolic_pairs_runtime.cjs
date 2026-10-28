'use strict';
// General final-expression rewrite checks. Never calls desolve or changes src.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {executeChild}=require('../tools/benchmark.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'evidence/hyperbolic-pairs-20261026');
const EXTERNAL_CANDIDATE=Boolean(process.env.XS_HYP_CANDIDATE);
const CANDIDATE=process.env.XS_HYP_CANDIDATE||path.join(ROOT,'src/posthoc.cas');
const HELPER=process.env.XS_HYP_HELPER||'xshypcompact';
const REPORT=process.env.XS_HYP_REPORT||'helper-runtime';
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const q=s=>JSON.stringify(s),held=s=>'expr('+q('quote('+s+')')+')';
const pair='(exp((m+q)*x)-exp((m-q)*x))/(exp((m+q)*t)-exp((m-q)*t))';
const cases=[
 {id:'symmetric_sum',input:'exp(z)+exp(-z)',gain:true},
 {id:'symmetric_difference',input:'exp(z)-exp(-z)',gain:true},
 {id:'shifted_sum',input:'exp(u)+exp(v)',unchanged:true},
 {id:'shifted_difference',input:'exp(u)-exp(v)',unchanged:true},
 {id:'numeric_coeff_sum',input:'3*exp(z)+3*exp(-z)',gain:true},
 {id:'numeric_coeff_difference',input:'3*exp(z)-3*exp(-z)',gain:true},
 {id:'complex_center',input:'exp((1+i)*x+z)+exp((1+i)*x-z)',gain:true},
 {id:'imaginary_pair',input:'exp(i*x)+exp(-i*x)',gain:true},
 {id:'difference_denominator',input:'1/(exp(u)-exp(v))',poles:[['u',0,'v',0],['u','pi*i','v','-pi*i']]},
 {id:'sum_denominator',input:'1/(exp(u)+exp(v))',poles:[['u','pi*i','v',0]]},
 {id:'ratio_rate_zero',input:pair,gain:true,poles:[['q',0,'m',1,'x','1/3','t',1],['q','pi*i','m',1,'x','1/3','t',1]],forbiddenAtRateZero:'x/t'},
 {id:'unknown_coefficient_hole',input:'c*(exp(u)-exp(v))/(c*(exp(u)+exp(v)))',poles:[['c',0,'u',1,'v',2]],retainCoefficient:'c'},
 {id:'exponent_reciprocal_hole',input:'exp(h*q*x/h)-exp(-h*q*x/h)',poles:[['h',0,'q',1,'x',1]],unchanged:true},
 {id:'unequal_symbolic_coefficients',input:'a*exp(u)+b*exp(v)'},
 {id:'unequal_numeric_coefficients',input:'2*exp(u)+3*exp(v)'},
 {id:'principal_root_product',input:'exp(sqrt(a*b)*x)-exp(-sqrt(a*b)*x)',rootSamples:[['a',-1,'b',-1,'x',1]]},
 {id:'principal_complex_root',input:'exp(sqrt(4-2*i)*x)+exp(-sqrt(4-2*i)*x)'},
 {id:'existing_log',input:'exp(ln(a)*x)+exp(-ln(a)*x)',rootSamples:[['a',-1,'x','1/3']]},
 {id:'three_atoms',input:'exp(u)+exp(v)+exp(w)'},
 {id:'unrelated_algebra',input:'(x^2-1)/(x-1)',unchanged:true},
 {id:'unknown_function_held',input:'zzhyaction(2)+exp(u)+exp(v)',noCalls:true},
 {id:'approximate_coefficient',input:'1.25*(exp(u)+exp(v))',approx:true},
 {id:'exact_coefficient',input:'5/4*(exp(u)+exp(v))'},
 {id:'char_budget',input:'exp('+Array(2100).fill('x').join('+')+')+exp(y)',unchanged:true,noProof:true},
 {id:'depth_budget',input:'sin('.repeat(40)+'exp(u)+exp(v)'+')'.repeat(40),unchanged:true,noProof:true},
 {id:'assigned_state',input:'exp(u)+exp(v)',setup:['zzhybound:=7','assume(zzhypositive>0)']},
 {id:'list_fallback',input:'[exp(z)+exp(-z),exp(z)-exp(-z)]',unchanged:true,noProof:true},
 {id:'matrix_fallback',input:'[[exp(z)+exp(-z),0],[0,1]]',unchanged:true,noProof:true},
 {id:'equal_coefficient_hidden_hole_left',input:'exp((m+q)*x)+(c/c)*exp((m-q)*x)',poles:[['c',0,'m',1,'q',1,'x',1]]},
 {id:'equal_coefficient_hidden_hole_right',input:'(c/c)*exp((m+q)*x)+exp((m-q)*x)',poles:[['c',0,'m',1,'q',1,'x',1]]},
 {id:'held_bound_coefficient',input:'zzhycoef*exp((m+q)*x)+zzhycoef*exp((m-q)*x)',setup:['zzhycoef:=quote(zzhyaction(2))'],noCalls:true},
 {id:'nonpolynomial_coefficient_hole',input:'exp((m+q)*x)+(sin(c)/sin(c))*exp((m-q)*x)',poles:[['c',0,'m',1,'q',1,'x',1]]},
 {id:'independent_short_ratio',input:'(exp(u)-exp(v))/(exp(w)-exp(z))',unchanged:true},
 {id:'node_budget',input:'exp('+Array(770).fill('x').join('+')+')+exp(y)',unchanged:true,noProof:true},
 {id:'angle_aux_bound',input:'exp(sqrt(a*b)*x)-exp(-sqrt(a*b)*x)',setup:['xshypangleaux:=7']},
 {id:'angle_aux_in_input',input:'exp(xshypangleaux*x)+exp(-xshypangleaux*x)'},
 {id:'angle_aux_held_binding',input:'exp(sqrt(a*b)*x)-exp(-sqrt(a*b)*x)',setup:['xshypangleaux:=quote(zzhyaction(2))'],noCalls:true},
];
const fixturePath=path.join(ROOT,'candidates/user-exp-result.cas');
if(fs.existsSync(fixturePath)){
 const fixture=fs.readFileSync(fixturePath,'utf8').trim();
 cases.push({id:'user_returned_expression',input:fixture,gain:true,noProof:true,fixture:true,poles:[['a',1,'b',1,'c',0,'d',0,'s',1,'t',1,'x','1/3']]});
}
function substitute(expr,bindings){
 let s=expr;
 for(let i=0;i<bindings.length;i+=2)s='subst('+s+','+bindings[i]+','+bindings[i+1]+')';
 return s;
}
function worker(index){
 const c=cases[index];
 if(!fs.existsSync(CANDIDATE))throw Error('candidate not ready: '+CANDIDATE);
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables(1)');
 const base=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8')).join('\n\n');
 const candidate=fs.readFileSync(CANDIDATE,'utf8');ev(base);if(EXTERNAL_CANDIDATE)ev(candidate);
 if(ev('type('+HELPER+')')!=='DOM_FUNC')throw Error('helper not registered');
 // Structural denominator extraction avoids denom(quote(x/y)), which returns
 // 1 in this HP-mode runtime and would miss the very holes being tested.
 ev('zzhydenwalk(zzhye,zzhyd):=BEGIN LOCAL zzhyh,zzhyn,zzhyl,zzhyr,zzhyk,zzhyv,zzhyj; zzhyr:=[]; IF zzhyd>=48 OR type(zzhye)<>DOM_SYMBOLIC THEN RETURN zzhyr;END; zzhyh:=xshead(zzhye);zzhyn:=string(zzhyh);zzhyl:=[op(zzhye)]; IF zzhyn=="\'inv\'" OR zzhyn=="inv" THEN zzhyr:=append(zzhyr,zzhyl[1]);END; IF zzhyn=="\'/\'" OR zzhyn=="/" THEN IF size(zzhyl)==2 THEN zzhyr:=append(zzhyr,zzhyl[2]);END;END; IF zzhyn=="\'^\'" OR zzhyn=="^" THEN IF size(zzhyl)==2 AND (type(zzhyl[2])==DOM_INT OR type(zzhyl[2])==DOM_RAT) THEN IF zzhyl[2]<0 THEN zzhyr:=append(zzhyr,zzhyl[1]);END;END;END; FOR zzhyk FROM 1 TO size(zzhyl) DO zzhyv:=zzhydenwalk(zzhyl[zzhyk],zzhyd+1);FOR zzhyj FROM 1 TO size(zzhyv) DO zzhyr:=append(zzhyr,zzhyv[zzhyj]);END;END; RETURN zzhyr;END;');

 ev('zzhycalls:=0');ev('zzhysentinel:=1729');ev('zzhyaction(zzhyarg):=BEGIN zzhycalls:=zzhycalls+1;RETURN zzhyarg;END;');
 for(const cmd of c.setup||[])ev(cmd);
 ev('zzhyinput:='+held(c.input));
 const state=()=>({count:ev('zzhycalls'),sentinel:ev('zzhysentinel'),angle:ev('angle_radian()'),complex:ev('complex_variables()'),bound:ev('string(about(quote(zzhybound)))'),assumption:ev('string(about(quote(zzhypositive)))'),aux:ev('string(about(quote(xshypangleaux)))')});
 const before=state(),input=ev('string(zzhyinput)'),inputType=ev('type(zzhyinput)'),inputApprox=ev('xsapproxstate(zzhyinput,0)');
 const start=performance.now(),display=ev('zzhyoutput:='+HELPER+'(zzhyinput)'),ms=performance.now()-start;
 const output=ev('string(zzhyoutput)'),type=ev('type(zzhyoutput)'),approx=ev('xsapproxstate(zzhyoutput,0)'),after=state();
 const inputLength=Number(ev('size(string(zzhyinput))')),outputLength=Number(ev('size(string(zzhyoutput))'));
 const checks=[];const check=(id,pass,details)=>checks.push({id,pass,details});
 check('state_unchanged',JSON.stringify(before)===JSON.stringify(after),{before,after});
 check('exactness_preserved',c.approx?approx==='1':inputApprox!=='0'||approx==='0',{inputApprox,approx});
 check('not_error_type',type!=='DOM_STRING',{display,type});
 check('not_longer',outputLength<=inputLength,{inputLength,outputLength});
 if(c.gain)check('pair_compacted',input!==output&&outputLength<inputLength&&/sinh|cosh|sin\(|cos\(/i.test(output),{input,output});
 if(c.unchanged)check('unsupported_budget_fallback',input===output&&inputType===type,{input,output});
 if(c.noCalls)check('held_call_not_executed',after.count==='0',{count:after.count});
 if(!c.noProof&&!c.noCalls){
  const proof=ev('string(simplify(hyp2exp(zzhyoutput)-hyp2exp(zzhyinput)))');
  check('independent_exp_basis',proof==='"0"',{proof});
 }
 function zeroFactor(base,bindings){
  const factors=ev('size(zzhydenwalk('+base+',0))');
  const count=Number(factors),details=[];let zero=false;
  if(!Number.isInteger(count)||count<0||count>512)return {zero:false,error:'invalid denominator factor collection',factors};
  ev('zzhyfactors:=zzhydenwalk('+base+',0)');
  for(let j=1;j<=count;j++){
   const value=ev('string(simplify('+substitute('zzhyfactors['+j+']',bindings)+'))');
   details.push(value);if(value==='"0"')zero=true;
  }
  return {zero,factorValues:details};
 }
 for(let i=0;i<(c.poles||[]).length;i++){
  const bindings=c.poles[i],original=zeroFactor('zzhyinput',bindings),rewritten=zeroFactor('zzhyoutput',bindings);
  check('denominator_zero_'+i,original.zero&&rewritten.zero,{bindings,original,rewritten});
 }
 // Numerical branch probes supplement, never replace, the identities above.
 for(let i=0;i<(c.rootSamples||[]).length;i++){
  const bindings=c.rootSamples[i],difference=ev('evalf(abs('+substitute('zzhyoutput',bindings)+'-'+substitute('zzhyinput',bindings)+'))');
  check('branch_sample_'+i,Number.isFinite(Number(difference))&&Number(difference)<1e-9,{bindings,difference});
 }
 const report={id:c.id,inputExpression:c.input,input,inputType,inputApprox,inputLength,display,output,type,approx,outputLength,ms,checks,pass:checks.every(x=>x.pass),candidateSha256:sha(candidate),baseSha256:sha(base),scope:'Upstream Giac HP mode, helper-only; not native firmware/G2'};
 console.log('HYP_RESULT '+JSON.stringify(report));
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});
 if(!fs.existsSync(CANDIDATE)){console.log('Candidate not ready; test script prepared but not executed.');process.exitCode=2;return;}
 const candidateSource=fs.readFileSync(CANDIDATE),candidateSha256=sha(candidateSource);
 const snapshot=path.join(OUT,'candidate-'+candidateSha256.slice(0,12)+'.cas');
 fs.writeFileSync(snapshot,candidateSource);if(EXTERNAL_CANDIDATE)process.env.XS_HYP_CANDIDATE=snapshot;
 const report={scope:'General expression rewrite; no ODE-solving command executed',runtimeSha256:sha(fs.readFileSync(path.join(ROOT,'test_runtime/giac.js'))),candidate:CANDIDATE,loadMode:EXTERNAL_CANDIDATE?'explicit_external_candidate':'actual_src_only',snapshot,candidateSha256,concurrency:2,cases:[]};
 const selected=cases.map((_,i)=>i).filter(i=>(process.argv[2]!=='--single'||i===Number(process.argv[3]))&&(!process.env.XS_HYP_IDS||process.env.XS_HYP_IDS.split(',').includes(cases[i].id)));
 async function run(index){
  const r=await executeChild([__filename,'--worker',String(index)],20000);let row;
  try{row=JSON.parse(r.stdout.split(/\r?\n/).find(x=>x.startsWith('HYP_RESULT ')).slice(11))}catch{row={id:cases[index].id,status:'worker_error',pass:false,...r};}
  if(r.timedOut)row={id:cases[index].id,status:'timeout',pass:false,...r};
  if(row.candidateSha256&&row.candidateSha256!==candidateSha256){row.pass=false;row.status='source_changed';}
  return row;
 }
 for(let offset=0;offset<selected.length;offset+=2){
  const rows=await Promise.all(selected.slice(offset,offset+2).map(run));
  for(const row of rows){
   report.cases.push(row);console.log(row.id+': '+(row.pass?'PASS':'FAIL'));
   fs.writeFileSync(path.join(OUT,REPORT+'.json'),JSON.stringify(report,null,2)+'\n');
  }
 }
 report.summary={total:report.cases.length,passed:report.cases.filter(x=>x.pass).length,failed:report.cases.filter(x=>!x.pass).length};
 fs.writeFileSync(path.join(OUT,REPORT+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(Number(process.argv[3]))}catch(e){console.log('HYP_RESULT '+JSON.stringify({status:'worker_error',pass:false,error:String(e)}));process.exitCode=1}}else main().catch(e=>{console.error(e);process.exitCode=1});
