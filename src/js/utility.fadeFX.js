var fadeFX = (function (window, document) {
	var _elementStyle = document.createElement('div').style;

	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransition';
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
	var transform = _prefixStyle('transform');

	_elementStyle = null; // free mem ???

	var fxInstance;

	function fade (options) {
		if ( !fxInstance ) {
			var opt = {
				time: 2000,
				color: '#000000',
				autostart: true,
				crossFade: true,
				autoplay: true
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			video = document.querySelector('#stage-videos .active');
			fxInstance = new TransitionFade(video, opt);
		}

		return fxInstance;
	}

	function TransitionFade (video, options) {
		this.options = options;

		this.video = video;
		this.videoIncoming = document.getElementById('stage-video-' + (video.id == 'stage-video-1' ? '2' : '1'));

		this.servo = document.getElementById('fxHelper');

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.left = '0px';
		this.servo.style.opacity = '0';
		this.servo.style.backgroundColor = this.options.color;
//		this.servo.style.left = '-9999px';

		if ( this.options.autostart ) {
			this.start();
		}
	}

	TransitionFade.prototype.handleEvent = function (e) {
		switch ( e.type ) {
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this.transitionEnd(e);
				break;
//			case 'canplay':
		}
	};

	TransitionFade.prototype.start = function () {
		this.phase = 'fadeOut';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		var trick = this.servo.offsetHeight;	// force refresh. Mandatory on FF

		this.servo.style[transition] = 'opacity ' + this.options.time + 'ms';

		var that = this;
		setTimeout(function () {
			that.servo.style.opacity = '1';
		}, 0);
	};

	TransitionFade.prototype.transitionEnd = function (e) {
		e.stopPropagation();

		this.servo.removeEventListener('transitionend', this, false);
		this.servo.removeEventListener('webkitTransitionEnd', this, false);
		this.servo.removeEventListener('oTransitionEnd', this, false);
		this.servo.removeEventListener('MSTransitionEnd', this, false);

		this.video.pause();

		if ( this.phase == 'fadeOut' ) {
			if ( this.options.onFadeOutEnd ) {
				this.options.onFadeOutEnd.call(this);
			}

			if ( this.options.crossFade ) {
				this.phase = 'waiting';
				this.video.className = this.video.className.replace(/(^|\s)active($|\s)/, '');
				this.videoIncoming.className += ' active';
				this.fadeIn();
			}
		} else if ( this.phase == 'fadeIn' ) {
			if ( this.options.onFadeInEnd ) {
				this.options.onFadeInEnd.call(this);
			}

			this.destroy();
		}
	};

	TransitionFade.prototype.fadeIn = function () {
		this.phase = 'fadeIn';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		if ( this.options.autoplay ) {
			this.videoIncoming.play();
		}

		this.servo.style.opacity = '0';
	};

	TransitionFade.prototype.destroy = function () {
		this.servo.removeEventListener('transitionend', this, false);
		this.servo.removeEventListener('webkitTransitionEnd', this, false);
		this.servo.removeEventListener('oTransitionEnd', this, false);
		this.servo.removeEventListener('MSTransitionEnd', this, false);

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.opacity = '0';
		this.servo.style.left = '-9999px';

		fxInstance = null;
	};

	return fade;
})(window, document);