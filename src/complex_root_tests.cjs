const fs=require('fs'),path=require('path');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
const giac=require('../test_runtime/giac.js'),ev=giac.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
ev(['scalar','matrix','presentation','posthoc','unified'].map(n=>fs.readFileSync(path.join(__dirname,n+'.cas'),'utf8')).join('\n'));
const cases=[
 ['positive real','4'],['negative real','-4'],['zero','0'],
 ['positive imaginary','i'],['negative imaginary','-i'],
 ['first quadrant','3+4*i'],['fourth quadrant','3-4*i'],
 ['second quadrant','-3+4*i'],['third quadrant','-3-4*i'],
 ['rational components','1/2+i/3'],['screenshot root','4-2*i'],
 ['screenshot alternate root','-4+2*i'],
];
const rows=[];
for(const [name,input] of cases){
 const output=ev('crroot:=xsmroot('+input+')');
 const approximate=ev('xsisapprox(crroot)');
 const squareProof=ev('normal(crroot^2-('+input+'))');
 // Principal root: positive real part, or nonnegative imaginary part on the cut.
 const branchProof=ev('evalf(re(crroot))>=0 and (evalf(re(crroot))!=0 or evalf(im(crroot))>=0)');
 const passed=approximate==='0'&&squareProof==='0'&&(branchProof==='1'||branchProof==='true');
 const row={name,input,output,approximate,squareProof,branchProof,passed};rows.push(row);console.log('ROOT_RESULT '+JSON.stringify(row));
}
for(const [name,input] of [['floating input','3.0+4.0*i'],['symbolic input','crsymbol'],['unsupported exact algebraic complex input','1+i*sqrt(2)']]){
 const output=ev('crroot:=xsmroot('+input+')'),approximate=ev('xsisapprox(crroot)');
 const passed=name==='floating input'?approximate==='1':approximate==='0';
 const row={name,input,output,approximate,validation:name==='floating input'?'Approximate input remains approximate.':'Exact unsupported input remains an unevaluated exact square root.',passed};rows.push(row);console.log('ROOT_RESULT '+JSON.stringify(row));
}
fs.writeFileSync(path.join(__dirname,'complex_root_results.json'),JSON.stringify({runtime:'Upstream Giac calc_mode(-38), original one-based modules; not physical HP firmware.',contract:'Principal exact square root for Gaussian rational constants; no guessing of floating input; exact unsupported roots held.',rows},null,2)+'\n');
process.exitCode=rows.every(r=>r.passed)?0:1;
