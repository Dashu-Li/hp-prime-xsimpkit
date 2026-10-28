'use strict';
// Host loader for two distinct paths. The command path reproduces the CAS
// commands of the installer; it does not exercise the PPL/CAS bridge or G2.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MODS=['scalar','matrix','presentation','posthoc','unified'];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function loadRuntime(ev,{root,sources,useCommands=true}){
 const source=sources.join('\n\n');
 const moduleHashes=Object.fromEntries(MODS.map((n,i)=>[n+'.cas',sha(sources[i])]));
 const selected=useCommands&&process.env.XS_LOADER_COMMANDS;
 if(!selected){
  ev(source);
  return {mode:'combined_source',scope:'Upstream Giac HP mode; one combined source parse, not native Prime/G2',sourceSha256:sha(source),moduleHashes};
 }
 const commandsPath=path.resolve(selected),manifestPath=path.join(path.dirname(commandsPath),'INSTALLER_MANIFEST.json');
 const raw=fs.readFileSync(commandsPath,'utf8'),items=JSON.parse(raw),manifestRaw=fs.readFileSync(manifestPath,'utf8'),manifest=JSON.parse(manifestRaw);
 if(!Array.isArray(items)||items.length!==manifest.functions)throw Error('Installer command count disagrees with manifest');
 if(JSON.stringify(moduleHashes)!==JSON.stringify(manifest.modulehash))throw Error('Installer module hashes differ from tested source');
 const names=items.map(x=>x.name);
 if(new Set(names).size!==names.length||JSON.stringify(names)!==JSON.stringify(manifest.function_names))throw Error('Installer names are not unique or differ from manifest');
 const indexSetter=ev(manifest.index_setter),indexVerification=ev(manifest.index_verification);
 if(indexVerification!=='1')throw Error('Installer index verification did not return 1: '+indexVerification);
 const rows=[];
 for(const item of items){
  if(typeof item.command!=='string'||sha(item.command)!==item.command_sha256)throw Error('Installer command checksum mismatch: '+item.name);
  const result=ev(item.command),type=ev('type('+item.name+')'),pass=result==='1'&&type==='DOM_FUNC';
  rows.push({name:item.name,commandSha256:item.command_sha256,result,type,pass});
  if(!pass)throw Error('Installer definition failed '+item.name+': command='+result+'; type='+type);
 }
 const finalStoredTypes=names.map(name=>({name,type:ev('type('+name+')')}));
 const missing=finalStoredTypes.filter(row=>row.type!=='DOM_FUNC');
 if(missing.length)throw Error('Installer final global registration check failed: '+JSON.stringify(missing));
 return {mode:'installer_commands',scope:'Upstream Giac HP mode; sequential installer CAS expr commands only; independently checks stored global types after each command and all names after loading; does not validate PPL strings, CAS.expr bridge or G2 compatibility',commandsPath,commandsSha256:sha(raw),manifestPath,manifestSha256:sha(manifestRaw),sourceSha256:sha(source),moduleHashes,expectedFunctions:manifest.functions,loadedFunctions:rows.length,indexSetter,indexVerification,definitions:rows,finalStoredTypes,finalStoredFunctionCount:finalStoredTypes.length};
}
module.exports={loadRuntime};
