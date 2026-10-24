const fs = require('fs');
const path = require('path');
global.UI = {warnpy:false, Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
global.alert = x=>process.stderr.write('GIAC: '+x+'\n');
const giac = require('../test_runtime/giac.js');
const ev = giac.cwrap('caseval','string',['string']);
ev(fs.readFileSync(path.join(__dirname,'XSIMPKIT_desktop.cas'),'utf8'));
ev('angle_radian(1)');
ev('xstestzero(zz):=BEGIN LOCAL kk; IF type(zz)==DOM_LIST THEN FOR kk FROM 0 TO size(zz)-1 DO IF NOT xstestzero(zz[kk]) THEN RETURN 0; END; END; RETURN 1; END; IF string(normal(zz))=="0" THEN RETURN 1; END; RETURN 0; END;');
const cases = [
 ['trig identity', 'XSIMP("sin(x)^2+cos(x)^2")', '1'],
 ['Euler cancellation', 'XSIMP("(exp(i)+exp(-i))/2-cos(1)")', '0'],
 ['rational cancellation', 'XSIMP("(x^2-1)/(x-1)")', 'x+1'],
 ['complex rectangular', 'XSIMP("(1+i)/(1-i)")', 'i'],
 ['irrational real exponent', 'XSIMP("exp((2-sqrt(3))*ln(2))")', '2^(2-sqrt(3))'],
 ['retain complex exponential', 'XSIMP("exp(i*ln(2))")', 'exp(i*ln(2))'],
 ['complex special angle', 'XSIMP("exp(i*pi/3)")', '(1+i*sqrt(3))/2'],
 ['list map', 'XSIMP("[sin(x)^2+cos(x)^2,(x^2-1)/(x-1)]")', '[1,x+1]'],
 ['matrix zero power', 'XSIMP("2^[[0,0],[0,0]]")', '[[1,0],[0,1]]'],
 ['rotation exp', 'XSIMP("exp([[0,-1],[1,0]])")', '[[cos(1),-sin(1)],[sin(1),cos(1)]]'],
 ['rotation parameter', 'XSIMP("exp(t*[[0,-1],[1,0]])")', '[[cos(t),-sin(t)],[sin(t),cos(t)]]'],
 ['parameter at zero', 'subst(XSIMP("exp(t*[[0,-1],[1,0]])"),t,0)', '[[1,0],[0,1]]'],
 ['base two rotation', 'XSIMP("2^[[0,-1],[1,0]]")', '[[cos(ln(2)),-sin(ln(2))],[sin(ln(2)),cos(ln(2))]]'],
 ['Jordan exp', 'XSIMP("exp([[2,1],[0,2]])")', 'exp(2)*[[1,1],[0,1]]'],
 ['Jordan power', 'XSIMP("2^[[2,1],[0,2]]")', '[[4,4*ln(2)],[0,4]]'],
 ['3x3 nilpotent', 'XSIMP("exp([[0,1,0],[0,0,1],[0,0,0]])")', '[[1,1,1/2],[0,1,1],[0,0,1]]'],
 ['matrix sine', 'XSIMP("sin([[0,-1],[1,0]])")', '[[0,-sinh(1)],[sinh(1),0]]'],
 ['matrix cosine', 'XSIMP("cos([[0,-1],[1,0]])")', '[[cosh(1),0],[0,cosh(1)]]'],
 ['matrix hyperbolic cosine', 'XSIMP("cosh([[0,-1],[1,0]])")', '[[cos(1),0],[0,cos(1)]]'],
 ['nested matrix sum', 'XSIMP("exp([[0,-1],[1,0]])+exp([[0,1],[-1,0]])")', '2*cos(1)*[[1,0],[0,1]]'],
 ['ordinary matrix square', 'XSIMP("[[1,1],[2,3]]^2")', '[[3,4],[8,11]]'],
 ['explicit elementwise power', 'XSIMP("2 .^ [[1,1],[2,3]]")', '[[2,2],[4,8]]'],
 ['diagonal power', 'XSIMP("2^[[1,0],[0,3]]")', '[[2,0],[0,8]]'],
 ['symbol j not shadowed', 'XSIMP("exp([[j,1],[0,j]])")', 'exp(j)*[[1,1],[0,1]]'],
 ['ordinary argument', 'XSIMP(sin(x)^2+cos(x)^2)', '1'],
 ['single quoted matrix argument', "XSIMP('2^[[0,0],[0,0]]')", '[[1,0],[0,1]]'],
 ['user original matrix', 'XSIMP("2^[[1,1],[2,3]]")', '(2^(2+sqrt(3))+2^(2-sqrt(3)))/2*[[1,0],[0,1]]+(2^(2+sqrt(3))-2^(2-sqrt(3)))/(2*sqrt(3))*[[-1,1],[2,1]]'],
 ['matrix Euler cancellation', 'XSIMP("[[(exp(i)+exp(-i))/2-cos(1),0],[0,1]]")', '[[0,0],[0,1]]'],
 ['matrix containing scalar identity', 'XSIMP("[[sin(x)^2+cos(x)^2,0],[0,1]]")', '[[1,0],[0,1]]'],
];
let results=[];
for (const [name,input,expected] of cases) {
  const t=Date.now();
  const actual=ev('xstestresult:='+input);
  const check=ev('normal(xstestresult-('+expected+'))');
  const ok=ev('xsmz(normal(xstestresult-('+expected+')))');
  // Scalar zero helper does not test matrices: use the matrix checker.
  const matrixOk=ev('xsumatrix(xstestresult)');
  let proof=ev('xstestzero(normal(xstestresult-('+expected+')))');
  if(proof!=='1') proof=ev('xstestzero(simplify(pow2exp(xstestresult)-pow2exp('+expected+')))');
  // Hyperbolic and spectral power forms need a common exponential basis.
  // This is a verification-only conversion; preserve the displayed result.
  if(proof!=='1') proof=ev('xstestzero(simplify(texpand(hyp2exp(pow2exp(xstestresult)))-texpand(hyp2exp(pow2exp('+expected+')))))');
  results.push({name,input,expected,actual,difference:check,passed:proof==='1'||proof==='true',ms:Date.now()-t});
  console.log(JSON.stringify(results.at(-1)));
}
ev('testmatrix:=[[1,1],[2,3]]');
const extra = [
 ['native scalar base power','2^testmatrix'],
 ['native matrix power','testmatrix^2'],
 ['native zero matrix','2^[[0,0],[0,0]]'],
 ['native genuine exp zero','exp(ln(2)*[[0,0],[0,0]])'],
 ['head e power',"(quote(e^a))[0]"],
 ['head base two power',"(quote(2^a))[0]"],
 ['bound matrix variable','XSIMP("2^testmatrix")'],
 ['negative base rejection','XSIMP("(-2)^testmatrix")'],
 ['complex assumptions','complex_variables(1)'],
 ['complex exponent stays exponential','XSIMP("exp(z*ln(2))")'],
 ['complex variables reset','complex_variables(0)'],
];
const observations=[];
for(const [name,input] of extra) {
 console.log('OBS '+name);
 let actual;
 try { actual=ev(input); } catch(err) { actual='JS_EXCEPTION '+String(err); }
 const rec={name,input,actual}; observations.push(rec); console.log(JSON.stringify(rec));
}
fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify({runtime:ev('version()'),testAdaptation:'HP one-based indices mechanically changed to desktop zero-based; #cas wrapper excluded. Not HP firmware execution.',results,observations},null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,total:results.length,observations}));
process.exitCode=results.every(x=>x.passed)?0:1;
