import os
import re
from PIL import Image

def main():
    img_path = r"c:\Users\KennedyMonteirodeLim\OneDrive - AVANÇO SA\Documentos\GitHub\Projeto_inventario_TI\web\src\assets\logo_avanço.png"
    if not os.path.exists(img_path):
        print(f"Image not found at {img_path}")
        return
        
    img = Image.open(img_path)
    w, h = img.size
    print(f"Loaded image: {w}x{h}")
    
    white_mask = [[0]*w for _ in range(h)]
    orange_mask = [[0]*w for _ in range(h)]
    
    for y in range(h):
        for x in range(w):
            r, g, b = img.getpixel((x, y))[:3]
            # White pixels
            if r > 180 and g > 180 and b > 180:
                white_mask[y][x] = 1
            # Orange pixels
            elif r > 180 and g > 120 and b < 60:
                orange_mask[y][x] = 1
                
    def trace(mask):
        visited = set()
        contours = []
        dirs = [(0,1), (1,1), (1,0), (1,-1), (0,-1), (-1,-1), (-1,0), (-1,1)]
        
        for y in range(1, h-1):
            for x in range(1, w-1):
                if mask[y][x] == 1 and (x, y) not in visited:
                    is_border = False
                    for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                        if mask[y+dy][x+dx] == 0:
                            is_border = True
                            break
                    if not is_border:
                        continue
                        
                    path = []
                    curr = (x, y)
                    path.append(curr)
                    visited.add(curr)
                    
                    cx, cy = x, y
                    dir_idx = 0
                    start = curr
                    
                    limit = 5000
                    while limit > 0:
                        limit -= 1
                        next_pixel = None
                        for step in range(8):
                            idx = (dir_idx + step) % 8
                            dx, dy = dirs[idx]
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] == 1:
                                nb_border = False
                                for bx, by in [(-1,0), (1,0), (0,-1), (0,1)]:
                                    px, py = nx+bx, ny+by
                                    if px < 0 or px >= w or py < 0 or py >= h or mask[py][px] == 0:
                                        nb_border = True
                                        break
                                if nb_border:
                                    next_pixel = (nx, ny)
                                    dir_idx = (idx + 5) % 8
                                    break
                        if next_pixel is None or next_pixel == start:
                            break
                        if next_pixel in visited and len(path) > 2 and next_pixel == path[1]:
                            break
                        path.append(next_pixel)
                        visited.add(next_pixel)
                        cx, cy = next_pixel[0], next_pixel[1]
                        
                    if len(path) > 5:
                        simp = []
                        simp.append(path[0])
                        for i in range(1, len(path)-1):
                            p1 = path[i-1]
                            p2 = path[i]
                            p3 = path[i+1]
                            # Simplify collinear points
                            if (p2[1]-p1[1])*(p3[0]-p2[0]) == (p3[1]-p2[1])*(p2[0]-p1[0]):
                                continue
                            simp.append(p2)
                        simp.append(path[-1])
                        contours.append(simp)
        return contours

    white_c = trace(white_mask)
    orange_c = trace(orange_mask)
    
    print(f"Found {len(white_c)} white and {len(orange_c)} orange contours.")
    
    def make_d(contours):
        subpaths = []
        for c in contours:
            pts = []
            pts.append(f"M {c[0][0]} {c[0][1]}")
            for p in c[1:]:
                pts.append(f"L {p[0]} {p[1]}")
            pts.append("Z")
            subpaths.append(" ".join(pts))
        return " ".join(subpaths)
        
    white_d = make_d(white_c)
    orange_d = make_d(orange_c)
    
    app_jsx_path = r"c:\Users\KennedyMonteirodeLim\OneDrive - AVANÇO SA\Documentos\GitHub\Projeto_inventario_TI\web\src\App.jsx"
    if not os.path.exists(app_jsx_path):
        print(f"App.jsx not found at {app_jsx_path}")
        return
        
    with open(app_jsx_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # We want to construct the perfect inline SVG that replaces the entire <div className="logo" ...> ... </div> block
    # ViewBox is 18 20 234 56 as calculated. Width 180 and height 42 keeps same scale.
    new_svg = f"""<div className="logo" onClick={{() => setActiveTab('dashboard')}}>
          <svg viewBox="18 20 234 56" width="180" height="43" style={{{{ display: 'block', flexShrink: 0 }}}}>
            <path d="{orange_d}" fill="#fcae17" />
            <path d="{white_d}" fill="#ffffff" />
          </svg>
        </div>"""
        
    logo_pattern = r'<div\s+className="logo"\s+onClick=\{[^}]+\}>.*?</div>'
    match = re.search(logo_pattern, content, re.DOTALL)
    if match:
        print("Found logo block in App.jsx!")
        new_content = re.sub(logo_pattern, new_svg, content, flags=re.DOTALL)
        with open(app_jsx_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Logo successfully replaced in App.jsx!")
    else:
        print("Could not find the logo block pattern in App.jsx.")

if __name__ == "__main__":
    main()
