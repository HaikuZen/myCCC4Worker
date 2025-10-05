# Favicon Setup - Quick Start 🎨

## What I've Created

✅ **SVG Icon**: `web/favicon.svg` - A custom bicycle + flame icon in your brand colors  
✅ **Generator Script**: `generate-favicon.js` - Automates PNG generation  
✅ **HTML Links**: Added favicon links to all HTML files  
✅ **Instructions**: Complete guide in `FAVICON_INSTRUCTIONS.md`

## 🚀 Quickest Method (2 Minutes)

1. **Go to**: https://realfavicongenerator.net/

2. **Upload**: `web/favicon.svg`

3. **Click**: "Generate your Favicons and HTML code"

4. **Download**: The generated package

5. **Extract**: All files to the `web/` directory

6. **Done!** ✨ Your favicon is ready!

## 🖼️ What You'll Get

The generated files will include:
- `favicon.ico` - For older browsers
- `favicon-16x16.png` - Small size
- `favicon-32x32.png` - Medium size  
- `apple-touch-icon.png` - For iOS devices
- `android-chrome-192x192.png` - For Android
- `android-chrome-512x512.png` - High-res Android
- `site.webmanifest` - PWA support

## 🎯 The Icon Design

Your favicon features:
- 🚴 **Bicycle icon** - Represents cycling
- 🔥 **Small flame** - Represents calories
- 💜 **Purple background** - Your brand color (#570df8)
- ⚪ **White details** - For clarity

## Alternative: Use the Generator Script

If you have Node.js:

```bash
# Install sharp (optional but recommended)
npm install sharp

# Run the generator
node generate-favicon.js
```

This will:
1. Generate multiple PNG sizes
2. Create a web manifest for PWA support
3. Give you instructions for the final .ico file

## ✅ Already Done

I've already added the favicon links to:
- ✅ `web/index.html` (main dashboard)
- ✅ `web/configuration.html` (admin config page)
- ✅ `web/database.html` (database manager)

So once you generate the favicon files, they'll automatically work!

## 🧪 Testing

After generating and placing the files:

1. **Clear browser cache**: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
2. **Restart your dev server** if it's running
3. **Visit your app**: http://localhost:8787
4. **Check the browser tab** - you should see your new icon!

## 🎨 Want a Different Design?

If you'd like to customize the icon:

1. **Edit** `web/favicon.svg` in any SVG editor (Inkscape, Figma, etc.)
2. **Or use a letter**: Go to https://favicon.io/favicon-generator/
   - Text: "C" or "🚴"
   - Background: #570df8
   - Download and extract

## 📱 Mobile & PWA Support

The setup includes:
- **iOS**: Apple touch icon for home screen
- **Android**: Chrome icons in multiple sizes
- **PWA**: Web manifest for installable app
- **Theme color**: Matches your purple brand color

## Need Help?

See the detailed guide: `FAVICON_INSTRUCTIONS.md`

---

**TL;DR**: Upload `web/favicon.svg` to https://realfavicongenerator.net/, download, extract to `web/`, done! 🎉
