
//
// TERM EXPLANATION:
// - components: float vector components, i.e. one vec3 vertex attrib is the size of three components (used to instead of raw byte sizes for convinienve)
// - vertex attrib: either a gl vertex attribute or the size of some vertex attribute in components
// - vertex index: a single 'vertex' consisting of one value of each vertex attrib for a single 'full vertex'
// - vertex primitive: the number of vertex indices required to assemble one primitive of some kind (e.g.: TRIANGLES need three 'vertices' (vertex indices))

var WebGLDynamicDraw = {
	
	createContext: function(gl) {
		var context = new WebGLDynamicDraw.DynamicDrawContext(gl);
		return context;
	},
	
	destroyContext: function(context) {
		if(context) {
			context._destroy();
		}
	},
};


// context contains cached state
WebGLDynamicDraw.DynamicDrawContext = function(gl) {
	this.gl = gl;
	
	// try create OES_vertex_array_object extension
	if(this.gl.createVertexArray !== undefined) {
		this._useVertexArrayOES = false;
		
		// DEBUG: log
		console.log("GLDD: USE WEBGL2 createVertexArray");
	}
	else {
		this._useVertexArrayOES = true;
		this.OESVertexArrayObject = gl.getExtension("OES_vertex_array_object");
		
		// DEBUG: log
		console.log("GLDD: USE EXTENSION createVertexArrayOES");
	}
	
	// create recordArray
	this.recordArray = new WebGLDynamicDraw.RecordArray(this, 256);
	
	// create drawBuffer
	this.drawBuffer = new WebGLDynamicDraw.DrawBuffer(this, 256);
	
	// create vertexarray
	if(this._useVertexArrayOES) {
		if(this.OESVertexArrayObject) {
			this.vertexArray = this.OESVertexArrayObject.createVertexArrayOES();
		}
	}
	else {
		this.vertexArray = this.gl.createVertexArray();
	}
	
	// query max vertex attribs
	this.maxVertexAttribs = this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS);
	
	// init vertex attribs array
	this.vertexAttribs = new Array(this.maxVertexAttribs);
	for(var i = 0; i < this.vertexAttribs.length; i++) {
		var attrib = new WebGLDynamicDraw.VertexAttrib(i);
		this.vertexAttribs[i] = attrib;
	}
	
	// DEBUG: log
	console.debug("created DynamicDrawContext:", this);
	console.debug("support OES_vertex_array_object=" + (this.OESVertexArrayObject !== null));
};
WebGLDynamicDraw.DynamicDrawContext.prototype = {
	gl: null,
	OESVertexArrayObject: null,
	
	recordArray: null,
	drawBuffer: null,
	
	vertexArray: null,
	_useVertexArrayOES: false,
	
	maxVertexAttribs: -1,
	vertexAttribs: [],
	
	currentPrimitiveMode: 0,
	incrementingAttribIndex: 0, // the vertex attrib that increments the recordarray
	
	/** Starts recording vertices for primitives of the given type */
	begin: function(primitivemode) {
		// set state
		this.currentPrimitiveMode = primitivemode;
		
		// calc cached temp values
		this.recordArray.setupTempValueCache();
		
		// reset recordArray
		this.recordArray.resetArray();
	},
	
	/** Ends recording vertices and ensures all previously recorded vertices are drawn */
	end: function() {
		var cgl = this.gl;
		
		// upload (and orphan)
		cgl.bindBuffer(cgl.ARRAY_BUFFER, this.drawBuffer.buffer);
		cgl.bufferData(cgl.ARRAY_BUFFER, this.recordArray.array, cgl.STREAM_DRAW);
		
		// setup vertexattribs
		if(this.vertexArray) {
			// bind vao
			this._bindVertexArray(this.vertexArray);
			
			for(var i = 0; i < this.vertexAttribs.length; i++) {
				var attrib = this.vertexAttribs[i];
				
				if(attrib.dirtyGL) {
					if(attrib.enabled) {
						cgl.enableVertexAttribArray(i);
						cgl.vertexAttribPointer(i, attrib.size, attrib.type, attrib.normalized, this.recordArray.tempVertexIndexStride*4, this.recordArray.tempAttribOffset[i]*4);
					}
					else {
						cgl.disableVertexAttribArray(i);
					}
					
					// reset dirty flag
					attrib.dirtyGL = false;
				}
			}
		}
		else {
			for(var i = 0; i < this.vertexAttribs.length; i++) {
				var attrib = this.vertexAttribs[i];
				
				if(attrib.enabled) {
					cgl.enableVertexAttribArray(i);
					cgl.vertexAttribPointer(i, attrib.size, attrib.type, attrib.normalized, this.recordArray.tempVertexIndexStride*4, this.recordArray.tempAttribOffset[i]*4);
				}
				else {
					cgl.disableVertexAttribArray(i);
				}
			}
		}
		
		// draw
		var primitivesToDraw = this.recordArray.position / this.recordArray.tempVertexIndexStride;
		
		cgl.drawArrays(this.currentPrimitiveMode, 0, primitivesToDraw);
		
		// unbind vertexarray
		if(this.vertexArray) {
			this._bindVertexArray(null);
		}
	},
	
	/** Adds a vertex with three components to the vertex attribute attrib */
	addVertex3: function(index, x, y, z) {
		// record vertex
		this.recordArray.putVec3(index, x, y, z);
		
		// increment index
		if(index == this.incrementingAttribIndex) {
			this.recordArray.incrementIndex();
		}
	},
	
	/** Changes the configuration of vertex attribute */
	vertexAttrib: function(index, size, type, normalized) {
		var attrib = this.vertexAttribs[index];
		
		attrib.update(size, type, normalized);
		attrib.dirtyGL = true;
	},
	
	enableVertexAttrib: function(index, enabled) {
		var attrib = this.vertexAttribs[index];
		
		attrib.enabled = enabled;
		attrib.dirtyGL = true;
	},
	
	incrementingVertexAttrib: function(index) {
		// TODO: do range check
		
		this.incrementingAttribIndex = index;
	},
	
	_destroy: function() {
		
	},
	
	_bindVertexArray: function(vao_) {
		if(this._useVertexArrayOES) {
			this.OESVertexArrayObject.bindVertexArrayOES(vao_);
		}
		else {
			this.gl.bindVertexArray(vao_);
		}
	},
};


