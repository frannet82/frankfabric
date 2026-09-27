# Homepage avatar render

Created with the built-in image generation tool, using `public/images/final_futuristic_avatar.jpg` as the edit target. The original is preserved; the homepage uses `public/images/final_futuristic_avatar_3d.jpg`.

## Generation prompt

Use case: style-transfer. Edit target: the supplied futuristic avatar portrait for a website hero. Transform this photo into a clearly dimensional premium 3D-rendered character/bust with sculpted facial forms, subtly stylized smooth skin, dimensional modeled hair strands, physically based materials, convincing ambient occlusion, and cinematic depth. Preserve the same person's recognizable features, exact head pose looking upward left, framing, silver metallic bomber jacket, oversized wraparound black glasses, square composition, dark purple background, and cyan/magenta lighting palette. Add clearly visible elegant reflections of a futuristic cyan and magenta illuminated city skyline and light strips in the glasses, correctly warped along the curved lens surfaces with layered specular highlights. Reflections should be distinct and tasteful, not opaque pasted images. Make the jacket folds and glasses frames look like tangible 3D geometry. Keep the silhouette/composition suitable for replacing this homepage portrait. No text, no logos, no watermark. Output a finished square image.

The generated PNG was encoded as a quality-90 JPEG with macOS `sips` for the site.

## Panel breakout cutout

The homepage now uses `public/images/final_futuristic_avatar_cutout.png`, generated with the built-in image generation tool. The transparent silhouette extends beyond the hero panel with a soft drop shadow; navigation and text remain separate clickable layers.

Prompt: Use case: background-extraction. Edit target: supplied 3D avatar. Remove ONLY the purple background and output a genuinely transparent PNG with alpha. Preserve the exact person, face, pose, neon skyline reflections in glasses, cyan/magenta light, silver jacket, fine hair silhouette and 3D rendered finish. Isolate the bust cleanly on transparent background, no colored background, no checkerboard baked into pixels, no added objects. Keep entire existing head and torso. Tight framing around the silhouette with a small transparent margin on top and sides; torso cropped at bottom as in source. Intended for a website figure that overlaps a panel edge.
