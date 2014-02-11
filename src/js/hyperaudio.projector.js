/* Projector
 * Used to play the staged productions
 */

var Projector = (function(window, document, hyperaudio, Popcorn) {

	function Projector(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PROJECTOR', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			trim: 1, // (Seconds) Time added to end word timings.

			players: 2, // Number of Players to use. Mobile: 1, Desktop: 2.

			unit: 0.001, // Unit used if not given in section attr of stage.

			stageChangeDelay: 1000, // (ms) Delay for content update after the stage is changed

			timeAttr: 'data-m',

			music: null, // For the BGM

			gui: true, // True to add a gui.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.stage = null;
		this.timeout = {};

		this.player = [];

		this.activePlayer = 0;
		this.nextPlayer = this.options.players > 1 ? 1 : 0;

		this.updateRequired = false;

		this.stageArticle = null;
		this.stageSections = null;
		this.stageIndex = 0; // [Number] The next section
		this.content = []; // [Array] Holding the sections found with content
		this.contentIndex = 0; // [Number] The content that is actually being played.
		this.firstContent = true; // [Boolean] True the first time
		this.endedContent = false; // [Boolean] True when we have no more content

		this.isReadyToPlay = false; // [Boolean] True is the projector is setup and only needs a play to resume.
		this.needsInitVideo = true; // [Boolean] True when the projector is empty and the first video should be loaded in.

		// State Flags
		this.paused = true;

		this.time = {};

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.target) {
			this.create();
		}
	}

	Projector.prototype = {
		setStage: function(stage) {
			this.stage = stage;
		},
		create: function() {
			var self = this;

			if(this.target) {

				var getManager = function(idx) {

					return function(event) {
						// Passing the event context to manager
						//  * The YouTube event object is useless.
						//  * The YouTube event context was fixed in the Player class.
						if(self.activePlayer === idx) {
							self.manager(this, event);
						}
					};
				};

				for(var i = 0; i < this.options.players; i++ ) {

					var manager = getManager(i);

					var player = document.createElement('div');
					hyperaudio.addClass(player, 'hyperaudio-projector');
					this.player[i] = hyperaudio.Player({
						target: player
					});

					this.player[i].addEventListener('progress', manager); // Important for YT player GUI to update on set/change
					this.player[i].addEventListener('timeupdate', manager);
					this.player[i].addEventListener('play', manager);
					this.player[i].addEventListener('pause', manager);
					this.player[i].addEventListener('ended', manager);

					this.target.appendChild(player);
				}

				this.addHelpers();

				if(this.options.gui) {

					this.GUI = new hyperaudio.PlayerGUI({
						player: this,

						navigation: false,		// next/prev buttons
						fullscreen: true,		// fullscreen button

						cssClass: this.player[0].options.cssClass
					});
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addHelpers: function() {
			var fxHelper = document.createElement('div');
			fxHelper.id = 'fxHelper';
			fxHelper.className = 'video-transition-servo';
			fxHelper.appendChild(document.createElement('div'));

			var titleFXHelper = document.createElement('div');
			titleFXHelper.id = 'titleFXHelper';
			titleFXHelper.className = 'title-effect-servo';

			this.target.appendChild(fxHelper);
			this.target.appendChild(titleFXHelper);

		},
		initPopcorn: function(index, player) {
			var elems, e, eLen;
			var onNewPara = function(parent) {
				// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
			};

			if(index < this.content.length && player < this.player.length) {

				// Reset the popcorn... Maybe want to only do this if necessary, ie., if any transcript plugins added.
				this.player[player].initPopcorn();

				elems = this.content[index].element.getElementsByTagName('a');
				// Setup the Popcorn Transcript Plugin
				for(e = 0, eLen = elems.length; e < eLen; e++) {

					// Might want to move this (behaviour) to the plugin
					// hyperaudio.removeClass(elems[e], 'transcript-grey');

					this.player[player].popcorn.transcript({
						time: elems[e].getAttribute(this.options.timeAttr) * this.content[index].unit, // seconds
						futureClass: "transcript-grey",
						target: elems[e],
						onNewPara: onNewPara
					});
				}
			}
		},
		load: function(index) {
			var media = this.content[index].media,
				activePlayer = this.which(media);

			this.contentIndex = index;

			if(activePlayer !== false) {
				this.activePlayer = activePlayer;
			} else {
				this.player[this.activePlayer].load(media);
			}

			this.initPopcorn(index, this.activePlayer);

			for(var i=0; i < this.player.length; i++) {
				hyperaudio.removeClass(this.player[i].target, 'active');
			}
			hyperaudio.addClass(this.player[this.activePlayer].target, 'active');
		},
		prepare: function(index) {
			// Used when more than 1 player to prepare the next piece of media.

			// 1. Want to be able to call this method and it deal with preparing the other player.
			// 2. So it should check if the media is already available in a player.
			// 3. If it is available, then do nothing.
			// 4. If not, then setup the next player to play the media.

			// 5. In principle this should support 1, 2 or more players.
			// 6. If 1 player, should do nothing here.
			// 7. If 2 or more players, then setup the next one. ie., The last one ever used before.

			// 8. Normally just 1 or 2 players though, so "keep it real mofo!"

			var media = this.content[index].media;

			// Ignore if we are only using a single Player
			if(media && this.player.length > 1) {

				// See if a player already has it. NB: Zero is falsey, so strong comparison.
				var prepared = this.which(media);
				var alignStart = Math.max(0, this.content[index].start - 1); // 
				if(prepared === false) {

					// Get the next free player (Has flaws if more than 2, but still works. Just does not take full advantage of more than 2.)
					this.nextPlayer = this.activePlayer + 1 < this.player.length ? this.activePlayer + 1 : 0;

					if(this.player[this.nextPlayer]) {
						this.player[this.nextPlayer].load(media);
						this.player[this.nextPlayer].pause(alignStart);
					}
				} else {
					// Reset popcorn and move the video to the start time.
					if(prepared !== this.activePlayer) {
						this.player[prepared].initPopcorn();
						this.player[this.nextPlayer].pause(alignStart);
					}
				}
			}
		},
		which: function(media) {
			var index = false;

			if(media) {
				for(var i=0; i < this.player.length; i++) {
					if(!this.player[i].mediaDiff(media)) {
						index = i;
						break;
					}
				}
			}
			return index;
		},

		cue: function(play, jumpTo) {
			var i, iLen, elems, e, eLen;
/*
			var onNewPara = function(parent) {
				// $("#transcript-content").stop().scrollTo($(parent), 800, {axis:'y',margin:true,offset:{top:0}});
			};
*/
			if(this.stage && this.stage.target) {

				if(this.updateRequired) {
					this.updateContent();
				}

				this._pause();
				this.contentIndex = jumpTo.contentIndex;

				if(this.options.music) {
					this.options.music.pause();
				}

				if(this.contentIndex < this.content.length) {

					this.load(this.contentIndex);
					if(this.content[this.contentIndex+1]) {
						this.prepare(this.contentIndex+1);
					}
					// this.effect(this.content[this.contentIndex].effect);

					this.resetEffects(jumpTo);

					if(this.options.gui) {
						this.GUI.setStatus({
							// paused: this.paused,
							currentTime: this.getTotalCurrentTime(jumpTo.start, jumpTo.contentIndex)
						});
					}

					for(i = 0, iLen = this.content.length; i < iLen; i++) {
						elems = this.content[i].element.getElementsByTagName('a');
						for(e = 0, eLen = elems.length; e < eLen; e++) {
							if(i < this.contentIndex) {
								// Remove the class
								hyperaudio.removeClass(elems[e], 'transcript-grey');
							} else if(i > this.contentIndex) {
								// Add the class
								hyperaudio.addClass(elems[e], 'transcript-grey');
							}
						}
					}

					// Believe this is a good place to set this flag
					this.isReadyToPlay = true;

					if(play) {
						this._play(jumpTo.start);
					} else {
						this._pause(jumpTo.start);
					}
				}
			}
		},

		gui_play: function(time) {
			this._trigger(hyperaudio.event.userplay, {msg: 'User clicked play'});
			this.play(time);
		},
		gui_pause: function(time) {
			this._trigger(hyperaudio.event.userpause, {msg: 'User clicked pause'});
			this.pause(time);
		},
		gui_currentTime: function(time, play) {
			this._trigger(hyperaudio.event.usercurrenttime, {msg: 'User clicked the progress bar'});
			this.currentTime(time, play);
		},

		play: function() {

			var resume = false,
				jumpTo;

			if(arguments.length) {
				if(typeof arguments[0] === 'object') {
					jumpTo = arguments[0];
				}
			} else if(this.isReadyToPlay) {
				resume = true;
			}

			if(this.content.length) {

				if(resume) {
					this._play();
				} else if(jumpTo) {
					this._pause();
					this.cue(true, {
						contentIndex: jumpTo.contentIndex,
						start: jumpTo.start
					});
					// The effect is not in cue!!!
					// this.effect(this.content[this.contentIndex].effect);
				} else {
					this.cue(true, {
						contentIndex: 0,
						start: this.content[0].start
					});
					this.effect(this.content[0].effect);
				}
			} else {
				if(this.options.gui) {
					this.GUI.setStatus({
						paused: this.paused
					});
				}
			}
		},

		pause: function() {
			// Really need pause to do similar to play by using cue()
			this._pause();
			if(this.options.music) {
				this.options.music.pause();
			}
		},
		_play: function(time) {
			this.paused = false;
			this.player[this.activePlayer].play(time);
		},
		_pause: function(time) {
			this.paused = true;
			this.player[this.activePlayer].pause(time);
		},
		currentTime: function(time, play) {
			var jumpTo = {},
				i, len;
			if(this.stage && this.stage.target) {
				if(this.updateRequired) {
					this.updateContent();
				}
				for(i = 0, len = this.content.length; i < len; i++) {
					if(this.content[i].totalStart <= time && time < this.content[i].totalEnd) {
						jumpTo.contentIndex = i;
						jumpTo.start = time - this.content[i].totalStart + this.content[i].start;
						this.cue(!this.paused, jumpTo);
						break;
					}
				}
			}
		},

		playWord: function(sectionElem, wordElem) {
			var jumpTo = {},
				i, len;
			if(this.stage && this.stage.target) {
				if(this.updateRequired) {
					this.updateContent();
				}
				for(i = 0, len = this.content.length; i < len; i++) {
					if(this.content[i].element === sectionElem) {
						jumpTo.contentIndex = i;
						jumpTo.start = wordElem.getAttribute(this.options.timeAttr) * this.content[i].unit;
						this._trigger(hyperaudio.event.userplayword, {msg: 'User clicked on a word to play from'});
						this.play(jumpTo);
						break;
					}
				}
			}
		},

		requestUpdate: function(reset) {
			var self = this,
				delay = this.options.stageChangeDelay;
			if(reset) {
				this.pause();
				if(this.options.gui) {
					this.GUI.setStatus({
						paused: this.paused,
						currentTime: 0,
						duration: 0
					});
				}
				this.needsInitVideo = true;
				delay = 0;
			}
			this.updateRequired = true;
			clearTimeout(this.timeout.updateContent);
			this.timeout.updateContent = setTimeout(function() {
				self.updateContent();
			}, delay);
		},

		updateContent: function() {

			var i, len,
				duration = 0;

			this.updateRequired = false;
			clearTimeout(this.timeout.updateContent);

			// Believe this is a good place to unset this flag
			this.isReadyToPlay = false;

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.stageSections = this.stageArticle.getElementsByTagName('section');

				this.stageIndex = 0; // [Number] The next section
				this.content = []; // [Array] Holding the sections found with content
				this.firstContent = true; // [Boolean] True the first time
				this.endedContent = false; // [Boolean] True when we have no more content

				// this.contentIndex = 0; // [Number] The content that is actually being played.

				while(!this.endedContent) {
					this.getContent();
				}

				// Calculate the duration and start/end of this piece of content, compared to to the whole
				for(i = 0, len = this.content.length; i < len; i++) {
					this.content[i].totalStart = duration;
					duration += this.content[i].end + this.content[i].trim - this.content[i].start;
					this.content[i].totalEnd = duration;
				}
				this.time.duration = duration;

				// Update the duration on the GUI
				if(this.options.gui) {
					this.GUI.setStatus({
						duration: this.time.duration
					});
				}

				if(this.needsInitVideo && this.content.length) {
					this.needsInitVideo = false;
					this.cue(false, {
						contentIndex: 0,
						start: this.content[0].start
					});
					//Unset this flag so that any initial effects get played - when play begins.
					this.isReadyToPlay = false;
				}
			}
		},

		getContent: function() {

			var effect = [],
				searching = true,
				section;

			// Search for sections with content and apply sections with effects to that content
			while(searching) {

				section = this.getSection(this.stageIndex);
				// If there is another section
				if(section) {
					// If this section has content
					if(section.media) {

						// Need to add any stored affects here
						section.effect = []; // Init the effect array
						this.effectContent(section, effect);

						// Store the content
						this.content.push(section);

						// The first time we need to get the 1st and 2nd content sections.
						if(this.firstContent) {
							this.firstContent = false;
							effect = []; // reset the effect array
						} else {
							searching = false;
						}
					} else if(section.effect) {
						// Some effects need to be applied to the previous content item

						// Trim affects previous content
						if(section.effect.type === 'trim') {
							// Have we got a previous section to affect?
							if(this.content.length) {
								this.effectContent(this.content[this.content.length-1], section.effect);
							}

						// Fade effects both previous and next content
						} else if(section.effect.type === 'fade') {
							// Make 2 copies of the fade effect. Out and In.
							var fadeOutEffect = hyperaudio.extend({}, section.effect, {type: "fadeOut"}),
								fadeInEffect = hyperaudio.extend({}, section.effect, {type: "fadeIn"});
							// Have we got a previous section to affect?
							if(this.content.length) {
								this.effectContent(this.content[this.content.length-1], fadeOutEffect);
							}
							// Effect for the next section, so store it for later.
							effect.push(fadeInEffect);

						} else if(section.effect.type === 'title' && section.effect.fullscreen) {
							// Similar to the Fade effect. The FadeFX does the fullscreen title effect

							// Make 2 copies of the fade effect. Out and In.
							var fadeOutEffectTitle = hyperaudio.extend({}, section.effect, {
								type: "fadeOut",
								duration: 1
							});
							var fadeInEffectTitle = hyperaudio.extend({}, section.effect, {
								type: "fadeIn",
								duration: 1,
								delay: section.effect.duration
							});

							// Have we got a previous section to affect?
							if(this.content.length) {
								this.effectContent(this.content[this.content.length-1], fadeOutEffectTitle);
							} else {
								// Effect is on the first section, so store it for later.
								fadeOutEffectTitle.type = "fadeNow";
								effect.push(fadeOutEffectTitle);
							}
							// Effect for the next section, so store it for later.
							effect.push(fadeInEffectTitle);

						// The rest affect the next content
						} else {
							// Effect for the next section, so store it for later.
							effect.push(section.effect);
						}
					} else {
						// Something is wrong with section structure
						searching = false;
					}
				} else {
					this.endedContent = true;
					searching = false;
				}

				this.stageIndex++;
			}
		},

		getSection: function(index) {

			var stageOptions = this.stage ? this.stage.options : {};
				section = {
					index: index
				};

			if(index < this.stageSections.length) {

				// Get the section
				var el = section.element = this.stageSections[index];

				// Get the ID
				section.id = el.getAttribute(stageOptions.idAttr);

				// Get the media
				var mp4 = el.getAttribute(stageOptions.mp4Attr),
					webm = el.getAttribute(stageOptions.webmAttr),
					youtube = el.getAttribute(stageOptions.ytAttr);

				if(mp4 || webm || youtube) {
					section.media = {
						mp4: mp4,
						webm: webm,
						youtube: youtube
					};
				} else {
					section.media = false;
				}

				var unit = 1 * el.getAttribute(stageOptions.unitAttr);
				section.unit = unit = unit > 0 ? unit : this.options.unit;

				// Still have attributes hard coded in here. Would need to pass from the transcript to stage and then to here.
				var words = el.getElementsByTagName('a');
				if(words.length) {
					section.start = words[0].getAttribute(this.options.timeAttr) * unit;
					section.end = words[words.length-1].getAttribute(this.options.timeAttr) * unit;
					section.trim = this.options.trim;
				}

				// Get the effect details
				section.effect = this.getSectionEffect(el);

				return section;
			} else {
				return false;
			}
		},

		getSectionEffect: function(el) {
			// Get the effect details
			var type = el.getAttribute('data-effect'),
				effect, media, elem;

			if(type) {
				elem = {
					title: el.querySelector('#effect-title'),
					fullscreen: el.querySelector('#effect-fullscreen'),
					delay: el.querySelector('#effect-delay'),
					start: el.querySelector('#effect-start'),
					duration: el.querySelector('#effect-duration'),
					volume: el.querySelector('#effect-volume')
				};
				media = {
					mp3: el.getAttribute('data-mp3'),
					mp4: el.getAttribute('data-mp4'),
					ogg: el.getAttribute('data-ogg')
				};
				effect = {
					type: type,
					title: elem.title ? elem.title.value : '',
					fullscreen: elem.fullscreen ? elem.fullscreen.checked : false,
					delay: elem.delay ? elem.delay.value * 1 : 0, // Convert to number
					start: elem.start ? elem.start.value * 1 : 0, // Convert to number
					duration: elem.duration ? elem.duration.value * 1 : 0, // Convert to number
					volume: elem.volume ? elem.volume.value / 100 : 0, // Convert to number and ratio from percent
					media: media
				};
			} else {
				effect = false;
			}
			return effect;
		},

		// Maybe this could be its own class?
		bgmFX: function(options) {
			if(this.options.music) {
				this.options.music.bgmFX(options);
			}
		},

		// Obsolete method... Effects are too unique to be classed in such a way
		isPrevEffect: function(effect) {

			// List of the effect types. (Separated by a space.)
			var effectTypes = 'trim',
				flag = false;

			hyperaudio.each(effectTypes.split(/\s+/g), function(i,type) {
				if(effect.type === type) {
					flag = true;
					return false; // exit each
				}
			});
			return flag;
		},

		// Obsolete method... Effects are too unique to be classed in such a way
		isPrevAndNextEffect: function(effect) {

			// List of the effect types. (Separated by a space.)
			var effectTypes = 'fade',
				flag = false;

			hyperaudio.each(effectTypes.split(/\s+/g), function(i,type) {
				if(effect.type === type) {
					flag = true;
					return false; // exit each
				}
			});
			return flag;
		},

		effectContent: function(content, effect) {

			// Allow effect to be a single object, or an array of them. Empty effect arrays do nothing.
			if(effect && !effect.length && effect.length !== 0) {
				effect = [effect];
			}

			for(var i=0, l=effect.length; i < l; i++) {
				switch(effect[i].type) {
					case 'title':
						content.effect.push(effect[i]);
						break;
					case 'fadeOut':
						content.effect.push(effect[i]);
						break;
					case 'fadeIn':
						content.effect.push(effect[i]);
						break;
					case 'fadeNow':
						content.effect.push(effect[i]);
						break;
					case 'bgm':
						content.effect.push(effect[i]);
						break;
					case 'trim':
						content.trim = effect[i].duration;
						break;
				}
			}

		},

		resetEffects: function(jumpTo) {
			var i, iLen, e, eLen, effect;
			for(i = 0, iLen = this.content.length; i < iLen; i++) {
				effect = this.content[i].effect;
				for(e=0, eLen=effect.length; e < eLen; e++) {

					if(i < jumpTo.contentIndex) {
						effect[e].init = true;
					} else if(i > jumpTo.contentIndex) {
						effect[e].init = false;
					} else if(effect[e].type === 'fadeOut') { // Need an isEndEffect() method
						effect[e].init = false;
					} else {
						// i === jumpTo.contentIndex
						if(this.content[i].start + effect[e].delay < jumpTo.start) {
							effect[e].init = true;
						} else {
							effect[e].init = false;
						}
					}
				}
			}
			// force a fadeIn - as in remove any fadeOuts!
			fadeFX({
				el: '#fxHelper',
				fadeIn: true,
				time: 0
			});
		},

		// Believe that the varous effect start and ends could be refactored into the single method.

		// Effecting the start of the content
		effect: function(effect, time) {

			// time : This is the relative time of the content.
			time = typeof time === 'number' ? time : 0;

			if(effect && effect.length) {

				for(var i=0, l=effect.length; i < l; i++) {

					if(!effect[i].init && effect[i].delay <= time) {

						switch(effect[i].type) {
							case 'title':
								if(effect[i].title && effect[i].duration) {
									titleFX({
										el: '#titleFXHelper',
										text: effect[i].title,
										duration: effect[i].duration * 1000
									});
									effect[i].init = true;
								}
								break;
							case 'fadeIn':
								if(effect[i].duration) {
									fadeFX({
										el: '#fxHelper',
										fadeIn: true,
										text: effect[i].title,
										time: effect[i].duration * 1000
									});
									effect[i].init = true;
								}
								break;
							case 'fadeNow':
								fadeFX({
									el: '#fxHelper',
									fadeOut: true,
									text: effect[i].title,
									time: 0
								});
								effect[i].init = true;
								break;
							case 'bgm':
								if(effect[i].duration) {
									this.bgmFX({
										media: {
											mp3: effect[i].media.mp3,
											mp4: effect[i].media.mp4,
											ogg: effect[i].media.ogg
										},
										delay: effect[i].delay, // The delay is handled outside the bgmFX
										start: effect[i].start,
										duration: effect[i].duration,
										volume: effect[i].volume
									});
									effect[i].init = true;
								}
								break;
						}
					}
				}
			}
		},

		// Effecting the end of the content
		effectEnd: function(effect) {

			if(effect && effect.length) {

				for(var i=0, l=effect.length; i < l; i++) {

					if(!effect[i].init) {

						switch(effect[i].type) {
							case 'fadeOut':
								if(effect[i].duration) {
									fadeFX({
										el: '#fxHelper',
										fadeOut: true,
										text: effect[i].title,
										time: effect[i].duration * 1000
									});
									effect[i].init = true;
								}
								break;
						}
					}
				}
			}
		},

		checkEndEffects: function(currentTime, content) {

			// 1. Do we have an end effect?
			// 2. Yes, has it been init?
			// 3. No, well is it time? - Calculate timings
			// 4. Is it time to start it?
			// 5. Yes, well execute the effect.

			var endEffects = this.getEndEffects(content),
				l = endEffects.length,
				i = 0;

			// Check each end effect
			for(; i < l; i++) {
				// Has the effect (not) been initiated?
				if(!endEffects[i].init) {
					// Is it time to start the effect?
					if(currentTime > content.end + content.trim - endEffects[i].duration) {
						// Boomshanka! Wrap it in an Array.
						this.effectEnd([endEffects[i]]);
					}
				}
			}
			// wanna return something?
			// return {buggerAll:true};
		},

		getEndEffects: function(content) {
			// List of the effect types. (Separated by a space.)
			var effectTypes = 'fadeOut',
				endEffects = [];

			hyperaudio.each(content.effect, function(n, effect) {
				hyperaudio.each(effectTypes.split(/\s+/g), function(i,type) {
					if(effect.type === type) {
						endEffects.push(effect);
					}
				});
			});
			// return an array of all the end effects.
			return endEffects;
		},

		getTotalCurrentTime: function(currentTime, index) {
			var start, end, totalCurrentTime = 0;
			if(index < this.content.length) {
				start = this.content[index].start;
				end = this.content[index].end + this.content[index].trim;

				// Calculte the (total) currentTime to display on the GUI
				totalCurrentTime = this.content[index].totalStart;
				if(start < currentTime && currentTime < end) {
					totalCurrentTime += currentTime - start;
				} else if(currentTime >= end) {
					// totalCurrentTime += end - start;
					totalCurrentTime = this.content[index].totalEnd;
				}
			}
			return totalCurrentTime;
		},

		manager: function(videoElem, event) {
			var self = this;

			this.paused = videoElem.paused;

			if(!this.paused) {

				this.checkEndEffects(videoElem.currentTime, this.content[this.contentIndex]);

				var endTime = this.content[this.contentIndex].end + this.content[this.contentIndex].trim;

				var totalCurrentTime = this.getTotalCurrentTime(videoElem.currentTime, this.contentIndex);

				var relTime = videoElem.currentTime - this.content[this.contentIndex].start;
/*
				// Paronoid and cleaning up the relTime
				var relEnd = endTime - this.content[this.contentIndex].start;
				if(isNaN(relTime) || relTime < 0) {
					relTime = 0;
				} else if(relTime > relEnd) {
					relTime = relEnd; // Maybe this should be infinity... Since delay greater than the content, and would otherwise never occur.
				}
*/
				if(videoElem.currentTime > endTime) {
					// Goto the next piece of content

					// Flush out any remaining effects. ie., Otherwise delay > duration never happens.
					this.effect(this.content[this.contentIndex].effect, Infinity);

					this._pause(); // Need to stop, otherwise if we switch player, the hidden one keeps playing.

					this.contentIndex++;

					if(this.contentIndex < this.content.length) {
						// this.paused = false;

						this.load(this.contentIndex);
						if(this.content[this.contentIndex+1]) {
							this.prepare(this.contentIndex+1);
						}
						this.effect(this.content[this.contentIndex].effect, 0);
						this._play(this.content[this.contentIndex].start);

					} else {
						// Nothing to play
						this.paused = true;
						this.isReadyToPlay = false; // ended so needs a reset to the start
						this.contentIndex = 0; // Reset this since YouTube player (or its Popcorn wrapper) generates the timeupdate all the time.
						this.prepare(this.contentIndex);
						if(this.options.music) {
							this.options.music.pause();
						}
					}
				} else {
					// Doing this every time now.
					this.effect(this.content[this.contentIndex].effect, relTime);
				}

				if(this.options.gui) {
					this.GUI.setStatus({
						paused: this.paused,
						currentTime: totalCurrentTime
					});
				}
			} else {
				if(this.options.gui) {
					this.GUI.setStatus({
						paused: this.paused
					});
				}
			}
		}
	};

	return Projector;
}(window, document, hyperaudio, Popcorn));
