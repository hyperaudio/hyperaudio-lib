/* Transcript
 *
 */

var Transcript = (function($) {

	var DEBUG = true;

	function Transcript(options) {

		this.options = {
			target: '#transcript', // The selector of element where the transcript is written to.
			src: '', // The source URL of the transcript.
			group: 'p', // Element type used to group paragraphs.
			element: 'a', // Element type used per word.
			attribute: 'm', // Attribute name that holds the timing information.
			unit: 0.001 // Milliseconds.
		};

		for(var i in options) {
			if(options.hasOwnProperty(i)) {
				this.options[i] = options[i];
			}
		}

		if(options.src) {
			this.load();
		}
	}

	Transcript.prototype = {
		load: function(src) {
			var self = this,
				$target = $(this.options.target);
			if(src) {
				this.options.src = src;
			}
			if($target.length) {
				$target.empty().load(this.options.src, function(response, status, xhr) {
					if(status === 'error') {
						self.error(xhr.status + ' ' + xhr.statusText);
					} else {
						// Sweet
					}
				});
			} else {
				this.error('target not found');
			}
		},
		parse: function() {
			//
		},
		save: function() {
			// Doubt we save transcripts from here.
		},
		error: function(msg) {
			console.log('Transcript Error: ' + msg);
		}
	};

	return Transcript;
}(jQuery));
