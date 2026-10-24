const fs=require('fs');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
global.alert=x=>process.stderr.write(String(x).slice(0,200)+'\n');
const g=require('../test_runtime/giac.js');
const ev=g.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
ev(['scalar','matrix','presentation','posthoc','unified'].map(x=>fs.readFileSync(__dirname+'/'+x+'.cas','utf8')).join('\n'));
const cases=[
 ['user irrational e-power','XSIMP("e^((2-sqrt(3))*ln(2))")',s=>!s.includes('exp(')&&!s.includes('e^')&&s.includes('2^')],
 ['user imaginary Pauli exponential','XSIMP("e^(i*[[0,1],[1,0]])")',s=>!s.includes('cosh(')&&!s.includes('sinh(')&&s.includes('cos(1)')&&s.includes('sin(1)')],
 ['user base-two matrix power','XSIMP("2^[[1,1],[2,3]]")',s=>!s.includes('exp(')&&!s.includes('e^')&&s.includes('cosh(')&&s.includes('sinh(')],
 ['imaginary parameter','XSIMP("exp(i*t*[[0,1],[1,0]])")',s=>!s.includes('cosh(')&&!s.includes('sinh(')&&s.includes('cos(t)')&&s.includes('sin(t)')]
];
const results=[];
for(const [name,input,predicate] of cases){
 const output=ev(input);const passed=predicate(output);
 results.push({name,input,output,passed});
 console.log(JSON.stringify(results.at(-1)));
}
cases.push(
 ['scalar cosh imaginary','XSIMP("cosh(i)")',s=>s.includes('cos(1)')&&!s.includes('cosh')],
 ['scalar sinh imaginary','XSIMP("sinh(i)")',s=>s.includes('sin(1)')&&!s.includes('sinh')],
 ['nested power inside sum','XSIMP("3+exp((2-sqrt(3))*ln(2))")',s=>s.includes('2^')&&!s.includes('exp(')&&!s.includes('e^')],
 ['matrix compactness','XSIMP("2^[[1,1],[2,3]]")',s=>s.length<500&&!s.includes('exp(')&&!s.includes('e^')],
 ['held quoted sin remains symbolic','xsphold("sin(0)")',s=>s.includes('sin(0)')]
);
for(const [name,input,predicate] of cases.slice(4)){
 const output=ev(input);const passed=predicate(output);
 results.push({name,input,output,passed});console.log(JSON.stringify(results.at(-1)));
}
const diagnostics={selfcheck:ev('XSCHECK(0)'),report:ev('XSDIAG(0)')};
console.log(JSON.stringify(diagnostics));
fs.writeFileSync(__dirname+'/representation_results.json',JSON.stringify({runtime:ev('version()'),mode:'calc_mode(-38); original one-based CAS source, no source-index transformation. Upstream only, not HP firmware.',results,diagnostics},null,2));
process.exitCode=results.every(x=>x.passed)?0:1;
