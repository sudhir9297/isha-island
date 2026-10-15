"""Project each oval eye and its blink onto the actual posed facial surface."""
import bpy
from mathutils import Vector
body=bpy.data.objects['Sankaran_Body']
for name in ['OvalEye_L','OvalEye_R']:
 eye=bpy.data.objects[name]
 if eye.get('surface_fit'):continue
 keys=eye.data.shape_keys.key_blocks
 world=eye.matrix_world.copy();inverse=world.inverted()
 original=[v.co.copy() for v in keys['Basis'].data]
 for key,compression in [('Basis',1),('Blink',.04)]:
  for source,dest in zip(original,keys[key].data):
   point=world@Vector((source.x,source.y,source.z*compression))
   hit,surface,normal,index=body.ray_cast(Vector((point.x,1,point.z)),Vector((0,-1,0)))
   if not hit:raise RuntimeError('Eye projection missed face')
   # Embedded rear and a shallow raised front, including at the closed eyelid.
   depth=source.y/.015 if not eye.get('surface_fit') else 0
   point.y=surface.y+.001+max(-1,min(1,depth))*.004
   dest.co=inverse@point
 keys['Blink'].value=0
 eye['surface_fit']=True
print('Both eyes and blink surfaces seated against the face')
