"""Run in Blender's Python console or through Blender MCP. Dimensions are metres.

Authored game coordinates: X right, Y up, -Z forward. Convert once at creation.
Only replaces the named character collection, leaving other scene work intact.
"""
import bpy
import math
import bmesh
from pathlib import Path
from mathutils import Vector

PROJECT = Path('/Users/sudhir/Desktop/create/experiment/port')
COLLECTION = 'Sankaran_Character'
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
old = bpy.data.collections.get(COLLECTION)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
collection = bpy.data.collections.new(COLLECTION)
bpy.context.scene.collection.children.link(collection)

def coord(p):
    return Vector((p[0], -p[2], p[1]))

def own(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def material(name, color, roughness=.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    # Hex values are sRGB; Blender shader values are linear.
    rgb = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    p.inputs['Base Color'].default_value = (*rgb,1)
    p.inputs['Roughness'].default_value = roughness
    m.diffuse_color = (*rgb,1)
    return m

skin=material('SP warm terracotta skin','DDA27E',.78)
inner=material('SP ear and lip','BB7C5D')
hair=material('SP charcoal hair','272321',.87)
shirt=material('SP powder blue cotton','C3DFE9',.88)
collar=material('SP blue collar seam','8CACBB')
cloth=material('SP ivory cotton','F7F3EC',.92)
gold=material('SP woven gold border','CEAE6B')
mouth=material('SP mouth cavity','341F20')
tongue=material('SP tongue','C9777B')
tooth=material('SP teeth','FFF4DA')
strap=material('SP backpack straps','476859')
parts=[]

def weight(obj,bone):
    group=obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')

def finish(obj,name,mat,bone):
    own(obj);obj.name=name
    obj.data.materials.append(mat)
    for f in obj.data.polygons:f.use_smooth=True
    if bone:weight(obj,bone)
    parts.append(obj)
    return obj

def ellipsoid(name,p,s,mat,bone,segments=24,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=coord(p))
    obj=bpy.context.object;obj.scale=(s[0],s[2],s[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat,bone)

def tube(name,points,radius,mat,bone):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2
    c.bevel_depth=radius;c.bevel_resolution=2
    sp=c.splines.new('POLY');sp.points.add(len(points)-1)
    for pt,p in zip(sp.points,points):pt.co=(*coord(p),1)
    obj=bpy.data.objects.new(name,c);collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat,bone)

def mesh(name,verts,faces,mat,bone=None):
    data=bpy.data.meshes.new(name);data.from_pydata([coord(v) for v in verts],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj)
    return finish(obj,name,mat,bone)

def ringmesh(name,rows,mat,bone,segments=48):
    # Interpolate the profile so broad belly curvature has no horizontal bands.
    dense=[]
    for j in range(len(rows)-1):
        p0=rows[max(0,j-1)];p1=rows[j];p2=rows[j+1];p3=rows[min(len(rows)-1,j+2)]
        for k in range(5):
            t=k/5
            dense.append(tuple(.5*((2*p1[c])+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t*t+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t*t*t) for c in range(4)))
    rows=dense+[rows[-1]]
    v=[];f=[]
    for y,rx,rz,zc in rows:
        for i in range(segments):
            a=2*math.pi*i/segments
            v.append((math.sin(a)*rx,y,zc+math.cos(a)*rz))
    for j in range(len(rows)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            f.append((a,b,b+segments,a+segments))
    f.append(tuple(reversed(range(segments))))
    f.append(tuple((len(rows)-1)*segments+i for i in range(segments)))
    return mesh(name,v,f,mat,bone)

# Smooth, connected cloth and limbs replace the first pass's separate spheres.
def new_modifier(obj, name, kind):
    choices=bpy.types.Modifier.bl_rna.properties['type'].enum_items
    ident=next(i.identifier for i in choices if i.identifier==kind)
    return obj.modifiers.new(name,ident)

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True);bpy.context.view_layer.objects.active=obj

def fuse(objects,name,voxel=.009,ratio=.5):
    for o in objects:
        if o in parts:parts.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    rem=new_modifier(o,'Continuous surface','REMESH')
    rem.mode=next(i.identifier for i in rem.bl_rna.properties['mode'].enum_items if 'VOXEL' in i.identifier)
    rem.voxel_size=voxel;rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=new_modifier(o,'Relax surface','SMOOTH');sm.factor=.85;sm.iterations=4
    bpy.ops.object.modifier_apply(modifier=sm.name)
    dec=new_modifier(o,'Game topology','DECIMATE');dec.ratio=ratio
    bpy.ops.object.modifier_apply(modifier=dec.name)
    o.vertex_groups.clear()
    for poly in o.data.polygons:poly.use_smooth=True
    parts.append(o)
    return o

def blendweights(obj, kind):
    for v in obj.data.vertices:
        # All fused objects have transforms baked, so these are game coordinates.
        x,z,y=v.co.x,-v.co.y,v.co.z
        values=shirt_weights(x,y,z) if kind=='shirt' else arm_weights(x,y,z)
        for name,w in values.items():
            if w>.00001:
                group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                group.add([v.index],w,'REPLACE')

def smoothstep(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)))
    return t*t*(3-2*t)

