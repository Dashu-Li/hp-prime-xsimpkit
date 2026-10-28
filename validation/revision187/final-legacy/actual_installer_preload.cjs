'use strict';
// Evidence-only adaptation: tests with a direct combined-source load instead
// execute the exact newly built 1.8.7 installer CAS commands in this fresh HOST.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..'),MODS=['scalar','matrix','presentation','posthoc','unified'];
const sources=MODS.map(n=>fs.readFileSync(path.join(ROOT,'src',n+'.cas'),'utf8')),combined=sources.join('\n\n');
if(!global.UI)global.UI={warnpy:false,Datestart:Date.now(),python_output:'',add_python_output(){},clean_for_html(x){return x}};
if(!global.alert)global.alert=()=>{};
const runtime=require(path.join(ROOT,'test_runtime/giac.js')),originalWrap=runtime.cwrap;
const {loadRuntime}=require(path.join(ROOT,'tests/runtime_loader.cjs'));
runtime.cwrap=function(...args){
 const raw=originalWrap.apply(this,args);if(args[0]!=='caseval')return raw;
 return function(command){
  if(command!==combined)return raw(command);
  const evidence=loadRuntime(raw,{root:ROOT,sources});
  if(evidence.mode!=='installer_commands'||evidence.finalStoredFunctionCount!==105)throw Error('Preload did not load the actual105 installer commands');
  const out=path.resolve(process.env.XS_RUNTIME_REPORT_DIR||__dirname),file=path.join(out,path.basename(process.argv[1])+'.actual-installer-load.json');
  fs.writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');return '1';
 };
};
