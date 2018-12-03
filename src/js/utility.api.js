/* api
 *
 */

var api = (function(hyperaudio) {
  return {
    init: function(options) {
      this.options = hyperaudio.extend(
        {
          // Options used to build the API url. See _updateInternals() to see how the API url is built.
          // protocol: 'http://',
          org: '', // The organisations namespace / sub-domain. EG. 'chattanooga'
          api: 'api.', // The sub-domain of the API
          domain: 'hyperaud.io', // The domain of the API
          version: '/v1/', // The version of the API.

          // Command syntax
          transcripts: 'transcripts/',
          transcripts_filter: '&type=html',
          mixes: 'mixes/',
          channels: 'channels/',
          // signin: 'login/',
          // whoami: 'whoami/',
          media: 'media/',
          // Specific user (bgm) for music
          // bgm: 'bgm/media/'

          protocol: 'https://',
          bgm: 'media?tag=bgm',
          whoami: 'auth/whoami/',
          signin: 'accounts/token',
          withCredentials: false
        },
        options
      );

      // The base url of the API
      this.url = null;
      this._updateInternals();

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

      this.channels = null;
    },
    option: function(options, value) {
      if (typeof options === 'string') {
        // Enable option to be set/get by name.
        if (typeof value !== 'undefined') {
          this.options[options] = value;
        } else {
          return this.options[options];
        }
      } else if (typeof options === 'object') {
        // Enable options to be set/get by object.
        hyperaudio.extend(this.options, options);
      } else {
        return hyperaudio.extend({}, this.options); // Return a copy of the options object.
      }
      this._updateInternals();
    },
    _updateInternals: function() {
      var namespace = this.options.org ? this.options.org + '.' : '';
      this.url =
        this.options.protocol +
        namespace +
        this.options.api +
        this.options.domain +
        this.options.version;
    },
    callback: function(callback, success) {
      if (typeof callback === 'function') {
        callback.call(this, success);
      }
    },
    signin: function(auth, callback) {
      var self = this;
      // auth = {username,password}
      xhr({
        url: this.url + this.options.signin,
        type: 'POST',
        data: JSON.stringify(auth),
        complete: function(event) {
          var json = JSON.parse(this.responseText);

          try {
            if (json.user) window.localStorage.setItem('user', json.user);
            if (json.token) window.localStorage.setItem('token', json.token);
          } catch (ignored) {}

          self.guest = !json.user;
          if (!self.guest) {
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

      if (!force && (this.guest || this.username)) {
        setTimeout(function() {
          self.callback(callback, true);
        }, 0);
      } else {
        try {
          xhr({
            url: this.url + this.options.whoami + window.localStorage.getItem('token'),
            complete: function(event) {
              var json = JSON.parse(this.responseText);
              self.guest = !json.user;
              if (!self.guest) {
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
        } catch (ignored) {}
      }
    },
    getChannels: function(options) {
      var self = this,
        getUsername,
        getUrl,
        getChannels;

      options = hyperaudio.extend(
        {
          user: false, // When true, the api returns the current user's transcripts.
          callback: null
        },
        options
      );

      getUsername = function() {
        self.getUsername(function(success) {
          if (success && !self.guest) {
            getChannels();
          } else {
            self.callback(options.callback, false);
          }
        });
      };

      getUrl = function() {
        var url = self.url;
        // if(options.user) {
        // 	url += self.username + '/';
        // }
        url += self.options.media + self.options.channels;
        if (options.user) {
          url += '?user=' + self.username;
        }
        return url;
      };

      getChannels = function() {
        xhr({
          url: getUrl(),
          complete: function(event) {
            var json = JSON.parse(this.responseText);
            self.callback(options.callback, json);
          },
          error: function(event) {
            self.error = true;
            self.callback(options.callback, false);
          }
        });
      };

      if (options.user) {
        getUsername();
      } else {
        getChannels();
      }
    },
    getTranscripts: function(options) {
      var self = this,
        getUsername,
        getUrl,
        getTranscripts;

      options = hyperaudio.extend(
        {
          user: false, // When true, the api returns the current user's transcripts.
          channel: '', // The channel name. Empty string disables feature. See 'nochannel' for media without any channel.
          callback: null
        },
        options
      );

      getUsername = function() {
        self.getUsername(function(success) {
          if (success && !self.guest) {
            getTranscripts();
          } else {
            self.callback(options.callback, false);
          }
        });
      };

      getUrl = function() {
        var url = self.url;
        // if(options.user) {
        // 	url += self.username + '/';
        // }
        url += self.options.transcripts + '?';
        if (options.channel) {
          // url += self.options.channels + options.channel;
          url += 'channel=' + options.channel;
        }
        url += self.options.transcripts_filter;
        if (options.user) {
          url += '&user=' + self.username;
        }
        return url;
      };

      getTranscripts = function() {
        xhr({
          url: getUrl(),
          complete: function(event) {
            var json = JSON.parse(this.responseText);
            self.callback(options.callback, json);
          },
          error: function(event) {
            self.error = true;
            self.callback(options.callback, false);
          }
        });
      };

      if (options.user) {
        getUsername();
      } else {
        getTranscripts();
      }
    },
    getTranscriptsOLD: function(callback, force) {
      var self = this;
      if (!force && this.transcripts) {
        setTimeout(function() {
          self.callback(callback, true);
        }, 0);
      } else {
        xhr({
          // In future may want a version that returns only your own transcripts.
          // url: self.url + (self.guest ? '' : self.username + '/') + self.options.transcripts,
          url: this.url + this.options.transcripts,
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
      if (!force && this.transcript && this.transcript._id === id) {
        setTimeout(function() {
          self.callback(callback, true);
        }, 0);
      } else {
        // Do not need to get username for an ID specific request.
        this.getUsername(function(success) {
          if (success && id) {
            xhr({
              // url: self.url + (self.guest ? '' : self.username + '/') + self.options.transcripts + id,
              url: self.url + self.options.transcripts + id,
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
      if (!force && this.mixes) {
        setTimeout(function() {
          self.callback(callback, true);
        }, 0);
      } else {
        // Do not need to get username for a general request.
        this.getUsername(function(success) {
          if (success) {
            xhr({
              // url: self.url + (self.guest ? '' : self.username + '/') + self.options.mixes,
              url: self.url + self.options.mixes + (self.guest ? '' : '?user=' + self.username),
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
      if (!force && this.mix && this.mix._id === id) {
        setTimeout(function() {
          self.callback(callback, true);
        }, 0);
      } else {
        // Do not need to get username for an ID specific request.
        this.getUsername(function(success) {
          if (success && id) {
            xhr({
              url: this.url + this.options.mixes + id,
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

      if (typeof mix === 'object') {
        var type = 'POST',
          id = '';

        this.getUsername(function(success) {
          if (success && !self.guest && self.username) {
            // Check: Mix IDs match and user is owner.

            if (
              self.mix &&
              self.mix._id &&
              self.mix._id === mix._id &&
              self.username === mix.owner
            ) {
              type = 'PUT';
              id = self.mix._id;
              // Check some stuff?
            } else {
              // Check some stuff?
            }

            xhr({
              url: self.url + self.options.mixes + id,
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
          } else if (success) {
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
      if (!force && this.bgm) {
        setTimeout(function() {
          self.callback(callback, true);
        }, 0);
      } else {
        xhr({
          url: this.url + this.options.bgm,
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
})(hyperaudio);