/** RecordArray records added vertices until draw time. Grows as needed */
WebGLDynamicDraw.RecordArray = function(context, size) {
	this.context = context;
	this.size = size;
	
	// create array
	this.array = new Float32Array(Math.ceil(size / this.pageSize) * this.pageSize);
	
	// DEBUG: log
	console.debug("created recordarray with size=" + this.size);
};
WebGLDynamicDraw.RecordArray.prototype = {
	context: null,
	pageSize: 256,
	
	array: null, // the actual typed array
	size: 0,
	position: 0, // start position of current index in components
	
	tempVertexIndexStride: 0, // stride in components between vertex indicies
	tempAttribOffset: [],
	
	putVec3: function(attrib, x, y, z) {
		// write data
		var writePos = this.position + this.tempAttribOffset[attrib];
		this.array[writePos + 0] = x;
		this.array[writePos + 1] = y;
		this.array[writePos + 2] = z;
	},
	
	/** increments the vertex index (with a stride of all active vertex attribs) */
	incrementIndex: function() {
		this.position += this.tempVertexIndexStride;
		
		// ensure size
		this._ensureSize(this.position + 1);
	},
	
	resetArray: function() {
		this.position = 0;
		
		// *user is responsible for writing to each attrib*
		//// zero out old values
		//this.array.fill(0);
	},
	
	/** recalculates some cached temporary values */
	setupTempValueCache: function() {
		// calc attrib offsets and indexstride
		var newIndexStride = 0;
		for(var i = 0; i < this.context.vertexAttribs.length; i++) {
			var attrib = this.context.vertexAttribs[i];
			
			if(attrib.enabled) {
				this.tempAttribOffset[i] = newIndexStride;
				newIndexStride += attrib.size;
			}
			else {
				this.tempAttribOffset[i] = -1;
			}
		}
		
		this.tempVertexIndexStride = newIndexStride;
	},
	
	_ensureSize(requiredsize) {
		if(requiredsize > this.size) {
			// allocate new array
			var newSize = Math.ceil(requiredSize / this.pageSize) * this.pageSize;
			var newArray = new Float32Array(newSize);
			
			// DEBUG: log
			console.debug("resizing recordarray: " + this.size + " -> " + newSize + " (required: " + requiredsize + ", pageSize=" + this.pageSize + ")");
			
			// copy old array
			newArray.set(this.array);
			
			// set vars
			this.array = newArray;
			this.size = newSize;
		}
	}
};


WebGLDynamicDraw.DrawBuffer = function(context, size) {
	this.context = context;
	this.size = size; // size in components
	
	// create buffer
	this.buffer = this.context.gl.createBuffer();
};
WebGLDynamicDraw.DrawBuffer.prototype = {
	context: null,
	
	size: -1,
	
	buffer: null,
	
	/*
	orphan: function(newSize) {
		var cgl = this.context.gl;
		
		this.size = newSize;
		
		cgl.gl
	},
	*/
};


WebGLDynamicDraw.VertexAttrib = function(index) {
	this.index = index;
};
WebGLDynamicDraw.VertexAttrib.prototype = {
	index: 0,
	size: 0,
	type: 0,
	normalized: false,
	
	enabled: false,
	
	dirtyGL: false,
	
	update: function(size, type, normalized) {
		this.size = size;
		this.type = type;
		this.normalized = normalized;
	},
};

/*
WebGLDynamicDraw.AttribMemLayout = function() {
	
};
WebGLDynamicDraw.AttribMemLayout.prototype = {
	attribOffsets: [],
	vertexIndexStride: 0,
	
	recalc: function() {
		
	},
};
*/
