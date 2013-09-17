/* Transcript
 *
 */

var Transcript = (function($) {

	var DEBUG = true;

	function Transcript(options) {
		var self = this;

		this.options = $.extend({
			target: '#transcript', // The selector of element where the transcript is written to.
			src: '', // The source URL of the transcript.
			group: 'p', // Element type used to group paragraphs.
			element: 'a', // Element type used per word.
			attribute: 'm', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		this.event = {
			load: 'ha:load',
			error: 'ha:error'
		};

		if(DEBUG) {
			this._debug();
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
						self._error(xhr.status + ' ' + xhr.statusText + ' : ' + self.options.src);
					} else {
						self._trigger(self.event.load, {msg: 'Transcript Loaded : ' + self.options.src});
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
				this._error('target not found : ' + this.options.target);
			}
		},
		parse: function() {
			// The prototype would have called initSourcePopcorn() here, among a ton of other things.
		},

		// Plan to put these into a common object and then simple inheritence by adding to prototype.
		_trigger: function(eventType, eventData) {
			var eventObject = $.extend({options: this.options}, eventData),
				event = $.Event(eventType, {ha: eventObject});
			$(this).trigger(event);
		},
		_error: function(msg) {
			var data = {msg: 'Transcript Error : ' + msg};
			this._trigger(this.event.error, data);
		},
		_debug: function() {
			var self = this;
			$.each(this.event, function(eventName, eventType) {
				$(self).on(eventType, function(event) {
					console.log(eventType + ' : ' + event.ha.msg);
				});
			});
		}
	};

	return Transcript;
}(jQuery));