def swept(name,start,end,radii,mat,bone=None,segments=40):
    start=Vector(start);end=Vector(end);axis=(end-start).normalized()
    u=Vector((0,0,1));v=axis.cross(u).normalized()
    vertices=[];faces=[]
    for t,r in radii:
        c=start.lerp(end,t)
        for j in range(segments):
            a=j*math.tau/segments
            vertices.append(c+u*(math.cos(a)*r)+v*(math.sin(a)*r))
    for row in range(len(radii)-1):
        for j in range(segments):
            k=row*segments+j;n=row*segments+(j+1)%segments
            faces.append((k,n,n+segments,k+segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(radii)-1)*segments+j for j in range(segments)))
    return mesh(name,vertices,faces,mat,bone)

def difference(obj,cutter):
    activate(obj)
    mod=new_modifier(obj,'Sculpted opening','BOOLEAN')
    mod.operation=next(i.identifier for i in mod.bl_rna.properties['operation'].enum_items if i.identifier=='DIFFERENCE')
    mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if cutter in parts:parts.remove(cutter)
    bpy.data.objects.remove(cutter,do_unlink=True)

# A fuller lower belly and sloped shoulders, with actual short sleeve openings.
torso=ringmesh('Cotton shirt',[(.875,.355,.26,-.02),(.89,.39,.292,-.04),(.93,.417,.321,-.06),(1.015,.438,.337,-.072),(1.10,.43,.321,-.06),(1.19,.394,.287,-.035),(1.28,.35,.239,-.006),(1.355,.318,.204,.008),(1.407,.267,.17,.008),(1.45,.175,.135,0),(1.46,.154,.12,0)],shirt,None,64)
sleeve_parts=[torso]
for side in (-1,1):
    sleeve_parts.append(swept('Tailored sleeve',(side*.265,1.38,0),(side*.485,1.225,0),[(0,.12),(.32,.127),(.72,.122),(1,.113)],shirt))
top=fuse(sleeve_parts,'Continuous shirt',.008,.38)
for side in (-1,1):
    start=Vector((side*.265,1.38,0));end=Vector((side*.485,1.225,0));axis=(end-start).normalized()
    cutter=swept('Sleeve interior',end-axis*.06,end+axis*.16,[(0,.080),(.3,.089),(1,.089)],shirt)
    difference(top,cutter)
def shirt_weights(x,y,z):
    arm=smoothstep(.28,.49,abs(x))*smoothstep(1.15,1.24,y)
    return {'body':1-arm,('upper_arm.L' if x<0 else 'upper_arm.R'):arm}
