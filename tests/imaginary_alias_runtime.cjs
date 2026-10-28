'use strict';
// Actual source/installer-command HOST regression. This never controls a G2.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime}=require('./runtime_loader.cjs');
const {executeChild}=require('../tools/benchmark.cjs');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/imaginary-alias-20261026'));
const BASE=path.join(ROOT,'candidates/imag182-baseline');
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),q=JSON.stringify;
const modes=[{name:'radians',n:1},{name:'degrees',n:0},{name:'gradians',n:2}];
const configurations=[0,1].flatMap(complex=>modes.map(angle=>({complex,...angle})));
const hypSin='(exp(i*b)-exp(-i*b))/2',hypCos='(exp(i*b)+exp(-i*b))/2';
const held=s=>'expr('+q('quote('+s+')')+')';
const fixtures=[
 ...['exp(a+b*i)-exp(a-b*i)','e^(a+b*i)-e^(a-b*i)'].flatMap((input,k)=>[
  {id:'public_'+k+'_ordinary',command:'XSIMP('+input+')',expected:'exp(a)*('+hypSin+')*2',sameRadians:true},
  {id:'public_'+k+'_string',command:'XSIMP('+q(input)+')',expected:'exp(a)*('+hypSin+')*2',sameRadians:true},
  {id:'public_'+k+'_quote',command:'XSIMP(quote('+input+'))',expected:'exp(a)*('+hypSin+')*2',sameRadians:true}
 ]),
 ...[
  ['upper_sinh','SINH(i*b)','sinh(i*b)',hypSin],
  ['upper_cosh','COSH(i*b)','cosh(i*b)',hypCos],
  ['upper_sinh_negative','SINH(-i*b)','sinh(-i*b)','-('+hypSin+')'],
  ['upper_prefactor','2*exp(a)*SINH(i*b)','2*exp(a)*sinh(i*b)','2*exp(a)*('+hypSin+')'],
  ['upper_inverse_prefactor','3*COSH(i*b)/exp(a)','3*cosh(i*b)/exp(a)','3*('+hypCos+')/exp(a)'],
  ['upper_list','[SINH(i*b),COSH(i*b)]','[sinh(i*b),cosh(i*b)]','['+hypSin+','+hypCos+']'],
  ['upper_matrix','[[SINH(i*b),0],[0,COSH(i*b)]]','[[sinh(i*b),0],[0,cosh(i*b)]]','[['+hypSin+',0],[0,'+hypCos+']]']
 ].map(([id,input,lower,expected])=>({id,input,lower,expected,command:'xspresent('+held(input)+')',canonical:true,alias:true})),
 ...['SINH','COSH'].flatMap(name=>[
  {id:'raw_'+name+'_imag',input:name+'(i*b)',command:'xspimagwalk('+held(name+'(i*b)')+',0)',expected:name==='SINH'?hypSin:hypCos,alias:true},
  {id:'public_'+name+'_imag',command:'XSIMP('+q('2*exp(a)*'+name+'(i*b)')+')',expected:'2*exp(a)*('+(name==='SINH'?hypSin:hypCos)+')',alias:true,upstreamAngle:name}
 ]),
 ...[
  ['lower_sinh','sinh(i*b)',hypSin],['lower_cosh','cosh(i*b)',hypCos],
  ['lower_neg_sinh','sinh(-i*b)','-('+hypSin+')'],
  ['lower_prefactor','2*exp(a)*sinh(i*b)','2*exp(a)*('+hypSin+')']
 ].map(([id,input,expected])=>({id,input,expected,command:'xspresent('+held(input)+')',sameRadians:true})),
 ...[
  ['hole_c_prefix','c/c*SINH(i*b)'],['hole_c_suffix','SINH(i*b)*(c/c)'],
  ['hole_sin_prefix','sin(c)/sin(c)*SINH(i*b)'],
  ['hole_shift','(c-1)/(c-1)*COSH(i*b)']
 ].map(([id,input])=>({id,input,command:'xsuend('+held(input)+')',hole:true,expected:input.replaceAll('SINH(i*b)','('+hypSin+')').replaceAll('COSH(i*b)','('+hypCos+')')})),
 ...[
  ['upper_hyp_pole_coefficient','SINH(1/c)*(exp(i*x)+exp(-i*x))'],
  ['upper_hyp_pole_denominator','(exp(i*x)+exp(-i*x))/SINH(1/c)']
 ].map(([id,input])=>({id,input,command:'xsuend('+held(input)+')',hole:true,expected:input.replaceAll('SINH','sinh')})),
 ...[
  ['upper_hyp_inside_exp','exp(SINH(1/c)+x)+exp(SINH(1/c)-x)'],
  ['upper_cosh_inside_exp','exp(COSH(1/c)+x)-exp(COSH(1/c)-x)']
 ].map(([id,input])=>({id,input,command:'xshypcompact('+held(input)+')',unchanged:true,same:true})),
 ...[
  ['unknown_call','zzaliasunknown(i*b)'],['mixed_case_unknown','SInH(i*b)'],
  ['defined_user_call','zzaliasuser(i*b)']
 ].map(([id,input])=>({id,input,command:'xspresent('+held(input)+')',unchanged:true,same:true})),
 {id:'literal_string',input:'"SINH(i*b) is data"',command:'xspresent("SINH(i*b) is data")',unchanged:true,same:true},
 {id:'symbolic_log_power',command:'XSIMP("exp((2-sqrt(3))*ln(2))")',expected:'2^(2-sqrt(3))',same:true},
 {id:'complex_root_exact',command:'XSIMP("sqrt(4-2*i)")',expected:'sqrt(4-2*i)',same:true},
 {id:'complex_root_hyperbolic',command:'xspresent('+held('SINH(i*sqrt(4-2*i))')+')',expected:'(exp(i*sqrt(4-2*i))-exp(-i*sqrt(4-2*i)))/2',alias:true,guarded:true},
 {id:'log_angle_hyperbolic',command:'xspresent('+held('SINH(i*sqrt(3)*ln(2))')+')',expected:'(exp(i*sqrt(3)*ln(2))-exp(-i*sqrt(3)*ln(2)))/2',alias:true}
];
function readSources(dir){return MODS.map(n=>fs.readFileSync(path.join(dir,n+'.cas'),'utf8'));}
function fingerprint(dir){return Object.fromEntries(MODS.map(n=>[n+'.cas',sha(fs.readFileSync(path.join(dir,n+'.cas')))]));}
function worker(variant,index){
 const mode=configurations[index],dir=variant==='baseline'?BASE:path.join(ROOT,'src');
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables('+mode.complex+')');
 const sources=readSources(dir),loadEvidence=loadRuntime(ev,{root:ROOT,sources,useCommands:variant==='candidate'});
 ev('angle_radian('+mode.n+')');
 ev('zzaliascounter:=0');ev('zzaliassentinel:=1729');ev('assume(zzaliaspositive>0)');
 ev('zzaliasuser(zzarg):=BEGIN zzaliascounter:=zzaliascounter+1; RETURN zzarg; END;');
 ev('zzaliaserr(zzleft,zzright):=BEGIN LOCAL zzk,zzr,zzv; IF type(zzleft)==DOM_LIST THEN IF type(zzright)<>DOM_LIST OR size(zzleft)<>size(zzright) THEN RETURN 1000000; END; zzr:=0; FOR zzk FROM 1 TO size(zzleft) DO zzv:=zzaliaserr(zzleft[zzk],zzright[zzk]); IF zzv>zzr THEN zzr:=zzv; END; END; RETURN zzr; END; zzv:=evalf(zzleft)-evalf(zzright); RETURN max(abs(re(zzv)),abs(im(zzv))); END;');
 ev('zzaliasnorm(zzvalue):=BEGIN LOCAL zzk,zzr,zzv; IF type(zzvalue)==DOM_LIST THEN zzr:=0; FOR zzk FROM 1 TO size(zzvalue) DO zzv:=zzaliasnorm(zzvalue[zzk]); IF zzv>zzr THEN zzr:=zzv; END; END; RETURN zzr; END; zzv:=evalf(zzvalue); RETURN max(abs(re(zzv)),abs(im(zzv))); END;');
 const state=()=>({angle:ev('angle_radian()'),straightAngle:ev('acos(-1)'),complex:ev('complex_variables()'),sentinel:ev('zzaliassentinel'),assumption:ev('string(about(quote(zzaliaspositive)))'),calls:ev('zzaliascounter'),userFunction:ev('string(about(quote(zzaliasuser)))')});
 const before=state(),rows=[];
 for(const c of fixtures){
  const display=ev('zzaliasout:='+c.command),output=ev('string(zzaliasout)'),type=ev('type(zzaliasout)'),approx=ev('xsapproxstate(zzaliasout,0)');
  const checks={not_error:type!=='DOM_STRING'||c.id==='literal_string',exact:c.id==='literal_string'||approx==='0'};
  let difference=null,canonical=null,hole=null,upstreamControl=null,numericEvidence=null;
  const bind=s=>'subst(subst(subst(subst('+s+',a,2),b,3/7),c,2),x,3/5)';
  if(c.expected){
   ev('zzaliasexpected:='+c.expected);
   const lhs=bind('zzaliasout'),rhs=bind('zzaliasexpected');
   const error='zzaliaserr('+lhs+','+rhs+')',scale='max(1,zzaliasnorm('+lhs+'),zzaliasnorm('+rhs+'))';
   difference=ev('('+error+')/('+scale+')');
   numericEvidence={referenceExpression:c.expected,bindings:{a:'2',b:'3/7',c:'2',x:'3/5'},actual:ev('string(evalf('+lhs+'))'),expected:ev('string(evalf('+rhs+'))'),componentAbsoluteError:ev(error),scale:ev(scale),relativeError:difference,tolerance:1e-10,method:'Evaluate each side separately, then max(abs(real difference),abs(imaginary difference)), scaled by max(1, component norm of actual, component norm of expected). Lists recurse.'};
   checks.independent_numeric=Number.isFinite(Number(difference))&&Number(difference)<1e-10;
   if(c.upstreamAngle&&mode.n!==1){
    const command='simplify(2*exp(a)*'+c.upstreamAngle.toLowerCase()+'(i*b))';
    ev('zzaliasupstream:='+command);
    upstreamControl={command,output:ev('string(zzaliasupstream)'),difference:ev('zzaliaserr('+bind('zzaliasupstream')+','+bind('zzaliasexpected')+')'),candidateDifference:ev('zzaliaserr('+bind('zzaliasout')+','+bind('zzaliasupstream')+')')};
   }
  }
  if(c.canonical){canonical=ev('string(xspresent('+held(c.lower)+'))');checks.canonical_alias=output===canonical;}
  if(c.unchanged){const original=c.id==='literal_string'?ev('string('+c.input+')'):ev('string('+held(c.input)+')');checks.unknown_or_data_unchanged=output===original;}
  if(c.hole){hole=ev('xsuholegate('+held(c.input)+',zzaliasout)');checks.denominator_preserved=['1','true'].includes(hole);}
  if(c.alias&&!c.hole&&!c.guarded&&mode.n===1){checks.no_hyperbolic_imaginary_head=!/sinh|cosh/i.test(output);}
  const after=state();checks.state_preserved=JSON.stringify(before)===JSON.stringify(after);
  rows.push({id:c.id,command:c.command,display,output,type,approx,difference,numericEvidence,canonical,hole,upstreamControl,checks,pass:Object.values(checks).every(Boolean)});
 }
 const aliasHeads={};
 for(const [name,want] of [['SINH','sinh'],['COSH','cosh'],['SIN','sin'],['COS','cos']]){
  const input=held(name+'(i*b)');aliasHeads[name]={headType:ev('type(xshead('+input+'))'),head:ev('string(xshead('+input+'))'),name:ev('xspunaryname(xshead('+input+'))'),want};
 }
 console.log('ALIAS_RESULT '+JSON.stringify({variant,mode,loadEvidence,sourceDirectory:dir,sourceSha256:sha(sources.join('\n\n')),moduleHashes:fingerprint(dir),state:{before,after:state()},rows,aliasHeads}));
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});
 const initial=fingerprint(path.join(ROOT,'src')),baseline=fingerprint(BASE);
 const report={scope:'Upstream Giac HP-mode source or installer CAS commands only, not PPL/CAS bridge or G2. Numeric values check the fixed sample a=2,b=3/7,c=2; they are not full symbolic/domain proofs.',initialModules:initial,baselineModules:baseline,workers:[]};
 for(let i=0;i<configurations.length;i++){
  const pair=await Promise.all(['baseline','candidate'].map(async variant=>{
   const raw=await executeChild([__filename,'--worker',variant,String(i)],45000);
   let row;try{row=JSON.parse(raw.stdout.split(/\r?\n/).findLast(s=>s.startsWith('ALIAS_RESULT ')).slice(13));}catch{row={variant,mode:configurations[i],workerError:true,...raw};}
   return row;
  }));
  report.workers.push(...pair);console.log(configurations[i].name+' complex'+configurations[i].complex+' complete');
  fs.writeFileSync(path.join(OUT,'imaginary-alias-runtime.json'),JSON.stringify(report,null,2)+'\n');
 }
 const comparisons=[];
 for(let i=0;i<configurations.length;i++){
  const b=report.workers[i*2],c=report.workers[i*2+1];
  if(!b.rows||!c.rows){comparisons.push({mode:configurations[i],pass:false,workerError:true});continue;}
  for(let j=0;j<fixtures.length;j++){
   const f=fixtures[j],old=b.rows[j],next=c.rows[j];
   const mustMatch=f.same||(f.sameRadians&&c.mode.n===1);
   const same=old.output===next.output&&old.type===next.type&&old.approx===next.approx;
   const blocked=f.upstreamAngle&&c.mode.n!==1&&!next.pass&&!old.pass&&same&&next.upstreamControl&&
    Number(next.upstreamControl.candidateDifference)<1e-10&&Number(next.upstreamControl.difference)>1e-10&&
    Object.entries(next.checks).every(([k,v])=>k==='independent_numeric'||v);
   const pass=!blocked&&next.pass&&(!mustMatch||same);
   comparisons.push({mode:c.mode,id:f.id,candidatePass:next.pass,baselinePass:old.pass,mustMatchBaseline:mustMatch,baselineIdentical:same,status:blocked?'known_preexisting_nonradian_value_failure':pass?'passed':'failed',pass});
  }
 }
 report.inputsUnchanged=JSON.stringify(initial)===JSON.stringify(fingerprint(path.join(ROOT,'src')))&&JSON.stringify(baseline)===JSON.stringify(fingerprint(BASE));
 report.comparisons=comparisons;
 report.summary={total:comparisons.length,passed:comparisons.filter(r=>r.pass).length,knownPreexistingNonradianValueFailures:comparisons.filter(r=>r.status==='known_preexisting_nonradian_value_failure').length,unexpectedFailures:comparisons.filter(r=>r.status==='failed').length,baselineAssertionFailures:comparisons.filter(r=>r.baselinePass===false).length};
 report.allCasesPassed=report.summary.passed===report.summary.total;
 report.noUnexpectedRegressions=report.inputsUnchanged&&report.summary.unexpectedFailures===0;
 report.pass=report.allCasesPassed&&report.inputsUnchanged;
 fs.writeFileSync(path.join(OUT,'imaginary-alias-runtime.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.summary));if(!report.noUnexpectedRegressions)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(process.argv[3],Number(process.argv[4]));}catch(error){console.log('ALIAS_RESULT '+JSON.stringify({workerError:true,error:String(error)}));process.exitCode=1;}}else main().catch(e=>{console.error(e);process.exitCode=1;});
