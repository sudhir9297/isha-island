"""Four reusable luggage props in game metres. Front faces game -Z."""
import bpy, math
from mathutils import Vector
name='Traveler_Luggage'
old=bpy.data.collections.get(name)
if old:
 for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.collections.remove(old)
collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
def coord(p):return (p[0],-p[2],p[1])
def mat(name,hex_color,rough=.75,metal=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
 n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 rgb=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)];rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 n.inputs['Base Color'].default_value=(*rgb,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal;m.diffuse_color=(*rgb,1);return m
leather=mat('Luggage walnut leather','654333',.65);edge=mat('Luggage leather edging','8E6245');brass=mat('Luggage aged brass','C5A15A',.35,.72);thread=mat('Luggage flax stitching','D0B992');rubber=mat('Luggage wheel rubber','30352F');terra=mat('Luggage terracotta','B67550');sage=mat('Luggage sage canvas','71806A');sageLight=mat('Luggage sage flap','839179');ochre=mat('Luggage ochre canvas','BB9550');indigo=mat('Luggage indigo canvas','556F86')
parts=[]
def finish(o,m):
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o);o.data.materials.append(m);parts.append(o)
 for p in o.data.polygons:p.use_smooth=True
 return o
def box(p,size,m,r=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=coord(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 kind=next(i.identifier for i in bpy.types.Modifier.bl_rna.properties['type'].enum_items if i.identifier=='BEVEL')
 b=o.modifiers.new('Rounded sewn edges',kind);b.width=r;b.segments=4
 bpy.ops.object.modifier_apply(modifier=b.name)
 kind=next(i.identifier for i in bpy.types.Modifier.bl_rna.properties['type'].enum_items if i.identifier=='WEIGHTED_NORMAL')
 b=o.modifiers.new('Soft surface normals',kind);b.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=b.name)
 return finish(o,m)
def line(points,r,m):
 c=bpy.data.curves.new('Piping','CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
 s=c.splines.new('POLY');s.points.add(len(points)-1)
 for a,p in zip(s.points,points):a.co=(*coord(p),1)
 o=bpy.data.objects.new('Sewn detail',c);collection.objects.link(o)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,m)
def rim(x,y,z,w,h,r,m):
 pts=[]
 for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
  for j in range(7):
   a=math.radians(start+j*15);pts.append((x+cx+r*math.cos(a),y+cy+r*math.sin(a),z))
 pts.append(pts[0]);line(pts,.003,m)
def handle(y,z,w=.16,h=.085,grip_z=None):
 if grip_z is None:grip_z=z
 line([(-w/2,y,z),(-w/2,y+h*.7,z),(-w*.3,y+h,grip_z),(w*.3,y+h,grip_z),(w/2,y+h*.7,z),(w/2,y,z)],.014,leather)
 for x in (-w/2,w/2):box((x,y,z),(.028,.025,.028),brass,.008)
def buckle(x,y,z):
 rim(x,y,z,.043,.052,.009,brass);line([(x,y-.021,z-.003),(x,y+.016,z-.003)],.003,brass)
def stitch(x,y,z,h):
 for j in range(int(h/.018)):
  yy=y-h/2+j*.018;line([(x,yy,z),(x,yy+.007,z)],.0014,thread)
def join(name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);parts.clear();return o
# Suitcase: leather straps, stitched edge, reinforced corners and wheels.
box((0,0,0),(.40,.56,.24),terra,.055)
for z in (-.124,.124):
 rim(0,0,z,.377,.535,.06,edge)
 for x in (-.115,.115):
  box((x,0,z),(.035,.54,.012),leather,.012);stitch(x-.012,0,z*1.055,.48)
  if z<0:buckle(x,.08,z-.012)
 for x in (-.16,.16):
  for y in (-.235,.235):box((x,y,z),(.068,.068,.017),leather,.025)
handle(.29,0,.17,.10)
for x in (-.15,.15):
 for z in (-.08,.08):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=coord((x,-.30,z)));o=bpy.context.object;o.scale=(.032,.032,.032);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,rubber)
