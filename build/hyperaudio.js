/*! hyperaudio v0.0.6 ~ (c) 2012-2013 Hyperaudio Inc. <hello@hyperaud.io> (http://hyperaud.io) ~ Built: 26th September 2013 22:44:48 */
var HA = (function(window, document) {


var DragDrop = (function (window, document) {

	function DragDrop (handle, droppable, options) {
		this.options = {
			init: true,
			touch: true,
			mouse: true,
			timeout: 500,
			html: '',
			draggableClass: ''
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.droppable = typeof droppable == 'string' ? document.querySelector(droppable) : droppable;

		// Create the list and the placeholder
		this.list = this.droppable.querySelector('ul');
		if ( !this.list ) {
			this.list = document.createElement('ul');
			this.droppable.appendChild(this.list);
		}
		this.placeholder = document.createElement('li');
		this.placeholder.className = 'placeholder';

		if ( this.options.init ) {
			this.handle = typeof handle == 'string' ? document.querySelector(handle) : handle;
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
		if ( /INPUT/.test(e.target.tagName) ) {
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

		if ( this.list.querySelector('.placeholder') ) {
			this.list.removeChild(this.placeholder);
		}

		if ( target == this.droppable ) {
			this.list.appendChild(this.placeholder);
			return;
		}

		if ( /(^|\s)item(\s|$)/.test(target.className) ) {
			var items = this.list.querySelectorAll('.item'),
				i = 0, l = items.length;
			for ( ; i < l; i++ ) {
				if ( target == items[i] ) {
					this.list.insertBefore(this.placeholder, items[i]);
					break;
				}
			}
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

		// if we are reordering, remove the original element
		if ( this.reordering ) {
			if ( this.handle._dragInstance ) {
				this.handle._dragInstance.destroy();
				this.handle._dragInstance = null;
			}

			this.handle.parentNode.removeChild(this.handle);
		}

		// we dropped outside of the draggable area, so exit
		if ( !this.list.querySelector('.placeholder') ) {
			return;
		}

		var el = document.createElement('li');
		el.className = this.handleClassName || 'item';
		el.innerHTML = html;

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
})(window, document);

var WordSelect = (function (window, document) {

	function addTagHelpers (el) {
		var text = (el.innerText || el.textContent).split(' ');

		el.innerHTML = '<a>' + text.join(' </a><a>') + '</a>';
	}

	function hasClass (e, c) {
		if ( !e ) return false;

		var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
		return re.test(e.className);
	}

	function addClass (e, c) {
		if ( hasClass(e, c) ) {
			return;
		}

		var newclass = e.className.split(' ');
		newclass.push(c);
		e.className = newclass.join(' ');
	}

	function removeClass (e, c) {
		if ( !hasClass(e, c) ) {
			return;
		}

		var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
		e.className = e.className.replace(re, ' ');
	}

	function WordSelect (el, options) {
		this.element = document.querySelector(el);

		this.options = {
			addHelpers: false,
			touch: true,
			mouse: true,
			threshold: 10
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

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
			this.element.addEventListener('mouseup', this, false);
		}

		if ( this.options.touch ) {
			this.element.addEventListener('touchmove', this, false);
			this.element.addEventListener('touchend', this, false);
		}

		if ( hasClass(e.target, 'selected') ) {
			this.dragTimeout = setTimeout(this.dragStart.bind(this, e), 500);
		}
	};

	WordSelect.prototype.selectStart = function (e) {
		var target = e.target,
			tmp;

		if ( target == this.element ) {
			return;
		}

		this.selectStarted = true;

		this.currentWord = target;

		removeClass(this.element.querySelector('.first'), 'first');
		removeClass(this.element.querySelector('.last'), 'last');

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

			removeClass(this.words[i], 'selected');
		}

		this.endPosition = this.startPosition;

		addClass(target, 'selected');
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

		if ( target == this.element || target == this.currentWord ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				endPosition = i;
			}

			if ( ( endPosition === undefined && i >= this.startPosition ) ||
				( endPosition !== undefined && i <= this.startPosition ) ||
				endPosition == i ) {
				addClass(this.words[i], 'selected');
			} else {
				removeClass(this.words[i], 'selected');
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
			return;
		}

		var start = Math.min(this.startPosition, this.endPosition),
			end = Math.max(this.startPosition, this.endPosition);

		addClass(this.words[start], 'first');
		addClass(this.words[end], 'last');
	};

	WordSelect.prototype.clearSelection = function () {
		removeClass(this.element.querySelector('.first'), 'first');
		removeClass(this.element.querySelector('.last'), 'last');

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
			removeClass(selected[i], 'selected');
		}
	};

	WordSelect.prototype.getSelection = function () {
		var selected = this.element.querySelectorAll('.selected');
		var html = '';
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			html += selected[i].outerHTML.replace(/ class="[\d\w\s\-]*\s?"/gi, ' ');
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

})(window, document);

var hyperaudio = (function($) {

	return {
		core: {
			options: {
				DEBUG: true,
				entity: 'core'
			},
			event: {
				load: 'ha:load',
				error: 'ha:error'
			},
			_trigger: function(eventType, eventData) {
				var eventObject = $.extend({options: this.options}, eventData),
					event = $.Event(eventType, {ha: eventObject});
				$(this).trigger(event);
			},
			_error: function(msg) {
				var data = {msg: this.options.entity + ' Error : ' + msg};
				this._trigger(this.event.error, data);
			},
			_debug: function() {
				var self = this;
				$.each(this.event, function(eventName, eventType) {
					$(self).on(eventType, function(event) {
						console.log(self.options.entity + ' triggered "' + eventType + '" event : ' + event.ha.msg);
					});
				});
			}
		},
		register: function(name, module) {
			if(typeof name === 'string') {
				if(typeof module === 'function') {
					module.prototype = $.extend({}, this.core, module.prototype);
					this[name] = function(options) {
						return new module(options);
					};
				} else if(typeof module === 'object') {
					module = $.extend({}, this.core, module);
					this[name] = module;
				}
			}
		},
		utility: function(name, utility) {
			if(typeof name === 'string') {
				this[name] = utility;
			}
		}
	};
}(jQuery));


/* Player
 *
 */

var Player = (function($, Popcorn) {

	function Player(options) {

		this.options = $.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated
			src: '', // The URL of the video.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.options.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function(target) {
			var self = this,
				$target;
			if(target) {
				this.options.target = target;
			}
			$target = $(this.options.target);
			if($target.length) {
				this.video = document.createElement('video');
				this.video.controls = true;
				// Will want to create some event listeners on the video... For errors and timeupdate in the least.
				$(this.options.target).empty().append(this.video);
				if(this.options.src) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		load: function(src) {
			var self = this;
			if(src) {
				this.options.src = src;
			}
			if(this.video) {
				this.killPopcorn();
				// this.initPopcorn();
				this.video.src = this.options.src;
				this.initPopcorn();
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			// this.popcorn = Popcorn(this.options.target); // Wrong target!
			this.popcorn = Popcorn(this.video); // Wrong target!
		},
		killPopcorn: function() {
			if(this.popcorn) {
				this.popcorn.destroy();
				delete this.popcorn;
			}
		},
		play: function(time) {
			// Maybe should use the popcorn commands here
			this.video.currentTime = time;
			this.video.play();
		},
		currentTime: function(time) {
			// Maybe should use the popcorn commands here
			this.video.currentTime = time;
		}
	};

	return Player;
}(jQuery, Popcorn));


/* Transcript
 *
 */

var Transcript = (function($, Popcorn) {

	function Transcript(options) {

		this.options = $.extend({}, this.options, {

			entity: 'TRANSCRIPT', // Not really an option... More like a manifest

			transcript: '#transcript', // The selector of element where the transcript is written to.
			stage: '#stage',

			src: '', // The URL of the transcript.
			video: '', // The URL of the video.

			group: 'p', // Element type used to group paragraphs.
			word: 'a', // Element type used per word.

			// Since now using data-m, we can use the $().data('m') later instead of $().attr('data-m')
			timeAttr: 'data-m', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.

			async: true, // When true, some operations are delayed by a timeout.
			player: null
		}, options);

		// Probably want some flags...
		this.ready = false;
		this.enabled = false;
		this.selectable = false;

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.src) {
			this.load();
		}
	}

	Transcript.prototype = {
		load: function(transcript) {
			var self = this,
				$transcript = $(this.options.transcript);

			// Could just take in a fresh set of options... Enabling other changes
			if(transcript) {
				if(transcript.src) {
					this.options.src = transcript.src;
				}
				if(transcript.video) {
					this.options.video = transcript.video;
				}
			}

			if($transcript.length) {
				$transcript.empty().load(this.options.src, function(response, status, xhr) {
					if(status === 'error') {
						self._error(xhr.status + ' ' + xhr.statusText + ' : "' + self.options.src + '"');
					} else {
						self._trigger(self.event.load, {msg: 'Loaded "' + self.options.src + '"'});
						if(self.options.async) {
							setTimeout(function() {
								self.setVideo();
							}, 0);
						} else {
							self.setVideo();
						}
					}
				});
			} else {
				this._error('Target not found : ' + this.options.transcript);
			}
		},

		setVideo: function(video) {
			var self = this;
			if(video) {
				this.options.video = video;
			}
			if(this.options.player) {
				this.options.player.load(this.options.video);
				if(this.options.async) {
					setTimeout(function() {
						self.parse();
					}, 0);
				} else {
					this.parse();
				}
			} else {
				this._error('Player not defined');
			}
		},

		parse: function() {
			var self = this,
				opts = this.options;

			this.popcorn = Popcorn("#source-video");

			if(opts.player && opts.player.popcorn) {

				$(opts.transcript + ' ' + opts.word).each(function() {  
					opts.player.popcorn.transcript({
						time: $(this).attr(opts.timeAttr) * opts.unit, // seconds
						futureClass: "transcript-grey",
						target: this,
						onNewPara: function(parent) {
							// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
						}
					});
				});

				$(opts.transcript).on('click', 'a', function(e) {
					var tAttr = $(this).attr(opts.timeAttr),
						time = tAttr * opts.unit;
					opts.player.currentTime(time);
				});
			}

			// TMP - will need to destroy and redo the WordSelect and DragDrop system when transcript changes.
			//  if(!this.selectable) {
				this.selectorize();
			// }
		},

		// OK, I made up this word - selectorize
		selectorize: function() {

			var self = this,
				opts = this.options,
				$stage = $(opts.stage),
				dropped = function(el) {

					$stage.removeClass('dragdrop');
/*
					// add edit action
					var actions = el.querySelector('.actions');
					actions._tap = new APP.Tap(actions);
					actions.addEventListener('tap', APP.editBlock, false);
*/
					el._dragInstance = new DragDrop(el, opts.stage, {
						onDragStart: function () {
							$stage.addClass('dragdrop');
							el.style.display = 'none';
							// actions._tap.destroy();
						},
						onDrop: dropped
					});
				},
				textSelect = new WordSelect(opts.transcript, {
					// addHelpers: true,
					onDragStart: function(e) {
						$stage.addClass('dragdrop');
						var dragdrop = new DragDrop(null, opts.stage, {
							init: false,
							onDrop: function(el) {
								textSelect.clearSelection();
								this.destroy();
								dropped(el);
							}
						});

						// var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
						var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, ''); // + '<div class="actions"></div>';
						dragdrop.init(html, e);
					}
				});

			this.selectable = true; // TMP - seem to have to apply this script again in some way, but will look at that later/next.

			// Need a destroy system for the WordSelect and DragDrop for when we change transcript.
		},

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Transcript;
}(jQuery, Popcorn));


hyperaudio.register('Player', Player);
hyperaudio.register('Transcript', Transcript);


hyperaudio.utility('DragDrop', DragDrop);
hyperaudio.utility('WordSelect', WordSelect);


	return hyperaudio;
}(window, document));
