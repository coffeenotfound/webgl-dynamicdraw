
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
};
WebGLDynamicDraw.DynamicDrawContext.prototype = {
	
	/** Starts recording vertices with the given  */
	begin: function(primitivemode) {
		
	},
	
	end: function() {
		
	},
	
	/** Adds a vertex with three components to the vertex attribute attrib */
	addVertex3: function(index, x, y, z) {
		
	},
	
	/** Changes the configuration of vertex attribute */
	vertexAttrib: function(index, size, type, normalized) {
		
	},
	
	enableVertexAttrib: function(index, enabled) {
		
	},
	
	/** Initializes or re-initialized this context with the current state. */
	init: function() {
		
	},
};


WebGLDynamicDraw.RecordArray = function(size) {
	
};
WebGLDynamicDraw.RecordArray.prototype = {
	
};


WebGLDynamicDraw.DrawBuffer = function(size) {
	this.size = size; // size in components
};
WebGLDynamicDraw.DrawBuffer.prototype = {
	
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

