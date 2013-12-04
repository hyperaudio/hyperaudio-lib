/**
 *
 * Player GUI
 *
 */

var PlayerGUI = (function (window, document, hyperaudio) {

	function PlayerGUI (options) {
		this.options = hyperaudio.extend({}, {
			player:			null,	// mandatory instance to the player

			navigation:		true,	// whether or not to display the next/prev buttons
			fullscreen:		true,	// display the fullscreen button

			cssClass: 'hyperaudio-player' // Class added to the target for the GUI CSS. (should move to GUI)
		}, options);

		if ( !this.options.player ) {
			return false;
		}

		this.player = this.options.player;

		var buttonCount = 1;

		var cssClass = this.options.cssClass; // For mini opto

		this.wrapperElem = document.createElement('div');
		this.wrapperElem.className = cssClass + '-gui';
		this.controlsElem = document.createElement('ul');
		this.controlsElem.className = cssClass + '-controls';

		this.wrapperElem.appendChild(this.controlsElem);

		// PLAY button
		this.playButton = document.createElement('li');
		this.playButton.className = cssClass + '-play';
		this.controlsElem.appendChild(this.playButton);
		this.playButton.addEventListener('click', this.play.bind(this), false);

		// PREV/NEXT buttons
		if ( this.options.navigation ) {
			this.prevButton = document.createElement('li');
			this.prevButton.className = cssClass + '-prev';
			this.nextButton = document.createElement('li');
			this.nextButton.className = cssClass + '-next';

			this.controlsElem.appendChild(this.prevButton);
			this.controlsElem.appendChild(this.nextButton);

			//this.prevButton.addEventListener('click', this.prev.bind(this), false);
			//this.nextButton.addEventListener('click', this.next.bind(this), false);
			buttonCount += 2;
		}

		// PROGRESS BAR
		this.progressBarElem = document.createElement('li');
		this.progressBarElem.className = cssClass + '-bar';
		this.progressIndicator = document.createElement('div');
		this.progressIndicator.className = cssClass + '-progress';
		this.progressIndicator.style.width = '0%';

		this.progressBarElem.appendChild(this.progressIndicator);
		this.controlsElem.appendChild(this.progressBarElem);

		this.progressBarElem.addEventListener('mousedown', this.startSeeking.bind(this), false);
		this.progressBarElem.addEventListener('mousemove', this.seek.bind(this), false);
		document.addEventListener('mouseup', this.stopSeeking.bind(this), false);
		this.player.videoElem.addEventListener('timeupdate', this.timeUpdate.bind(this), false);

		// FULLSCREEN Button
		if ( this.options.fullscreen ) {
			this.fullscreenButton = document.createElement('li');
			this.fullscreenButton.className = cssClass + '-fullscreen';
			this.controlsElem.appendChild(this.fullscreenButton);

			this.fullscreenButton.addEventListener('click', this.fullscreen.bind(this), false);

			buttonCount += 1;
		}

		this.progressBarElem.style.width = 100 - buttonCount*10 + '%';

		hyperaudio.addClass(this.player.target, cssClass);
		this.player.target.appendChild(this.wrapperElem);
	}

	PlayerGUI.prototype = {
		play: function () {
			if ( !this.player.videoElem.paused ) {
				hyperaudio.removeClass(this.wrapperElem, 'playing');
				this.player.pause();
				return;
			}

			this.player.play();
			hyperaudio.addClass(this.wrapperElem, 'playing');
		},

		timeUpdate: function () {
			var video = this.player.videoElem;
			var percentage = Math.round(100 * video.currentTime / video.duration);

			this.progressIndicator.style.width = percentage + '%';
			
			if ( this.player.videoElem.paused ) {
				hyperaudio.removeClass(this.wrapperElem, 'playing');
			}
		},

		fullscreen: function () {
			if ( !this._isFullscreen() ) {
				this._requestFullScreen();
				return;
			}

			this._cancelFullScreen();
		},

		_requestFullScreen: function () {
			if (this.player.target.requestFullScreen) {
				this.player.target.requestFullScreen();
			} else if (this.player.target.mozRequestFullScreen) {
				this.player.target.mozRequestFullScreen();
			} else if (this.player.target.webkitRequestFullScreen) {
				this.player.target.webkitRequestFullScreen();
			}
		},

		_cancelFullScreen: function () {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			} else if (document.webkitCancelFullScreen) {
				document.webkitCancelFullScreen();	
			}
		},

		_isFullscreen: function () {
			return !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.msFullscreenElement || false);
		},

		startSeeking: function (e) {
			this.seeking = true;
			this.seek(e);
		},

		stopSeeking: function () {
			if ( !this.seeking ) {
				return;
			}

			this.seeking = false;
		},

		seek: function (e) {
			if ( !this.seeking ) {
				return;
			}

			var rect = this.progressBarElem.getBoundingClientRect();
			var width = rect.width;
			var x = e.pageX - rect.left;
			
			var current = Math.round(this.player.videoElem.duration / width * x);
			this.player.currentTime(current, !this.player.videoElem.paused);
		}
	};

	return PlayerGUI;

})(window, document, hyperaudio);
