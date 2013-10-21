/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			src: '', // [Obsolete] The URL of the saved production.

			// api: 'https://data.hyperaud.io/', // The URL of the API
			api: 'api/', // TMP - The URL of the API

			idAttr: 'data-id', // Attribute name that holds the transcript ID.
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

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.projector) {
			this.options.projector.setStage(this);
		}

		if(this.options.src) {
			this.load();
		}
	}

	Stage.prototype = {
		load: function(src) {
			var self = this;

			if(src) {
				this.options.src = src;
			}

			// Would then load in the saved production from the API

			// Would then need to init the dragdrop ability on each item
		},

		save: function() {
			// Save the staged production

			// PUT to update, POST to create.
			// PUT/POST to /user/mixes/ with {label: "", content ""}

			// var user = hyperaudio.user.getUser(), // WIP
			var self = this,
				user = 'mp', // TMP
				label = 'Not Yet Defined',
				url = this.options.api + user + '/mixes/';

			// Check we have at least 1 section
			if(this.target && (this.target.getElementsByTagName('section')).length) {

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
			}
		},

		parse: function() {
			var self = this,
				opts = this.options;

			// Will need the popcorn.transcript highlighting as per the source transcripts.
		},

		_dropped: function(el, html) {
			var self = this;

			if(this.target) {
				hyperaudio.removeClass(this.target, this.options.dragdropClass);

				// Setup item for future dragdrop 
				el._dragInstance = new DragDrop({
					handle: el,
					dropArea: this.target,
					html: el.innerHTML,
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
