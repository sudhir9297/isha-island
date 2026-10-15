"""Fit downloaded Meshy character to the existing gameplay skeleton; retain UVs."""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.kdtree import KDTree
collection=bpy.data.collections['Sankaran_Character']
rig=bpy.data.objects['Sankaran_Rig']
rig.animation_data.action=None
for bone in rig.pose.bones:
    bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)
oldbody=bpy.data.objects['Sankaran_Body'];oldcloth=bpy.data.objects['Dhoti']
oldcloth.data.shape_keys.animation_data.action=None
for key in oldcloth.data.shape_keys.key_blocks:key.value=0
source=bpy.data.objects['Meshy_Source']
bpy.ops.object.select_all(action='DESELECT');source.select_set(True);bpy.context.view_layer.objects.active=source
source.rotation_mode=next(i.identifier for i in bpy.types.Object.bl_rna.properties['rotation_mode'].enum_items if i.identifier=='XYZ')
source.rotation_euler.z=math.pi
factor=2.256/source.dimensions.z
source.scale=(factor,factor,factor)
source.location.z=.951195*factor
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Use the verified sculpt rig as a spatial weight guide, blended across neighbors.
tree=KDTree(len(oldbody.data.vertices))
for v in oldbody.data.vertices:tree.insert(v.co,v.index)
tree.balance()
archive=bpy.data.collections.new('Previous procedural character');bpy.context.scene.collection.children.link(archive)
for obj in (oldbody,oldcloth):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    archive.objects.link(obj);obj.parent=None;obj.name='Previous_'+obj.name;obj.hide_set(True);obj.hide_render=True
# Split the garment from the hands and feet so corrective morphs only deform cloth.
body=source;body.name='Sankaran_Body'
dhoti=source.copy();dhoti.data=source.data.copy();collection.objects.link(dhoti);dhoti.name='Dhoti'
for c in list(body.users_collection):c.objects.unlink(body)
collection.objects.link(body)
mat=body.data.materials[0]
image=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for l in n.outputs[0].links))
pixels=list(image.pixels);width,height=image.size
for obj,keepcloth in ((body,False),(dhoti,True)):
    bm=bmesh.new();bm.from_mesh(obj.data)
    remove=[]
    uv_layer=bm.loops.layers.uv.active
    for f in bm.faces:
        c=f.calc_center_median()
        uv=sum((loop[uv_layer].uv for loop in f.loops),Vector((0,0)))/len(f.loops)
        offset=4*(min(height-1,max(0,int(uv.y*height)))*width+min(width-1,max(0,int(uv.x*width))))
        red,green,blue=pixels[offset:offset+3]
        skin=red>green*1.30 and green>blue*1.12
        blue_shirt=blue>red*1.06
        iscloth=.07<c.z<1.04 and not blue_shirt and not skin
        if iscloth != keepcloth:remove.append(f)
    # bmesh context is an API argument, not a Blender RNA enum.
    bmesh.ops.delete(bm,geom=remove,context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    obj.vertex_groups.clear()
    for bone in rig.data.bones:obj.vertex_groups.new(name=bone.name)
    for v in obj.data.vertices:
        if keepcloth:
            obj.vertex_groups['root'].add([v.index],1,'REPLACE');continue
        x,y,z=v.co;side='L' if x<0 else 'R'
        if z<.28:
            weights={'foot.'+side:1}
        elif z>1.50:
            weights={'head':1}
        elif abs(x)>.40 and z<1.10:
            hand=max(0,min(1,(.96-z)/.14))
            weights={'hand.'+side:hand,'forearm.'+side:1-hand}
        elif abs(x)>.32 and 1.03<z<1.52:
            arm=max(0,min(1,(abs(x)-.32)/.16))
            lower=max(0,min(1,(1.20-z)/.15))
            weights={'body':1-arm,'upper_arm.'+side:arm*(1-lower),'forearm.'+side:arm*lower}
        else:
            weights={'body':1}
        for name,value in weights.items():
            if value>0:obj.vertex_groups[name].add([v.index],value,'REPLACE')
    obj.parent=rig
    typ=next(i.identifier for i in bpy.types.Modifier.bl_rna.properties['type'].enum_items if i.identifier=='ARMATURE')
    mod=obj.modifiers.new('Skeletal deformation',typ);mod.object=rig
    obj.hide_set(False);obj.hide_render=False
# Seated cloth follows lap rather than allowing independent leg bones to tear it.
dhoti.shape_key_add(name='Basis');seat=dhoti.shape_key_add(name='Seated')
for v in seat.data:
    t=max(0,min(1,(1.00-v.co.z)/.855))
    v.co.y+=.46*t;v.co.z-=.36*(1-t)
keys=dhoti.data.shape_keys;keys.animation_data_create()
action=bpy.data.actions.new('Meshy seated cloth');keys.animation_data.action=action
for frame in (1,25):seat.value=1;seat.keyframe_insert('value',frame=frame)
track=keys.animation_data.nla_tracks.new();track.name='Seated';track.strips.new('Seated',1,action);track.mute=True
keys.animation_data.action=None;seat.value=0
rig.hide_set(False)
bpy.context.view_layer.update()
print('Meshy rigged:',len(body.data.vertices),'body vertices,',len(dhoti.data.vertices),'garment vertices;',len(rig.data.bones),'bones')

# Final smooth shoulder and wrist weighting.
import bpy
obj=bpy.data.objects['Sankaran_Body']
for group in obj.vertex_groups:group.remove(list(range(len(obj.data.vertices))))
def smooth(a,b,v):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
for v in obj.data.vertices:
 x,y,z=v.co;side='L' if x<0 else 'R'
 if z<.28:weights={'foot.'+side:1}
 elif z>1.50:weights={'head':1}
 else:
  arm=smooth(.32,.51,abs(x))*(1-smooth(.10,.25,abs(y)))
  fore=1-smooth(1.04,1.23,z)
  hand=1-smooth(.81,.98,z)
  weights={'body':1-arm,'upper_arm.'+side:arm*(1-fore),'forearm.'+side:arm*fore*(1-hand),'hand.'+side:arm*fore*hand}
 for name,w in weights.items():
  if w>0:obj.vertex_groups[name].add([v.index],w,'REPLACE')
bpy.context.view_layer.update()
