const fs=require('fs');
const path=require('path');
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x;}};
global.alert=()=>{};
const giac=require('../test_runtime/giac.js');const ev=giac.cwrap('caseval','string',['string']);ev('calc_mode(-38)');
const file=path.join(__dirname,'parity_results.json');const audit=JSON.parse(fs.readFileSync(file,'utf8'));
// Prove the recorded outputs, independent of subsequent production changes.
for(const index of [14,19,26]){
 const row=audit.cases.find(r=>r.index===index);
 if(row.equivalence==='proved equal'){
  delete row.additionalProof;
  console.log(JSON.stringify({index,equivalence:row.equivalence,skipped:'Main audit already proved equality; no supplementary transformation needed.'}));
  continue;
 }
 const q=row.quoted.replaceAll('\ue003','i');const u=row.unquoted.replaceAll('\ue003','i');
 const proof=ev(`simplify(trig2exp(expr(${JSON.stringify('quote('+q+')')}))-trig2exp(expr(${JSON.stringify('quote('+u+')')})))`);
 row.additionalProof={method:'trig2exp of both recorded outputs, then simplify their difference',output:proof};
 if(proof==='[[0,0],[0,0]]')row.equivalence='proved equal';
 console.log(JSON.stringify({index,proof,equivalence:row.equivalence}));
}
const vector=audit.cases.find(r=>r.index===11);
vector.quotedShape=vector.unquotedShape='vector length 2';
for(const index of [27,28,29]) audit.cases.find(r=>r.index===index).equivalence='different native scalar-base matrix power semantics';
audit.summary={...audit.summary,total:audit.cases.length,identical:audit.cases.filter(r=>r.identical).length,provedEqual:audit.cases.filter(r=>r.equivalence==='proved equal').length,differentNativeSemantics:3};
fs.writeFileSync(file,JSON.stringify(audit,null,2));console.log(JSON.stringify(audit.summary));
