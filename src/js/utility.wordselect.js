var WordSelect = (function (window, document, hyperaudio) {

	// used just in dev environment
	function addTagHelpers (el) {
		var text = (el.innerText || el.textContent).split(' ');

		el.innerHTML = '<a>' + text.join(' </a><a>') + '</a>';
	}

	function WordSelect (options) {

		this.options = {
			el: null,
			addHelpers: false,
			touch: true,
			mouse: true,
			threshold: 10
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.element = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		if ( this.options.addHelpers ) {
			addTagHelpers(this.element);
		}

		this.words = this.element.querySelectorAll('a');
		this.wordsCount = this.words.length;

		if ( this.options.touch ) {
			this.element.addEventListener('touchstart', this, false);
		}

		if ( this.options.mouse ) {
			this.element.addEventListener('mousedown', this, false);
		}
	}

	WordSelect.prototype.handleEvent = function (e) {
		// jshint -W086
		switch (e.type) {
			case 'mousedown':
				if ( e.which !== 1 ) {
					break;
				}
			case 'touchstart':
				this.start(e);
				break;
			case 'touchmove':
			case 'mousemove':
				this.move(e);
				break;
			case 'touchend':
			case 'mouseup':
				this.end(e);
				break;
		}
		// jshint +W086
	};

	WordSelect.prototype.start = function (e) {
		e.preventDefault();

		var point = e.touches ? e.touches[0] : e;

		this.selectStarted = false;
		this.startX = e.pageX;
		this.startY = e.pageY;

		if ( this.options.mouse ) {
			this.element.addEventListener('mousemove', this, false);
			window.addEventListener('mouseup', this, false);
		}

		if ( this.options.touch ) {
			this.element.addEventListener('touchmove', this, false);
			window.addEventListener('touchend', this, false);
		}

		if ( hyperaudio.hasClass(e.target, 'selected') ) {
			this.dragTimeout = setTimeout(this.dragStart.bind(this, e), 500);
		}
	};

	WordSelect.prototype.selectStart = function (e) {
		var target = e.target,
			tmp;

		if ( target == this.element || target.tagName != 'A' ) {
			return;
		}

		this.selectStarted = true;

		this.currentWord = target;

		hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

		if ( this.words[this.startPosition] === target ) {
			tmp = this.startPosition;
			this.startPosition = this.endPosition;
			this.endPosition = tmp;
			return;
		}

		if ( this.words[this.endPosition] === target ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				this.startPosition = i;
			}

			hyperaudio.removeClass(this.words[i], 'selected');
		}

		this.endPosition = this.startPosition;

		hyperaudio.addClass(target, 'selected');
	};

	WordSelect.prototype.move = function (e) {
		var point = e.changedTouches ? e.changedTouches[0] : e,
			target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target,
			endPosition;

		if ( Math.abs(point.pageX - this.startX) < this.options.threshold &&
			Math.abs(point.pageY - this.startY) < this.options.threshold ) {
			return;
		}

		clearTimeout(this.dragTimeout);

		if ( !this.selectStarted ) {
			this.selectStart(e);
			return;
		}

		if ( target.tagName == 'P' ) {
			target = target.querySelector('a:last-child');
		}

		if ( target == this.element || target == this.currentWord || target.tagName != 'A' ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				endPosition = i;
			}

			if ( ( endPosition === undefined && i >= this.startPosition ) ||
				( endPosition !== undefined && i <= this.startPosition ) ||
				endPosition == i ) {
				hyperaudio.addClass(this.words[i], 'selected');
			} else {
				hyperaudio.removeClass(this.words[i], 'selected');
			}
		}

		this.currentWord = target;
		this.endPosition = endPosition;
	};

	WordSelect.prototype.end = function (e) {
		clearTimeout(this.dragTimeout);

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		if ( !this.selectStarted ) {
			if ( e.target == this.element ) {
				this.clearSelection();
			}

			return;
		}

		var start = Math.min(this.startPosition, this.endPosition),
			end = Math.max(this.startPosition, this.endPosition);

		hyperaudio.addClass(this.words[start], 'first');
		hyperaudio.addClass(this.words[end], 'last');
	};

	WordSelect.prototype.clearSelection = function () {
		this.currentWord = null;
		this.startPosition = null;
		this.endPosition = null;

		hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		var selected = this.element.querySelectorAll('.selected');
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			hyperaudio.removeClass(selected[i], 'selected');
		}
	};

	WordSelect.prototype.getSelection = function () {
		var selected = this.element.querySelectorAll('.selected');
		var prevParent;
		var html = '';
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			if ( selected[i].parentNode !== prevParent ) {
				prevParent = selected[i].parentNode;
				html += ( i === 0 ? '<p>' : '</p><p>' );
			}
			html += selected[i].outerHTML.replace(/ class="[\d\w\s\-]*\s?"/gi, ' ');
		}

		if ( html ) {
			html += '</p>';
		}

		return html;
	};

	WordSelect.prototype.dragStart = function (e) {
		e.stopPropagation();

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		var point = e.changedTouches ? e.changedTouches[0] : e;

		if ( this.options.onDragStart ) {
			this.options.onDragStart.call(this, e);
		}
	};

	WordSelect.prototype.destroy = function () {
		this.element.removeEventListener('touchstart', this, false);
		this.element.removeEventListener('touchmove', this, false);
		this.element.removeEventListener('touchend', this, false);

		this.element.removeEventListener('mousedown', this, false);
		this.element.removeEventListener('mousemove', this, false);
		this.element.removeEventListener('mouseup', this, false);
	};

	return WordSelect;

})(window, document, hyperaudio);