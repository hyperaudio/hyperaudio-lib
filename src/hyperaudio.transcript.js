/* Transcript
 *
 */

var Transcript = (function($, Popcorn) {

	function Transcript(options) {

		this.options = $.extend({}, this.options, {

			entity: 'TRANSCRIPT', // Not really an option... More like a manifest

			target: '#transcript', // The selector of element where the transcript is written to.
			src: '', // The source URL of the transcript.
			group: 'p', // Element type used to group paragraphs.
			word: 'a', // Element type used per word.
			timeAttr: 'm', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.src) {
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
						self._error(xhr.status + ' ' + xhr.statusText + ' : "' + self.options.src + '"');
					} else {
						self._trigger(self.event.load, {msg: 'Loaded "' + self.options.src + '"'});
						if(self.options.async) {
							setTimeout(function() {
								self.parse();
							}, 0);
						} else {
							self.parse();
						}
					}
				});
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},

		// Rough code in here...
		parse: function() {
			var self = this;

			this.popcorn = Popcorn("#source-video");

			$(this.options.target + ' ' + this.options.word).each(function() {  
				self.popcorn.transcript({
					time: $(this).attr(self.options.timeAttr) * self.options.unit, // seconds
					futureClass: "transcript-grey",
					target: this,
					onNewPara: function(parent) {
						// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
					}
				});
			});

			$(this.options.target).on('click', 'a', function(e) {
				var tAttr = $(this).attr(self.options.timeAttr),
					time = tAttr * self.options.unit;
				self.popcorn.currentTime(time);
			});
		}
	};

	return Transcript;
}(jQuery, Popcorn));
