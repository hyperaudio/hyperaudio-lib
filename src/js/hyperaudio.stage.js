/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		var self = this;

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			id: '', // The ID of the saved mix.
			mix: {
				//title, desc, type, editable
				// url: [!content] The url of the mix
				// content: [!url] The actual mix HTML
			},

			title: 'Title not set',
			desc: 'Description not set',
			type: 'beta',

			idAttr: 'data-id', // Attribute name that holds the transcript ID.
			transAttr: 'data-trans', // Attribute name that holds the transcript URL. [optional if ID not present]
			mp4Attr: 'data-mp4', // Attribute name that holds the transcript mp4 URL.
			webmAttr: 'data-webm', // Attribute name that holds the transcript webm URL.
			ytAttr: 'data-yt', // Attribute name that holds the transcript youtube URL.
			unitAttr: 'data-unit', // Attribute name that holds the transcript Unit.

			word: 'a',
			section: 'section',
			// timeAttr: 'data-m', // Attribute name that holds the timing information.

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

		// The following lines assume that we found a target.

		this.target.appendChild(this.article);

		// Detect when an effect value is changed
		this.target.addEventListener('change', function(e) {
			self.changed();
		}, false);

		// this.target._tap = new Tap({el: this.target});
		// this.target.addEventListener('tap', function(event) {
		this.target.addEventListener('click', function(event) {
			var section, word, search;
			// event.preventDefault(); // Removed since it breaks checkbox clicks in effects.
			if(event.target.nodeName.toLowerCase() === self.options.word) {
				word = event.target;
				search = word;

				// Search up the parent tree for the section.
				while(search) {
					if(search.nodeName.toLowerCase() === self.options.section) {
						section = search;
						break; // exit while loop
					}
					search = search.parentNode;
				}

				if(self.options.projector) {
					self.options.projector.playWord(section,word);
				}
			}
		}, false);

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.projector) {
			this.options.projector.setStage(this);
		}

		if(this.options.id || this.options.mix.url || this.options.mix.content) {
			this.load();
		}
	}

	Stage.prototype = {
		mixDetails: function(details) {
			// [SHOULD] only really used to set the label, desc and type of the mix being saved.
			hyperaudio.extend(this.options, details);
		},
		updateStage: function(content) {
			// Need to maintain the existing article in the stage - Important for dragdrop.
			var tmp = document.createElement('div'); // Temporary DOM element
			tmp.innerHTML = content; // Add the content to the DOM element
			var articleElem = tmp.querySelector('article'); // Find the article in the content.
			// Can now insert the contents of the returned mix article into the maintained article.
			this.article.innerHTML = articleElem.innerHTML;

			// TODO: Should also clear any existing attributes on the article.

			// Now copy over any attributes
			var attr = articleElem.attributes;
			for(var i=0, l=attr.length; i < l; i++ ) {
				this.article.setAttribute(attr[i].name, attr[i].value);
			}
		},
		load: function(id) {
			var self = this;

			if(typeof id !== 'undefined') {
				if(typeof id === 'string') {
					this.options.id = id;
					this.options.mix = {};
				} else if(typeof id === 'object') {
					this.options.id = '';
					this.options.mix = id;
				} else {
					this.options.id = '';
					this.options.mix = {};
				}
			}

			if(this.target) {

				if(this.options.id) {

					hyperaudio.api.getMix(id, function(success) {
						if(success) {
							self.mix = hyperaudio.extend({}, this.mix);
							self.mixDetails({
								title: self.mix.label,
								desc: self.mix.desc,
								type: self.mix.type
							});
							self.updateStage(self.mix.content);

							// Setup the dragdrop on the loaded mix sections.
							self.initDragDrop();
							self._trigger(hyperaudio.event.load, {msg: 'Loaded mix'});
						} else {
							self._error(this.status + ' ' + this.statusText + ' : "' + id + '"');
						}
					});
				} else {
					this.mixDetails({
						title: this.options.mix.title,
						desc: this.options.mix.desc,
						type: this.options.mix.type
					});
					if(this.options.mix.url) {
						hyperaudio.xhr({
							url: this.options.mix.url,
							complete: function(event) {
								self.updateStage(this.responseText);
								if(self.options.mix.editable) {
									self.initDragDrop();
								} else {
									self.changed();
								}
								self._trigger(hyperaudio.event.load, {msg: 'Loaded "' + self.options.mix.url + '"'});
							},
							error: function(event) {
								self.target.innerHTML = 'Problem with mix URL.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
								self._error(this.status + ' ' + this.statusText + ' : "' + self.options.mix.url + '"');
							}
						});
					} else if(this.options.mix.content) {
						this.updateStage(this.options.mix.content);
						if(this.options.mix.editable) {
							this.initDragDrop();
						} else {
							this.changed();
						}
						this._trigger(hyperaudio.event.load, {msg: 'Loaded given content'});
					} else {
						this.target.innerHTML = 'Problem with mix.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
						this._error('Stage : No ID, URL or Content');
					}
				}
			}
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
							self._trigger(hyperaudio.event.unauthenticated, {msg: 'Sign In required to save'});
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
			this.changed(true);
		},

		parse: function() {
			var self = this,
				opts = this.options;

			// Will need the popcorn.transcript highlighting as per the source transcripts.
		},

		initDragDrop: function() {
			var self = this,
				i, l, sections, effectType, bgmTitle, dragHtml;

			var capitaliseFirstLetter = function(string) {
				return string.charAt(0).toUpperCase() + string.slice(1);
			};

			if(this.target) {
				sections = this.target.getElementsByTagName('section');
				l = sections.length;
				for(i=0; i < l; i++) {

					dragHtml = '';

					// This code is to setup the drag-and-drop with a nice label. Otherwise the effects look bad after loading back in and dragged
					effectType = sections[i].getAttribute('data-effect');
					if(typeof effectType === 'string') {
						switch(effectType) {
							case 'fade':
							case 'trim':
							case 'title':
								dragHtml = capitaliseFirstLetter(effectType);
								break;
							case 'bgm':
								bgmTitleElem = sections[i].querySelector('.icon-music');
								if(bgmTitleElem) {
									dragHtml = bgmTitleElem.parentNode.innerHTML;
								} else {
									dragHtml = '<span class="icon-music">BGM</span>';
								}
								break;
						}
					}

					// And we finally setup the DragDrop
					self.dropped(sections[i], dragHtml);
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
				// hyperaudio.removeClass(this.target, this.options.dragdropClass);

				// add edit action if needed
				if ( !(/(^|\s)effect($|\s)/.test(el.className)) ) {
					actions = el.querySelector('.actions');
					if(actions) {
						actions._tap = new Tap({el: actions});
						actions.addEventListener('tap', editBlock, false);
					}
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
						self.changed();
					}
				});

				this.changed();
			}
		},

		changed: function(reset) {
			// Tell the projector the content changed
			if(this.options.projector) {
				this.options.projector.requestUpdate(reset);
			}
			this._trigger(hyperaudio.event.change, {msg: 'The mix has changed'});
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
