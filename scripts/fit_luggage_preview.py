"""Fit the exported luggage to the character in the Blender working scene."""
import bpy, math
from mathutils import Vector
rig=bpy.data.objects['Sankaran_Rig']
if rig.animation_data:
 rig.animation_data.action=None
 for track in rig.animation_data.nla_tracks:track.mute=True
for bone in rig.pose.bones:
 bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
for side,angle in [('L',-.32),('R',.32)]:
 rig.pose.bones['upper_arm.'+side].rotation_euler.z=angle
bpy.context.view_layer.update()
for name,side,grip in [('Luggage_Suitcase','L',.39),('Luggage_Duffel','R',.28)]:
 o=bpy.data.objects[name]
 for c in list(o.constraints):o.constraints.remove(c)
 o.rotation_mode='XYZ';o.rotation_euler=(0,0,math.pi/2)
 hand=rig.pose.bones['hand.'+side]
 p=rig.matrix_world @ hand.matrix @ Vector((-.005 if side=='L' else .005,.005,-.02))
 o.location=p-Vector((0,0,grip))
for name,p,angle in [('Luggage_Backpack',(0,1.20,.51),math.pi),('Luggage_Satchel',(.06,.94,-.54),0)]:
 o=bpy.data.objects[name]
 for c in list(o.constraints):o.constraints.remove(c)
 o.location=rig.matrix_world @ rig.pose.bones['body'].matrix @ Vector(p);o.rotation_mode='XYZ';o.rotation_euler=(0,0,angle)
bpy.data.objects['Satchel_PropStrap'].hide_set(True)
bpy.data.objects['Satchel_PropStrap'].hide_render=True
bpy.data.objects['Satchel_FittedStrap'].hide_set(False)
bpy.data.objects['Satchel_FittedStrap'].hide_render=False
bpy.context.view_layer.update()
for name,bone_name in [('Luggage_Suitcase','hand.L'),('Luggage_Duffel','hand.R'),('Luggage_Backpack','body'),('Luggage_Satchel','body')]:
 o=bpy.data.objects[name]
 for c in list(o.constraints):o.constraints.remove(c)
 c=o.constraints.new('CHILD_OF');c.target=rig;c.subtarget=bone_name
 c.inverse_matrix=(rig.matrix_world @ rig.pose.bones[bone_name].matrix).inverted()
bpy.ops.wm.save_as_mainfile(filepath='/Users/sudhir/Desktop/create/experiment/port/assets/luggage/traveler-luggage.blend')
print('Saved fitted luggage preview')
