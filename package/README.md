# Chrome Web Store Package Files

Include these files in your ZIP package for the Chrome Web Store:

- manifest.json
- background.js
- popup.js
- popup.html
- content.js
- styles.css
- images/icon16.png
- images/icon48.png
- images/icon128.png

## Packaging steps

1. Create real PNG icon files (replace the placeholders)
2. Zip only the above files:
   ```
   zip -r eli5-buddy.zip manifest.json background.js popup.js popup.html content.js styles.css images/
   ```
3. Upload the ZIP file to the Chrome Web Store Developer Dashboard 