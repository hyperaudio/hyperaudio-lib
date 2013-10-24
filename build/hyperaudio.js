/*! hyperaudio v0.1.1 ~ (c) 2012-2013 Hyperaudio Inc. <hello@hyperaud.io> (http://hyperaud.io) ~ Built: 25th October 2013 00:34:04 */
var HA = (function(window, document) {


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

			e.className += ' ' + c;
		},
		removeClass: function (e, c) {
			if ( !this.hasClass(e, c) ) {
				return;
			}

			var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
			e.className = e.className.replace(re, ' ').replace(/\s{2,}/g, ' ');
		},
		toggleClass: function (e, c) {
			if ( this.hasClass(e, c) ) {
				this.removeClass(e, c);
			} else {
				this.addClass(e, c);
			}
		}

	});

	return hyperaudio;
}());

var DragDrop = (function (window, document, hyperaudio) {

	function DragDrop (options) {

		this.options = {
			handle: null,
			dropArea: null,

			init: true,
			touch: true,
			mouse: true,
			timeout: 500,
			html: '',
			draggableClass: '',
			containerTag: 'article',
			blockTag: 'section'
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.dropArea = typeof this.options.dropArea == 'string' ? document.querySelector(this.options.dropArea) : this.options.dropArea;

		// Create the list and the placeholder
		this.list = this.dropArea.querySelector(this.options.containerTag);
		if ( !this.list ) {
			this.list = document.createElement(this.options.containerTag);
			this.dropArea.appendChild(this.list);
		}
		this.placeholder = document.createElement(this.options.blockTag);
		this.placeholder.className = 'placeholder';

		if ( this.options.init ) {
			this.handle = typeof this.options.handle == 'string' ? document.querySelector(this.options.handle) : this.options.handle;
			this.handleClassName = this.handle.className;

			// Are we reordering the list?
			this.reordering = this.handle.parentNode == this.list;

			if ( this.options.touch ) {
				this.handle.addEventListener('touchstart', this, false);
			}

			if ( this.options.mouse ) {
				this.handle.addEventListener('mousedown', this, false);
			}
		}
	}

	DragDrop.prototype.handleEvent = function (e) {
		// jshint -W086
		switch (e.type) {
			case 'mousedown':
				if ( e.which !== 1 ) {
					break;
				}
			case 'touchstart':
				this.start(e);
				break;
			case 'touchmove':
			case 'mousemove':
				this.move(e);
				break;
			case 'touchend':
			case 'mouseup':
				this.end(e);
				break;
		}
		// jshint +W086
	};

	DragDrop.prototype.start = function (e) {
		var point = e.touches ? e.touches[0] : e,
			target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		if ( /INPUT/.test(target.tagName) ) {
			return;
		}

		e.preventDefault();

		if ( this.options.touch ) {
			document.addEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			document.addEventListener('mouseup', this, false);
		}

		clearTimeout(this.dragTimeout);
		this.initiated = false;
		this.lastTarget = null;

		this.dragTimeout = setTimeout(this.init.bind(this, this.options.html || this.handle.innerHTML, e), this.options.timeout);
	};

	DragDrop.prototype.init = function (html, e) {
		if ( !this.options.init ) {
			if ( this.options.touch ) {
				document.addEventListener('touchend', this, false);
			}

			if ( this.options.mouse ) {
				document.addEventListener('mouseup', this, false);
			}
		}

		// Create draggable
		this.draggable = document.createElement('div');
		this.draggable.className = 'draggable' + ' ' + this.options.draggableClass;
		this.draggableStyle = this.draggable.style;
		this.draggableStyle.cssText = 'position:absolute;z-index:1000;pointer-events:none;left:-99999px';
		this.draggable.innerHTML = html;

		document.body.appendChild(this.draggable);

		this.draggableCenterX = Math.round(this.draggable.offsetWidth / 2);
		this.draggableCenterY = Math.round(this.draggable.offsetHeight / 2);

		this.position(e);

		if ( this.options.touch ) {
			document.addEventListener('touchmove', this, false);
		}

		if ( this.options.mouse ) {
			document.addEventListener('mousemove', this, false);
		}

		this.initiated = true;

		// If we are reordering the list, hide the current element
		if ( this.reordering ) {
			this.handle.style.display = 'none';
		}

		this.move(e);

		if ( this.options.onDragStart ) {
			this.options.onDragStart.call(this);
		}
	};

	DragDrop.prototype.position = function (e) {
		var point = e.changedTouches ? e.changedTouches[0] : e;

		this.draggableStyle.left = point.pageX - this.draggableCenterX + 'px';
		this.draggableStyle.top = point.pageY - this.draggableCenterY + 'px';
	};

	DragDrop.prototype.move = function (e) {
		e.preventDefault();
		e.stopPropagation();

		var point = e.changedTouches ? e.changedTouches[0] : e;
		var target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		this.position(e);

		if ( target == this.lastTarget || target == this.placeholder || target == this.list ) {
			return;
		}

		this.lastTarget = target;

		if ( target == this.dropArea ) {
			this.list.appendChild(this.placeholder);
			return;
		}

		if ( hyperaudio.hasClass(target, 'item') ) {
			var items = this.list.querySelectorAll('.item'),
				i = 0, l = items.length;

			for ( ; i < l; i++ ) {
				if ( target == items[i] ) {
					this.list.insertBefore(this.placeholder, items[i]);
					break;
				}
			}

			return;
		}

		if ( this.list.querySelector('.placeholder') ) {
			this.placeholder.parentNode.removeChild(this.placeholder);
		}
	};

	DragDrop.prototype.end = function (e) {
		clearTimeout(this.dragTimeout);

		document.removeEventListener('touchend', this, false);
		document.removeEventListener('mouseup', this, false);

		if ( !this.initiated ) {
			return;
		}

		document.removeEventListener('touchmove', this, false);
		document.removeEventListener('mousemove', this, false);

		var point = e.changedTouches ? e.changedTouches[0] : e;
		var target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		var html = this.options.html ? this.handle.innerHTML : this.draggable.innerHTML;
		this.draggable.parentNode.removeChild(this.draggable);
		this.draggable = null;

		// we dropped outside of the draggable area
		if ( !this.list.querySelector('.placeholder') ) {

			if ( this.reordering ) {
				this.handle.parentNode.removeChild(this.handle);
			}

			if ( this.options.onDrop ) {
				this.options.onDrop.call(this, null);
			}

			return;
		}

		var el;

		// if we are reordering, reuse the original element
		if ( this.reordering ) {
			el = this.handle;
			this.handle.style.display = '';
		} else {
			el = document.createElement(this.options.blockTag);
			el.className = this.handleClassName || 'item';
			el.innerHTML = html;
		}

		this.list.insertBefore(el, this.placeholder);
		this.placeholder.parentNode.removeChild(this.placeholder);

		if ( this.options.onDrop ) {
			this.options.onDrop.call(this, el);
		}
	};

	DragDrop.prototype.destroy = function () {
		document.removeEventListener('touchstart', this, false);
		document.removeEventListener('touchmove', this, false);
		document.removeEventListener('touchend', this, false);

		document.removeEventListener('mousedown', this, false);
		document.removeEventListener('mousemove', this, false);
		document.removeEventListener('mouseup', this, false);
	};

	return DragDrop;
})(window, document, hyperaudio);

var EditBlock = (function (document) {

	function EditBlock (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;
		this.words = this.el.querySelectorAll('a');

		this.el.className += ' edit';
		this.el._tap = new Tap({el: this.el});
		this.el.addEventListener('tap', this, false);

		document.addEventListener('touchend', this, false);
		document.addEventListener('mouseup', this, false);
	}

	EditBlock.prototype.handleEvent = function (e) {
		switch (e.type) {
			case 'touchend':
			case 'mouseup':
				this.cancel(e);
				break;
			case 'tap':
				this.edit(e);
				break;
		}
	};

	EditBlock.prototype.cancel = function (e) {
		var target = e.target;

		if ( target == this.el || target.parentNode == this.el || target.parentNode.parentNode == this.el ) {
			return;
		}

		this.destroy();
	};

	EditBlock.prototype.edit = function (e) {
		e.stopPropagation();

		var theCut = e.target;
		var cutPointReached;
		var wordCount = this.words.length;

		if ( theCut.tagName != 'A' || theCut == this.words[wordCount-1] ) {
			return;
		}

		// Create a new block
		var newBlock = document.createElement('section');
		var newParagraph, prevContainer;

		newBlock.className = 'item';

		for ( var i = 0; i < wordCount; i++ ) {
			if ( this.words[i].parentNode != prevContainer ) {
				if ( newParagraph && cutPointReached && newParagraph.querySelector('a') ) {
					newBlock.appendChild(newParagraph);
				}

				newParagraph = document.createElement('p');
				prevContainer = this.words[i].parentNode;
			}

			if ( cutPointReached ) {
				newParagraph.appendChild(this.words[i]);

				if ( !prevContainer.querySelector('a') ) {
					prevContainer.parentNode.removeChild(prevContainer);
				}
			}

			if ( !cutPointReached && this.words[i] == theCut ) {
				cutPointReached = true;
			}
		}

		newBlock.appendChild(newParagraph);

		var action = document.createElement('div');
		action.className = 'actions';
		newBlock.appendChild(action);

		this.el.parentNode.insertBefore(newBlock, this.el.nextSibling);
		this.el.handleHTML = this.el.innerHTML;

		APP.dropped(newBlock);

		this.destroy();
	};

	EditBlock.prototype.destroy = function () {
		// Remove edit status
		this.el.className = this.el.className.replace(/(^|\s)edit(\s|$)/g, ' ');

		document.removeEventListener('touchend', this, false);
		document.removeEventListener('mouseup', this, false);

		this.el.removeEventListener('tap', this, false);
		this.el._editBlock = null;

		this.el._tap.destroy();
		this.el._tap = null;
	};

	return EditBlock;
})(document);

var fadeFX = (function (window, document) {
	var _elementStyle = document.createElement('div').style;

	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransition';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	var transition = _prefixStyle('transition');
	var transform = _prefixStyle('transform');

	_elementStyle = null; // free mem ???

	var fxInstance;

	function fade (options) {
		if ( !fxInstance ) {
			var opt = {
				time: 2000,
				color: '#000000',
				autostart: true,
				crossFade: true,
				autoplay: true
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			video = document.querySelector('#stage-videos .active');
			fxInstance = new TransitionFade(video, opt);
		}

		return fxInstance;
	}

	function TransitionFade (video, options) {
		this.options = options;

		this.video = video;
		this.videoIncoming = document.getElementById('stage-video-' + (video.id == 'stage-video-1' ? '2' : '1'));

		this.servo = document.getElementById('fxHelper');

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.left = '0px';
		this.servo.style.opacity = '0';
		this.servo.style.backgroundColor = this.options.color;
//		this.servo.style.left = '-9999px';

		if ( this.options.autostart ) {
			this.start();
		}
	}

	TransitionFade.prototype.handleEvent = function (e) {
		switch ( e.type ) {
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this.transitionEnd(e);
				break;
//			case 'canplay':
		}
	};

	TransitionFade.prototype.start = function () {
		this.phase = 'fadeOut';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		var trick = this.servo.offsetHeight;	// force refresh. Mandatory on FF

		this.servo.style[transition] = 'opacity ' + this.options.time + 'ms';

		var that = this;
		setTimeout(function () {
			that.servo.style.opacity = '1';
		}, 0);
	};

	TransitionFade.prototype.transitionEnd = function (e) {
		e.stopPropagation();

		this.servo.removeEventListener('transitionend', this, false);
		this.servo.removeEventListener('webkitTransitionEnd', this, false);
		this.servo.removeEventListener('oTransitionEnd', this, false);
		this.servo.removeEventListener('MSTransitionEnd', this, false);

		this.video.pause();

		if ( this.phase == 'fadeOut' ) {
			if ( this.options.onFadeOutEnd ) {
				this.options.onFadeOutEnd.call(this);
			}

			if ( this.options.crossFade ) {
				this.phase = 'waiting';
				this.video.className = this.video.className.replace(/(^|\s)active($|\s)/, '');
				this.videoIncoming.className += ' active';
				this.fadeIn();
			}
		} else if ( this.phase == 'fadeIn' ) {
			if ( this.options.onFadeInEnd ) {
				this.options.onFadeInEnd.call(this);
			}

			this.destroy();
		}
	};

	TransitionFade.prototype.fadeIn = function () {
		this.phase = 'fadeIn';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		if ( this.options.autoplay ) {
			this.videoIncoming.play();
		}

		this.servo.style.opacity = '0';
	};

	TransitionFade.prototype.destroy = function () {
		this.servo.removeEventListener('transitionend', this, false);
		this.servo.removeEventListener('webkitTransitionEnd', this, false);
		this.servo.removeEventListener('oTransitionEnd', this, false);
		this.servo.removeEventListener('MSTransitionEnd', this, false);

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.opacity = '0';
		this.servo.style.left = '-9999px';

		fxInstance = null;
	};

	return fade;
})(window, document);

var SideMenu = (function (document, hyperaudio) {

	function SideMenu (options) {
		this.options = {
			el: '#sidemenu',
			transcripts: '#panel-media',
			music: '#panel-bgm',
			stage: null // Points at a Stage instance
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		// Might rename the transcripts and music vars/options since rather ambiguous.

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;
		this.transcripts = typeof this.options.transcripts == 'string' ? document.querySelector(this.options.transcripts) : this.options.transcripts;
		this.music = typeof this.options.music == 'string' ? document.querySelector(this.options.music) : this.options.music;
		this.mediaCallback = this.options.callback;

		var handle = document.querySelector('#sidemenu-handle');
		handle._tap = new Tap({el: handle});
		handle.addEventListener('tap', this.toggleMenu.bind(this), false);

		this.updateStatus();

		// handle the tab bar
		var tabs = document.querySelectorAll('#sidemenu .tabbar li');
		for ( i = tabs.length-1; i >= 0; i-- ) {
			tabs[i]._tap = new Tap({el: tabs[i]});
			tabs[i].addEventListener('tap', this.selectPanel.bind(this), false);
		}

		this.initTranscripts();
		this.initMusic();
	}

	SideMenu.prototype.initTranscripts = function () {
		var self = this;

		hyperaudio.api.getTranscripts(function(success) {
			if(success) {
				var elem, trans;
				for(var i = 0, l = this.transcripts.length; i < l; i++) {
					trans = this.transcripts[i];
					elem = document.createElement('li');
					elem.setAttribute('data-id', trans._id);
					elem.innerHTML = trans.label;
					self.transcripts.appendChild(elem);
				}

				self.transcripts._tap = new Tap({el: self.transcripts});
				self.transcripts.addEventListener('tap', self.selectMedia.bind(self), false);
			}
		});
	};

	SideMenu.prototype.initMusic = function () {
		var stage = this.options.stage;

		function onDragStart (e) {
			hyperaudio.addClass(stage.target, 'dragdrop');
		}

		function onDrop (el) {
			if ( !el ) {	// we dropped outside the stage
				return;
			}

			var title = el.innerHTML;
			hyperaudio.addClass(el, 'effect');
			el.innerHTML = '<form><div>' + title + '</div><label>Delay: <span class="value">1</span>s</label><input type="range" value="1" min="0.5" max="5" step="0.1" onchange="this.parentNode.querySelector(\'span\').innerHTML = this.value"></form>';
			stage.dropped(el, title);
		}

		if(stage.target) {
			// add drag and drop to BGM
			var items = document.querySelectorAll('#panel-bgm li');
			for (var i = items.length-1; i >= 0; i-- ) {
				items[i]._dragInstance = new DragDrop({
					handle: items[i],
					dropArea: stage.target,
					draggableClass: 'draggableEffect',
					onDragStart: onDragStart,
					onDrop: onDrop
				});
			}
		}
	};

	SideMenu.prototype.updateStatus = function () {
		this.opened = hyperaudio.hasClass(this.el, 'opened');
	};

	SideMenu.prototype.toggleMenu = function () {
		if ( this.opened ) {
			this.close();
		} else {
			this.open();
		}
	};

	SideMenu.prototype.open = function () {
		if ( this.opened ) {
			return;
		}

		hyperaudio.addClass(this.el, 'opened');
		this.opened = true;
	};

	SideMenu.prototype.close = function () {
		if ( !this.opened ) {
			return;
		}

		hyperaudio.removeClass(this.el, 'opened');
		this.opened = false;
	};

	SideMenu.prototype.selectPanel = function (e) {
		var current = document.querySelector('#sidemenu .tabbar li.selected');
		var incoming = e.currentTarget;
		hyperaudio.removeClass(current, 'selected');
		hyperaudio.addClass(incoming, 'selected');

		var panelID = 'panel' + incoming.id.replace('sidemenu', '');
		current = document.querySelector('#sidemenu .panel.selected');
		hyperaudio.removeClass(current, 'selected');
		incoming = document.querySelector('#' + panelID);
		hyperaudio.addClass(incoming, 'selected');
	};

	SideMenu.prototype.selectMedia = function (e) {
		e.stopPropagation();	// just in case

		var starter = e.target;

		if ( hyperaudio.hasClass(e.target.parentNode, 'folder') ) {
			starter = e.target.parentNode;
		}

		if ( hyperaudio.hasClass(starter, 'folder') ) {
			hyperaudio.toggleClass(starter, 'open');
			return;
		}

		if ( !starter.getAttribute('data-id') || !this.mediaCallback ) {
			return;
		}

		this.mediaCallback(starter);
	};

	return SideMenu;
})(document, hyperaudio);

var Tap = (function (window, document, hyperaudio) {

	function Tap (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		this.el.addEventListener('touchstart', this, false);
		this.el.addEventListener('mousedown', this, false);
	}

	Tap.prototype = {
		handleEvent: function (e) {
			// jshint -W086
			switch (e.type) {
				case 'mousedown':
					if ( e.which !== 1 ) {
						break;
					}
				case 'touchstart':
					this._start(e);
					break;
				case 'touchmove':
				case 'mousemove':
					this._move(e);
					break;
				case 'touchend':
				case 'mouseup':
				case 'touchcancel':
				case 'mousecancel':
					this._end(e);
					break;
			}
			// jshint +W086
		},

		_start: function (e) {
			if ( e.touches && e.touches.length > 1 ) return;

			var point = e.touches ? e.touches[0] : e;
			
			this.moved = false;
			this.startX = point.pageX;
			this.startY = point.pageY;
			this.target = e.target;

			hyperaudio.addClass(this.target, 'tapPressed');

			this.el.addEventListener('touchmove', this, false);
			this.el.addEventListener('touchend', this, false);
			this.el.addEventListener('touchcancel', this, false);
			this.el.addEventListener('mousemove', this, false);
			this.el.addEventListener('mouseup', this, false);
			this.el.addEventListener('mousecancel', this, false);
		},

		_move: function (e) {
			var point = e.changedTouches ? e.changedTouches[0] : e,
				x = point.pageX,
				y = point.pageY;

			if ( Math.abs( x - this.startX ) > 10 || Math.abs( y - this.startY ) > 10 ) {
				hyperaudio.removeClass(this.target, 'tapPressed');
				this.moved = true;
			}
		},

		_end: function (e) {
			hyperaudio.removeClass(this.target, 'tapPressed');

			if ( !this.moved ) {
				var ev = document.createEvent('Event'),
					point = e.changedTouches ? e.changedTouches[0] : e;

				ev.initEvent('tap', true, true);
				ev.pageX = point.pageX;
				ev.pageY = point.pageY;
				this.target.dispatchEvent(ev);
			}

			this.el.removeEventListener('touchmove', this, false);
			this.el.removeEventListener('touchend', this, false);
			this.el.removeEventListener('touchcancel', this, false);
			this.el.removeEventListener('mousemove', this, false);
			this.el.removeEventListener('mouseup', this, false);
			this.el.removeEventListener('mousecancel', this, false);
		},
		
		destroy: function () {
			this.el.removeEventListener('touchstart', this, false);
			this.el.removeEventListener('touchmove', this, false);
			this.el.removeEventListener('touchend', this, false);
			this.el.removeEventListener('touchcancel', this, false);
			this.el.removeEventListener('mousedown', this, false);
			this.el.removeEventListener('mousemove', this, false);
			this.el.removeEventListener('mouseup', this, false);
			this.el.removeEventListener('mousecancel', this, false);
		}
	};
	
	return Tap;
})(window, document, hyperaudio);

var titleFX = (function (window, document) {
	var _elementStyle = document.createElement('div').style;

	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransform';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	var transition = _prefixStyle('transition');
	var transitionDuration = _prefixStyle('transitionDuration');
	var transform = _prefixStyle('transform');

	_elementStyle = null; // free mem ???

	var fxInstance;

	function title (options) {
		if ( !fxInstance ) {
			var opt = {
				el: null,
				text: '',
				speed: 600,
				duration: 3000,
				background: 'rgba(0,0,0,0.8)',
				color: '#ffffff'
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			fxInstance = new TitleEffect(opt);
		}

		return fxInstance;
	}

	function TitleEffect (options) {
		this.options = options;

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		this.el.innerHTML = this.options.text;
		this.el.style.backgroundColor = this.options.background;
		this.el.style.color = this.options.color;
		this.el.style.left = '0px';
		this.el.style[transform] = 'translate(0, 100%) translateZ(0)';

		this.el.addEventListener('transitionend', this, false);
		this.el.addEventListener('webkitTransitionEnd', this, false);
		this.el.addEventListener('oTransitionEnd', this, false);
		this.el.addEventListener('MSTransitionEnd', this, false);

		this.start();
	}

	TitleEffect.prototype.handleEvent = function (e) {
		switch ( e.type ) {
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this.transitionEnd(e);
				break;
		}
	};

	TitleEffect.prototype.start = function () {
		this.phase = 'start';

		var trick = this.el.offsetHeight;	// force refresh. Mandatory on FF
		this.el.style[transitionDuration] = this.options.speed + 'ms';

		var that = this;
		setTimeout(function () {
			that.el.style[transform] = 'translate(0, 0) translateZ(0)';
		}, 0);
	};

	TitleEffect.prototype.transitionEnd = function (e) {
		e.stopPropagation();

		if ( this.phase == 'start' ) {
			this.phase = 'waiting';
			this.timeout = setTimeout(this.end.bind(this), this.options.duration);
			return;
		}

		if ( this.options.onEnd ) {
			this.options.onEnd.call(this);
		}

		this.destroy();
	};

	TitleEffect.prototype.end = function () {
		this.phase = 'end';
		this.el.style[transform] = 'translate(0, 100%) translateZ(0)';
	};

	TitleEffect.prototype.destroy = function () {
		clearTimeout(this.timeout);

		this.el.removeEventListener('transitionend', this, false);
		this.el.removeEventListener('webkitTransitionEnd', this, false);
		this.el.removeEventListener('oTransitionEnd', this, false);
		this.el.removeEventListener('MSTransitionEnd', this, false);

		this.el.style[transitionDuration] = '0s';
		this.el.style.left = '-9999px';

		fxInstance = null;
	};

	return title;
})(window, document);

var WordSelect = (function (window, document, hyperaudio) {

	// used just in dev environment
	function addTagHelpers (el) {
		var text = (el.innerText || el.textContent).split(' ');

		el.innerHTML = '<a>' + text.join(' </a><a>') + '</a>';
	}

	function WordSelect (options) {

		this.options = {
			el: null,
			addHelpers: false,
			touch: true,
			mouse: true,
			threshold: 10
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.element = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		if ( this.options.addHelpers ) {
			addTagHelpers(this.element);
		}

		this.words = this.element.querySelectorAll('a');
		this.wordsCount = this.words.length;

		if ( this.options.touch ) {
			this.element.addEventListener('touchstart', this, false);
		}

		if ( this.options.mouse ) {
			this.element.addEventListener('mousedown', this, false);
		}
	}

	WordSelect.prototype.handleEvent = function (e) {
		// jshint -W086
		switch (e.type) {
			case 'mousedown':
				if ( e.which !== 1 ) {
					break;
				}
			case 'touchstart':
				this.start(e);
				break;
			case 'touchmove':
			case 'mousemove':
				this.move(e);
				break;
			case 'touchend':
			case 'mouseup':
				this.end(e);
				break;
		}
		// jshint +W086
	};

	WordSelect.prototype.start = function (e) {
		e.preventDefault();

		var point = e.touches ? e.touches[0] : e;

		this.selectStarted = false;
		this.startX = e.pageX;
		this.startY = e.pageY;

		if ( this.options.mouse ) {
			this.element.addEventListener('mousemove', this, false);
			window.addEventListener('mouseup', this, false);
		}

		if ( this.options.touch ) {
			this.element.addEventListener('touchmove', this, false);
			window.addEventListener('touchend', this, false);
		}

		if ( hyperaudio.hasClass(e.target, 'selected') ) {
			this.dragTimeout = setTimeout(this.dragStart.bind(this, e), 500);
		}
	};

	WordSelect.prototype.selectStart = function (e) {
		var target = e.target,
			tmp;

		if ( target == this.element || target.tagName != 'A' ) {
			return;
		}

		this.selectStarted = true;

		this.currentWord = target;

		hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

		if ( this.words[this.startPosition] === target ) {
			tmp = this.startPosition;
			this.startPosition = this.endPosition;
			this.endPosition = tmp;
			return;
		}

		if ( this.words[this.endPosition] === target ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				this.startPosition = i;
			}

			hyperaudio.removeClass(this.words[i], 'selected');
		}

		this.endPosition = this.startPosition;

		hyperaudio.addClass(target, 'selected');
	};

	WordSelect.prototype.move = function (e) {
		var point = e.changedTouches ? e.changedTouches[0] : e,
			target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target,
			endPosition;

		if ( Math.abs(point.pageX - this.startX) < this.options.threshold &&
			Math.abs(point.pageY - this.startY) < this.options.threshold ) {
			return;
		}

		clearTimeout(this.dragTimeout);

		if ( !this.selectStarted ) {
			this.selectStart(e);
			return;
		}

		if ( target.tagName == 'P' ) {
			target = target.querySelector('a:last-child');
		}

		if ( target == this.element || target == this.currentWord || target.tagName != 'A' ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				endPosition = i;
			}

			if ( ( endPosition === undefined && i >= this.startPosition ) ||
				( endPosition !== undefined && i <= this.startPosition ) ||
				endPosition == i ) {
				hyperaudio.addClass(this.words[i], 'selected');
			} else {
				hyperaudio.removeClass(this.words[i], 'selected');
			}
		}

		this.currentWord = target;
		this.endPosition = endPosition;
	};

	WordSelect.prototype.end = function (e) {
		clearTimeout(this.dragTimeout);

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		if ( !this.selectStarted ) {
			if ( e.target == this.element ) {
				this.clearSelection();
			}

			return;
		}

		var start = Math.min(this.startPosition, this.endPosition),
			end = Math.max(this.startPosition, this.endPosition);

		hyperaudio.addClass(this.words[start], 'first');
		hyperaudio.addClass(this.words[end], 'last');
	};

	WordSelect.prototype.clearSelection = function () {
		this.currentWord = null;
		this.startPosition = null;
		this.endPosition = null;

		hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		var selected = this.element.querySelectorAll('.selected');
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			hyperaudio.removeClass(selected[i], 'selected');
		}
	};

	WordSelect.prototype.getSelection = function () {
		var selected = this.element.querySelectorAll('.selected');
		var prevParent;
		var html = '';
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			if ( selected[i].parentNode !== prevParent ) {
				prevParent = selected[i].parentNode;
				html += ( i === 0 ? '<p>' : '</p><p>' );
			}
			html += selected[i].outerHTML.replace(/ class="[\d\w\s\-]*\s?"/gi, ' ');
		}

		if ( html ) {
			html += '</p>';
		}

		return html;
	};

	WordSelect.prototype.dragStart = function (e) {
		e.stopPropagation();

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		var point = e.changedTouches ? e.changedTouches[0] : e;

		if ( this.options.onDragStart ) {
			this.options.onDragStart.call(this, e);
		}
	};

	WordSelect.prototype.destroy = function () {
		this.element.removeEventListener('touchstart', this, false);
		this.element.removeEventListener('touchmove', this, false);
		this.element.removeEventListener('touchend', this, false);

		this.element.removeEventListener('mousedown', this, false);
		this.element.removeEventListener('mousemove', this, false);
		this.element.removeEventListener('mouseup', this, false);
	};

	return WordSelect;

})(window, document, hyperaudio);

/* xhr
 *
 */

var xhr = (function(hyperaudio) {

	return function(options) {

		options = hyperaudio.extend({
			url: '',
			data: '', // Only valid for POST types
			type: 'GET',
			responseType: '',
			async: true,
			withCredentials: true, // Setting to true requires the CORS header Access-Control-Allow-Credentials on the server
			timeout: 0,
			cache: true

			// complete: function()
			// error: function()
		}, options);

		if(!options.cache) {
			options.url = options.url + ((/\?/).test(options.url) ? "&" : "?") + (new Date()).getTime();
		}

		var xhr = new XMLHttpRequest();

		xhr.addEventListener('load', function(event) {
			if(this.status === 200) {
				if(typeof options.complete === 'function') {
					options.complete.call(this, event);
				}
			} else {
				if(typeof options.error === 'function') {
					options.error.call(this, event);
				}
			}
		}, false);

		if(typeof options.error === 'function') {
			xhr.addEventListener('error', function(event) {
				options.error.call(this, event);
			}, false);
			xhr.addEventListener('abort', function(event) {
				options.error.call(this, event);
			}, false);
		}

		xhr.open(options.type, options.url, options.async);
		xhr.responseType = options.responseType;
		xhr.withCredentials = options.withCredentials;
		xhr.timeout = options.timeout;

		if(options.data) {
			xhr.setRequestHeader('content-type', 'application/json; charset=utf-8');
		}

		xhr.send(options.data);

		return xhr;
	};

}(hyperaudio));


/* api
 *
 */

var api = (function(hyperaudio) {

	return {
		init: function(options) {
			this.options = hyperaudio.extend({
				api: 'http://data.hyperaud.io/',
				transcripts: 'transcripts/',
				mixes: 'mixes/',
				whoami: 'whoami/'
			}, options);

			// API State
			this.error = false;

			// User Properties
			this.guest = false; // False to force 1st call
			this.username = ''; // Falsey to force 1st call

			// Stored requested data
			this.transcripts = null;
			this.transcript = null;
			this.mixes = null;
			this.mix = null;
		},
		callback: function(callback, success) {
			if(typeof callback === 'function') {
				callback.call(this, success);
			}
		},
		getUsername: function(callback, force) {
			var self = this;
			if(!force && (this.guest || this.username)) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				xhr({
					url: this.options.api + this.options.whoami,
					complete: function(event) {
						var json = JSON.parse(this.responseText);
						self.guest = !json.user;
						if(!self.guest) {
							self.username = json.user.username;
						} else {
							self.username = '';
						}
						self.callback(callback, true);
					},
					error: function(event) {
						self.error = true;
						self.callback(callback, false);
					}
				});
			}
		},
		getTranscripts: function(callback, force) {
			var self = this;
			if(!force && this.transcripts) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				xhr({
					url: this.options.api + this.options.transcripts,
					complete: function(event) {
						var json = JSON.parse(this.responseText);
						self.transcripts = json;
						self.callback(callback, true);
					},
					error: function(event) {
						self.error = true;
						self.callback(callback, false);
					}
				});
			}
		},
		getTranscript: function(id, callback, force) {
			var self = this;
			if(!force && this.transcript && this.transcript._id === id) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				this.getUsername(function(success) {
					if(success && id) {
						xhr({
							url: self.options.api + (self.guest ? '' : self.username + '/') + self.options.transcripts + id,
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.transcript = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.error = true; // Setting the common error prop is redundant, since it would have been set in getUsername failure.
						self.callback(callback, false);
					}
				});
			}
		},
		getMixes: function(callback, force) {
			var self = this;
			if(!force && this.mixes) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				this.getUsername(function(success) {
					if(success) {
						xhr({
							url: self.options.api + (self.guest ? '' : self.username + '/') + self.options.mixes,
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.mixes = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.error = true; // Setting the common error prop is redundant, since it would have been set in getUsername failure.
						self.callback(callback, false);
					}
				});
			}
		},
		getMix: function(id, callback, force) {
			var self = this;
			if(!force && this.mix && this.mix._id === id) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				this.getUsername(function(success) {
					if(success && id) {
						xhr({
							url: this.options.api + (this.guest ? '' : this.username + '/') + this.options.mixes + id,
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.mix = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.error = true; // Setting the common error prop is redundant, since it would have been set in getUsername failure.
						self.callback(callback, false);
					}
				});
			}
		},
		putMix: function(mix, callback) {
			var self = this;

			// Are we storing the current Mix we're editing in here?
			// Yes, but only refreshing the mix data here on Load and Save.
			// The current mix data will be in the stage's HTML.

			if(typeof mix === 'object') {
				var type = 'POST',
					id = '';

				if(this.mix && this.mix._id && this.mix._id === mix._id) {
					type = 'PUT';
					id = this.mix._id;
					// Check some stuff?
				} else {
					// Check some stuff?
				}

				this.getUsername(function(success) {
					if(success && !this.guest && this.username) {
						xhr({
							url: self.options.api + self.username + '/' + self.options.mixes + id,
							type: type,
							data: JSON.stringify(mix),
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.mix = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.callback(callback, false);
					}
				});
			} else {
				setTimeout(function() {
					self.callback(callback, false);
				}, 0);
			}
		}
	};

}(hyperaudio));


/* Player
 *
 */

var Player = (function(window, document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			media: {
				mp4: '', // The URL of the mp4 video.
				webm:'' // The URL of the webm video.
			},
			mediaType: {
				mp4: 'video/mp4', // The mp4 mime type.
				webm:'video/webm' // The webm mime type.
			},

			guiNative: false, // TMP during dev. Either we have a gui or we are chomeless.

			gui: false, // True to add a gui
			cssClassPrefix: 'hyperaudio-player-', // Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.sourceElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);
		this.gui = null;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function() {
			var self = this;

			if(this.target) {
				this.videoElem = document.createElement('video');
				this.videoElem.controls = this.options.guiNative; // TMP during dev. Either we have a gui or we are chomeless.
/*
				this.sourceElem = {
					mp4: document.createElement('source'),
					webm: document.createElement('source')
				};
*/
				// Add listeners to the video element
				this.videoElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.target.innerHTML = '';
				// this.videoElem.appendChild(this.sourceElem.mp4);
				// this.videoElem.appendChild(this.sourceElem.webm);
				this.target.appendChild(this.videoElem);

				if(this.options.gui) {
					this.addGUI();
					this.addGUIListeners();
				}
				if(this.options.media.mp4) { // Assumes we have the webm
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUI: function() {
			var self = this;
			if(this.target) {
				this.gui = {
					container: this.target, // To add a class to the player target
					gui: document.createElement('div'),
					controls: document.createElement('div'),
					play: document.createElement('a'),
					pause: document.createElement('a')
				};

				// Add a class to each element
				hyperaudio.each(this.gui, function(name) {
					hyperaudio.addClass(this, self.options.cssClassPrefix + name);
				});

				// Add listeners to controls
				this.gui.play.addEventListener('click', function(e) {
					e.preventDefault();
					self.play();
				}, false);
				this.gui.pause.addEventListener('click', function(e) {
					e.preventDefault();
					self.pause();
				}, false);
/*
				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				}, false);
*/
				// Hide the pause button
				this.gui.pause.style.display = 'none';

				// Build the GUI structure
				this.gui.gui.appendChild(this.gui.controls);
				this.gui.controls.appendChild(this.gui.play);
				this.gui.controls.appendChild(this.gui.pause);
				this.target.appendChild(this.gui.gui);
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUIListeners: function() {
			var self = this;
			if(this.gui) {
				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				}, false);

			} else {
				this._error('GUI not used: gui = ' + this.options.gui);
			}
		},
		load: function(media) {
			var self = this;
			if(media) {
				this.options.media = media;
			}
			if(this.videoElem && typeof this.options.media === 'object') {
				this.killPopcorn();

				// Remove any old source elements
				this.sourceElem = {};
				while(this.videoElem.firstChild) {
					this.videoElem.removeChild(this.videoElem.firstChild);
				}

				// Setup to work with mp4 and webm property names. See options.
				hyperaudio.each(this.options.media, function(format, url) {
					var source = self.sourceElem[format] = document.createElement('source');
					source.setAttribute('type', self.options.mediaType[format]);
					source.setAttribute('src', url); // Could use 'this' but less easy to read.
					self.videoElem.appendChild(source);
				});

				this.videoElem.load();

				this.initPopcorn();
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			this.popcorn = Popcorn(this.videoElem);
		},
		killPopcorn: function() {
			if(this.popcorn) {
				this.popcorn.destroy();
				delete this.popcorn;
			}
		},
		play: function(time) {
			if(this.gui) {
				this.gui.play.style.display = 'none';
				this.gui.pause.style.display = '';
			}
			this.currentTime(time, true);
		},
		pause: function(time) {
			if(this.gui) {
				this.gui.play.style.display = '';
				this.gui.pause.style.display = 'none';
			}
			this.videoElem.pause();
			this.currentTime(time);
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.videoElem;

			clearTimeout(this.timeout.currentTime);

			if(typeof time === 'number' && !isNaN(time)) {

				// Attempt to play it, since iOS has been ignoring commands
				if(play && this.commandsIgnored) {
					media.play();
				}

				try {
					// !media.seekable is for old HTML5 browsers, like Firefox 3.6.
					// Checking seekable.length is important for iOS6 to work with currentTime changes immediately after changing media
					if(!media.seekable || typeof media.seekable === "object" && media.seekable.length > 0) {
						media.currentTime = time;
						if(play) {
							media.play();
						}
					} else {
						throw 1;
					}
				} catch(err) {
					this.timeout.currentTime = setTimeout(function() {
						self.currentTime(time, play);
					}, 250);
				}
			} else {
				if(play) {
					media.play();
				}
			}
		}
	};

	return Player;
}(window, document, hyperaudio, Popcorn));


/* Transcript
 *
 */

var Transcript = (function(document, hyperaudio) {

	function Transcript(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'TRANSCRIPT', // Not really an option... More like a manifest

			target: '#transcript', // The selector of element where the transcript is written to.

			id: '', // The ID of the transcript.

			// src: '', // [obsolete] The URL of the transcript.
			// video: '', // [obsolete] The URL of the video.

			media: {},

			group: 'p', // Element type used to group paragraphs.
			word: 'a', // Element type used per word.

			timeAttr: 'data-m', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.

			async: true, // When true, some operations are delayed by a timeout.

			stage: null,
			player: null
		}, options);

		// State Flags
		this.ready = false;
		this.enabled = true;

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.textSelect = null;

		// Setup Debug
		if(this.options.DEBUG) {
			this._debug();
		}

		// If we have the info, kick things off
		if(this.options.id) {
			this.load();
		}
	}

	Transcript.prototype = {
		// load: function(transcript) {
		load: function(id) {
			var self = this;

			this.ready = false;

			if(id) {
				this.options.id = id;
			}
/*
			if(transcript) {
				if(transcript.src) {
					this.options.src = transcript.src;
				}
				if(transcript.video) {
					this.options.video = transcript.video;
				}
			}
*/
			var setVideo = function() {
				if(self.options.async) {
					setTimeout(function() {
						self.setVideo();
					}, 0);
				} else {
					self.setVideo();
				}
			};

			if(this.target) {
				this.target.innerHTML = '';

				hyperaudio.api.getTranscript(this.options.id, function(success) {
					if(success) {
						self.target.innerHTML = this.transcript.content;
						self._trigger(hyperaudio.event.load, {msg: 'Loaded "' + self.options.id + '"'});
					} else {
						self.target.innerHTML = 'Problem with transcript URL.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
						self._error(this.status + ' ' + this.statusText + ' : "' + self.options.id + '"');
					}
					setVideo();
				});
/*
				xhr({
					url: this.options.src,
					complete: function(event) {
						self.target.innerHTML = this.responseText;
						self._trigger(hyperaudio.event.load, {msg: 'Loaded "' + self.options.src + '"'});
						setVideo();
					},
					error: function(event) {
						self.target.innerHTML = 'Problem with transcript URL.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
						self._error(this.status + ' ' + this.statusText + ' : "' + self.options.src + '"');
						setVideo();
					}
				});
*/
			}
		},

		setVideo: function() {
			var self = this;

			// Setup the player
			if(this.options.player && hyperaudio.api.transcript) {
				var hapi = hyperaudio.api,
					path = hapi.options.api + hapi.transcript.media.owner + '/' + hapi.transcript.media.meta.filename;
				this.options.media = {
						mp4: path,
						webm: path.replace(/\.mp4$/, '.webm') // Huge assumption!
					};
				this.options.player.load(this.options.media);
				if(this.options.async) {
					setTimeout(function() {
						self.parse();
					}, 0);
				} else {
					this.parse();
				}
			} else {
				this._error('Player not defined');
				this.selectorize();
			}
		},

		parse: function() {
			var self = this,
				opts = this.options;

			if(this.target && opts.player && opts.player.popcorn) {

				var wordList = this.target.querySelectorAll(opts.target + ' ' + opts.word),
					i, l = wordList.length;

				var onNewPara = function(parent) {
					// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
				};

				for(i = 0; i < l; i++) {
					opts.player.popcorn.transcript({
						time: wordList[i].getAttribute(opts.timeAttr) * opts.unit, // seconds
						futureClass: "transcript-grey",
						target: wordList[i],
						onNewPara: onNewPara
					});
				}

				this.target.addEventListener('click', function(event) {
					event.preventDefault();
					if(event.target.nodeName.toLowerCase() === opts.word) {
						var tAttr = event.target.getAttribute(opts.timeAttr),
							time = tAttr * opts.unit;
						opts.player.currentTime(time);
					}
				}, false);
			}

			this.selectorize();
		},

		selectorize: function() {

			var self = this,
				opts = this.options;

			if(opts.stage) {

				// Destroy any existing WordSelect.
				this.deselectorize();

				this.textSelect = new WordSelect({
					el: opts.target,
					onDragStart: function(e) {
						hyperaudio.addClass(opts.stage.target, opts.stage.options.dragdropClass);
						var dragdrop = new DragDrop({
							dropArea: opts.stage.target,
							init: false,
							onDrop: function(el) {
								self.textSelect.clearSelection();
								this.destroy();

								if ( !el ) {
									return;
								}

								el.setAttribute(opts.stage.options.idAttr, opts.id); // Pass the transcript ID
								el.setAttribute(opts.stage.options.mp4Attr, opts.media.mp4); // Pass the transcript mp4 url
								el.setAttribute(opts.stage.options.webmAttr, opts.media.webm); // Pass the transcript webm url
								el.setAttribute(opts.stage.options.unitAttr, opts.unit); // Pass the transcript Unit
								opts.stage.dropped(el);
							}
						});

						// var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
						var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, ''); // + '<div class="actions"></div>';
						dragdrop.init(html, e);
					}
				});
				this.ready = true;
				this._trigger(hyperaudio.event.ready);
			}
		},

		deselectorize: function() {
			if(this.textSelect) {
				this.textSelect.destroy();
			}
			delete this.textSelect;
		},

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Transcript;
}(document, hyperaudio));


/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			id: '', // The ID of the saved mix.

			title: 'Test from hyperaudio.stage.js',
			desc: 'Testing initial save system',
			type: 'beta',

			idAttr: 'data-id', // Attribute name that holds the transcript ID.
			mp4Attr: 'data-mp4', // Attribute name that holds the transcript mp4 URL.
			webmAttr: 'data-webm', // Attribute name that holds the transcript webm URL.
			unitAttr: 'data-unit', // Attribute name that holds the transcript Unit.

			dragdropClass: 'dragdrop',
			async: true, // When true, some operations are delayed by a timeout.
			projector: null
		}, options);

		// State Flags.
		this.ready = false;
		this.enabled = true;

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.article = document.createElement('article');
		this.mix = {};

		this.target.appendChild(this.article);

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.projector) {
			this.options.projector.setStage(this);
		}

		if(this.options.id) {
			this.load();
		}
	}

	Stage.prototype = {
		mixDetails: function(details) {
			// [SHOULD] only really used to set the lebel, desc and type of the mix being saved.
			hyperaudio.extend(this.options, details);
		},
		load: function(id) {
			var self = this;

			if(id) {
				this.options.id = id;
			}

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				// hyperaudio.api.guest = false;
				// hyperaudio.api.username = 'tester';

				hyperaudio.api.getMix(id, function(success) {
					if(success) {
						self.mix = hyperaudio.extend({}, this.mix);

						// Need to maintain the existing article in the stage - Important for dragdrop.
						var tmp = document.createElement('div'); // Temporary DOM element
						tmp.innerHTML = self.mix.content; // Add the content to the DOM element
						var articleElem = tmp.querySelector('article'); // Find the article in the content.
						// Can now insert the contents of the returned mix article into the maintained article.
						self.article.innerHTML = articleElem.innerHTML;

						// TODO: Should also clear any existing attributes on the article.

						// Now copy over any attributes
						var attr = articleElem.attributes;
						for(var i=0, l=attr.length; i < l; i++ ) {
							self.article.setAttribute(attr[i].name, attr[i].value);
						}

						// Setup the dragdrop on the loaded mix sections.
						self.initDragDrop();
						self._trigger(hyperaudio.event.load, {msg: 'Loaded mix'});
					} else {
						self._error(this.status + ' ' + this.statusText + ' : "' + url + '"');
					}
				});
			}
			// Would then need to init the dragdrop ability on each item
		},

		save: function() {
			// Save the staged production

			var self = this;

			hyperaudio.extend(this.mix, {
				label: this.options.title,
				desc: this.options.desc,
				meta: {},
				sort: 999,
				type: this.options.type,
				content: this.target.innerHTML
			});

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				// hyperaudio.api.guest = false;
				// hyperaudio.api.username = 'tester';

				hyperaudio.api.putMix(this.mix, function(success) {
					if(success) {
						self.mix = hyperaudio.extend({}, this.mix);
						self._trigger(hyperaudio.event.save, {msg: 'Saved mix'});
					} else {
						self._error(this.status + ' ' + this.statusText + ' : "' + url + '"');
					}
				});
			}
		},

		clear: function() {
			// TODO: Should also clear any existing attributes on the article.
			this.article.innerHTML = '';
			this.mix = {};
			this.options.id = '';
		},

		parse: function() {
			var self = this,
				opts = this.options;

			// Will need the popcorn.transcript highlighting as per the source transcripts.
		},

		initDragDrop: function() {
			var self = this,
				i, l, sections;
			if(this.target) {
				sections = this.target.getElementsByTagName('section');
				l = sections.length;
				for(i=0; i < l; i++) {
					self.dropped(sections[i]);
				}
			}
		},

		dropped: function(el, html) {
			var self = this;

			if(this.target) {
				hyperaudio.removeClass(this.target, this.options.dragdropClass);

				// Setup item for future dragdrop 
				el._dragInstance = new DragDrop({
					handle: el,
					dropArea: this.target,
					html: html ? html : el.innerHTML,
					// draggableClass: draggableClass,
					onDragStart: function () {
						hyperaudio.addClass(self.target, self.options.dragdropClass);
					},
					onDrop: function () {
						hyperaudio.removeClass(self.target, self.options.dragdropClass);
					}
				});
			}
		},

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Stage;
}(document, hyperaudio));


