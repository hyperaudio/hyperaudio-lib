var SideMenu = (function (document, hyperaudio) {

	function SideMenu (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;
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

		// handle the items list
		var items = document.querySelectorAll('#sidemenu .panel');
		for ( i = items.length-1; i >= 0; i-- ) {
			items[i]._tap = new Tap({el: items[i]});
			items[i].addEventListener('tap', this.selectMedia.bind(this), false);
		}

		function onDragStart (e) {
			stage.className = 'dragdrop';
		}

		function onDrop (el) {
			var title = el.innerHTML;
			hyperaudio.addClass(el, 'effect');
			el.innerHTML = '<form><div>' + title + '</div><label>Delay: <span class="value">1</span>s</label><input type="range" value="1" min="0.5" max="5" step="0.1" onchange="this.parentNode.querySelector(\'span\').innerHTML = this.value"></form>';
			APP.dropped(el, title);
		}

		// add drag and drop to BGM
		items = document.querySelectorAll('#panel-bgm li');
		var stage = document.getElementById('stage');
		for ( i = items.length-1; i >= 0; i-- ) {
			items[i]._dragInstance = new DragDrop({
				handle: items[i],
				dropArea: stage,
				draggableClass: 'draggableEffect',
				onDragStart: onDragStart,
				onDrop: onDrop
			});
		}
	}

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
		e.stopPropagation();	// just in case

		var starter = e.target;

		if ( hyperaudio.hasClass(e.target.parentNode, 'folder') ) {
			starter = e.target.parentNode;
		}

		if ( hyperaudio.hasClass(starter, 'folder') ) {
			hyperaudio.toggleClass(starter, 'open');
			return;
		}

		if ( !starter.getAttribute('data-source') || !this.mediaCallback ) {
			return;
		}

		this.mediaCallback(starter);
	};

	return SideMenu;
})(document, hyperaudio);