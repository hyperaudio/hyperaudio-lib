/* xhr
 *
 */

var xhr = (function(hyperaudio) {

	return function(options) {

		options = hyperaudio.extend({
			url: '',
			data: '', // Only valid for POST types
			type: 'GET',
			responseType: '',
			async: true,
			cache: true

			// complete: function()
			// error: function()
		}, options);

		var xhr = new XMLHttpRequest();

		if(!options.cache) {
			options.url = options.url + ((/\?/).test(options.url) ? "&" : "?") + (new Date()).getTime();
		}

		xhr.open(options.type, options.url, options.async);
		xhr.responseType = options.responseType;

		xhr.addEventListener('load', function(event) {
			if(this.status === 200) {
				if(typeof options.complete === 'function') {
					options.complete.call(this, event);
				}
			} else {
				if(typeof options.error === 'function') {
					options.error.call(this, event);
				}
			}
		}, false);

		if(typeof options.error === 'function') {
			xhr.addEventListener('error', function(event) {
				options.error.call(this, event);
			}, false);
		}

		xhr.send(options.data);

		return xhr;
	};

}(hyperaudio));
