'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..'),OUT=__dirname,MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);ev('calc_mode(-38)');ev('of:=1');ev('angle_radian(1)');ev('complex_mode(1)');ev('complex_variables(0)');
ev('zzqsentinel:=1729');ev('zzqbound:=7');ev('assume(zzqpositive>0)');ev('zzqcalls:=0');ev('zzqf(zzarg):=BEGIN zzqcalls:=zzqcalls+1; RETURN zzarg; END;');
const state=()=>({sentinel:ev('zzqsentinel'),bound:ev('zzqbound'),assumption:ev('string(about(quote(zzqpositive)))'),calls:ev('zzqcalls'),angle:ev('angle_radian()'),cm:ev('complex_mode()'),cv:ev('complex_variables()')});
const before=state(),sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
process.env.XS_LOADER_COMMANDS=path.join(ROOT,'dist/v1.8.7-installer/installer_commands.json');
const {loadRuntime}=require(path.join(ROOT,'tests/runtime_loader.cjs'));
const loadEvidence=loadRuntime(ev,{root:ROOT,sources});
const cases=[
 ['selfcheck','XSCHECK(0)',r=>r==='"XSIMP 1.8.7 CHECK OK"'],
 ['diag_version','XSDIAG(0)[1]',r=>r==='"1.8.7"'],
 ['target_ordinary','XSIMP(e^(a+b*i)-e^(a-b*i))',r=>/sin\(b\)/.test(r)&&!/sinh/i.test(r)],
 ['target_string','XSIMP("exp(a+i*b)-exp(a-i*b)")',r=>/sin\(b\)/.test(r)&&!/sinh/i.test(r)],
 ['target_quote','XSIMP(quote(exp(a+i*b)-exp(a-i*b)))',r=>/sin\(b\)/.test(r)&&!/sinh/i.test(r)],
 ['target_long_identifiers','XSIMP("exp(xsmpchecku+i*xsmpcheckv)-exp(xsmpchecku-i*xsmpcheckv)")',r=>/sin\(xsmpcheckv\)/.test(r)&&!/sinh/i.test(r)],
 ['real_hyperbolic','XSIMP("exp(a+b)-exp(a-b)")',r=>/sinh\(b\)/.test(r)],
 ['inner_sinh_hole','xsuholegate(quote(sinh(c/c*i*b)),xspresent(quote(sinh(c/c*i*b))))',r=>['1','true'].includes(r)],
 ['inner_cosh_hole','xsuholegate(quote(cosh(c/c*i*b)),xspresent(quote(cosh(c/c*i*b))))',r=>['1','true'].includes(r)],
 ['sin_hole','xsuholegate(quote(sinh(sin(c)/sin(c)*i*b)),xspresent(quote(sinh(sin(c)/sin(c)*i*b))))',r=>['1','true'].includes(r)],
 ['outer_hole','xsuholegate(quote(c/c*sinh(i*b)),xspresent(quote(c/c*sinh(i*b))))',r=>['1','true'].includes(r)],
 ['complex_root_exact','xsapproxstate(xspresent(quote(sqrt(4-2*i))),0)',r=>r==='0'],
 ['complex_root_held','string(xspresent(quote(sqrt(4-2*i))))',r=>!/[0-9]\.[0-9]/.test(r)],
 ['unknown_held','string(xspresent(quote(zzqfn("data",i*b))))',r=>r===ev('string(quote(zzqfn("data",i*b)))')],
 ['known_action_held','string(xspresent(quote(zzqf(i*b))))',r=>r===ev('string(quote(zzqf(i*b)))')],
 ['marker_data','xsphold("\\\"@@XSIMP_I@@ data\\\"")',r=>r==='"@@XSIMP_I@@ data"'],
 ['exact_atom_parts','[type(re(xsphold("@@XSIMP_I@@"))),type(im(xsphold("@@XSIMP_I@@")))]',r=>r==='[DOM_INT,DOM_INT]'],
 ['matrix_exact','xsapproxstate(XSIMP("exp(i*[[0,1],[1,0]])"),0)',r=>r==='0'],
 ['matrix_diagonal','normal(XSIMP("exp(i*[[0,1],[1,0]])")[1,1]-cos(1))',r=>r==='0'],
 ['matrix_offdiagonal','normal(XSIMP("exp(i*[[0,1],[1,0]])")[1,2]-i*sin(1))',r=>r==='0']
];
const rows=[];for(const [id,command,want] of cases){let result,error=null,pass=false;try{result=ev(command);pass=want(result)}catch(e){error=String(e)}rows.push({id,command,result,error,pass});}

