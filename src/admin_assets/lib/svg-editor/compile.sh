#!/bin/sh
# 
# Compile Scripts into svgedit.compiled.js
cat svgedit.js \
jquery-svg.js \
contextmenu/jquery.contextMenu.js \
browser.js \
svgtransformlist.js \
math.js \
units.js \
svgutils.js \
sanitize.js \
history.js \
coords.js \
recalculate.js \
select.js \
draw.js \
path.js \
svgcanvas.js \
svg-editor.js \
locale/locale.js \
contextmenu.js | uglifyjs -c -o svgedit.compiled.js

