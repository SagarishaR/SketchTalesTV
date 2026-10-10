from PIL import Image, ImageDraw
import os, random, math

OUT = "backend/public/scenes"
os.makedirs(OUT, exist_ok=True)
W, H = 1280, 720

def make_scene(name, sky, ground, title, seed, theme):
    random.seed(seed)
    im = Image.new("RGB", (W, H), sky)
    d = ImageDraw.Draw(im, "RGBA")

    # Soft atmospheric glow
    for r in range(260, 20, -8):
        a = max(2, int(22 * (1-r/280)))
        d.ellipse((900-r, 100-r, 900+r, 100+r), fill=(255, 231, 151, a))

    # Distant rolling hills
    for i in range(4):
        y = 420 + i * 55
        points = [(-100, H)]
        for x in range(-100, W+200, 30):
            yy = y + math.sin((x + seed*19 + i*65)/155) * (40+i*7)
            points.append((x, yy))
        points.extend([(W+100, H)])
        d.polygon(points, fill=ground if i > 1 else (77, 119, 116, 255))

    # Scene-specific elements
    if theme == "river":
        d.polygon([(0,500),(W,445),(W,H),(0,H)], fill=(44,133,183,220))
        for i in range(8):
            x = random.randint(20, W-100)
            y = random.randint(520, 680)
            d.arc((x,y,x+90,y+25), 190, 340, fill=(177,235,255,210), width=4)
        for x,y in [(330,520),(490,555),(650,535),(820,565)]:
            d.ellipse((x,y,x+95,y+34), fill=(194,180,148,255))
            d.ellipse((x+8,y+5,x+83,y+24), fill=(224,212,180,255))
    elif theme == "cave":
        d.polygon([(0,0),(230,0),(330,250),(240,470),(0,520)], fill=(38,38,70,255))
        d.polygon([(W,0),(W-240,0),(W-340,260),(W-220,490),(W,540)], fill=(38,38,70,255))
        for x,y in [(410,430),(570,500),(780,420),(930,490),(680,360)]:
            d.polygon([(x,y),(x-28,y+70),(x+28,y+70)], fill=(98,233,255,210))
            d.ellipse((x-10,y+18,x+10,y+38), fill=(200,250,255,220))
    elif theme == "castle":
        # Castle silhouette
        d.rectangle((420,260,850,500), fill=(92,81,133,255))
        for x in [430,535,735,840]:
            d.rectangle((x,205,x+65,330), fill=(113,99,157,255))
            d.polygon([(x-8,205),(x+32,145),(x+73,205)], fill=(244,172,119,255))
        d.rectangle((590,360,680,500), fill=(47,43,78,255))
        d.ellipse((610,410,660,460), fill=(255,218,126,255))
        for x,y in [(280,430),(970,440),(350,350),(900,350)]:
            d.ellipse((x,y,x+15,y+15), fill=(255,232,135,240))
    elif theme == "celebration":
        # Stars and confetti
        for _ in range(100):
            x,y = random.randint(0,W), random.randint(30,560)
            r = random.choice([2,3,5,7])
            color = random.choice([(255,224,117,230),(255,170,190,230),(177,221,255,230)])
            d.ellipse((x-r,y-r,x+r,y+r), fill=color)
        for x,y in [(250,300),(1030,270),(390,200),(850,180)]:
            d.line((x-18,y,x+18,y), fill=(255,244,180,240), width=4)
            d.line((x,y-18,x,y+18), fill=(255,244,180,240), width=4)

    # Foreground flowers / grass
    for _ in range(100):
        x = random.randint(0,W)
        y = random.randint(590,710)
        d.line((x,y,x+random.randint(-4,4),y- random.randint(8,24)),
               fill=(93,166,105,210), width=2)
        if random.random() < 0.3:
            d.ellipse((x-4,y-22,x+4,y-14), fill=(255,210,130,230))

    im.save(os.path.join(OUT, name))
    print("Created:", os.path.join(OUT, name))

make_scene("scene-2-river.png", (100,175,220), (58,126,103,255),
           "River Crossing", 2, "river")
make_scene("scene-3-cave.png", (31,38,77), (49,64,91,255),
           "The Mystery", 3, "cave")
make_scene("scene-4-castle.png", (93,107,177), (66,93,113,255),
           "The Climax", 4, "castle")
make_scene("scene-5-celebration.png", (65,94,157), (48,113,92,255),
           "The Ending", 5, "celebration")
