var WebGLIntermediate = function(gl) {
	this.gl = gl;
	
	// query extension support
	
};
WebGLIntermediate.prototype = {
	/** Starts recording vertices with the given  */
	begin: function(primitivetype, context) {
		context = context || this._defaultContext();
		context.begin(primitivetype);
	},
	
	end: function(context) {
		context = context || this._defaultContext();
		context.end();
	},
	
	/** Adds a vertex with three components to the vertex attribute attrib */
	addVertex3: function(attrib, x, y, z) {
		context = context || this._defaultContext();
		context.addVertex3(attrib, x, y, z);
	},
	/** Adds one or more vertices with three components from the given (typed) array to the vertex attribute attrib */
	addVertices3: function(attrib, vertices, count, offset, stride) {
		
	},
	addVerticesOffset3: function(attrib, vertices, count, offset, stride) {
		
	},
	
	/** Changes the configuration of vertex attribute */
	vertexAttrib: function(attrib, size, type) {
		context = context || this._defaultContext();
		context.vertexAttrib(stream, attrib, size, type);
	},
	
	createContext: function() {
		var context = new WebGLIntermediate.IntermediateContext(this);
		return context;
	},
	destroyContext: function(context) {
		if(context) {
			context._destroy();
		}
	},
	
	_defaultContext: function() {
		var ctx = this._defaultctx;
		if(!ctx) ctx = this._defaultctx = this.createContext();
		return ctx;
	},
};

// context contains cached state
var WebGLIntermediate.IntermediateContext = function(gli) {
	this.gli = gli;
	this.gl = gli.gl;
	
	// create state object
};
WebGLIntermediate.IntermediateContext.prototype = {
	
	// ### NOTES ###
	// - mapping doesn't exist in webgl
	// - buffersubdata causes an implicit flush
	//   - consider flip-flopping two buffers
	//	   - multiple start/ends a frame cycle through multiple buffers while still not drawn -> implicit flush again
	// - orphaning seems to be the best bet
	
	state: {
		// config state
		attribs: [
			// attrib {
			//   index,
			//   size,
			//   type,
			//   normalized,
			//   
			//   recordArray,
			//   buffer,
			// }
		],
		
		// temporary state
		inStartEnd: false,
		currentPrimityMode: 0,
		
		lastAccessedAttrib: null,
		
		//attribIdsToDraw = [],
	}, 
	
	/** Starts recording vertices with the given  */
	begin: function(primitivemode) {
		// error: in start/end
		if(this.state.inStartEnd) throw "cannot invoke begin while in start/end";
		
		// set flag
		this.state.inStartEnd = true;
		this.state.currentPrimityMode = primitivemode;
	},
	
	end: function() {
		var gl = this.gl;
		
		// error: in start/end
		if(this.state.inStartEnd) return;
		
		var attribsToDraw = [];
		for(var i = 0; i < this.state.attribs.length; i++) {
			var attr = this.state.attribs[i];
			
			if(attr && attr.recordPos > 0) {
				attribsToDraw.push(attr);
			}
		}
		
		var vertexCount = 0;
		
		// upload recorded data and setup gl vertexattribs
		for(var i = 0; i < attribsToDraw.length; i++) {
			var attr = attribsToDraw[i];
			
			// find largest buffer
			var vertNum = Math.floor(attr.recordPos / 3); // TODO: use divisor depending on primitve mode
			if(vertNum > vertexCount) vertexCount = vertNum;
			
			// upload
			gl.bindBuffer(gl.ARRAY_BUFFER);
			gl.bufferData(attr.buffer, attr.recordBuffer.subarray(0, attr.recordPos), gl.STREAM_DRAW);
			
			// setup gl vertex attrib
			gl.vertexAttribPointer(attr.index, attr.size, attr.normalized, 0, 0);
		}
		
		// draw
		gl.drawArrays(this.state.currentPrimitveMode, 0, vertexCount);
		
		// reset attribs
		for(var i = 0; i < attribsToDraw.length; i++) {
			attribsToDraw[i].recordPos = 0;
		}
		
		// set flag
		this.state.inStartEnd = false;
	},
	
	/** Adds a vertex with three components to the vertex attribute attrib */
	addVertex3: function(attrib, x, y, z) {
		// find attrib
		var attrib = this.state.lastAccessedAttrib.index == index ? this.state.lastAccessedAttrib.index : this.state.attribs[attrib];
		
		var recordArray = attrib.recordArray;
		var recordPos = attrib.recordPos;
		
		recordArray[recordPos] = x;
		recordArray[recordPos + 1] = y;
		recordArray[recordPos + 2] = z;
		
		// increment recordpos
		attrib.recordPos += 3;
		
		this.state.lastAccessedAttrib = attrib;
	},
	
	/** Changes the configuration of vertex attribute */
	vertexAttrib: function(attrib, size, type, normalized) {
		// error: in start/end
		if(this.state.inStartEnd) throw "cannot change attrib while in start/end";
		
		var oldAttrib = this.state.attribs[attrib];
		var oldBuffer = 
		
		// set state
		var attrib = {
			index: attrib,
			size: size,
			type: type,
			normalized: normalized,
			
			buffer = oldBuffer || this.gl.createBuffer(),
			//buffer = new WebGLIntermediate.IntermediateBuffer(),
			recordArray = new Float32Array(256),
			recordPos = 0,
		};
		this.state.attribs[attrib] = attrib;
	},
	
	/** Initializes or re-initialized this context with the current state. */
	init: function() {
		
	},
};