// Independent branch oracle: explicit principal-root values at the bindings,
// rather than a second call of the candidate simplifier on the reference.
const rootCases=[
 {id:'principal_factored_negative_z',radicand:'(z+1)^2',z:'-2',rootValue:'1',complexVariables:0},
 {id:'principal_expanded_negative_z',radicand:'z^2+2*z+1',z:'-2',rootValue:'1',complexVariables:0},
 {id:'principal_scaled_negative_z',radicand:'4*(z+1)^2',z:'-2',rootValue:'2',complexVariables:0},
 {id:'principal_complex_z',radicand:'(z+1)^2',z:'-2+i',rootValue:'1-i',complexVariables:1}
];
for(const fixture of rootCases){
 const prior=state(),priorCv=ev('complex_variables()');ev('complex_variables('+fixture.complexVariables+')');
 const command='XSIMP('+JSON.stringify('a*exp(sqrt('+fixture.radicand+')*x)+b*exp(-sqrt('+fixture.radicand+')*x)')+')';
 let display,error=null,numeric=null,checks={};
 try{
  display=ev('zzqbranchvalue:='+command);const approx=ev('xsapproxstate(zzqbranchvalue,0)');
  const bound='subst(subst(subst(subst(zzqbranchvalue,a,2),b,3),x,1/5),z,('+fixture.z+'))';
  const reference='2*exp(('+fixture.rootValue+')/5)+3*exp(-('+fixture.rootValue+')/5)';
  ev('zzqbranchactual:=evalf('+bound+')');ev('zzqbranchexpected:=evalf('+reference+')');
  const relativeError=ev('abs(zzqbranchactual-zzqbranchexpected)/max(1,abs(zzqbranchactual),abs(zzqbranchexpected))');
  numeric={bindings:{a:'2',b:'3',x:'1/5',z:fixture.z},principalRootValue:fixture.rootValue,referenceExpression:reference,actual:ev('string(zzqbranchactual)'),expected:ev('string(zzqbranchexpected)'),relativeError,tolerance:1e-10};
  checks={exact:approx==='0',numericPrincipalBranch:Number.isFinite(Number(relativeError))&&Number(relativeError)<1e-10};
 }catch(e){error=String(e);checks={runtime:false};}
 ev('complex_variables('+priorCv+')');checks.statePreserved=JSON.stringify(prior)===JSON.stringify(state());
 rows.push({...fixture,command,result:display,error,numeric,checks,pass:Object.values(checks).every(Boolean)});
}

const finalNames=JSON.parse(fs.readFileSync(process.env.XS_LOADER_COMMANDS,'utf8')).map(x=>x.name),types=finalNames.map(name=>({name,type:ev('type('+name+')')}));
const report={scope:'Fresh upstream Giac HP runtime; actualNEW105integrated1.8.7 installer commands only. No183 orpatchloading; not a native PPL/CAS bridge orphysicalG2 execution.',loadEvidence,moduleHashes:Object.fromEntries(MODS.map((n,i)=>[n+'.cas',sha(sources[i])])),types,state:{before,after:state()},rows,summary:{loadedDefinitions:loadEvidence.loadedFunctions,finalFunctionCount:types.length,allStoredFunctions:types.every(t=>t.type==='DOM_FUNC'),cases:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,statePreserved:JSON.stringify(before)===JSON.stringify(state())}};
report.pass=report.summary.allStoredFunctions&&report.summary.finalFunctionCount===105&&report.summary.failed===0&&report.summary.statePreserved;
fs.writeFileSync(path.join(OUT,'fresh-installer-runtime.json'),JSON.stringify(report,null,2)+'\n');console.log('FRESH_INSTALLER '+JSON.stringify(report.summary));for(const r of rows)if(!r.pass)console.log(JSON.stringify(r));if(!report.pass)process.exitCode=1;
