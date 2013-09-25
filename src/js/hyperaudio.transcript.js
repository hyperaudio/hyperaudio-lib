/* Transcript
 *
 */

var Transcript = (function($, Popcorn) {

	function Transcript(options) {

		this.options = $.extend({}, this.options, {

			entity: 'TRANSCRIPT', // Not really an option... More like a manifest

			transcript: '#transcript', // The selector of element where the transcript is written to.
			stage: '#stage',

			src: '', // The URL of the transcript.
			video: '', // The URL of the video.

			group: 'p', // Element type used to group paragraphs.
			word: 'a', // Element type used per word.
			timeAttr: 'm', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.

			async: true, // When true, some operations are delayed by a timeout.
			player: null
		}, options);

		// Probably want some flags...
		this.ready = false;
		this.enabled = false;
		this.selectable = false;

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.src) {
			this.load();
		}
	}

	Transcript.prototype = {
		load: function(transcript) {
			var self = this,
				$transcript = $(this.options.transcript);

			// Could just take in a fresh set of options... Enabling other changes
			if(transcript) {
				if(transcript.src) {
					this.options.src = transcript.src;
				}
				if(transcript.video) {
					this.options.video = transcript.video;
				}
			}

			if($transcript.length) {
				$transcript.empty().load(this.options.src, function(response, status, xhr) {
					if(status === 'error') {
						self._error(xhr.status + ' ' + xhr.statusText + ' : "' + self.options.src + '"');
					} else {
						self._trigger(self.event.load, {msg: 'Loaded "' + self.options.src + '"'});
						if(self.options.async) {
							setTimeout(function() {
								self.setVideo();
							}, 0);
						} else {
							self.setVideo();
						}
					}
				});
			} else {
				this._error('Target not found : ' + this.options.transcript);
			}
		},

		setVideo: function(video) {
			var self = this;
			if(video) {
				this.options.video = video;
			}
			if(this.options.player) {
				this.options.player.load(this.options.video);
				if(this.options.async) {
					setTimeout(function() {
						self.parse();
					}, 0);
				} else {
					this.parse();
				}
			} else {
				this._error('Player not defined');
			}
		},

		parse: function() {
			var self = this,
				opts = this.options;

			this.popcorn = Popcorn("#source-video");

			if(opts.player && opts.player.popcorn) {

				$(opts.transcript + ' ' + opts.word).each(function() {  
					opts.player.popcorn.transcript({
						time: $(this).attr(opts.timeAttr) * opts.unit, // seconds
						futureClass: "transcript-grey",
						target: this,
						onNewPara: function(parent) {
							// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
						}
					});
				});

				$(opts.transcript).on('click', 'a', function(e) {
					var tAttr = $(this).attr(opts.timeAttr),
						time = tAttr * opts.unit;
					opts.player.currentTime(time);
				});
			}

			if(!this.selectable) {
				this.selecterize();
			}
		},

		selecterize: function() {
			var self = this,
				opts = this.options;

			this.selectable = true;

			this.stage = "WIP";

			this.textSelect = new WordSelect(opts.transcript, {
				addHelpers: true,
				onDragStart: function(e) {
					// self.stage.className = 'dragdrop';
					var dragdrop = new DragDrop(null, opts.stage, {
						init: false,
						onDrop: function(el) {
							self.textSelect.clearSelection();
							this.destroy();
							// APP.dropped(el);
						}
					});

					var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
					dragdrop.init(html, e);
				}
			});
		},

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Transcript;
}(jQuery, Popcorn));