blendweights(top,'shirt')
ellipsoid('Neck',(0,1.47,0),(.16,.115,.135),skin,'head')
tube('Stitched collar',[(math.sin(i*math.tau/56)*.158,1.452,math.cos(i*math.tau/56)*.128) for i in range(57)],.008,collar,'body')

# Broad round head with a real recessed mouth, instead of a tall egg and a
# black oval pasted onto its front. Small features follow the curved face.
head=ellipsoid('Round head',(0,1.818,-.012),(.505,.438,.385),skin,'head',64,48)
def facez(x,y):
    return -.012-.385*math.sqrt(max(.01,1-(x/.505)**2-((y-1.818)/.438)**2))
cut=ellipsoid('Mouth opening',(.018,1.697,-.374),(.079,.078,.095),skin,None,40,28)
head.data.materials.append(mouth);cut.data.materials.append(mouth)
for poly in cut.data.polygons:poly.material_index=1
difference(head,cut)
weight(head,'head')
ellipsoid('Recessed mouth',(.018,1.696,-.306),(.076,.074,.036),mouth,'head',32,24)
ellipsoid('Tongue',(.025,1.650,-.364),(.046,.022,.018),tongue,'head',24,16)
ellipsoid('Upper teeth',(.008,1.752,-.380),(.048,.010,.015),tooth,'head',24,12)
for side in (-1,1):
    ellipsoid('Ear',(side*.488,1.774,.008),(.065,.094,.059),skin,'head',28,20)
    ellipsoid('Soft ear concha',(side*.507,1.773,-.045),(.024,.05,.012),inner,'head',24,16)
    # Short inner curl rather than the previous full earring-like outline.
    tube('Ear fold',[(side*(.503+.012*math.sin(t)),1.78+.038*math.cos(t),-.056) for t in [i*math.pi/16 for i in range(17)]],.009,skin,'head')
    x=side*.164
    eye=[]
    for i in range(21):
        t=i*math.pi/20;ex=x+.039*math.cos(t);ey=1.925-.048*math.sin(t)
        eye.append((ex,ey,facez(ex,ey)-.004))
    tube('Closed expressive eye',eye,.009,hair,'head')
    ex=x-side*.014;ey=1.990
    tube('Small brow',[(ex-.008,ey-.004,facez(ex-.008,ey-.004)-.004),(ex,ey+.003,facez(ex,ey+.003)-.004),(ex+.009,ey,facez(ex+.009,ey)-.004)],.005,hair,'head')
    ellipsoid('Side hair mass',(side*.478,1.863,.075),(.032,.082,.138),hair,'head',24,16)
    for j in range(15):
        z=-.042+j*.016
        points=[(side*.471,1.846,z),(side*.493,1.895,z+.015),(side*(.486+.006*math.sin(j)),1.959-.01*abs(j-6),z+.04)]
        tube('Combed hair tuft',points,.007,hair,'head')
    # A thicker, wider moustache with softly tapered ends.
    ellipsoid('Moustache lobe',(side*.066,1.801,-.402),(.082,.033,.033),hair,'head',24,16)
    for j in range(7):
        x=side*(.022+j*.017)
        tube('Moustache hair',[(x*.90,1.823,-.410),(x,1.794,-.426),(x+side*.011,1.778+.004*j,-.408)],.0055,hair,'head')
ellipsoid('Small round nose',(0,1.851,-.400),(.049,.044,.041),skin,'head',32,24)

