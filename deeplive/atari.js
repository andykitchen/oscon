ALE = {};
Module = {};

(function(Module, ALE) {

var net = new convnetjs.Net();
net.fromJSON(net_json);

window.net = net

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

	ALE.reset_game = Module.cwrap('reset_game', null, ['number'])

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

	var canvas_vis = document.getElementById("canvas-vis")
	var ctx_vis = canvas_vis.getContext("2d")

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

	var input_size = 84

	var vol = new convnetjs.Vol(input_size, input_size, 4)

	var rotate_screens = function() {
		for(var i = 0; i < 3; i++) {
			ctx_out[i].drawImage(canvas_out[i+1], 0, 0)
		}
	}

	var frameskip_counter = 1;
	var last_action = 0;


	var btn_left  = document.getElementById("btn-left")
	var btn_right = document.getElementById("btn-right")
	var btn_shoot = document.getElementById("btn-shoot")

	document.body.addEventListener('click', function() {
		console.log('reset!')
		ALE.reset_game(ale);
	}, false)


	var update_buttons = function(action) {
		var setActive = function(btn, active) {
			if(active) {
				btn.classList.add('active')
			} else {
				btn.classList.remove('active')
			}
		}

		if(action == 0) {
			setActive(btn_left,  false)
			setActive(btn_right, false)
			setActive(btn_shoot, false)
		}

		if(action == 1) {
			setActive(btn_left,  false)
			setActive(btn_right, false)
			setActive(btn_shoot, true)
		}

		if(action == 3) {
			setActive(btn_left,  false)
			setActive(btn_right, true)
			setActive(btn_shoot, false)
		}

		if(action == 4) {
			setActive(btn_left,  false)
			setActive(btn_right, true)
			setActive(btn_shoot, false)
		}

		if(action == 11) {
			setActive(btn_left,  false)
			setActive(btn_right, true)
			setActive(btn_shoot, true)
		}

		if(action == 12) {
			setActive(btn_left,  true)
			setActive(btn_right, false)
			setActive(btn_shoot, true)
		}
	}

	var draw = function() {
		if(frameskip_counter <= 1) {
			for(var d = 0; d < 4; d++) {
				var imageData_small = ctx_out[d].getImageData(0, 0, input_size, input_size)
				var small_data = imageData_small.data
				for(var y = 0; y < input_size; y++) {
					for(var x = 0; x < input_size; x++) {
						// vol.set(x, y, d, small_data[4*(imageData_small.width*y + x)] / 255.0)
						vol.set(x, y, d, small_data[4*(imageData_small.width*y + x)])
					}
				}
			}

			var res = net.forward(vol)
			var action_index = argmax(res.w)
			var action = action_set[action_index]

			update_buttons(action)

			var tile_size = 20
			var tile_pad = 1
			for(var i = 0; i < 16; i++) {
				for(var j = 0; j < 16; j++) {
					var a = net.layers[6].out_act.get(0, 0, i*16 + j)
					var z = Math.floor(a);
					var r = z,
						g = z,
						b = z;

					ctx_vis.fillStyle = "rgba("+r+","+g+","+b+", 1.0)";
					ctx_vis.fillRect(
						i*tile_size + tile_pad, 
						j*tile_size + tile_pad,
						tile_size - tile_pad,
						tile_size - tile_pad);
				}
			}

			// var r = Math.random()
			// if(r < 0.1) {
			// 	action = action_set[Math.floor(Math.random()*action_set.length)]
			// }

			last_action = action
			frameskip_counter = 4
		} else {
			action = last_action
			frameskip_counter -= 1
		}

		ALE.act(ale, action)

		rotate_screens()

		ALE._getScreenGrayscale(ale, screen_ptr)
		ALE.util.gray2rgba(screen_len, screen_ptr, buf8_ptr)
		var rgba = Module.HEAPU8.subarray(buf8_ptr, buf8_ptr + imageData.data.length)
		imageData.data.set(rgba);

		ctx.putImageData(imageData, 0, 0);
		ctx_out[3].drawImage(canvas, 0, 0, 160, 210, 0, -18, 84, 110)
		// ctx_out[3].drawImage(canvas, 0, 0, 160, 210, 0, 0, 84, 84)

		ALE._getScreenRGB(ale, screen_rgb_ptr)
		ALE.util.rgb2rgba(screen_len, screen_rgb_ptr, buf8_ptr)
		var rgba = Module.HEAPU8.subarray(buf8_ptr, buf8_ptr + imageData.data.length)
		imageData.data.set(rgba)
		ctx_rgb.putImageData(imageData, 0, 0)
	}

	var redraw = function() {
		draw()
		window.requestAnimationFrame(redraw)
		// console.log("tick")
		// window.setTimeout(redraw, 500)
	}

	redraw()
}

Module.onRuntimeInitialized = onRuntimeInitialized;

})(Module, ALE);
