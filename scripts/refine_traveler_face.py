"""Close the sculpted mouth and replace sleepy lids with oval blinkable eyes."""
import bpy, math
from mathutils import Vector
body=bpy.data.objects['Sankaran_Body'];rig=bpy.data.objects['Sankaran_Rig']
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
# Preserve a source shape so rerunning the refinement never accumulates edits.
keys=body.data.shape_keys.key_blocks
source=keys.get('FaceSource')
if not source:source=body.shape_key_add(name='FaceSource',from_mix=False)
source.value=0
for i,v in enumerate(source.data):
 if v.co.z>1.6:
  for name in ['Basis','CarryGrip']:keys[name].data[i].co=v.co
# Fit a smooth quadratic forehead surface from the skin surrounding each eyelid.
def fit_surface(cx):
 rows=[];values=[]
 for v in source.data:
  x,y,z=v.co;dx=x-cx;dz=z-2.02
  if y>.27 and .9<(dx/.080)**2+(dz/.065)**2<1.5:
   rows.append([1,dx,dz,dx*dx,dz*dz,dx*dz]);values.append(y)
 mat=[[sum(r[i]*r[j] for r in rows) for j in range(6)]+[sum(r[i]*v for r,v in zip(rows,values))] for i in range(6)]
 for i in range(6):
  divisor=mat[i][i]
  mat[i]=[v/divisor for v in mat[i]]
  for j in range(6):
   if j!=i:
    factor=mat[j][i];mat[j]=[a-factor*b for a,b in zip(mat[j],mat[i])]
 return [r[6] for r in mat]
fits=[fit_surface(cx) for cx in [-.11,.11]]
for i,v in enumerate(source.data):
 x,y,z=v.co
 w=(1-smooth(.075,.14,abs(x-.015)))*smooth(.22,.30,y)
 # Monotonic vertical remapping prevents the lower cheek folding over itself.
 target=z
 if 1.65<z<1.745:target=1.65+(z-1.65)*(1.808-1.65)/(.095)
 elif 1.745<=z<1.85:target=1.808+(z-1.745)*.006/.105
 elif 1.85<=z<1.91:target=1.814+(z-1.85)*(.096)/.06
 for name in ['Basis','CarryGrip']:keys[name].data[i].co.z=z+(target-z)*w
 for cx,coeff in zip([-.11,.11],fits):
  dx=x-cx;zz=z-2.02;r=math.sqrt((dx/.078)**2+(zz/.060)**2)
  weight=(1-smooth(.65,1.1,r))*smooth(.27,.30,y)
  if weight:
   target=sum(a*b for a,b in zip(coeff,[1,dx,zz,dx*dx,zz*zz,dx*zz]))
   for name in ['Basis','CarryGrip']:keys[name].data[i].co.y=y+(target-y)*weight

# Replace only the old eye surface material with sampled cheek skin UVs.
uv=body.data.uv_layers.active.data
skin=bpy.data.materials.get('Smooth facial skin')
if not skin:
 skin=body.data.materials[0].copy();skin.name='Smooth facial skin'
 shader=next(n for n in skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for link in list(shader.inputs['Normal'].links):skin.node_tree.links.remove(link)
if skin.name not in body.data.materials:body.data.materials.append(skin)
skin_index=next(i for i,m in enumerate(body.data.materials) if m==skin)
sample=None
for p in body.data.polygons:
 if .18<p.center.x<.20 and 1.94<p.center.z<1.96 and p.center.y>.28:
  sample=uv[p.loop_start].uv.copy();break
if sample:
 for p in body.data.polygons:
  x,y,z=p.center
  if y>.27 and 1.965<z<2.085 and min(abs(x-.11),abs(x+.11))<.075:
   p.material_index=skin_index
   for li in p.loop_indices:uv[li].uv=sample

  if y>.24 and abs(x)<.14 and 1.66<z<1.835:
   p.material_index=skin_index
   for li in p.loop_indices:uv[li].uv=sample
# Eye geometry is independently parented to the head for scale-based blinking.
collection=bpy.data.collections['Sankaran_Character']
material=bpy.data.materials.get('Oval eye ink') or bpy.data.materials.new('Oval eye ink')
material.use_nodes=True
bs=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value=(.012,.009,.008,1);bs.inputs['Roughness'].default_value=.4
for side,x in [('L',-.11),('R',.11)]:
 name='OvalEye_'+side
 old=bpy.data.objects.get(name)
 if old:bpy.data.objects.remove(old,do_unlink=True)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=(x,.365-1.1*x*x+.012,2.025))
 eye=bpy.context.object;eye.name=name;eye.scale=(.030,.015,.050)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for c in list(eye.users_collection):c.objects.unlink(eye)
 collection.objects.link(eye);eye.data.materials.append(material)
 for p in eye.data.polygons:p.use_smooth=True
 eye.shape_key_add(name='Basis');blink=eye.shape_key_add(name='Blink')
 for v in blink.data:v.co.z*=.04
 blink.value=0
 world=eye.matrix_world.copy();eye.parent=rig;eye.parent_type='BONE';eye.parent_bone='head';eye.matrix_world=world
# A softly blended closed-lip surface covers the original cavity and tongue.
for name in ['ClosedMouth','ClosedSmile']:
 old=bpy.data.objects.get(name)
 if old:bpy.data.objects.remove(old,do_unlink=True)
# Inspection camera avoids the viewport section clipping of angle snapshots.
cam=bpy.data.objects.get('Face preview camera')
if not cam:
 cam=bpy.data.objects.new('Face preview camera',bpy.data.cameras.new('Face preview camera'));bpy.context.scene.collection.objects.link(cam)
cam.location=(.45,3,2.06);cam.rotation_euler=(Vector((0,.05,1.94))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.05
bpy.context.scene.camera=cam
print('Closed mouth and oval eyes created')