bones=[('root',(0,0,0),None),('body',(0,0,0),'root'),('head',(0,1.46,0),'body')]
for side,label in [(-1,'L'),(1,'R')]:
    shoulder=side*.365;elbow=side*.48;wrist=side*.5
    bones += [(f'upper_arm.{label}',(shoulder,1.40,0),'body'),(f'forearm.{label}',(elbow,1.09,0),f'upper_arm.{label}'),(f'hand.{label}',(wrist,.83,-.018),f'forearm.{label}'),(f'thigh.{label}',(side*.13,.78,0),'root'),(f'shin.{label}',(side*.13,.45,0),f'thigh.{label}'),(f'foot.{label}',(side*.13,.11,0),f'shin.{label}')]
    # Smooth arm/wrist/palm surface, fused to the fingers before weighting.
    v=[];f=[];segments=32
    rows=[(1.345,side*.399,.066,.066,0),(1.29,side*.425,.066,.065,0),(1.22,side*.454,.065,.063,0),(1.15,side*.493,.060,.059,0),(1.09,elbow,.056,.056,0),(1.04,side*.486,.059,.058,-.004),(.96,side*.498,.055,.049,-.01),(.89,wrist,.041,.039,-.015),(.847,wrist,.039,.035,-.018),(.815,wrist,.055,.034,-.023),(.777,wrist,.064,.032,-.027),(.750,wrist,.057,.028,-.028)]
    for y,cx,rx,rz,zc in rows:
        for j in range(segments):
            a=j*math.tau/segments;v.append((cx+rx*math.sin(a),y,zc+rz*math.cos(a)))
    for row in range(len(rows)-1):
        for j in range(segments):
            a=row*segments+j;b=row*segments+(j+1)%segments
            f.append((a,a+segments,b+segments,b))
    f.append(tuple(range(segments)));f.append(tuple(reversed([(len(rows)-1)*segments+j for j in range(segments)])))
    arm_parts=[mesh('Arm and palm',v,f,skin)]
    finger_info=[]
    names=['pinky','ring','middle','index'] if side<0 else ['index','middle','ring','pinky']
    for j,name in enumerate(names):
        x=wrist+(j-1.5)*.032
        length={'pinky':.061,'ring':.080,'middle':.087,'index':.078}[name]
        bones.append((f'{name}.{label}',(x,.762,-.027),f'hand.{label}'))
        finger_info.append((x,name,length))
        arm_parts.append(ellipsoid('Finger',(x,.756-length*.5,-.029),(.0125,length*.63,.0165),skin,None,20,14))
    tx=wrist-side*.065
    bones.append((f'thumb.{label}',(tx,.805,-.021),f'hand.{label}'))
    arm_parts.append(ellipsoid('Thumb root',(wrist-side*.052,.803,-.019),(.028,.035,.03),skin,None,20,14))
    arm_parts.append(swept('Thumb', (wrist-side*.061,.809,-.025),(wrist-side*.083,.752,-.04),[(0,.023),(.45,.024),(1,.013)],skin))
    arm_parts.append(ellipsoid('Thumb tip',(wrist-side*.083,.752,-.04),(.014,.017,.014),skin,None,16,12))
    arm_mesh=fuse(arm_parts,'Continuous arm '+label,.0048,.22)
    def arm_weights(x,y,z):
        if y>1.01:
            upper=smoothstep(1.035,1.155,y)
            return {f'upper_arm.{label}':upper,f'forearm.{label}':1-upper}
        if y>.825:
            fore=smoothstep(.835,.9,y)
            return {f'forearm.{label}':fore,f'hand.{label}':1-fore}
        # Thumb is on the inner edge; other fingers are separated by their x.
        if (x-wrist)*side < -.055:
            w=smoothstep(.045,.079,abs(x-wrist))
            return {f'thumb.{label}':w,f'hand.{label}':1-w}
        closest=min((abs(item[0]-x),item[1]) for item in finger_info)[1]
        w=1-smoothstep(.729,.782,y)
        return {f'{closest}.{label}':w,f'hand.{label}':1-w}
    blendweights(arm_mesh,'arm')
    ellipsoid('Thigh',(side*.13,.623,0),(.096,.2,.09),skin,f'thigh.{label}')
    ellipsoid('Calf',(side*.13,.297,0),(.075,.195,.072),skin,f'shin.{label}')
    footparts=[ellipsoid('Bare foot',(side*.13,.068,-.061),(.093,.061,.146),skin,None,28,16)]
    for j in range(5):
        footparts.append(ellipsoid('Toe',(side*.13+(j-2)*.033,.05,-.178+.009*abs(j-1)),(.021,.025,.034),skin,None,16,12))
    foot=fuse(footparts,'Soft bare foot '+label,.006,.4);weight(foot,f'foot.{label}')

