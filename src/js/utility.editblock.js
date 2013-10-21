var EditBlock = (function (document) {

	function EditBlock (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;
		this.words = this.el.querySelectorAll('a');

		this.el.className += ' edit';
		this.el._tap = new Tap({el: this.el});
		this.el.addEventListener('tap', this, false);

		document.addEventListener('touchend', this, false);
		document.addEventListener('mouseup', this, false);
	}

	EditBlock.prototype.handleEvent = function (e) {
		switch (e.type) {
			case 'touchend':
			case 'mouseup':
				this.cancel(e);
				break;
			case 'tap':
				this.edit(e);
				break;
		}
	};

	EditBlock.prototype.cancel = function (e) {
		var target = e.target;

		if ( target == this.el || target.parentNode == this.el || target.parentNode.parentNode == this.el ) {
			return;
		}

		this.destroy();
	};

	EditBlock.prototype.edit = function (e) {
		e.stopPropagation();

		var theCut = e.target;
		var cutPointReached;
		var wordCount = this.words.length;

		if ( theCut.tagName != 'A' || theCut == this.words[wordCount-1] ) {
			return;
		}

		// Create a new block
		var newBlock = document.createElement('section');
		var newParagraph, prevContainer;

		newBlock.className = 'item';

		for ( var i = 0; i < wordCount; i++ ) {
			if ( this.words[i].parentNode != prevContainer ) {
				if ( newParagraph && cutPointReached && newParagraph.querySelector('a') ) {
					newBlock.appendChild(newParagraph);
				}

				newParagraph = document.createElement('p');
				prevContainer = this.words[i].parentNode;
			}

			if ( cutPointReached ) {
				newParagraph.appendChild(this.words[i]);

				if ( !prevContainer.querySelector('a') ) {
					prevContainer.parentNode.removeChild(prevContainer);
				}
			}

			if ( !cutPointReached && this.words[i] == theCut ) {
				cutPointReached = true;
			}
		}

		newBlock.appendChild(newParagraph);

		var action = document.createElement('div');
		action.className = 'actions';
		newBlock.appendChild(action);

		this.el.parentNode.insertBefore(newBlock, this.el.nextSibling);
		this.el.handleHTML = this.el.innerHTML;

		APP.dropped(newBlock);

		this.destroy();
	};

	EditBlock.prototype.destroy = function () {
		// Remove edit status
		this.el.className = this.el.className.replace(/(^|\s)edit(\s|$)/g, ' ');

		document.removeEventListener('touchend', this, false);
		document.removeEventListener('mouseup', this, false);

		this.el.removeEventListener('tap', this, false);
		this.el._editBlock = null;

		this.el._tap.destroy();
		this.el._tap = null;
	};

	return EditBlock;
})(document);