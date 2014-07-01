/* Clipboard
 *
 */

var Clipboard = (function(hyperaudio) {

	// Following the method used by Trello
	// http://stackoverflow.com/questions/17527870/how-does-trello-access-the-users-clipboard

	return {
		init: function(options) {
			var self = this;

			this.options = hyperaudio.extend({
				target: 'body',
				id_container: 'clipboard-container',
				id_clipboard: 'clipboard',
				target: 'body',
			}, options);

			// Properties
			this.value = '';
			this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;

			if(this.target) {
				this.container = document.createElement('div');
				this.container.setAttribute('id', this.options.id_container);
				this.target.appendChild(this.container);
			}

			document.documentElement.addEventListener('keydown', function(event) {
				self.onKeyDown(event);
			}, false);

			document.documentElement.addEventListener('keyup', function(event) {
				self.onKeyUp(event);
			}, false);
		},
		copy: function(value) {
			this.value = value;
		},
		clear: function() {
			this.value = '';
		},
		onKeyDown: function(event) {
			if(!this.value || !(event.ctrlKey || event.metaKey)) {
				return;
			}

			hyperaudio.empty(this.container);
			this.container.style.display = 'block';

			this.clipboard = document.createElement('textarea');
			this.clipboard.setAttribute('id', this.options.id_clipboard);
			this.clipboard.value = this.value;
			this.container.appendChild(this.clipboard);
			this.clipboard.focus();
			this.clipboard.select();
		},
		onKeyUp: function(event) {
			if(event.target === this.clipboard) {
				hyperaudio.empty(this.container);
				this.container.style.display = 'none';
			}
		}
	};

}(hyperaudio));