# Single mesh garment with seated corrective. No leg weights pull the skirt apart.
verts=[];faces=[];seat=[];stripes=[]
N=64
levels=[0,.07,.18,.32,.46,.60,.74,.86,.91,.925,.945,.968,.982,1]
for t in levels:
    for i in range(N):
        a=i/N*math.tau;fold=(.007+.010*t)*math.cos(a*7+.24*t)+.004*math.sin(a*3+t*2)
        x=math.sin(a)*(.379+.029*t+fold)
        z=math.cos(a)*(.276+.024*t+fold)
        verts.append((x,.91-.75*t,z));seat.append((x,.59-.37*t,z-.46*t))
for j in range(len(levels)-1):
    for i in range(N):
        a=j*N+i;b=j*N+(i+1)%N
        faces.append((a,a+N,b+N,b));stripes.append(j in (8,11))
start=len(verts);C=9
for t in levels:
    for i in range(C):
        u=i/(C-1);x=-.042+u*(.151+.022*t);z=-.299-.014*t-.022*math.sin(u*math.pi)-.009*math.cos(u*math.pi*4)
        verts.append((x,.917-.787*t,z));seat.append((x,.597-.417*t,z-.46*t))
for j in range(len(levels)-1):
    for i in range(C-1):
        a=start+j*C+i
        faces.append((a,a+1,a+C+1,a+C));stripes.append(j in (8,11))
dhoti=mesh('Dhoti',verts,faces,cloth,'root');dhoti.data.materials.append(gold)
for p,s in zip(dhoti.data.polygons,stripes):p.material_index=int(s)
dhoti.shape_key_add(name='Basis');sk=dhoti.shape_key_add(name='Seated')
for v,p in zip(sk.data,seat):v.co=coord(p)
# Double-sided fabric in glTF (no backface culling).
cloth.use_backface_culling=False;gold.use_backface_culling=False
parts.remove(dhoti)

# Preserve a separate accessory group for the gameplay luggage state.
harness=[]
for side in (-1,1):
    o=tube('Backpack strap',[(side*.205,1.38,-.174),(side*.23,1.24,-.254),(side*.25,1.05,-.357)],.023,strap,'body')
    harness.append(o);parts.remove(o)

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();o=bpy.context.object;o.name=name
    # Bake the final object transform, keeping mesh and skeleton origins identical.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return o

bodymesh=join(parts,'Sankaran_Body')
# Boolean sleeve rims must not introduce flat patches on the cotton surface.
for polygon in bodymesh.data.polygons:polygon.use_smooth=True
bm=bmesh.new();bm.from_mesh(bodymesh.data)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(bodymesh.data);bm.free()
harnessmesh=join(harness,'Harness')
arm=bpy.data.armatures.new('Sankaran skeleton');rig=bpy.data.objects.new('Sankaran_Rig',arm);collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,p,parent in bones:
    b=arm.edit_bones.new(name);b.head=coord(p);b.tail=b.head+Vector((0,0,.09));b.roll=0
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
for obj in (bodymesh,dhoti,harnessmesh):
    obj.parent=rig
    mod=obj.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig
for b in rig.pose.bones:b.rotation_mode='XYZ'

# Reusable clips, also useful for inspecting the rig outside this game.
def clearpose():
    for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)

