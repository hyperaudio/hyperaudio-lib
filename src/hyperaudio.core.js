var hyperaudio = (function($) {

	var common = {
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

	return {
		register: function(name, module) {
			if(typeof name === 'string') {
				if(typeof module === 'function') {
					module.prototype = $.extend({}, common, module.prototype);
					this[name] = function(options) {
						return new module(options);
					};
				} else if (typeof module === 'object') {
					module = $.extend({}, common, module);
					this[name] = module;
				}
			}
		}
	}
}(jQuery));
