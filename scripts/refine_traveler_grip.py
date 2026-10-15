"""Add a reversible hand curl to the Meshy body; leave the relaxed mesh intact."""
import bpy, math
body=bpy.data.objects['Sankaran_Body']
if not body.data.shape_keys:body.shape_key_add(name='Basis')
base=body.data.shape_keys.key_blocks['Basis']
grip=body.data.shape_keys.key_blocks.get('CarryGrip') or body.shape_key_add(name='CarryGrip')
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
changed=0
for v,out in zip(base.data,grip.data):
 out.co=v.co
 x,y,z=v.co;side=1 if x>0 else -1;ax=abs(x)
 weight=smooth(.43,.48,ax)*(1-smooth(.88,.94,z))
 if weight==0 or z<.65:continue
 # The four fingers curl inward around the handle's long axis.
 fingers=1-smooth(.065,.12,y)
 length=max(0,.855-z);angle=min(2.25,length/.047)
 radial=ax-.555
 nx=.555-.047*(1-math.cos(angle))+radial*math.cos(angle)
 nz=z if length==0 else .855-.047*math.sin(angle)-radial*math.sin(angle)
 blend=weight*fingers
 out.co.x=x+(side*nx-x)*blend
 out.co.z=z+(nz-z)*blend
 # Close the thumb toward the side of the curled fingers.
 thumb=weight*smooth(.065,.12,y)*(1-smooth(.85,.91,z))
 out.co.y-=.02*thumb
 out.co.z+=.005*thumb
 if (out.co-v.co).length>.00001:changed+=1
grip.value=1
print('CarryGrip vertices:',changed)