rig.animation_data_create()
for clip,length in [('Idle',48),('Walk',24),('Seated',24),('Point',36)]:
    action=bpy.data.actions.new(clip);rig.animation_data.action=action;action.use_fake_user=True
    for frame in range(1,length+2,3):
        clearpose();phase=(frame-1)/length*math.tau
        if clip=='Idle':
            rig.pose.bones['body'].location.y=.006*math.sin(phase)
            rig.pose.bones['head'].rotation_euler.z=.025*math.sin(phase)
        if clip=='Walk':
            rig.pose.bones['body'].location.y=.012*(1-math.cos(phase*2))
            for i,label in enumerate(('L','R')):
                s=math.sin(phase+i*math.pi)
                rig.pose.bones[f'thigh.{label}'].rotation_euler.x=.32*s
                rig.pose.bones[f'shin.{label}'].rotation_euler.x=-max(0,s)*.55
                rig.pose.bones[f'foot.{label}'].rotation_euler.x=-.32*s+max(0,s)*.55
                rig.pose.bones[f'upper_arm.{label}'].rotation_euler.x=-.24*s
        if clip=='Seated':
            rig.pose.bones['body'].location.y=-.36
            for label in ('R','L'):
                rig.pose.bones[f'thigh.{label}'].location.y=-.29
                rig.pose.bones[f'thigh.{label}'].rotation_euler.x=1.45
                rig.pose.bones[f'shin.{label}'].rotation_euler.x=-1.35
                rig.pose.bones[f'upper_arm.{label}'].rotation_euler.x=.45
                rig.pose.bones[f'forearm.{label}'].rotation_euler.x=.65
        if clip=='Point':
            b=rig.pose.bones['upper_arm.L'];b.rotation_euler.z=-2.35;b.scale.y=1.16
            rig.pose.bones['forearm.L'].rotation_euler.z=-.7
            for finger in ('middle','ring','pinky'):rig.pose.bones[f'{finger}.L'].rotation_euler.x=1.55
            rig.pose.bones['thumb.L'].rotation_euler.x=.6
        for b in rig.pose.bones:
            b.keyframe_insert('location',frame=frame);b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('scale',frame=frame)
    track=rig.animation_data.nla_tracks.new();track.name=clip
    strip=track.strips.new(clip,1,action);track.mute=True
rig.animation_data.action=None;clearpose()
# A garment animation named Seated is merged with its matching skeleton clip.
keys=dhoti.data.shape_keys;keys.animation_data_create()
ka=bpy.data.actions.new('Seated_cloth');keys.animation_data.action=ka
for frame in (1,25):sk.value=1;sk.keyframe_insert('value',frame=frame)
tr=keys.animation_data.nla_tracks.new();tr.name='Seated';tr.strips.new('Seated',1,ka);tr.mute=True
keys.animation_data.action=None;sk.value=0

scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=49
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
PROJECT.joinpath('public/models').mkdir(parents=True,exist_ok=True)
# Inspect operator properties for compatibility with the user's installed Blender.
props=bpy.ops.export_scene.gltf.get_rna_type().properties
opts=dict(filepath=str(PROJECT/'public/models/sankaran-pillai.glb'),use_selection=True,export_animations=True,export_skins=True,export_morph=True)
if 'export_animation_mode' in props:
    modes=[e.identifier for e in props['export_animation_mode'].enum_items]
    if 'NLA_TRACKS' in modes:opts['export_animation_mode']='NLA_TRACKS'
if 'export_merge_animation' in props:
    modes=[e.identifier for e in props['export_merge_animation'].enum_items]
    if 'NLA_TRACK' in modes:opts['export_merge_animation']='NLA_TRACK'
# Export format default is GLB; no arbitrary enum identifiers.
bpy.ops.export_scene.gltf(**opts)
# The exporter samples clips and can leave the final sampled pose active.
clearpose();sk.value=0
bpy.context.view_layer.update()
PROJECT.joinpath('assets/characters').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT/'assets/characters/sankaran-pillai.blend'))
print({'meshes':3,'bones':len(bones),'triangles':sum(len(p.vertices)-2 for o in (bodymesh,dhoti,harnessmesh) for p in o.data.polygons),'blend':str(PROJECT/'assets/characters/sankaran-pillai.blend'),'glb':str(PROJECT/'public/models/sankaran-pillai.glb')})
