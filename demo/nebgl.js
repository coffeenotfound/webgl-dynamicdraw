// lazy getter test
// context extension properties could be lazy getters to allow automatic creation of required extensions
var lazygetter = {
	active: (function() {
		console.log("evaluated active!");
		return 'active value';
	})(),
	
	get lazy() {
		delete this.lazy;
		console.log("evaluated lazy!")
		return this.lazy = 'lazy value';
	},
};

var NebGL = {
	
	/** Utils of the utils */
	Utils: {
		/** returns the width and height of the browser window's inner viewport */
		getWindowSize: function() {
			return { x: window.innerWidth, y: window.innerHeight };
		},
	},
	
	/** Creates a new WebGL context for the given canvas */
	createGL: function(canvas, config) {
		config = config || {};
		
		// default properties
		config.width = config.width || 640;
		config.height = config.height || 480;
		
		// set canvas size
		if(config.width) canvas.setAttribute("width", config.width);
		if(config.height) canvas.setAttribute("height", config.height);
		
		// try create webgl 2 context
		gl = canvas.getContext("webgl2", config) || canvas.getContext("experimental-webgl2", config);
		
		// create webgl1 context
		if(!gl) {
			gl = canvas.getContext("webgl", config);
		}
		
		// context creation failed
		if(!gl) {
			throw "WebGL context creation failed: webgl may be unsupported";
		}
		
		// query extensions
		var supportedExts = gl.getSupportedExtensions();
		//gl.supportedExtensions = supportedExts;
		console.log(supportedExts);
		
		return gl;
	},
	
	/** Creates a new WebGL context for the canvas with the given element id */
	createGLForId: function(id, config) {
		var canvas = document.getElementById(id);
		
		var gl = this.createGL(canvas, config);
		return gl;
	},
	
	// ### extensions ###
	
	supports: function(gl, ext) {
		return gl.getSupportedExtensions()[ext] == true;
	},
	
	createExtension: function(gl, name) {
		// create extension
		var ext = gl.getExtension(name);
		
		if(ext) {
			// prettyfy name
			var prettyName = this._prettifyExtensionName(name);
			console.log(prettyName);
			
			// set property
			ext.prettyName = prettyName;
			gl[prettyName] = ext;
		}
		return ext;
	},
	
	_prettifyExtensionName: function(name) {
		return name.replace(new RegExp("_(.)", "g"), function(match, p1) {
			return p1.toUpperCase();
		});
	},
	
	// ### buffers ###
	
	createBuffer: function(gl) {
		// create buffer
		var buffer = gl.createBuffer();
		return buffer;
	},
	uploadBuffer: function(gl, buffer, target, data, usage) {
		// bind buffer
		gl.bindBuffer(target, buffer);
		
		// upload
		gl.bufferData(target, data, usage);
		//gl.bufferData(target, new Float32Array(data), usage);
		
		// add info property
		var info = { target: target, length: data.length };
		buffer.info = info;
	},
	
	// ### vertexarray ###
	
	/*
	createVertexArray: function(gl, vertexattribs) {
		// create the vertexarray
		var vertexarray = gl.createVertexArray();
		
		// bind
		gl.bindVertexArray(vertexarray);
		
		// set vertexattributes
		for(var i = 0; i < vertexattribs.length; i++) {
			var attrib = vertexattribs[i];
			
			// bind buffer
			gl.bindBuffer(gl.VERTEX_ARRAY, attrib.buffer);
			
			// bind vertexpointer
			var attribIndex = attrib.index || i;
			gl.enableVertexAttribArray(attribIndex);
			gl.vertexAttribPointer(attribIndex, (attrib.comps || 3), (attrib.type || gl.FLOAT), false, (attrib.stride || 0), (attrib.offset || 0));
		}
		
		// unbind
		gl.bindVertexArray(0);
		
		return vertexarray;
	},
	*/
	
	// ### framebuffer ###
	
	createFramebuffer: function(gl, config) {
		config = config || {};
		
		// create framebuffer
		var framebuffer = gl.createFramebuffer();
		
		var width = config.width;
		var height = config.height;
		
		// set properties
		framebuffer.width = width;
		framebuffer.height = height;
		
		// create attachments
		var attachments = config.attachments || [];
		for(var i = 0; i < attachments.length; i++) {
			var attach = attachments[i];
			
			// TODO: this has to do more checking what the attachment should actually be -> tex? renderbuffer? has to be created?
			
			var isDepth = attach.depth == true;
			
			if(isDepth) {
				this.framebufferRenderbuffer(attach);
			}
			else {
				this.framebufferTexture(attach);
			}
		}
		return framebuffer;
	},
	
	framebufferTexture: function(gl, framebuffer, config) {
		config = config || {};
		
		var texture = config.tex;
		
		// create texture
		if(!texture) {
			texture = gl.createTexture();
			
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, // level
				(config.internalformat || gl.RGBA), // internalformat (RGBA8 is only accepted in webgl2 because reasons)
				(config.width || framebuffer.width), // width
				(config.height || framebuffer.height), // height
				0, // border
				(config.format || gl.RGBA), // format
				(config.type || gl.UNSIGNED_BYTE), // type
				null); // data
		}
		
		// bing framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		
		// attach texture
		gl.framebufferTexture2D(gl.FRAMEBUFFER, config.point, gl.TEXTURE_2D, texture, 0);
		
		return texture;
	},
	
	framebufferRenderbuffer: function(gl, framebuffer, config) {
		config = config || {};
		
		var renderbuffer = config.renderbuffer;
		
		// create renderbuffer
		if(!renderbuffer) {
			renderbuffer = gl.createRenderbuffer();
			
			gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER,
				(config.internalformat || gl.DEPTH_COMPONENT16), // internalformat
				(config.width || framebuffer.width), // width
				(config.height || framebuffer.height)); // height
		}
		
		// bing framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		
		// attach renderbuffer
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, config.point, gl.RENDERBUFFER, renderbuffer);
		
		return renderbuffer;
	},
	
	// ### shaders ###
	
	/** Creates and compiles a shader with the given type from the given glsl code. */
	createShaderFromCode: function(gl, type, code) {
		if(type != gl.FRAGMENT_SHADER && type != gl.VERTEX_SHADER) {
			throw ("shader creation failed: unknown shader type: " + type);
		}
		
		var shader;
		try {
			// create and compile
			shader = gl.createShader(type);
			gl.shaderSource(shader, code);
			gl.compileShader(shader);
			
			// check status
			if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				var infolog = gl.getShaderInfoLog(shader);
				throw ("shader compile failed: " + infolog);
			}
		}
		catch(e) {
			// destroy shader
			if(shader) {
				gl.deleteShader(shader);
			}
			
			throw e;
		}
		return shader;
	},
	
	/** Creates and compiles a shader with the given type from the glsl code in the script tag with the given id. */
	createShaderFromScript: function(gl, type, scriptid) {
		// find script tag
		var scriptTag = document.getElementById(scriptid);
		if(!scriptTag) throw ("shader creation failed: unknown script tag: #" + scriptid);
		
		// create shader
		var shader = this.createShaderFromCode(gl, type, scriptTag.text);
		return shader;
	},
	
	/** Creates and links a shader program from the given vertex and fragment shader objects. */
	createProgramFromShaders: function(gl, vert, frag) {
		// create program
		var program = gl.createProgram();
		
		// attach shaders
		gl.attachShader(program, vert);
		gl.attachShader(program, frag);
		
		// link
		gl.linkProgram(program);
		
		// check status
		if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			var infolog = gl.getProgramInfoLog(program);
			throw ("program linking failed: " + infolog);
		}
		return program;
	},
	
	/** Creates and links a shader program from the given vertex and fragment shader code. */
	createProgramFromCode: function(gl, vertcode, fragcode) {
		// create shaders
		var vert = this.createShaderFromCode(gl, gl.VERTEX_SHADER, vertcode);
		var frag = this.createShaderFromCode(gl, gl.FRAGMENT_SHADER, fragcode);
		
		// create program
		var program = this.createProgramFromShaders(gl, vert, frag);
		return program;
	},
	
	/** Creates and links a shader program from vertex and fragment shader code from the script tags with the given ids. */
	createProgramFromScripts: function(gl, vertscriptid, fragscriptid) {
		// create shaders
		var vert = this.createShaderFromScript(gl, gl.VERTEX_SHADER, vertscriptid);
		var frag = this.createShaderFromScript(gl, gl.FRAGMENT_SHADER, fragscriptid);
		
		// create program
		var program = this.createProgramFromShaders(gl, vert, frag);
		return program;
	},
};