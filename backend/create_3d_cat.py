
import bpy
import math
import os
from mathutils import Vector

# ---------- Scene ----------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 120
scene.render.image_settings.file_format = "PNG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.world.color = (0.035, 0.06, 0.10)

def material(name, color, roughness=0.7):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = roughness
    return m

orange = material("Warm ginger fur", (0.95, 0.36, 0.10))
cream = material("Cream muzzle and belly", (1.0, 0.78, 0.48))
dark = material("Deep brown", (0.12, 0.045, 0.025))
eye_mat = material("Emerald eyes", (0.05, 0.65, 0.32), 0.25)
ground_mat = material("Forest floor", (0.07, 0.20, 0.12))
leaf_mat = material("Tree foliage", (0.04, 0.25, 0.13))
trunk_mat = material("Tree bark", (0.24, 0.12, 0.07))

def uv_sphere(name, loc, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=16, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def cylinder(name, loc, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.modifiers.new("Soft edges", "BEVEL").width = 0.12
    obj.modifiers["Soft edges"].segments = 3
    return obj

# ---------- Ground and forest ----------
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.12))
ground = bpy.context.object
ground.name = "Forest floor"
ground.data.materials.append(ground_mat)

for x, y, h in [
    (-4, 2, 3.5), (-2.8, 4, 4.5), (3.1, 3, 4.0),
    (4.3, 1, 3.2), (-5, 5, 4.2), (1.8, 5, 3.7)
]:
    cylinder("Tree trunk", (x, y, h * 0.40), 0.22, h * 0.8, trunk_mat)
    uv_sphere("Rounded tree crown", (x, y, h * 0.86),
              (1.0, 0.85, 1.1), leaf_mat)

# ---------- Character root ----------
root = bpy.data.objects.new("CAT_ANIMATION_ROOT", None)
bpy.context.collection.objects.link(root)

body = uv_sphere("Body", (0, 0, 0.85), (0.55, 0.85, 0.60),
                 orange, root)
belly = uv_sphere("Belly", (0, -0.48, 0.83), (0.38, 0.27, 0.43),
                  cream, root)
head = uv_sphere("Head", (0, -0.68, 1.72), (0.62, 0.52, 0.58),
                 orange, root)

# Pointed ears: actual mesh geometry
def make_ear(name, x):
    verts = [
        (x - 0.24, -0.62, 2.00),
        (x + 0.24, -0.62, 2.00),
        (x, -0.58, 2.62),
        (x - 0.20, -0.42, 2.02),
        (x + 0.20, -0.42, 2.02),
        (x, -0.44, 2.55)
    ]
    faces = [
        (0, 1, 2), (3, 5, 4), (0, 3, 4, 1),
        (0, 2, 5, 3), (1, 4, 5, 2)
    ]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(orange)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    bevel = obj.modifiers.new("Rounded ear edges", "BEVEL")
    bevel.width = 0.07
    bevel.segments = 3
    return obj

make_ear("Left pointed ear", -0.37)
make_ear("Right pointed ear", 0.37)

for x in (-0.23, 0.23):
    uv_sphere("Eye", (x, -1.155, 1.82), (0.105, 0.07, 0.14),
              eye_mat, root)
    uv_sphere("Eye highlight", (x - 0.025, -1.218, 1.87),
              (0.027, 0.018, 0.035), cream, root)

uv_sphere("Nose", (0, -1.205, 1.59), (0.09, 0.055, 0.065),
          dark, root)
for x in (-0.12, 0.12):
    uv_sphere("Muzzle", (x, -1.15, 1.51), (0.15, 0.10, 0.10),
              cream, root)

# Four animated legs
legs = []
for x in (-0.34, 0.34):
    for y in (-0.48, 0.48):
        leg = uv_sphere("Animated leg", (x, y, 0.32),
                        (0.17, 0.20, 0.40), orange, root)
        legs.append((leg, x, y))

# Curved tail made from connected spheres
tail_parts = []
for i in range(7):
    t = i / 6
    tail_parts.append(
        uv_sphere(
            "Tail segment",
            (0.0, 0.65 + t * 0.95, 0.85 + math.sin(t * math.pi) * 0.65),
            (0.13, 0.16, 0.15), dark if i == 6 else orange, root)
    )

# ---------- Animation ----------
for frame in range(1, 121, 6):
    t = (frame - 1) / 24.0
    root.location.x = 0.45 * math.sin(t * 1.8)
    root.location.z = 0.08 * abs(math.sin(t * 5.0))
    root.keyframe_insert("location", frame=frame)

    head.rotation_euler[1] = 0.08 * math.sin(t * 2.0)
    head.keyframe_insert("rotation_euler", frame=frame)

    for index, (leg, x, y) in enumerate(legs):
        leg.location.z = 0.32 + 0.15 * math.sin(
            t * 6.0 + (0 if index % 2 == 0 else math.pi))
        leg.keyframe_insert("location", frame=frame)

    for i, part in enumerate(tail_parts):
        part.rotation_euler[0] = 0.35 * math.sin(t * 3.0 + i * 0.22)
        part.keyframe_insert("rotation_euler", frame=frame)

# ---------- Camera and lighting ----------
bpy.ops.object.camera_add(location=(4.5, -8.5, 3.6))
camera = bpy.context.object
camera.name = "Story camera"
target = Vector((0, 0.4, 1.2))
direction = target - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
camera.data.lens = 48
scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(-3, -4, 7))
key = bpy.context.object
key.name = "Warm key light"
key.data.energy = 850
key.data.shape = "DISK"
key.data.size = 5

bpy.ops.object.light_add(type="AREA", location=(4, 2, 5))
fill = bpy.context.object
fill.name = "Forest rim light"
fill.data.energy = 500
fill.data.color = (0.55, 0.78, 1.0)
fill.data.size = 4

scene.render.filepath = os.path.expanduser("~/Desktop/sketchtales_3d_cat.mp4")
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.color_mode = "RGB"

# Save a reusable Blender project before rendering
blend_path = os.path.expanduser("~/Desktop/sketchtales_3d_cat.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("Rendering 3D cat to:", scene.render.filepath)
bpy.ops.render.render(animation=True)
print("RENDER_COMPLETE:", scene.render.filepath)
