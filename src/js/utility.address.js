/* Address
 *
 */

var Address = (function(hyperaudio) {
  // Refs:
  // http://diveintohtml5.info/history.html
  // http://stackoverflow.com/questions/824349/modify-the-url-without-reloading-the-page

  var DEBUG = true;

  return {
    init: function(options) {
      var self = this;

      this.options = hyperaudio.extend(
        {
          title: 'Hyperaudio Pad'
        },
        options
      );

      // Properties
      this.enabled = false;
      this.status = {
        iframe: false,
        remote: false,
        support: false
      };

      // See if security allowed via same domain policy.
      try {
        window.top.document.createElement('div');

        // See if we are in an iframe
        if (window.top.document !== document) {
          this.status.iframe = true;
        }
      } catch (error) {
        this.status.iframe = true;
        this.status.remote = true;
      }

      // Pick which window to use.
      if (this.status.remote || !this.status.iframe) {
        this.win = window;
      } else {
        this.win = window.top;
      }

      if (this.win.history && this.win.history.replaceState) {
        this.status.support = true;
      }

      if (DEBUG)
        console.log(
          '[History|init] status: { iframe: ' +
            this.status.iframe +
            ', remote: ' +
            this.status.remote +
            ', support: ' +
            this.status.support +
            ' }'
        );

      this.enable();
    },
    enable: function() {
      if (this.status.support) {
        this.enabled = true;
      }
      return this.enabled;
    },
    disable: function() {
      this.enabled = false;
    },
    getUrlDetail: function() {
      var url = this.win.document.location.href;
      var base_url = url;
      var param_index = url.indexOf('?');
      var param_url = '';
      var hash_index = url.indexOf('#');
      var hash_url = '';

      // Do we have any parameters
      if (param_index >= 0) {
        base_url = url.slice(0, param_index);
        // Do we have any hash chars
        if (hash_index >= 0) {
          param_url = url.slice(param_index + 1, hash_index);
          hash_url = url.slice(hash_index + 1);
        } else {
          param_url = url.slice(param_index + 1);
        }
      } else {
        // Do we have any hash chars
        if (hash_index >= 0) {
          base_url = url.slice(0, hash_index);
          hash_url = url.slice(hash_index + 1);
        }
      }

      var value_pair = param_url.split('&');
      var pair;
      var param = {};

      for (var i = 0, iLen = value_pair.length; i < iLen; i++) {
        pair = value_pair[i].split('=');
        if (pair.length === 2) {
          param[pair[0]] = pair[1]; // May need to URL decode here
        }
      }

      return {
        base: base_url,
        param: param,
        hash: hash_url
      };
    },
    buildUrl: function(detail) {
      var first = true;
      var href = detail.base;
      for (var name in detail.param) {
        if (detail.param.hasOwnProperty(name)) {
          if (first) {
            first = false;
            href += '?';
          } else {
            href += '&';
          }
          href += name + '=' + detail.param[name];
        }
      }
      if (detail.hash) {
        href += '#' + detail.hash;
      }
      if (DEBUG) console.log('[History|buildUrl] href = "' + href + '"');
      return href;
    },
    setParam: function(name, value) {
      // The value should be a string. An undefined will remove the parameter.
      if (this.enabled) {
        var detail = this.getUrlDetail();
        var save = false;
        if (typeof value === 'string') {
          if (detail.param[name] !== value) {
            detail.param[name] = value;
            save = true;
            if (DEBUG)
              console.log('[History|setParam] NEW VALUE | "' + name + '" = "' + value + '"');
          }
        } else {
          if (typeof detail.param[name] !== 'undefined') {
            delete detail.param[name];
            save = true;
            if (DEBUG)
              console.log('[History|setParam] DELETE VALUE | "' + name + '" = "' + value + '"');
          }
        }
        if (save) {
          this.win.history.replaceState(null, this.options.title, this.buildUrl(detail));
        }
      }
    },
    getParam: function(name) {
      if (this.enabled) {
        var detail = this.getUrlDetail();
        return detail.param[name];
      }
    }
  };
})(hyperaudio);
