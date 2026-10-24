const fs=require('fs');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
global.alert=()=>{};
const giac=require('../test_runtime/giac.js');
const ev=giac.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
ev(['scalar','presentation'].map(name=>fs.readFileSync(__dirname+'/'+name+'.cas','utf8')).join('\n'));
const cases=[
 ['native reciprocal','8/sqrt(3)*sinh(u)',false],
 ['rational coefficient','(8/3)*sqrt(3)*sinh(u)',false],
 ['quoted division factor','8*(1/sqrt(3))*sinh(u)',true],
 ['two reciprocals','8*x^(-1)*y^(-1)*sinh(u)',true],
 ['only reciprocals','x^(-1)*y^(-1)',true],
 ['identity numerator','1*x*y',true],
 ['identity denominator','(x/1)*y',true],
 ['complex coefficient','(2+3*i)*sinh(u)/sqrt(3)',false],
 ['nested sum denominator','8*(1/(x+y))*sinh(u)',true],
 ['positive powers','x^2*y^3',true],
 ['matrix entries','[[8/sqrt(3)*sinh(u),x/y],[i/sqrt(3),x^2*y]]',false],
 ['matrix product order','[[1,2],[0,1]]*inv([[2,0],[1,1]])',true],
];
const results=[];
for(const [name,source,quoted] of cases){
 const input=quoted?`quote(${source})`:`(${source})`;
 const text=ev(`xsptext(${input},0)`);
 const output=ev(`xspresent(${input})`);
 const difference=ev(`simplify(eval(xspresent(${input}))-(${source}))`);
 const passed=difference==='0'||difference==='[[0,0],[0,0]]';
 const row={name,source,text,output,difference,passed};results.push(row);console.log(JSON.stringify(row));
}
const reciprocal=results[0].output;
const typography={name:'single quotient without reciprocal factor',passed:reciprocal.includes('sinh(u)/')&&!reciprocal.includes('1/')};
const order={name:'direct matrices retain multiplication syntax',passed:results.at(-1).text.includes('*')};
console.log(JSON.stringify(typography));console.log(JSON.stringify(order));
fs.writeFileSync(__dirname+'/fraction_results.json',JSON.stringify({runtime:ev('version()'),mode:'Upstream Giac calc_mode(-38); original one-based source. Not HP firmware.',results,typography,order},null,2));
process.exitCode=results.every(row=>row.passed)&&typography.passed&&order.passed?0:1;
