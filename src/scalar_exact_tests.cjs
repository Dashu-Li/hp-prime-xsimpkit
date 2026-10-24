const fs = require('fs'), path = require('path'), crypto = require('crypto');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
global.alert=()=>{};
const giac=require('../test_runtime/giac.js');
const ev=giac.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
const scalarSource=fs.readFileSync(path.join(__dirname,'scalar.cas'),'utf8');
const sourceSha256={'scalar.cas':crypto.createHash('sha256').update(scalarSource).digest('hex')};
ev(scalarSource);
ev('ss:=sqrt(2+sqrt(5))-i*sqrt(sqrt(5)-2)');
const tests=[
 ['xsisapprox(sqrt(2)+i/3)','0'],
 ['xsisapprox(2+3*i)','0'],
 ['xsisapprox(2.0+3*i)','1'],
 ['xsisapprox(2+3.0*i)','1'],
 ['xsisapprox([1,sqrt(2),[3+i/2]])','0'],
 ['xsisapprox([1,sqrt(2),[3.0+i/2]])','1'],
 ['xsisapprox(f(1.2))','1'],
 ['xsisapprox(f(sqrt(2)))','0'],
 ['xsisapprox(["1.0",Euler,xexample])','0'],
 ['xsisapprox(x+1E20)','1'],
 ['xsisapprox(x+1E-20)','1'],
 ['xsisapprox([1.0/0.0])','1'],
 ['xsisapprox([0.0/0.0])','1'],
 ['xsnewapprox(sqrt(2),1.414)','1'],
 ['xsnewapprox(1.4,1.414)','0'],
 ['xsnewapprox(sqrt(2),sqrt(3))','0'],
 ['xsisapprox(cos(ss)*exp(i))','0'],
 ['xsisapprox(normal(cos(ss)*exp(i)))','1'],
 ['xsisapprox(xsrewrite(cos(ss)*exp(i)))','0'],
 ['xsisapprox(xsclean(cos(ss)*exp(i)))','0'],
 ['xsisapprox(xsscalar(cos(ss)*exp(i)))','0'],
 ['xsisapprox(XRECT(cos(ss)*exp(i)))','0'],
 ['string(xsrewrite(expr("quote(sqrt(4-2*i))")))==string(expr("quote(sqrt(4-2*i))"))','1'],
 ['xsscalar(sin(x)^2+cos(x)^2)','1'],
 ['normal(xsscalar((x^2-1)/(x-1))-(x+1))','0'],
 ['normal(xsscalar(exp(sqrt(2)*ln(3)))-3^sqrt(2))','0'],
 ['xsisapprox(xsscalar(cos(ss)*exp(i)+0.1))','1'],
 ['xscomplexrad(ss)','1'],
 ['xscomplexrad(cos(ss)*exp(i))','1'],
 ['xscomplexrad(2*sin(ss)*exp(i)/ss)','1'],
 ['xscomplexrad((3+2*i)*sqrt(2)/6)','1'],
 ['xscomplexrad(i*2^(1/3))','1'],
 ['xscomplexrad(expr("quote(sqrt(4-2*i))"))','1'],
 ['xscomplexrad(sqrt(2)+sqrt(3))','0'],
 ['xscomplexrad(cos(sqrt(2))*exp(1))','0'],
 ['xscomplexrad(2+3*i)','0'],
 ['xscomplexrad(cos(2+i))','0'],
 ['xscomplexrad(x+ss)','0'],
 ['xscomplexrad(sin(x)*sqrt(2)*i)','0'],
 ['xscomplexrad(0.1+ss)','0'],
 ['xscomplexrad(f(ss))','0'],
 ['xsisapprox(xsclean(2*sin(ss)*exp(i)/ss))','0'],
 ['xsisapprox(xsscalar(2*sin(ss)*exp(i)/ss))','0'],
 ['xsisapprox(xsclean((-2+i)*sin(ss)*exp(i)/ss))','0'],
 ['xsscalar(sin(ss)^2+cos(ss)^2)','1'],
 ['xsclean(2+sin(ss)^2+cos(ss)^2)','3'],
 ['string(xsradtrigunit(sin(ss)^2+cos(2*ss)^2))==string(sin(ss)^2+cos(2*ss)^2)','1'],
 ['normal(xsscalar((sqrt(2)+sqrt(3))^2)-(5+2*sqrt(6)))','0'],
];
let failed=0;const rows=[];
for(const [input,want] of tests){
 const start=Date.now();
 const actual=ev(input);
 const pass=actual===want;
 if(!pass)failed++;
 const row={input,actual,want,pass,ms:Date.now()-start};rows.push(row);console.log(JSON.stringify(row));
}
console.log(JSON.stringify({total:tests.length,failed}));
fs.writeFileSync(path.join(__dirname,'scalar_exact_results.json'),JSON.stringify({runtime:'Upstream Giac calc_mode(-38), original one-based module; not physical HP firmware.',contract:'Typed numeric-leaf inspection; bounded at 24 levels; incomplete candidates preserved unless input already has a confirmed float. No reconstruction of unchanged function heads.',sourceSha256,total:tests.length,failed,rows},null,2)+'\n');
process.exitCode=failed?1:0;
