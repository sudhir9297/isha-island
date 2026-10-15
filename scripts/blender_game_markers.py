"""Blender --background [markers.blend] --python scripts/blender_game_markers.py [-- --create]
Create a separate authoring template, or export its ref_* empties. Never saves the source on export.
Coordinates: Blender (x,y,z) -> game (x,z,-y). Units are game-world units, not gate-source units.
"""
import bpy, json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / 'src/game/world-markers.json'
data = json.loads(TARGET.read_text())
if '--create' in sys.argv:
    # Run with a clean factory scene; only create the marker template, never an art source.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name, (x, y, z) in data['markers'].items():
        obj = bpy.data.objects.new('ref_' + name, None)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = (x, -z, y)
        obj.empty_display_type = 'ARROWS'
        obj.empty_display_size = 0.4
        obj.show_name = True
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/port-gameplay-markers.blend'))
else:
    for scene in bpy.data.scenes:
        scene.view_layers[0].update()
    result = {}
    for name in data['markers']:
        obj = bpy.data.objects.get('ref_' + name)
        if obj is None or obj.type != 'EMPTY':
            raise ValueError('Missing marker empty: ref_' + name)
        p = obj.matrix_world.translation
        result[name] = [round(p.x, 6), round(p.z, 6), round(-p.y, 6)]
    import math
    if not all(math.isfinite(v) for p in result.values() for v in p):
        raise ValueError('Markers must be finite')
    if result['gateEntry'][0] != result['gateExit'][0] or result['gateEntry'][2] <= result['gateExit'][2]:
        raise ValueError('Gate markers must face +Z in game coordinates')
    if any(result['luggage'+str(i)][2] <= result['luggageOrigin'][2] for i in range(4)):
        raise ValueError('Luggage must fly toward arrival shore')
    data['markers'] = result
    TARGET.write_text(json.dumps(data, indent=2) + '\n')
    print('Exported gameplay markers to', TARGET)
