'use strict';
// Bounded partial-polynomial factoring, through the actual installer commands.
// Numerical references are instantiated first and evaluated independently; a
// symbolic polynomial difference is used only for branch-free polynomial tests.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),MODS=['scalar','matrix','presentation','posthoc','unified'];
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'validation/revision187/partial-factor'));
const q=JSON.stringify,held=s=>'expr('+q('quote('+s+')')+')';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),truth=s=>s==='1'||s==='true';
const D='a^2*c^2+2*a*b*c^2+4*a*b*c*d+4*a*b*d^2+b^2*c^2+4*b^2*c*d+4*b^2*d^2';
const GENERAL='c_0*exp((a*c+b*c+sqrt('+D+'))*x/(2*a+2*b))+c_1*exp((a*c+b*c-sqrt('+D+'))*x/(2*a+2*b))';
const INDEPENDENT='exp(c*x/2)*(c_0*exp(sqrt((a+b)*(a*c^2+b*(c+2*d)^2))*x/(2*(a+b)))+c_1*exp(-sqrt((a+b)*(a*c^2+b*(c+2*d)^2))*x/(2*(a+b))))';
const NUMERIC=[
 {name:'positive_discriminant',values:['1','1','1','1','1/3','2','3']},
 {name:'negative_discriminant',values:['-2','1','1','1','2/3','2','3']},
 {name:'negative_parameter_sum',values:['-3','1','2','3','2/5','-1','4']},
 {name:'zero_discriminant',values:['0','1','-2','1','1/3','2','3']},
 {name:'complex_parameters',values:['i','1','1+i','-i','1/4+i/7','2-i','3+i']}
];
const SYMS=['a','b','c','d','x','c_0','c_1'];
const instantiate=(s,values)=>s.replace(/\b(?:c_0|c_1|a|b|c|d|x)\b/g,name=>'('+values[SYMS.indexOf(name)]+')');

