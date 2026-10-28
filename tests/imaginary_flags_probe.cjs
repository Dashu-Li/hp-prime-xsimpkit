'use strict';
// Four explicit Giac flag combinations; UI checkbox mapping is not assumed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime}=require('./runtime_loader.cjs');
const ROOT=path.resolve(__dirname,'..'),MODS=['scalar','matrix','presentation','posthoc','unified'];
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/imaginary-alias-20261026/final183'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_mode(1)');ev('complex_variables(0)');
const source=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
const hashes=()=>Object.fromEntries(MODS.map(n=>[n+'.cas',sha(fs.readFileSync(path.join(ROOT,'src',n+'.cas')))]));
const beforeHash=hashes(),loadEvidence=loadRuntime(ev,{root:ROOT,sources:source});
ev('zzflagssentinel:=1729');ev('assume(zzflagspositive>0)');
const report={scope:'Actual 1.8.7 CAS source/installer commands in upstream Giac HP mode. Radians. The setters complex_mode and complex_variables are tested independently; this does not establish the precise mapping of the user device checkboxes.',loadEvidence,moduleHashes:beforeHash,records:[]};
const state=()=>({angle:ev('angle_radian()'),complex_mode:ev('complex_mode()'),complex_variables:ev('complex_variables()'),sentinel:ev('zzflagssentinel'),assumption:ev('string(about(quote(zzflagspositive)))')});
for(const cm of [0,1])for(const cv of [0,1]){
 const setters={complex_mode:ev('complex_mode('+cm+')'),complex_variables:ev('complex_variables('+cv+')')},before=state(),cases=[];
 for(const command of ['XSIMP(e^(a+b*i)-e^(a-b*i))','XSIMP("e^(a+b*i)-e^(a-b*i)")','XSIMP(quote(e^(a+b*i)-e^(a-b*i)))','xspresent(expr("quote(2*exp(a)*SINH(i*b))"))']){
  const display=ev('zzflagsout:='+command),output=ev('string(zzflagsout)'),approx=ev('xsapproxstate(zzflagsout,0)'),type=ev('type(zzflagsout)');
  ev('zzflagsactual:=evalf(subst(subst(zzflagsout,a,2),b,1/2))');
  ev('zzflagsexpected:=evalf(exp(2)*(exp(i/2)-exp(-i/2)))');
  const error=ev('max(abs(re(zzflagsactual)-re(zzflagsexpected)),abs(im(zzflagsactual)-im(zzflagsexpected)))/max(1,abs(re(zzflagsactual)),abs(im(zzflagsactual)),abs(re(zzflagsexpected)),abs(im(zzflagsexpected)))');
  const checks={not_error:type!=='DOM_STRING',exact:approx==='0',trigonometric_form:/sin\(/i.test(output)&&!/sinh\(/i.test(output),numeric:Number.isFinite(Number(error))&&Number(error)<1e-10,state_preserved:JSON.stringify(before)===JSON.stringify(state())};
  cases.push({command,display,output,type,approx,numeric:{actual:ev('string(zzflagsactual)'),expected:ev('string(zzflagsexpected)'),basis:'exp(2)*(exp(i/2)-exp(-i/2))',relativeError:error},checks,pass:Object.values(checks).every(Boolean)});
 }
 report.records.push({complex_mode:cm,complex_variables:cv,setters,before,after:state(),cases,pass:before.complex_mode===String(cm)&&before.complex_variables===String(cv)&&cases.every(c=>c.pass)});
}
report.inputsUnchanged=JSON.stringify(beforeHash)===JSON.stringify(hashes());
report.summary={configurations:report.records.length,passed:report.records.filter(r=>r.pass).length,failed:report.records.filter(r=>!r.pass).length,calculations:report.records.flatMap(r=>r.cases).length};
report.pass=report.inputsUnchanged&&report.summary.failed===0;
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'complex-flags.json'),JSON.stringify(report,null,2)+'\n');
console.log('FLAGS_RESULT '+JSON.stringify(report.summary));if(!report.pass)process.exitCode=1;
