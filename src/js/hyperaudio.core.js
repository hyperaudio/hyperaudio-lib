/* Hyperaudio core
 *
 */

var hyperaudio = (function() {

	// jQuery 2.0.3 (c) 2013 http://jquery.com/

	var
		// [[Class]] -> type pairs
		class2type = {},
		core_toString = class2type.toString,
		core_hasOwn = class2type.hasOwnProperty;

	function hyperaudio() {
		// Nada
	}

	hyperaudio.extend = function() {
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0] || {},
			i = 1,
			length = arguments.length,
			deep = false;

		// Handle a deep copy situation
		if ( typeof target === "boolean" ) {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}

		// Handle case when target is a string or something (possible in deep copy)
		if ( typeof target !== "object" && !hyperaudio.isFunction(target) ) {
			target = {};
		}

		// extend hyperaudio itself if only one argument is passed
		if ( length === i ) {
			target = this;
			--i;
		}

		for ( ; i < length; i++ ) {
			// Only deal with non-null/undefined values
			if ( (options = arguments[ i ]) != null ) {
				// Extend the base object
				for ( name in options ) {
					src = target[ name ];
					copy = options[ name ];

					// Prevent never-ending loop
					if ( target === copy ) {
						continue;
					}

					// Recurse if we're merging plain objects or arrays
					if ( deep && copy && ( hyperaudio.isPlainObject(copy) || (copyIsArray = hyperaudio.isArray(copy)) ) ) {
						if ( copyIsArray ) {
							copyIsArray = false;
							clone = src && hyperaudio.isArray(src) ? src : [];

						} else {
							clone = src && hyperaudio.isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[ name ] = hyperaudio.extend( deep, clone, copy );

					// Don't bring in undefined values
					} else if ( copy !== undefined ) {
						target[ name ] = copy;
					}
				}
			}
		}

		// Return the modified object
		return target;
	};

	hyperaudio.extend({

		// See test/unit/core.js for details concerning isFunction.
		// Since version 1.3, DOM methods and functions like alert
		// aren't supported. They return false on IE (#2968).
		isFunction: function( obj ) {
			return hyperaudio.type(obj) === "function";
		},

		isArray: Array.isArray,

		isWindow: function( obj ) {
			return obj != null && obj === obj.window;
		},

		type: function( obj ) {
			if ( obj == null ) {
				return String( obj );
			}
			// Support: Safari <= 5.1 (functionish RegExp)
			return typeof obj === "object" || typeof obj === "function" ?
				class2type[ core_toString.call(obj) ] || "object" :
				typeof obj;
		},

		isPlainObject: function( obj ) {
			// Not plain objects:
			// - Any object or value whose internal [[Class]] property is not "[object Object]"
			// - DOM nodes
			// - window
			if ( hyperaudio.type( obj ) !== "object" || obj.nodeType || hyperaudio.isWindow( obj ) ) {
				return false;
			}

			// Support: Firefox <20
			// The try/catch suppresses exceptions thrown when attempting to access
			// the "constructor" property of certain host objects, ie. |window.location|
			// https://bugzilla.mozilla.org/show_bug.cgi?id=814622
			try {
				if ( obj.constructor &&
						!core_hasOwn.call( obj.constructor.prototype, "isPrototypeOf" ) ) {
					return false;
				}
			} catch ( e ) {
				return false;
			}

			// If the function hasn't returned already, we're confident that
			// |obj| is a plain object, created by {} or constructed with new Object
			return true;
		}
	});

	function isArraylike( obj ) {
		var length = obj.length,
			type = hyperaudio.type( obj );

		if ( hyperaudio.isWindow( obj ) ) {
			return false;
		}

		if ( obj.nodeType === 1 && length ) {
			return true;
		}

		return type === "array" || type !== "function" &&
			( length === 0 ||
			typeof length === "number" && length > 0 && ( length - 1 ) in obj );
	}
	// [End jQuery code]

	// [Adapted from] jQuery 2.0.3 (c) 2013 http://jquery.com/
	// - each() : removed args parameter (was for use internal to jQuery)

	hyperaudio.extend({
		each: function( obj, callback ) {
			var value,
				i = 0,
				length = obj.length,
				isArray = isArraylike( obj );

			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			}

			return obj;
		}
	});
	// [End jQuery code]

	hyperaudio.extend({
		event: {
			ready: 'ha:ready',
			load: 'ha:load',
			save: 'ha:save',
			error: 'ha:error'
		},
		_commonMethods: {
			options: {
				DEBUG: true,
				entity: 'core'
			},
			_trigger: function(eventType, eventData) {
				var eventObject = hyperaudio.extend(true, {options: this.options}, eventData),
					event = new CustomEvent(eventType, {
						detail: eventObject,
						bubbles: true,
						cancelable: true
					});
				this.target.dispatchEvent(event);
			},
			_error: function(msg) {
				var data = {msg: this.options.entity + ' Error : ' + msg};
				this._trigger(hyperaudio.event.error, data);
			},
			_debug: function() {
				var self = this;
				hyperaudio.each(hyperaudio.event, function(eventName, eventType) {
					self.target.addEventListener(eventType, function(event) {
						console.log(self.options.entity + ' ' + eventType + ' event : %o', event);
					}, false);
				});
			}
		},
		register: function(name, module) {
			if(typeof name === 'string') {
				if(typeof module === 'function') {
					module.prototype = hyperaudio.extend({}, this._commonMethods, module.prototype);
					this[name] = function(options) {
						return new module(options);
					};
				} else if(typeof module === 'object') {
					module = hyperaudio.extend({}, this._commonMethods, module);
					this[name] = module;
				}
			}
		},
		utility: function(name, utility) {
			if(typeof name === 'string') {
				this[name] = utility;
			}
		},

		// TMP - This fn is WIP and left in as started making code for JSONP and then put it on hold.
		jsonp: function(url, scope, callback) {
			//
			var head = document.getElementsByTagName('head')[0];
			var script = document.createElement('script');
			script.type = 'text/javascript';

			var jsonp_i = 0; // TMP - would be in scope of core code as a static.

			// Need to make the callback run in the correct scope.
			callback[jsonp_i++] = function(json) {
				callback.call(scope, data);
			};

			script.src = url;

		},

		hasClass: function(e, c) {
			if ( !e ) return false;

			var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
			return re.test(e.className);
		},
		addClass: function(e, c) {
			if ( this.hasClass(e, c) ) {
				return;
			}

			var newclass = e.className.split(' ');
			newclass.push(c);
			e.className = newclass.join(' ');
		},
		removeClass: function (e, c) {
			if ( !this.hasClass(e, c) ) {
				return;
			}

			var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
			e.className = e.className.replace(re, ' ');
		}

	});

	return hyperaudio;
}());
