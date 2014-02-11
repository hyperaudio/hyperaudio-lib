/* Transcript
 *
 */

var Transcript = (function(document, hyperaudio) {

	function Transcript(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'TRANSCRIPT', // Not really an option... More like a manifest

			target: '#transcript', // The selector of element where the transcript is written to.

			id: '', // The ID of the transcript.

			// src: '', // [obsolete] The URL of the transcript.
			// video: '', // [obsolete] The URL of the video.

			media: {
				// transcript, mp4, webm urls
			},

			select: true, // Enables selection of the transcript

			wordsPlay: true, // Enables word clicks forcing play

			group: 'p', // Element type used to group paragraphs.
			word: 'a', // Element type used per word.

			timeAttr: 'data-m', // Attribute name that holds the timing information.
			unit: 0.001, // Milliseconds.

			async: true, // When true, some operations are delayed by a timeout.

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
		if(this.options.id || this.options.media.youtube || this.options.media.mp4) {
			this.load();
		}
	}

	Transcript.prototype = {

		load: function(id) {
			var self = this;

			this.ready = false;

			if(typeof id !== 'undefined') {
				if(typeof id === 'string') {
					this.options.id = id;
					this.options.media = {};
				} else if(typeof id === 'object') {
					this.options.id = '';
					this.options.media = id;
				} else {
					this.options.id = '';
					this.options.media = {};
				}
			}

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

				if(this.options.id) {
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

				} else if(this.options.media.transcript) {
					hyperaudio.xhr({
						url: this.options.media.transcript,
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
				}
			}
		},

		setVideo: function() {
			var self = this;

			// Setup the player
			if(this.options.player) {

				if(this.options.id && hyperaudio.api.transcript) {

/*
					var hapi = hyperaudio.api,
						path = hapi.options.api + hapi.transcript.media.owner + '/' + hapi.transcript.media.meta.filename;

					// TMP - Have two types of media definition in the API during its dev.
					// In final API, the URLs will be given explicitly - similar to the 1st clause.

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
*/

					var media = hyperaudio.api.transcript.media;

					this.options.media = {
						id: media ? media._id : '' // Store the media ID
					};

					if(media && media.source) {
						for(var type in media.source) {
							this.options.media[type] = media.source[type].url;
						}
					}
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
						if(opts.wordsPlay) {
							opts.player.play(time);
						} else {
							opts.player.currentTime(time);
						}
						self._trigger(hyperaudio.event.userplayword, {msg: 'User clicked on a word to play from'});
					}
				}, false);
			}

			this.selectorize();
		},

		selectorize: function() {

			var self = this,
				opts = this.options;

			// if(opts.stage) {
			if(opts.select) {

				// Destroy any existing WordSelect.
				this.deselectorize();

				this.textSelect = new hyperaudio.WordSelect({
					el: opts.target,
					onDragStart: function(e) {
						if(opts.stage) {
							hyperaudio.addClass(opts.stage.target, opts.stage.options.dragdropClass);
							var dragdrop = new hyperaudio.DragDrop({
								dropArea: opts.stage.target,
								init: false,
								onDrop: function(el) {
									hyperaudio.removeClass(opts.stage.target, opts.stage.options.dragdropClass);
									this.destroy();

									if ( !el ) {
										return;
									}

									// Only clear the selection if dropped on the stage. Otherwise it can be annoying.
									self.textSelect.clearSelection();

									if(opts.media.id) {
										el.setAttribute(opts.stage.options.idAttr, opts.media.id); // Pass the media ID
									}
									if(opts.media.transcript) {
										el.setAttribute(opts.stage.options.transAttr, opts.media.transcript); // Pass the transcript url
									}
									if(opts.media.mp4) {
										el.setAttribute(opts.stage.options.mp4Attr, opts.media.mp4); // Pass the transcript mp4 url
										el.setAttribute(opts.stage.options.webmAttr, opts.media.webm); // Pass the transcript webm url
									}
									if(opts.media.youtube) {
										el.setAttribute(opts.stage.options.ytAttr, opts.media.youtube); // Pass the transcript youtube url
									}
									el.setAttribute(opts.stage.options.unitAttr, opts.unit); // Pass the transcript Unit
									opts.stage.dropped(el);
								}
							});

							var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
							dragdrop.init(html, e);
						}
					}
				});
				this.ready = true;
				this._trigger(hyperaudio.event.ready, {msg: 'Transcript is ready.'});
			}
		},

		deselectorize: function() {
			if(this.textSelect) {
				this.textSelect.destroy();
			}
			delete this.textSelect;
		},

		getSelection: function() {
			if(this.textSelect) {
				var opts = this.options,
					html = this.textSelect.getSelection(),
					el = document.createElement('div'),
					words, start, end;

				el.innerHTML = html;
				words = el.querySelectorAll(opts.word);

				if(words.length) {
					start = words[0].getAttribute(opts.timeAttr);
					end = words[words.length - 1].getAttribute(opts.timeAttr);
				}

				// The end time is the start of the last word, so needs padding.
				return {
					text: el.textContent,
					start: start,
					end: end
				};
			}
			return {};
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