function worker(cm,cv){
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
 for(const s of ['calc_mode(-38)','of:=1','angle_radian(1)','complex_mode('+cm+')','complex_variables('+cv+')'])ev(s);
 const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
 if(!process.env.XS_LOADER_COMMANDS)process.env.XS_LOADER_COMMANDS=path.join(ROOT,'dist/v1.8.7-installer/installer_commands.json');
 const loadEvidence=require('./runtime_loader.cjs').loadRuntime(ev,{root:ROOT,sources});
 const rows=[],report={scope:'Fresh upstream Giac HP-mode process, sequential CAS commands of the actual installer; not the PPL/CAS bridge or physical G2.',flags:{complex_mode:cm,complex_variables:cv},loadEvidence,moduleHashes:Object.fromEntries(MODS.map((n,i)=>[n+'.cas',sha(sources[i])])),rows};
 const filename=path.join(OUT,'cm'+cm+'-cv'+cv+'.json');fs.mkdirSync(OUT,{recursive:true});
 function save(){report.summary={total:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length};fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');}
 function record(row){rows.push(row);save();console.log('CASE '+row.id+' '+row.pass);}
 function check(id,command,want='1'){
  const actual=ev(command),pass=actual===want||(want==='1'&&truth(actual));record({id,command,actual,want,pass});
 }
 ev('zzpfsentinel:=1729');ev('zzpfbound:=7');ev('assume(zzpfpositive>0)');
 ev('zzpfuserfunc(z):=z+1');
 const state=()=>({sentinel:ev('zzpfsentinel'),bound:ev('zzpfbound'),assumption:ev('string(about(quote(zzpfpositive)))'),func:ev('zzpfuserfunc(2)'),angle:ev('angle_radian()'),complex:ev('complex_mode()'),variables:ev('complex_variables()'),index:ev('([17,23])[1]')});
 const before=state();
 check('installer_selfcheck','XSCHECK(0)','"XSIMP 1.8.7 CHECK OK"');

 function polynomial(id,input,{shorter=true}={}){
  const start=Date.now();ev('zzpfprior:='+held(input));ev('zzpfout:=xspfpoly('+held(input)+',0)');
  const prior=ev('string(zzpfprior)'),output=ev('string(zzpfout)'),len=Number(ev('size(string(zzpfout))')),priorLen=Number(ev('size(string(zzpfprior))'));
  const identity=ev('ratnormal(zzpfout-zzpfprior)'),exact=ev('xsapproxstate(zzpfout,0)');
  const checks={exact:exact==='0',polynomialIdentity:identity==='0',notLonger:len<=priorLen};
  if(shorter){checks.shorter=len<priorLen;checks.grouped=/[+\-]/.test(output)&&(/[*)]\^|\*\(/.test(output)||/\([^)]*[+\-][^)]*\)\^/.test(output));}
  record({id,input,prior,output,len,priorLen,identity,exact,checks,ms:Date.now()-start,pass:Object.values(checks).every(Boolean)});
 }
 polynomial('expanded_discriminant_partial_factor',D);
 const renamed=D.replace(/\ba\b/g,'r').replace(/\bb\b/g,'s').replace(/\bc\b/g,'u').replace(/\bd\b/g,'v');
 polynomial('renamed_discriminant_not_hardcoded',renamed);
 polynomial('subset_of_sum_has_common_factor','a*c+a*d+b*c+b*d+q');
 polynomial('existing_short_polynomial_retained','a+b',{shorter:false});

 function run(id,input,{route='string',helper=false,shorter=false,notLonger=true,shape=null,samples=[],reference=null,target='zzpfout'}={}){
  const start=Date.now();ev('zzpfprior:='+held(input));
  const argument=route==='string'?q(input):route==='quote'?held(input):input;
  const command=helper?'xspfauto('+held(input)+')':'XSIMP('+argument+')';
  const display=ev('zzpfout:='+command),prior=ev('string(zzpfprior)'),output=ev('string(zzpfout)'),kind=ev('type(zzpfout)');
  const len=Number(ev('size(string(zzpfout))')),priorLen=Number(ev('size(string(zzpfprior))')),exact=ev('xsapproxstate(zzpfout,0)');
  const checks={notError:kind!=='DOM_STRING'&&display!=='undef'&&!/Error|error/.test(display),exact:exact==='0'};
  if(notLonger)checks.notLonger=len<=priorLen;if(shorter)checks.shorter=len<priorLen;
  if(shape)checks.shape=shape({ev,output,prior});
  const numerical=[];
  for(const sample of samples){
   const values=sample.values,ref=sample.reference||(reference?instantiate(reference,values):null);
   const symbols=sample.symbols||SYMS;
   const actual=ev('zzpfva:=evalf(subst('+target+',['+symbols.join(',')+'],['+values.join(',')+']))');
   const expected=ev('zzpfvb:=evalf('+ref+')');
   const relativeError=ev('evalf(abs(zzpfva-zzpfvb)/(1+abs(zzpfva)+abs(zzpfvb)))'),error=Number(relativeError),pass=Number.isFinite(error)&&error<1e-10;
   numerical.push({name:sample.name,symbols,values,actual,reference:ref,expected,relativeError,pass});checks[sample.name]=pass;
  }
  record({id,input,route,helper,command,display,prior,output,kind,len,priorLen,exact,numerical,checks,ms:Date.now()-start,pass:Object.values(checks).every(Boolean)});
 }
 const holeShape=({ev})=>truth(ev('xsuholegate(zzpfprior,zzpfout)'));
 const rootsCompacted=({ev})=>{
  const rootCount=Number(ev('size(xshyproots(zzpfout,0))'));
  if(rootCount<2)return false;
  let shortened=false;
  for(let k=2;k<=rootCount;k++){
   const length=Number(ev('size(string((xshyproots(zzpfout,0))['+k+']))'));
   if(length<D.length+6)shortened=true;
  }
  return shortened&&holeShape({ev});
 };
 const rootSamples=NUMERIC.map(s=>({...s,reference:instantiate('sqrt('+D+')',s.values)}));
 run('whole_principal_polynomial_root','sqrt('+D+')',{helper:true,shorter:true,shape:rootsCompacted,samples:rootSamples});
 for(const route of ['string','quote','ordinary'])run('public_ode_general_'+route,GENERAL,{route,shorter:true,shape:rootsCompacted,samples:NUMERIC,reference:INDEPENDENT});
 run('public_actual_desolve',"desolve((a+b)*y''-c*(a+b)*y'-b*d*(c+d)*y=0)",{route:'ordinary',notLonger:false,shape:rootsCompacted});
 run('polynomial_root_matrix_entries','[[sqrt('+D+'),0],[0,1]]',{helper:true,shorter:true,shape:({ev})=>ev('type(zzpfout)')==='DOM_LIST'&&truth(ev('xsuholegate(zzpfprior,zzpfout)')),samples:rootSamples,target:'zzpfout[1,1]'});
 run('original_symbolic_hole_retained','(a^2-b^2)/(a-b)',{helper:true,shape:holeShape,samples:[{name:'nonzero_denominator',symbols:['a','b'],values:['3','2'],reference:'5'}]});
 run('root_factor_hole_retained','sqrt('+D+')*(q-1)/(q-1)',{helper:true,shape:holeShape});
 run('noninteger_exp_power_preserves_branch','(exp(i*a))^(1/2)',{helper:true,samples:[{name:'two_pi',symbols:['a'],values:['2*pi'],reference:'1'},{name:'three_halves_pi',symbols:['a'],values:['3*pi/2'],reference:'(1-i)/sqrt(2)'}]});
 run('symbolic_square_root_sign_preserved','sqrt(a^2+2*a+1)',{helper:true,samples:[{name:'negative_root_base',symbols:['a'],values:['-3'],reference:'2'},{name:'complex_root_base',symbols:['a'],values:['-2+i'],reference:'1-i'}]});
 run('noninteger_cube_root_preserved','(a^2+2*a+1)^(1/3)',{helper:true,samples:[{name:'negative_base',symbols:['a'],values:['-3'],reference:'4^(1/3)'},{name:'complex_base',symbols:['a'],values:['-2+i'],reference:'(-2*i)^(1/3)'}]});
 run('exact_numeric_complex_root','sqrt(4-2*i)',{helper:true,samples:[{name:'principal_complex_value',symbols:[],values:[],reference:'sqrt(4-2*i)'}]});
 run('legacy_imaginary_exponential','exp(a+i*b)-exp(a-i*b)',{shape:({output})=>/sin\(/i.test(output),samples:[{name:'numeric',symbols:['a','b'],values:['1/3','2/3'],reference:'2*i*exp(1/3)*sin(2/3)'}]});
 run('legacy_integer_exp_combination','(exp(i*a/2))^2',{shorter:true,shape:({ev})=>truth(ev('xshypnatural(zzpfout)')),samples:[{name:'complex_a',symbols:['a'],values:['1+i'],reference:'exp(i*(1+i))'}]});

 // Direct helpers must decline assigned symbols without evaluating or purging
 // them. This deliberately bypasses normal public evaluation of a bound name.
 for(const fn of ['xspfpoly','xspfauto']){
  const input='zzpfbound*a+zzpfbound*b+a*c+b*c',arg=held(input),call=fn+'('+arg+(fn==='xspfpoly'?',0':'')+')';
  const prior=ev('string('+arg+')'),actual=ev('string('+call+')');
  record({id:fn+'_declines_assigned_symbols',input,prior,actual,pass:prior===actual});
 }
 const after=state();record({id:'flags_and_external_state_preserved',before,after,pass:JSON.stringify(before)===JSON.stringify(after)});
 report.sourcesUnchanged=MODS.every((n,i)=>sha(fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'))===sha(sources[i]));
 save();console.log('SUMMARY '+JSON.stringify(report.summary));if(report.summary.failed||!report.sourcesUnchanged)process.exitCode=1;
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});
 const results=await Promise.all([[0,0],[0,1],[1,0],[1,1]].map(([cm,cv])=>new Promise(resolve=>{
  const start=Date.now(),name='cm'+cm+'-cv'+cv,log=fs.openSync(path.join(OUT,name+'.log'),'w');
  const child=cp.spawn(process.execPath,[__filename,'--worker',String(cm),String(cv)],{stdio:['ignore',log,log],env:process.env});
  const timer=setTimeout(()=>child.kill('SIGKILL'),60000);
  child.on('error',error=>{clearTimeout(timer);fs.closeSync(log);resolve({cm,cv,error:String(error),pass:false});});
  child.on('exit',(status,signal)=>{clearTimeout(timer);fs.closeSync(log);const file=path.join(OUT,name+'.json'),report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;resolve({cm,cv,status,signal,ms:Date.now()-start,summary:report?.summary,pass:status===0&&!!report&&report.summary.failed===0&&report.sourcesUnchanged});});
 })));
 const totals=results.reduce((r,x)=>({total:r.total+(x.summary?.total||0),passed:r.passed+(x.summary?.passed||0),failed:r.failed+(x.summary?.failed||0)}),{total:0,passed:0,failed:0});
 const pass=results.every(x=>x.pass);fs.writeFileSync(path.join(OUT,'SUMMARY.json'),JSON.stringify({scope:'Four fresh upstream Giac HP runtime processes, actual installer CAS commands; no native/G2 claim.',results,totals,pass},null,2)+'\n');console.log(JSON.stringify({results,totals,pass},null,2));if(!pass)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(Number(process.argv[3]),Number(process.argv[4]));}catch(e){console.error(e);process.exitCode=1;}}else main().catch(e=>{console.error(e);process.exitCode=1;});
