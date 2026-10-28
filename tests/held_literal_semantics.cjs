'use strict';
// Semantic and held-tree contracts for numeric-complex serialization.
// Inputs use HOST builtin i so they begin exact; the renderer generates
// pair-literal transport syntax. This does not emulate G2 quote(i).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||path.join(ROOT,'evidence/heldi/host'));
const MODS=['scalar','matrix','presentation','posthoc','unified'];
global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};
global.alert=()=>{};
const rawEv=require(path.join(ROOT,'test_runtime/giac.js')).cwrap('caseval','string',['string']);
const ev=command=>{if(process.env.XS_DEBUG_LAST_COMMAND)fs.writeFileSync(process.env.XS_DEBUG_LAST_COMMAND,command);return rawEv(command);};
ev('calc_mode(-38)');ev('of:=1');ev('angle_radian(1)');
const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8'));
ev(sources.join('\n\n'));
ev('zzhlsemcalls:=0');ev('zzhlsemsentinel:=1729');ev('zzhlsembound:=7');ev('assume(zzhlsempositive>0)');
ev('zzhlsemaction(zzvalue):=BEGIN zzhlsemcalls:=zzhlsemcalls+1; RETURN zzvalue; END;');
const state=()=>({calls:ev('zzhlsemcalls'),sentinel:ev('zzhlsemsentinel'),bound:ev('zzhlsembound'),assumption:ev('string(about(quote(zzhlsempositive)))'),angle:ev('angle_radian()'),cm:ev('complex_mode()'),cv:ev('complex_variables()')});
const fixtures=[
 {id:'exact_negative_unit',input:'-i',numeric:true},
 {id:'exact_negative_rational_complex',input:'-i/3',numeric:true},
 {id:'exact_gaussian_integer',input:'3-4*i',numeric:true},
 {id:'exact_gaussian_rational',input:'(3+2*i)/6',numeric:true},
 {id:'principal_complex_root',input:'quote(sqrt(4-2*i))'},
 {id:'principal_nested_power',input:'quote((a^sqrt(3))^sqrt(2)*i)'},
 {id:'domain_hole',input:'quote(c/c*i*sin(b))',hole:true},
 {id:'domain_hole_inside_hyperbolic',input:'quote(sinh(c/c*i*b))',hole:true},
 {id:'bound_identifier_held',input:'quote(zzhlsembound*i)'},
 {id:'known_action_held',input:'quote(zzhlsemaction(i*b))',fallback:true},
 {id:'unknown_and_string_data',input:'quote(zzhlsemunknown("i and SINH(i*b)",i*b))',fallback:true},
 {id:'matrix_entries',input:'quote([[i,1],[-i,0]])'}
];
const records=[];
for(const cm of [0,1])for(const cv of [0,1]){
 ev('complex_mode('+cm+')');ev('complex_variables('+cv+')');
 for(const fixture of fixtures.filter(f=>(!process.env.XS_FIXTURE_ONLY||f.id===process.env.XS_FIXTURE_ONLY)&&(!process.env.XS_SKIP_FIXTURE||f.id!==process.env.XS_SKIP_FIXTURE))){
  console.log('CASE '+cm+' '+cv+' '+fixture.id);const before=state();ev('zzhlsemin:='+fixture.input);
  const original=ev('string(zzhlsemin)'),originalApprox=ev('xsapproxstate(zzhlsemin,0)');
  ev('zzhlsemtext:=xspnative(zzhlsemin)');const rawHeld=ev('xsphold(zzhlsemtext)');ev('zzhlsemout:='+(fixture.fallback?'xspresent(zzhlsemin)':'xsphold(zzhlsemtext)'));
  const output=ev('string(zzhlsemout)'),approx=ev('xsapproxstate(zzhlsemout,0)');
  const certificate=fixture.numeric?ev('normal(zzhlsemout-zzhlsemin)'):null;
  const checks={input_exact:originalApprox==='0',output_exact:approx==='0',semantic_or_held_structure:fixture.numeric?certificate==='0':output===original,state_preserved:JSON.stringify(before)===JSON.stringify(state())};
  if(fixture.fallback)checks.unsafe_layout_declined=rawHeld==='undef';
  if(fixture.hole)checks.denominator_domains_preserved=['1','true'].includes(ev('xsuholegate(zzhlsemin,zzhlsemout)'));
  const row={...fixture,cm,cv,original,output,originalApprox,approx,certificate,rawHeld,text:ev('string(zzhlsemtext)'),checks,pass:Object.values(checks).every(Boolean)};records.push(row);console.log('CASE_RESULT '+JSON.stringify(row));fs.writeFileSync(path.join(OUT,'held-literal-semantics-partial.json'),JSON.stringify(records,null,2)+'\n');
 }
}
const report={scope:'Current five CAS modules loaded in upstream Giac HP mode, combined source. Numeric-only fixtures use normal(output-input)==0; symbolic fixtures preserve the printed held tree and denominator domains. No physical G2 claim.',modules:Object.fromEntries(MODS.map((n,i)=>[n+'.cas',crypto.createHash('sha256').update(sources[i]).digest('hex')])),records,summary:{total:records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass).length}};
fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'held-literal-semantics.json'),JSON.stringify(report,null,2)+'\n');
console.log('HELD_LITERAL_SEMANTICS '+JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;
