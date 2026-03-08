# PWA Icons Setup

To complete the PWA mobile installation, you need to add app icons.

## Required Icons:

1. **icon-192.png** (192x192 pixels)
2. **icon-512.png** (512x512 pixels)

## How to Create Icons:

### Option 1: Use a Logo Generator
1. Visit https://favicon.io/ or https://realfavicongenerator.net/
2. Upload your logo or create one with text "MGM"
3. Download the generated icons
4. Rename them to `icon-192.png` and `icon-512.png`
5. Place them in `frontend/public/`

### Option 2: Use Canva (Free)
1. Go to https://canva.com
2. Create a 512x512px square design
3. Add "MGM Assist" text with Montgomery-themed colors:
   - Background: Dark navy (#0a0f1e)
   - Text: Gold (#f59e0b) or Cyan (#06b6d4)
4. Download as PNG
5. Use online tool to resize to 192x192px for the smaller version
6. Save both to `frontend/public/`

### Option 3: Simple Placeholder (Quick Start)
Use a solid color square with your initials:
- Background: #0a0f1e (navy)
- Text: "MGM" in white or gold
- Save as 512x512px and 192x192px

## Recommended Design:
- **Theme**: Government/civic (building icon, capitol dome, etc.)
- **Colors**: Navy blue (#0a0f1e) + Gold (#f59e0b)
- **Style**: Modern, clean, professional
- **Text**: "MGM" or just an icon

Once you add the icons, users can install MGM Assist on their phones from any browser!

## Testing PWA Installation:

### On Android (Chrome):
1. Open https://your-vercel-url.vercel.app
2. Tap the menu (⋮) → "Add to Home Screen"
3. App icon appears on home screen

### On iOS (Safari):
1. Open https://your-vercel-url.vercel.app  
2. Tap Share button → "Add to Home Screen"
3. App icon appears on home screen

### On Desktop (Chrome/Edge):
1. Look for install icon (⊕) in address bar
2. Click "Install MGM Assist"
3. Opens as standalone app window
