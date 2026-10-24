const fs=require('fs'),path=require('path');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
const giac=require('../test_runtime/giac.js'),ev=giac.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
ev(['scalar','matrix','presentation','posthoc','unified'].map(n=>fs.readFileSync(path.join(__dirname,n+'.cas'),'utf8')).join('\n'));
ev('cma:=[[1,-2*i],[1+2*i,1]]');
ev('cmb:=cma-idn(2)');
ev('cmr:=sqrt(2+sqrt(5))-i*sqrt(sqrt(5)-2)');
const structuralProofs={tracelessSquare:ev('normal(cmb*cmb-(4-2*i)*idn(2))'),rootSquare:ev('normal(cmr^2-(4-2*i))')};
const expI='exp(i)*(cos(cmr)*idn(2)+i*sin(cmr)/cmr*cmb)';
const cases=[
 ['screenshot quoted','XSIMP("exp(i*([[1,0],[1,1]]+2*[[0,-i],[i,0]]))")',expI],
 ['factored exponential','XEXPT(cma,i)',expI],
 ['combined exponential','XEXP(i*cma)',expI],
 ['positive scalar base','XPOW(2,cma)','2*(cosh(ln(2)*cmr)*idn(2)+sinh(ln(2)*cmr)/cmr*cmb)'],
 ['genuine sine','XSIN(cma)','sin(1)*cos(cmr)*idn(2)+cos(1)*sin(cmr)/cmr*cmb'],
 ['genuine cosine','XCOS(cma)','cos(1)*cos(cmr)*idn(2)-sin(1)*sin(cmr)/cmr*cmb'],
 ['quoted matrix sine','XSIMP("sin([[1,-2*i],[1+2*i,1]])")','sin(1)*cos(cmr)*idn(2)+cos(1)*sin(cmr)/cmr*cmb'],
 ['quoted matrix cosine','XSIMP("cos([[1,-2*i],[1+2*i,1]])")','cos(1)*cos(cmr)*idn(2)-sin(1)*sin(cmr)/cmr*cmb'],
];
const rows=[];
for(const [name,input,reference] of cases){
 const start=Date.now(),output=ev('cmgot:='+input),approximate=ev('xsisapprox(cmgot)');
 const difference=ev('cmdiff:=evalf(cmgot-('+reference+'))');
 const maxError=ev('max([abs(cmdiff[1,1]),abs(cmdiff[1,2]),abs(cmdiff[2,1]),abs(cmdiff[2,2])])');
 const passed=approximate==='0'&&Number(maxError)<1e-10;
 const row={name,input,reference,output,approximate,difference,maxError,ms:Date.now()-start,passed};rows.push(row);console.log('MATRIX_RESULT '+JSON.stringify(row));
}
const native=ev('exp(i*cma)');
const data={runtime:'Upstream Giac calc_mode(-38), original one-based modules; not physical HP firmware.',validation:'Exactness checked by expression types; numeric agreement with a separately constructed Cayley-Hamilton form. This is not an exact proof of each returned expression.',structuralProofs,nativeAlreadyApproximateOutput:native,rows};
fs.writeFileSync(path.join(__dirname,'complex_matrix_results.json'),JSON.stringify(data,null,2)+'\n');
process.exitCode=rows.every(r=>r.passed)&&structuralProofs.tracelessSquare==='[[0,0],[0,0]]'&&structuralProofs.rootSquare==='0'?0:1;
