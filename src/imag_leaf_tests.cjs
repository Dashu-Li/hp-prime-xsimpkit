const fs=require('fs');const path=require('path');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
const giac=require('../test_runtime/giac.js');const ev=giac.cwrap('caseval','string',['string']);ev('calc_mode(-38)');
ev(['scalar','matrix','presentation','posthoc','unified'].map(x=>fs.readFileSync(path.join(__dirname,x+'.cas'),'utf8')).join('\n'));
const cases=[
 ['cosh rotation','XSIMP(cosh([[0,-1],[1,0]]))','[[cos(1),0],[0,cos(1)]]'],
 ['imaginary Pauli','XSIMP(exp(i*[[0,1],[1,0]]))','[[cos(1),i*sin(1)],[i*sin(1),cos(1)]]'],
 ['imaginary sinh leaf','xspresent(quote(-sinh(-i)))','i*sin(1)'],
 ['imaginary cosh leaf','xspresent(quote(cosh(-i)))','cos(1)'],
 ['symbolic odd cancellation','xspresent(quote(sin(-t)+sin(t)))','0'],
 ['symbolic even cancellation','xspresent(quote(cos(-t)-cos(t)))','0'],
 ['mixed real hyperbolic','xspresent(quote(cosh(2)+cosh(i)-cos(1)))','cosh(2)'],
 ['real matrix hyperbolic','XSIMP("exp([[1,1],[2,3]]*ln(2))")','4*(cosh(sqrt(3)*ln(2))*[[1,0],[0,1]]+sinh(sqrt(3)*ln(2))/sqrt(3)*[[-1,1],[2,1]])'],
 ['held irrational power','XSIMP("exp((2-sqrt(3))*ln(2))")','2^(2-sqrt(3))'],
];
const rows=[];
for(const [name,input,expected] of cases){
 const output=ev(input);const difference=ev(`simplify((${input})-(${expected}))`);
 const passed=difference==='0'||difference==='[[0,0],[0,0]]';
 const row={name,input,output,difference,passed};rows.push(row);console.log(JSON.stringify(row));
}
const untouched=ev('string(xspimagwalk(quote(cosh(t)+sinh(t)),0))==string(quote(cosh(t)+sinh(t)))');
const parity=ev('string(XSIMP(cosh([[0,-1],[1,0]])))==string(XSIMP("cosh([[0,-1],[1,0]])"))');
console.log(JSON.stringify({realHyperbolicUntouched:untouched,quotedUnquotedCoshIdentical:parity}));
fs.writeFileSync(path.join(__dirname,'imag_leaf_results.json'),JSON.stringify({runtime:'Upstream Giac, calc_mode(-38), original one-based modules; not HP firmware.',rows,realHyperbolicUntouched:untouched,quotedUnquotedCoshIdentical:parity},null,2));
process.exitCode=rows.every(x=>x.passed)&&untouched==='1'&&parity==='1'?0:1;
