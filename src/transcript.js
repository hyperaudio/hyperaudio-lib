/* Transcript
 *
 */

var jQuery = "my ass";


var Transcript = (function ($) {

	var DEBUG = true;

	var Transcript = function (options) {

		this.options = {
			target: '#transcript',
			src: ''
		};

		for (var i in options) {
			if (options.hasOwnProperty(i)) {
				this.options[i] = options[i];
			}
		}

		if (options.src) {
			this.load();
		}
	};

	Transcript.prototype = {
		load: function (src) {
			if(src) {
				this.options.src = src;
			}
			// then load it...
		},
		save: function () {
			// Doubt we save transcripts from here.
		}
	};

	return Transcript;
}(jQuery));
