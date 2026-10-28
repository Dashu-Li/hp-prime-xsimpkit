'use strict';
// Final public entry integration. Loads src only; never redefines with candidate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime}=require('./runtime_loader.cjs');
const {executeChild}=require('../tools/benchmark.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/hyperbolic-pairs-20261026'));
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),q=s=>JSON.stringify(s);
const real=fs.readFileSync(path.join(ROOT,'candidates/user-exp-result.cas'),'utf8').trim();
const target='(exp(q*x)-exp(-q*x))/(exp(q*t)-exp(-q*t))';
const gains=['sinh(x)+i*sin(i*x)','cosh(x)^2+sin(i*x)^2','cosh(x+y)-cos(i*x)*cosh(y)+i*sin(i*x)*sinh(y)'];
const cases=[
 ...['native','string','quote'].map(mode=>({id:'user_returned_'+mode,input:real,mode,gain:true,fixture:true})),
 ...['native','string','quote'].map(mode=>({id:'ratio_'+mode,input:target,mode,want:'sinh(q*x)/sinh(q*t)',gain:true})),
 {id:'short_sum',input:'exp(u)+exp(v)',mode:'string',unchanged:true},
 {id:'short_difference',input:'exp(u)-exp(v)',mode:'string',unchanged:true},
 {id:'short_ratio',input:'(exp(u)-exp(v))/(exp(w)-exp(z))',mode:'string',unchanged:true},
 {id:'imaginary_final_cos',input:'exp(i*x)+exp(-i*x)',mode:'string',want:'2*cos(x)',gain:true},
 {id:'list_elements',input:'[exp(q*x)+exp(-q*x),exp(q*x)-exp(-q*x)]',mode:'string',want:'[2*cosh(q*x),2*sinh(q*x)]'},
 {id:'matrix_elements',input:'[[exp(q*x)+exp(-q*x),0],[0,exp(q*x)-exp(-q*x)]]',mode:'string',want:'[[2*cosh(q*x),0],[0,2*sinh(q*x)]]'},
 ...gains.map((input,i)=>({id:'old_mixed_'+i,input,mode:'native',want:i===1?'1':'0'}))
];
function bindings(expr,list){let s=expr;for(let i=0;i<list.length;i+=2)s='subst('+s+','+list[i]+','+list[i+1]+')';return s;}
function worker(index){
 const c=cases[index];global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
 const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables(0)');
 const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8')),source=sources.join('\n\n');const loadEvidence=loadRuntime(ev,{root:ROOT,sources});
 if(ev('type(xshypcompact)')!=='DOM_FUNC'||ev('type(xsuend)')!=='DOM_FUNC')throw Error('final helper/hook missing in actual src');
 ev('zzhpubsentinel:=1729');ev('assume(zzhpubpositive>0)');
 const state=()=>({sentinel:ev('zzhpubsentinel'),assumption:ev('string(about(quote(zzhpubpositive)))'),angle:ev('angle_radian()'),complex:ev('complex_variables()')});
 const before=state();ev('zzhpubinput:=expr('+q('quote('+c.input+')')+')');
 const argument=c.mode==='string'?q(c.input):c.mode==='quote'?'quote('+c.input+')':c.input;
 const start=performance.now(),display=ev('zzhpuboutput:=XSIMP('+argument+')'),ms=performance.now()-start;
 const output=ev('string(zzhpuboutput)'),type=ev('type(zzhpuboutput)'),approx=ev('xsapproxstate(zzhpuboutput,0)'),input=ev('string(zzhpubinput)');
 const inputLength=Number(ev('size(string(zzhpubinput))')),outputLength=Number(ev('size(string(zzhpuboutput))'));
 const removed=Object.fromEntries(['XMSIMP','XMSCHECK','XDEEP','xssearch'].map(n=>[n,ev('type('+n+')')])),after=state();
 const checks=[];const check=(id,pass,details)=>checks.push({id,pass,details});
 check('state_unchanged',JSON.stringify(before)===JSON.stringify(after),{before,after});
 check('exact_result',approx==='0',{approx,type});check('not_error',type!=='DOM_STRING',{display});
 check('redundant_entrypoints_absent',Object.values(removed).every(t=>t==='DOM_IDENT'),removed);
 if(c.want){const expected=ev('string('+c.want+')');check('expected_result',output===expected,{expected,output});}
 if(c.unchanged)check('short_representation_retained',output===input,{input,output});
 if(c.gain)check('whole_result_shorter',outputLength<inputLength,{inputLength,outputLength});
 if(c.fixture){
  check('hyperbolic_output',/sinh|cosh/i.test(output),{output});
  const samples=[['a',2,'b',1,'c',3,'d',1,'s',5,'t',2,'x','1/3'],['a','1+i','b',2,'c','1-i','d','1/2','s','2+i','t',1,'x','1/3+i/4']];
  for(let i=0;i<samples.length;i++){
   const difference=ev('evalf(abs('+bindings('zzhpuboutput',samples[i])+'-'+bindings('zzhpubinput',samples[i])+'))');check('fixture_sample_'+i,Number.isFinite(Number(difference))&&Number(difference)<1e-8,{bindings:samples[i],difference});
  }
 }
 // Isolate the final-display selection contract on the same supplied tree.
 ev('zzhpubbase:=xspresent(zzhpubinput)');ev('zzhpubcandidate:=xspresent(xsuhypcandidate(zzhpubinput,0))');ev('zzhpubend:=xsuend(zzhpubinput)');
 const baseText=ev('string(zzhpubbase)'),candidateText=ev('string(zzhpubcandidate)'),endText=ev('string(zzhpubend)');
 const baseLen=Number(ev('size(string(zzhpubbase))')),candidateLen=Number(ev('size(string(zzhpubcandidate))'));
 check('final_display_length_selection',endText===(candidateLen<baseLen?candidateText:baseText),{baseLen,candidateLen,baseText,candidateText,endText});
 console.log('PUBLIC_RESULT '+JSON.stringify({id:c.id,loadEvidence,mode:c.mode,input,display,output,inputLength,outputLength,type,approx,ms,checks,pass:checks.every(x=>x.pass),sourceSha256:sha(source),modules:Object.fromEntries(MODS.map((n,i)=>[n,sha(sources[i])])),scope:'Upstream Giac HP mode, complex_variables(0); not native/G2'}));
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});const report={scope:'Actual src XSIMP public entry and final-display selection; no candidate redefinition and no ODE solving',cases:[]};
 const selected=cases.map((_,i)=>i).filter(i=>process.argv[2]!=='--single'||i===Number(process.argv[3]));
 for(let offset=0;offset<selected.length;offset+=2){
  const rows=await Promise.all(selected.slice(offset,offset+2).map(async i=>{
   const r=await executeChild([__filename,'--worker',String(i)],30000);let row;
   try{row=JSON.parse(r.stdout.split(/\r?\n/).find(x=>x.startsWith('PUBLIC_RESULT ')).slice(14))}catch{row={id:cases[i].id,status:'worker_error',pass:false,...r};}
   if(r.timedOut)row={id:cases[i].id,status:'timeout',pass:false,...r};return row;
  }));
  for(const row of rows){report.cases.push(row);console.log(row.id+': '+(row.pass?'PASS':'FAIL'));fs.writeFileSync(path.join(OUT,'public-runtime.json'),JSON.stringify(report,null,2)+'\n');}
 }
 report.summary={total:report.cases.length,passed:report.cases.filter(x=>x.pass).length,failed:report.cases.filter(x=>!x.pass).length};fs.writeFileSync(path.join(OUT,'public-runtime.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
}
if(process.argv[2]==='--worker'){try{worker(Number(process.argv[3]))}catch(e){console.log('PUBLIC_RESULT '+JSON.stringify({status:'worker_error',pass:false,error:String(e)}));process.exitCode=1}}else main().catch(e=>{console.error(e);process.exitCode=1});
