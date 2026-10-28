'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/ode185/weighted')); 
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),truth=s=>s==='1'||s==='true';
const q=JSON.stringify,held=s=>'expr('+q('quote('+s+')')+')';
const groups=['selection','ode','protection'];
function worker(group){
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');ev('of:=1');ev('angle_radian(1)');ev('complex_mode(1)');ev('complex_variables(0)');
 const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
 const commandsPath=path.join(ROOT,'dist/v1.8.7-installer/installer_commands.json');process.env.XS_LOADER_COMMANDS=commandsPath;
 const loadEvidence=require(path.join(ROOT,'tests/runtime_loader.cjs')).loadRuntime(ev,{root:ROOT,sources});
 const rows=[],report={scope:'New ODE-result candidate: fresh upstream Giac HP runtime, actual rebuilt installer CAS commands only; not native PPL bridge or physical G2.',group,loadEvidence,sourceHashes:Object.fromEntries(MODS.map((n,i)=>[n+'.cas',sha(sources[i])])),rows};
 fs.mkdirSync(OUT,{recursive:true});
 function save(){report.summary={total:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length};fs.writeFileSync(path.join(OUT,group+'.json'),JSON.stringify(report,null,2)+'\n')}
 function check(id,command,want='1'){const start=Date.now(),actual=ev(command),pass=actual===want||want==='1'&&truth(actual);rows.push({id,command,actual,want,ms:Date.now()-start,pass});save();console.log('CHECK '+id+' '+pass)}
 const samples=[['positive_parameters','[2,1,2,3,1/3,2,5,2,3,2,3,4/5,-2]'],['negative_a_plus_b','[-3,1,2,3,2/3,2,5,2,3,2,3,4/5,-2]'],['complex_parameter','[2+i,1,2,3,1/3,2,5,2,3,2+i,3-i,4/5,-2+i]']];
 const symbols='[a,b,c,d,x,t,s,c_0,c_1,G0,G1,q,z]';
 function run(id,s,route='ordinary',{shorter=false,contains=null,numeric=true,symbolic=false}={}){
  ev('zzorprior:='+held(s));
  const arg=route==='string'?q(s):route==='quote'?held(s):s;
  const start=Date.now(),display=ev('zzorout:=XSIMP('+arg+')'),output=ev('string(zzorout)'),prior=ev('string(zzorprior)');
  const exact=ev('xsapproxstate(zzorout,0)'),kind=ev('type(zzorout)'),len=Number(ev('size(string(zzorout))')),priorLen=Number(ev('size(string(zzorprior))'));
  const checks={not_error:kind!=='DOM_STRING'&&display!=='undef',exact:exact==='0'};
  if(shorter)checks.shorter=len<priorLen;if(contains)checks.selected=contains.test(output);
  const proofs=[];
  if(numeric)for(const [name,values] of samples){const aa='subst(zzorout,'+symbols+','+values+')',bb='subst(zzorprior,'+symbols+','+values+')';const numericOutput=ev('zzorva:=evalf('+aa+')'),numericPrior=ev('zzorvb:=evalf('+bb+')');const command='evalf(abs(zzorva-zzorvb)/(1+abs(zzorva)+abs(zzorvb)))';const actual=ev(command),n=Number(actual),pass=Number.isFinite(n)&&n<1e-10;proofs.push({name,method:'Evaluate each side with evalf first; sampled normalized relative error abs(out-prior)/(1+abs(out)+abs(prior)), tolerance 1e-10; not symbolic proof',values,numericOutput,numericPrior,actual,pass});checks[name]=pass}
  if(symbolic){const actual=ev('normal(hyp2exp(zzorout)-hyp2exp(zzorprior))');proofs.push({method:'exact normal after hyp2exp',actual,pass:actual==='0'});checks.symbolic=actual==='0'}
  rows.push({id,route,input:s,display,output,prior,len,priorLen,exact,proofs,checks,ms:Date.now()-start,pass:Object.values(checks).every(Boolean)});save();console.log('CASE '+id+' '+rows.at(-1).pass+' len='+len+'/'+priorLen)
 }
 check('selfcheck','XSCHECK(0)','"XSIMP 1.8.7 CHECK OK"');
 if(group==='selection'){
  const U='(a^2+b^2+c^2+d^2)*x';
  run('arbitrary_weights_center','G0*exp(c*x/2+q*x)+G1*exp(c*x/2-q*x)');
  run('arbitrary_weights_long_center','G0*exp('+U+'+q*x)+G1*exp('+U+'-q*x)', 'string',{shorter:true});
  run('same_coefficient','G0*exp('+U+'+q*x)+G0*exp('+U+'-q*x)','quote',{shorter:true,contains:/cosh/i});
  run('opposite_coefficient','G0*exp('+U+'+q*x)-G0*exp('+U+'-q*x)','ordinary',{shorter:true,contains:/sinh/i});
  run('unequal_numeric_weights','2*exp('+U+'+q*x)+3*exp('+U+'-q*x)','string',{shorter:true});
  run('short_generic_kept','G0*exp(q*x)+G1*exp(-q*x)');
  run('weighted_principal_square_root_branch','G0*exp(a*x+sqrt(z^2+2*z+1)*x)+G1*exp(a*x-sqrt(z^2+2*z+1)*x)','string');
  run('weighted_principal_square_root_branch_held','G0*exp(sqrt(z^2+2*z+1)*x)+G1*exp(-sqrt(z^2+2*z+1)*x)','quote');
  run('pure_imaginary_pair','exp(a+i*b)-exp(a-i*b)','string',{contains:/sin\(/i});
  run('exact_complex_principal_root','sqrt(4-2*i)','string');check('complex_principal_root_squared','normal(zzorout^2-(4-2*i))','0');check('complex_principal_root_sign','re(evalf(zzorout))>0 AND im(evalf(zzorout))<0');
 }
 if(group==='ode'){
  const raw=ev("desolve((a+b)*y''-c*(a+b)*y'-b*d*(d+c)*y=0)"),s=JSON.parse(ev('string('+raw+')'));
  report.desolve={command:"desolve((a+b)*y''-c*(a+b)*y'-b*d*(d+c)*y=0)",raw};
  for(const route of ['ordinary','quote','string'])run('screenshot_general_'+route,s,route,{shorter:true});
  const fixture=fs.readFileSync(path.join(ROOT,'candidates/user-exp-result.cas'),'utf8').trim();
  for(const route of ['ordinary','quote','string'])run('prior_boundary_'+route,fixture,route,{shorter:true,contains:/sinh/i});
 }
 if(group==='protection'){
  for(const [id,s] of [['coefficient_hole','c/c*(exp(q*x)-exp(-q*x))'],['inside_exp_hole','exp(c/c*x)+exp(-c/c*x)'],['weighted_inside_exp_hole','G0*exp(c/c*x)+G1*exp(-c/c*x)'],['weighted_coefficient_hole','G0*c/c*exp(a*x+q*x)+G1*exp(a*x-q*x)'],['nested_root_hole','exp(sqrt(c/c)*x)+exp(-sqrt(c/c)*x)']]){
   const h=held(s);check(id+'_private_hole_gate','xsuholegate('+h+',xshypcompact('+h+'))');check(id+'_private_exact','xsapproxstate(xshypcompact('+h+'),0)','0');
  }
  for(const [id,old,next,want] of [
    ['scaled_polynomial_hole','1/(2*a+2*b)','1/(2*(a+b))','1'],
    ['negative_rational_unit','1/(2*a+2*b)','-1/(3*(a+b))','1'],
    ['retained_multiple','1/(a+b)','1/((a+b)*(c+d))','1'],
    ['lost_polynomial_hole','1/(a+b)','1','0'],
    ['lost_factor_hole','1/((a+b)*(c+d))','1/(a+b)','0'],
    ['nonzero_numeric_only','1/2','1','1']])check(id,'xsuholegate('+held(old)+','+held(next)+')',want);
  ev('xsppimagatom:=83');ev('xsppimagatomx:=97');ev('xshypangleaux:=101');ev('zzorsentinel:=1729');ev('assume(zzorpositive>0)');ev('zzorfunc(z):=z+1');
  const state=()=>({slot:ev('xsppimagatom'),slotx:ev('xsppimagatomx'),angleAux:ev('xshypangleaux'),sentinel:ev('zzorsentinel'),assumption:ev('sign(zzorpositive)'),func:ev('zzorfunc(2)'),index:ev('([17,23])[1]'),angle:ev('angle_radian()'),complex:ev('complex_mode()'),variables:ev('complex_variables()')});
  const before=state();run('bound_placeholder_imaginary','exp(a+i*b)-exp(a-i*b)','string',{contains:/sin\(/i});run('bound_angle_aux_principal_root','G0*exp(a*x+sqrt(z^2+2*z+1)*x)+G1*exp(a*x-sqrt(z^2+2*z+1)*x)','quote');const after=state();rows.push({id:'bound_placeholder_and_external_state_preserved',before,after,pass:JSON.stringify(before)===JSON.stringify(after)});save();
  ev('zzormat:=XSIMP("exp(i*x*[[0,1],[1,0]])")');check('matrix_exact','xsapproxstate(zzormat,0)','0');check('matrix_identity','normal(zzormat-[[cos(x),i*sin(x)],[i*sin(x),cos(x)]])','[[0,0],[0,0]]');
  ev('zzorroot:=XSIMP("sqrt(4-2*i)")');check('principal_root_exact','xsapproxstate(zzorroot,0)','0');check('principal_root_sign','re(evalf(zzorroot))>0 AND im(evalf(zzorroot))<0');
 }
 report.sourcesUnchanged=MODS.every((n,i)=>sha(fs.readFileSync(path.join(ROOT,'src',n+'.cas')))==sha(sources[i]));save();console.log('SUMMARY '+JSON.stringify(report.summary));if(report.summary.failed||!report.sourcesUnchanged)process.exitCode=1;
}
async function main(){fs.mkdirSync(OUT,{recursive:true});const results=[];for(const group of groups){const start=Date.now();const child=cp.spawnSync(process.execPath,[__filename,'--worker',group],{timeout:30000,encoding:'utf8',maxBuffer:4*1024*1024,env:process.env});fs.writeFileSync(path.join(OUT,group+'.log'),child.stdout+'\n'+child.stderr);results.push({group,status:child.status,signal:child.signal,error:child.error&&String(child.error),ms:Date.now()-start,report:fs.existsSync(path.join(OUT,group+'.json'))?JSON.parse(fs.readFileSync(path.join(OUT,group+'.json'))).summary:null});console.log(JSON.stringify(results.at(-1)))}const passed=results.every(x=>x.status===0&&x.report&&x.report.failed===0);fs.writeFileSync(path.join(OUT,'SUMMARY.json'),JSON.stringify({root:ROOT,scope:'Fresh actual rebuilt185 command load for each group; not inherited integration184 test passes.',results,passed},null,2)+'\n');if(!passed)process.exitCode=1}
if(process.argv[2]==='--worker'){try{worker(process.argv[3])}catch(e){console.error(e);process.exitCode=1}}else main().catch(e=>{console.error(e);process.exitCode=1});
