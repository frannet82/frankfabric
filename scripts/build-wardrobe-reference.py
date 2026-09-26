"""Derive wardrobe-only meshes from the bundled rig; never alter shared originals."""
import json, math, struct
from pathlib import Path
SOURCE = Path('public/models/characters/drophunter')
DEST = Path('public/models/wardrobe-reference')

def load(name):
    data = (SOURCE / name).read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20+length]), bytearray(data[28+length:])

def access(doc, binary, index):
    acc = doc['accessors'][index]
    width = {'VEC2':2, 'VEC3':3, 'VEC4':4}[acc['type']]
    if 'sparse' in acc:
        sparse=acc.pop('sparse'); values=[[0.0]*width for _ in range(acc['count'])]
        iv=doc['bufferViews'][sparse['indices']['bufferView']]; vv=doc['bufferViews'][sparse['values']['bufferView']]
        fmt={5121:'B',5123:'H',5125:'I'}[sparse['indices']['componentType']]
        for i in range(sparse['count']):
            slot=struct.unpack_from('<'+fmt,binary,iv.get('byteOffset',0)+sparse['indices'].get('byteOffset',0)+i*struct.calcsize(fmt))[0]
            values[slot]=struct.unpack_from('<'+'f'*width,binary,vv.get('byteOffset',0)+sparse['values'].get('byteOffset',0)+i*width*4)
        binary+=b'\0'*((-len(binary))%4); offset=len(binary)
        flat=[v for row in values for v in row];binary.extend(struct.pack('<'+'f'*len(flat),*flat))
        acc['bufferView']=len(doc['bufferViews']);acc['byteOffset']=0
        doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(flat)*4})
    view = doc['bufferViews'][acc['bufferView']]
    start = view.get('byteOffset',0) + acc.get('byteOffset',0)
    stride = view.get('byteStride',width*4)
    assert acc['componentType'] == 5126
    return [list(struct.unpack_from('<'+'f'*width,binary,start+i*stride)) for i in range(acc['count'])], lambda i,v: struct.pack_into('<'+'f'*width,binary,start+i*stride,*v)

def face_point(p):
    # Retain the authored anime face and full-sized eye sockets.
    return list(p)

def reshape(doc,binary,primitive,transform):
    index=primitive['attributes']['POSITION']; original,write=access(doc,binary,index)
    points=[transform(p) for p in original]
    for i,p in enumerate(points): write(i,p)
    doc['accessors'][index]['min']=[min(p[k] for p in points) for k in range(3)]
    doc['accessors'][index]['max']=[max(p[k] for p in points) for k in range(3)]
    for target in primitive.get('targets',[]):
        if 'POSITION' not in target: continue
        deltas,write_delta=access(doc,binary,target['POSITION'])
        for i,d in enumerate(deltas):
            q=transform([a+b for a,b in zip(original[i],d)])
            write_delta(i,[a-b for a,b in zip(q,points[i])])

def standard(mat):
    mat.pop('extensions',None)
    mat['pbrMetallicRoughness']['metallicFactor']=0
    mat['pbrMetallicRoughness']['roughnessFactor']=.8

def save(doc,binary,name):
    doc['buffers'][0]['byteLength']=len(binary)
    raw=json.dumps(doc,separators=(',',':')).encode(); raw+=b' '*((-len(raw))%4)
    binary+=b'\0'*((-len(binary))%4)
    (DEST/name).write_bytes(struct.pack('<III',0x46546c67,2,28+len(raw)+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary)

def build():
    for name,target in [('body.vrm','body.vrm'),('eyes/regulareyes.vrm','eyes.vrm')]:
        doc,binary=load(name)
        for mesh in doc['meshes']:
            if 'head' in mesh.get('name',''):
                for primitive in mesh['primitives']: reshape(doc,binary,primitive,face_point)
        for mat in doc['materials']: standard(mat)
        save(doc,binary,target)

    doc,binary=load('head/swept.vrm')
    for mat in doc['materials']:
        standard(mat)
        mat['pbrMetallicRoughness']['roughnessFactor']=.72
    save(doc,binary,'bob.vrm')
    print('Created wardrobe anime face, full-size eyes and swept bob.')

if __name__ == '__main__':
    build()
