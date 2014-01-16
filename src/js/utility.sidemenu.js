var SideMenu = (function (document, hyperaudio) {

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

	SideMenu.prototype.initTranscripts = function () {
		var self = this;

		var mkdir = function(parent, title) {
			var li = document.createElement('li'),
				div = document.createElement('div'),
				ul = document.createElement('ul');
			hyperaudio.addClass(li, 'folder');
			div.innerHTML = title;
			li.appendChild(div);
			li.appendChild(ul);
			parent.appendChild(li);
			return ul;
		};

		hyperaudio.api.getUsername(function(success) {

			var username = '';
			var filter = false;

			if(success) {
				username = this.username;
				filter = !this.guest;
			}

			hyperaudio.api.getTranscripts(function(success) {
				if(success) {
					var yourTrans, otherTrans, userTrans, elem, trans;

					if(username) {
						yourTrans = mkdir(self.transcripts, 'Your Transcripts');
					}
					otherTrans = mkdir(self.transcripts, 'Other Transcripts');

					// Nesting not supported ATM.
					// userTrans = mkdir(self.transcripts, 'By User');
					// mkdir(userTrans, 'Scooby');
					// mkdir(userTrans, 'Mark');

					for(var i = 0, l = this.transcripts.length; i < l; i++) {
						trans = this.transcripts[i];
						if(trans.type === 'html') {
							elem = document.createElement('li');
							elem.setAttribute('data-id', trans._id);
							elem.innerHTML = trans.label;
							// self.transcripts.appendChild(elem);

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
			});
		});
	};

	SideMenu.prototype.initMusic = function () {
		var self = this,
			stage = this.options.stage;

		function onDragStart (e) {
			hyperaudio.addClass(stage.target, 'dragdrop');
		}

		function onDrop (el) {
			hyperaudio.removeClass(stage.target, 'dragdrop');
			if ( !el ) {	// we dropped outside the stage
				return;
			}

			var title = el.innerHTML;
			hyperaudio.addClass(el, 'effect');
			el.innerHTML = '<form><div>' + title + '</div><label>Delay: <span class="value">1</span>s</label><input type="range" value="1" min="0.5" max="5" step="0.1" onchange="this.parentNode.querySelector(\'span\').innerHTML = this.value"></form>';
			stage.dropped(el, title);
		}

		if(stage.target) {
			// add drag and drop to BGM
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
		}
	};

	SideMenu.prototype.updateStatus = function () {
		this.opened = hyperaudio.hasClass(this.el, 'opened');
	};

	SideMenu.prototype.toggleMenu = function () {
		if ( this.opened ) {
			this.close();
		} else {
			this.open();
		}
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
	};

	SideMenu.prototype.selectMedia = function (e) {
		e.stopPropagation();	// just in case [Not sure this does anything with a tap event.]

		var item = e.target;

		if(this.toggleFolder(e)) {
			return;
		}

		if ( !item.getAttribute('data-id') || !this.mediaCallback ) {
			return;
		}

		this.mediaCallback(item);
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
			return true;
		}
		return false;
	};

	return SideMenu;
})(document, hyperaudio);