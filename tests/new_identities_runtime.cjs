'use strict';
// Isolated upstream-Giac HP-mode checks for the 1.8.7 installer commands.
// Numerical sides are evaluated separately; branch-sensitive checks never
// prove equality by squaring a radical or by simplifying the symbolic difference.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'), MODS=['scalar','matrix','presentation','posthoc','unified'];
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'validation/revision187/new-identities'));
const q=JSON.stringify, held=s=>'expr('+q('quote('+s+')')+')';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const truth=s=>s==='1'||s==='true';

function worker(cm,cv){
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
 for(const s of ['calc_mode(-38)','of:=1','angle_radian(1)','complex_mode('+cm+')','complex_variables('+cv+')'])ev(s);
 const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
 process.env.XS_LOADER_COMMANDS=path.join(ROOT,'dist/v1.8.7-installer/installer_commands.json');
 const loadEvidence=require('./runtime_loader.cjs').loadRuntime(ev,{root:ROOT,sources});
 const rows=[],report={scope:'Fresh upstream Giac HP mode, sequential commands from the actual 1.8.7 installer; neither PPL/CAS bridge nor physical G2.',flags:{complex_mode:cm,complex_variables:cv},loadEvidence,moduleHashes:Object.fromEntries(MODS.map((n,i)=>[n+'.cas',sha(sources[i])])),rows};
 const filename=path.join(OUT,'cm'+cm+'-cv'+cv+'.json');fs.mkdirSync(OUT,{recursive:true});
 function save(){report.summary={total:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length};fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');}
 function check(id,command,want='1'){
  const actual=ev(command),pass=actual===want||(want==='1'&&truth(actual));
  rows.push({id,command,actual,want,pass});save();console.log('CHECK '+id+' '+pass);
 }
 const state=()=>({cm:ev('complex_mode()'),cv:ev('complex_variables()'),angle:ev('angle_radian()'),index:ev('([17,23])[1]'),sentinel:ev('zznidsentinel'),assumption:ev('string(about(quote(zznidpositive)))')});
 ev('zznidsentinel:=1729');ev('assume(zznidpositive>0)');const before=state();
 function run(id,input,{route='string',shorter=false,notLonger=false,naturalArgument=null,shape=null,samples=[]}={}){
  const started=Date.now();ev('zznidprior:='+held(input));
  const argument=route==='string'?q(input):route==='quote'?held(input):input;
  const display=ev('zznidout:=XSIMP('+argument+')');
  const output=ev('string(zznidout)'),prior=ev('string(zznidprior)'),kind=ev('type(zznidout)'),exact=ev('xsapproxstate(zznidout,0)');
  const len=Number(ev('size(string(zznidout))')),priorLen=Number(ev('size(string(zznidprior))'));
  const checks={notError:kind!=='DOM_STRING'&&display!=='undef'&&!/Error|error/.test(display),exact:exact==='0'};
  if(shorter)checks.shorter=len<priorLen;if(notLonger)checks.notLonger=len<=priorLen;
  if(naturalArgument){
   checks.naturalExponential=truth(ev('xshypnatural(zznidout)'));
   if(checks.naturalExponential){const actualArgument=ev('string(xshyparg(zznidout))'),expectedArgument=ev('string('+naturalArgument+')');checks.combinedArgument=actualArgument===expectedArgument||ev('normal(xshyparg(zznidout)-('+naturalArgument+'))')==='0';}
   else checks.combinedArgument=false;
  }
  if(shape)checks.shape=shape({ev,output,prior});
  const numerical=[];
  for(const sample of samples){
   // Substitute each side independently, then evalf each side independently.
   // References are explicit mathematical expressions, never XSIMP outputs.
   const actual=ev('zznidva:=evalf(subst('+(sample.target||'zznidout')+','+(sample.symbols||'[a]')+','+sample.values+'))');
   const expected=ev('zznidvb:=evalf('+sample.reference+')');
   const errorText=ev('evalf(abs(zznidva-zznidvb)/(1+abs(zznidva)+abs(zznidvb)))'),error=Number(errorText);
   const pass=Number.isFinite(error)&&error<1e-10;
   numerical.push({name:sample.name,values:sample.values,symbols:sample.symbols||'[a]',actual,reference:sample.reference,expected,normalizedRelativeError:errorText,pass});checks[sample.name]=pass;
  }
  rows.push({id,route,input,display,output,prior,len,priorLen,exact,kind,numerical,checks,ms:Date.now()-started,pass:Object.values(checks).every(Boolean)});save();console.log('CASE '+id+' '+rows.at(-1).pass+' len='+len+'/'+priorLen);
 }
 check('installer_selfcheck','XSCHECK(0)','"XSIMP 1.8.7 CHECK OK"');
 const ordinaryA=[['positive','1/3'],['negative','-2'],['complex','1/3+2*i']];
 for(const [suffix,n,reference] of [['square',2,'i*a'],['negative_square',-2,'-i*a'],['cube',3,'3*i*a/2']]){
  run('exp_integer_'+suffix,'(exp(i*a/2))^('+n+')',{shorter:true,naturalArgument:reference,samples:ordinaryA.map(([name,value])=>({name,values:'['+value+']',reference:'exp(('+reference.replace(/\ba\b/g,'('+value+')')+'))'}))});
 }
 run('noninteger_exp_principal_branch','(exp(i*a))^(1/2)',{notLonger:true,samples:[
  {name:'two_pi',values:'[2*pi]',reference:'1'},
  {name:'three_halves_pi',values:'[3*pi/2]',reference:'(1-i)/sqrt(2)'},
  {name:'complex',values:'[3*pi/2+i/3]',reference:'exp(-1/6)*(1-i)/sqrt(2)'}
 ]});
 run('sqrt_natural_exp_preserves_branch','sqrt(exp(i*a))',{notLonger:true,samples:[
  {name:'two_pi',values:'[2*pi]',reference:'1'},
  {name:'three_halves_pi',values:'[3*pi/2]',reference:'(1-i)/sqrt(2)'},
  {name:'complex',values:'[3*pi/2+i/3]',reference:'exp(-1/6)*(1-i)/sqrt(2)'}
 ]});
 run('third_root_natural_exp_preserves_branch','(exp(i*a))^(1/3)',{notLonger:true,samples:[
  {name:'two_pi',values:'[2*pi]',reference:'1'},
  {name:'three_halves_pi',values:'[3*pi/2]',reference:'sqrt(3)/2-i/2'},
  {name:'complex',values:'[3*pi/2+i/3]',reference:'exp(-1/9)*(sqrt(3)/2-i/2)'}
 ]});
 run('integer_exp_keeps_cancelled_hole','(exp(i*a*c/(2*c)))^2',{samples:[{name:'nonzero_c',symbols:'[a,c]',values:'[1/3,2]',reference:'exp(i/3)'}],shape:({ev})=>truth(ev('xsuholegate(zznidprior,zznidout)'))});
 const trigSamples=[
  {name:'negative_cos_pi',values:'[pi]',reference:'-i'},
  {name:'positive_cos_pi_over_three',values:'[pi/3]',reference:'1/sqrt(2)'},
  ...['1/3+i/5','2+3*i/5','-2-i/4'].map((v,k)=>({name:'complex_'+k,values:'['+v+']',reference:'sqrt(cos(3*('+v+'))+3*cos('+v+'))/(2*cos('+v+'))'}))
 ];
 const rootShape=({ev})=>truth(ev('xsuholegate(zznidprior,zznidout)'))&&/cos\(a\)\^3/.test(ev('string(zznidout)'));
 for(const route of ['string','quote'])run('triple_angle_principal_root_'+route,'sqrt(cos(3*a)+3*cos(a))/(2*cos(a))',{route,shorter:true,shape:rootShape,samples:trigSamples});
 run('existing_cos_cube_root_preserved','sqrt(cos(a)^3)/cos(a)',{notLonger:true,shape:rootShape,samples:trigSamples});
 run('rational_trig_radicand_domain','sqrt((cos(3*a)+3*cos(a))/(4*cos(a)^2))',{notLonger:true,shape:({ev})=>truth(ev('xsuholegate(zznidprior,zznidout)')),samples:[
  {name:'negative_cos',values:'[pi]',reference:'i'},
  {name:'positive_cos',values:'[pi/3]',reference:'1/sqrt(2)'},
  {name:'complex',values:'[2+i/4]',reference:'sqrt((cos(3*(2+i/4))+3*cos(2+i/4))/(4*cos(2+i/4)^2))'}
 ]});
 run('triple_angle_matrix_entry','[[sqrt(cos(3*a)+3*cos(a))/(2*cos(a)),0],[0,1]]',{shorter:true,shape:({ev,output})=>ev('type(zznidout)')==='DOM_LIST'&&truth(ev('xsuholegate(zznidprior,zznidout)'))&&/cos\(a\)\^3/.test(output),samples:trigSamples.map(x=>({...x,target:'zznidout[1,1]'}))});
 run('integer_exp_matrix_entries','[[exp(i*a/2)^2,0],[0,exp(-i*a/2)^2]]',{shorter:true,shape:({ev})=>ev('type(zznidout)')==='DOM_LIST'&&truth(ev('xshypnatural(zznidout[1,1])'))&&truth(ev('xshypnatural(zznidout[2,2])'))&&ev('normal(zznidout-[[exp(i*a),0],[0,exp(-i*a)]])')==='[[0,0],[0,0]]'});
 run('short_input_retained','sin(a)+cos(a)',{notLonger:true,samples:[{name:'sample',values:'[1/3]',reference:'sin(1/3)+cos(1/3)'}]});
 run('matrix_exp_computed','exp(i*a*[[0,1],[1,0]])',{shape:({ev})=>ev('type(zznidout)')==='DOM_LIST'&&ev('normal(zznidout-[[cos(a),i*sin(a)],[i*sin(a),cos(a)]])')==='[[0,0],[0,0]]'});
 const general='c_0*exp((a*c+b*c+sqrt(a^2*c^2+2*a*b*c^2+4*a*b*c*d+4*a*b*d^2+b^2*c^2+4*b^2*c*d+4*b^2*d^2))*x/(2*a+2*b))+c_1*exp((a*c+b*c-sqrt(a^2*c^2+2*a*b*c^2+4*a*b*c*d+4*a*b*d^2+b^2*c^2+4*b^2*c*d+4*b^2*d^2))*x/(2*a+2*b))';
 const vals=['[2,1,2,3,1/3,2,3]','[-3,1,2,3,2/3,2,3]','[2+i,1,2,3,1/3,2,3]'];
 run('ode_arbitrary_weights_retained',general,{shorter:true,shape:({ev})=>truth(ev('xsuholegate(zznidprior,zznidout)')),samples:vals.map((v,k)=>({name:'parameters_'+k,symbols:'[a,b,c,d,x,c_0,c_1]',values:v,reference:'subst('+general+',[a,b,c,d,x,c_0,c_1],'+v+')'}))});
 const boundary=fs.readFileSync(path.join(ROOT,'candidates/user-exp-result.cas'),'utf8').trim();
 run('ode_boundary_pairing_retained',boundary,{shorter:true,shape:({output})=>/sinh\(/i.test(output),samples:[{name:'real_parameters',symbols:'[a,b,c,d,x,t,s]',values:'[2,1,2,3,1/3,2/3,5]',reference:'subst('+boundary+',[a,b,c,d,x,t,s],[2,1,2,3,1/3,2/3,5])'}]});
 const after=state();rows.push({id:'flags_and_external_state_preserved',before,after,pass:JSON.stringify(before)===JSON.stringify(after)});save();
 report.sourcesUnchanged=MODS.every((n,i)=>sha(fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'))===sha(sources[i]));
 save();console.log('SUMMARY '+JSON.stringify(report.summary));if(report.summary.failed||!report.sourcesUnchanged)process.exitCode=1;
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});
 const groups=[[0,0],[0,1],[1,0],[1,1]];
 const results=await Promise.all(groups.map(([cm,cv])=>new Promise(resolve=>{
  const started=Date.now(),name='cm'+cm+'-cv'+cv,log=fs.openSync(path.join(OUT,name+'.log'),'w');
  const child=cp.spawn(process.execPath,[__filename,'--worker',String(cm),String(cv)],{stdio:['ignore',log,log],env:process.env});
  const timer=setTimeout(()=>child.kill('SIGKILL'),45000);
  child.on('error',error=>{clearTimeout(timer);fs.closeSync(log);resolve({cm,cv,error:String(error),pass:false});});
  child.on('exit',(status,signal)=>{clearTimeout(timer);fs.closeSync(log);const file=path.join(OUT,name+'.json'),report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;resolve({cm,cv,status,signal,ms:Date.now()-started,summary:report?.summary,pass:status===0&&!!report&&report.summary.failed===0&&report.sourcesUnchanged});});
 })));
 const totals=results.reduce((r,x)=>({total:r.total+(x.summary?.total||0),passed:r.passed+(x.summary?.passed||0),failed:r.failed+(x.summary?.failed||0)}),{total:0,passed:0,failed:0});
 const pass=results.every(x=>x.pass);fs.writeFileSync(path.join(OUT,'SUMMARY.json'),JSON.stringify({scope:'Four fresh upstream-Giac HP runtime processes with actual 1.8.7 installer commands; not native/G2.',results,totals,pass},null,2)+'\n');console.log(JSON.stringify({results,totals,pass},null,2));if(!pass)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(Number(process.argv[3]),Number(process.argv[4]));}catch(e){console.error(e);process.exitCode=1;}}else main().catch(e=>{console.error(e);process.exitCode=1;});
