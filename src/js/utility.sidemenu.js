var SideMenu = (function (document, hyperaudio) {

	var CLASS_ON_DEMAND = 'on-demand';
	var CLASS_YOUR_ITEM = 'owned-by-user';
	var CLASS_YOUR_MEDIA = 'user-media';
	var CLASS_OTHER_MEDIA = 'other-media';

	var CHANNEL_OTHER_TITLE = 'Other...';
	var CHANNEL_OTHER_API = 'nochannel';

	var CHANNEL_EMPTY_TEXT = 'empty';

	function SideMenu (options) {
		this.options = {
			el: '#sidemenu',
			transcripts: '#panel-media',
			music: '#panel-bgm',
			stage: null // Points at a Stage instance
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		// Might rename the transcripts and music vars/options since rather ambiguous.

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;
		this.transcripts = typeof this.options.transcripts == 'string' ? document.querySelector(this.options.transcripts) : this.options.transcripts;
		this.music = typeof this.options.music == 'string' ? document.querySelector(this.options.music) : this.options.music;
		this.mediaCallback = this.options.callback;

		var handle = document.querySelector('#sidemenu-handle');
		handle._tap = new Tap({el: handle});
		handle.addEventListener('tap', this.toggleMenu.bind(this), false);

		this.updateStatus();

		// handle the tab bar
		var tabs = document.querySelectorAll('#sidemenu .tabbar li');
		for ( i = tabs.length-1; i >= 0; i-- ) {
			tabs[i]._tap = new Tap({el: tabs[i]});
			tabs[i].addEventListener('tap', this.selectPanel.bind(this), false);
		}

		this.initTranscripts();
		this.initMusic();
	}

	SideMenu.prototype.makeMenuFolder = function(parent, title, channel, user) {
		var li = document.createElement('li'),
			div = document.createElement('div'),
			ul = document.createElement('ul');
		hyperaudio.addClass(li, 'folder');
		if(channel) {
			hyperaudio.addClass(li, CLASS_ON_DEMAND);
			li.setAttribute('data-channel', channel);
			if(user) {
				li.setAttribute('data-user', '1');
			}
		}
		div.innerHTML = title;
		li.appendChild(div);
		li.appendChild(ul);
		parent.appendChild(li);
		return ul;
	};

	SideMenu.prototype.makeMenuItem = function(title, id) {
		var li = document.createElement('li');
		if(id) {
			li.setAttribute('data-id', id);
		}
		li.innerHTML = title;
		return li;
	};

	SideMenu.prototype.initTranscripts = function () {
/*
		var self = this;

		addTestFolders();

		hyperaudio.api.getUsername(function(success) {

			var username = '';

			if(success) {
				username = this.username;
			}

			// hyperaudio.api.getTranscripts(function(success) {

			hyperaudio.api.getTranscripts({
				user: true,
				channel: 'US Politics',
				callback: function(json) {

					if(json) {
						var yourTrans, otherTrans, elem, trans;

						if(username) {
							yourTrans = self.makeMenuFolder(self.transcripts, 'Your Media');
						}
						otherTrans = self.makeMenuFolder(self.transcripts, 'Media');

						// addTestFolders();

						for(var i = 0, l = json.length; i < l; i++) {
							trans = json[i];
							if(trans.type === 'html') {
								elem = document.createElement('li');
								elem.setAttribute('data-id', trans._id);
								elem.innerHTML = trans.label;

								if(trans.owner === username) {
									yourTrans.appendChild(elem);
								} else {
									otherTrans.appendChild(elem);
								}
							}
						}

						self.transcripts._tap = new Tap({el: self.transcripts});
						self.transcripts.addEventListener('tap', self.selectMedia.bind(self), false);
					}
				}
			});
		});
*/





		var self = this,
			username = '',
			getUsername,
			getChannels, getUserChannels,
			prepareChannels, prepareUserChannels,
			selectMedia,
			getTranscripts;

		getUsername = function() {
			hyperaudio.api.getUsername(function(success) {
				if(success) {
					username = this.username;
					if(username) {
						getUserChannels();
					} else {
						getChannels();
					}
				}
			});
		};

		getUserChannels = function() {
			hyperaudio.api.getChannels({
				user: true,
				callback: function(success) {
					if(success) {
						prepareUserChannels(success);
					}
				}
			});
		};

		getChannels = function() {
			hyperaudio.api.getChannels({
				callback: function(success) {
					if(success) {
						prepareChannels(success);
					}
				}
			});
		};

		prepareUserChannels = function(channels) {
			var owner = self.makeMenuFolder(self.transcripts, 'Your Media');
			hyperaudio.addClass(owner, CLASS_YOUR_MEDIA);
			if(channels && channels.length) {
				for(var i = 0, l = channels.length; i < l; i++) {
					self.makeMenuFolder(owner, channels[i], channels[i], true);
				}
			}
			self.makeMenuFolder(owner, CHANNEL_OTHER_TITLE, CHANNEL_OTHER_API, true);
			getChannels();
		};

		prepareChannels = function(channels) {
			var owner = self.makeMenuFolder(self.transcripts, 'Media');
			hyperaudio.addClass(owner, CLASS_OTHER_MEDIA);
			if(channels && channels.length) {
				for(var i = 0, l = channels.length; i < l; i++) {
					self.makeMenuFolder(owner, channels[i], channels[i], false);
				}
			}
			self.makeMenuFolder(owner, CHANNEL_OTHER_TITLE, CHANNEL_OTHER_API, false);

			self.transcripts._tap = new Tap({el: self.transcripts});
			// self.transcripts.addEventListener('tap', self.selectMedia.bind(self), false);
			self.transcripts.addEventListener('tap', selectMedia, false);
		};

		selectMedia = function (event) {
			event.stopPropagation();	// just in case [Not sure this does anything with a tap event.]

			var item = event.target;
			var folder = self.toggleFolder(event);

			if(folder) {
				if(self.isOnDemand(folder)) {
					// capture class now! Otherwise, multi clicks cause multi xhr.
					hyperaudio.removeClass(folder, CLASS_ON_DEMAND);
					getTranscripts(folder);
				}
				return;
			}

			var id = item.getAttribute('data-id');

			if ( !id || !self.mediaCallback ) {
				return;
			}

			hyperaudio.Address.setParam('t', id);

			self.mediaCallback(item);
		};

		getTranscripts = function(folder) {
			var channel = folder.getAttribute('data-channel');
			var user = !!folder.getAttribute('data-user');
			folder = folder.querySelector('ul');
			hyperaudio.api.getTranscripts({
				user: user,
				channel: channel,
				callback: function(transcripts) {
					var trans, item;
					if(transcripts) {
						if(transcripts.length) {
							for(var i = 0, l = transcripts.length; i < l; i++) {
								trans = transcripts[i];
								item = self.makeMenuItem(trans.label, trans._id);
								if(username && trans.owner === username) {
									hyperaudio.addClass(item, CLASS_YOUR_ITEM);
								}
								folder.appendChild(item);
							}
						} else {
							folder.appendChild(self.makeMenuItem(CHANNEL_EMPTY_TEXT));
						}
					} else {
						// failed, so put the class back on to enable retry
						hyperaudio.addClass(folder, CLASS_ON_DEMAND);
					}
				}
			});
		};

		getUsername();

		// *****************
		// START - TEST CODE
		// *****************
		var addTestFolders = function() {

			var testFolder =[], testChild = [];

			// Make a folder
			testFolder.push(self.makeMenuFolder(self.transcripts, 'Test Folder 1'));
			testChild.push([]);

			// Add some child items to the folder
			testFolder[testFolder.length - 1].appendChild(self.makeMenuItem('Child 1 -> A', '1A'));
			testFolder[testFolder.length - 1].appendChild(self.makeMenuItem('Child 1 -> B', '1B'));
			testFolder[testFolder.length - 1].appendChild(self.makeMenuItem('Child 1 -> C', '1C'));

			// Add some child folders to the folder
			testChild[testChild.length - 1].push(self.makeMenuFolder(testFolder[testFolder.length - 1], 'Child Folder 1 -> 1'));
			testChild[testChild.length - 1].push(self.makeMenuFolder(testFolder[testFolder.length - 1], 'Child Folder 1 -> 2'));
			testChild[testChild.length - 1].push(self.makeMenuFolder(testFolder[testFolder.length - 1], 'Child Folder 1 -> 3'));

			// Add some child items to the child folders
			testChild[testChild.length - 1][0].appendChild(self.makeMenuItem('Child 1 -> 1 -> A', '11A'));
			testChild[testChild.length - 1][0].appendChild(self.makeMenuItem('Child 1 -> 1 -> B', '11B'));
			testChild[testChild.length - 1][0].appendChild(self.makeMenuItem('Child 1 -> 1 -> C', '11C'));

			testChild[testChild.length - 1][1].appendChild(self.makeMenuItem('Child 1 -> 2 -> A', '12A'));
			testChild[testChild.length - 1][1].appendChild(self.makeMenuItem('Child 1 -> 2 -> B', '12B'));
			testChild[testChild.length - 1][1].appendChild(self.makeMenuItem('Child 1 -> 2 -> C', '12C'));

			testChild[testChild.length - 1][2].appendChild(self.makeMenuItem('Child 1 -> 3 -> A', '13A'));
			testChild[testChild.length - 1][2].appendChild(self.makeMenuItem('Child 1 -> 3 -> B', '13B'));
			testChild[testChild.length - 1][2].appendChild(self.makeMenuItem('Child 1 -> 3 -> C', '13C'));


			// Add a child folders to the child folder (3rd level)
			var testThird = self.makeMenuFolder(testChild[testChild.length - 1][1], 'CF 1>2>1');
			// Add some child items to the child folders (3rd level)
			testThird.appendChild(self.makeMenuItem('C 1>2>1>A', '121A'));
			testThird.appendChild(self.makeMenuItem('C 1>2>1>B', '121B'));
			testThird.appendChild(self.makeMenuItem('C 1>2>1>C', '121C'));


			// Make another folder
			testFolder.push(self.makeMenuFolder(self.transcripts, 'Test Folder 2'));
			testChild.push([]);

			// Add some child items to the folder
			testFolder[testFolder.length - 1].appendChild(self.makeMenuItem('Child 2 -> A', '2A'));
			testFolder[testFolder.length - 1].appendChild(self.makeMenuItem('Child 2 -> B', '2B'));
			testFolder[testFolder.length - 1].appendChild(self.makeMenuItem('Child 2 -> C', '2C'));

			// Add some child folders to the folder
			testChild[testChild.length - 1].push(self.makeMenuFolder(testFolder[testFolder.length - 1], 'Child Folder 2 -> 1'));
			testChild[testChild.length - 1].push(self.makeMenuFolder(testFolder[testFolder.length - 1], 'Child Folder 2 -> 2'));
			testChild[testChild.length - 1].push(self.makeMenuFolder(testFolder[testFolder.length - 1], 'Child Folder 2 -> 3'));

			// Add some child items to the child folders
			testChild[testChild.length - 1][0].appendChild(self.makeMenuItem('Child 2 -> 1 -> A', '21A'));
			testChild[testChild.length - 1][0].appendChild(self.makeMenuItem('Child 2 -> 1 -> B', '21B'));
			testChild[testChild.length - 1][0].appendChild(self.makeMenuItem('Child 2 -> 1 -> C', '21C'));

			testChild[testChild.length - 1][1].appendChild(self.makeMenuItem('Child 2 -> 2 -> A', '22A'));
			testChild[testChild.length - 1][1].appendChild(self.makeMenuItem('Child 2 -> 2 -> B', '22B'));
			testChild[testChild.length - 1][1].appendChild(self.makeMenuItem('Child 2 -> 2 -> C', '22C'));

			testChild[testChild.length - 1][2].appendChild(self.makeMenuItem('Child 2 -> 3 -> A', '23A'));
			testChild[testChild.length - 1][2].appendChild(self.makeMenuItem('Child 2 -> 3 -> B', '23B'));
			testChild[testChild.length - 1][2].appendChild(self.makeMenuItem('Child 2 -> 3 -> C', '23C'));
		};
		// ***************
		// END - TEST CODE
		// ***************
	};

	SideMenu.prototype.initMusic = function () {
		var self = this,
			stage = this.options.stage;

		function onDragStart (e) {
			hyperaudio.addClass(stage.target, 'dragdrop');

			hyperaudio.gaEvent({
				type: 'SIDEMENU',
				action: 'bgmstartdrag: Began dragging BGM effect'
			});
		}

		function onDrop (el) {
			hyperaudio.removeClass(stage.target, 'dragdrop');
			if ( !el ) {	// we dropped outside the stage
				return;
			}

			var title = el.innerHTML;
			hyperaudio.addClass(el, 'effect');
			el.setAttribute('data-effect', 'bgm');

			var id = this.handle.getAttribute('data-id'),
				mp3 = this.handle.getAttribute('data-mp3'),
				mp4 = this.handle.getAttribute('data-mp4'),
				ogg = this.handle.getAttribute('data-ogg');

			if(id) el.setAttribute('data-id', id);
			if(mp3) el.setAttribute('data-mp3', mp3);
			if(mp4) el.setAttribute('data-mp4', mp4);
			if(ogg) el.setAttribute('data-ogg', ogg);

			var html = '<form><div><span class="icon-music">' + title + '</span></div>' +
				'<label>Delay: <span class="value">0</span>s</label><input id="effect-delay" type="range" value="0" min="0" max="30" step="0.5" onchange="this.setAttribute(\'value\', this.value); this.previousSibling.querySelector(\'span\').innerHTML = this.value">' +
				'<label>Start At: <span class="value">0</span>s</label><input id="effect-start" type="range" value="0" min="0" max="30" step="0.5" onchange="this.setAttribute(\'value\', this.value); this.previousSibling.querySelector(\'span\').innerHTML = this.value">' +
				'<label>Duration: <span class="value">60</span>s</label><input id="effect-duration" type="range" value="60" min="0" max="120" step="0.5" onchange="this.setAttribute(\'value\', this.value); this.previousSibling.querySelector(\'span\').innerHTML = this.value">' +
				'<label>Volume: <span class="value">80</span>%</label><input id="effect-volume" type="range" value="80" min="10" max="100" step="5" onchange="this.setAttribute(\'value\', this.value); this.previousSibling.querySelector(\'span\').innerHTML = this.value">' +
				'</form>';
			el.innerHTML = html;
			stage.dropped(el, '<span class="icon-music">' + title + '</span>');

			hyperaudio.gaEvent({
				type: 'SIDEMENU',
				action: 'bgmdrop: Dropped BGM effect on to stage'
			});
		}

		if(stage.target) {
			// add drag and drop to BGM
/*
			var items = document.querySelectorAll('#panel-bgm li');
			for (var i = items.length-1; i >= 0; i-- ) {
				if ( !this.isFolder(items[i]) ) {
					items[i]._dragInstance = new DragDrop({
						handle: items[i],
						dropArea: stage.target,
						draggableClass: 'draggableEffect',
						onDragStart: onDragStart,
						onDrop: onDrop
					});
				}
			}
			self.music._tap = new Tap({el: self.music});
			self.music.addEventListener('tap', self.toggleFolder.bind(self), false);
*/

			hyperaudio.api.getBGM(function(success) {
				if(success) {
					var elem, bgms;

					for(var i = 0, l = this.bgm.length; i < l; i++) {
						bgms = this.bgm[i];
						if(bgms.type === 'audio') {
							elem = document.createElement('li');
							elem.setAttribute('data-id', bgms._id);
							if(bgms.source.mp3) elem.setAttribute('data-mp3', bgms.source.mp3.url);
							if(bgms.source.mp4) elem.setAttribute('data-mp4', bgms.source.mp4.url);
							if(bgms.source.ogg) elem.setAttribute('data-ogg', bgms.source.ogg.url);
							elem.innerHTML = bgms.label;
							elem._dragInstance = new DragDrop({
								handle: elem,
								html: '<span class="icon-music">' + bgms.label + '</span>',
								dropArea: stage.target,
								draggableClass: 'draggableEffect',
								onDragStart: onDragStart,
								onDrop: onDrop
							});
							self.music.appendChild(elem);
						}
					}

					self.music._tap = new Tap({el: self.music});
					self.music.addEventListener('tap', self.toggleFolder.bind(self), false);
				}
			});
		}
	};

	SideMenu.prototype.updateStatus = function () {
		this.opened = hyperaudio.hasClass(this.el, 'opened');
	};

	SideMenu.prototype.toggleMenu = function () {
		var state;

		if ( this.opened ) {
			this.close();
			state = 'Closed';
		} else {
			this.open();
			state = 'Opened';
		}

		hyperaudio.gaEvent({
			type: 'SIDEMENU',
			action: 'togglemenu: ' + state
		});
	};

	SideMenu.prototype.open = function () {
		if ( this.opened ) {
			return;
		}

		hyperaudio.addClass(this.el, 'opened');
		this.opened = true;
	};

	SideMenu.prototype.close = function () {
		if ( !this.opened ) {
			return;
		}

		hyperaudio.removeClass(this.el, 'opened');
		this.opened = false;
	};

	SideMenu.prototype.selectPanel = function (e) {
		var current = document.querySelector('#sidemenu .tabbar li.selected');
		var incoming = e.currentTarget;
		hyperaudio.removeClass(current, 'selected');
		hyperaudio.addClass(incoming, 'selected');

		var panelID = 'panel' + incoming.id.replace('sidemenu', '');
		current = document.querySelector('#sidemenu .panel.selected');
		hyperaudio.removeClass(current, 'selected');
		incoming = document.querySelector('#' + panelID);
		hyperaudio.addClass(incoming, 'selected');

		var name = e.currentTarget.querySelector('span').innerHTML;
		hyperaudio.gaEvent({
			type: 'SIDEMENU',
			action: 'selectpanel: Switched tab -> ' + name
		});
	};

	// OBSOLETE METHOD
	SideMenu.prototype.selectMedia = function (e) {
		e.stopPropagation();	// just in case [Not sure this does anything with a tap event.]

		var item = e.target;

		if(this.toggleFolder(e)) {
			if(this.isOnDemand(e)) {
				// capture class now!
			}
			return;
		}

		if ( !item.getAttribute('data-id') || !this.mediaCallback ) {
			return;
		}

		this.mediaCallback(item);
	};

	SideMenu.prototype.isOnDemand = function (target) {
		// Copes with clicks on Folder div text and the li

		if ( hyperaudio.hasClass(target.parentNode, CLASS_ON_DEMAND) ) {
			target = target.parentNode;
		}

		if ( hyperaudio.hasClass(target, CLASS_ON_DEMAND) ) {
			return target;
		}
		return false;
	};

	SideMenu.prototype.isFolder = function (target) {
		// Copes with clicks on Folder div text and the li

		if ( hyperaudio.hasClass(target.parentNode, 'folder') ) {
			target = target.parentNode;
		}

		if ( hyperaudio.hasClass(target, 'folder') ) {
			return target;
		}
		return false;
	};

	SideMenu.prototype.toggleFolder = function (e) {

		var folder = this.isFolder(e.target);
		if(folder) {
			hyperaudio.toggleClass(folder, 'open');

			var name = folder.querySelector('div').innerHTML;
			hyperaudio.gaEvent({
				type: 'SIDEMENU',
				action: 'togglefolder: ' + (hyperaudio.hasClass(folder, 'open') ? 'Opened' : 'Closed') + ' -> ' + name
			});

			return folder;
		}
		return false;
	};

	return SideMenu;
})(document, hyperaudio);