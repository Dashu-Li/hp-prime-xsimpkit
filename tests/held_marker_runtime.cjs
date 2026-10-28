'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/heldi/final-host'));
const MODS=['scalar','matrix','presentation','posthoc','unified'];
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};global.alert=()=>{};
const ev=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);ev('calc_mode(-38)');ev('of:=1');ev('angle_radian(1)');
const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));ev(sources.join('\n\n'));
ev('zzhmarkcalls:=0');ev('zzhmarksentinel:=1729');ev('zzhmarkbound:=7');ev('assume(zzhmarkpositive>0)');
const state=()=>({sentinel:ev('zzhmarksentinel'),bound:ev('zzhmarkbound'),assumption:ev('string(about(quote(zzhmarkpositive)))'),calls:ev('zzhmarkcalls'),angle:ev('angle_radian()'),cm:ev('complex_mode()'),cv:ev('complex_variables()'),slot:ev('string(about(quote(xsppimagatom)))'),slotx:ev('string(about(quote(xsppimagatomx)))')});
const rows=[];const q=JSON.stringify;
for(const setting of ['unbound','bound','assumed','function']){
 ev('purge(xsppimagatom)');ev('purge(xsppimagatomx)');
 if(setting==='bound'){ev('xsppimagatom:=83');ev('xsppimagatomx:=97');}
 if(setting==='assumed'){ev('assume(xsppimagatom>0)');ev('assume(xsppimagatomx>0)');}
 if(setting==='function')ev('xsppimagatom(zzvalue):=BEGIN zzhmarkcalls:=zzhmarkcalls+1; RETURN zzvalue; END;');
 const cases=[
  {id:'atomic',text:'@@XSIMP_I@@',want:'i',exactAtom:true},
  {id:'negative',text:'-@@XSIMP_I@@',want:'quote(-i)'},
  {id:'marker_in_string_data',text:q('@@XSIMP_I@@ remains data'),want:q('@@XSIMP_I@@ remains data')},
  {id:'escaped_quote_data',text:q('" @@XSIMP_I@@ \\ data'),want:q('" @@XSIMP_I@@ \\ data')},
  {id:'source_identifier_collision',text:'xsppimagatom+xsppimagatomx*@@XSIMP_I@@',want:'quote(xsppimagatom+xsppimagatomx*i)'},
  {id:'bound_identifier_held',text:'zzhmarkbound*@@XSIMP_I@@',want:'quote(zzhmarkbound*i)'},
  {id:'assumed_identifier_held',text:'zzhmarkpositive*@@XSIMP_I@@',want:'quote(zzhmarkpositive*i)'},
  {id:'hole_in_unary',text:'sinh(c/c*@@XSIMP_I@@*b)',want:'quote(sinh(c/c*i*b))',hole:true},
  {id:'principal_root',text:'sqrt(4-2*@@XSIMP_I@@)',want:'quote(sqrt(4-2*i))'},
  {id:'nested_power',text:'(a^sqrt(3))^sqrt(2)*@@XSIMP_I@@',want:'quote((a^sqrt(3))^sqrt(2)*i)'}
 ];
 for(const c of cases){
  const before=state(),display=ev('zzhmarkout:=xsphold('+q(c.text)+')'),output=ev('string(zzhmarkout)'),expected=ev('string('+c.want+')'),approx=ev('xsapproxstate(zzhmarkout,0)');
  const checks={held_output:output===expected,exact:approx==='0',state_preserved:JSON.stringify(before)===JSON.stringify(state())};
  if(c.exactAtom)checks.exact_complex_parts=ev('[type(re(zzhmarkout)),type(im(zzhmarkout))]')==='[DOM_INT,DOM_INT]';
  if(c.hole)checks.hole_retained=['1','true'].includes(ev('xsuholegate('+c.want+',zzhmarkout)'));
  rows.push({setting,...c,display,output,expected,approx,checks,pass:Object.values(checks).every(Boolean)});
 }
}
const report={scope:'Fresh HOST combined CAS source, private transport marker and placeholder collisions; no physical G2 parser claim. Owned isolated test identifiers are purged between settings, never user state.',modules:Object.fromEntries(MODS.map((n,i)=>[n+'.cas',crypto.createHash('sha256').update(sources[i]).digest('hex')])),rows,summary:{total:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length}};
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'held-marker-runtime.json'),JSON.stringify(report,null,2)+'\n');console.log('HELD_MARKER '+JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
