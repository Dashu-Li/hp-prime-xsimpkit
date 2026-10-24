const fs=require('fs'),path=require('path');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};global.alert=()=>{};
const giac=require('../test_runtime/giac.js');const ev=giac.cwrap('caseval','string',['string']);
ev('calc_mode(-38)');
// Frozen 1.5 reference for compatibility and isolated speed comparison.
const original="// Final presentation pass. Build text first, then parse once under quote.\n// No algebraic simplification may follow xspresent: native ^ evaluation may\n// otherwise turn a real irrational power straight back into exp(c*ln(b)).\n// Bounds apply to traversal/text; individual native CAS calls have no timeout.\n\n// HP-mode string(i) can be a private-use display glyph that expr cannot parse.\n// Translate that glyph outside string literals. Keep other native syntax.\nxspnativeold(xspv):=BEGIN\n  LOCAL xsps,xspr,xspk,xspn,xspi,xspni,xspch,xspquoted,xspescape;\n  xsps:=string(xspv);\n  IF type(xspv)==DOM_STRING THEN\n    xsps:=string([xspv]); xsps:=mid(xsps,2,size(xsps)-2);\n  END;\n  xspi:=string(i); xspni:=size(xspi);\n  IF xspi==\"i\" THEN RETURN xsps; END;\n  IF size(xsps)>6400 THEN RETURN xsps; END;\n  xspr:=\"\"; xspk:=1; xspn:=size(xsps); xspquoted:=0; xspescape:=0;\n  WHILE xspk<=xspn DO\n    xspch:=mid(xsps,xspk,1);\n    IF xspquoted==0 AND mid(xsps,xspk,xspni)==xspi THEN\n      xspr:=xspr+\"(i)\"; xspk:=xspk+xspni;\n    ELSE\n      xspr:=xspr+xspch; xspk:=xspk+1;\n      IF xspescape==1 THEN xspescape:=0;\n      ELSE\n        IF xspch==\"\\\\\" THEN xspescape:=1;\n        ELSE IF xspch==\"\\\"\" THEN xspquoted:=1-xspquoted; END; END;\n      END;\n    END;\n  END;\n  RETURN xspr;\nEND;\n\n";
ev(original);
ev(['scalar','presentation'].map(n=>fs.readFileSync(path.join(__dirname,n+'.cas'),'utf8')).join('\n'));
const glyph='\ue003';
const cases=[
 ['real scalar','sqrt(3)*ln(2)'],
 ['large real matrix','quote([[4*cosh(sqrt(3)*ln(2))-4*sqrt(3)*sinh(sqrt(3)*ln(2))/3,4*sqrt(3)*sinh(sqrt(3)*ln(2))/3],[8*sqrt(3)*sinh(sqrt(3)*ln(2))/3,4*cosh(sqrt(3)*ln(2))+4*sqrt(3)*sinh(sqrt(3)*ln(2))/3]])'],
 ['imaginary scalar','2+3*i'],
 ['imaginary matrix','quote([[cos(t),i*sin(t)],[i*sin(t),cos(t)]])'],
 ['literal imaginary glyph',JSON.stringify(glyph)],
 ['literal ascii and quote',JSON.stringify('i = "'+glyph+'"')],
 ['literal backslash',JSON.stringify('\\"'+glyph+'"\\')],
 ['mixed literal and imaginary value','quote([i,'+JSON.stringify('inner "'+glyph+'" \\')+'])'],
 ['undefined function string args','quote(ff('+JSON.stringify('inner '+glyph+' " \\')+',i))'],
 ['ordinary text',JSON.stringify('ordinary sin(x) text')]
];
const results=[];
for(const [name,input] of cases){
 const old=ev(`xspnativeold(${input})`),now=ev(`xspnative(${input})`);
 const passed=old===now;
 const row={name,input,old,now,passed};results.push(row);console.log(JSON.stringify(row));
}
const search={present:ev('inString("abcded","d")'),absent:ev('inString("abcd","e")'),glyphPresent:ev('inString(string(2+3*i),string(i))'),glyphAbsent:ev('inString(string(sqrt(3)),string(i))')};
const sample=cases[1][1];ev('xspbenchinput:='+sample);
const timing=[];
for(const name of ['xspnativeold','xspnative']){
 let rounds=[];
 for(let r=0;r<5;r++){let t=performance.now();for(let n=0;n<10;n++)ev(`${name}(xspbenchinput)`);rounds.push((performance.now()-t)/10);}
 rounds.sort((a,b)=>a-b);timing.push({name,medianMsPerCall:rounds[2],rounds});
}
fs.writeFileSync(path.join(__dirname,'native_text_results.json'),JSON.stringify({runtime:'Upstream Giac calc_mode(-38); original one-based sources. Not HP firmware.',results,search,timing},null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.passed).length,total:results.length,search,timing}));
process.exitCode=results.every(x=>x.passed)&&search.present==='4'&&search.absent==='0'?0:1;
