from pathlib import Path
import subprocess,os,json
root=Path(__file__).resolve().parents[1];out=root/'validation/revision187/final-legacy';out.mkdir(parents=True,exist_ok=True)
preload=root/'validation/revision187/legacy/actual_installer_preload.cjs'
# The preload root depth is unchanged at final-legacy/.
(out/'actual_installer_preload.cjs').write_text(preload.read_text())
items=['held_literal_semantics.cjs','held_marker_runtime.cjs','hyperbolic_public_runtime.cjs','hyperbolic_final_holes.cjs','hyperbolic_angle_modes.cjs','index_guard_runtime.cjs','weighted_exponential_runtime.cjs']
rows=[]
for name in items:
 dest=out/name.replace('.cjs','');dest.mkdir(exist_ok=True)
 env=os.environ.copy();env.update(XS_RUNTIME_REPORT_DIR=str(dest),XS_LOADER_COMMANDS=str(root/'dist/v1.8.7-installer/installer_commands.json'))
 if name in ['held_literal_semantics.cjs','held_marker_runtime.cjs']:env['NODE_OPTIONS']='--require='+str(out/'actual_installer_preload.cjs')
 if name=='held_literal_semantics.cjs':env['XS_SKIP_FIXTURE']='unknown_and_string_data'
 with (out/(name+'.log')).open('w') as log:
  try:
   p=subprocess.run(['node','tests/'+name],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=45);row={'test':name,'exit_code':p.returncode}
  except subprocess.TimeoutExpired:row={'test':name,'timeout_seconds':45}
 rows.append(row);(out/'RUN.json').write_text(json.dumps(rows,indent=2));print(row,flush=True)
source=(root/'validation/revision187/legacy/fresh_installer_runtime.cjs').read_text();(out/'fresh_installer_runtime.cjs').write_text(source)
with (out/'fresh-runtime.log').open('w') as log:
 p=subprocess.run(['node',str(out/'fresh_installer_runtime.cjs')],cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=45)
rows.append({'test':'fresh_installer_runtime.cjs','exit_code':p.returncode});(out/'RUN.json').write_text(json.dumps(rows,indent=2));print(rows[-1],flush=True)
