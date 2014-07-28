/* Clipboard
 *
 */

var Clipboard = (function(hyperaudio) {

	// Following the method used by Trello
	// http://stackoverflow.com/questions/17527870/how-does-trello-access-the-users-clipboard

	var DEBUG = true;

	return {
		init: function(options) {
			var self = this;

			this.options = hyperaudio.extend({
				target: 'body',
				id_container: 'clipboard-container',
				id_clipboard: 'clipboard'
			}, options);

			// Properties
			this.value = '';
			this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;

			if(this.target) {
				this.container = document.createElement('div');
				this.container.setAttribute('id', this.options.id_container);
				this.container.style.display = 'none';
				this.target.appendChild(this.container);
			}

			// See if security allowed via same domain policy.
			var rights = true;
			try {
				window.top.document.createElement('div');
			} catch(error) {
				rights = false;
			}

			if(rights) {
				// Handlers for top frame
				window.top.document.documentElement.addEventListener('keydown', function(event) {
					self.onKeyDown(event);
				}, false);
				window.top.document.documentElement.addEventListener('keyup', function(event) {
					self.onKeyUp(event);
				}, false);
			}

			// Handlers for this window
			document.documentElement.addEventListener('keydown', function(event) {
				self.onKeyDown(event);
			}, false);
			document.documentElement.addEventListener('keyup', function(event) {
				self.onKeyUp(event);
			}, false);

			this.enable();
		},
		enable: function(enabled) {
			enabled = enabled === 'undefined' ? true : !!enabled;
			this.enabled = enabled;
		},
		disable: function(disable) {
			this.enable(!disable);
		},
		copy: function(value) {
			this.value = value;
		},
		clear: function() {
			this.value = '';
		},
		onKeyDown: function(event) {

			if(DEBUG) console.log('[onKeyDown] : Key pressed');

			if(!this.enabled || !this.value || !(event.ctrlKey || event.metaKey)) {
				if(DEBUG) console.log('[onKeyDown] : Exit | enabled = ' + this.enabled + ' | value = "' + this.value + '"');
				return;
			}

			// Used the activeElement code from jPlayer.

			var pageFocus = document.activeElement;
			var keyIgnoreElementNames = "A INPUT TEXTAREA SELECT BUTTON";
			var ignoreKey = false;

			if(typeof pageFocus !== 'undefined') {
				if(pageFocus !== null && pageFocus.nodeName.toUpperCase() !== "BODY") {
					ignoreKey = true;
					if(DEBUG) console.log('[onKeyDown] : Exit | pageFocus = %o' + pageFocus);
				}
			} else {
				// Fallback for no document.activeElement support.
				hyperaudio.each( keyIgnoreElementNames.split(/\s+/g), function(i, name) {
					// The strings should already be uppercase.
					if(event.target.nodeName.toUpperCase() === name.toUpperCase()) {
						ignoreKey = true;
						if(DEBUG) console.log('[onKeyDown] : Exit | nodeName = ' + name);
						return false; // exit each.
					}
				});
			}

			if(ignoreKey) {
				return;
			}

			if(DEBUG) console.log('[onKeyDown] : Textarea prepared for copy | value = "' + this.value + '"');

			// If we get this far, prepare the textarea ready for the copy.

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
			if(DEBUG) console.log('[onKeyUp] : Key released');
			if(event.target === this.clipboard) {
				hyperaudio.empty(this.container);
				this.container.style.display = 'none';
			}
		}
	};

}(hyperaudio));
