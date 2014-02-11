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

		this.status = {
			paused: true,
			currentTime: 0,
			duration: 0
		};

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
		// this.player.videoElem.addEventListener('timeupdate', this.timeUpdate.bind(this), false);

		// FULLSCREEN Button
		if ( this.options.fullscreen ) {
			this.fullscreenButton = document.createElement('li');
			this.fullscreenButton.className = cssClass + '-fullscreen';
			this.controlsElem.appendChild(this.fullscreenButton);

			this.fullscreenButton.addEventListener('click', this.fullscreen.bind(this), false);

			buttonCount += 1;
		}

		// The time displays
		this.currentTimeElem = document.createElement('div');
		this.currentTimeElem.className = cssClass + '-current-time';
		this.durationElem = document.createElement('div');
		this.durationElem.className = cssClass + '-duration';
		this.progressBarElem.appendChild(this.currentTimeElem);
		this.progressBarElem.appendChild(this.durationElem);

		// Adjust sizes according to options
		this.progressBarElem.style.width = 100 - buttonCount*10 + '%';

		// No longer required since fixing fullscreen using: .hyperaudio-player-bar { position: relative; }
		// Now these are set to 100% width in the CSS.
		// this.currentTimeElem.style.width = 100 - buttonCount*10 + '%';
		// this.durationElem.style.width = 100 - buttonCount*10 + '%';

		// Add the GUI
		hyperaudio.addClass(this.player.target, cssClass);
		this.player.target.appendChild(this.wrapperElem);
	}

	PlayerGUI.prototype = {

		setStatus: function(status) {
			// Extending, since the new status might not hold all values.
			hyperaudio.extend(this.status, status);

			// console.log('paused:' + this.status.paused + ' | currentTime:' + this.status.currentTime + ' | duration:' + this.status.duration);

			this.timeUpdate();
			// could also update the play pause button?
			// - the playing to paused state is covered by timeUpdate()
		},

		play: function () {
			// if ( !this.player.videoElem.paused ) {
			if ( !this.status.paused ) {
				hyperaudio.removeClass(this.wrapperElem, 'playing');
				this.player.gui_pause();
				return;
			}

			hyperaudio.addClass(this.wrapperElem, 'playing');
			this.player.gui_play();
		},

		timeUpdate: function () {

			var percentage = 0;
			if(this.status.duration > 0) {
				percentage = Math.round(100 * this.status.currentTime / this.status.duration);	
			}

			this.progressIndicator.style.width = percentage + '%';

			this.currentTimeElem.innerHTML = time(this.status.currentTime);
			this.durationElem.innerHTML = time(this.status.duration);

			if ( this.status.paused ) {
				hyperaudio.removeClass(this.wrapperElem, 'playing');
			} else {
				hyperaudio.addClass(this.wrapperElem, 'playing');
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
			
			// var current = Math.round(this.player.videoElem.duration / width * x);
			// this.player.currentTime(current, !this.player.videoElem.paused);

			// var current = Math.round(this.status.duration / width * x);
			var current = Math.round(100 * this.status.duration * x / width) / 100;
			this.player.gui_currentTime(current);
		}
	};

	// Adapted this from jPlayer code
	function ConvertTime() {
		this.init();
	}
	ConvertTime.prototype = {
		init: function() {
			this.options = {
				timeFormat: {
					showHour: false,
					showMin: true,
					showSec: true,
					padHour: false,
					padMin: true,
					padSec: true,
					sepHour: ":",
					sepMin: ":",
					sepSec: ""
				}
			};
		},
		time: function(s) {
			s = (s && typeof s === 'number') ? s : 0;

			var myTime = new Date(s * 1000),
				hour = myTime.getUTCHours(),
				min = this.options.timeFormat.showHour ? myTime.getUTCMinutes() : myTime.getUTCMinutes() + hour * 60,
				sec = this.options.timeFormat.showMin ? myTime.getUTCSeconds() : myTime.getUTCSeconds() + min * 60,
				strHour = (this.options.timeFormat.padHour && hour < 10) ? "0" + hour : hour,
				strMin = (this.options.timeFormat.padMin && min < 10) ? "0" + min : min,
				strSec = (this.options.timeFormat.padSec && sec < 10) ? "0" + sec : sec,
				strTime = "";

			strTime += this.options.timeFormat.showHour ? strHour + this.options.timeFormat.sepHour : "";
			strTime += this.options.timeFormat.showMin ? strMin + this.options.timeFormat.sepMin : "";
			strTime += this.options.timeFormat.showSec ? strSec + this.options.timeFormat.sepSec : "";

			return strTime;
		}
	};
	var myConvertTime = new ConvertTime();
	function time(s) {
		return myConvertTime.time(s);
	}

	return PlayerGUI;

})(window, document, hyperaudio);
