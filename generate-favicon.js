/**
 * Favicon Generator Script
 * Generates favicon.ico and various PNG sizes from favicon.svg
 * 
 * Usage: node generate-favicon.js
 * 
 * Requirements:
 * - npm install sharp (for PNG generation)
 * - Or use online converters (see FAVICON_INSTRUCTIONS.md)
 */

const fs = require('fs');
const path = require('path');

console.log('🎨 Favicon Generator for myCCC');
console.log('================================\n');

const svgPath = path.join(__dirname, 'web', 'favicon.svg');
const outputDir = path.join(__dirname, 'web');

// Check if SVG exists
if (!fs.existsSync(svgPath)) {
    console.error('❌ Error: favicon.svg not found in web/ directory');
    process.exit(1);
}

console.log('✅ Found favicon.svg');
console.log(`📁 Output directory: ${outputDir}\n`);

// Check if sharp is installed
try {
    const sharp = require('sharp');
    console.log('✅ Sharp library detected - generating PNG files...\n');
    
    generateWithSharp(sharp);
} catch (error) {
    console.log('⚠️  Sharp library not installed');
    console.log('📝 To install: npm install sharp\n');
    console.log('Alternative options:');
    console.log('1. Install sharp and run this script again');
    console.log('2. Use online converters (recommended):');
    console.log('   - https://realfavicongenerator.net/');
    console.log('   - https://favicon.io/favicon-converter/');
    console.log('   - https://convertio.co/svg-ico/\n');
    console.log('3. Upload web/favicon.svg to any of the above sites');
    console.log('4. Download the generated favicon.ico');
    console.log('5. Place it in the web/ directory\n');
    
    console.log('📖 See FAVICON_INSTRUCTIONS.md for detailed steps');
}

async function generateWithSharp(sharp) {
    const svg = fs.readFileSync(svgPath);
    
    // Sizes to generate
    const sizes = [
        { size: 16, name: 'favicon-16x16.png' },
        { size: 32, name: 'favicon-32x32.png' },
        { size: 48, name: 'favicon-48x48.png' },
        { size: 180, name: 'apple-touch-icon.png' },
        { size: 192, name: 'android-chrome-192x192.png' },
        { size: 512, name: 'android-chrome-512x512.png' }
    ];
    
    console.log('🖼️  Generating PNG files:\n');
    
    try {
        for (const { size, name } of sizes) {
            const outputPath = path.join(outputDir, name);
            await sharp(svg)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            
            console.log(`  ✓ Generated ${name} (${size}x${size})`);
        }
        
        console.log('\n✅ PNG generation complete!\n');
        console.log('📝 Next steps:');
        console.log('1. For favicon.ico, use one of these methods:');
        console.log('   a) Online converter: Upload favicon-32x32.png to https://convertio.co/png-ico/');
        console.log('   b) ImageMagick: magick convert favicon-32x32.png favicon.ico');
        console.log('   c) Just use the SVG (modern browsers support it)\n');
        console.log('2. Add favicon links to your HTML files (see FAVICON_INSTRUCTIONS.md)\n');
        console.log('3. Test by visiting your app and checking the browser tab\n');
        
        // Generate web manifest
        generateWebManifest();
        
    } catch (error) {
        console.error('❌ Error generating PNGs:', error.message);
        console.log('\n💡 Try using online converters instead (see FAVICON_INSTRUCTIONS.md)');
    }
}

function generateWebManifest() {
    const manifest = {
        name: "Cycling Calories Calculator",
        short_name: "myCCC",
        description: "Calculate calories burned during cycling activities with GPX analysis",
        icons: [
            {
                src: "/android-chrome-192x192.png",
                sizes: "192x192",
                type: "image/png"
            },
            {
                src: "/android-chrome-512x512.png",
                sizes: "512x512",
                type: "image/png"
            }
        ],
        theme_color: "#570df8",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/"
    };
    
    const manifestPath = path.join(outputDir, 'site.webmanifest');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('📱 Generated site.webmanifest for PWA support');
}

// If sharp is not available, show helpful message
if (!module.parent) {
    // Script is being run directly
    console.log('\n💡 Quick tip: For the fastest result, just use the online converter:');
    console.log('   1. Go to https://realfavicongenerator.net/');
    console.log('   2. Upload web/favicon.svg');
    console.log('   3. Download and extract to web/ folder');
    console.log('   4. Done! 🎉');
}
