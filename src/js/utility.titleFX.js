var titleFX = (function (window, document) {
	var _elementStyle = document.createElement('div').style;

	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransform';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	var transition = _prefixStyle('transition');
	var transitionDuration = _prefixStyle('transitionDuration');
	var transform = _prefixStyle('transform');

	_elementStyle = null; // free mem ???

	var fxInstance;

	function title (options) {
		if ( !fxInstance ) {
			var opt = {
				el: null,
				text: '',
				speed: 600,
				duration: 3000,
				background: 'rgba(0,0,0,0.8)',
				color: '#ffffff'
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			fxInstance = new TitleEffect(opt);
		}

		return fxInstance;
	}

	function TitleEffect (options) {
		this.options = options;

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		this.el.innerHTML = this.options.text;
		this.el.style.backgroundColor = this.options.background;
		this.el.style.color = this.options.color;
		this.el.style.left = '0px';
		this.el.style[transform] = 'translate(0, 100%) translateZ(0)';

		this.el.addEventListener('transitionend', this, false);
		this.el.addEventListener('webkitTransitionEnd', this, false);
		this.el.addEventListener('oTransitionEnd', this, false);
		this.el.addEventListener('MSTransitionEnd', this, false);

		this.start();
	}

	TitleEffect.prototype.handleEvent = function (e) {
		switch ( e.type ) {
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this.transitionEnd(e);
				break;
		}
	};

	TitleEffect.prototype.start = function () {
		this.phase = 'start';

		var trick = this.el.offsetHeight;	// force refresh. Mandatory on FF
		this.el.style[transitionDuration] = this.options.speed + 'ms';

		var that = this;
		setTimeout(function () {
			that.el.style[transform] = 'translate(0, 0) translateZ(0)';
		}, 0);
	};

	TitleEffect.prototype.transitionEnd = function (e) {
		e.stopPropagation();

		if ( this.phase == 'start' ) {
			this.phase = 'waiting';
			this.timeout = setTimeout(this.end.bind(this), this.options.duration);
			return;
		}

		if ( this.options.onEnd ) {
			this.options.onEnd.call(this);
		}

		this.destroy();
	};

	TitleEffect.prototype.end = function () {
		this.phase = 'end';
		this.el.style[transform] = 'translate(0, 100%) translateZ(0)';
	};

	TitleEffect.prototype.destroy = function () {
		clearTimeout(this.timeout);

		this.el.removeEventListener('transitionend', this, false);
		this.el.removeEventListener('webkitTransitionEnd', this, false);
		this.el.removeEventListener('oTransitionEnd', this, false);
		this.el.removeEventListener('MSTransitionEnd', this, false);

		this.el.style[transitionDuration] = '0s';
		this.el.style.left = '-9999px';

		fxInstance = null;
	};

	return title;
})(window, document);