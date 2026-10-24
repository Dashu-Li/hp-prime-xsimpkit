const fs=require('fs');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
global.alert=()=>{};
const giac=require('../test_runtime/giac.js');
const ev=giac.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
ev(['scalar','matrix','presentation','posthoc','unified'].map(name=>fs.readFileSync(__dirname+'/'+name+'.cas','utf8')).join('\n'));
const A='[[1,1],[2,3]]';
const samples=[
 ['real matrix exponential',`XSIMP("exp(${A})")`],
 ['log-two scaled exponential',`XSIMP("exp(${A}*ln(2))")`],
 ['left log-two factor',`XSIMP("exp(ln(2)*${A})")`],
 ['symbolic real parameter',`XSIMP("exp(t*${A})")`],
 ['imaginary Pauli exponential','XSIMP("exp(i*[[0,1],[1,0]])")'],
 ['base-two matrix power',`XSIMP("2^${A}")`],
];
const outputs=samples.map(([name,input])=>({name,input,output:ev(input)}));
for(const row of outputs) console.log(JSON.stringify(row));
const checks=[
 ['off-diagonal ln2 coefficient is 8/sqrt3',`simplify(XEXPT(${A},ln(2))[2,1]/sinh(sqrt(3)*ln(2))-8/sqrt(3))`],
 ['other off-diagonal ln2 coefficient is 4/sqrt3',`simplify(XEXPT(${A},ln(2))[1,2]/sinh(sqrt(3)*ln(2))-4/sqrt(3))`],
 ['real exp lower coefficient',`simplify(XEXP(${A})[2,1]/sinh(sqrt(3))-2*exp(2)/sqrt(3))`],
 ['symbolic t lower coefficient',`simplify(XEXPT(${A},t)[2,1]/sinh(t*sqrt(3))-2*exp(2*t)/sqrt(3))`],
 ['real exp diagonal',`simplify(XEXP(${A})[1,1]-exp(2)*(cosh(sqrt(3))-sinh(sqrt(3))/sqrt(3)))`],
 ['ln2 diagonal',`simplify(XEXPT(${A},ln(2))[2,2]-4*(cosh(sqrt(3)*ln(2))+sinh(sqrt(3)*ln(2))/sqrt(3)))`],
 ['imaginary Pauli unchanged','simplify(XEXPT([[0,1],[1,0]],i)-[[cos(1),i*sin(1)],[i*sin(1),cos(1)]])'],
];
const results=checks.map(([name,input])=>{
 const output=ev(input); const passed=output==='0'||output==='[[0,0],[0,0]]';
 const row={name,input,output,passed}; console.log(JSON.stringify(row)); return row;
});
const ln2=outputs.find(row=>row.name==='log-two scaled exponential').output;
const representation={name:'ln2 lower coefficient folded before sinh',passed:ln2.includes('8')&&!ln2.includes('*4')&&!ln2.includes('4*2')&&ln2.includes('sinh(')};
console.log(JSON.stringify(representation));
fs.writeFileSync(__dirname+'/coefficient_results.json',JSON.stringify({runtime:ev('version()'),mode:'Upstream Giac calc_mode(-38); original one-based source. Not HP firmware.',outputs,results,representation},null,2));
process.exitCode=results.every(row=>row.passed)&&representation.passed?0:1;
