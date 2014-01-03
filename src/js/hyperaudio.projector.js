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

			gui: true, // True to add a gui.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.stage = null;
		// this.timeout = {};

		this.player = [];
		this.media = [];
		this.current = {};

		this.activePlayer = 0;
		this.nextPlayer = this.options.players > 1 ? 1 : 0;

		// State Flags
		this.paused = true;

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

					console.log('Create: idx='+idx);

					return function(event) {
						// console.log('activePlayer='+self.activePlayer+' | idx='+idx);
						// Passing the event context to manager
						//  * The YouTube event object is useless.
						//  * The YouTube event context was fixed in the Player class.
						if(self.activePlayer === idx) {
							self.manager(this, event);
						}
					};
				};

				for(var i = 0; i < this.options.players; i++ ) {

					console.log('Create: i='+i);

					var manager = getManager(i);

					var player = document.createElement('div');
					hyperaudio.addClass(player, 'hyperaudio-projector');
					this.player[i] = hyperaudio.Player({
						target: player
					});

					this.player[i].addEventListener('timeupdate', manager);

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

			var titleFXHelper = document.createElement('div');
			titleFXHelper.id = 'titleFXHelper';
			titleFXHelper.className = 'title-effect-servo';

			this.target.appendChild(fxHelper);
			this.target.appendChild(titleFXHelper);

		},
		load: function(media) {
			var self = this;

			var activePlayer = this.which(media);

			console.log('load#1: activePlayer=%d | this.activePlayer=%d',activePlayer,this.activePlayer);

			if(activePlayer !== false) {
				this.activePlayer = activePlayer;
			} else {
				this.player[this.activePlayer].load(media);
			}

			console.log('load#2: activePlayer=%d | this.activePlayer=%d',activePlayer,this.activePlayer);

			for(var i=0; i < this.player.length; i++) {
				hyperaudio.removeClass(this.player[i].target, 'active');
			}
			hyperaudio.addClass(this.player[this.activePlayer].target, 'active');
		},
		prepare: function(media) {
			// Used when more than 1 player to prepare the next piece of media.

			// 1. Want to be able to call this method and it deal with preparing the other player.
			// 2. So it should check if the media is already available in a player.
			// 3. If it is available, then do nothing.
			// 4. If not, then setup the next player to play the media.

			// 5. In principle this should support 1, 2 or more players.
			// 6. If 1 player, should do nothing here.
			// 7. If 2 or more players, then setup the next one. ie., The last one ever used before.

			// 8. Normally just 1 or 2 players though, so "keep it real mofo!"


			// Ignore if we are only using a single Player
			if(media && this.player.length > 1) {

				// See if a player already has it. NB: Zero is falsey, so strong comparison.
				if(this.which(media) === false) {

					// Get the next free player (Has flaws if more than 2, but still works. Just does not take full advantage of more than 2.)
					this.nextPlayer = this.activePlayer + 1 < this.player.length ? this.activePlayer + 1 : 0;

					if(this.player[this.nextPlayer]) {
						this.player[this.nextPlayer].load(media);
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
		play: function() {

			// ATM, we always play from the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.stageSections = this.stageArticle.getElementsByTagName('section');

				this.stageIndex = 0; // [Number] The next section
				this.content = []; // [Array] Holding the sections found with content
				this.firstContent = true; // [Boolean] True the first time
				this.endedContent = false; // [Boolean] True when we have no more content

				this.contentIndex = 0; // [Number] The content that is actually being played.

				// This bit is similar to the manager() code

				this.getContent();

				if(this.content.length) {
					this.paused = false;

					this.load(this.content[this.contentIndex].media);
					if(this.content[this.contentIndex+1]) {
						this.prepare(this.content[this.contentIndex+1].media);
					}
					this.effect(this.content[this.contentIndex].effect);
					this._play(this.content[this.contentIndex].start);

				} else {
					// Nothing to play
					this.paused = true;
				}
			} else {
				this.paused = true;
			}
		},

		pause: function() {
			this.paused = true;
			this._pause();
		},
		_play: function(time) {
			this.player[this.activePlayer].play(time);
		},
		_pause: function(time) {
			this.player[this.activePlayer].pause(time);
		},
		currentTime: function(time, play) {
			this.player[this.activePlayer].currentTime(time, play);
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

						// The rest afect the next content
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

			console.log('getContent: length=%d | content=%o',this.content.length,this.content);
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
					section.start = words[0].getAttribute('data-m') * unit;
					section.end = words[words.length-1].getAttribute('data-m') * unit;
					section.trim = this.options.trim;
				}

				// Get the effect details
				var effectType = el.getAttribute('data-effect');
				if(effectType) {
					// This bit should be refactored, maybe with IDs or classes to indicate the input elements.
					var effectText = el.querySelector('input[type="text"]');
					var effectRange = el.querySelector('input[type="range"]');
					section.effect = {
						type: effectType,
						text: effectText ? effectText.value : '',
						duration: effectRange ? effectRange.value * 1 : 0 // Convert to number
					};
				} else {
					section.effect = false;
				}

				return section;
			} else {
				return false;
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
					case 'trim':
						content.trim = effect[i].duration;
						break;
				}
			}

		},

		// Effecting the start of the content
		effect: function(effect) {

			if(effect && effect.length) {

				for(var i=0, l=effect.length; i < l; i++) {

					if(!effect[i].init) {

						switch(effect[i].type) {
							case 'title':
								if(effect[i].text && effect[i].duration) {
									titleFX({
										el: '#titleFXHelper',
										text: effect[i].text,
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

		manager: function(videoElem, event) {
			var self = this;

			if(!this.paused) {

				this.checkEndEffects(videoElem.currentTime, this.content[this.contentIndex]);

				var endTime = this.content[this.contentIndex].end + this.content[this.contentIndex].trim;

				if(videoElem.currentTime > endTime) {
					// Goto the next piece of content

					this._pause(); // Need to stop, otherwise if we switch player, the hidden one keeps playing.

					// This bit is similar to the play() code

					this.getContent();

					this.contentIndex++;

					if(this.contentIndex < this.content.length) {
						// this.paused = false;

						this.load(this.content[this.contentIndex].media);
						if(this.content[this.contentIndex+1]) {
							this.prepare(this.content[this.contentIndex+1].media);
						}
						this.effect(this.content[this.contentIndex].effect);
						this._play(this.content[this.contentIndex].start);

					} else {
						// Nothing to play
						this.paused = true;
						// this._pause();
					}
				}
			}

			// Will need to be calculating the currentTime on the fly and the duration calcuated at the start and on changes to stage.
			if(this.options.gui) {
				this.GUI.setStatus({
					paused: this.paused,
					currentTime: 42,
					duration: 69
				});
			}
		}
	};

	return Projector;
}(window, document, hyperaudio, Popcorn));
