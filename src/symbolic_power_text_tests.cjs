const fs=require('fs'),path=require('path');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
const giac=require('../test_runtime/giac.js');const ev=giac.cwrap('caseval','string',['string']);ev('calc_mode(-38)');ev('complex_variables(1)');
ev(['scalar','presentation'].map(n=>fs.readFileSync(path.join(__dirname,n+'.cas'),'utf8')).join('\n'));
const rows=[];
const src='quote(exp((2-sqrt(3))*ln(a)))';
const text=ev('xsptext('+src+',0)');
const target=ev('xspresent('+src+')');
rows.push({name:'unknown complex base displayed as a power',text,target,passed:text.includes('(a)^')&&!text.includes('exp(')});
for(const val of ['2','-2','i']){
 const delta=ev('abs(evalf(subst(xspresent('+src+'),a,'+val+')-exp((2-sqrt(3))*ln('+val+'))))');
 const proof=ev('abs(evalf(subst(xspresent('+src+'),a,'+val+')-exp((2-sqrt(3))*ln('+val+'))))<1e-10');
 rows.push({name:'principal-power check a='+val,delta,proof,passed:proof==='1'||proof==='true'});
}
for(const [name,src,baseval] of [
 ['squared base kept intact','quote(exp(ln(a^2)/2))','-2'],
 ['product base kept intact','quote(exp(ln(a*b)/2))',null],
 ['nested power base kept intact','quote(exp(ln(a^(1/2))/2))','-2']
]){
 const text=ev('xsptext('+src+',0)');const target=ev('xspresent('+src+')');
 let proof='';
 if(baseval) proof=ev(`abs(evalf(subst(xspresent(${src}),a,${baseval})-subst(${src},a,${baseval})))<1e-10`);
 const expected= name.startsWith('product') ? '(a)*(b)' : name.startsWith('squared') ? '(a)^(2)' : 'sqrt(a)';
 const passed=text.includes(expected)&&(baseval?(proof==='1'||proof==='true'):true)&&target!=='a';
 rows.push({name,text,target,proof,passed});
}
const complexText=ev('xsptext(quote(exp(i*ln(a))),0)');
rows.push({name:'complex coefficient keeps exponential preference',text:complexText,passed:complexText.includes('exp(')});
for(const row of rows)console.log(JSON.stringify(row));
fs.writeFileSync(path.join(__dirname,'symbolic_power_text_results.json'),JSON.stringify({runtime:'Upstream Giac calc_mode(-38), complex_variables(1); not HP firmware.',rows},null,2));
process.exitCode=rows.every(x=>x.passed)?0:1;
