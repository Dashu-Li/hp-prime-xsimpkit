const fs=require('fs');global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
const g=require('../test_runtime/giac.js'),ev=g.cwrap('caseval','string',['string']);ev('calc_mode(-38)');
ev(['scalar','matrix','presentation','posthoc','unified'].map(x=>fs.readFileSync(__dirname+'/'+x+'.cas','utf8')).join('\n'));
const out=[];function save(){fs.writeFileSync(__dirname+'/posthoc_extended_checks.json',JSON.stringify(out,null,2));}
function t(name,src,expected,need){const st=Date.now();const actual=ev('phactual:=XSIMP('+src+')');const eq=ev('xsmzero(simplify(trig2exp(hyp2exp(pow2exp(phactual)))-trig2exp(hyp2exp(pow2exp('+expected+')))))');out.push({name,src,actual,eq,pass:eq==='1'&&(!need||actual.includes(need)),ms:Date.now()-st});save();}
t('symbolic_rotation','exp(t*[[0,-1],[1,0]])','[[cos(t),-sin(t)],[sin(t),cos(t)]]','cos');
t('symbolic_imaginary_pauli','exp(i*t*[[0,1],[1,0]])','[[cos(t),i*sin(t)],[i*sin(t),cos(t)]]','cos');
t('symbolic_positive_spectrum','exp(t*[[1,1],[2,3]])','exp(2*t)*[[cosh(sqrt(3)*t)-sinh(sqrt(3)*t)/sqrt(3),sinh(sqrt(3)*t)/sqrt(3)],[2*sinh(sqrt(3)*t)/sqrt(3),cosh(sqrt(3)*t)+sinh(sqrt(3)*t)/sqrt(3)]]','cosh');
t('sine_matrix','sin([[0,-1],[1,0]])','[[0,-sinh(1)],[sinh(1),0]]','sinh');
t('cosine_matrix','cos([[0,-1],[1,0]])','[[cosh(1),0],[0,cosh(1)]]','cosh');
t('complex_pair_sum','exp([[0,-1],[1,0]])+exp([[0,1],[-1,0]])','[[2*cos(1),0],[0,2*cos(1)]]','cos');
t('complex_parameter_rotation','exp((1+i)*t*[[0,-1],[1,0]])','[[cos((1+i)*t),-sin((1+i)*t)],[sin((1+i)*t),cos((1+i)*t)]]');
const guards=[['unknown_base_power','xspppowers(expr("quote(a^t)"),0)','0'],['negative_base_power','xspppowers(expr("quote((-2)^t)"),0)','0'],['positive_base_power','xspppowers(expr("quote(2^t)"),0)','1'],['unknown_symbolic_denominator','string(xsppostscalar((exp(t)+exp(-t))/x))==string((exp(t)+exp(-t))/x)','1'],['placeholder_in_input','string(xsppostscalar(exp(xsppostauxv)+exp(-xsppostauxv)))==string(exp(xsppostauxv)+exp(-xsppostauxv))','1'],['negative_rational_power_guard','string(xsppostscalar((exp(t)+exp(-t))/sqrt(x)))==string((exp(t)+exp(-t))/sqrt(x))','1'],['existing_log_base_allowed','string(xsppostscalar(exp(t*ln(x))+exp(-t*ln(x))))==string(2*cosh(t*ln(x)))','1'],['new_unknown_log_base_declined','string(xsppostscalar(expr("quote(x^t+x^(-t))")))==string(expr("quote(x^t+x^(-t))"))','1'],['existing_log_does_not_exempt_unknown_power','xspppowers(expr("quote(x^t+x^(-t)+ln(x))"),0)','0']];
for(const [name,x,expected]of guards){const actual=ev(x);out.push({name,x,actual,expected,pass:actual===expected});save();}
if(out.some(a=>!a.pass))process.exitCode=1;
