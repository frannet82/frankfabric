"""Coach-only reference appearance; keep the exercise rig and expression targets."""
import importlib.util, math, struct, sys
sys.dont_write_bytecode = True
from pathlib import Path
spec=importlib.util.spec_from_file_location('mesh_tools',Path(__file__).with_name('build-wardrobe-reference.py'))
tools=importlib.util.module_from_spec(spec);spec.loader.exec_module(tools)
tools.DEST=Path('public/models/coach-reference')

def face(p):
    return list(p)

for name,target in [('body.vrm','body.vrm'),('eyes/regulareyes.vrm','eyes.vrm')]:
    doc,binary=tools.load(name)
    for mesh in doc['meshes']:
        if 'head' in mesh.get('name',''):
            for primitive in mesh['primitives']: tools.reshape(doc,binary,primitive,face)
    for mat in doc['materials']: tools.standard(mat)
    tools.save(doc,binary,target)

# Keep the authored anime hair locks; extend only the lower sides and back.
doc,binary=tools.load('head/straight.vrm')
def hair(p):
    x,y,z=p
    if y<1.36: y=1.36+(y-1.36)*2.4
    return [x,y,z]
for mesh in doc['meshes']:
    for primitive in mesh['primitives']: tools.reshape(doc,binary,primitive,hair)
for mat in doc['materials']:
    tools.standard(mat)
    mat['pbrMetallicRoughness']['roughnessFactor']=.72
tools.save(doc,binary,'waves.vrm')
print('Created coach anime face, full-size eyes and long layered hair.')
