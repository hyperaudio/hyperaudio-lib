/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.
			dragdropClass: 'dragdrop',

			src: '', // The URL of the saved production.

			idAttr: 'data-id', // Attribute name that holds the transcript ID.

			async: true, // When true, some operations are delayed by a timeout.
			player: null
		}, options);

		// State Flags.
		this.ready = false;
		this.enabled = true;

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.reDragdrop = new RegExp('\\s*'+this.options.dragdropClass, 'gi');

		if(this.options.DEBUG) {
			this._debug();
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
				// Setup item for future dragdrop 
				el._dragInstance = new DragDrop(el, this.target, {
					html: el.innerHTML
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