/* Projector
 * Used to play the staged productions
 */

var Projector = (function(window, document, hyperaudio, Popcorn) {

	function Projector(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PROJECTOR', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			// media: {}, // The URL of the video.

			tPadding: 1, // (Seconds) Time added to end word timings.

			players: 1, // Number of Players to use. Mobile: 1, Desktop: 2.

			unit: 0.001, // Unit used if not given in section attr of stage.

			gui: true, // True to add a gui.
			cssClassPrefix: 'hyperaudio-player-', // (See Player.addGUI) Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.stage = null;
		// this.timeout = {};

		this.player = [];
		this.media = [];
		this.current = {};
		this.gui = null;

		// State Flags
		this.paused = true;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.target) {
			this.create();
		}
	}

	Projector.prototype = {
		setStage: function(stage) {
			this.stage = stage;
		},
		create: function() {
			var self = this;

			if(this.target) {

				// Making it work with a single player. Will dev 2 later.

				var manager = function(event) {
					self.manager(event);
				};

				for(var i = 0; i < this.options.players; i++ ) {
					var player = document.createElement('div');
					this.player[i] = hyperaudio.Player({
						target: player
					});

					this.player[i].videoElem.addEventListener('timeupdate', manager, false);

					this.target.appendChild(player);
				}

				if(this.options.gui) {
					this.addGUI();
				}
				if(this.options.media) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUI: Player.prototype.addGUI,
		load: function(media) {
			var self = this;
			if(media) {
				this.options.media = media;
			}
			this.media[0] = this.options.media;

			if(this.player[0]) {
				this.player[0].load(this.media[0]);
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		play: function() {

			// ATM, we always play fromm the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.current.sections = this.stageArticle.getElementsByTagName('section');

				this.setCurrent(0);

				this.paused = false;

				this.load(this.current.media);
				this._play(this.current.start);

			} else {
				this.paused = true;
			}
		},
		pause: function() {
			this.paused = true;
			this._pause();
		},
		_play: function(time) {
			if(this.gui) {
				this.gui.play.style.display = 'none';
				this.gui.pause.style.display = '';
			}
			this.player[0].play(time);
		},
		_pause: function(time) {
			if(this.gui) {
				this.gui.play.style.display = '';
				this.gui.pause.style.display = 'none';
			}
			this.player[0].pause(time);
		},
		currentTime: function(time, play) {
			this.player[0].currentTime(time, play);
		},
		setCurrent: function(index) {
			this.current.index = index;

			// Get the first section
			this.current.section = this.current.sections[this.current.index];

			// Get the ID
			this.current.id = this.current.section.getAttribute(this.stage.options.idAttr);

			// Get the media
			this.current.media = {
				mp4: this.current.section.getAttribute(this.stage.options.mp4Attr),
				webm: this.current.section.getAttribute(this.stage.options.webmAttr),
			};

			var unit = 1 * this.current.section.getAttribute(this.stage.options.unitAttr);
			this.current.unit = unit = unit > 0 ? unit : this.options.unit;

			// Still have attributes hard coded in here. Would need to pass from the transcript to stage and then to here.
			var words = this.current.section.getElementsByTagName('a');
			this.current.start = words[0].getAttribute('data-m') * unit;
			this.current.end = words[words.length-1].getAttribute('data-m') * unit;
		},
		manager: function(event) {
			var self = this;

			if(!this.paused) {
				if(this.player[0].videoElem.currentTime > this.current.end + this.options.tPadding) {
					// Goto the next section

					if(++this.current.index < this.current.sections.length) {
						this.setCurrent(this.current.index);

						this.load(this.current.media);
						this._play(this.current.start);
					} else {
						this.current.index = 0;

						this.paused = true;
						this._pause();
					}
				}
			}
		}
	};

	return Projector;
}(window, document, hyperaudio, Popcorn));


hyperaudio.register('Player', Player);
hyperaudio.register('Transcript', Transcript);
hyperaudio.register('Stage', Stage);
hyperaudio.register('Projector', Projector);


hyperaudio.utility('api', api); // obj
hyperaudio.utility('DragDrop', DragDrop); // Class
hyperaudio.utility('EditBlock', EditBlock); // Class
hyperaudio.utility('fadeFX', fadeFX); // Class
hyperaudio.utility('SideMenu', SideMenu); // Class
hyperaudio.utility('Tap', Tap); // Class
hyperaudio.utility('titleFX ', titleFX ); // Class
hyperaudio.utility('WordSelect', WordSelect); // Class
hyperaudio.utility('xhr', xhr); // fn


	return hyperaudio;
}(window, document));
