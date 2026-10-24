const fs=require('fs');
const cp=require('child_process');
const path=require('path');
const cases=[
 ['scalar trig identity','sin(x)^2+cos(x)^2'],
 ['scalar rational cancellation','(x^2-1)/(x-1)'],
 ['scalar radical cancellation','sqrt(8)-2*sqrt(2)'],
 ['scalar variable radical','sqrt(x^2)'],
 ['scalar complex quotient','(1+i)/(1-i)'],
 ['scalar Euler cancellation','(exp(i)+exp(-i))/2-cos(1)'],
 ['scalar special complex angle','exp(i*pi/3)'],
 ['scalar irrational power rewrite','exp((2-sqrt(3))*ln(2))'],
 ['scalar complex exponential preference','exp(i*ln(2))'],
 ['scalar variable real exponent','exp(t*ln(2))'],
 ['scalar real exponential pair','(exp(x)-exp(-x))/2'],
 ['list simplification','[sin(x)^2+cos(x)^2,(x^2-1)/(x-1)]'],
 ['matrix exp zero','exp([[0,0],[0,0]])'],
 ['matrix rotation exp','exp([[0,-1],[1,0]])'],
 ['matrix rotation parameter','exp(t*[[0,-1],[1,0]])'],
 ['matrix positive exp','exp([[1,1],[2,3]])'],
 ['matrix positive parameter','exp(t*[[1,1],[2,3]])'],
 ['matrix positive ln2','exp([[1,1],[2,3]]*ln(2))'],
 ['matrix imaginary Pauli','exp(i*[[0,1],[1,0]])'],
 ['matrix symbolic imaginary Pauli','exp(i*t*[[0,1],[1,0]])'],
 ['matrix Jordan exp','exp([[2,1],[0,2]])'],
 ['matrix variable Jordan exp','exp([[j,1],[0,j]])'],
 ['matrix nilpotent 3x3','exp([[0,1,0],[0,0,1],[0,0,0]])'],
 ['matrix sine','sin([[0,-1],[1,0]])','native operation may be elementwise'],
 ['matrix cosine','cos([[0,-1],[1,0]])','native operation may be elementwise'],
 ['matrix hyperbolic cosine','cosh([[0,-1],[1,0]])','native operation may be elementwise'],
 ['matrix nested exponential sum','exp([[0,-1],[1,0]])+exp([[0,1],[-1,0]])'],
 ['matrix original power','2^[[1,1],[2,3]]','native scalar-base matrix power semantics require checking'],
 ['matrix zero power','2^[[0,0],[0,0]]','native scalar-base matrix power semantics require checking'],
 ['matrix Jordan power','2^[[2,1],[0,2]]','native scalar-base matrix power semantics require checking'],
 ['matrix ordinary square','[[1,1],[2,3]]^2'],
 ['matrix Euler cancellation cells','[[(exp(i)+exp(-i))/2-cos(1),0],[0,1]]'],
 ['matrix scalar identity cells','[[sin(x)^2+cos(x)^2,0],[0,1]]'],
];
if(process.argv[2]==='--worker'){
 const index=Number(process.argv[3]); const [name,source,caution]=cases[index];
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
 global.alert=()=>{};
 const giac=require('../test_runtime/giac.js'); const ev=giac.cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');
 ev(['scalar','matrix','presentation','posthoc','unified'].map(x=>fs.readFileSync(path.join(__dirname,x+'.cas'),'utf8')).join('\n'));
 ev('xsparityzero(z):=BEGIN LOCAL k; IF type(z)==DOM_LIST THEN FOR k FROM 1 TO size(z) DO IF NOT xsparityzero(z[k]) THEN RETURN 0; END; END; RETURN 1; END; RETURN string(normal(z))=="0"; END;');
 const qcall=`XSIMP(${JSON.stringify(source)})`, ucall=`XSIMP(${source})`;
 const started=Date.now();
 const quoted=ev(qcall), unquoted=ev(ucall);
 const result={name,source,caution:caution||null,quoted,unquoted,quotedLength:quoted.length,unquotedLength:unquoted.length,ratio:quoted.length?unquoted.length/quoted.length:null,identical:quoted===unquoted};
 console.log('PARITY_PARTIAL '+JSON.stringify(result));
 ev('xsparityq:='+qcall);ev('xsparityu:='+ucall);
 result.quotedType=ev('type(xsparityq)');result.unquotedType=ev('type(xsparityu)');
 if(result.quotedType==='DOM_LIST') result.quotedShape=ev('[rowDim(xsparityq),colDim(xsparityq)]');
 if(result.unquotedType==='DOM_LIST') result.unquotedShape=ev('[rowDim(xsparityu),colDim(xsparityu)]');
 result.equivalence='unproven';
 if(result.quotedType==='DOM_STRING'||result.unquotedType==='DOM_STRING') result.equivalence='error/string result';
 else {
  let proof=ev('xsparityzero(normal(xsparityq-xsparityu))');
  if(proof!=='1') proof=ev('xsparityzero(simplify(pow2exp(xsparityq)-pow2exp(xsparityu)))');
  if(proof!=='1') proof=ev('xsparityzero(simplify(texpand(hyp2exp(pow2exp(xsparityq)))-texpand(hyp2exp(pow2exp(xsparityu)))))');
  if(proof==='1') result.equivalence='proved equal';
  else result.difference=ev('simplify(xsparityq-xsparityu)');
 }
 result.ms=Date.now()-started;console.log('PARITY_RESULT '+JSON.stringify(result));
 process.exit(0);
}
let next=0;const results=[];
async function worker(){
 while(next<cases.length){
  const index=next++;
  const record=await new Promise(resolve=>{
   const p=cp.spawn(process.execPath,[__filename,'--worker',String(index)],{stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';let timedOut=false;
   const timer=setTimeout(()=>{timedOut=true;p.kill('SIGKILL');},15000);
   p.stdout.on('data',d=>{stdout+=d});p.stderr.on('data',d=>{stderr+=d;if(stderr.length>20000)stderr=stderr.slice(-20000)});
   p.on('close',code=>{
    clearTimeout(timer);const lines=stdout.split('\n');
    const final=lines.findLast(x=>x.startsWith('PARITY_RESULT '));const partial=lines.findLast(x=>x.startsWith('PARITY_PARTIAL '));
    const r=final?JSON.parse(final.slice(14)):partial?JSON.parse(partial.slice(15)):{name:cases[index][0],source:cases[index][1]};
    if(!final)r.status=timedOut?'15s audit timeout':'runtime exited before completion';
    if(stderr.includes('Unable to find a single'))r.algebraicExtensionWarning=true;
    resolve({index,...r});
   });
  });
  results.push(record);console.log(JSON.stringify(record));
 }
}
Promise.all([worker(),worker()]).then(()=>{
 results.sort((a,b)=>a.index-b.index);
 const package_sha256=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'XSIMPKIT.txt'))).digest('hex');
 fs.writeFileSync(path.join(__dirname,'parity_results.json'),JSON.stringify({runtime:'Upstream Giac, calc_mode(-38), original one-based current1.7 modules; not HP firmware.',package_sha256,summary:{package_sha256,timeouts:results.filter(r=>r.status==='15s audit timeout').length},cases:results},null,2));
});
