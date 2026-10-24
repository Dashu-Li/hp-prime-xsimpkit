// Representation exactness and numerical correctness are separate assertions.
// Numeric references below use independent JavaScript complex arithmetic.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const C=(re,im=0)=>[re,im],add=(a,b)=>C(a[0]+b[0],a[1]+b[1]),neg=a=>C(-a[0],-a[1]);
const sub=(a,b)=>add(a,neg(b)),mul=(a,b)=>C(a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]);
const div=(a,b)=>{const d=b[0]*b[0]+b[1]*b[1];return C((a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d)};
const exp=a=>C(Math.exp(a[0])*Math.cos(a[1]),Math.exp(a[0])*Math.sin(a[1]));
const sqrt=a=>{const r=Math.hypot(...a);return C(Math.sqrt((r+a[0])/2),(a[1]<0?-1:1)*Math.sqrt((r-a[0])/2))};
const sin=a=>div(sub(exp(mul(C(0,1),a)),exp(mul(C(0,-1),a))),C(0,2));
const cos=a=>div(add(exp(mul(C(0,1),a)),exp(mul(C(0,-1),a))),C(2));
const A=[[C(1),C(0,-2)],[C(1,2),C(1)]],Ac=A.map(row=>row.map(a=>C(a[0],-a[1])));
function matrixExp(a,t){
 const mu=div(add(a[0][0],a[1][1]),C(2));
 const b=a.map((row,j)=>row.map((v,k)=>sub(v,j===k?mu:C(0))));
 const q=add(mul(b[0][0],b[0][0]),mul(b[0][1],b[1][0])),r=sqrt(q),u=mul(t,r);
 const ch=div(add(exp(u),exp(neg(u))),C(2)),sh=div(sub(exp(u),exp(neg(u))),C(2));
 return b.map((row,j)=>row.map((v,k)=>mul(exp(mul(t,mu)),add(j===k?ch:C(0),mul(div(v,r),sh)))));
}
function matrixTrig(a,isSin){const p=matrixExp(a,C(0,1)),m=matrixExp(a,C(0,-1));return p.map((row,j)=>row.map((v,k)=>div(isSin?sub(v,m[j][k]):add(v,m[j][k]),isSin?C(0,2):C(2))))}
const aText='[[1,-2*i],[1+2*i,1]]',sText='(sqrt(2+sqrt(5))-i*sqrt(sqrt(5)-2))',s=sqrt(C(4,-2));
const quote=x=>'XSIMP('+JSON.stringify(x)+')';
const cases=[
 {name:'screenshot quoted exp',source:quote('exp(i*([[1,0],[1,1]]+2*[[0,-i],[i,0]]))'),expected:matrixExp(A,C(0,1))},
 {name:'screenshot quoted e power',source:quote('e^(i*([[1,0],[1,1]]+2*[[0,-i],[i,0]]))'),expected:matrixExp(A,C(0,1))},
 {name:'direct XEXPT',source:`XEXPT(${aText},i)`,expected:matrixExp(A,C(0,1))},
 {name:'direct XEXP',source:`XEXP(i*${aText})`,expected:matrixExp(A,C(0,1))},
 {name:'conjugate exponential',source:quote('exp(-i*[[1,2*i],[1-2*i,1]])'),expected:matrixExp(Ac,C(0,-1))},
 {name:'positive scalar base complex matrix power',source:quote(`2^${aText}`),expected:matrixExp(A,C(Math.log(2)))},
 {name:'complex matrix sine',source:quote(`sin(${aText})`),expected:matrixTrig(A,true)},
 {name:'complex matrix cosine',source:quote(`cos(${aText})`),expected:matrixTrig(A,false)},
 {name:'quoted complex sqrt',source:quote('sqrt(4-2*i)'),expected:s,scalar:true},
 {name:'quoted complex half power',source:quote('(4-2*i)^(1/2)'),expected:s,scalar:true},
 {name:'quoted second-quadrant sqrt',source:quote('sqrt(-4+2*i)'),expected:sqrt(C(-4,2)),scalar:true},
 {name:'exact radical trigonometric product',source:quote(`cos(${sText})*exp(i)`),expected:mul(cos(s),exp(C(0,1))),scalar:true},
 {name:'direct exact radical trigonometric product',source:`XSIMP(cos(${sText})*exp(i))`,expected:mul(cos(s),exp(C(0,1))),scalar:true},
 {name:'floating matrix input stays approximate',source:'XEXPT([[1.0,-2.0*i],[1.0+2.0*i,1.0]],i)',expected:matrixExp(A,C(0,1)),approximate:true},
 {name:'native unquoted exponential has already lost exactness',source:`XSIMP(exp(i*${aText}))`,expected:matrixExp(A,C(0,1)),approximate:true,nativeBoundary:true},
];
const num=a=>`(${a[0].toPrecision(17)}+i*(${a[1].toPrecision(17)}))`;
if(process.argv[2]==='--worker'){
 const index=Number(process.argv[3]),c=cases[index];
 global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
 const g=require('../test_runtime/giac.js'),ev=g.cwrap('caseval','string',['string']);
 ev('calc_mode(-38)');
 const moduleText=['scalar','matrix','presentation','posthoc','unified'].map(x=>fs.readFileSync(path.join(__dirname,x+'.cas'),'utf8')).join('\n');
 const sourceSha256=crypto.createHash('sha256').update(moduleText).digest('hex');
 ev(moduleText);
 const started=Date.now(),display=ev('ceactual:='+c.source),output=ev('string(ceactual)'),detectedApproximate=ev('xsisapprox(ceactual)');
 // A second, independent textual check catches ordinary decimal/scientific
 // numeric tokens; no identifiers in these concrete outputs contain decimals.
 const floatToken=/\d+\.\d*|\.\d+|\d+[eE][+-]\d+/.test(output);
 const errors=c.scalar?[ev(`evalf(abs(ceactual-${num(c.expected)}))`)]:c.expected.flatMap((row,j)=>row.map((v,k)=>ev(`evalf(abs(ceactual[${j+1},${k+1}]-${num(v)}))`)));
 const numericError=Math.max(...errors.map(Number));
 const representationPass=c.approximate?detectedApproximate==='1'&&floatToken:detectedApproximate==='0'&&!floatToken;
 const numericPass=Number.isFinite(numericError)&&numericError<1e-10;
 const result={index,name:c.name,source:c.source,sourceSha256,display,output,detectedApproximate,floatToken,expectApproximate:!!c.approximate,representationPass,numericError,numericPass,errors,pass:representationPass&&numericPass,ms:Date.now()-started,validation:c.nativeBoundary?'Approximate native result retained; not counted as an exact symbolic result.':'Exactness is a representation assertion on stored value (not the CAS display, which may append a decimal preview); numerical agreement is checked independently and is not called a symbolic equality proof.'};
 console.log('RESULT '+JSON.stringify(result));process.exit(result.pass?0:1);
}
let next=0;const results=[];
async function run(){while(next<cases.length){const index=next++;const result=await new Promise(resolve=>{
 const p=cp.spawn(process.execPath,[__filename,'--worker',String(index)],{stdio:['ignore','pipe','pipe']});let out='',err='',timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;p.kill('SIGKILL')},30000);
 p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>{err=(err+b).slice(-1600)});
 p.on('close',code=>{clearTimeout(timer);const line=out.split('\n').findLast(x=>x.startsWith('RESULT '));resolve(line?JSON.parse(line.slice(7)):{index,name:cases[index].name,pass:false,status:timedOut?'30s timeout':'runtime exit '+code,stderrTail:err})});
 });results.push(result);console.log(JSON.stringify(result));}}
Promise.all([run(),run()]).then(()=>{results.sort((a,b)=>a.index-b.index);const summary={total:results.length,passed:results.filter(x=>x.pass).length,exactRepresentationAndNumeric:results.filter(x=>x.pass&&!x.expectApproximate).length,approximateSemantics:results.filter(x=>x.pass&&x.expectApproximate).length,failed:results.filter(x=>!x.pass).length};fs.writeFileSync(path.join(__dirname,'complex_exactness_results.json'),JSON.stringify({runtime:'Upstream Giac calc_mode(-38), original one-based modules; not physical HP firmware.',reference:'Independent JavaScript complex arithmetic and the 2x2 Cayley-Hamilton exponential formula. Numerical tolerance 1e-10. No numerical comparison is labeled an exact symbolic equality proof.',summary,cases:results},null,2)+'\n');console.log('SUMMARY '+JSON.stringify(summary));if(summary.failed)process.exitCode=1});
