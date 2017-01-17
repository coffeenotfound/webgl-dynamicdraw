
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
	
	this.state.attribs = new Array(gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
	this.state.recordArrayAttribOffsets = new Array(gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
};
WebGLDynamicDraw.DynamicDrawContext.prototype = {
	
	// ### NOTES ###
	// - mapping doesn't exist in webgl
	// - buffersubdata causes an implicit flush
	//   - consider flip-flopping two buffers
	//	   - multiple start/ends a frame cycle through multiple buffers while still not drawn -> implicit flush again
	// - orphaning seems to be the best bet
	
	state: {
		// config state
		attribs: [],
		
		// state
		recordArray: new Float32Array(256),
		bufferSize: 256,
		bufferTypeBytes: 4,
		bufferPos: 0,
		buffer: null,
		
		// temporary state
		inStartEnd: false,
		currentPrimityMode: 0,
		
		recordArrayAttribOffsets: [],
		recordArrayVertexStride: 0,
		recordArrayStartPos: 0,
		recordArrayPos: 0,
		activeAttribNum: 0,
	},
	
	/** Starts recording vertices with the given  */
	begin: function(primitivemode) {
		// error: in start/end
		if(this.state.inStartEnd) throw "cannot invoke begin while in start/end";
		
		// set flag
		this.state.inStartEnd = true;
		this.state.currentPrimityMode = primitivemode;
		
		// calc recordArray attrib offsets
		this.state.recordArrayVertexStride = 0;
		for(var i = 0; i < this.state.attribs.length; i++) {
			var attrib = this.state.attribs[i];
			
			if(attrib && attrib.enabled) {
				this.state.recordArrayAttribOffsets[i] = this.state.recordArrayVertexStride;
				this.state.recordArrayVertexStride += attrib.size;
			}
			else {
				this.state.recordArrayAttribOffsets[i] = -1;
			}
		}
		
		this.state.recordArrayStartPos = this.state.recordArrayPos;
	},
	
	end: function() {
		var gl = this.gl;
		
		// error: not in start/end
		if(!this.state.inStartEnd) return;
		
		// flush draw
		var drawFirst = this.state.recordArrayStartPos;
		var drawCount = this.state.recordArrayPos - this.state.recordArrayStartPos;
		this._flushDraw(drawFirst, drawCount);
		
		// set flag
		this.state.inStartEnd = false;
	},
	
	/** Adds a vertex with three components to the vertex attribute attrib */
	addVertex3: function(index, x, y, z) {
		// ensure attrib enabled
		var attrib = this.state.attribs[index];
		if(!attrib || !attrib.enabled) throw "invalid attrib index: attrib " + index + " invalid or disabled";
		
		// check if recordarray has enough space for entire vertex index (all active attribs)
		var newRecordArrayPos = this.state.recordArrayPos + this.state.recordArrayVertexStride;
		
		if(newRecordArrayPos <= this.state.recordArray.length) {
			// write to array
			var writePos = this.state.recordArrayPos;
			var recordArray = this.state.recordArray;
			recordArray[writePos] = x;
			recordArray[writePos + 1] = y;
			recordArray[writePos + 2] = z;
			
			// only increment on attrib 0
			if(index == 0) {
				this.state.recordArrayPos = newRecordArrayPos;
			}
		}
		else { // recordArray full
			// draw
			var drawFirst = this.state.recordArrayStartPos;
			var drawCount = this.state.recordArrayPos - this.state.recordArrayStartPos;
			this._flushDraw(drawFirst, drawCount);
			
			// reset recordArray
			this.state.recordArrayStartPos = 0;
			this.state.recordArrayPos = 0;
			
			// add to new buffer
			this.addVertex3(index, x, y, z);
		}
	},
	
	// TODO: implement functions
	/** Adds one or more vertices with three components from the given (typed) array to the vertex attribute attrib */
	addVertices3: function(attrib, vertices, count, offset, stride) {
		
	},
	addVerticesOffset3: function(attrib, vertices, count, offset, stride) {
		
	},
	
	/** Changes the configuration of vertex attribute */
	vertexAttrib: function(index, size, type, normalized) {
		// error: in start/end
		if(this.state.inStartEnd) throw "cannot change attrib while in start/end";
		
		// get attrib
		var attrib = this._ensureGetAttrib(index);
		
		// update
		attrib._update(size, type, normalized);
	},
	
	enableVertexAttrib: function(index, enabled) {
		var attrib = _ensureGetAttrib(index);
		
		attrib.enabled = enabled;
	},
	
	
	/** Initializes or re-initialized this context with the current state. */
	init: function() {
		
	},
	
	_flushDraw: function(first, count) {
		var componentsToDraw = count;
		
		// bind buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.state.buffer);
		
		while(componentsToDraw > 0) {
			var numIndicesCanDrawNow = Math.floor((this.state.bufferSize - this.state.bufferPos) / this.state.recordArrayVertexStride);
			
			// upload
			var dataToUpload = this.state.recordArray.subarray(this.state.recordArrayStartPos, this.state.recordArrayPos);
			gl.bufferSubData(gl.ARRAY_BUFFER, this.state.bufferPos*this.state.bufferTypeBytes, dataToUpload);
			
			// setup vertexattribpointers
			for(var j = 0; j < this.state.recordArrayAttribOffsets.length; j++) {
				var offset = this.state.recordArrayAttribOffsets[j];
				
				if(offset >= 0) {
					var attrib = this.state.attribs[j];
					
					gl.vertexAttribPointer(j, attrib.size, attrib.type, attrib.normalized, this.state.recordArrayVertexStride, this.state.bufferPos);
				}
			}
			
			// actually do the draw
			gl.drawArrays(this.state.currentPrimitiveMode, 0, numIndicesCanDrawNow);
			
			// increment/decrement
			this.state.bufferPos += dataToUpload.length;
			componentsToDraw -= numIndicesCanDrawNow * this.state.recordArrayVertexStride;
			
			// orphan
			if(componentsToDraw > 0) {
				gl.bufferData(gl.ARRAY_BUFFER, null, gl.DYNAMIC_DRAW);
				gl.bufferData(gl.ARRAY_BUFFER, this.state.bufferSize, gl.DYNAMIC_DRAW);
				
				this.state.bufferPos = 0;
			}
		}
	},
	
	_ensureGetAttrib: function(index) {
		// check index range
		// if(that) throw "invalid vertex attrib index: " + index;
		
		// ensure
		var attrib = this.state.attribs[index];
		if(!attrib) {
			attrib = this.state.attribs[index] = new WebGLDynamicDraw.VertexAttrib(index);
		}
		return attrib;
	},
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
	
	_update: function(size, type, normalized) {
		this.size = size;
		this.type = type;
		this.normalized = normalized;
	},
};

/*
WebGLDynamicDraw.QueuedDraw = function() {
	
};
*/