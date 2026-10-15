from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import random
import math

random.seed(42)

ROOT = Path(__file__).parent
CHARACTER = ROOT / "test-assets" / "elephant-cutout.png"
OUTPUT = ROOT / "public" / "scenes" / "paper-forest-prototype.png"

W, H = 1280, 720
S = 2  # Render at double resolution for smooth paper edges
w, h = W * S, H * S

def pt(points):
    return [(int(x*S), int(y*S)) for x, y in points]

def polygon(layer, points, color):
    ImageDraw.Draw(layer).polygon(pt(points), fill=color)

def ellipse(layer, box, color):
    ImageDraw.Draw(layer).ellipse(tuple(int(v*S) for v in box), fill=color)

def paper_layer():
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))

def add_paper(scene, layer, shadow=9, offset=(4, 7)):
    # Separate soft shadow gives each paper layer physical depth.
    alpha = layer.getchannel("A")
    blurred = alpha.filter(ImageFilter.GaussianBlur(shadow*S))
    sh = Image.new("RGBA", layer.size, (18, 27, 32, 0))
    sh.putalpha(blurred.point(lambda a: int(a * 0.34)))
    scene.alpha_composite(sh, (offset[0]*S, offset[1]*S))
    scene.alpha_composite(layer)

# Warm, softly lit paper sky.
scene = Image.new("RGBA", (w, h))
pix = scene.load()
top = (38, 66, 89)
bottom = (238, 187, 123)

for y in range(h):
    t = y / (h-1)
    for x in range(w):
        glow = max(0, 1 - math.sqrt(
            ((x/S-820)/650)**2 + ((y/S-250)/470)**2
        ))
        pix[x, y] = (
            min(255, int(top[0]*(1-t)+bottom[0]*t+glow*26)),
            min(255, int(top[1]*(1-t)+bottom[1]*t+glow*20)),
            min(255, int(top[2]*(1-t)+bottom[2]*t+glow*9)),
            255
        )

# Distant rolling hills, cut from different sheets of paper.
layer = paper_layer()
polygon(layer, [(-30,420),(140,340),(300,390),(490,315),
                (690,390),(870,320),(1080,390),(1320,330),
                (1320,560),(-30,560)], (104,143,133,255))
add_paper(scene, layer, 7, (2,5))

layer = paper_layer()
polygon(layer, [(-30,475),(180,400),(380,455),(600,370),
                (790,440),(1010,365),(1320,450),
                (1320,610),(-30,610)], (71,119,105,255))
add_paper(scene, layer, 8, (3,6))

# Sunlit opening and layered paper sun.
layer = paper_layer()
ellipse(layer, (620,125,1020,525), (255,224,160,45))
ellipse(layer, (795,170,925,300), (255,222,139,255))
add_paper(scene, layer, 2, (1,2))

# Hand-cut angular rays, softened into the atmosphere.
rays = paper_layer()
for angle in [-68,-48,-30,-12,9,28,46]:
    a = math.radians(angle)
    x1,y1 = 860,235
    x2,y2 = x1 + math.cos(a)*650, y1 + math.sin(a)*650
    polygon(rays, [(x1,y1),(x2-28,y2),(x2+28,y2)],
            (255,229,174,22))
scene.alpha_composite(rays.filter(ImageFilter.GaussianBlur(15*S)))

# Midground trees: angular trunks and irregular paper crowns.
for x, base, height, crown, color in [
    (190,535,260,78,(53,94,79,255)),
    (365,505,205,65,(61,108,82,255)),
    (1020,515,245,83,(49,91,76,255)),
    (1150,540,310,100,(39,76,68,255)),
    (850,510,190,58,(76,119,83,255)),
]:
    trunk = paper_layer()
    polygon(trunk, [(x-15,base),(x-7,base-height),
                    (x+9,base-height+8),(x+18,base)],
            (101,75,59,255))
    add_paper(scene, trunk, 5, (3,4))

    crown_layer = paper_layer()
    cx, cy = x, base-height
    # Overlapping angular shapes resemble individually cut paper leaves.
    for j in range(9):
        a = j*math.tau/9
        dx = math.cos(a)*crown*.55
        dy = math.sin(a)*crown*.42
        r = crown*random.uniform(.42,.64)
        points = [
            (cx+dx-r*.85,cy+dy),
            (cx+dx-r*.35,cy+dy-r*.75),
            (cx+dx+r*.45,cy+dy-r*.85),
            (cx+dx+r,cy+dy-r*.12),
            (cx+dx+r*.55,cy+dy+r*.7),
            (cx+dx-r*.35,cy+dy+r*.65),
        ]
        polygon(crown_layer, points, random.choice([
            (44,100,73,255),(58,119,79,255),
            (77,137,85,255),(107,151,94,255)
        ]))
    add_paper(scene, crown_layer, 7, (4,5))

