var hyperaudio = (function($) {

	return {
		core: {
			options: {
				DEBUG: true,
				entity: 'core'
			},
			event: {
				ready: 'ha:ready',
				load: 'ha:load',
				error: 'ha:error'
			},
			_trigger: function(eventType, eventData) {
				var eventObject = $.extend({options: this.options}, eventData),
					event = $.Event(eventType, {ha: eventObject});
				$(this).trigger(event);
			},
			_error: function(msg) {
				var data = {msg: this.options.entity + ' Error : ' + msg};
				this._trigger(this.event.error, data);
			},
			_debug: function() {
				var self = this;
				$.each(this.event, function(eventName, eventType) {
					$(self).on(eventType, function(event) {
						console.log(self.options.entity + ' triggered "' + eventType + '" event : ' + event.ha.msg);
					});
				});
			}
		},
		register: function(name, module) {
			if(typeof name === 'string') {
				if(typeof module === 'function') {
					module.prototype = $.extend({}, this.core, module.prototype);
					this[name] = function(options) {
						return new module(options);
					};
				} else if(typeof module === 'object') {
					module = $.extend({}, this.core, module);
					this[name] = module;
				}
			}
		},
		utility: function(name, utility) {
			if(typeof name === 'string') {
				this[name] = utility;
			}
		}
	};
}(jQuery));
