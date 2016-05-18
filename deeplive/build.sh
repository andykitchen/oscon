#!/bin/bash

EMSCRIPTEN_PREFIX=/usr/local/Cellar/emscripten/1.36.3/libexec/system

emcc \
	-O2 \
	--embed-file space_invaders.bin \
	--memory-init-file 0 \
	--pre-js pre.js \
	-L $EMSCRIPTEN_PREFIX/usr/local/lib \
	-lale_c -lz \
	ale-util.c \
	-o ale_interface.js \
	-s EXPORTED_FUNCTIONS="['_ALE_new', '_loadROM','_getMinimalActionSize', '_getMinimalActionSet', '_act', '_getScreenWidth', '_getScreenHeight', '_getScreenRGB', '_getScreenGrayscale', '_gray2rgba', '_rgb2rgba']"
