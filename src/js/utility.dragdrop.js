var DragDrop = (function (window, document, hyperaudio) {

	function DragDrop (options) {

		this.options = {
			handle: null,
			dropArea: null,

			init: true,
			touch: true,
			mouse: true,
			timeout: 500,
			html: '',
			draggableClass: '',
			containerTag: 'article',
			blockTag: 'section'
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.dropArea = typeof this.options.dropArea == 'string' ? document.querySelector(this.options.dropArea) : this.options.dropArea;

		// Create the list and the placeholder
		this.list = this.dropArea.querySelector(this.options.containerTag);
		if ( !this.list ) {
			this.list = document.createElement(this.options.containerTag);
			this.dropArea.appendChild(this.list);
		}
		this.placeholder = document.createElement(this.options.blockTag);
		this.placeholder.className = 'placeholder';

		if ( this.options.init ) {
			this.handle = typeof this.options.handle == 'string' ? document.querySelector(this.options.handle) : this.options.handle;
			this.handleClassName = this.handle.className;

			// Are we reordering the list?
			this.reordering = this.handle.parentNode == this.list;

			if ( this.options.touch ) {
				this.handle.addEventListener('touchstart', this, false);
			}

			if ( this.options.mouse ) {
				this.handle.addEventListener('mousedown', this, false);
			}
		}
	}

	DragDrop.prototype.handleEvent = function (e) {
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

	DragDrop.prototype.start = function (e) {
		var point = e.touches ? e.touches[0] : e,
			target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		if ( /INPUT/.test(target.tagName) ) {
			return;
		}

		e.preventDefault();

		if ( this.options.touch ) {
			document.addEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			document.addEventListener('mouseup', this, false);
		}

		clearTimeout(this.dragTimeout);
		this.initiated = false;
		this.lastTarget = null;

		this.dragTimeout = setTimeout(this.init.bind(this, this.options.html || this.handle.innerHTML, e), this.options.timeout);
	};

	DragDrop.prototype.init = function (html, e) {
		if ( !this.options.init ) {
			if ( this.options.touch ) {
				document.addEventListener('touchend', this, false);
			}

			if ( this.options.mouse ) {
				document.addEventListener('mouseup', this, false);
			}
		}

		// Create draggable
		this.draggable = document.createElement('div');
		this.draggable.className = 'draggable' + ' ' + this.options.draggableClass;
		this.draggableStyle = this.draggable.style;
		this.draggableStyle.cssText = 'position:absolute;z-index:1000;pointer-events:none;left:-99999px';
		this.draggable.innerHTML = html;

		document.body.appendChild(this.draggable);

		this.draggableCenterX = Math.round(this.draggable.offsetWidth / 2);
		this.draggableCenterY = Math.round(this.draggable.offsetHeight / 2);

		this.position(e);

		if ( this.options.touch ) {
			document.addEventListener('touchmove', this, false);
		}

		if ( this.options.mouse ) {
			document.addEventListener('mousemove', this, false);
		}

		this.initiated = true;

		// If we are reordering the list, hide the current element
		if ( this.reordering ) {
			this.handle.style.display = 'none';
		}

		this.move(e);

		if ( this.options.onDragStart ) {
			this.options.onDragStart.call(this);
		}
	};

	DragDrop.prototype.position = function (e) {
		var point = e.changedTouches ? e.changedTouches[0] : e;

		this.draggableStyle.left = point.pageX - this.draggableCenterX + 'px';
		this.draggableStyle.top = point.pageY - this.draggableCenterY + 'px';
	};

	DragDrop.prototype.move = function (e) {
		e.preventDefault();
		e.stopPropagation();

		var point = e.changedTouches ? e.changedTouches[0] : e;
		var target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		this.position(e);

		if ( target == this.lastTarget || target == this.placeholder || target == this.list ) {
			return;
		}

		this.lastTarget = target;

		if ( target == this.dropArea ) {
			this.list.appendChild(this.placeholder);
			return;
		}

		if ( hyperaudio.hasClass(target, 'item') ) {
			var items = this.list.querySelectorAll('.item'),
				i = 0, l = items.length;

			for ( ; i < l; i++ ) {
				if ( target == items[i] ) {
					this.list.insertBefore(this.placeholder, items[i]);
					break;
				}
			}

			return;
		}

		if ( this.list.querySelector('.placeholder') ) {
			this.placeholder.parentNode.removeChild(this.placeholder);
		}
	};

	DragDrop.prototype.end = function (e) {
		clearTimeout(this.dragTimeout);

		document.removeEventListener('touchend', this, false);
		document.removeEventListener('mouseup', this, false);

		if ( !this.initiated ) {
			return;
		}

		document.removeEventListener('touchmove', this, false);
		document.removeEventListener('mousemove', this, false);

		var point = e.changedTouches ? e.changedTouches[0] : e;
		var target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		var html = this.options.html ? this.handle.innerHTML : this.draggable.innerHTML;
		this.draggable.parentNode.removeChild(this.draggable);
		this.draggable = null;

		// we dropped outside of the draggable area
		if ( !this.list.querySelector('.placeholder') ) {

			if ( this.reordering ) {
				this.handle.parentNode.removeChild(this.handle);
			}

			if ( this.options.onDrop ) {
				this.options.onDrop.call(this, null);
			}

			return;
		}

		var el;

		// if we are reordering, reuse the original element
		if ( this.reordering ) {
			el = this.handle;
			this.handle.style.display = '';
		} else {
			el = document.createElement(this.options.blockTag);
			el.className = this.handleClassName || 'item';
			el.innerHTML = html;
		}

		this.list.insertBefore(el, this.placeholder);
		this.placeholder.parentNode.removeChild(this.placeholder);

		if ( this.options.onDrop ) {
			this.options.onDrop.call(this, el);
		}
	};

	DragDrop.prototype.destroy = function () {
		document.removeEventListener('touchstart', this, false);
		document.removeEventListener('touchmove', this, false);
		document.removeEventListener('touchend', this, false);

		document.removeEventListener('mousedown', this, false);
		document.removeEventListener('mousemove', this, false);
		document.removeEventListener('mouseup', this, false);
	};

	return DragDrop;
})(window, document, hyperaudio);