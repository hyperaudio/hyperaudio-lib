/* api
 *
 */

var api = (function(hyperaudio) {

	return {
		init: function(options) {
			this.options = hyperaudio.extend({
				api: 'http://api.hyperaud.io/v1/',
				transcripts: 'transcripts/',
				mixes: 'mixes/',
				bgm: 'bgm/media/',
				signin: 'login/',
				whoami: 'whoami/'
			}, options);

			// API State
			this.error = false;

			// User Properties
			this.guest = false; // False to force 1st call
			this.username = ''; // Falsey to force 1st call

			// Stored requested data
			this.transcripts = null;
			this.transcript = null;
			this.mixes = null;
			this.mix = null;
			this.bgm = null;
		},
		callback: function(callback, success) {
			if(typeof callback === 'function') {
				callback.call(this, success);
			}
		},
		signin: function(auth, callback) {
			var self = this;
			// auth = {username,password}
			xhr({
				url: this.options.api + this.options.signin,
				type: 'POST',
				data: JSON.stringify(auth),
				complete: function(event) {
					var json = JSON.parse(this.responseText);
					self.guest = !json.user;
					if(!self.guest) {
						self.username = json.user;

						hyperaudio.gaEvent({
							type: 'API',
							action: 'login: User signed in'
						});

						self.callback(callback, true);
					} else {
						self.username = '';
						self.callback(callback, false);
					}
				},
				error: function(event) {
					self.error = true;
					self.callback(callback, false);
				}
			});
		},
		getUsername: function(callback, force) {
			var self = this;

			// force = typeof force === 'undefined' ? true : force; // default force = true.

			if(!force && (this.guest || this.username)) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				xhr({
					url: this.options.api + this.options.whoami,
					complete: function(event) {
						var json = JSON.parse(this.responseText);
						self.guest = !json.user;
						if(!self.guest) {
							self.username = json.user;
						} else {
							self.username = '';
						}
						self.callback(callback, true);
					},
					error: function(event) {
						self.error = true;
						self.callback(callback, false);
					}
				});
			}
		},
		getTranscripts: function(callback, force) {
			var self = this;
			if(!force && this.transcripts) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				xhr({
					// In future may want a version that returns only your own transcripts.
					// url: self.options.api + (self.guest ? '' : self.username + '/') + self.options.transcripts,
					url: this.options.api + this.options.transcripts,
					complete: function(event) {
						var json = JSON.parse(this.responseText);
						self.transcripts = json;
						self.callback(callback, true);
					},
					error: function(event) {
						self.error = true;
						self.callback(callback, false);
					}
				});
			}
		},
		getTranscript: function(id, callback, force) {
			var self = this;
			if(!force && this.transcript && this.transcript._id === id) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				// Do not need to get username for an ID specific request.
				this.getUsername(function(success) {
					if(success && id) {
						xhr({
							// url: self.options.api + (self.guest ? '' : self.username + '/') + self.options.transcripts + id,
							url: self.options.api + self.options.transcripts + id,
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.transcript = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.error = true; // Setting the common error prop is redundant, since it would have been set in getUsername failure.
						self.callback(callback, false);
					}
				});
			}
		},
		getMixes: function(callback, force) {
			var self = this;
			if(!force && this.mixes) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				// Do not need to get username for a general request.
				this.getUsername(function(success) {
					if(success) {
						xhr({
							url: self.options.api + (self.guest ? '' : self.username + '/') + self.options.mixes,
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.mixes = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.error = true; // Setting the common error prop is redundant, since it would have been set in getUsername failure.
						self.callback(callback, false);
					}
				});
			}
		},
		getMix: function(id, callback, force) {
			var self = this;
			if(!force && this.mix && this.mix._id === id) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				// Do not need to get username for an ID specific request.
				this.getUsername(function(success) {
					if(success && id) {
						xhr({
							url: this.options.api + (this.guest ? '' : this.username + '/') + this.options.mixes + id,
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.mix = json;
								self.callback(callback, true);
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else {
						self.error = true; // Setting the common error prop is redundant, since it would have been set in getUsername failure.
						self.callback(callback, false);
					}
				});
			}
		},
		putMix: function(mix, callback) {
			var self = this;

			// Are we storing the current Mix we're editing in here?
			// Yes, but only refreshing the mix data here on Load and Save.
			// The current mix data will be in the stage's HTML.

			if(typeof mix === 'object') {
				var type = 'POST',
					id = '';

				this.getUsername(function(success) {

					if(success && !self.guest && self.username) {

						// Check: Mix IDs match and user is owner.

						if(self.mix && self.mix._id && self.mix._id === mix._id && self.username === mix.owner) {
							type = 'PUT';
							id = self.mix._id;
							// Check some stuff?
						} else {
							// Check some stuff?
						}

						xhr({
							url: self.options.api + self.username + '/' + self.options.mixes + id,
							type: type,
							data: JSON.stringify(mix),
							complete: function(event) {
								var json = JSON.parse(this.responseText);
								self.mix = json;
								self.callback(callback, {
									saved: true
								});
							},
							error: function(event) {
								self.error = true;
								self.callback(callback, false);
							}
						});
					} else if(success) {
						// The user needs to login
						self.callback(callback, {
							needLogin: true
						});
					} else {
						self.callback(callback, false);
					}
				}, true); // Force the call to get username before attempting to save.
			} else {
				setTimeout(function() {
					self.callback(callback, false);
				}, 0);
			}
		},
		getBGM: function(callback, force) {
			var self = this;
			if(!force && this.bgm) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				xhr({
					url: this.options.api + this.options.bgm,
					complete: function(event) {
						var json = JSON.parse(this.responseText);
						self.bgm = json;
						self.callback(callback, true);
					},
					error: function(event) {
						self.error = true;
						self.callback(callback, false);
					}
				});
			}
		}
	};

}(hyperaudio));
