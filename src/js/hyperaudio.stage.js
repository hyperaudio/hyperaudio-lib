/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			src: '', // The URL of the saved production.

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

			// Not sure how  the API works... Are we saving the HTML (easy) or translating it to json.
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
