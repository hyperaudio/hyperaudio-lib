/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			id: '', // The ID of the saved mix.

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
		load: function(id) {
			var self = this;

			if(id) {
				this.options.id = id;
			}

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				hyperaudio.api.guest = false;
				hyperaudio.api.username = 'tester';

				hyperaudio.api.getMix(id, function(success) {
					if(success) {
						self.mix = hyperaudio.extend({}, this.mix);
						var tmp = document.createElement('div');
						tmp.innerHTML = self.mix.content;
						var articleElem = tmp.querySelector('article');
						self.article.innerHTML = articleElem.innerHTML;
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
				label: "Test from hyperaudio.stage.js",
				desc: "Testing initial save system",
				meta: {},
				sort: 999,
				type: "funky",
				content: this.target.innerHTML
			});

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				hyperaudio.api.guest = false;
				hyperaudio.api.username = 'tester';

				hyperaudio.api.putMix(this.mix, function(success) {
					if(success) {
						self.mix = hyperaudio.extend({}, this.mix);
						self._trigger(hyperaudio.event.save, {msg: 'Saved mix'});
					} else {
						self._error(this.status + ' ' + this.statusText + ' : "' + url + '"');
					}
				});
/*
				xhr({
					url: url,
					type: 'POST',
					data: 'json=' + JSON.stringify({
						label: label,
						content: this.target.innerHTML
					}),
					complete: function(event) {
						self._trigger(hyperaudio.event.save, {msg: 'Saved mix'});
					},
					error: function(event) {
						self._error(this.status + ' ' + this.statusText + ' : "' + url + '"');
					}
				});
*/
			}
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
