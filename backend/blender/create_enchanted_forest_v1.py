import bpy
import math
import random
from mathutils import Vector
from pathlib import Path

random.seed(27)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "backend" / "public" / "scenes" / "blender-forest-preview.png"
CHARACTER = ROOT / "backend" / "test-assets" / "elephant-cutout.png"

# Start from a clean scene.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.curves, bpy.data.cameras,
                   bpy.data.lights):
    pass

scene = bpy.context.scene
scene.render.engine = "CYCLES" if False else "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = str(OUT)
scene.render.resolution_percentage = 85
scene.render.engine = "BLENDER_EEVEE"
scene.world.color = (0.025, 0.035, 0.05)

# A restrained filmic palette.
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.color_mode = "RGBA"

def material(name, color, roughness=0.8, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m

def noise_material(name, color, roughness=0.85, scale=5.0,
                   detail=3.0, bump_strength=0.16):
    m = material(name, color, roughness)
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = detail
    tex.inputs["Roughness"].default_value = 0.72
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.08
    links.new(tex.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

bark = noise_material("Ancient warm tree bark", (0.19,0.095,0.055), 0.9, 4, 4, .22)
bark_light = noise_material("Raised bark ridges", (0.31,0.16,0.075), 0.9, 7, 3, .12)
dark_bark = material("Deep bark creases", (0.075,0.044,0.033))
leaf_mats = [
    noise_material("Mossy emerald", (.035,.16,.095), .85, 5, 3, .08),
    noise_material("Forest green", (.065,.23,.12), .85, 6, 3, .08),
    noise_material("Sunlit green", (.18,.32,.14), .8, 5, 3, .08),
    noise_material("Olive leaves", (.28,.34,.14), .85, 7, 2, .08),
]
ground_mat = noise_material("Velvety moss ground", (.055,.15,.09), .95, 3, 4, .2)
path_mat = noise_material("Warm earthy path", (.32,.20,.11), .95, 8, 2, .08)
wood = noise_material("Golden door wood", (.36,.16,.055), .78, 6, 3, .12)
door_dark = material("Door recess", (.055,.035,.025))
stone_mat = noise_material("Old stone", (.20,.23,.18), .9, 4, 3, .12)

def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj

def smooth(obj):
    if obj.type == "MESH":
        for face in obj.data.polygons:
            face.use_smooth = True
    return obj

def uv_sphere(name, loc, scale, mat, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, mat)
    smooth(obj)
    return obj

def cube(name, loc, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    if bevel:
        mod = obj.modifiers.new("Soft handmade edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return obj

def cylinder(name, loc, radius, depth, mat, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    bevel = obj.modifiers.new("Worn rounded edges", "BEVEL")
    bevel.width = min(radius * .15, .09)
    bevel.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj

def make_light(name, loc, color, power, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector((0,0,1.0))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

# Ground and gently rolling foreground.
cube("Forest floor", (0,0,-.32), (14,12,.55), ground_mat, .18)
# Earthen trail, tapering into the distance.
trail = cube("Winding path", (0,-1.1,-.02), (2.0,7,.08), path_mat, .04)
trail.rotation_euler[2] = math.radians(-7)

# Ancient tree trunk, with a thick irregular silhouette.
trunk = uv_sphere("Ancient tree trunk", (-3.0,2.0,2.6), (1.5,1.05,3.8), bark, 24, 16)
trunk.rotation_euler[1] = math.radians(-5)

# Roots spread along the ground.
for i in range(7):
    angle = math.radians(-165 + i*30)
    start = Vector((-3,1.6,.20))
    end = Vector((-3 + math.cos(angle)*random.uniform(1.3,2.3),
                  1.6 + math.sin(angle)*random.uniform(.7,1.5), .02))
    direction = end-start
    mid = (start+end)/2
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=.30, radius2=.10,
        depth=direction.length, location=mid)
    root = bpy.context.object
    root.name = "Gnarled tree root"
    root.rotation_euler = direction.to_track_quat('Z','Y').to_euler()
    assign(root, bark_light)

# Raised bark ridges following the trunk.
for i in range(15):
    x = -4.05 + i*.15
    curve = bpy.data.curves.new("Bark ridge curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = random.uniform(.025,.075)
    curve.bevel_resolution = 1
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(2)
    for j, point in enumerate(spline.bezier_points):
        point.co = (x + math.sin(j*1.7+i)*.12,
                    1.02 - random.uniform(0,.12),
                    .3 + j*1.8 + random.uniform(-.1,.1))
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("Raised bark grain", curve)
    scene.collection.objects.link(obj)
    assign(obj, bark_light)

# Branches that arch over the scene.
for loc, scale, rot in [
    ((-3.5,2,5.4),(1.8,.48,.42),-25),
    ((-2.1,2.3,6.0),(1.7,.48,.4),25),
    ((-1.4,2.5,5.2),(1.4,.38,.32),42),
]:
    branch = uv_sphere("Heavy ancient branch", loc, scale, bark, 16, 10)
    branch.rotation_euler[1] = math.radians(rot)

# Doorway recess, rounded arch silhouette, and timber frame.
door_x, door_y = -2.45, .88
# Dark arch silhouette behind the door.
uv_sphere("Shadow inside arch", (door_x,door_y,1.42), (.73,.17,1.15), door_dark, 24, 16)
# Rectangular lower door and curved upper arch.
cube("Door leaf", (door_x,door_y-.13,1.12), (1.05,.12,1.55), wood, .06)
uv_sphere("Rounded top of door", (door_x,door_y-.13,1.88), (.525,.08,.48), wood, 24, 16)
# Recessed dark panel.
cube("Door inset", (door_x,door_y-.205,1.25), (.77,.04,1.15), door_dark, .04)
uv_sphere("Door inset arch", (door_x,door_y-.205,1.78), (.385,.03,.34), door_dark, 20, 12)

# Individual planks and handmade iron handle.
for dx in [-.24,0,.24]:
    plank = cube("Door plank", (door_x+dx,door_y-.24,1.25), (.035,.035,1.1), wood, .012)
cylinder("Golden door handle", (door_x+.28,door_y-.30,1.24), .055,.04,
         material("Brushed brass", (.85,.48,.12), .35,.55), 12)

# Warm glow in the doorway.
emission = bpy.data.materials.new("Warm magic behind the door")
emission.use_nodes = True
nodes = emission.node_tree.nodes
nodes.clear()
out = nodes.new("ShaderNodeOutputMaterial")
em = nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = (1.0,.38,.08,1)
em.inputs["Strength"].default_value = 3.0
emission.node_tree.links.new(em.outputs[0],out.inputs["Surface"])
cube("Glowing doorway", (door_x,door_y-.26,1.5), (.52,.025,1.25), emission, .02)

# Soft warm light spills from the doorway onto the forest floor.
data = bpy.data.lights.new("Doorway amber glow", "POINT")
data.energy = 110
data.color = (1.0,.34,.075)
data.shadow_soft_size = 1.1
lamp = bpy.data.objects.new("Doorway amber glow",data)
scene.collection.objects.link(lamp)
lamp.location = (door_x,-.05,1.7)

# Rounded foliage clusters form a layered canopy.
for cx,cy,cz,rx,rz in [
    (-5.0,2.8,6.1,1.6,1.25),(-3.8,3.0,6.8,1.65,1.1),
    (-2.3,3.3,6.8,1.5,1.0),(-.7,3.3,6.3,1.55,1.15),
    (1.0,3.6,6.8,1.55,1.15),(2.7,3.6,6.2,1.65,1.15),
    (4.5,3.2,6.8,1.55,1.25),(5.5,3.0,5.9,1.35,1.2),
]:
    for i in range(12):
        x=cx+random.uniform(-rx,rx)
        z=cz+random.uniform(-rz,rz)
        y=cy+random.uniform(-.4,.5)
        size=random.uniform(.35,.72)
        obj=uv_sphere("Individual canopy leaf cluster",(x,y,z),
                      (size*1.2,size*.65,size*.72),
                      random.choice(leaf_mats),12,8)

# Additional nearer branches and foliage at frame edges.
for x in [-6.0,5.8]:
    for i in range(12):
        z=random.uniform(3.3,6.1)
        y=random.uniform(-.3,1.2)
        size=random.uniform(.45,.85)
        uv_sphere("Foreground leaf mass",(x+random.uniform(-.45,.45),y,z),
                  (size,size*.48,size*.7),random.choice(leaf_mats),12,8)

# Small mossy stones and mushrooms add a handcrafted scale.
for i in range(26):
    x=random.uniform(-5.8,5.8)
    y=random.uniform(-3.2,1.5)
    size=random.uniform(.08,.25)
    uv_sphere("Mossy stone",(x,y,random.uniform(-.02,.05)),
              (size*1.5,size,size*.65),stone_mat,10,6)

mushroom_stem=material("Mushroom cream",(.8,.67,.43))
mushroom_cap=material("Coral mushroom cap",(.67,.13,.09))
for x,y,s in [(-4.4,-2.2,.55),(-1.8,-3.0,.38),(1.8,-2.5,.45),(4.2,-1.9,.32)]:
    cylinder("Mushroom stem",(x,y,.14*s),.07*s,.28*s,mushroom_stem,10)
    uv_sphere("Mushroom cap",(x,y,.30*s),(.24*s,.20*s,.12*s),
              mushroom_cap,12,8)

# Fireflies as tiny glowing spheres.
firefly_mat = bpy.data.materials.new("Firefly golden emission")
firefly_mat.use_nodes=True
n=firefly_mat.node_tree.nodes; n.clear()
o=n.new("ShaderNodeOutputMaterial"); e=n.new("ShaderNodeEmission")
e.inputs["Color"].default_value=(1.0,.62,.15,1); e.inputs["Strength"].default_value=2.5
firefly_mat.node_tree.links.new(e.outputs[0],o.inputs["Surface"])
for i in range(24):
    x=random.uniform(-5,5); y=random.uniform(-1,3); z=random.uniform(1,5.5)
    uv_sphere("Firefly",(x,y,z),(.025,.025,.025),firefly_mat,8,6)

# Place the child's drawing on a camera-facing plane, as a temporary character
# integration test. The next iteration can rig or animate the character.
if not CHARACTER.exists():
    raise RuntimeError(f"Character asset not found: {CHARACTER}")
img=bpy.data.images.load(str(CHARACTER), check_existing=True)
mat=bpy.data.materials.new("Child drawing - transparent image")
mat.use_nodes=True
nodes=mat.node_tree.nodes; nodes.clear()
out=nodes.new("ShaderNodeOutputMaterial")
em=nodes.new("ShaderNodeEmission")
tex=nodes.new("ShaderNodeTexImage"); tex.image=img
links=mat.node_tree.links
links.new(tex.outputs["Color"],em.inputs["Color"])
links.new(tex.outputs["Alpha"],em.inputs["Strength"])
links.new(em.outputs[0],out.inputs["Surface"])
# Alpha connection through transparent shader for image cutout.
nodes.clear()
out=nodes.new("ShaderNodeOutputMaterial")
tex=nodes.new("ShaderNodeTexImage"); tex.image=img
trans=nodes.new("ShaderNodeBsdfTransparent")
diff=nodes.new("ShaderNodeBsdfPrincipled")
diff.inputs["Roughness"].default_value=.85
mix=nodes.new("ShaderNodeMixShader")
links=mat.node_tree.links
links.new(tex.outputs["Color"],diff.inputs["Base Color"])
links.new(tex.outputs["Alpha"],mix.inputs[0])
links.new(trans.outputs[0],mix.inputs[1])
links.new(diff.outputs[0],mix.inputs[2])
links.new(mix.outputs[0],out.inputs["Surface"])
mat.surface_render_method = "DITHERED"

# Plane faces the camera, positioned near the forest path.
verts=[(-.85,0,0),(.85,0,0),(.85,0,1.9),(-.85,0,1.9)]
mesh=bpy.data.meshes.new("Elephant image plane mesh")
mesh.from_pydata(verts,[],[(0,1,2,3)])
mesh.materials.append(mat)
hero=bpy.data.objects.new("Child's elephant drawing",mesh)
scene.collection.objects.link(hero)
hero.location=(-.25,-2.15,.02)
# UV map for the image.
uv=mesh.uv_layers.new(name="UVMap")
for polyface in mesh.polygons:
    for li in polyface.loop_indices:
        vi=mesh.loops[li].vertex_index
        uv.data[li].uv=[(0,0),(1,0),(1,1),(0,1)][vi]

# Lighting: cool forest fill, warm key, and subtle rim light.
make_light("Warm canopy key",(-4,-3,7),(1.0,.72,.43),700,5)
make_light("Cool forest fill",(4,-1,5),(.35,.62,1.0),420,5)
make_light("Soft character fill",(-1,-5,4),(1.0,.77,.55),260,4)

# Camera: wide composition with doorway, canopy and character all visible.
bpy.ops.object.camera_add(location=(0,-15,5.0))
cam=bpy.context.object
cam.name="Cinematic forest camera"
target=Vector((0,.9,2.65))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=40
cam.data.dof.use_dof=True
cam.data.dof.focus_object=hero
cam.data.dof.aperture_fstop=8
scene.camera=cam

# Ambient occlusion and shadows.
scene.render.image_settings.color_mode="RGBA"
scene.render.filepath=str(OUT)
scene.render.resolution_x=1280
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.camera.data.lens=40
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.render.engine="BLENDER_EEVEE"
scene.render.filepath=str(OUT)

# Conservative quality settings for 8 GB unified memory.
scene.eevee.taa_render_samples=64
scene.render.image_settings.color_mode="RGBA"
scene.render.resolution_percentage=100
scene.camera.data.dof.use_dof=False
scene.render.filepath=str(OUT)
scene.world.color=(.035,.045,.06)

OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"backend"/"blender"/"enchanted_forest.blend"))
bpy.ops.render.render(write_still=True)
print("RENDER_COMPLETE:",OUT)
