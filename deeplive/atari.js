ALE = {};
Module = {};

(function(Module, ALE) {

var net = new convnetjs.Net();
net.fromJSON(net_json);

function argmax(arr) {
	var k = undefined
	var x = Number.NEGATIVE_INFINITY
	var len = arr.length
	for(var i = 0; i < len; i++) {
		var val = arr[i]
		if(val > x) {
			x = val
			k = i
		}
	}

	return k
}

function wrap_ale(Module, ALE) {
	ALE.ALE_new = Module.cwrap('ALE_new', null, [])
	ALE.loadROM =  Module.cwrap('loadROM', null, ['number', 'string'])

	ALE._getMinimalActionSize = Module.cwrap('getMinimalActionSize', 'number', ['number'])
	ALE._getMinimalActionSet  = Module.cwrap('getMinimalActionSet', null, ['number', 'number'])

	ALE.getMinimalActionSet = function(ale) {
		var n = _getMinimalActionSize(ale)

		var buf_len = n*Module.HEAP32.BYTES_PER_ELEMENT
		var buf = Module._malloc(buf_len)
		_getMinimalActionSet(ale, buf)

		var ret = Module.HEAP8.slice(buf, buf+buf_len)
		ret = new Int32Array(ret.buffer)

		Module._free(buf)
		return ret
	}

	ALE.getScreenWidth  = Module.cwrap('getScreenWidth',  'number', ['number'])
	ALE.getScreenHeight = Module.cwrap('getScreenHeight', 'number', ['number'])

	ALE._getScreenGrayscale = Module.cwrap('getScreenGrayscale', 'number', ['number', 'number'])
	ALE._getScreenRGB = Module.cwrap('getScreenRGB', 'number', ['number', 'number'])

	ALE.getScreenGrayscale = function() {
		var h = getScreenHeight(ale);
		var w = getScreenWidth(ale);

		var buf_len = h*w;
		var buf = Module._malloc(buf_len)

		_getScreenGrayscale(ale, buf)

		var ret = Module.HEAP8.slice(buf, buf+buf_len)
		Module._free(buf)
		return ret
	}

	ALE.act = Module.cwrap('act', 'number', ['number', 'number'])

	ALE.util = {}

	ALE.util.gray2rgba = Module.cwrap('gray2rgba', null, ['number', 'number', 'number'])
	ALE.util.rgb2rgba  = Module.cwrap('rgb2rgba',  null, ['number', 'number', 'number'])

	return ALE
}

function onRuntimeInitialized() {
	wrap_ale(Module, ALE)

	var ale = ALE.ALE_new();
	ALE.loadROM(ale, 'space_invaders.bin')

	console.log(ALE.getScreenHeight(ale))
	console.log(ALE.getScreenWidth(ale))
	console.log(ALE.getMinimalActionSet(ale))

	var action_set = ALE.getMinimalActionSet(ale)

	var canvas = document.getElementById("canvas")
	var ctx = canvas.getContext("2d")

	var canvas_out = [
		document.getElementById("canvas-s0"),
		document.getElementById("canvas-s1"),
		document.getElementById("canvas-s2"),
		document.getElementById("canvas-s3")
	]

	var ctx_out = canvas_out.map(function(canvas) {return canvas.getContext("2d")})

	var canvas_rgb = document.getElementById("canvas-rgb")
	var ctx_rgb = canvas_rgb.getContext("2d")


	var imageData = ctx.createImageData(160, 210)
	// var buf = new ArrayBuffer(imageData.data.length);
	// var buf8 = new Uint8Array(buf);
	var buf8_ptr = Module._malloc(imageData.data.length);

	var h = ALE.getScreenHeight(ale);
	var w = ALE.getScreenWidth(ale);

	var screen_len = h*w;
	var screen_ptr = Module._malloc(screen_len)

	var screen_rgb_ptr = Module._malloc(3*screen_len)

	assert(imageData.data.length == 4*screen_len)

	var data = imageData.data

	var vol = new convnetjs.Vol(84, 84, 4)

	var rotate_screens = function() {
		for(var i = 3; i > 0; i--) {
			ctx_out[i-1].drawImage(canvas_out[i], 0, 0)
		}
	}

	var draw = function() {
		var w = vol.w;
		for(var k = 0; k < 4; k++) {
			var imageData_small = ctx_out[k].getImageData(0, 0, 84, 84)
			var small_data = imageData_small.data
			for(var i = 0; i < screen_len; i++) {
				w[4*i + k] = small_data[4*i] / 255.0
			}
		}

		var res = net.forward(vol)
		var action_index = argmax(res.w)
		var action = action_set[action_index]

		var r = Math.random()
		if(r < 0.1) {
			action = action_set[Math.floor(Math.random()*action_set.length)]
		}
		ALE.act(ale, action)

		rotate_screens()

		ALE._getScreenGrayscale(ale, screen_ptr)
		ALE.util.gray2rgba(screen_len, screen_ptr, buf8_ptr)
		var rgba = Module.HEAPU8.subarray(buf8_ptr, buf8_ptr + imageData.data.length)
		imageData.data.set(rgba);

		ctx.putImageData(imageData, 0, 0);
		ctx_out[3].drawImage(canvas, 0, 0, 160, 210, 0, -18, 84, 110)

		ALE._getScreenRGB(ale, screen_rgb_ptr)
		ALE.util.rgb2rgba(screen_len, screen_rgb_ptr, buf8_ptr)
		var rgba = Module.HEAPU8.subarray(buf8_ptr, buf8_ptr + imageData.data.length)
		imageData.data.set(rgba)
		ctx_rgb.putImageData(imageData, 0, 0)
	}

	var redraw = function() {
		draw()
		window.requestAnimationFrame(redraw)
	}

	redraw()
}

Module.onRuntimeInitialized = onRuntimeInitialized;

})(Module, ALE);
