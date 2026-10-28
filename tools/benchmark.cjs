#!/usr/bin/env node
'use strict';
// No packages are installed. The caller must supply an existing trusted Giac JS.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {performance}=require('node:perf_hooks');
const cases=require('./benchmark_cases.cjs');
const ROOT=path.resolve(__dirname,'..');
const MODULES=['scalar','matrix','presentation','posthoc','unified'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const truth=x=>x==='1'||x==='true';
function summary(samples){
  if(!samples.length) return null;
  const sorted=[...samples].sort((a,b)=>a-b),n=sorted.length;
  return {unit:'ms',samples,median:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,min:sorted[0],max:sorted[n-1]};
}
function sourceInfo(dir){
  const modules=MODULES.map(name=>{const p=path.join(dir,name+'.cas');return {name,bytes:fs.readFileSync(p)}});
  const source=modules.map(x=>x.bytes.toString('utf8')).join('\n');
  return {source,sha256:sha(source),modules:Object.fromEntries(modules.map(x=>[x.name+'.cas',sha(x.bytes)]))};
}
function executeChild(args,timeoutMs){
  return new Promise(resolve=>{
    const child=cp.spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stdout='',stderr='',timedOut=false,spawnError=null,done=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
    child.stdout.on('data',b=>{stdout=(stdout+b).slice(-1048576)});
    child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8192)});
    child.on('error',e=>{spawnError=String(e)});
    child.on('close',(code,signal)=>{
      if(done)return;done=true;clearTimeout(timer);
      resolve({exitCode:code,signal,timedOut,spawnError,stdout,stderr});
    });
  });
}
function readWorker(result){
  if(result.timedOut) return {status:'timeout',passed:false,reason:'Parent terminated the isolated desktop worker at its wall-time limit.',stderr:result.stderr};
  if(result.spawnError) return {status:'spawn_error',passed:false,reason:result.spawnError};
  const line=result.stdout.split(/\r?\n/).findLast(x=>x.startsWith('BENCH_RESULT '));
  let record;
  try{record=JSON.parse(line.slice(13))}catch(e){return {status:'worker_error',passed:false,reason:'No valid result record',exitCode:result.exitCode,stderr:result.stderr,stdoutTail:result.stdout.slice(-4096)}}
  if(result.exitCode!==0||!record||record.passed!==true) return {...record,status:'failed',passed:false,exitCode:result.exitCode,stderr:result.stderr};
  return {...record,stderr:result.stderr};
}
function checkTimingFingerprint(record,validation){
  if(!record.passed)return record;
  const matches=typeof record.output==='string'&&record.output===validation.output&&
    record.approximationState===validation.approximationState;
  if(!validation.passed||!matches)return {...record,status:'failed',passed:false,outputFingerprintMatch:false,reason:'Timed result differs from the separately validated stored representation or approximation state; no speed comparison is accepted.'};
  return {...record,outputFingerprintMatch:true};
}
function worker(config){
  const c=cases.find(x=>x.id===config.caseId);
  if(!c)throw Error('Unknown case '+config.caseId);
  global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};
  global.alert=x=>process.stderr.write('GIAC: '+String(x)+'\n');
  const giac=require(config.runtime),ev=giac.cwrap('caseval','string',['string']);
  const info=sourceInfo(config.source);
  // Original one-based modules match the existing repository HP-mode suites.
  ev('calc_mode(-38)');ev('angle_radian(1)');ev('complex_variables('+(c.complexVariables||0)+')');
  ev(info.source);
  const compatibility=ev('XSCHECK(0)');
  if(!/XSIMP .* CHECK OK/.test(compatibility))throw Error('Expression-tree compatibility check failed: '+compatibility);
  ev('zzbenchzero(zz):=BEGIN LOCAL kk; IF type(zz)==DOM_LIST THEN FOR kk FROM 1 TO size(zz) DO IF NOT zzbenchzero(zz[kk]) THEN RETURN 0; END; END; RETURN 1; END; RETURN string(normal(zz))=="0"; END;');
  ev('zzbenchsentinel:=1729');ev('assume(zzbenchpositive>0)');
  const probes={assignedVariable:'string(zzbenchsentinel)',existingAssumption:'sign(zzbenchpositive)',angleBehavior:'string(sin(pi/2))',exactBehavior:'string(1/3)',complexBehavior:'string(sqrt(-1))'};
  const snapshot=()=>Object.fromEntries(Object.entries(probes).map(([k,v])=>[k,ev(v)]));
  const before=snapshot();
  if(!truth(before.existingAssumption))throw Error('Runtime could not establish positive-assumption sentinel: '+before.existingAssumption);
  let result={status:'completed',passed:true,caseId:c.id,phase:config.phase,sourceSha256:info.sha256,runtimeVersion:ev('version()'),compatibility};
  if(config.phase==='timing'){
    for(let k=0;k<config.warmups;k++)ev(c.expression);
    const start=performance.now();
    // The fresh worker has never assigned zzbenchresult; a failed assignment
    // cannot silently reuse a warmup result. Assignment is inside the timer.
    const display=ev('zzbenchresult:='+c.expression);
    const elapsedMs=performance.now()-start;
    const output=ev('string(zzbenchresult)'),approximationState=ev('xsapproxstate(zzbenchresult,0)');
    const representationPass=c.approximate?approximationState==='1':approximationState==='0';
    result={...result,elapsedMs,display,output,approximationState,representationPass,passed:representationPass};
  }else{
    const display=ev('zzbenchresult:='+c.expression);
    const output=ev('string(zzbenchresult)'),approximationState=ev('xsapproxstate(zzbenchresult,0)');
    // State 2 is an incomplete scan, not evidence of exact representation.
    const representationPass=c.approximate?approximationState==='1':approximationState==='0';
    let proof,method;
    if(c.proof==='numeric'){
      proof=ev('evalf(abs(zzbenchresult-('+c.expected+')))');
      method='numeric tolerance 1e-10, not symbolic proof';
    }else if(c.proof==='ratnormal'){
      // Do not send the known complex-radical denominator through simplify.
      ev('zzbenchatomiczero(zz):=BEGIN LOCAL kk; IF type(zz)==DOM_LIST THEN FOR kk FROM 1 TO size(zz) DO IF NOT zzbenchatomiczero(zz[kk]) THEN RETURN 0; END; END; RETURN 1; END; RETURN string(ratnormal(zz))=="0"; END;');
      proof=ev('zzbenchatomiczero(zzbenchresult-('+c.expected+'))');method='exact ratnormal, treating transcendental/radical subexpressions as atoms';
    }else{
      proof=ev('zzbenchzero(zzbenchresult-('+c.expected+'))');method='exact normal';
      if(!truth(proof)){proof=ev('zzbenchzero(simplify(texpand(hyp2exp(pow2exp(zzbenchresult)))-texpand(hyp2exp(pow2exp('+c.expected+')))))');method='exact common exponential basis';}
    }
    const mathPass=c.proof==='numeric'?Number.isFinite(Number(proof))&&Number(proof)<1e-10:truth(proof);
    const checks=(c.checks||[]).map(([name,expression])=>{const actual=ev(expression);return {name,expression,actual,passed:truth(actual)}});
    result={...result,display,output,approximationState,representationPass,mathematics:{passed:mathPass,method,actual:proof},checks,passed:representationPass&&mathPass&&checks.every(x=>x.passed)};
  }
  const after=snapshot(),statePass=JSON.stringify(before)===JSON.stringify(after);
  result.state={before,after,passed:statePass,scope:'Assigned sentinel, one pre-existing positive assumption, and behavioral angle/exact/complex probes only. This is not a complete CAS setting or variable inventory.'};
  result.passed=result.passed&&statePass;
  console.log('BENCH_RESULT '+JSON.stringify(result));
  process.exitCode=result.passed?0:1;
}
function nativePlan(){
  const lines=[
    '// XSIMPKIT Stage 1 manual Prime benchmark commands, NOT an installer.',
    '// Run selected lines in a separate backed-up simulator profile or an authorized test device.',
    '// Do not paste all lines as one long calculation. This file changes no settings or assumptions.',
    '// Record hardware, firmware, source SHA-256, Simplify None/Maximum, Exact, Complex, angle mode.',
    '// Recommended comparison configuration: None, Exact ON, Complex ON, Radians.',
    '// Perform A/B using matching settings and input; 1 warmup then 5 recorded samples.',
    '// time(command) is documented by this repository for the 2019 native simulator.',
    '// Confirm its unit/behavior on the actual firmware. No single CAS call has a hard timeout.',
    '// Abort a slow case manually; report timeout/abort, never turn it into a successful sample.',
    '// Check mathematics, singularities, exactness and user state separately from timings.',
    '// The state/assumption mutation fixtures belong ONLY to disposable desktop workers.',
    '// This generated list does not itself verify native assumptions or every setting.',
    'XSCHECK(0);',''
  ];
  for(const c of cases){
    lines.push('// '+c.id,'// Original domain / boundary: '+c.domain,'// Warmup:',''+c.expression+';','// Run the following timing line five times and record all five values:','time('+c.expression+');','// Separate representation check; expected '+(c.approximate?'1':'0')+'; 2 means scan incomplete:','xsapproxstate('+c.expression+',0);','// Mathematical reference (not executed here): '+c.expected,'');
  }
  // A deliberately non-complex-radical expression for opt-in component timing.
  // All components receive the same quoted original, not prior transformed output.
  const p='((sin(x)^2+cos(x)^2)*(y^6-1)/(y^2-1))+(sqrt(8)-2*sqrt(2))+(exp(i)+exp(-i))/2-cos(1)';
  lines.push('// OPTIONAL COMPONENT PROFILE: select one line at a time.',
    '// Representative expression; original domain y != 1 and y != -1.',
    '// First measure XSIMP, then the individual stages using the same original input.',
    '// The full call includes parsing/tree/presentation work and has different intermediate inputs.',
    '// Stage costs overlap: NEVER add these measurements to estimate total XSIMP time.',
    '// Results are source-level hypotheses until actual measurements are collected.',
    '// No known hazardous closed complex-radical simplify probe is included here.',
    'time(XSIMP('+JSON.stringify(p)+'));',
    'time(xsrewrite(quote('+p+')));',
    'time(xsscalar(quote('+p+')));',
    'time(xstrans(quote('+p+'),1));',
    'time(xstrans(quote('+p+'),2));',
    'time(xstrans(quote('+p+'),5));',
    'time(xsweight(quote('+p+')));','');
  return lines.join('\n');
}
function parseArgs(argv){
  const opts={baseline:path.join(ROOT,'baseline','v1.7','src'),candidate:path.join(ROOT,'src'),runtime:path.join(ROOT,'test_runtime','giac.js'),output:path.join(ROOT,'evidence','stage1_benchmark.json'),samples:5,warmups:1,timeout:30000};
  for(let k=0;k<argv.length;k++){
    const name=argv[k];
    if(name==='--help'){opts.help=true;continue}
    if(name==='--emit-native'){opts.emitNative=argv[++k];if(!opts.emitNative)throw Error('Missing native output path');continue}
    if(!['--baseline','--candidate','--runtime','--output','--samples','--warmups','--timeout','--case'].includes(name))throw Error('Unknown option '+name);
    const value=argv[++k];if(value===undefined)throw Error('Missing value for '+name);
    opts[name.slice(2)]=['--samples','--warmups','--timeout'].includes(name)?Number(value):value;
  }
  if(!Number.isInteger(opts.samples)||opts.samples<1||opts.samples>30)throw Error('--samples must be 1..30');
  if(!Number.isInteger(opts.warmups)||opts.warmups<0||opts.warmups>5)throw Error('--warmups must be 0..5');
  if(!Number.isInteger(opts.timeout)||opts.timeout<100||opts.timeout>300000)throw Error('--timeout must be 100..300000 ms');
  if(opts.case&&!cases.some(x=>x.id===opts.case))throw Error('Unknown case '+opts.case);
  for(const key of ['baseline','candidate','runtime','output'])opts[key]=path.resolve(opts[key]);
  return opts;
}
async function main(argv){
  const o=parseArgs(argv);
  if(o.help){console.log('node tools/benchmark.cjs [--runtime PATH] [--baseline SOURCE_DIR] [--candidate SOURCE_DIR] [--samples 5] [--warmups 1] [--timeout 30000] [--case ID] [--output FILE]\nnode tools/benchmark.cjs --emit-native tests/benchmark_native.cas\nRequires existing trusted upstream giac.js. No install/download. Exit: 0 validated, 1 failure, 2 not executed. Desktop timings are not Prime/G2 timings.');return 0}
  if(o.emitNative){const p=path.resolve(o.emitNative);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,nativePlan(),'utf8');console.log('Wrote manual command plan: '+p);return 0}
  const selected=o.case?cases.filter(x=>x.id===o.case):cases;
  const report={schemaVersion:1,createdUtc:new Date().toISOString(),status:'not_executed',environment:{platform:process.platform,release:os.release(),arch:process.arch,node:process.version,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,scope:'Local upstream Giac JavaScript, HP mode (-38), original one-based modules. Not HP firmware, simulator or physical G2.'},protocol:{samples:o.samples,warmupsPerFreshWorker:o.warmups,timeoutMs:o.timeout,order:'Sequential fresh workers; reverse A/B order on alternate rounds. Validation in separate processes before timings.',timing:'Host performance.now around caseval(zzbenchresult:=expression), including parsing/evaluation/assignment/display marshalling; excludes runtime/source initialization, warmups, post-call fingerprint/type checks and mathematical validation.',timingValidity:'Every sample must match the separately validated stored-output text and approximation state; mismatch or incomplete exactness scan fails and prohibits speed conclusions.',timeoutScope:'Parent wall timeout includes the whole desktop worker. Does not add a timeout to any calculator function.',calibration:'User slowest original expression is unknown; these are representative corpus cases only.'},corpusSha256:sha(fs.readFileSync(path.join(__dirname,'benchmark_cases.cjs'))),variants:{},results:[]};
  const save=()=>{fs.mkdirSync(path.dirname(o.output),{recursive:true});fs.writeFileSync(o.output,JSON.stringify(report,null,2)+'\n','utf8')};
  try{
    for(const name of ['baseline','candidate']){const info=sourceInfo(o[name]);report.variants[name]={directory:o[name],sha256:info.sha256,modules:info.modules}}
  }catch(error){report.reason='Missing source modules: '+String(error);save();console.error(report.reason);return 2}
  if(!fs.existsSync(o.runtime)){report.reason='No existing Giac runtime at '+o.runtime;report.runtime={path:o.runtime,status:'missing'};save();console.error(report.reason);return 2}
  report.runtime={path:o.runtime,sha256:sha(fs.readFileSync(o.runtime))};
  for(const c of selected){
    const row={id:c.id,expression:c.expression,domain:c.domain,expected:c.expected,variants:{}};
    report.results.push(row);
    for(const name of ['baseline','candidate']){
      const config={caseId:c.id,source:o[name],runtime:o.runtime,phase:'validation',warmups:0};
      const validation=readWorker(await executeChild([__filename,'--worker',JSON.stringify(config)],o.timeout));
      if(validation.passed&&validation.sourceSha256!==report.variants[name].sha256){validation.passed=false;validation.status='failed';validation.reason='Source changed after run metadata was captured'}
      row.variants[name]={validation,timings:[],summary:null};
      console.log(c.id+' '+name+' validation '+validation.status);
      save();
    }
    if(Object.values(row.variants).every(v=>v.validation.passed)){
      for(let round=0;round<o.samples;round++){
        for(const name of round%2?['candidate','baseline']:['baseline','candidate']){
          const config={caseId:c.id,source:o[name],runtime:o.runtime,phase:'timing',warmups:o.warmups};
          const record=checkTimingFingerprint(readWorker(await executeChild([__filename,'--worker',JSON.stringify(config)],o.timeout)),row.variants[name].validation);
          if(record.passed&&(record.sourceSha256!==report.variants[name].sha256||!Number.isFinite(record.elapsedMs))){record.passed=false;record.status='failed';record.reason='Source changed or worker measurement is invalid'}
          row.variants[name].timings.push({round,...record});
          console.log(c.id+' '+name+' sample '+(round+1)+' '+record.status);
          save();
          if(!record.passed)break;
        }
        if(Object.values(row.variants).some(v=>v.timings.some(t=>!t.passed)))break;
      }
    }else row.timingStatus='not_executed: mathematical, representation or state validation did not pass in both variants';
    for(const v of Object.values(row.variants))v.summary=summary(v.timings.filter(t=>t.passed&&Number.isFinite(t.elapsedMs)).map(t=>t.elapsedMs));
    row.passed=Object.values(row.variants).every(v=>v.validation.passed&&v.timings.length===o.samples&&v.timings.every(t=>t.passed));
    if(row.passed){row.candidateOverBaselineMedian=row.variants.candidate.summary.median/row.variants.baseline.summary.median;row.outputTextSame=row.variants.baseline.validation.output===row.variants.candidate.validation.output}
    save();
  }
  report.status=report.results.every(r=>r.passed)?'passed':'failed';
  report.summary={cases:report.results.length,passed:report.results.filter(r=>r.passed).length,failed:report.results.filter(r=>!r.passed).length};
  save();console.log(JSON.stringify(report.summary));return report.status==='passed'?0:1;
}
module.exports={summary,sourceInfo,executeChild,readWorker,checkTimingFingerprint,nativePlan,parseArgs,main};
if(require.main===module){
  if(process.argv[2]==='--worker'){
    try{worker(JSON.parse(process.argv[3]))}catch(error){console.log('BENCH_RESULT '+JSON.stringify({status:'worker_error',passed:false,reason:String(error),stack:error.stack}));process.exitCode=1}
  }else main(process.argv.slice(2)).then(code=>{process.exitCode=code}).catch(error=>{console.error(String(error));process.exitCode=1});
}
