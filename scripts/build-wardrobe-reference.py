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
    x,y,z=p
    # Shrink the large anime eye sockets and the matching eye mesh together.
    eye_x = .045 if x >= 0 else -.045
    gate = max(0,min(1,(z-.035)/.025))
    weight = math.exp(-((x-eye_x)/.046)**4 - ((y-1.38)/.041)**4) * gate
    x += (eye_x-x)*.20*weight
    y += (1.38-y)*.34*weight
    z += .005*math.exp(-(x/.018)**2-((y-1.347)/.025)**2)*gate
    # Less pointed chin and more defined jaw.
    x *= 1 + .06*math.exp(-((y-1.305)/.022)**2)*gate
    return [x,y,z]

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

for name,target in [('body.vrm','body.vrm'),('eyes/regulareyes.vrm','eyes.vrm')]:
    doc,binary=load(name)
    for mesh in doc['meshes']:
        if 'head' in mesh.get('name',''):
            for primitive in mesh['primitives']: reshape(doc,binary,primitive,face_point)
    for mat in doc['materials']: standard(mat)
    if name=='body.vrm':
        image=len(doc['images']); doc['images'].append({'uri':'face-albedo.png'})
        texture=len(doc['textures']); doc['textures'].append({'source':image,'sampler':0})
        for mat in doc['materials']:
            if mat['name']=='Face': mat['pbrMetallicRoughness']['baseColorTexture']={'index':texture}
            elif mat['name']=='skin': mat['pbrMetallicRoughness']['baseColorFactor']=[.72,.48,.34,1]
        # Match the generated atlas's nose, lips and chin to the original UV islands.
        for mesh in doc['meshes']:
            for primitive in mesh['primitives']:
                if doc['materials'][primitive['material']]['name']!='Face': continue
                uv,write=access(doc,binary,primitive['attributes']['TEXCOORD_0'])
                anchors=[(0,0),(.30,.30),(.425,.45),(.50,.54),(.60,.70),(.80,.80),(1,1)]
                for i,(u,v) in enumerate(uv):
                    mapped=v
                    for (a,b),(c,d) in zip(anchors,anchors[1:]):
                        if a<=v<=c: mapped=b+(v-a)/(c-a)*(d-b);break
                    weight=math.exp(-((v-.50)/.048)**2)*math.exp(-((u-.5)/.13)**4)
                    write(i,[.5+(u-.5)*(1+.5*weight),mapped])
    save(doc,binary,target)

doc,binary=load('head/straight.vrm')
def bob(p):
    x,y,z=p
    # Lift the central fringe clear of the brows; lengthen the sides to shoulders.
    front=max(0,min(1,(z-.055)/.035))
    center=max(0,1-(abs(x+.012)/.088)**2)
    lift=front*center*max(0,min(1,(1.505-y)/.07))
    y+=.066*lift
    if y<1.40: y=1.40+(y-1.40)*1.35
    return [x,y,z]
for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        reshape(doc,binary,primitive,bob)
        positions,_=access(doc,binary,primitive['attributes']['POSITION'])
        colors=[]
        for x,y,z in positions:
            root=max(0,min(1,(1.50-y)/.085))
            strand=.91+.09*math.sin(math.atan2(x,z)*95+y*12)
            shade=(.40+.60*root)*strand
            colors.extend([shade,shade,shade])
        binary+=b'\0'*((-len(binary))%4);offset=len(binary)
        binary.extend(struct.pack('<'+'f'*len(colors),*colors))
        view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(colors)*4,'target':34962})
        idx=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(positions),'type':'VEC3'})
        primitive['attributes']['COLOR_0']=idx
for mat in doc['materials']:
    standard(mat);mat['pbrMetallicRoughness'].pop('baseColorTexture',None)
    mat['pbrMetallicRoughness']['roughnessFactor']=.55
save(doc,binary,'bob.vrm')
print('Created wardrobe-specific body, eyes and shoulder-length bob.')
