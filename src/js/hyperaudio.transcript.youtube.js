/* Transcript
 * YouTube HACK
 */

var Transcript = (function(document, hyperaudio) {

	function Transcript(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'TRANSCRIPT', // Not really an option... More like a manifest

			target: '#transcript', // The selector of element where the transcript is written to.

			id: '', // The ID of the transcript.

			// src: '', // [obsolete] The URL of the transcript.
			// video: '', // [obsolete] The URL of the video.

			media: {},

			group: 'p', // Element type used to group paragraphs.
			word: 'a', // Element type used per word.

			timeAttr: 'data-m', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.

			async: false, // true, // When true, some operations are delayed by a timeout.

			stage: null,
			player: null
		}, options);

		// State Flags
		this.ready = false;
		this.enabled = true;

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.textSelect = null;

		// Setup Debug
		if(this.options.DEBUG) {
			this._debug();
		}

		// If we have the info, kick things off
		if(this.options.id) {
			this.load();
		}
	}

	Transcript.prototype = {
		// load: function(transcript) {
		load: function(id) {
			var self = this;

			this.ready = false;

			if(id) {
				this.options.id = id;
			}
/*
			if(transcript) {
				if(transcript.src) {
					this.options.src = transcript.src;
				}
				if(transcript.video) {
					this.options.video = transcript.video;
				}
			}
*/
			var setVideo = function() {
				if(self.options.async) {
					setTimeout(function() {
						self.setVideo();
					}, 0);
				} else {
					self.setVideo();
				}
			};

			if(this.target) {
				this.target.innerHTML = '';

				hyperaudio.api.getTranscript(this.options.id, function(success) {
					if(success) {
						self.target.innerHTML = this.transcript.content;
						self._trigger(hyperaudio.event.load, {msg: 'Loaded "' + self.options.id + '"'});
					} else {
						self.target.innerHTML = 'Problem with transcript URL.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
						self._error(this.status + ' ' + this.statusText + ' : "' + self.options.id + '"');
					}
					setVideo();
				});
/*
				xhr({
					url: this.options.src,
					complete: function(event) {
						self.target.innerHTML = this.responseText;
						self._trigger(hyperaudio.event.load, {msg: 'Loaded "' + self.options.src + '"'});
						setVideo();
					},
					error: function(event) {
						self.target.innerHTML = 'Problem with transcript URL.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
						self._error(this.status + ' ' + this.statusText + ' : "' + self.options.src + '"');
						setVideo();
					}
				});
*/
			}
		},

		setVideo: function() {
			var self = this;

			// Setup the player
			if(this.options.player && hyperaudio.api.transcript) {
				var hapi = hyperaudio.api,
					path = hapi.options.api + hapi.transcript.media.owner + '/' + hapi.transcript.media.meta.filename;

				if(hapi.transcript.media.meta.media) {
					this.options.media = {
						youtube: hapi.transcript.media.meta.media.youtube.url,
						mp4: hapi.transcript.media.meta.media.mp4.url,
						webm: hapi.transcript.media.meta.media.webm.url
					};
				} else {
					this.options.media = {
						mp4: path,
						webm: path.replace(/\.mp4$/, '.webm') // Huge assumption!
					};
				}

				this.options.player.load(this.options.media);
				if(this.options.async) {
					setTimeout(function() {
						self.parse();
					}, 0);
				} else {
					this.parse();
				}
			} else {
				this._error('Player not defined');
				this.selectorize();
			}
		},

		parse: function() {
			var self = this,
				opts = this.options;

			if(this.target && opts.player && opts.player.popcorn) {

				var wordList = this.target.querySelectorAll(opts.target + ' ' + opts.word),
					i, l = wordList.length;

				var onNewPara = function(parent) {
					// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
				};

				for(i = 0; i < l; i++) {
					opts.player.popcorn.transcript({
						time: wordList[i].getAttribute(opts.timeAttr) * opts.unit, // seconds
						futureClass: "transcript-grey",
						target: wordList[i],
						onNewPara: onNewPara
					});
				}

				this.target.addEventListener('click', function(event) {
					event.preventDefault();
					if(event.target.nodeName.toLowerCase() === opts.word) {
						var tAttr = event.target.getAttribute(opts.timeAttr),
							time = tAttr * opts.unit;
						opts.player.currentTime(time);
					}
				}, false);
			}

			opts.player.play(12);

			this.selectorize();
		},

		selectorize: function() {

			var self = this,
				opts = this.options;

			if(opts.stage) {

				// Destroy any existing WordSelect.
				this.deselectorize();

				this.textSelect = new WordSelect({
					el: opts.target,
					onDragStart: function(e) {
						hyperaudio.addClass(opts.stage.target, opts.stage.options.dragdropClass);
						var dragdrop = new DragDrop({
							dropArea: opts.stage.target,
							init: false,
							onDrop: function(el) {
								self.textSelect.clearSelection();
								this.destroy();

								if ( !el ) {
									return;
								}

								el.setAttribute(opts.stage.options.idAttr, opts.id); // Pass the transcript ID
								el.setAttribute(opts.stage.options.mp4Attr, opts.media.mp4); // Pass the transcript mp4 url
								el.setAttribute(opts.stage.options.webmAttr, opts.media.webm); // Pass the transcript webm url
								el.setAttribute(opts.stage.options.unitAttr, opts.unit); // Pass the transcript Unit
								opts.stage.dropped(el);
							}
						});

						var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
						dragdrop.init(html, e);
					}
				});
				this.ready = true;
				this._trigger(hyperaudio.event.ready);
			}
		},

		deselectorize: function() {
			if(this.textSelect) {
				this.textSelect.destroy();
			}
			delete this.textSelect;
		},

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Transcript;
}(document, hyperaudio));