# Foreground clearing: layered, curved-looking paper hills.
layer = paper_layer()
polygon(layer, [(-30,600),(180,560),(380,605),(560,555),
                (760,605),(950,555),(1140,600),(1320,555),
                (1320,760),(-30,760)], (72,116,77,255))
add_paper(scene, layer, 8, (0,5))

layer = paper_layer()
polygon(layer, [(-30,665),(190,620),(390,655),(650,615),
                (870,655),(1070,610),(1320,650),
                (1320,760),(-30,760)], (43,85,67,255))
add_paper(scene, layer, 8, (0,5))

# A winding ochre paper path leads the eye into the forest.
layer = paper_layer()
polygon(layer, [(430,740),(810,740),(735,650),(780,580),
                (730,535),(670,550),(690,600),(620,650)],
        (211,163,103,255))
add_paper(scene, layer, 5, (2,4))

# Individual paper leaves and tiny flowers in the foreground.
details = paper_layer()
for _ in range(220):
    x = random.randint(0, W)
    y = random.randint(570, 730)
    size = random.randint(3, 9)
    col = random.choice([
        (130,160,91,255),(171,177,100,255),
        (225,185,111,255),(225,137,139,255),
        (247,220,164,255)
    ])
    polygon(details, [(x-size,y),(x,y-size*.7),
                      (x+size,y),(x,y+size*.8)], col)
add_paper(scene, details, 1, (1,1))

# Edge framing: dark foreground leaves create a miniature stage.
frame = paper_layer()
for x, direction in [(0,1),(W,-1)]:
    for i in range(7):
        yy = 450 + i*42
        xx = x + direction*(i*12)
        polygon(frame, [
            (xx,yy),(xx+direction*95,yy-48),
            (xx+direction*65,yy+3),
            (xx+direction*115,yy+27),
            (xx+direction*25,yy+35)
        ], random.choice([
            (28,65,56,255),(37,81,63,255),
            (47,96,67,255)
        ]))
add_paper(scene, frame, 7, (3,4))

# Place the test character into the environment.
if not CHARACTER.exists():
    raise SystemExit(f"Character file missing: {CHARACTER}")

hero = Image.open(CHARACTER).convert("RGBA")
bbox = hero.getchannel("A").getbbox()
if not bbox:
    raise SystemExit("Character has no visible pixels.")

hero = hero.crop(bbox)
target_h = 345*S
scale = target_h / hero.height
hero = hero.resize(
    (int(hero.width*scale), target_h),
    Image.Resampling.LANCZOS
)

# Soft contact shadow beneath the character.
shadow = Image.new("RGBA", hero.size, (20,31,27,0))
shadow.putalpha(hero.getchannel("A").filter(
    ImageFilter.GaussianBlur(12*S)
).point(lambda a: int(a*.23)))
hx = int(625*S - hero.width/2)
hy = int(700*S - hero.height)
scene.alpha_composite(shadow, (hx+8*S,hy+10*S))
scene.alpha_composite(hero, (hx,hy))

# Fine paper grain, kept subtle so the scene stays clean on a TV.
scene = scene.convert("RGB").resize((W,H), Image.Resampling.LANCZOS)
grain = Image.new("RGB", (W,H))
gp = grain.load()
for y in range(H):
    for x in range(W):
        n = random.choice([-3,-2,-1,0,0,0,1,2,3])
        gp[x,y] = (max(0,min(255,244+n)),
                   max(0,min(255,238+n)),
                   max(0,min(255,224+n)))
scene = Image.blend(scene, grain, 0.055)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
scene.save(OUTPUT, quality=95)
print(f"Created: {OUTPUT}")
print(f"Resolution: {W}x{H}")