join('Luggage_Suitcase')
# Backpack: padded body, flap, two gusseted pockets and rear straps.
box((0,0,0),(.43,.59,.27),sage,.09)
box((0,-.25,0),(.42,.10,.27),leather,.04)
box((0,.205,-.07),(.43,.20,.19),sageLight,.065);rim(0,.205,-.17,.405,.17,.055,edge)
for x in (-.105,.105):
 box((x,-.13,-.165),(.18,.225,.09),sage,.035)
 box((x,-.055,-.19),(.185,.09,.065),sageLight,.03);rim(x,-.13,-.214,.157,.20,.03,edge)
 box((x,-.12,-.225),(.025,.16,.012),leather,.009);buckle(x,-.075,-.237)
 line([(x,.24,.14),(x,.20,.20),(x,-.05,.25),(x,-.24,.15)],.027,leather)
box((0,.13,-.181),(.03,.19,.014),leather,.009);buckle(0,.12,-.195);handle(.30,.04,.12,.07)
join('Luggage_Backpack')
# Duffel: rounded canvas barrel with leather base and twin handles.
box((0,0,0),(.60,.32,.30),ochre,.095);box((0,-.125,0),(.57,.075,.28),leather,.035)
for x in (-.18,.18):
 box((x,0,0),(.032,.323,.305),leather,.014)
 for z in (-.157,.157):stitch(x-.010,0,z,.23)
for z in (-.105,.105):handle(.16,z,.33,.12,0)
line([(-.23,.164,0),(.23,.164,0)],.005,brass)
box((0,-.01,-.163),(.23,.13,.022),ochre,.025);rim(0,-.01,-.179,.21,.11,.02,edge)
for x in (-.302,.302):box((x,-.01,0),(.025,.17,.19),leather,.045)
join('Luggage_Duffel')
# Satchel: rounded flap and functional shoulder loop sized to the traveler.
box((0,0,0),(.30,.27,.13),indigo,.045);rim(0,0,-.069,.285,.255,.045,edge)
box((0,.075,-.066),(.31,.15,.035),indigo,.045);rim(0,.075,-.088,.287,.13,.042,edge)
box((0,-.005,-.097),(.035,.075,.015),leather,.012);buckle(0,-.005,-.108)
handle(.145,.025,.08,.04);satchel=join('Luggage_Satchel')
line([(-.14,.10,.025),(-.16,.30,.03),(.10,.65,.09),(.17,.67,.10),(.20,.61,.10),(.12,.30,.03),(.14,.10,.025)],.012,leather)
loose=join('Satchel_PropStrap');loose.parent=satchel
# Separate fitted strap follows the chest, shoulder and back while worn.
c=bpy.data.curves.new('Fitted shoulder loop','CURVE');c.dimensions='3D';c.bevel_depth=.014;c.bevel_resolution=2;c.resolution_u=8
s=c.splines.new('BEZIER')
points=[(-.14,.10,.025),(-.23,.29,.11),(-.34,.49,.30),(-.34,.55,.47),(-.34,.48,.73),(-.28,.27,.89),(.10,.05,.91),(.40,-.03,.66),(.39,-.02,.30),(.14,.10,.025)]
s.bezier_points.add(len(points)-1)
for a,p in zip(s.bezier_points,points):
 a.co=coord(p);a.handle_left_type='AUTO';a.handle_right_type='AUTO'
o=bpy.data.objects.new('Fitted strap',c);collection.objects.link(o)
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');finish(bpy.context.object,leather)
fitted=join('Satchel_FittedStrap');fitted.parent=satchel

# Export only the props with common centered attachment origins.
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
bpy.context.view_layer.objects.active=collection.objects[0]
bpy.ops.export_scene.gltf(filepath='/Users/sudhir/Desktop/create/experiment/port/public/models/traveler-luggage.glb',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath='/Users/sudhir/Desktop/create/experiment/port/assets/luggage/traveler-luggage.blend')
print([(o.name,len(o.data.polygons)) for o in collection.objects])
