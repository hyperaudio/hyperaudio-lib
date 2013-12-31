/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			id: '', // The ID of the saved mix.

			title: 'Title not set',
			desc: 'Description not set',
			type: 'beta',

			idAttr: 'data-id', // Attribute name that holds the transcript ID.
			transAttr: 'data-trans', // Attribute name that holds the transcript URL. [optional if ID not present]
			mp4Attr: 'data-mp4', // Attribute name that holds the transcript mp4 URL.
			webmAttr: 'data-webm', // Attribute name that holds the transcript webm URL.
			ytAttr: 'data-yt', // Attribute name that holds the transcript youtube URL.
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
			// [SHOULD] only really used to set the label, desc and type of the mix being saved.
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
						self.mixDetails({
							title: self.mix.label,
							desc: self.mix.desc,
							type: self.mix.type
						});

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
						self._error(this.status + ' ' + this.statusText + ' : "' + id + '"');
					}
				});
			}
			// Would then need to init the dragdrop ability on each item
		},

		save: function(callback) {
			// Save the staged production

			var self = this;

			hyperaudio.extend(this.mix, {
				label: this.options.title,
				desc: this.options.desc,
				type: this.options.type,
				content: this.target.innerHTML
			});

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				// hyperaudio.api.guest = false;
				// hyperaudio.api.username = 'tester';

				hyperaudio.api.putMix(this.mix, function(success) {
					if(success) {
						if(success.saved) {
							self.mix = hyperaudio.extend({}, this.mix);
							self._trigger(hyperaudio.event.save, {msg: 'Saved mix'});
						} else if(success.needLogin) {
							// We need to login
						} else {
							self._error('Stage: Save: Error with API putMix() response');
						}
					} else {
						self._error('Stage: Save: Error with API putMix() request');
					}
					self.callback(callback, success);
				});
			}
		},

		callback: function(callback, success) {
			if(typeof callback === 'function') {
				callback.call(this, success);
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
			var actions;
			var draggableClass = '';

			var editBlock = function (e) {
				e.stopPropagation();
				this.parentNode._editBlock = new EditBlock({
					el: this.parentNode,
					stage: self
				});
			};

			if(this.target) {
				hyperaudio.removeClass(this.target, this.options.dragdropClass);

				// add edit action if needed
				if ( !(/(^|\s)effect($|\s)/.test(el.className)) ) {
					actions = el.querySelector('.actions');
					actions._tap = new Tap({el: actions});
					actions.addEventListener('tap', editBlock, false);
				} else {
					draggableClass = 'draggableEffect';
				}

				// Setup item for future dragdrop 
				el._dragInstance = new DragDrop({
					handle: el,
					dropArea: this.target,
					html: html ? html : el.innerHTML,
					draggableClass: draggableClass,
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
