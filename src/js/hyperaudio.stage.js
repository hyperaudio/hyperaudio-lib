/* Stage
 *
 */

var Stage = (function($, Popcorn) {

	function Stage(options) {

		this.options = $.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			src: '', // The URL of the saved production.

			async: true, // When true, some operations are delayed by a timeout.
			player: null
		}, options);

		// Probably want some flags...
		this.ready = false;
		this.enabled = false;

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.src) {
			this.load();
		}
	}

	Stage.prototype = {
		load: function(src) {
			var self = this,
				$target = $(this.options.target);

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

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Transcript;
}(jQuery, Popcorn));
