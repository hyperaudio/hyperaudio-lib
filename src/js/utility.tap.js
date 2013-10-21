var Tap = (function (window, document, hyperaudio) {

	function Tap (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		this.el.addEventListener('touchstart', this, false);
		this.el.addEventListener('mousedown', this, false);
	}

	Tap.prototype = {
		handleEvent: function (e) {
			// jshint -W086
			switch (e.type) {
				case 'mousedown':
					if ( e.which !== 1 ) {
						break;
					}
				case 'touchstart':
					this._start(e);
					break;
				case 'touchmove':
				case 'mousemove':
					this._move(e);
					break;
				case 'touchend':
				case 'mouseup':
				case 'touchcancel':
				case 'mousecancel':
					this._end(e);
					break;
			}
			// jshint +W086
		},

		_start: function (e) {
			if ( e.touches && e.touches.length > 1 ) return;

			var point = e.touches ? e.touches[0] : e;
			
			this.moved = false;
			this.startX = point.pageX;
			this.startY = point.pageY;
			this.target = e.target;

			hyperaudio.addClass(this.target, 'tapPressed');

			this.el.addEventListener('touchmove', this, false);
			this.el.addEventListener('touchend', this, false);
			this.el.addEventListener('touchcancel', this, false);
			this.el.addEventListener('mousemove', this, false);
			this.el.addEventListener('mouseup', this, false);
			this.el.addEventListener('mousecancel', this, false);
		},

		_move: function (e) {
			var point = e.changedTouches ? e.changedTouches[0] : e,
				x = point.pageX,
				y = point.pageY;

			if ( Math.abs( x - this.startX ) > 10 || Math.abs( y - this.startY ) > 10 ) {
				hyperaudio.removeClass(this.target, 'tapPressed');
				this.moved = true;
			}
		},

		_end: function (e) {
			hyperaudio.removeClass(this.target, 'tapPressed');

			if ( !this.moved ) {
				var ev = document.createEvent('Event'),
					point = e.changedTouches ? e.changedTouches[0] : e;

				ev.initEvent('tap', true, true);
				ev.pageX = point.pageX;
				ev.pageY = point.pageY;
				this.target.dispatchEvent(ev);
			}

			this.el.removeEventListener('touchmove', this, false);
			this.el.removeEventListener('touchend', this, false);
			this.el.removeEventListener('touchcancel', this, false);
			this.el.removeEventListener('mousemove', this, false);
			this.el.removeEventListener('mouseup', this, false);
			this.el.removeEventListener('mousecancel', this, false);
		},
		
		destroy: function () {
			this.el.removeEventListener('touchstart', this, false);
			this.el.removeEventListener('touchmove', this, false);
			this.el.removeEventListener('touchend', this, false);
			this.el.removeEventListener('touchcancel', this, false);
			this.el.removeEventListener('mousedown', this, false);
			this.el.removeEventListener('mousemove', this, false);
			this.el.removeEventListener('mouseup', this, false);
			this.el.removeEventListener('mousecancel', this, false);
		}
	};
	
	return Tap;
})(window, document, hyperaudio);