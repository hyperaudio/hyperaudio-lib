/*! hyperaudio-lib v0.7.0 ~ (c) 2012-2017 Hyperaudio Inc. <hello@hyperaud.io> (http://hyperaud.io) http://hyperaud.io/licensing/ ~ Built: 13th November 2017 15:29:49 */
(function(global, document) {

  // Popcorn.js does not support archaic browsers
  if ( !document.addEventListener ) {
    global.Popcorn = {
      isSupported: false
    };

    var methods = ( "byId forEach extend effects error guid sizeOf isArray nop position disable enable destroy" +
          "addTrackEvent removeTrackEvent getTrackEvents getTrackEvent getLastTrackEventId " +
          "timeUpdate plugin removePlugin compose effect xhr getJSONP getScript" ).split(/\s+/);

    while ( methods.length ) {
      global.Popcorn[ methods.shift() ] = function() {};
    }
    return;
  }

  var

  AP = Array.prototype,
  OP = Object.prototype,

  forEach = AP.forEach,
  slice = AP.slice,
  hasOwn = OP.hasOwnProperty,
  toString = OP.toString,

  // Copy global Popcorn (may not exist)
  _Popcorn = global.Popcorn,

  //  Ready fn cache
  readyStack = [],
  readyBound = false,
  readyFired = false,

  //  Non-public internal data object
  internal = {
    events: {
      hash: {},
      apis: {}
    }
  },

  //  Non-public `requestAnimFrame`
  //  http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  requestAnimFrame = (function(){
    return global.requestAnimationFrame ||
      global.webkitRequestAnimationFrame ||
      global.mozRequestAnimationFrame ||
      global.oRequestAnimationFrame ||
      global.msRequestAnimationFrame ||
      function( callback, element ) {
        global.setTimeout( callback, 16 );
      };
  }()),

  //  Non-public `getKeys`, return an object's keys as an array
  getKeys = function( obj ) {
    return Object.keys ? Object.keys( obj ) : (function( obj ) {
      var item,
          list = [];

      for ( item in obj ) {
        if ( hasOwn.call( obj, item ) ) {
          list.push( item );
        }
      }
      return list;
    })( obj );
  },

  Abstract = {
    // [[Put]] props from dictionary onto |this|
    // MUST BE CALLED FROM WITHIN A CONSTRUCTOR:
    //  Abstract.put.call( this, dictionary );
    put: function( dictionary ) {
      // For each own property of src, let key be the property key
      // and desc be the property descriptor of the property.
      for ( var key in dictionary ) {
        if ( dictionary.hasOwnProperty( key ) ) {
          this[ key ] = dictionary[ key ];
        }
      }
    }
  },


  //  Declare constructor
  //  Returns an instance object.
  Popcorn = function( entity, options ) {
    //  Return new Popcorn object
    return new Popcorn.p.init( entity, options || null );
  };

  //  Popcorn API version, automatically inserted via build system.
  Popcorn.version = "@VERSION";

  //  Boolean flag allowing a client to determine if Popcorn can be supported
  Popcorn.isSupported = true;

  //  Instance caching
  Popcorn.instances = [];

  //  Declare a shortcut (Popcorn.p) to and a definition of
  //  the new prototype for our Popcorn constructor
  Popcorn.p = Popcorn.prototype = {

    init: function( entity, options ) {

      var matches, nodeName,
          self = this;

      //  Supports Popcorn(function () { /../ })
      //  Originally proposed by Daniel Brooks

      if ( typeof entity === "function" ) {

        //  If document ready has already fired
        if ( document.readyState === "complete" ) {

          entity( document, Popcorn );

          return;
        }
        //  Add `entity` fn to ready stack
        readyStack.push( entity );

        //  This process should happen once per page load
        if ( !readyBound ) {

          //  set readyBound flag
          readyBound = true;

          var DOMContentLoaded  = function() {

            readyFired = true;

            //  Remove global DOM ready listener
            document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );

            //  Execute all ready function in the stack
            for ( var i = 0, readyStackLength = readyStack.length; i < readyStackLength; i++ ) {

              readyStack[ i ].call( document, Popcorn );

            }
            //  GC readyStack
            readyStack = null;
          };

          //  Register global DOM ready listener
          document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );
        }

        return;
      }

      if ( typeof entity === "string" ) {
        try {
          matches = document.querySelector( entity );
        } catch( e ) {
          throw new Error( "Popcorn.js Error: Invalid media element selector: " + entity );
        }
      }

      //  Get media element by id or object reference
      this.media = matches || entity;

      //  inner reference to this media element's nodeName string value
      nodeName = ( this.media.nodeName && this.media.nodeName.toLowerCase() ) || "video";

      //  Create an audio or video element property reference
      this[ nodeName ] = this.media;

      this.options = Popcorn.extend( {}, options ) || {};

      //  Resolve custom ID or default prefixed ID
      this.id = this.options.id || Popcorn.guid( nodeName );

      //  Throw if an attempt is made to use an ID that already exists
      if ( Popcorn.byId( this.id ) ) {
        throw new Error( "Popcorn.js Error: Cannot use duplicate ID (" + this.id + ")" );
      }

      this.isDestroyed = false;

      this.data = {

        // data structure of all
        running: {
          cue: []
        },

        // Executed by either timeupdate event or in rAF loop
        timeUpdate: Popcorn.nop,

        // Allows disabling a plugin per instance
        disabled: {},

        // Stores DOM event queues by type
        events: {},

        // Stores Special event hooks data
        hooks: {},

        // Store track event history data
        history: [],

        // Stores ad-hoc state related data]
        state: {
          volume: this.media.volume
        },

        // Store track event object references by trackId
        trackRefs: {},

        // Playback track event queues
        trackEvents: new TrackEvents( this )
      };

      //  Register new instance
      Popcorn.instances.push( this );

      //  function to fire when video is ready
      var isReady = function() {

        // chrome bug: http://code.google.com/p/chromium/issues/detail?id=119598
        // it is possible the video's time is less than 0
        // this has the potential to call track events more than once, when they should not
        // start: 0, end: 1 will start, end, start again, when it should just start
        // just setting it to 0 if it is below 0 fixes this issue
        if ( self.media.currentTime < 0 ) {

          self.media.currentTime = 0;
        }

        self.media.removeEventListener( "loadedmetadata", isReady, false );

        var duration, videoDurationPlus,
            runningPlugins, runningPlugin, rpLength, rpNatives;

        //  Adding padding to the front and end of the arrays
        //  this is so we do not fall off either end
        duration = self.media.duration;

        //  Check for no duration info (NaN)
        videoDurationPlus = duration != duration ? Number.MAX_VALUE : duration + 1;

        Popcorn.addTrackEvent( self, {
          start: videoDurationPlus,
          end: videoDurationPlus
        });

        if ( !self.isDestroyed ) {
          self.data.durationChange = function() {
            var newDuration = self.media.duration,
                newDurationPlus = newDuration + 1,
                byStart = self.data.trackEvents.byStart,
                byEnd = self.data.trackEvents.byEnd;

            // Remove old padding events
            byStart.pop();
            byEnd.pop();

            // Remove any internal tracking of events that have end times greater than duration
            // otherwise their end events will never be hit.
            for ( var k = byEnd.length - 1; k > 0; k-- ) {
              if ( byEnd[ k ].end > newDuration ) {
                self.removeTrackEvent( byEnd[ k ]._id );
              }
            }

            // Remove any internal tracking of events that have end times greater than duration
            // otherwise their end events will never be hit.
            for ( var i = 0; i < byStart.length; i++ ) {
              if ( byStart[ i ].end > newDuration ) {
                self.removeTrackEvent( byStart[ i ]._id );
              }
            }

            // References to byEnd/byStart are reset, so accessing it this way is
            // forced upon us.
            self.data.trackEvents.byEnd.push({
              start: newDurationPlus,
              end: newDurationPlus
            });

            self.data.trackEvents.byStart.push({
              start: newDurationPlus,
              end: newDurationPlus
            });
          };

          // Listen for duration changes and adjust internal tracking of event timings
          self.media.addEventListener( "durationchange", self.data.durationChange, false );
        }

        if ( self.options.frameAnimation ) {

          //  if Popcorn is created with frameAnimation option set to true,
          //  requestAnimFrame is used instead of "timeupdate" media event.
          //  This is for greater frame time accuracy, theoretically up to
          //  60 frames per second as opposed to ~4 ( ~every 15-250ms)
          self.data.timeUpdate = function () {

            Popcorn.timeUpdate( self, {} );

            // fire frame for each enabled active plugin of every type
            Popcorn.forEach( Popcorn.manifest, function( key, val ) {

              runningPlugins = self.data.running[ val ];

              // ensure there are running plugins on this type on this instance
              if ( runningPlugins ) {

                rpLength = runningPlugins.length;
                for ( var i = 0; i < rpLength; i++ ) {

                  runningPlugin = runningPlugins[ i ];
                  rpNatives = runningPlugin._natives;
                  rpNatives && rpNatives.frame &&
                    rpNatives.frame.call( self, {}, runningPlugin, self.currentTime() );
                }
              }
            });

            self.emit( "timeupdate" );

            !self.isDestroyed && requestAnimFrame( self.data.timeUpdate );
          };

          !self.isDestroyed && requestAnimFrame( self.data.timeUpdate );

        } else {

          self.data.timeUpdate = function( event ) {
            Popcorn.timeUpdate( self, event );
          };

          if ( !self.isDestroyed ) {
            self.media.addEventListener( "timeupdate", self.data.timeUpdate, false );
          }
        }
      };

      self.media.addEventListener( "error", function() {
        self.error = self.media.error;
      }, false );

      // http://www.whatwg.org/specs/web-apps/current-work/#dom-media-readystate
      //
      // If media is in readyState (rS) >= 1, we know the media's duration,
      // which is required before running the isReady function.
      // If rS is 0, attach a listener for "loadedmetadata",
      // ( Which indicates that the media has moved from rS 0 to 1 )
      //
      // This has been changed from a check for rS 2 because
      // in certain conditions, Firefox can enter this code after dropping
      // to rS 1 from a higher state such as 2 or 3. This caused a "loadeddata"
      // listener to be attached to the media object, an event that had
      // already triggered and would not trigger again. This left Popcorn with an
      // instance that could never start a timeUpdate loop.
      if ( self.media.readyState >= 1 ) {

        isReady();
      } else {

        self.media.addEventListener( "loadedmetadata", isReady, false );
      }

      return this;
    }
  };

  //  Extend constructor prototype to instance prototype
  //  Allows chaining methods to instances
  Popcorn.p.init.prototype = Popcorn.p;

  Popcorn.byId = function( str ) {
    var instances = Popcorn.instances,
        length = instances.length,
        i = 0;

    for ( ; i < length; i++ ) {
      if ( instances[ i ].id === str ) {
        return instances[ i ];
      }
    }

    return null;
  };

  Popcorn.forEach = function( obj, fn, context ) {

    if ( !obj || !fn ) {
      return {};
    }

    context = context || this;

    var key, len;

    // Use native whenever possible
    if ( forEach && obj.forEach === forEach ) {
      return obj.forEach( fn, context );
    }

    if ( toString.call( obj ) === "[object NodeList]" ) {
      for ( key = 0, len = obj.length; key < len; key++ ) {
        fn.call( context, obj[ key ], key, obj );
      }
      return obj;
    }

    for ( key in obj ) {
      if ( hasOwn.call( obj, key ) ) {
        fn.call( context, obj[ key ], key, obj );
      }
    }
    return obj;
  };

  Popcorn.extend = function( obj ) {
    var dest = obj, src = slice.call( arguments, 1 );

    Popcorn.forEach( src, function( copy ) {
      for ( var prop in copy ) {
        dest[ prop ] = copy[ prop ];
      }
    });

    return dest;
  };


  // A Few reusable utils, memoized onto Popcorn
  Popcorn.extend( Popcorn, {
    noConflict: function( deep ) {

      if ( deep ) {
        global.Popcorn = _Popcorn;
      }

      return Popcorn;
    },
    error: function( msg ) {
      throw new Error( msg );
    },
    guid: function( prefix ) {
      Popcorn.guid.counter++;
      return  ( prefix ? prefix : "" ) + ( +new Date() + Popcorn.guid.counter );
    },
    sizeOf: function( obj ) {
      var size = 0;

      for ( var prop in obj ) {
        size++;
      }

      return size;
    },
    isArray: Array.isArray || function( array ) {
      return toString.call( array ) === "[object Array]";
    },

    nop: function() {},

    position: function( elem ) {

      if ( !elem.parentNode ) {
        return null;
      }

      var clientRect = elem.getBoundingClientRect(),
          bounds = {},
          doc = elem.ownerDocument,
          docElem = document.documentElement,
          body = document.body,
          clientTop, clientLeft, scrollTop, scrollLeft, top, left;

      //  Determine correct clientTop/Left
      clientTop = docElem.clientTop || body.clientTop || 0;
      clientLeft = docElem.clientLeft || body.clientLeft || 0;

      //  Determine correct scrollTop/Left
      scrollTop = ( global.pageYOffset && docElem.scrollTop || body.scrollTop );
      scrollLeft = ( global.pageXOffset && docElem.scrollLeft || body.scrollLeft );

      //  Temp top/left
      top = Math.ceil( clientRect.top + scrollTop - clientTop );
      left = Math.ceil( clientRect.left + scrollLeft - clientLeft );

      for ( var p in clientRect ) {
        bounds[ p ] = Math.round( clientRect[ p ] );
      }

      return Popcorn.extend({}, bounds, { top: top, left: left });
    },

    disable: function( instance, plugin ) {

      if ( instance.data.disabled[ plugin ] ) {
        return;
      }

      instance.data.disabled[ plugin ] = true;

      if ( plugin in Popcorn.registryByName &&
           instance.data.running[ plugin ] ) {

        for ( var i = instance.data.running[ plugin ].length - 1, event; i >= 0; i-- ) {

          event = instance.data.running[ plugin ][ i ];
          event._natives.end.call( instance, null, event  );

          instance.emit( "trackend",
            Popcorn.extend({}, event, {
              plugin: event.type,
              type: "trackend"
            })
          );
        }
      }

      return instance;
    },
    enable: function( instance, plugin ) {

      if ( !instance.data.disabled[ plugin ] ) {
        return;
      }

      instance.data.disabled[ plugin ] = false;

      if ( plugin in Popcorn.registryByName &&
           instance.data.running[ plugin ] ) {

        for ( var i = instance.data.running[ plugin ].length - 1, event; i >= 0; i-- ) {

          event = instance.data.running[ plugin ][ i ];
          event._natives.start.call( instance, null, event  );

          instance.emit( "trackstart",
            Popcorn.extend({}, event, {
              plugin: event.type,
              type: "trackstart",
              track: event
            })
          );
        }
      }

      return instance;
    },
    destroy: function( instance ) {
      var events = instance.data.events,
          trackEvents = instance.data.trackEvents,
          singleEvent, item, fn, plugin;

      //  Iterate through all events and remove them
      for ( item in events ) {
        singleEvent = events[ item ];
        for ( fn in singleEvent ) {
          delete singleEvent[ fn ];
        }
        events[ item ] = null;
      }

      // remove all plugins off the given instance
      for ( plugin in Popcorn.registryByName ) {
        Popcorn.removePlugin( instance, plugin );
      }

      // Remove all data.trackEvents #1178
      trackEvents.byStart.length = 0;
      trackEvents.byEnd.length = 0;

      if ( !instance.isDestroyed ) {
        instance.data.timeUpdate && instance.media.removeEventListener( "timeupdate", instance.data.timeUpdate, false );
        instance.isDestroyed = true;
      }

      Popcorn.instances.splice( Popcorn.instances.indexOf( instance ), 1 );
    }
  });

  //  Memoized GUID Counter
  Popcorn.guid.counter = 1;

  //  Factory to implement getters, setters and controllers
  //  as Popcorn instance methods. The IIFE will create and return
  //  an object with defined methods
  Popcorn.extend(Popcorn.p, (function() {

      var methods = "load play pause currentTime playbackRate volume duration preload playbackRate " +
                    "autoplay loop controls muted buffered readyState seeking paused played seekable ended",
          ret = {};


      //  Build methods, store in object that is returned and passed to extend
      Popcorn.forEach( methods.split( /\s+/g ), function( name ) {

        ret[ name ] = function( arg ) {
          var previous;

          if ( typeof this.media[ name ] === "function" ) {

            // Support for shorthanded play(n)/pause(n) jump to currentTime
            // If arg is not null or undefined and called by one of the
            // allowed shorthandable methods, then set the currentTime
            // Supports time as seconds or SMPTE
            if ( arg != null && /play|pause/.test( name ) ) {
              this.media.currentTime = Popcorn.util.toSeconds( arg );
            }

            this.media[ name ]();

            return this;
          }

          if ( arg != null ) {
            // Capture the current value of the attribute property
            previous = this.media[ name ];

            // Set the attribute property with the new value
            this.media[ name ] = arg;

            // If the new value is not the same as the old value
            // emit an "attrchanged event"
            if ( previous !== arg ) {
              this.emit( "attrchange", {
                attribute: name,
                previousValue: previous,
                currentValue: arg
              });
            }
            return this;
          }

          return this.media[ name ];
        };
      });

      return ret;

    })()
  );

  Popcorn.forEach( "enable disable".split(" "), function( method ) {
    Popcorn.p[ method ] = function( plugin ) {
      return Popcorn[ method ]( this, plugin );
    };
  });

  Popcorn.extend(Popcorn.p, {

    //  Rounded currentTime
    roundTime: function() {
      return Math.round( this.media.currentTime );
    },

    //  Attach an event to a single point in time
    exec: function( id, time, fn ) {
      var length = arguments.length,
          eventType = "trackadded",
          trackEvent, sec, options;

      // Check if first could possibly be a SMPTE string
      // p.cue( "smpte string", fn );
      // try/catch avoid awful throw in Popcorn.util.toSeconds
      // TODO: Get rid of that, replace with NaN return?
      try {
        sec = Popcorn.util.toSeconds( id );
      } catch ( e ) {}

      // If it can be converted into a number then
      // it's safe to assume that the string was SMPTE
      if ( typeof sec === "number" ) {
        id = sec;
      }

      // Shift arguments based on use case
      //
      // Back compat for:
      // p.cue( time, fn );
      if ( typeof id === "number" && length === 2 ) {
        fn = time;
        time = id;
        id = Popcorn.guid( "cue" );
      } else {
        // Support for new forms

        // p.cue( "empty-cue" );
        if ( length === 1 ) {
          // Set a time for an empty cue. It's not important what
          // the time actually is, because the cue is a no-op
          time = -1;

        } else {

          // Get the TrackEvent that matches the given id.
          trackEvent = this.getTrackEvent( id );

          if ( trackEvent ) {

            // remove existing cue so a new one can be added via trackEvents.add
            this.data.trackEvents.remove( id );
            TrackEvent.end( this, trackEvent );
            // Update track event references
            Popcorn.removeTrackEvent.ref( this, id );

            eventType = "cuechange";

            // p.cue( "my-id", 12 );
            // p.cue( "my-id", function() { ... });
            if ( typeof id === "string" && length === 2 ) {

              // p.cue( "my-id", 12 );
              // The path will update the cue time.
              if ( typeof time === "number" ) {
                // Re-use existing TrackEvent start callback
                fn = trackEvent._natives.start;
              }

              // p.cue( "my-id", function() { ... });
              // The path will update the cue function
              if ( typeof time === "function" ) {
                fn = time;
                // Re-use existing TrackEvent start time
                time = trackEvent.start;
              }
            }
          } else {

            if ( length >= 2 ) {

              // p.cue( "a", "00:00:00");
              if ( typeof time === "string" ) {
                try {
                  sec = Popcorn.util.toSeconds( time );
                } catch ( e ) {}

                time = sec;
              }

              // p.cue( "b", 11 );
              // p.cue( "b", 11, function() {} );
              if ( typeof time === "number" ) {
                fn = fn || Popcorn.nop();
              }

              // p.cue( "c", function() {});
              if ( typeof time === "function" ) {
                fn = time;
                time = -1;
              }
            }
          }
        }
      }

      options = {
        id: id,
        start: time,
        end: time + 1,
        _running: false,
        _natives: {
          start: fn || Popcorn.nop,
          end: Popcorn.nop,
          type: "cue"
        }
      };

      if ( trackEvent ) {
        options = Popcorn.extend( trackEvent, options );
      }

      if ( eventType === "cuechange" ) {

        //  Supports user defined track event id
        options._id = options.id || options._id || Popcorn.guid( options._natives.type );

        this.data.trackEvents.add( options );
        TrackEvent.start( this, options );

        this.timeUpdate( this, null, true );

        // Store references to user added trackevents in ref table
        Popcorn.addTrackEvent.ref( this, options );

        this.emit( eventType, Popcorn.extend({}, options, {
          id: id,
          type: eventType,
          previousValue: {
            time: trackEvent.start,
            fn: trackEvent._natives.start
          },
          currentValue: {
            time: time,
            fn: fn || Popcorn.nop
          },
          track: trackEvent
        }));
      } else {
        //  Creating a one second track event with an empty end
        Popcorn.addTrackEvent( this, options );
      }

      return this;
    },

    // Mute the calling media, optionally toggle
    mute: function( toggle ) {

      var event = toggle == null || toggle === true ? "muted" : "unmuted";

      // If `toggle` is explicitly `false`,
      // unmute the media and restore the volume level
      if ( event === "unmuted" ) {
        this.media.muted = false;
        this.media.volume = this.data.state.volume;
      }

      // If `toggle` is either null or undefined,
      // save the current volume and mute the media element
      if ( event === "muted" ) {
        this.data.state.volume = this.media.volume;
        this.media.muted = true;
      }

      // Trigger either muted|unmuted event
      this.emit( event );

      return this;
    },

    // Convenience method, unmute the calling media
    unmute: function( toggle ) {

      return this.mute( toggle == null ? false : !toggle );
    },

    // Get the client bounding box of an instance element
    position: function() {
      return Popcorn.position( this.media );
    },

    // Toggle a plugin's playback behaviour (on or off) per instance
    toggle: function( plugin ) {
      return Popcorn[ this.data.disabled[ plugin ] ? "enable" : "disable" ]( this, plugin );
    },

    // Set default values for plugin options objects per instance
    defaults: function( plugin, defaults ) {

      // If an array of default configurations is provided,
      // iterate and apply each to this instance
      if ( Popcorn.isArray( plugin ) ) {

        Popcorn.forEach( plugin, function( obj ) {
          for ( var name in obj ) {
            this.defaults( name, obj[ name ] );
          }
        }, this );

        return this;
      }

      if ( !this.options.defaults ) {
        this.options.defaults = {};
      }

      if ( !this.options.defaults[ plugin ] ) {
        this.options.defaults[ plugin ] = {};
      }

      Popcorn.extend( this.options.defaults[ plugin ], defaults );

      return this;
    }
  });

  Popcorn.Events  = {
    UIEvents: "blur focus focusin focusout load resize scroll unload",
    MouseEvents: "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave click dblclick",
    Events: "loadstart progress suspend emptied stalled play pause error " +
            "loadedmetadata loadeddata waiting playing canplay canplaythrough " +
            "seeking seeked timeupdate ended ratechange durationchange volumechange"
  };

  Popcorn.Events.Natives = Popcorn.Events.UIEvents + " " +
                           Popcorn.Events.MouseEvents + " " +
                           Popcorn.Events.Events;

  internal.events.apiTypes = [ "UIEvents", "MouseEvents", "Events" ];

  // Privately compile events table at load time
  (function( events, data ) {

    var apis = internal.events.apiTypes,
    eventsList = events.Natives.split( /\s+/g ),
    idx = 0, len = eventsList.length, prop;

    for( ; idx < len; idx++ ) {
      data.hash[ eventsList[idx] ] = true;
    }

    apis.forEach(function( val, idx ) {

      data.apis[ val ] = {};

      var apiEvents = events[ val ].split( /\s+/g ),
      len = apiEvents.length,
      k = 0;

      for ( ; k < len; k++ ) {
        data.apis[ val ][ apiEvents[ k ] ] = true;
      }
    });
  })( Popcorn.Events, internal.events );

  Popcorn.events = {

    isNative: function( type ) {
      return !!internal.events.hash[ type ];
    },
    getInterface: function( type ) {

      if ( !Popcorn.events.isNative( type ) ) {
        return false;
      }

      var eventApi = internal.events,
        apis = eventApi.apiTypes,
        apihash = eventApi.apis,
        idx = 0, len = apis.length, api, tmp;

      for ( ; idx < len; idx++ ) {
        tmp = apis[ idx ];

        if ( apihash[ tmp ][ type ] ) {
          api = tmp;
          break;
        }
      }
      return api;
    },
    //  Compile all native events to single array
    all: Popcorn.Events.Natives.split( /\s+/g ),
    //  Defines all Event handling static functions
    fn: {
      trigger: function( type, data ) {
        var eventInterface, evt, clonedEvents,
            events = this.data.events[ type ];

        //  setup checks for custom event system
        if ( events ) {
          eventInterface  = Popcorn.events.getInterface( type );

          if ( eventInterface ) {
            evt = document.createEvent( eventInterface );
            evt.initEvent( type, true, true, global, 1 );

            this.media.dispatchEvent( evt );

            return this;
          }

          // clone events in case callbacks remove callbacks themselves
          clonedEvents = events.slice();

          // iterate through all callbacks
          while ( clonedEvents.length ) {
            clonedEvents.shift().call( this, data );
          }
        }

        return this;
      },
      listen: function( type, fn ) {
        var self = this,
            hasEvents = true,
            eventHook = Popcorn.events.hooks[ type ],
            origType = type,
            clonedEvents,
            tmp;

        if ( typeof fn !== "function" ) {
          throw new Error( "Popcorn.js Error: Listener is not a function" );
        }

        // Setup event registry entry
        if ( !this.data.events[ type ] ) {
          this.data.events[ type ] = [];
          // Toggle if the previous assumption was untrue
          hasEvents = false;
        }

        // Check and setup event hooks
        if ( eventHook ) {
          // Execute hook add method if defined
          if ( eventHook.add ) {
            eventHook.add.call( this, {}, fn );
          }

          // Reassign event type to our piggyback event type if defined
          if ( eventHook.bind ) {
            type = eventHook.bind;
          }

          // Reassign handler if defined
          if ( eventHook.handler ) {
            tmp = fn;

            fn = function wrapper( event ) {
              eventHook.handler.call( self, event, tmp );
            };
          }

          // assume the piggy back event is registered
          hasEvents = true;

          // Setup event registry entry
          if ( !this.data.events[ type ] ) {
            this.data.events[ type ] = [];
            // Toggle if the previous assumption was untrue
            hasEvents = false;
          }
        }

        //  Register event and handler
        this.data.events[ type ].push( fn );

        // only attach one event of any type
        if ( !hasEvents && Popcorn.events.all.indexOf( type ) > -1 ) {
          this.media.addEventListener( type, function( event ) {
            if ( self.data.events[ type ] ) {
              // clone events in case callbacks remove callbacks themselves
              clonedEvents = self.data.events[ type ].slice();

              // iterate through all callbacks
              while ( clonedEvents.length ) {
                clonedEvents.shift().call( self, event );
              }
            }
          }, false );
        }
        return this;
      },
      unlisten: function( type, fn ) {
        var ind,
            events = this.data.events[ type ];

        if ( !events ) {
          return; // no listeners = nothing to do
        }

        if ( typeof fn === "string" ) {
          // legacy support for string-based removal -- not recommended
          for ( var i = 0; i < events.length; i++ ) {
            if ( events[ i ].name === fn ) {
              // decrement i because array length just got smaller
              events.splice( i--, 1 );
            }
          }

          return this;
        } else if ( typeof fn === "function" ) {
          while( ind !== -1 ) {
            ind = events.indexOf( fn );
            if ( ind !== -1 ) {
              events.splice( ind, 1 );
            }
          }

          return this;
        }

        // if we got to this point, we are deleting all functions of this type
        this.data.events[ type ] = null;

        return this;
      }
    },
    hooks: {
      canplayall: {
        bind: "canplaythrough",
        add: function( event, callback ) {

          var state = false;

          if ( this.media.readyState ) {

            // always call canplayall asynchronously
            setTimeout(function() {
              callback.call( this, event );
            }.bind(this), 0 );

            state = true;
          }

          this.data.hooks.canplayall = {
            fired: state
          };
        },
        // declare special handling instructions
        handler: function canplayall( event, callback ) {

          if ( !this.data.hooks.canplayall.fired ) {
            // trigger original user callback once
            callback.call( this, event );

            this.data.hooks.canplayall.fired = true;
          }
        }
      }
    }
  };

  //  Extend Popcorn.events.fns (listen, unlisten, trigger) to all Popcorn instances
  //  Extend aliases (on, off, emit)
  Popcorn.forEach( [ [ "trigger", "emit" ], [ "listen", "on" ], [ "unlisten", "off" ] ], function( key ) {
    Popcorn.p[ key[ 0 ] ] = Popcorn.p[ key[ 1 ] ] = Popcorn.events.fn[ key[ 0 ] ];
  });

  // Internal Only - construct simple "TrackEvent"
  // data type objects
  function TrackEvent( track ) {
    Abstract.put.call( this, track );
  }

  // Determine if a TrackEvent's "start" and "trackstart" must be called.
  TrackEvent.start = function( instance, track ) {

    if ( track.end > instance.media.currentTime &&
        track.start <= instance.media.currentTime && !track._running ) {

      track._running = true;
      instance.data.running[ track._natives.type ].push( track );

      if ( !instance.data.disabled[ track._natives.type ] ) {

        track._natives.start.call( instance, null, track );

        instance.emit( "trackstart",
          Popcorn.extend( {}, track, {
            plugin: track._natives.type,
            type: "trackstart",
            track: track
          })
        );
      }
    }
  };

  // Determine if a TrackEvent's "end" and "trackend" must be called.
  TrackEvent.end = function( instance, track ) {

    var runningPlugins;

    if ( ( track.end <= instance.media.currentTime ||
        track.start > instance.media.currentTime ) && track._running ) {

      runningPlugins = instance.data.running[ track._natives.type ];

      track._running = false;
      runningPlugins.splice( runningPlugins.indexOf( track ), 1 );

      if ( !instance.data.disabled[ track._natives.type ] ) {

        track._natives.end.call( instance, null, track );

        instance.emit( "trackend",
          Popcorn.extend( {}, track, {
            plugin: track._natives.type,
            type: "trackend",
            track: track
          })
        );
      }
    }
  };

  // Internal Only - construct "TrackEvents"
  // data type objects that are used by the Popcorn
  // instance, stored at p.data.trackEvents
  function TrackEvents( parent ) {
    this.parent = parent;

    this.byStart = [{
      start: -1,
      end: -1
    }];

    this.byEnd = [{
      start: -1,
      end: -1
    }];
    this.animating = [];
    this.startIndex = 0;
    this.endIndex = 0;
    this.previousUpdateTime = -1;

    this.count = 1;
  }

  function isMatch( obj, key, value ) {
    return obj[ key ] && obj[ key ] === value;
  }

  TrackEvents.prototype.where = function( params ) {
    return ( this.parent.getTrackEvents() || [] ).filter(function( event ) {
      var key, value;

      // If no explicit params, match all TrackEvents
      if ( !params ) {
        return true;
      }

      // Filter keys in params against both the top level properties
      // and the _natives properties
      for ( key in params ) {
        value = params[ key ];
        if ( isMatch( event, key, value ) || isMatch( event._natives, key, value ) ) {
          return true;
        }
      }
      return false;
    });
  };

  TrackEvents.prototype.add = function( track ) {

    //  Store this definition in an array sorted by times
    var byStart = this.byStart,
        byEnd = this.byEnd,
        startIndex, endIndex;

    //  Push track event ids into the history
    if ( track && track._id ) {
      this.parent.data.history.push( track._id );
    }

    track.start = Popcorn.util.toSeconds( track.start, this.parent.options.framerate );
    track.end   = Popcorn.util.toSeconds( track.end, this.parent.options.framerate );

    for ( startIndex = byStart.length - 1; startIndex >= 0; startIndex-- ) {

      if ( track.start >= byStart[ startIndex ].start ) {
        byStart.splice( startIndex + 1, 0, track );
        break;
      }
    }

    for ( endIndex = byEnd.length - 1; endIndex >= 0; endIndex-- ) {

      if ( track.end > byEnd[ endIndex ].end ) {
        byEnd.splice( endIndex + 1, 0, track );
        break;
      }
    }

    // update startIndex and endIndex
    if ( startIndex <= this.parent.data.trackEvents.startIndex &&
      track.start <= this.parent.data.trackEvents.previousUpdateTime ) {

      this.parent.data.trackEvents.startIndex++;
    }

    if ( endIndex <= this.parent.data.trackEvents.endIndex &&
      track.end < this.parent.data.trackEvents.previousUpdateTime ) {

      this.parent.data.trackEvents.endIndex++;
    }

    this.count++;

  };

  TrackEvents.prototype.remove = function( removeId, state ) {

    if ( removeId instanceof TrackEvent ) {
      removeId = removeId.id;
    }

    if ( typeof removeId === "object" ) {
      // Filter by key=val and remove all matching TrackEvents
      this.where( removeId ).forEach(function( event ) {
        // |this| refers to the calling Popcorn "parent" instance
        this.removeTrackEvent( event._id );
      }, this.parent );

      return this;
    }

    var start, end, animate, historyLen, track,
        length = this.byStart.length,
        index = 0,
        indexWasAt = 0,
        byStart = [],
        byEnd = [],
        animating = [],
        history = [],
        comparable = {};

    state = state || {};

    while ( --length > -1 ) {
      start = this.byStart[ index ];
      end = this.byEnd[ index ];

      // Padding events will not have _id properties.
      // These should be safely pushed onto the front and back of the
      // track event array
      if ( !start._id ) {
        byStart.push( start );
        byEnd.push( end );
      }

      // Filter for user track events (vs system track events)
      if ( start._id ) {

        // If not a matching start event for removal
        if ( start._id !== removeId ) {
          byStart.push( start );
        }

        // If not a matching end event for removal
        if ( end._id !== removeId ) {
          byEnd.push( end );
        }

        // If the _id is matched, capture the current index
        if ( start._id === removeId ) {
          indexWasAt = index;

          // cache the track event being removed
          track = start;
        }
      }
      // Increment the track index
      index++;
    }

    // Reset length to be used by the condition below to determine
    // if animating track events should also be filtered for removal.
    // Reset index below to be used by the reverse while as an
    // incrementing counter
    length = this.animating.length;
    index = 0;

    if ( length ) {
      while ( --length > -1 ) {
        animate = this.animating[ index ];

        // Padding events will not have _id properties.
        // These should be safely pushed onto the front and back of the
        // track event array
        if ( !animate._id ) {
          animating.push( animate );
        }

        // If not a matching animate event for removal
        if ( animate._id && animate._id !== removeId ) {
          animating.push( animate );
        }
        // Increment the track index
        index++;
      }
    }

    //  Update
    if ( indexWasAt <= this.startIndex ) {
      this.startIndex--;
    }

    if ( indexWasAt <= this.endIndex ) {
      this.endIndex--;
    }

    this.byStart = byStart;
    this.byEnd = byEnd;
    this.animating = animating;
    this.count--;

    historyLen = this.parent.data.history.length;

    for ( var i = 0; i < historyLen; i++ ) {
      if ( this.parent.data.history[ i ] !== removeId ) {
        history.push( this.parent.data.history[ i ] );
      }
    }

    // Update ordered history array
    this.parent.data.history = history;

  };

  // Helper function used to retrieve old values of properties that
  // are provided for update.
  function getPreviousProperties( oldOptions, newOptions ) {
    var matchProps = {};

    for ( var prop in oldOptions ) {
      if ( hasOwn.call( newOptions, prop ) && hasOwn.call( oldOptions, prop ) ) {
        matchProps[ prop ] = oldOptions[ prop ];
      }
    }

    return matchProps;
  }

  // Internal Only - Adds track events to the instance object
  Popcorn.addTrackEvent = function( obj, track ) {
    var temp;

    if ( track instanceof TrackEvent ) {
      return;
    }

    track = new TrackEvent( track );

    // Determine if this track has default options set for it
    // If so, apply them to the track object
    if ( track && track._natives && track._natives.type &&
        ( obj.options.defaults && obj.options.defaults[ track._natives.type ] ) ) {

      // To ensure that the TrackEvent Invariant Policy is enforced,
      // First, copy the properties of the newly created track event event
      // to a temporary holder
      temp = Popcorn.extend( {}, track );

      // Next, copy the default onto the newly created trackevent, followed by the
      // temporary holder.
      Popcorn.extend( track, obj.options.defaults[ track._natives.type ], temp );
    }

    if ( track._natives ) {
      //  Supports user defined track event id
      track._id = track.id || track._id || Popcorn.guid( track._natives.type );

      // Trigger _setup method if exists
      if ( track._natives._setup ) {

        track._natives._setup.call( obj, track );

        obj.emit( "tracksetup", Popcorn.extend( {}, track, {
          plugin: track._natives.type,
          type: "tracksetup",
          track: track
        }));
      }
    }

    obj.data.trackEvents.add( track );
    TrackEvent.start( obj, track );

    this.timeUpdate( obj, null, true );

    // Store references to user added trackevents in ref table
    if ( track._id ) {
      Popcorn.addTrackEvent.ref( obj, track );
    }

    obj.emit( "trackadded", Popcorn.extend({}, track,
      track._natives ? { plugin: track._natives.type } : {}, {
        type: "trackadded",
        track: track
    }));
  };

  // Internal Only - Adds track event references to the instance object's trackRefs hash table
  Popcorn.addTrackEvent.ref = function( obj, track ) {
    obj.data.trackRefs[ track._id ] = track;

    return obj;
  };

  Popcorn.removeTrackEvent = function( obj, removeId ) {
    var track = obj.getTrackEvent( removeId );

    if ( !track ) {
      return;
    }

    // If a _teardown function was defined,
    // enforce for track event removals
    if ( track._natives._teardown ) {
      track._natives._teardown.call( obj, track );
    }

    obj.data.trackEvents.remove( removeId );

    // Update track event references
    Popcorn.removeTrackEvent.ref( obj, removeId );

    if ( track._natives ) {

      // Fire a trackremoved event
      obj.emit( "trackremoved", Popcorn.extend({}, track, {
        plugin: track._natives.type,
        type: "trackremoved",
        track: track
      }));
    }
  };

  // Internal Only - Removes track event references from instance object's trackRefs hash table
  Popcorn.removeTrackEvent.ref = function( obj, removeId ) {
    delete obj.data.trackRefs[ removeId ];

    return obj;
  };

  // Return an array of track events bound to this instance object
  Popcorn.getTrackEvents = function( obj ) {

    var trackevents = [],
      refs = obj.data.trackEvents.byStart,
      length = refs.length,
      idx = 0,
      ref;

    for ( ; idx < length; idx++ ) {
      ref = refs[ idx ];
      // Return only user attributed track event references
      if ( ref._id ) {
        trackevents.push( ref );
      }
    }

    return trackevents;
  };

  // Internal Only - Returns an instance object's trackRefs hash table
  Popcorn.getTrackEvents.ref = function( obj ) {
    return obj.data.trackRefs;
  };

  // Return a single track event bound to this instance object
  Popcorn.getTrackEvent = function( obj, trackId ) {
    return obj.data.trackRefs[ trackId ];
  };

  // Internal Only - Returns an instance object's track reference by track id
  Popcorn.getTrackEvent.ref = function( obj, trackId ) {
    return obj.data.trackRefs[ trackId ];
  };

  Popcorn.getLastTrackEventId = function( obj ) {
    return obj.data.history[ obj.data.history.length - 1 ];
  };

  Popcorn.timeUpdate = function( obj, event ) {
    var currentTime = obj.media.currentTime,
        previousTime = obj.data.trackEvents.previousUpdateTime,
        tracks = obj.data.trackEvents,
        end = tracks.endIndex,
        start = tracks.startIndex,
        byStartLen = tracks.byStart.length,
        byEndLen = tracks.byEnd.length,
        registryByName = Popcorn.registryByName,
        trackstart = "trackstart",
        trackend = "trackend",

        byEnd, byStart, byAnimate, natives, type, runningPlugins;

    //  Playbar advancing
    if ( previousTime <= currentTime ) {

      while ( tracks.byEnd[ end ] && tracks.byEnd[ end ].end <= currentTime ) {

        byEnd = tracks.byEnd[ end ];
        natives = byEnd._natives;
        type = natives && natives.type;

        //  If plugin does not exist on this instance, remove it
        if ( !natives ||
            ( !!registryByName[ type ] ||
              !!obj[ type ] ) ) {

          if ( byEnd._running === true ) {

            byEnd._running = false;
            runningPlugins = obj.data.running[ type ];
            runningPlugins.splice( runningPlugins.indexOf( byEnd ), 1 );

            if ( !obj.data.disabled[ type ] ) {

              natives.end.call( obj, event, byEnd );

              obj.emit( trackend,
                Popcorn.extend({}, byEnd, {
                  plugin: type,
                  type: trackend,
                  track: byEnd
                })
              );
            }
          }

          end++;
        } else {
          // remove track event
          Popcorn.removeTrackEvent( obj, byEnd._id );
          return;
        }
      }

      while ( tracks.byStart[ start ] && tracks.byStart[ start ].start <= currentTime ) {

        byStart = tracks.byStart[ start ];
        natives = byStart._natives;
        type = natives && natives.type;
        //  If plugin does not exist on this instance, remove it
        if ( !natives ||
            ( !!registryByName[ type ] ||
              !!obj[ type ] ) ) {
          if ( byStart.end > currentTime &&
                byStart._running === false ) {

            byStart._running = true;
            obj.data.running[ type ].push( byStart );

            if ( !obj.data.disabled[ type ] ) {

              natives.start.call( obj, event, byStart );

              obj.emit( trackstart,
                Popcorn.extend({}, byStart, {
                  plugin: type,
                  type: trackstart,
                  track: byStart
                })
              );
            }
          }
          start++;
        } else {
          // remove track event
          Popcorn.removeTrackEvent( obj, byStart._id );
          return;
        }
      }

    // Playbar receding
    } else if ( previousTime > currentTime ) {

      while ( tracks.byStart[ start ] && tracks.byStart[ start ].start > currentTime ) {

        byStart = tracks.byStart[ start ];
        natives = byStart._natives;
        type = natives && natives.type;

        // if plugin does not exist on this instance, remove it
        if ( !natives ||
            ( !!registryByName[ type ] ||
              !!obj[ type ] ) ) {

          if ( byStart._running === true ) {

            byStart._running = false;
            runningPlugins = obj.data.running[ type ];
            runningPlugins.splice( runningPlugins.indexOf( byStart ), 1 );

            if ( !obj.data.disabled[ type ] ) {

              natives.end.call( obj, event, byStart );

              obj.emit( trackend,
                Popcorn.extend({}, byStart, {
                  plugin: type,
                  type: trackend,
                  track: byStart
                })
              );
            }
          }
          start--;
        } else {
          // remove track event
          Popcorn.removeTrackEvent( obj, byStart._id );
          return;
        }
      }

      while ( tracks.byEnd[ end ] && tracks.byEnd[ end ].end > currentTime ) {

        byEnd = tracks.byEnd[ end ];
        natives = byEnd._natives;
        type = natives && natives.type;

        // if plugin does not exist on this instance, remove it
        if ( !natives ||
            ( !!registryByName[ type ] ||
              !!obj[ type ] ) ) {

          if ( byEnd.start <= currentTime &&
                byEnd._running === false ) {

            byEnd._running = true;
            obj.data.running[ type ].push( byEnd );

            if ( !obj.data.disabled[ type ] ) {

              natives.start.call( obj, event, byEnd );

              obj.emit( trackstart,
                Popcorn.extend({}, byEnd, {
                  plugin: type,
                  type: trackstart,
                  track: byEnd
                })
              );
            }
          }
          end--;
        } else {
          // remove track event
          Popcorn.removeTrackEvent( obj, byEnd._id );
          return;
        }
      }
    }

    tracks.endIndex = end;
    tracks.startIndex = start;
    tracks.previousUpdateTime = currentTime;

    //enforce index integrity if trackRemoved
    tracks.byStart.length < byStartLen && tracks.startIndex--;
    tracks.byEnd.length < byEndLen && tracks.endIndex--;

  };

  //  Map and Extend TrackEvent functions to all Popcorn instances
  Popcorn.extend( Popcorn.p, {

    getTrackEvents: function() {
      return Popcorn.getTrackEvents.call( null, this );
    },

    getTrackEvent: function( id ) {
      return Popcorn.getTrackEvent.call( null, this, id );
    },

    getLastTrackEventId: function() {
      return Popcorn.getLastTrackEventId.call( null, this );
    },

    removeTrackEvent: function( id ) {

      Popcorn.removeTrackEvent.call( null, this, id );
      return this;
    },

    removePlugin: function( name ) {
      Popcorn.removePlugin.call( null, this, name );
      return this;
    },

    timeUpdate: function( event ) {
      Popcorn.timeUpdate.call( null, this, event );
      return this;
    },

    destroy: function() {
      Popcorn.destroy.call( null, this );
      return this;
    }
  });

  //  Plugin manifests
  Popcorn.manifest = {};
  //  Plugins are registered
  Popcorn.registry = [];
  Popcorn.registryByName = {};
  //  An interface for extending Popcorn
  //  with plugin functionality
  Popcorn.plugin = function( name, definition, manifest ) {

    if ( Popcorn.protect.natives.indexOf( name.toLowerCase() ) >= 0 ) {
      Popcorn.error( "'" + name + "' is a protected function name" );
      return;
    }

    //  Provides some sugar, but ultimately extends
    //  the definition into Popcorn.p
    var isfn = typeof definition === "function",
        blacklist = [ "start", "end", "type", "manifest" ],
        methods = [ "_setup", "_teardown", "start", "end", "frame" ],
        plugin = {},
        setup;

    // combines calls of two function calls into one
    var combineFn = function( first, second ) {

      first = first || Popcorn.nop;
      second = second || Popcorn.nop;

      return function() {
        first.apply( this, arguments );
        second.apply( this, arguments );
      };
    };

    //  If `manifest` arg is undefined, check for manifest within the `definition` object
    //  If no `definition.manifest`, an empty object is a sufficient fallback
    Popcorn.manifest[ name ] = manifest = manifest || definition.manifest || {};

    // apply safe, and empty default functions
    methods.forEach(function( method ) {
      definition[ method ] = safeTry( definition[ method ] || Popcorn.nop, name );
    });

    var pluginFn = function( setup, options ) {

      if ( !options ) {
        return this;
      }

      // When the "ranges" property is set and its value is an array, short-circuit
      // the pluginFn definition to recall itself with an options object generated from
      // each range object in the ranges array. (eg. { start: 15, end: 16 } )
      if ( options.ranges && Popcorn.isArray(options.ranges) ) {
        Popcorn.forEach( options.ranges, function( range ) {
          // Create a fresh object, extend with current options
          // and start/end range object's properties
          // Works with in/out as well.
          var opts = Popcorn.extend( {}, options, range );

          // Remove the ranges property to prevent infinitely
          // entering this condition
          delete opts.ranges;

          // Call the plugin with the newly created opts object
          this[ name ]( opts );
        }, this);

        // Return the Popcorn instance to avoid creating an empty track event
        return this;
      }

      //  Storing the plugin natives
      var natives = options._natives = {},
          compose = "",
          originalOpts, manifestOpts;

      Popcorn.extend( natives, setup );

      options._natives.type = options._natives.plugin = name;
      options._running = false;

      natives.start = natives.start || natives[ "in" ];
      natives.end = natives.end || natives[ "out" ];

      if ( options.once ) {
        natives.end = combineFn( natives.end, function() {
          this.removeTrackEvent( options._id );
        });
      }

      // extend teardown to always call end if running
      natives._teardown = combineFn(function() {

        var args = slice.call( arguments ),
            runningPlugins = this.data.running[ natives.type ];

        // end function signature is not the same as teardown,
        // put null on the front of arguments for the event parameter
        args.unshift( null );

        // only call end if event is running
        args[ 1 ]._running &&
          runningPlugins.splice( runningPlugins.indexOf( options ), 1 ) &&
          natives.end.apply( this, args );

        args[ 1 ]._running = false;
        this.emit( "trackend",
          Popcorn.extend( {}, options, {
            plugin: natives.type,
            type: "trackend",
            track: Popcorn.getTrackEvent( this, options.id || options._id )
          })
        );
      }, natives._teardown );

      // extend teardown to always trigger trackteardown after teardown
      natives._teardown = combineFn( natives._teardown, function() {

        this.emit( "trackteardown", Popcorn.extend( {}, options, {
          plugin: name,
          type: "trackteardown",
          track: Popcorn.getTrackEvent( this, options.id || options._id )
        }));
      });

      // default to an empty string if no effect exists
      // split string into an array of effects
      options.compose = options.compose || [];
      if ( typeof options.compose === "string" ) {
        options.compose = options.compose.split( " " );
      }
      options.effect = options.effect || [];
      if ( typeof options.effect === "string" ) {
        options.effect = options.effect.split( " " );
      }

      // join the two arrays together
      options.compose = options.compose.concat( options.effect );

      options.compose.forEach(function( composeOption ) {

        // if the requested compose is garbage, throw it away
        compose = Popcorn.compositions[ composeOption ] || {};

        // extends previous functions with compose function
        methods.forEach(function( method ) {
          natives[ method ] = combineFn( natives[ method ], compose[ method ] );
        });
      });

      //  Ensure a manifest object, an empty object is a sufficient fallback
      options._natives.manifest = manifest;

      //  Checks for expected properties
      if ( !( "start" in options ) ) {
        options.start = options[ "in" ] || 0;
      }

      if ( !options.end && options.end !== 0 ) {
        options.end = options[ "out" ] || Number.MAX_VALUE;
      }

      // Use hasOwn to detect non-inherited toString, since all
      // objects will receive a toString - its otherwise undetectable
      if ( !hasOwn.call( options, "toString" ) ) {
        options.toString = function() {
          var props = [
            "start: " + options.start,
            "end: " + options.end,
            "id: " + (options.id || options._id)
          ];

          // Matches null and undefined, allows: false, 0, "" and truthy
          if ( options.target != null ) {
            props.push( "target: " + options.target );
          }

          return name + " ( " + props.join(", ") + " )";
        };
      }

      // Resolves 239, 241, 242
      if ( !options.target ) {

        //  Sometimes the manifest may be missing entirely
        //  or it has an options object that doesn't have a `target` property
        manifestOpts = "options" in manifest && manifest.options;

        options.target = manifestOpts && "target" in manifestOpts && manifestOpts.target;
      }

      if ( !options._id && options._natives ) {
        // ensure an initial id is there before setup is called
        options._id = Popcorn.guid( options._natives.type );
      }

      if ( options instanceof TrackEvent ) {

        if ( options._natives ) {
          //  Supports user defined track event id
          options._id = options.id || options._id || Popcorn.guid( options._natives.type );

          // Trigger _setup method if exists
          if ( options._natives._setup ) {

            options._natives._setup.call( this, options );

            this.emit( "tracksetup", Popcorn.extend( {}, options, {
              plugin: options._natives.type,
              type: "tracksetup",
              track: options
            }));
          }
        }

        this.data.trackEvents.add( options );
        TrackEvent.start( this, options );

        this.timeUpdate( this, null, true );

        // Store references to user added trackevents in ref table
        if ( options._id ) {
          Popcorn.addTrackEvent.ref( this, options );
        }
      } else {
        // Create new track event for this instance
        Popcorn.addTrackEvent( this, options );
      }

      //  Future support for plugin event definitions
      //  for all of the native events
      Popcorn.forEach( setup, function( callback, type ) {
        // Don't attempt to create events for certain properties:
        // "start", "end", "type", "manifest". Fixes #1365
        if ( blacklist.indexOf( type ) === -1 ) {
          this.on( type, callback );
        }
      }, this );

      return this;
    };

    //  Extend Popcorn.p with new named definition
    //  Assign new named definition
    Popcorn.p[ name ] = plugin[ name ] = function( id, options ) {
      var length = arguments.length,
          trackEvent, defaults, mergedSetupOpts, previousOpts, newOpts;

      // Shift arguments based on use case
      //
      // Back compat for:
      // p.plugin( options );
      if ( id && !options ) {
        options = id;
        id = null;
      } else {

        // Get the trackEvent that matches the given id.
        trackEvent = this.getTrackEvent( id );

        // If the track event does not exist, ensure that the options
        // object has a proper id
        if ( !trackEvent ) {
          options.id = id;

        // If the track event does exist, merge the updated properties
        } else {

          newOpts = options;
          previousOpts = getPreviousProperties( trackEvent, newOpts );

          // Call the plugins defined update method if provided. Allows for
          // custom defined updating for a track event to be defined by the plugin author
          if ( trackEvent._natives._update ) {

            this.data.trackEvents.remove( trackEvent );

            // It's safe to say that the intent of Start/End will never change
            // Update them first before calling update
            if ( hasOwn.call( options, "start" ) ) {
              trackEvent.start = options.start;
            }

            if ( hasOwn.call( options, "end" ) ) {
              trackEvent.end = options.end;
            }

            TrackEvent.end( this, trackEvent );

            if ( isfn ) {
              definition.call( this, trackEvent );
            }

            trackEvent._natives._update.call( this, trackEvent, options );

            this.data.trackEvents.add( trackEvent );
            TrackEvent.start( this, trackEvent );
          } else {
            // This branch is taken when there is no explicitly defined
            // _update method for a plugin. Which will occur either explicitly or
            // as a result of the plugin definition being a function that _returns_
            // a definition object.
            //
            // In either case, this path can ONLY be reached for TrackEvents that
            // already exist.

            // Directly update the TrackEvent instance.
            // This supports TrackEvent invariant enforcement.
            Popcorn.extend( trackEvent, options );

            this.data.trackEvents.remove( id );

            // If a _teardown function was defined,
            // enforce for track event removals
            if ( trackEvent._natives._teardown ) {
              trackEvent._natives._teardown.call( this, trackEvent );
            }

            // Update track event references
            Popcorn.removeTrackEvent.ref( this, id );

            if ( isfn ) {
              pluginFn.call( this, definition.call( this, trackEvent ), trackEvent );
            } else {

              //  Supports user defined track event id
              trackEvent._id = trackEvent.id || trackEvent._id || Popcorn.guid( trackEvent._natives.type );

              if ( trackEvent._natives && trackEvent._natives._setup ) {

                trackEvent._natives._setup.call( this, trackEvent );

                this.emit( "tracksetup", Popcorn.extend( {}, trackEvent, {
                  plugin: trackEvent._natives.type,
                  type: "tracksetup",
                  track: trackEvent
                }));
              }

              this.data.trackEvents.add( trackEvent );
              TrackEvent.start( this, trackEvent );

              this.timeUpdate( this, null, true );

              // Store references to user added trackevents in ref table
              Popcorn.addTrackEvent.ref( this, trackEvent );
            }

            // Fire an event with change information
            this.emit( "trackchange", {
              id: trackEvent.id,
              type: "trackchange",
              previousValue: previousOpts,
              currentValue: trackEvent,
              track: trackEvent
            });

            return this;
          }

          if ( trackEvent._natives.type !== "cue" ) {
            // Fire an event with change information
            this.emit( "trackchange", {
              id: trackEvent.id,
              type: "trackchange",
              previousValue: previousOpts,
              currentValue: newOpts,
              track: trackEvent
            });
          }

          return this;
        }
      }

      this.data.running[ name ] = this.data.running[ name ] || [];

      // Merge with defaults if they exist, make sure per call is prioritized
      defaults = ( this.options.defaults && this.options.defaults[ name ] ) || {};
      mergedSetupOpts = Popcorn.extend( {}, defaults, options );

      pluginFn.call( this, isfn ? definition.call( this, mergedSetupOpts ) : definition,
                                  mergedSetupOpts );

      return this;
    };

    // if the manifest parameter exists we should extend it onto the definition object
    // so that it shows up when calling Popcorn.registry and Popcorn.registryByName
    if ( manifest ) {
      Popcorn.extend( definition, {
        manifest: manifest
      });
    }

    //  Push into the registry
    var entry = {
      fn: plugin[ name ],
      definition: definition,
      base: definition,
      parents: [],
      name: name
    };
    Popcorn.registry.push(
       Popcorn.extend( plugin, entry, {
        type: name
      })
    );
    Popcorn.registryByName[ name ] = entry;

    return plugin;
  };

  // Storage for plugin function errors
  Popcorn.plugin.errors = [];

  // Returns wrapped plugin function
  function safeTry( fn, pluginName ) {
    return function() {

      //  When Popcorn.plugin.debug is true, do not suppress errors
      if ( Popcorn.plugin.debug ) {
        return fn.apply( this, arguments );
      }

      try {
        return fn.apply( this, arguments );
      } catch ( ex ) {

        // Push plugin function errors into logging queue
        Popcorn.plugin.errors.push({
          plugin: pluginName,
          thrown: ex,
          source: fn.toString()
        });

        // Trigger an error that the instance can listen for
        // and react to
        this.emit( "pluginerror", Popcorn.plugin.errors );
      }
    };
  }

  // Debug-mode flag for plugin development
  // True for Popcorn development versions, false for stable/tagged versions
  Popcorn.plugin.debug = ( Popcorn.version === "@" + "VERSION" );

  //  removePlugin( type ) removes all tracks of that from all instances of popcorn
  //  removePlugin( obj, type ) removes all tracks of type from obj, where obj is a single instance of popcorn
  Popcorn.removePlugin = function( obj, name ) {

    //  Check if we are removing plugin from an instance or from all of Popcorn
    if ( !name ) {

      //  Fix the order
      name = obj;
      obj = Popcorn.p;

      if ( Popcorn.protect.natives.indexOf( name.toLowerCase() ) >= 0 ) {
        Popcorn.error( "'" + name + "' is a protected function name" );
        return;
      }

      var registryLen = Popcorn.registry.length,
          registryIdx;

      // remove plugin reference from registry
      for ( registryIdx = 0; registryIdx < registryLen; registryIdx++ ) {
        if ( Popcorn.registry[ registryIdx ].name === name ) {
          Popcorn.registry.splice( registryIdx, 1 );
          delete Popcorn.registryByName[ name ];
          delete Popcorn.manifest[ name ];

          // delete the plugin
          delete obj[ name ];

          // plugin found and removed, stop checking, we are done
          return;
        }
      }

    }

    var byStart = obj.data.trackEvents.byStart,
        byEnd = obj.data.trackEvents.byEnd,
        animating = obj.data.trackEvents.animating,
        idx, sl;

    // remove all trackEvents
    for ( idx = 0, sl = byStart.length; idx < sl; idx++ ) {

      if ( byStart[ idx ] && byStart[ idx ]._natives && byStart[ idx ]._natives.type === name ) {

        byStart[ idx ]._natives._teardown && byStart[ idx ]._natives._teardown.call( obj, byStart[ idx ] );

        byStart.splice( idx, 1 );

        // update for loop if something removed, but keep checking
        idx--; sl--;
        if ( obj.data.trackEvents.startIndex <= idx ) {
          obj.data.trackEvents.startIndex--;
          obj.data.trackEvents.endIndex--;
        }
      }

      // clean any remaining references in the end index
      // we do this seperate from the above check because they might not be in the same order
      if ( byEnd[ idx ] && byEnd[ idx ]._natives && byEnd[ idx ]._natives.type === name ) {

        byEnd.splice( idx, 1 );
      }
    }

    //remove all animating events
    for ( idx = 0, sl = animating.length; idx < sl; idx++ ) {

      if ( animating[ idx ] && animating[ idx ]._natives && animating[ idx ]._natives.type === name ) {

        animating.splice( idx, 1 );

        // update for loop if something removed, but keep checking
        idx--; sl--;
      }
    }

  };

  Popcorn.compositions = {};

  //  Plugin inheritance
  Popcorn.compose = function( name, definition, manifest ) {

    //  If `manifest` arg is undefined, check for manifest within the `definition` object
    //  If no `definition.manifest`, an empty object is a sufficient fallback
    Popcorn.manifest[ name ] = manifest = manifest || definition.manifest || {};

    // register the effect by name
    Popcorn.compositions[ name ] = definition;
  };

  Popcorn.plugin.effect = Popcorn.effect = Popcorn.compose;

  var rnaiveExpr = /^(?:\.|#|\[)/;

  //  Basic DOM utilities and helpers API. See #1037
  Popcorn.dom = {
    debug: false,
    //  Popcorn.dom.find( selector, context )
    //
    //  Returns the first element that matches the specified selector
    //  Optionally provide a context element, defaults to `document`
    //
    //  eg.
    //  Popcorn.dom.find("video") returns the first video element
    //  Popcorn.dom.find("#foo") returns the first element with `id="foo"`
    //  Popcorn.dom.find("foo") returns the first element with `id="foo"`
    //     Note: Popcorn.dom.find("foo") is the only allowed deviation
    //           from valid querySelector selector syntax
    //
    //  Popcorn.dom.find(".baz") returns the first element with `class="baz"`
    //  Popcorn.dom.find("[preload]") returns the first element with `preload="..."`
    //  ...
    //  See https://developer.mozilla.org/En/DOM/Document.querySelector
    //
    //
    find: function( selector, context ) {
      var node = null;

      //  Default context is the `document`
      context = context || document;

      if ( selector ) {

        //  If the selector does not begin with "#", "." or "[",
        //  it could be either a nodeName or ID w/o "#"
        if ( !rnaiveExpr.test( selector ) ) {

          //  Try finding an element that matches by ID first
          node = document.getElementById( selector );

          //  If a match was found by ID, return the element
          if ( node !== null ) {
            return node;
          }
        }
        //  Assume no elements have been found yet
        //  Catch any invalid selector syntax errors and bury them.
        try {
          node = context.querySelector( selector );
        } catch ( e ) {
          if ( Popcorn.dom.debug ) {
            throw new Error(e);
          }
        }
      }
      return node;
    }
  };

  //  Cache references to reused RegExps
  var rparams = /\?/,
  //  XHR Setup object
  setup = {
    ajax: null,
    url: "",
    data: "",
    dataType: "",
    success: Popcorn.nop,
    type: "GET",
    async: true,
    contentType: "application/x-www-form-urlencoded; charset=UTF-8"
  };

  Popcorn.xhr = function( options ) {
    var settings;

    options.dataType = options.dataType && options.dataType.toLowerCase() || null;

    if ( options.dataType &&
         ( options.dataType === "jsonp" || options.dataType === "script" ) ) {

      Popcorn.xhr.getJSONP(
        options.url,
        options.success,
        options.dataType === "script"
      );
      return;
    }

    //  Merge the "setup" defaults and custom "options"
    //  into a new plain object.
    settings = Popcorn.extend( {}, setup, options );

    //  Create new XMLHttpRequest object
    settings.ajax = new XMLHttpRequest();

    if ( settings.ajax ) {

      if ( settings.type === "GET" && settings.data ) {

        //  append query string
        settings.url += ( rparams.test( settings.url ) ? "&" : "?" ) + settings.data;

        //  Garbage collect and reset settings.data
        settings.data = null;
      }

      //  Open the request
      settings.ajax.open( settings.type, settings.url, settings.async );

      //  For POST, set the content-type request header
      if ( settings.type === "POST" ) {
        settings.ajax.setRequestHeader(
          "Content-Type", settings.contentType
        );
      }

      settings.ajax.send( settings.data || null );

      return Popcorn.xhr.httpData( settings );
    }
  };


  Popcorn.xhr.httpData = function( settings ) {

    var data, json = null,
        parser, xml = null;

    settings.ajax.onreadystatechange = function() {

      if ( settings.ajax.readyState === 4 ) {

        try {
          json = JSON.parse( settings.ajax.responseText );
        } catch( e ) {
          //suppress
        }

        data = {
          xml: settings.ajax.responseXML,
          text: settings.ajax.responseText,
          json: json
        };

        // Normalize: data.xml is non-null in IE9 regardless of if response is valid xml
        if ( !data.xml || !data.xml.documentElement ) {
          data.xml = null;

          try {
            parser = new DOMParser();
            xml = parser.parseFromString( settings.ajax.responseText, "text/xml" );

            if ( !xml.getElementsByTagName( "parsererror" ).length ) {
              data.xml = xml;
            }
          } catch ( e ) {
            // data.xml remains null
          }
        }

        //  If a dataType was specified, return that type of data
        if ( settings.dataType ) {
          data = data[ settings.dataType ];
        }


        settings.success.call( settings.ajax, data );

      }
    };
    return data;
  };

  Popcorn.xhr.getJSONP = function( url, success, isScript ) {

    var head = document.head || document.getElementsByTagName( "head" )[ 0 ] || document.documentElement,
      script = document.createElement( "script" ),
      isFired = false,
      params = [],
      rjsonp = /(=)\?(?=&|$)|\?\?/,
      replaceInUrl, prefix, paramStr, callback, callparam;

    if ( !isScript ) {

      // is there a calback already in the url
      callparam = url.match( /(callback=[^&]*)/ );

      if ( callparam !== null && callparam.length ) {

        prefix = callparam[ 1 ].split( "=" )[ 1 ];

        // Since we need to support developer specified callbacks
        // and placeholders in harmony, make sure matches to "callback="
        // aren't just placeholders.
        // We coded ourselves into a corner here.
        // JSONP callbacks should never have been
        // allowed to have developer specified callbacks
        if ( prefix === "?" ) {
          prefix = "jsonp";
        }

        // get the callback name
        callback = Popcorn.guid( prefix );

        // replace existing callback name with unique callback name
        url = url.replace( /(callback=[^&]*)/, "callback=" + callback );
      } else {

        callback = Popcorn.guid( "jsonp" );

        if ( rjsonp.test( url ) ) {
          url = url.replace( rjsonp, "$1" + callback );
        }

        // split on first question mark,
        // this is to capture the query string
        params = url.split( /\?(.+)?/ );

        // rebuild url with callback
        url = params[ 0 ] + "?";
        if ( params[ 1 ] ) {
          url += params[ 1 ] + "&";
        }
        url += "callback=" + callback;
      }

      //  Define the JSONP success callback globally
      window[ callback ] = function( data ) {
        // Fire success callbacks
        success && success( data );
        isFired = true;
      };
    }

    script.addEventListener( "load",  function() {

      //  Handling remote script loading callbacks
      if ( isScript ) {
        //  getScript
        success && success();
      }

      //  Executing for JSONP requests
      if ( isFired ) {
        //  Garbage collect the callback
        delete window[ callback ];
      }
      //  Garbage collect the script resource
      head.removeChild( script );
    }, false );

    script.addEventListener( "error",  function( e ) {
      //  Handling remote script loading callbacks
      success && success( { error: e } );

      //  Executing for JSONP requests
      if ( !isScript ) {
        //  Garbage collect the callback
        delete window[ callback ];
      }
      //  Garbage collect the script resource
      head.removeChild( script );
    }, false );

    script.src = url;
    head.insertBefore( script, head.firstChild );

    return;
  };

  Popcorn.getJSONP = Popcorn.xhr.getJSONP;

  Popcorn.getScript = Popcorn.xhr.getScript = function( url, success ) {

    return Popcorn.xhr.getJSONP( url, success, true );
  };

  Popcorn.util = {
    // Simple function to parse a timestamp into seconds
    // Acceptable formats are:
    // HH:MM:SS.MMM
    // HH:MM:SS;FF
    // Hours and minutes are optional. They default to 0
    toSeconds: function( timeStr, framerate ) {
      // Hours and minutes are optional
      // Seconds must be specified
      // Seconds can be followed by milliseconds OR by the frame information
      var validTimeFormat = /^([0-9]+:){0,2}[0-9]+([.;][0-9]+)?$/,
          errorMessage = "Invalid time format",
          digitPairs, lastIndex, lastPair, firstPair,
          frameInfo, frameTime;

      if ( typeof timeStr === "number" ) {
        return timeStr;
      }

      if ( typeof timeStr === "string" &&
            !validTimeFormat.test( timeStr ) ) {
        Popcorn.error( errorMessage );
      }

      digitPairs = timeStr.split( ":" );
      lastIndex = digitPairs.length - 1;
      lastPair = digitPairs[ lastIndex ];

      // Fix last element:
      if ( lastPair.indexOf( ";" ) > -1 ) {

        frameInfo = lastPair.split( ";" );
        frameTime = 0;

        if ( framerate && ( typeof framerate === "number" ) ) {
          frameTime = parseFloat( frameInfo[ 1 ], 10 ) / framerate;
        }

        digitPairs[ lastIndex ] = parseInt( frameInfo[ 0 ], 10 ) + frameTime;
      }

      firstPair = digitPairs[ 0 ];

      return {

        1: parseFloat( firstPair, 10 ),

        2: ( parseInt( firstPair, 10 ) * 60 ) +
              parseFloat( digitPairs[ 1 ], 10 ),

        3: ( parseInt( firstPair, 10 ) * 3600 ) +
            ( parseInt( digitPairs[ 1 ], 10 ) * 60 ) +
              parseFloat( digitPairs[ 2 ], 10 )

      }[ digitPairs.length || 1 ];
    }
  };

  // alias for exec function
  Popcorn.p.cue = Popcorn.p.exec;

  //  Protected API methods
  Popcorn.protect = {
    natives: getKeys( Popcorn.p ).map(function( val ) {
      return val.toLowerCase();
    })
  };

  // Setup logging for deprecated methods
  Popcorn.forEach({
    // Deprecated: Recommended
    "listen": "on",
    "unlisten": "off",
    "trigger": "emit",
    "exec": "cue"

  }, function( recommend, api ) {
    var original = Popcorn.p[ api ];
    // Override the deprecated api method with a method of the same name
    // that logs a warning and defers to the new recommended method
    Popcorn.p[ api ] = function() {
      if ( typeof console !== "undefined" && console.warn ) {
        console.warn(
          "Deprecated method '" + api + "', " +
          (recommend == null ? "do not use." : "use '" + recommend + "' instead." )
        );

        // Restore api after first warning
        Popcorn.p[ api ] = original;
      }
      return Popcorn.p[ recommend ].apply( this, [].slice.call( arguments ) );
    };
  });


  //  Exposes Popcorn to global context
  global.Popcorn = Popcorn;

})(window, window.document);


/**
 * The Popcorn._MediaElementProto object is meant to be used as a base
 * prototype for HTML*VideoElement and HTML*AudioElement wrappers.
 * MediaElementProto requires that users provide:
 *   - parentNode: the element owning the media div/iframe
 *   - _eventNamespace: the unique namespace for all events
 */
(function( Popcorn, document ) {

  /*********************************************************************************
   * parseUri 1.2.2
   * http://blog.stevenlevithan.com/archives/parseuri
   * (c) Steven Levithan <stevenlevithan.com>
   * MIT License
   */
  function parseUri (str) {
    var	o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) {
      uri[o.key[i]] = m[i] || "";
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
      if ($1) {
        uri[o.q.name][$1] = $2;
      }
    });

    return uri;
  }

  parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
      name:   "queryKey",
      parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
      strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
      loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
  };
  /*********************************************************************************/

  // Fake a TimeRanges object
  var _fakeTimeRanges = {
    length: 0,
    start: Popcorn.nop,
    end: Popcorn.nop
  };

  // Make sure the browser has MediaError
  window.MediaError = window.MediaError || (function() {
    function MediaError(code, msg) {
      this.code = code || null;
      this.message = msg || "";
    }
    MediaError.MEDIA_ERR_NONE_ACTIVE    = 0;
    MediaError.MEDIA_ERR_ABORTED        = 1;
    MediaError.MEDIA_ERR_NETWORK        = 2;
    MediaError.MEDIA_ERR_DECODE         = 3;
    MediaError.MEDIA_ERR_NONE_SUPPORTED = 4;

    return MediaError;
  }());


  function MediaElementProto() {
    var protoElement = {},
        events = {},
        parentNode;
    if ( !Object.prototype.__defineGetter__ ) {
      protoElement = document.createElement( "div" );
    }
    protoElement._util = {
      // Each wrapper stamps a type.
      type: "HTML5",

      // How often to trigger timeupdate events
      TIMEUPDATE_MS: 250,

      // Standard width and height
      MIN_WIDTH: 300,
      MIN_HEIGHT: 150,

      // Check for attribute being set or value being set in JS.  The following are true:
      //   autoplay
      //   autoplay="true"
      //   v.autoplay=true;
      isAttributeSet: function( value ) {
        return ( typeof value === "string" || value === true );
      },

      parseUri: parseUri
    };
    // Mimic DOM events with custom, namespaced events on the document.
    // Each media element using this prototype needs to provide a unique
    // namespace for all its events via _eventNamespace.
    protoElement.addEventListener = function( type, listener, useCapture ) {
      document.addEventListener( this._eventNamespace + type, listener, useCapture );
    };

    protoElement.removeEventListener = function( type, listener, useCapture ) {
      document.removeEventListener( this._eventNamespace + type, listener, useCapture );
    };

    protoElement.dispatchEvent = function( name ) {
      var customEvent = document.createEvent( "CustomEvent" ),
        detail = {
          type: name,
          target: this.parentNode,
          data: null
        };

      customEvent.initCustomEvent( this._eventNamespace + name, false, false, detail );
      document.dispatchEvent( customEvent );
    };

    protoElement.load = Popcorn.nop;

    protoElement.canPlayType = function( url ) {
      return "";
    };

    // Popcorn expects getBoundingClientRect to exist, forward to parent node.
    protoElement.getBoundingClientRect = function() {
      return parentNode.getBoundingClientRect();
    };

    protoElement.NETWORK_EMPTY = 0;
    protoElement.NETWORK_IDLE = 1;
    protoElement.NETWORK_LOADING = 2;
    protoElement.NETWORK_NO_SOURCE = 3;

    protoElement.HAVE_NOTHING = 0;
    protoElement.HAVE_METADATA = 1;
    protoElement.HAVE_CURRENT_DATA = 2;
    protoElement.HAVE_FUTURE_DATA = 3;
    protoElement.HAVE_ENOUGH_DATA = 4;
    Object.defineProperties( protoElement, {

      currentSrc: {
        get: function() {
          return this.src !== undefined ? this.src : "";
        },
        configurable: true
      },

      parentNode: {
        get: function() {
          return parentNode;
        },
        set: function( val ) {
          parentNode = val;
        },
        configurable: true
      },
      
      // We really can't do much more than "auto" with most of these.
      preload: {
        get: function() {
          return "auto";
        },
        set: Popcorn.nop,
        configurable: true
      },

      controls: {
        get: function() {
          return true;
        },
        set: Popcorn.nop,
        configurable: true
      },

      // TODO: it would be good to overlay an <img> using this URL
      poster: {
        get: function() {
          return "";
        },
        set: Popcorn.nop,
        configurable: true
      },

      crossorigin: {
        get: function() {
          return "";
        },
        configurable: true
      },

      played: {
        get: function() {
          return _fakeTimeRanges;
        },
        configurable: true
      },

      seekable: {
        get: function() {
          return _fakeTimeRanges;
        },
        configurable: true
      },

      buffered: {
        get: function() {
          return _fakeTimeRanges;
        },
        configurable: true
      },

      defaultMuted: {
        get: function() {
          return false;
        },
        configurable: true
      },

      defaultPlaybackRate: {
        get: function() {
          return 1.0;
        },
        configurable: true
      },

      style: {
        get: function() {
          return this.parentNode.style;
        },
        configurable: true
      },

      id: {
        get: function() {
          return this.parentNode.id;
        },
        configurable: true
      }

      // TODO:
      //   initialTime
      //   playbackRate
      //   startOffsetTime

     });
    return protoElement;
  }

  Popcorn._MediaElementProto = MediaElementProto;

}( Popcorn, window.document ));


(function( Popcorn, window, document ) {

  var

  CURRENT_TIME_MONITOR_MS = 10,
  EMPTY_STRING = "",

  // Example: http://www.youtube.com/watch?v=12345678901
  regexYouTube = /^.*(?:\/|v=)(.{11})/,

  ABS = Math.abs,

  // Setup for YouTube API
  ytReady = false,
  ytLoading = false,
  ytCallbacks = [];

  function onYouTubeIframeAPIReady() {
    var callback;
    if ( YT.loaded ) {
      ytReady = true;
      while( ytCallbacks.length ) {
        callback = ytCallbacks.shift();
        callback();
      }
    } else {
      setTimeout( onYouTubeIframeAPIReady, 250 );
    }
  }

  function isYouTubeReady() {
    var script;
    // If we area already waiting, do nothing.
    if( !ytLoading ) {
      // If script is already there, check if it is loaded.
      if ( window.YT ) {
        onYouTubeIframeAPIReady();
      } else {
        script = document.createElement( "script" );
        script.addEventListener( "load", onYouTubeIframeAPIReady, false);
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild( script );
      }
      ytLoading = true;
    }
    return ytReady;
  }

  function addYouTubeCallback( callback ) {
    ytCallbacks.push( callback );
  }

  function HTMLYouTubeVideoElement( id ) {

    // YouTube iframe API requires postMessage
    if( !window.postMessage ) {
      throw "ERROR: HTMLYouTubeVideoElement requires window.postMessage";
    }

    var self = new Popcorn._MediaElementProto(),
      parent = typeof id === "string" ? document.querySelector( id ) : id,
      elem = document.createElement( "div" ),
      impl = {
        src: EMPTY_STRING,
        networkState: self.NETWORK_EMPTY,
        readyState: self.HAVE_NOTHING,
        seeking: false,
        autoplay: EMPTY_STRING,
        preload: EMPTY_STRING,
        controls: false,
        loop: false,
        poster: EMPTY_STRING,
        volume: 1,
        muted: false,
        currentTime: 0,
        duration: NaN,
        ended: false,
        paused: true,
        error: null
      },
      playerReady = false,
      mediaReady = false,
      loopedPlay = false,
      player,
      playerPaused = true,
      mediaReadyCallbacks = [],
      playerState = -1,
      bufferedInterval,
      lastLoadedFraction = 0,
      currentTimeInterval,
      timeUpdateInterval;

    // Namespace all events we'll produce
    self._eventNamespace = Popcorn.guid( "HTMLYouTubeVideoElement::" );

    self.parentNode = parent;

    // Mark this as YouTube
    self._util.type = "YouTube";

    function addMediaReadyCallback( callback ) {
      mediaReadyCallbacks.push( callback );
    }

    function catchRoguePlayEvent() {
      player.pauseVideo();
      removeYouTubeEvent( "play", catchRoguePlayEvent );
      addYouTubeEvent( "play", onPlay );
    }

    function catchRoguePauseEvent() {
      addYouTubeEvent( "pause", onPause );
      removeYouTubeEvent( "pause", catchRoguePauseEvent );
    }

    function onPlayerReady( event ) {

      var onMuted = function() {
        if ( player.isMuted() ) {
          // force an initial play on the video, to remove autostart on initial seekTo.
          addYouTubeEvent( "play", onFirstPlay );
          player.playVideo();
        } else {
          setTimeout( onMuted, 0 );
        }
      };
      playerReady = true;
      // XXX: this should really live in cued below, but doesn't work.

      // Browsers using flash will have the pause() call take too long and cause some
      // sound to leak out. Muting before to prevent this.
      player.mute();

      // ensure we are muted.
      onMuted();
    }

    function onPlayerError(event) {
      // There's no perfect mapping to HTML5 errors from YouTube errors.
      var err = { name: "MediaError" };

      switch( event.data ) {

        // invalid parameter
        case 2:
          err.message = "Invalid video parameter.";
          err.code = MediaError.MEDIA_ERR_ABORTED;
          break;

        // HTML5 Error
        case 5:
          err.message = "The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred.";
          err.code = MediaError.MEDIA_ERR_DECODE;

        // requested video not found
        case 100:
          err.message = "Video not found.";
          err.code = MediaError.MEDIA_ERR_NETWORK;
          break;

        // video can't be embedded by request of owner
        case 101:
        case 150:
          err.message = "Video not usable.";
          err.code = MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;
          break;

        default:
          err.message = "Unknown error.";
          err.code = 5;
      }

      impl.error = err;
      self.dispatchEvent( "error" );
    }

    function onReady() {

      addYouTubeEvent( "play", onPlay );
      addYouTubeEvent( "pause", onPause );
      // Set initial paused state
      if( impl.autoplay || !impl.paused ) {
        removeYouTubeEvent( "play", onReady );
        impl.paused = false;
        addMediaReadyCallback(function() {
          if ( !impl.paused ) {
            onPlay();
          }
        });
      }

      // Ensure video will now be unmuted when playing due to the mute on initial load.
      if( !impl.muted ) {
        player.unMute();
      }

      impl.readyState = self.HAVE_METADATA;
      self.dispatchEvent( "loadedmetadata" );
      currentTimeInterval = setInterval( monitorCurrentTime,
                                         CURRENT_TIME_MONITOR_MS );

      self.dispatchEvent( "loadeddata" );

      impl.readyState = self.HAVE_FUTURE_DATA;
      self.dispatchEvent( "canplay" );

      mediaReady = true;
      bufferedInterval = setInterval( monitorBuffered, 50 );

      while( mediaReadyCallbacks.length ) {
        mediaReadyCallbacks[ 0 ]();
        mediaReadyCallbacks.shift();
      }

      // We can't easily determine canplaythrough, but will send anyway.
      impl.readyState = self.HAVE_ENOUGH_DATA;
      self.dispatchEvent( "canplaythrough" );
    }

    function onFirstPause() {
      removeYouTubeEvent( "pause", onFirstPause );
      if ( player.getCurrentTime() > 0 ) {
        setTimeout( onFirstPause, 0 );
        return;
      }

      if( impl.autoplay || !impl.paused ) {
        addYouTubeEvent( "play", onReady );
        player.playVideo();
      } else {
        onReady();
      }
    }

    // This function needs duration and first play to be ready.
    function onFirstPlay() {
      removeYouTubeEvent( "play", onFirstPlay );
      if ( player.getCurrentTime() === 0 ) {
        setTimeout( onFirstPlay, 0 );
        return;
      }
      addYouTubeEvent( "pause", onFirstPause );
      player.seekTo( 0 );
      player.pauseVideo();
    }

    function addYouTubeEvent( event, listener ) {
      self.addEventListener( "youtube-" + event, listener, false );
    }
    function removeYouTubeEvent( event, listener ) {
      self.removeEventListener( "youtube-" + event, listener, false );
    }
    function dispatchYouTubeEvent( event ) {
      self.dispatchEvent( "youtube-" + event );
    }

    function onBuffering() {
      impl.networkState = self.NETWORK_LOADING;
      var newDuration = player.getDuration();
      if (impl.duration !== newDuration) {
        impl.duration = newDuration;
        self.dispatchEvent( "durationchange" );
      }
      self.dispatchEvent( "waiting" );
    }

    addYouTubeEvent( "buffering", onBuffering );
    addYouTubeEvent( "ended", onEnded );

    function onPlayerStateChange( event ) {

      switch( event.data ) {

        // ended
        case YT.PlayerState.ENDED:
          dispatchYouTubeEvent( "ended" );
          break;

        // playing
        case YT.PlayerState.PLAYING:
          dispatchYouTubeEvent( "play" );
          break;

        // paused
        case YT.PlayerState.PAUSED:
          // Youtube fires a paused event before an ended event.
          // We have no need for this.
          if ( player.getDuration() !== player.getCurrentTime() ) {
            dispatchYouTubeEvent( "pause" );
          }
          break;

        // buffering
        case YT.PlayerState.BUFFERING:
          dispatchYouTubeEvent( "buffering" );
          break;

        // video cued
        case YT.PlayerState.CUED:
          // XXX: cued doesn't seem to fire reliably, bug in youtube api?
          break;
      }

      if ( event.data !== YT.PlayerState.BUFFERING &&
           playerState === YT.PlayerState.BUFFERING ) {
        onProgress();
      }

      playerState = event.data;
    }

    function destroyPlayer() {
      if( !( playerReady && player ) ) {
        return;
      }

      removeYouTubeEvent( "buffering", onBuffering );
      removeYouTubeEvent( "ended", onEnded );
      removeYouTubeEvent( "play", onPlay );
      removeYouTubeEvent( "pause", onPause );
      onPause();
      mediaReady = false;
      loopedPlay = false;
      impl.currentTime = 0;
      mediaReadyCallbacks = [];
      clearInterval( currentTimeInterval );
      clearInterval( bufferedInterval );
      player.stopVideo();
      player.clearVideo();
      player.destroy();
      elem = document.createElement( "div" );
    }

    function changeSrc( aSrc ) {
      if( !self._canPlaySrc( aSrc ) ) {
        impl.error = {
          name: "MediaError",
          message: "Media Source Not Supported",
          code: MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        };
        self.dispatchEvent( "error" );
        return;
      }

      impl.src = aSrc;

      // Make sure YouTube is ready, and if not, register a callback
      if( !isYouTubeReady() ) {
        addYouTubeCallback( function() { changeSrc( aSrc ); } );
        return;
      }

      if( playerReady ) {
        if( mediaReady ) {
          destroyPlayer();
        } else {
          addMediaReadyCallback( function() {
            changeSrc( aSrc );
          });
          return;
        }
      }

      parent.appendChild( elem );

      // Use any player vars passed on the URL
      var playerVars = self._util.parseUri( aSrc ).queryKey;

      // Remove the video id, since we don't want to pass it
      delete playerVars.v;

      // Sync autoplay, but manage internally
      impl.autoplay = playerVars.autoplay === "1" || impl.autoplay;
      delete playerVars.autoplay;

      // Sync loop, but manage internally
      impl.loop = playerVars.loop === "1" || impl.loop;
      delete playerVars.loop;

      // Don't show related videos when ending
      playerVars.rel = playerVars.rel || 0;

      // Don't show YouTube's branding
      playerVars.modestbranding = playerVars.modestbranding || 1;

      // Don't show annotations by default
      playerVars.iv_load_policy = playerVars.iv_load_policy || 3;

      // Disable keyboard controls by default
      playerVars.disablekb = playerVars.disablekb || 1;

      // Don't show video info before playing
      playerVars.showinfo = playerVars.showinfo || 0;

      // Specify our domain as origin for iframe security
      var domain = window.location.protocol === "file:" ? "*" :
      window.location.protocol + "//" + window.location.host;
      playerVars.origin = playerVars.origin || domain;

      // Show/hide controls. Sync with impl.controls and prefer URL value.
      playerVars.controls = playerVars.controls || impl.controls ? 2 : 0;
      impl.controls = playerVars.controls;

      // Set wmode to transparent to show video overlays
      playerVars.wmode = playerVars.wmode || "opaque";

      if ( playerVars.html5 !== 0 ) {
        playerVars.html5 = 1;
      }

      // Get video ID out of youtube url
      aSrc = regexYouTube.exec( aSrc )[ 1 ];

      player = new YT.Player( elem, {
        width: "100%",
        height: "100%",
        wmode: playerVars.wmode,
        videoId: aSrc,
        playerVars: playerVars,
        events: {
          'onReady': onPlayerReady,
          'onError': onPlayerError,
          'onStateChange': onPlayerStateChange
        }
      });

      impl.networkState = self.NETWORK_LOADING;
      self.dispatchEvent( "loadstart" );
      self.dispatchEvent( "progress" );
    }

    function monitorCurrentTime() {
      var playerTime = player.getCurrentTime();
      if ( !impl.seeking ) {
        if ( ABS( impl.currentTime - playerTime ) > CURRENT_TIME_MONITOR_MS ) {
          onSeeking();
          onSeeked();
        }
        impl.currentTime = playerTime;
      } else if ( ABS( playerTime - impl.currentTime ) < 1 ) {
        onSeeked();
      }
    }

    function monitorBuffered() {
      var fraction = player.getVideoLoadedFraction();

      if ( fraction && lastLoadedFraction !== fraction ) {
        lastLoadedFraction = fraction;
        onProgress();
      }
    }

    function changeCurrentTime( aTime ) {
      if ( aTime === impl.currentTime ) {
        return;
      }
      impl.currentTime = aTime;
      if( !mediaReady ) {
        addMediaReadyCallback( function() {

          onSeeking();
          player.seekTo( aTime );
        });
        return;
      }

      onSeeking();
      player.seekTo( aTime );
    }

    function onTimeUpdate() {
      self.dispatchEvent( "timeupdate" );
    }

    function onSeeking() {
      // a seek in youtube fires a paused event.
      // we don't want to listen for this, so this state catches the event.
      addYouTubeEvent( "pause", catchRoguePauseEvent );
      removeYouTubeEvent( "pause", onPause );
      impl.seeking = true;
      self.dispatchEvent( "seeking" );
    }

    function onSeeked() {
      impl.ended = false;
      impl.seeking = false;
      self.dispatchEvent( "timeupdate" );
      self.dispatchEvent( "seeked" );
      self.dispatchEvent( "canplay" );
      self.dispatchEvent( "canplaythrough" );
    }

    function onPlay() {
      if( impl.ended ) {
        changeCurrentTime( 0 );
        impl.ended = false;
      }
      timeUpdateInterval = setInterval( onTimeUpdate,
                                        self._util.TIMEUPDATE_MS );
      impl.paused = false;
      if( playerPaused ) {
        playerPaused = false;

        // Only 1 play when video.loop=true
        if ( ( impl.loop && !loopedPlay ) || !impl.loop ) {
          loopedPlay = true;
          self.dispatchEvent( "play" );
        }
        self.dispatchEvent( "playing" );
      }
    }

    function onProgress() {
      self.dispatchEvent( "progress" );
    }

    self.play = function() {
      impl.paused = false;
      if( !mediaReady ) {
        addMediaReadyCallback( function() {
          self.play();
        });
        return;
      }
      player.playVideo();
    };

    function onPause() {
      impl.paused = true;
      if ( !playerPaused ) {
        playerPaused = true;
        clearInterval( timeUpdateInterval );
        self.dispatchEvent( "pause" );
      }
    }

    self.pause = function() {
      impl.paused = true;
      if( !mediaReady ) {
        addMediaReadyCallback( function() {
          self.pause();
        });
        return;
      }
      // if a pause happens while seeking, ensure we catch it.
      // in youtube seeks fire pause events, and we don't want to listen to that.
      // except for the case of an actual pause.
      catchRoguePauseEvent();
      player.pauseVideo();
    };

    function onEnded() {
      if( impl.loop ) {
        changeCurrentTime( 0 );
        self.play();
      } else {
        impl.ended = true;
        onPause();
        // YouTube will fire a Playing State change after the video has ended, causing it to loop.
        addYouTubeEvent( "play", catchRoguePlayEvent );
        removeYouTubeEvent( "play", onPlay );
        self.dispatchEvent( "timeupdate" );
        self.dispatchEvent( "ended" );
      }
    }

    function setMuted( aValue ) {
      impl.muted = aValue;
      if( !mediaReady ) {
        addMediaReadyCallback( function() {
          setMuted( impl.muted );
        });
        return;
      }
      player[ aValue ? "mute" : "unMute" ]();
      self.dispatchEvent( "volumechange" );
    }

    function getMuted() {
      // YouTube has isMuted(), but for sync access we use impl.muted
      return impl.muted;
    }

    Object.defineProperties( self, {

      src: {
        get: function() {
          return impl.src;
        },
        set: function( aSrc ) {
          if( aSrc && aSrc !== impl.src ) {
            changeSrc( aSrc );
          }
        }
      },

      autoplay: {
        get: function() {
          return impl.autoplay;
        },
        set: function( aValue ) {
          impl.autoplay = self._util.isAttributeSet( aValue );
        }
      },

      loop: {
        get: function() {
          return impl.loop;
        },
        set: function( aValue ) {
          impl.loop = self._util.isAttributeSet( aValue );
        }
      },

      width: {
        get: function() {
          return self.parentNode.offsetWidth;
        }
      },

      height: {
        get: function() {
          return self.parentNode.offsetHeight;
        }
      },

      currentTime: {
        get: function() {
          return impl.currentTime;
        },
        set: function( aValue ) {
          changeCurrentTime( aValue );
        }
      },

      duration: {
        get: function() {
          return impl.duration;
        }
      },

      ended: {
        get: function() {
          return impl.ended;
        }
      },

      paused: {
        get: function() {
          return impl.paused;
        }
      },

      seeking: {
        get: function() {
          return impl.seeking;
        }
      },

      readyState: {
        get: function() {
          return impl.readyState;
        }
      },

      networkState: {
        get: function() {
          return impl.networkState;
        }
      },

      volume: {
        get: function() {
          return impl.volume;
        },
        set: function( aValue ) {
          if( aValue < 0 || aValue > 1 ) {
            throw "Volume value must be between 0.0 and 1.0";
          }
          impl.volume = aValue;
          if( !mediaReady ) {
            addMediaReadyCallback( function() {
              self.volume = aValue;
            });
            return;
          }
          player.setVolume( impl.volume * 100 );
          self.dispatchEvent( "volumechange" );
        }
      },

      muted: {
        get: function() {
          return getMuted();
        },
        set: function( aValue ) {
          setMuted( self._util.isAttributeSet( aValue ) );
        }
      },

      error: {
        get: function() {
          return impl.error;
        }
      },

      buffered: {
        get: function () {
          var timeRanges = {
            start: function( index ) {
              if ( index === 0 ) {
                return 0;
              }

              //throw fake DOMException/INDEX_SIZE_ERR
              throw "INDEX_SIZE_ERR: DOM Exception 1";
            },
            end: function( index ) {
              if ( index === 0 ) {
                if ( !impl.duration ) {
                  return 0;
                }

                return impl.duration * lastLoadedFraction;
              }

              //throw fake DOMException/INDEX_SIZE_ERR
              throw "INDEX_SIZE_ERR: DOM Exception 1";
            },
            length: 1
          };

          return timeRanges;
        },
        configurable: true
      }
    });

    self._canPlaySrc = Popcorn.HTMLYouTubeVideoElement._canPlaySrc;
    self.canPlayType = Popcorn.HTMLYouTubeVideoElement.canPlayType;

    return self;
  }

  Popcorn.HTMLYouTubeVideoElement = function( id ) {
    return new HTMLYouTubeVideoElement( id );
  };

  // Helper for identifying URLs we know how to play.
  Popcorn.HTMLYouTubeVideoElement._canPlaySrc = function( url ) {
    return (/(?:http:\/\/www\.|http:\/\/|www\.|\.|^)(youtu).*(?:\/|v=)(.{11})/).test( url ) ?
      "probably" :
      EMPTY_STRING;
  };

  // We'll attempt to support a mime type of video/x-youtube
  Popcorn.HTMLYouTubeVideoElement.canPlayType = function( type ) {
    return type === "video/x-youtube" ? "probably" : EMPTY_STRING;
  };

}( Popcorn, window, document ));


// PLUGIN: Transcript

(function ( Popcorn ) {

	/**
	 * Transcript popcorn plug-in 
	 * Displays a transcript in the target div or DOM node.
	 * Options parameter will need a time and a target.
	 * Optional parameters are futureClass.
	 * 
	 * Time is the time that you want this plug-in to execute,
	 * Target is the id of the document element that the content refers
	 * to, or the DoM node itself. This target element must exist on the DOM
	 * futureClass is the CSS class name to be used when the target has not been read yet.
	 *
	 * 
	 * @param {Object} options
	 * 
	 * Example:
		var p = Popcorn('#video')
			.transcript({
				time:        5,                  // seconds, mandatory
				target:      'word-42',          // mandatory
				futureClass: 'transcript-hide'   // optional
			})
			.transcript({
				time:        32,                                    // seconds, mandatory
				target:      document.getElementById( 'word-84' ),  // mandatory
				futureClass: 'transcript-grey'                      // optional
			});
	 *
	 */

	// This plugin assumes that you are generating the plugins in the order of the text.
	// So that the parent may be compared to the previous ones parent.

	Popcorn.plugin( "transcript" , (function() {

		// Define plugin wide variables out here

		var pParent;

		return {

			// Plugin manifest for Butter
			manifest: {
				about:{
					name: "Popcorn Transcript Plugin",
					version: "0.2",
					author:  "Mark Panaghiston",
					website: "http://www.jplayer.org/"
				},
				options:{
					time: {elem:'input', type:'text', label:'In'},
					target:  'Transcript-container',
					futureClass: {elem:'input', type:'text', label:'Class'},
					onNewPara: function() {}
				}
			},

			_setup: function( track ) {

				// setup code, fire on initialization

				// |track| refers to the TrackEvent created by the options passed into the plugin on init
				// this refers to the popcorn object

				var parent, iAmNewPara;

				// if a target is specified and is a string, use that - Requires every word <span> to have a unique ID.
				// else if target is specified and is an object, use object as DOM reference
				// else Throw an error.
				if ( track.target && typeof track.target === "string" && track.target !== 'Transcript-container' ) {
					track.container = document.getElementById( track.target );
				} else if ( track.target && typeof track.target === "object" ) {
					track.container = track.target;
				} else {
					throw "Popcorn.transcript: target property must be an ID string or a pointer to the DOM of the transcript word.";
				}

				track.start = 0;
				track.end = track.time;

				if(!track.futureClass) {
					track.futureClass = "transcript-future";
				}

				parent = track.target.parentNode;
				if(parent !== pParent) {
					iAmNewPara = true;
					pParent = parent;
				}

				track.transcriptRead = function() {
					if( track.container.classList ) {
						track.container.classList.remove(track.futureClass);
					} else {
						track.container.className = "";
					}
					if(iAmNewPara && typeof track.onNewPara === 'function') {
						track.onNewPara(track.target.parentNode);
					}
				};

				track.transcriptFuture = function() {
					if( track.container.classList ) {
						track.container.classList.add(track.futureClass);
					} else {
						track.container.className = track.futureClass;
					}
				};

				// Note: end times close to zero can have issues. (Firefox 4.0 worked with 100ms. Chrome needed 200ms. iOS needed 500ms)
				// if(track.end > track.start) {
					// track.transcriptFuture();
				// }

				if(track.end <= this.media.currentTime) {
					track.transcriptRead();
				} else {
					track.transcriptFuture();
				}

			},

			_update: function( track ) {
				// update code, fire on update/modification of a plugin created track event.
			},

			_teardown: function( track ) {
				// teardown code, fire on removal of plugin or destruction of instance
			},

			start: function( event, track ) {
				track.transcriptFuture();
			},

			end: function( event, track ) {
				track.transcriptRead();
			}
		};
	})());
})( Popcorn );


/*! iScroll v5.1.2 ~ (c) 2008-2014 Matteo Spinelli ~ http://cubiq.org/license */
(function (window, document, Math) {
var rAF = window.requestAnimationFrame	||
	window.webkitRequestAnimationFrame	||
	window.mozRequestAnimationFrame		||
	window.oRequestAnimationFrame		||
	window.msRequestAnimationFrame		||
	function (callback) { window.setTimeout(callback, 1000 / 60); };

var utils = (function () {
	var me = {};

	var _elementStyle = document.createElement('div').style;
	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransform';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	me.getTime = Date.now || function getTime () { return new Date().getTime(); };

	me.extend = function (target, obj) {
		for ( var i in obj ) {
			target[i] = obj[i];
		}
	};

	me.addEvent = function (el, type, fn, capture) {
		el.addEventListener(type, fn, !!capture);
	};

	me.removeEvent = function (el, type, fn, capture) {
		el.removeEventListener(type, fn, !!capture);
	};

	me.prefixPointerEvent = function (pointerEvent) {
		return window.MSPointerEvent ? 
			'MSPointer' + pointerEvent.charAt(9).toUpperCase() + pointerEvent.substr(10):
			pointerEvent;
	};

	me.momentum = function (current, start, time, lowerMargin, wrapperSize, deceleration) {
		var distance = current - start,
			speed = Math.abs(distance) / time,
			destination,
			duration;

		deceleration = deceleration === undefined ? 0.0006 : deceleration;

		destination = current + ( speed * speed ) / ( 2 * deceleration ) * ( distance < 0 ? -1 : 1 );
		duration = speed / deceleration;

		if ( destination < lowerMargin ) {
			destination = wrapperSize ? lowerMargin - ( wrapperSize / 2.5 * ( speed / 8 ) ) : lowerMargin;
			distance = Math.abs(destination - current);
			duration = distance / speed;
		} else if ( destination > 0 ) {
			destination = wrapperSize ? wrapperSize / 2.5 * ( speed / 8 ) : 0;
			distance = Math.abs(current) + destination;
			duration = distance / speed;
		}

		return {
			destination: Math.round(destination),
			duration: duration
		};
	};

	var _transform = _prefixStyle('transform');

	me.extend(me, {
		hasTransform: _transform !== false,
		hasPerspective: _prefixStyle('perspective') in _elementStyle,
		hasTouch: 'ontouchstart' in window,
		hasPointer: window.PointerEvent || window.MSPointerEvent, // IE10 is prefixed
		hasTransition: _prefixStyle('transition') in _elementStyle
	});

	// This should find all Android browsers lower than build 535.19 (both stock browser and webview)
	me.isBadAndroid = /Android /.test(window.navigator.appVersion) && !(/Chrome\/\d/.test(window.navigator.appVersion));

	me.extend(me.style = {}, {
		transform: _transform,
		transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
		transitionDuration: _prefixStyle('transitionDuration'),
		transitionDelay: _prefixStyle('transitionDelay'),
		transformOrigin: _prefixStyle('transformOrigin')
	});

	me.hasClass = function (e, c) {
		var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
		return re.test(e.className);
	};

	me.addClass = function (e, c) {
		if ( me.hasClass(e, c) ) {
			return;
		}

		var newclass = e.className.split(' ');
		newclass.push(c);
		e.className = newclass.join(' ');
	};

	me.removeClass = function (e, c) {
		if ( !me.hasClass(e, c) ) {
			return;
		}

		var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
		e.className = e.className.replace(re, ' ');
	};

	me.offset = function (el) {
		var left = -el.offsetLeft,
			top = -el.offsetTop;

		// jshint -W084
		while (el = el.offsetParent) {
			left -= el.offsetLeft;
			top -= el.offsetTop;
		}
		// jshint +W084

		return {
			left: left,
			top: top
		};
	};

	me.preventDefaultException = function (el, exceptions) {
		for ( var i in exceptions ) {
			if ( exceptions[i].test(el[i]) ) {
				return true;
			}
		}

		return false;
	};

	me.extend(me.eventType = {}, {
		touchstart: 1,
		touchmove: 1,
		touchend: 1,

		mousedown: 2,
		mousemove: 2,
		mouseup: 2,

		pointerdown: 3,
		pointermove: 3,
		pointerup: 3,

		MSPointerDown: 3,
		MSPointerMove: 3,
		MSPointerUp: 3
	});

	me.extend(me.ease = {}, {
		quadratic: {
			style: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
			fn: function (k) {
				return k * ( 2 - k );
			}
		},
		circular: {
			style: 'cubic-bezier(0.1, 0.57, 0.1, 1)',	// Not properly "circular" but this looks better, it should be (0.075, 0.82, 0.165, 1)
			fn: function (k) {
				return Math.sqrt( 1 - ( --k * k ) );
			}
		},
		back: {
			style: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
			fn: function (k) {
				var b = 4;
				return ( k = k - 1 ) * k * ( ( b + 1 ) * k + b ) + 1;
			}
		},
		bounce: {
			style: '',
			fn: function (k) {
				if ( ( k /= 1 ) < ( 1 / 2.75 ) ) {
					return 7.5625 * k * k;
				} else if ( k < ( 2 / 2.75 ) ) {
					return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;
				} else if ( k < ( 2.5 / 2.75 ) ) {
					return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;
				} else {
					return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;
				}
			}
		},
		elastic: {
			style: '',
			fn: function (k) {
				var f = 0.22,
					e = 0.4;

				if ( k === 0 ) { return 0; }
				if ( k == 1 ) { return 1; }

				return ( e * Math.pow( 2, - 10 * k ) * Math.sin( ( k - f / 4 ) * ( 2 * Math.PI ) / f ) + 1 );
			}
		}
	});

	me.tap = function (e, eventName) {
		var ev = document.createEvent('Event');
		ev.initEvent(eventName, true, true);
		ev.pageX = e.pageX;
		ev.pageY = e.pageY;
		e.target.dispatchEvent(ev);
	};

	me.click = function (e) {
		var target = e.target,
			ev;

		if ( !(/(SELECT|INPUT|TEXTAREA)/i).test(target.tagName) ) {
			ev = document.createEvent('MouseEvents');
			ev.initMouseEvent('click', true, true, e.view, 1,
				target.screenX, target.screenY, target.clientX, target.clientY,
				e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
				0, null);

			ev._constructed = true;
			target.dispatchEvent(ev);
		}
	};

	return me;
})();

function IScroll (el, options) {
	this.wrapper = typeof el == 'string' ? document.querySelector(el) : el;
	this.scroller = this.wrapper.children[0];
	this.scrollerStyle = this.scroller.style;		// cache style for better performance

	this.options = {

		resizeScrollbars: true,

		mouseWheelSpeed: 20,

		snapThreshold: 0.334,

// INSERT POINT: OPTIONS 

		startX: 0,
		startY: 0,
		scrollY: true,
		directionLockThreshold: 5,
		momentum: true,

		bounce: true,
		bounceTime: 600,
		bounceEasing: '',

		preventDefault: true,
		preventDefaultException: { tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/ },

		HWCompositing: true,
		useTransition: true,
		useTransform: true
	};

	for ( var i in options ) {
		this.options[i] = options[i];
	}

	// Normalize options
	this.translateZ = this.options.HWCompositing && utils.hasPerspective ? ' translateZ(0)' : '';

	this.options.useTransition = utils.hasTransition && this.options.useTransition;
	this.options.useTransform = utils.hasTransform && this.options.useTransform;

	this.options.eventPassthrough = this.options.eventPassthrough === true ? 'vertical' : this.options.eventPassthrough;
	this.options.preventDefault = !this.options.eventPassthrough && this.options.preventDefault;

	// If you want eventPassthrough I have to lock one of the axes
	this.options.scrollY = this.options.eventPassthrough == 'vertical' ? false : this.options.scrollY;
	this.options.scrollX = this.options.eventPassthrough == 'horizontal' ? false : this.options.scrollX;

	// With eventPassthrough we also need lockDirection mechanism
	this.options.freeScroll = this.options.freeScroll && !this.options.eventPassthrough;
	this.options.directionLockThreshold = this.options.eventPassthrough ? 0 : this.options.directionLockThreshold;

	this.options.bounceEasing = typeof this.options.bounceEasing == 'string' ? utils.ease[this.options.bounceEasing] || utils.ease.circular : this.options.bounceEasing;

	this.options.resizePolling = this.options.resizePolling === undefined ? 60 : this.options.resizePolling;

	if ( this.options.tap === true ) {
		this.options.tap = 'tap';
	}

	if ( this.options.shrinkScrollbars == 'scale' ) {
		this.options.useTransition = false;
	}

	this.options.invertWheelDirection = this.options.invertWheelDirection ? -1 : 1;

// INSERT POINT: NORMALIZATION

	// Some defaults	
	this.x = 0;
	this.y = 0;
	this.directionX = 0;
	this.directionY = 0;
	this._events = {};

// INSERT POINT: DEFAULTS

	this._init();
	this.refresh();

	this.scrollTo(this.options.startX, this.options.startY);
	this.enable();
}

IScroll.prototype = {
	version: '5.1.2',

	_init: function () {
		this._initEvents();

		if ( this.options.scrollbars || this.options.indicators ) {
			this._initIndicators();
		}

		if ( this.options.mouseWheel ) {
			this._initWheel();
		}

		if ( this.options.snap ) {
			this._initSnap();
		}

		if ( this.options.keyBindings ) {
			this._initKeys();
		}

// INSERT POINT: _init

	},

	destroy: function () {
		this._initEvents(true);

		this._execEvent('destroy');
	},

	_transitionEnd: function (e) {
		if ( e.target != this.scroller || !this.isInTransition ) {
			return;
		}

		this._transitionTime();
		if ( !this.resetPosition(this.options.bounceTime) ) {
			this.isInTransition = false;
			this._execEvent('scrollEnd');
		}
	},

	_start: function (e) {
		// React to left mouse button only
		if ( utils.eventType[e.type] != 1 ) {
			if ( e.button !== 0 ) {
				return;
			}
		}

		if ( !this.enabled || (this.initiated && utils.eventType[e.type] !== this.initiated) ) {
			return;
		}

		if ( this.options.preventDefault && !utils.isBadAndroid && !utils.preventDefaultException(e.target, this.options.preventDefaultException) ) {
			e.preventDefault();
		}

		var point = e.touches ? e.touches[0] : e,
			pos;

		this.initiated	= utils.eventType[e.type];
		this.moved		= false;
		this.distX		= 0;
		this.distY		= 0;
		this.directionX = 0;
		this.directionY = 0;
		this.directionLocked = 0;

		this._transitionTime();

		this.startTime = utils.getTime();

		if ( this.options.useTransition && this.isInTransition ) {
			this.isInTransition = false;
			pos = this.getComputedPosition();
			this._translate(Math.round(pos.x), Math.round(pos.y));
			this._execEvent('scrollEnd');
		} else if ( !this.options.useTransition && this.isAnimating ) {
			this.isAnimating = false;
			this._execEvent('scrollEnd');
		}

		this.startX    = this.x;
		this.startY    = this.y;
		this.absStartX = this.x;
		this.absStartY = this.y;
		this.pointX    = point.pageX;
		this.pointY    = point.pageY;

		this._execEvent('beforeScrollStart');
	},

	_move: function (e) {
		if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
			return;
		}

		if ( this.options.preventDefault ) {	// increases performance on Android? TODO: check!
			e.preventDefault();
		}

		var point		= e.touches ? e.touches[0] : e,
			deltaX		= point.pageX - this.pointX,
			deltaY		= point.pageY - this.pointY,
			timestamp	= utils.getTime(),
			newX, newY,
			absDistX, absDistY;

		this.pointX		= point.pageX;
		this.pointY		= point.pageY;

		this.distX		+= deltaX;
		this.distY		+= deltaY;
		absDistX		= Math.abs(this.distX);
		absDistY		= Math.abs(this.distY);

		// We need to move at least 10 pixels for the scrolling to initiate
		if ( timestamp - this.endTime > 300 && (absDistX < 10 && absDistY < 10) ) {
			return;
		}

		// If you are scrolling in one direction lock the other
		if ( !this.directionLocked && !this.options.freeScroll ) {
			if ( absDistX > absDistY + this.options.directionLockThreshold ) {
				this.directionLocked = 'h';		// lock horizontally
			} else if ( absDistY >= absDistX + this.options.directionLockThreshold ) {
				this.directionLocked = 'v';		// lock vertically
			} else {
				this.directionLocked = 'n';		// no lock
			}
		}

		if ( this.directionLocked == 'h' ) {
			if ( this.options.eventPassthrough == 'vertical' ) {
				e.preventDefault();
			} else if ( this.options.eventPassthrough == 'horizontal' ) {
				this.initiated = false;
				return;
			}

			deltaY = 0;
		} else if ( this.directionLocked == 'v' ) {
			if ( this.options.eventPassthrough == 'horizontal' ) {
				e.preventDefault();
			} else if ( this.options.eventPassthrough == 'vertical' ) {
				this.initiated = false;
				return;
			}

			deltaX = 0;
		}

		deltaX = this.hasHorizontalScroll ? deltaX : 0;
		deltaY = this.hasVerticalScroll ? deltaY : 0;

		newX = this.x + deltaX;
		newY = this.y + deltaY;

		// Slow down if outside of the boundaries
		if ( newX > 0 || newX < this.maxScrollX ) {
			newX = this.options.bounce ? this.x + deltaX / 3 : newX > 0 ? 0 : this.maxScrollX;
		}
		if ( newY > 0 || newY < this.maxScrollY ) {
			newY = this.options.bounce ? this.y + deltaY / 3 : newY > 0 ? 0 : this.maxScrollY;
		}

		this.directionX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
		this.directionY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

		if ( !this.moved ) {
			this._execEvent('scrollStart');
		}

		this.moved = true;

		this._translate(newX, newY);

/* REPLACE START: _move */

		if ( timestamp - this.startTime > 300 ) {
			this.startTime = timestamp;
			this.startX = this.x;
			this.startY = this.y;
		}

/* REPLACE END: _move */

	},

	_end: function (e) {
		if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
			return;
		}

		if ( this.options.preventDefault && !utils.preventDefaultException(e.target, this.options.preventDefaultException) ) {
			e.preventDefault();
		}

		var point = e.changedTouches ? e.changedTouches[0] : e,
			momentumX,
			momentumY,
			duration = utils.getTime() - this.startTime,
			newX = Math.round(this.x),
			newY = Math.round(this.y),
			distanceX = Math.abs(newX - this.startX),
			distanceY = Math.abs(newY - this.startY),
			time = 0,
			easing = '';

		this.isInTransition = 0;
		this.initiated = 0;
		this.endTime = utils.getTime();

		// reset if we are outside of the boundaries
		if ( this.resetPosition(this.options.bounceTime) ) {
			return;
		}

		this.scrollTo(newX, newY);	// ensures that the last position is rounded

		// we scrolled less than 10 pixels
		if ( !this.moved ) {
			if ( this.options.tap ) {
				utils.tap(e, this.options.tap);
			}

			if ( this.options.click ) {
				utils.click(e);
			}

			this._execEvent('scrollCancel');
			return;
		}

		if ( this._events.flick && duration < 200 && distanceX < 100 && distanceY < 100 ) {
			this._execEvent('flick');
			return;
		}

		// start momentum animation if needed
		if ( this.options.momentum && duration < 300 ) {
			momentumX = this.hasHorizontalScroll ? utils.momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options.deceleration) : { destination: newX, duration: 0 };
			momentumY = this.hasVerticalScroll ? utils.momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options.deceleration) : { destination: newY, duration: 0 };
			newX = momentumX.destination;
			newY = momentumY.destination;
			time = Math.max(momentumX.duration, momentumY.duration);
			this.isInTransition = 1;
		}


		if ( this.options.snap ) {
			var snap = this._nearestSnap(newX, newY);
			this.currentPage = snap;
			time = this.options.snapSpeed || Math.max(
					Math.max(
						Math.min(Math.abs(newX - snap.x), 1000),
						Math.min(Math.abs(newY - snap.y), 1000)
					), 300);
			newX = snap.x;
			newY = snap.y;

			this.directionX = 0;
			this.directionY = 0;
			easing = this.options.bounceEasing;
		}

// INSERT POINT: _end

		if ( newX != this.x || newY != this.y ) {
			// change easing function when scroller goes out of the boundaries
			if ( newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY ) {
				easing = utils.ease.quadratic;
			}

			this.scrollTo(newX, newY, time, easing);
			return;
		}

		this._execEvent('scrollEnd');
	},

	_resize: function () {
		var that = this;

		clearTimeout(this.resizeTimeout);

		this.resizeTimeout = setTimeout(function () {
			that.refresh();
		}, this.options.resizePolling);
	},

	resetPosition: function (time) {
		var x = this.x,
			y = this.y;

		time = time || 0;

		if ( !this.hasHorizontalScroll || this.x > 0 ) {
			x = 0;
		} else if ( this.x < this.maxScrollX ) {
			x = this.maxScrollX;
		}

		if ( !this.hasVerticalScroll || this.y > 0 ) {
			y = 0;
		} else if ( this.y < this.maxScrollY ) {
			y = this.maxScrollY;
		}

		if ( x == this.x && y == this.y ) {
			return false;
		}

		this.scrollTo(x, y, time, this.options.bounceEasing);

		return true;
	},

	disable: function () {
		this.enabled = false;
	},

	enable: function () {
		this.enabled = true;
	},

	refresh: function () {
		var rf = this.wrapper.offsetHeight;		// Force reflow

		this.wrapperWidth	= this.wrapper.clientWidth;
		this.wrapperHeight	= this.wrapper.clientHeight;

/* REPLACE START: refresh */

		this.scrollerWidth	= this.scroller.offsetWidth;
		this.scrollerHeight	= this.scroller.offsetHeight;

		this.maxScrollX		= this.wrapperWidth - this.scrollerWidth;
		this.maxScrollY		= this.wrapperHeight - this.scrollerHeight;

/* REPLACE END: refresh */

		this.hasHorizontalScroll	= this.options.scrollX && this.maxScrollX < 0;
		this.hasVerticalScroll		= this.options.scrollY && this.maxScrollY < 0;

		if ( !this.hasHorizontalScroll ) {
			this.maxScrollX = 0;
			this.scrollerWidth = this.wrapperWidth;
		}

		if ( !this.hasVerticalScroll ) {
			this.maxScrollY = 0;
			this.scrollerHeight = this.wrapperHeight;
		}

		this.endTime = 0;
		this.directionX = 0;
		this.directionY = 0;

		this.wrapperOffset = utils.offset(this.wrapper);

		this._execEvent('refresh');

		this.resetPosition();

// INSERT POINT: _refresh

	},

	on: function (type, fn) {
		if ( !this._events[type] ) {
			this._events[type] = [];
		}

		this._events[type].push(fn);
	},

	off: function (type, fn) {
		if ( !this._events[type] ) {
			return;
		}

		var index = this._events[type].indexOf(fn);

		if ( index > -1 ) {
			this._events[type].splice(index, 1);
		}
	},

	_execEvent: function (type) {
		if ( !this._events[type] ) {
			return;
		}

		var i = 0,
			l = this._events[type].length;

		if ( !l ) {
			return;
		}

		for ( ; i < l; i++ ) {
			this._events[type][i].apply(this, [].slice.call(arguments, 1));
		}
	},

	scrollBy: function (x, y, time, easing) {
		x = this.x + x;
		y = this.y + y;
		time = time || 0;

		this.scrollTo(x, y, time, easing);
	},

	scrollTo: function (x, y, time, easing) {
		easing = easing || utils.ease.circular;

		this.isInTransition = this.options.useTransition && time > 0;

		if ( !time || (this.options.useTransition && easing.style) ) {
			this._transitionTimingFunction(easing.style);
			this._transitionTime(time);
			this._translate(x, y);
		} else {
			this._animate(x, y, time, easing.fn);
		}
	},

	scrollToElement: function (el, time, offsetX, offsetY, easing) {
		el = el.nodeType ? el : this.scroller.querySelector(el);

		if ( !el ) {
			return;
		}

		var pos = utils.offset(el);

		pos.left -= this.wrapperOffset.left;
		pos.top  -= this.wrapperOffset.top;

		// if offsetX/Y are true we center the element to the screen
		if ( offsetX === true ) {
			offsetX = Math.round(el.offsetWidth / 2 - this.wrapper.offsetWidth / 2);
		}
		if ( offsetY === true ) {
			offsetY = Math.round(el.offsetHeight / 2 - this.wrapper.offsetHeight / 2);
		}

		pos.left -= offsetX || 0;
		pos.top  -= offsetY || 0;

		pos.left = pos.left > 0 ? 0 : pos.left < this.maxScrollX ? this.maxScrollX : pos.left;
		pos.top  = pos.top  > 0 ? 0 : pos.top  < this.maxScrollY ? this.maxScrollY : pos.top;

		time = time === undefined || time === null || time === 'auto' ? Math.max(Math.abs(this.x-pos.left), Math.abs(this.y-pos.top)) : time;

		this.scrollTo(pos.left, pos.top, time, easing);
	},

	_transitionTime: function (time) {
		time = time || 0;

		this.scrollerStyle[utils.style.transitionDuration] = time + 'ms';

		if ( !time && utils.isBadAndroid ) {
			this.scrollerStyle[utils.style.transitionDuration] = '0.001s';
		}


		if ( this.indicators ) {
			for ( var i = this.indicators.length; i--; ) {
				this.indicators[i].transitionTime(time);
			}
		}


// INSERT POINT: _transitionTime

	},

	_transitionTimingFunction: function (easing) {
		this.scrollerStyle[utils.style.transitionTimingFunction] = easing;


		if ( this.indicators ) {
			for ( var i = this.indicators.length; i--; ) {
				this.indicators[i].transitionTimingFunction(easing);
			}
		}


// INSERT POINT: _transitionTimingFunction

	},

	_translate: function (x, y) {
		if ( this.options.useTransform ) {

/* REPLACE START: _translate */

			this.scrollerStyle[utils.style.transform] = 'translate(' + x + 'px,' + y + 'px)' + this.translateZ;

/* REPLACE END: _translate */

		} else {
			x = Math.round(x);
			y = Math.round(y);
			this.scrollerStyle.left = x + 'px';
			this.scrollerStyle.top = y + 'px';
		}

		this.x = x;
		this.y = y;


	if ( this.indicators ) {
		for ( var i = this.indicators.length; i--; ) {
			this.indicators[i].updatePosition();
		}
	}


// INSERT POINT: _translate

	},

	_initEvents: function (remove) {
		var eventType = remove ? utils.removeEvent : utils.addEvent,
			target = this.options.bindToWrapper ? this.wrapper : window;

		eventType(window, 'orientationchange', this);
		eventType(window, 'resize', this);

		if ( this.options.click ) {
			eventType(this.wrapper, 'click', this, true);
		}

		if ( !this.options.disableMouse ) {
			eventType(this.wrapper, 'mousedown', this);
			eventType(target, 'mousemove', this);
			eventType(target, 'mousecancel', this);
			eventType(target, 'mouseup', this);
		}

		if ( utils.hasPointer && !this.options.disablePointer ) {
			eventType(this.wrapper, utils.prefixPointerEvent('pointerdown'), this);
			eventType(target, utils.prefixPointerEvent('pointermove'), this);
			eventType(target, utils.prefixPointerEvent('pointercancel'), this);
			eventType(target, utils.prefixPointerEvent('pointerup'), this);
		}

		if ( utils.hasTouch && !this.options.disableTouch ) {
			eventType(this.wrapper, 'touchstart', this);
			eventType(target, 'touchmove', this);
			eventType(target, 'touchcancel', this);
			eventType(target, 'touchend', this);
		}

		eventType(this.scroller, 'transitionend', this);
		eventType(this.scroller, 'webkitTransitionEnd', this);
		eventType(this.scroller, 'oTransitionEnd', this);
		eventType(this.scroller, 'MSTransitionEnd', this);
	},

	getComputedPosition: function () {
		var matrix = window.getComputedStyle(this.scroller, null),
			x, y;

		if ( this.options.useTransform ) {
			matrix = matrix[utils.style.transform].split(')')[0].split(', ');
			x = +(matrix[12] || matrix[4]);
			y = +(matrix[13] || matrix[5]);
		} else {
			x = +matrix.left.replace(/[^-\d.]/g, '');
			y = +matrix.top.replace(/[^-\d.]/g, '');
		}

		return { x: x, y: y };
	},

	_initIndicators: function () {
		var interactive = this.options.interactiveScrollbars,
			customStyle = typeof this.options.scrollbars != 'string',
			indicators = [],
			indicator;

		var that = this;

		this.indicators = [];

		if ( this.options.scrollbars ) {
			// Vertical scrollbar
			if ( this.options.scrollY ) {
				indicator = {
					el: createDefaultScrollbar('v', interactive, this.options.scrollbars),
					interactive: interactive,
					defaultScrollbars: true,
					customStyle: customStyle,
					resize: this.options.resizeScrollbars,
					shrink: this.options.shrinkScrollbars,
					fade: this.options.fadeScrollbars,
					listenX: false
				};

				this.wrapper.appendChild(indicator.el);
				indicators.push(indicator);
			}

			// Horizontal scrollbar
			if ( this.options.scrollX ) {
				indicator = {
					el: createDefaultScrollbar('h', interactive, this.options.scrollbars),
					interactive: interactive,
					defaultScrollbars: true,
					customStyle: customStyle,
					resize: this.options.resizeScrollbars,
					shrink: this.options.shrinkScrollbars,
					fade: this.options.fadeScrollbars,
					listenY: false
				};

				this.wrapper.appendChild(indicator.el);
				indicators.push(indicator);
			}
		}

		if ( this.options.indicators ) {
			// TODO: check concat compatibility
			indicators = indicators.concat(this.options.indicators);
		}

		for ( var i = indicators.length; i--; ) {
			this.indicators.push( new Indicator(this, indicators[i]) );
		}

		// TODO: check if we can use array.map (wide compatibility and performance issues)
		function _indicatorsMap (fn) {
			for ( var i = that.indicators.length; i--; ) {
				fn.call(that.indicators[i]);
			}
		}

		if ( this.options.fadeScrollbars ) {
			this.on('scrollEnd', function () {
				_indicatorsMap(function () {
					this.fade();
				});
			});

			this.on('scrollCancel', function () {
				_indicatorsMap(function () {
					this.fade();
				});
			});

			this.on('scrollStart', function () {
				_indicatorsMap(function () {
					this.fade(1);
				});
			});

			this.on('beforeScrollStart', function () {
				_indicatorsMap(function () {
					this.fade(1, true);
				});
			});
		}


		this.on('refresh', function () {
			_indicatorsMap(function () {
				this.refresh();
			});
		});

		this.on('destroy', function () {
			_indicatorsMap(function () {
				this.destroy();
			});

			delete this.indicators;
		});
	},

	_initWheel: function () {
		utils.addEvent(this.wrapper, 'wheel', this);
		utils.addEvent(this.wrapper, 'mousewheel', this);
		utils.addEvent(this.wrapper, 'DOMMouseScroll', this);

		this.on('destroy', function () {
			utils.removeEvent(this.wrapper, 'wheel', this);
			utils.removeEvent(this.wrapper, 'mousewheel', this);
			utils.removeEvent(this.wrapper, 'DOMMouseScroll', this);
		});
	},

	_wheel: function (e) {
		if ( !this.enabled ) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		var wheelDeltaX, wheelDeltaY,
			newX, newY,
			that = this;

		if ( this.wheelTimeout === undefined ) {
			that._execEvent('scrollStart');
		}

		// Execute the scrollEnd event after 400ms the wheel stopped scrolling
		clearTimeout(this.wheelTimeout);
		this.wheelTimeout = setTimeout(function () {
			that._execEvent('scrollEnd');
			that.wheelTimeout = undefined;
		}, 400);

		if ( 'deltaX' in e ) {

			// Manual fix of Firefox mouse wheel bug.
			// https://github.com/cubiq/iscroll/issues/577
			// https://github.com/BryanTheCrow/iscroll/commit/3480247348392ea44ff6a0b9aec5c6a9043593df

			// wheelDeltaX = -e.deltaX;
			// wheelDeltaY = -e.deltaY;

			if (e.deltaMode === 1) {
				wheelDeltaX = -e.deltaX * this.options.mouseWheelSpeed;
				wheelDeltaY = -e.deltaY * this.options.mouseWheelSpeed;
			} else {
				wheelDeltaX = -e.deltaX;
				wheelDeltaY = -e.deltaY;
			}

		} else if ( 'wheelDeltaX' in e ) {
			wheelDeltaX = e.wheelDeltaX / 120 * this.options.mouseWheelSpeed;
			wheelDeltaY = e.wheelDeltaY / 120 * this.options.mouseWheelSpeed;
		} else if ( 'wheelDelta' in e ) {
			wheelDeltaX = wheelDeltaY = e.wheelDelta / 120 * this.options.mouseWheelSpeed;
		} else if ( 'detail' in e ) {
			wheelDeltaX = wheelDeltaY = -e.detail / 3 * this.options.mouseWheelSpeed;
		} else {
			return;
		}

		wheelDeltaX *= this.options.invertWheelDirection;
		wheelDeltaY *= this.options.invertWheelDirection;

		if ( !this.hasVerticalScroll ) {
			wheelDeltaX = wheelDeltaY;
			wheelDeltaY = 0;
		}

		if ( this.options.snap ) {
			newX = this.currentPage.pageX;
			newY = this.currentPage.pageY;

			if ( wheelDeltaX > 0 ) {
				newX--;
			} else if ( wheelDeltaX < 0 ) {
				newX++;
			}

			if ( wheelDeltaY > 0 ) {
				newY--;
			} else if ( wheelDeltaY < 0 ) {
				newY++;
			}

			this.goToPage(newX, newY);

			return;
		}

		newX = this.x + Math.round(this.hasHorizontalScroll ? wheelDeltaX : 0);
		newY = this.y + Math.round(this.hasVerticalScroll ? wheelDeltaY : 0);

		if ( newX > 0 ) {
			newX = 0;
		} else if ( newX < this.maxScrollX ) {
			newX = this.maxScrollX;
		}

		if ( newY > 0 ) {
			newY = 0;
		} else if ( newY < this.maxScrollY ) {
			newY = this.maxScrollY;
		}

		this.scrollTo(newX, newY, 0);

// INSERT POINT: _wheel
	},

	_initSnap: function () {
		this.currentPage = {};

		if ( typeof this.options.snap == 'string' ) {
			this.options.snap = this.scroller.querySelectorAll(this.options.snap);
		}

		this.on('refresh', function () {
			var i = 0, l,
				m = 0, n,
				cx, cy,
				x = 0, y,
				stepX = this.options.snapStepX || this.wrapperWidth,
				stepY = this.options.snapStepY || this.wrapperHeight,
				el;

			this.pages = [];

			if ( !this.wrapperWidth || !this.wrapperHeight || !this.scrollerWidth || !this.scrollerHeight ) {
				return;
			}

			if ( this.options.snap === true ) {
				cx = Math.round( stepX / 2 );
				cy = Math.round( stepY / 2 );

				while ( x > -this.scrollerWidth ) {
					this.pages[i] = [];
					l = 0;
					y = 0;

					while ( y > -this.scrollerHeight ) {
						this.pages[i][l] = {
							x: Math.max(x, this.maxScrollX),
							y: Math.max(y, this.maxScrollY),
							width: stepX,
							height: stepY,
							cx: x - cx,
							cy: y - cy
						};

						y -= stepY;
						l++;
					}

					x -= stepX;
					i++;
				}
			} else {
				el = this.options.snap;
				l = el.length;
				n = -1;

				for ( ; i < l; i++ ) {
					if ( i === 0 || el[i].offsetLeft <= el[i-1].offsetLeft ) {
						m = 0;
						n++;
					}

					if ( !this.pages[m] ) {
						this.pages[m] = [];
					}

					x = Math.max(-el[i].offsetLeft, this.maxScrollX);
					y = Math.max(-el[i].offsetTop, this.maxScrollY);
					cx = x - Math.round(el[i].offsetWidth / 2);
					cy = y - Math.round(el[i].offsetHeight / 2);

					this.pages[m][n] = {
						x: x,
						y: y,
						width: el[i].offsetWidth,
						height: el[i].offsetHeight,
						cx: cx,
						cy: cy
					};

					if ( x > this.maxScrollX ) {
						m++;
					}
				}
			}

			this.goToPage(this.currentPage.pageX || 0, this.currentPage.pageY || 0, 0);

			// Update snap threshold if needed
			if ( this.options.snapThreshold % 1 === 0 ) {
				this.snapThresholdX = this.options.snapThreshold;
				this.snapThresholdY = this.options.snapThreshold;
			} else {
				this.snapThresholdX = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].width * this.options.snapThreshold);
				this.snapThresholdY = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].height * this.options.snapThreshold);
			}
		});

		this.on('flick', function () {
			var time = this.options.snapSpeed || Math.max(
					Math.max(
						Math.min(Math.abs(this.x - this.startX), 1000),
						Math.min(Math.abs(this.y - this.startY), 1000)
					), 300);

			this.goToPage(
				this.currentPage.pageX + this.directionX,
				this.currentPage.pageY + this.directionY,
				time
			);
		});
	},

	_nearestSnap: function (x, y) {
		if ( !this.pages.length ) {
			return { x: 0, y: 0, pageX: 0, pageY: 0 };
		}

		var i = 0,
			l = this.pages.length,
			m = 0;

		// Check if we exceeded the snap threshold
		if ( Math.abs(x - this.absStartX) < this.snapThresholdX &&
			Math.abs(y - this.absStartY) < this.snapThresholdY ) {
			return this.currentPage;
		}

		if ( x > 0 ) {
			x = 0;
		} else if ( x < this.maxScrollX ) {
			x = this.maxScrollX;
		}

		if ( y > 0 ) {
			y = 0;
		} else if ( y < this.maxScrollY ) {
			y = this.maxScrollY;
		}

		for ( ; i < l; i++ ) {
			if ( x >= this.pages[i][0].cx ) {
				x = this.pages[i][0].x;
				break;
			}
		}

		l = this.pages[i].length;

		for ( ; m < l; m++ ) {
			if ( y >= this.pages[0][m].cy ) {
				y = this.pages[0][m].y;
				break;
			}
		}

		if ( i == this.currentPage.pageX ) {
			i += this.directionX;

			if ( i < 0 ) {
				i = 0;
			} else if ( i >= this.pages.length ) {
				i = this.pages.length - 1;
			}

			x = this.pages[i][0].x;
		}

		if ( m == this.currentPage.pageY ) {
			m += this.directionY;

			if ( m < 0 ) {
				m = 0;
			} else if ( m >= this.pages[0].length ) {
				m = this.pages[0].length - 1;
			}

			y = this.pages[0][m].y;
		}

		return {
			x: x,
			y: y,
			pageX: i,
			pageY: m
		};
	},

	goToPage: function (x, y, time, easing) {
		easing = easing || this.options.bounceEasing;

		if ( x >= this.pages.length ) {
			x = this.pages.length - 1;
		} else if ( x < 0 ) {
			x = 0;
		}

		if ( y >= this.pages[x].length ) {
			y = this.pages[x].length - 1;
		} else if ( y < 0 ) {
			y = 0;
		}

		var posX = this.pages[x][y].x,
			posY = this.pages[x][y].y;

		time = time === undefined ? this.options.snapSpeed || Math.max(
			Math.max(
				Math.min(Math.abs(posX - this.x), 1000),
				Math.min(Math.abs(posY - this.y), 1000)
			), 300) : time;

		this.currentPage = {
			x: posX,
			y: posY,
			pageX: x,
			pageY: y
		};

		this.scrollTo(posX, posY, time, easing);
	},

	next: function (time, easing) {
		var x = this.currentPage.pageX,
			y = this.currentPage.pageY;

		x++;

		if ( x >= this.pages.length && this.hasVerticalScroll ) {
			x = 0;
			y++;
		}

		this.goToPage(x, y, time, easing);
	},

	prev: function (time, easing) {
		var x = this.currentPage.pageX,
			y = this.currentPage.pageY;

		x--;

		if ( x < 0 && this.hasVerticalScroll ) {
			x = 0;
			y--;
		}

		this.goToPage(x, y, time, easing);
	},

	_initKeys: function (e) {
		// default key bindings
		var keys = {
			pageUp: 33,
			pageDown: 34,
			end: 35,
			home: 36,
			left: 37,
			up: 38,
			right: 39,
			down: 40
		};
		var i;

		// if you give me characters I give you keycode
		if ( typeof this.options.keyBindings == 'object' ) {
			for ( i in this.options.keyBindings ) {
				if ( typeof this.options.keyBindings[i] == 'string' ) {
					this.options.keyBindings[i] = this.options.keyBindings[i].toUpperCase().charCodeAt(0);
				}
			}
		} else {
			this.options.keyBindings = {};
		}

		for ( i in keys ) {
			this.options.keyBindings[i] = this.options.keyBindings[i] || keys[i];
		}

		utils.addEvent(window, 'keydown', this);

		this.on('destroy', function () {
			utils.removeEvent(window, 'keydown', this);
		});
	},

	_key: function (e) {
		if ( !this.enabled ) {
			return;
		}

		var snap = this.options.snap,	// we are using this alot, better to cache it
			newX = snap ? this.currentPage.pageX : this.x,
			newY = snap ? this.currentPage.pageY : this.y,
			now = utils.getTime(),
			prevTime = this.keyTime || 0,
			acceleration = 0.250,
			pos;

		if ( this.options.useTransition && this.isInTransition ) {
			pos = this.getComputedPosition();

			this._translate(Math.round(pos.x), Math.round(pos.y));
			this.isInTransition = false;
		}

		this.keyAcceleration = now - prevTime < 200 ? Math.min(this.keyAcceleration + acceleration, 50) : 0;

		switch ( e.keyCode ) {
			case this.options.keyBindings.pageUp:
				if ( this.hasHorizontalScroll && !this.hasVerticalScroll ) {
					newX += snap ? 1 : this.wrapperWidth;
				} else {
					newY += snap ? 1 : this.wrapperHeight;
				}
				break;
			case this.options.keyBindings.pageDown:
				if ( this.hasHorizontalScroll && !this.hasVerticalScroll ) {
					newX -= snap ? 1 : this.wrapperWidth;
				} else {
					newY -= snap ? 1 : this.wrapperHeight;
				}
				break;
			case this.options.keyBindings.end:
				newX = snap ? this.pages.length-1 : this.maxScrollX;
				newY = snap ? this.pages[0].length-1 : this.maxScrollY;
				break;
			case this.options.keyBindings.home:
				newX = 0;
				newY = 0;
				break;
			case this.options.keyBindings.left:
				newX += snap ? -1 : 5 + this.keyAcceleration>>0;
				break;
			case this.options.keyBindings.up:
				newY += snap ? 1 : 5 + this.keyAcceleration>>0;
				break;
			case this.options.keyBindings.right:
				newX -= snap ? -1 : 5 + this.keyAcceleration>>0;
				break;
			case this.options.keyBindings.down:
				newY -= snap ? 1 : 5 + this.keyAcceleration>>0;
				break;
			default:
				return;
		}

		if ( snap ) {
			this.goToPage(newX, newY);
			return;
		}

		if ( newX > 0 ) {
			newX = 0;
			this.keyAcceleration = 0;
		} else if ( newX < this.maxScrollX ) {
			newX = this.maxScrollX;
			this.keyAcceleration = 0;
		}

		if ( newY > 0 ) {
			newY = 0;
			this.keyAcceleration = 0;
		} else if ( newY < this.maxScrollY ) {
			newY = this.maxScrollY;
			this.keyAcceleration = 0;
		}

		this.scrollTo(newX, newY, 0);

		this.keyTime = now;
	},

	_animate: function (destX, destY, duration, easingFn) {
		var that = this,
			startX = this.x,
			startY = this.y,
			startTime = utils.getTime(),
			destTime = startTime + duration;

		function step () {
			var now = utils.getTime(),
				newX, newY,
				easing;

			if ( now >= destTime ) {
				that.isAnimating = false;
				that._translate(destX, destY);

				if ( !that.resetPosition(that.options.bounceTime) ) {
					that._execEvent('scrollEnd');
				}

				return;
			}

			now = ( now - startTime ) / duration;
			easing = easingFn(now);
			newX = ( destX - startX ) * easing + startX;
			newY = ( destY - startY ) * easing + startY;
			that._translate(newX, newY);

			if ( that.isAnimating ) {
				rAF(step);
			}
		}

		this.isAnimating = true;
		step();
	},
	handleEvent: function (e) {
		switch ( e.type ) {
			case 'touchstart':
			case 'pointerdown':
			case 'MSPointerDown':
			case 'mousedown':
				this._start(e);
				break;
			case 'touchmove':
			case 'pointermove':
			case 'MSPointerMove':
			case 'mousemove':
				this._move(e);
				break;
			case 'touchend':
			case 'pointerup':
			case 'MSPointerUp':
			case 'mouseup':
			case 'touchcancel':
			case 'pointercancel':
			case 'MSPointerCancel':
			case 'mousecancel':
				this._end(e);
				break;
			case 'orientationchange':
			case 'resize':
				this._resize();
				break;
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this._transitionEnd(e);
				break;
			case 'wheel':
			case 'DOMMouseScroll':
			case 'mousewheel':
				this._wheel(e);
				break;
			case 'keydown':
				this._key(e);
				break;
			case 'click':
				if ( !e._constructed ) {
					e.preventDefault();
					e.stopPropagation();
				}
				break;
		}
	}
};
function createDefaultScrollbar (direction, interactive, type) {
	var scrollbar = document.createElement('div'),
		indicator = document.createElement('div');

	if ( type === true ) {
		scrollbar.style.cssText = 'position:absolute;z-index:9999';
		indicator.style.cssText = '-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:absolute;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);border-radius:3px';
	}

	indicator.className = 'iScrollIndicator';

	if ( direction == 'h' ) {
		if ( type === true ) {
			scrollbar.style.cssText += ';height:7px;left:2px;right:2px;bottom:0';
			indicator.style.height = '100%';
		}
		scrollbar.className = 'iScrollHorizontalScrollbar';
	} else {
		if ( type === true ) {
			scrollbar.style.cssText += ';width:7px;bottom:2px;top:2px;right:1px';
			indicator.style.width = '100%';
		}
		scrollbar.className = 'iScrollVerticalScrollbar';
	}

	scrollbar.style.cssText += ';overflow:hidden';

	if ( !interactive ) {
		scrollbar.style.pointerEvents = 'none';
	}

	scrollbar.appendChild(indicator);

	return scrollbar;
}

function Indicator (scroller, options) {
	this.wrapper = typeof options.el == 'string' ? document.querySelector(options.el) : options.el;
	this.wrapperStyle = this.wrapper.style;
	this.indicator = this.wrapper.children[0];
	this.indicatorStyle = this.indicator.style;
	this.scroller = scroller;

	this.options = {
		listenX: true,
		listenY: true,
		interactive: false,
		resize: true,
		defaultScrollbars: false,
		shrink: false,
		fade: false,
		speedRatioX: 0,
		speedRatioY: 0
	};

	for ( var i in options ) {
		this.options[i] = options[i];
	}

	this.sizeRatioX = 1;
	this.sizeRatioY = 1;
	this.maxPosX = 0;
	this.maxPosY = 0;

	if ( this.options.interactive ) {
		if ( !this.options.disableTouch ) {
			utils.addEvent(this.indicator, 'touchstart', this);
			utils.addEvent(window, 'touchend', this);
		}
		if ( !this.options.disablePointer ) {
			utils.addEvent(this.indicator, utils.prefixPointerEvent('pointerdown'), this);
			utils.addEvent(window, utils.prefixPointerEvent('pointerup'), this);
		}
		if ( !this.options.disableMouse ) {
			utils.addEvent(this.indicator, 'mousedown', this);
			utils.addEvent(window, 'mouseup', this);
		}
	}

	if ( this.options.fade ) {
		this.wrapperStyle[utils.style.transform] = this.scroller.translateZ;
		this.wrapperStyle[utils.style.transitionDuration] = utils.isBadAndroid ? '0.001s' : '0ms';
		this.wrapperStyle.opacity = '0';
	}
}

Indicator.prototype = {
	handleEvent: function (e) {
		switch ( e.type ) {
			case 'touchstart':
			case 'pointerdown':
			case 'MSPointerDown':
			case 'mousedown':
				this._start(e);
				break;
			case 'touchmove':
			case 'pointermove':
			case 'MSPointerMove':
			case 'mousemove':
				this._move(e);
				break;
			case 'touchend':
			case 'pointerup':
			case 'MSPointerUp':
			case 'mouseup':
			case 'touchcancel':
			case 'pointercancel':
			case 'MSPointerCancel':
			case 'mousecancel':
				this._end(e);
				break;
		}
	},

	destroy: function () {
		if ( this.options.interactive ) {
			utils.removeEvent(this.indicator, 'touchstart', this);
			utils.removeEvent(this.indicator, utils.prefixPointerEvent('pointerdown'), this);
			utils.removeEvent(this.indicator, 'mousedown', this);

			utils.removeEvent(window, 'touchmove', this);
			utils.removeEvent(window, utils.prefixPointerEvent('pointermove'), this);
			utils.removeEvent(window, 'mousemove', this);

			utils.removeEvent(window, 'touchend', this);
			utils.removeEvent(window, utils.prefixPointerEvent('pointerup'), this);
			utils.removeEvent(window, 'mouseup', this);
		}

		if ( this.options.defaultScrollbars ) {
			this.wrapper.parentNode.removeChild(this.wrapper);
		}
	},

	_start: function (e) {
		var point = e.touches ? e.touches[0] : e;

		e.preventDefault();
		e.stopPropagation();

		this.transitionTime();

		this.initiated = true;
		this.moved = false;
		this.lastPointX	= point.pageX;
		this.lastPointY	= point.pageY;

		this.startTime	= utils.getTime();

		if ( !this.options.disableTouch ) {
			utils.addEvent(window, 'touchmove', this);
		}
		if ( !this.options.disablePointer ) {
			utils.addEvent(window, utils.prefixPointerEvent('pointermove'), this);
		}
		if ( !this.options.disableMouse ) {
			utils.addEvent(window, 'mousemove', this);
		}

		this.scroller._execEvent('beforeScrollStart');
	},

	_move: function (e) {
		var point = e.touches ? e.touches[0] : e,
			deltaX, deltaY,
			newX, newY,
			timestamp = utils.getTime();

		if ( !this.moved ) {
			this.scroller._execEvent('scrollStart');
		}

		this.moved = true;

		deltaX = point.pageX - this.lastPointX;
		this.lastPointX = point.pageX;

		deltaY = point.pageY - this.lastPointY;
		this.lastPointY = point.pageY;

		newX = this.x + deltaX;
		newY = this.y + deltaY;

		this._pos(newX, newY);

// INSERT POINT: indicator._move

		e.preventDefault();
		e.stopPropagation();
	},

	_end: function (e) {
		if ( !this.initiated ) {
			return;
		}

		this.initiated = false;

		e.preventDefault();
		e.stopPropagation();

		utils.removeEvent(window, 'touchmove', this);
		utils.removeEvent(window, utils.prefixPointerEvent('pointermove'), this);
		utils.removeEvent(window, 'mousemove', this);

		if ( this.scroller.options.snap ) {
			var snap = this.scroller._nearestSnap(this.scroller.x, this.scroller.y);

			var time = this.options.snapSpeed || Math.max(
					Math.max(
						Math.min(Math.abs(this.scroller.x - snap.x), 1000),
						Math.min(Math.abs(this.scroller.y - snap.y), 1000)
					), 300);

			if ( this.scroller.x != snap.x || this.scroller.y != snap.y ) {
				this.scroller.directionX = 0;
				this.scroller.directionY = 0;
				this.scroller.currentPage = snap;
				this.scroller.scrollTo(snap.x, snap.y, time, this.scroller.options.bounceEasing);
			}
		}

		if ( this.moved ) {
			this.scroller._execEvent('scrollEnd');
		}
	},

	transitionTime: function (time) {
		time = time || 0;
		this.indicatorStyle[utils.style.transitionDuration] = time + 'ms';

		if ( !time && utils.isBadAndroid ) {
			this.indicatorStyle[utils.style.transitionDuration] = '0.001s';
		}
	},

	transitionTimingFunction: function (easing) {
		this.indicatorStyle[utils.style.transitionTimingFunction] = easing;
	},

	refresh: function () {
		this.transitionTime();

		if ( this.options.listenX && !this.options.listenY ) {
			this.indicatorStyle.display = this.scroller.hasHorizontalScroll ? 'block' : 'none';
		} else if ( this.options.listenY && !this.options.listenX ) {
			this.indicatorStyle.display = this.scroller.hasVerticalScroll ? 'block' : 'none';
		} else {
			this.indicatorStyle.display = this.scroller.hasHorizontalScroll || this.scroller.hasVerticalScroll ? 'block' : 'none';
		}

		if ( this.scroller.hasHorizontalScroll && this.scroller.hasVerticalScroll ) {
			utils.addClass(this.wrapper, 'iScrollBothScrollbars');
			utils.removeClass(this.wrapper, 'iScrollLoneScrollbar');

			if ( this.options.defaultScrollbars && this.options.customStyle ) {
				if ( this.options.listenX ) {
					this.wrapper.style.right = '8px';
				} else {
					this.wrapper.style.bottom = '8px';
				}
			}
		} else {
			utils.removeClass(this.wrapper, 'iScrollBothScrollbars');
			utils.addClass(this.wrapper, 'iScrollLoneScrollbar');

			if ( this.options.defaultScrollbars && this.options.customStyle ) {
				if ( this.options.listenX ) {
					this.wrapper.style.right = '2px';
				} else {
					this.wrapper.style.bottom = '2px';
				}
			}
		}

		var r = this.wrapper.offsetHeight;	// force refresh

		if ( this.options.listenX ) {
			this.wrapperWidth = this.wrapper.clientWidth;
			if ( this.options.resize ) {
				this.indicatorWidth = Math.max(Math.round(this.wrapperWidth * this.wrapperWidth / (this.scroller.scrollerWidth || this.wrapperWidth || 1)), 8);
				this.indicatorStyle.width = this.indicatorWidth + 'px';
			} else {
				this.indicatorWidth = this.indicator.clientWidth;
			}

			this.maxPosX = this.wrapperWidth - this.indicatorWidth;

			if ( this.options.shrink == 'clip' ) {
				this.minBoundaryX = -this.indicatorWidth + 8;
				this.maxBoundaryX = this.wrapperWidth - 8;
			} else {
				this.minBoundaryX = 0;
				this.maxBoundaryX = this.maxPosX;
			}

			this.sizeRatioX = this.options.speedRatioX || (this.scroller.maxScrollX && (this.maxPosX / this.scroller.maxScrollX));	
		}

		if ( this.options.listenY ) {
			this.wrapperHeight = this.wrapper.clientHeight;
			if ( this.options.resize ) {
				this.indicatorHeight = Math.max(Math.round(this.wrapperHeight * this.wrapperHeight / (this.scroller.scrollerHeight || this.wrapperHeight || 1)), 8);
				this.indicatorStyle.height = this.indicatorHeight + 'px';
			} else {
				this.indicatorHeight = this.indicator.clientHeight;
			}

			this.maxPosY = this.wrapperHeight - this.indicatorHeight;

			if ( this.options.shrink == 'clip' ) {
				this.minBoundaryY = -this.indicatorHeight + 8;
				this.maxBoundaryY = this.wrapperHeight - 8;
			} else {
				this.minBoundaryY = 0;
				this.maxBoundaryY = this.maxPosY;
			}

			this.maxPosY = this.wrapperHeight - this.indicatorHeight;
			this.sizeRatioY = this.options.speedRatioY || (this.scroller.maxScrollY && (this.maxPosY / this.scroller.maxScrollY));
		}

		this.updatePosition();
	},

	updatePosition: function () {
		var x = this.options.listenX && Math.round(this.sizeRatioX * this.scroller.x) || 0,
			y = this.options.listenY && Math.round(this.sizeRatioY * this.scroller.y) || 0;

		if ( !this.options.ignoreBoundaries ) {
			if ( x < this.minBoundaryX ) {
				if ( this.options.shrink == 'scale' ) {
					this.width = Math.max(this.indicatorWidth + x, 8);
					this.indicatorStyle.width = this.width + 'px';
				}
				x = this.minBoundaryX;
			} else if ( x > this.maxBoundaryX ) {
				if ( this.options.shrink == 'scale' ) {
					this.width = Math.max(this.indicatorWidth - (x - this.maxPosX), 8);
					this.indicatorStyle.width = this.width + 'px';
					x = this.maxPosX + this.indicatorWidth - this.width;
				} else {
					x = this.maxBoundaryX;
				}
			} else if ( this.options.shrink == 'scale' && this.width != this.indicatorWidth ) {
				this.width = this.indicatorWidth;
				this.indicatorStyle.width = this.width + 'px';
			}

			if ( y < this.minBoundaryY ) {
				if ( this.options.shrink == 'scale' ) {
					this.height = Math.max(this.indicatorHeight + y * 3, 8);
					this.indicatorStyle.height = this.height + 'px';
				}
				y = this.minBoundaryY;
			} else if ( y > this.maxBoundaryY ) {
				if ( this.options.shrink == 'scale' ) {
					this.height = Math.max(this.indicatorHeight - (y - this.maxPosY) * 3, 8);
					this.indicatorStyle.height = this.height + 'px';
					y = this.maxPosY + this.indicatorHeight - this.height;
				} else {
					y = this.maxBoundaryY;
				}
			} else if ( this.options.shrink == 'scale' && this.height != this.indicatorHeight ) {
				this.height = this.indicatorHeight;
				this.indicatorStyle.height = this.height + 'px';
			}
		}

		this.x = x;
		this.y = y;

		if ( this.scroller.options.useTransform ) {
			this.indicatorStyle[utils.style.transform] = 'translate(' + x + 'px,' + y + 'px)' + this.scroller.translateZ;
		} else {
			this.indicatorStyle.left = x + 'px';
			this.indicatorStyle.top = y + 'px';
		}
	},

	_pos: function (x, y) {
		if ( x < 0 ) {
			x = 0;
		} else if ( x > this.maxPosX ) {
			x = this.maxPosX;
		}

		if ( y < 0 ) {
			y = 0;
		} else if ( y > this.maxPosY ) {
			y = this.maxPosY;
		}

		x = this.options.listenX ? Math.round(x / this.sizeRatioX) : this.scroller.x;
		y = this.options.listenY ? Math.round(y / this.sizeRatioY) : this.scroller.y;

		this.scroller.scrollTo(x, y);
	},

	fade: function (val, hold) {
		if ( hold && !this.visible ) {
			return;
		}

		clearTimeout(this.fadeTimeout);
		this.fadeTimeout = null;

		var time = val ? 250 : 500,
			delay = val ? 0 : 300;

		val = val ? '1' : '0';

		this.wrapperStyle[utils.style.transitionDuration] = time + 'ms';

		this.fadeTimeout = setTimeout((function (val) {
			this.wrapperStyle.opacity = val;
			this.visible = +val;
		}).bind(this, val), delay);
	}
};

IScroll.utils = utils;

if ( typeof module != 'undefined' && module.exports ) {
	module.exports = IScroll;
} else {
	window.IScroll = IScroll;
}

})(window, document, Math);

var HA = (function(window, document) {


/* Hyperaudio core
 *
 */

var hyperaudio = (function() {

	// jQuery 2.0.3 (c) 2013 http://jquery.com/

	var
		// [[Class]] -> type pairs
		class2type = {},
		core_toString = class2type.toString,
		core_hasOwn = class2type.hasOwnProperty;

	function hyperaudio() {
		// Nada
	}

	hyperaudio.extend = function() {
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0] || {},
			i = 1,
			length = arguments.length,
			deep = false;

		// Handle a deep copy situation
		if ( typeof target === "boolean" ) {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		}

		// Handle case when target is a string or something (possible in deep copy)
		if ( typeof target !== "object" && !hyperaudio.isFunction(target) ) {
			target = {};
		}

		// extend hyperaudio itself if only one argument is passed
		if ( length === i ) {
			target = this;
			--i;
		}

		for ( ; i < length; i++ ) {
			// Only deal with non-null/undefined values
			if ( (options = arguments[ i ]) != null ) {
				// Extend the base object
				for ( name in options ) {
					src = target[ name ];
					copy = options[ name ];

					// Prevent never-ending loop
					if ( target === copy ) {
						continue;
					}

					// Recurse if we're merging plain objects or arrays
					if ( deep && copy && ( hyperaudio.isPlainObject(copy) || (copyIsArray = hyperaudio.isArray(copy)) ) ) {
						if ( copyIsArray ) {
							copyIsArray = false;
							clone = src && hyperaudio.isArray(src) ? src : [];

						} else {
							clone = src && hyperaudio.isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[ name ] = hyperaudio.extend( deep, clone, copy );

					// Don't bring in undefined values
					} else if ( copy !== undefined ) {
						target[ name ] = copy;
					}
				}
			}
		}

		// Return the modified object
		return target;
	};

	hyperaudio.extend({

		// See test/unit/core.js for details concerning isFunction.
		// Since version 1.3, DOM methods and functions like alert
		// aren't supported. They return false on IE (#2968).
		isFunction: function( obj ) {
			return hyperaudio.type(obj) === "function";
		},

		isArray: Array.isArray,

		isWindow: function( obj ) {
			return obj != null && obj === obj.window;
		},

		type: function( obj ) {
			if ( obj == null ) {
				return String( obj );
			}
			// Support: Safari <= 5.1 (functionish RegExp)
			return typeof obj === "object" || typeof obj === "function" ?
				class2type[ core_toString.call(obj) ] || "object" :
				typeof obj;
		},

		isPlainObject: function( obj ) {
			// Not plain objects:
			// - Any object or value whose internal [[Class]] property is not "[object Object]"
			// - DOM nodes
			// - window
			if ( hyperaudio.type( obj ) !== "object" || obj.nodeType || hyperaudio.isWindow( obj ) ) {
				return false;
			}

			// Support: Firefox <20
			// The try/catch suppresses exceptions thrown when attempting to access
			// the "constructor" property of certain host objects, ie. |window.location|
			// https://bugzilla.mozilla.org/show_bug.cgi?id=814622
			try {
				if ( obj.constructor &&
						!core_hasOwn.call( obj.constructor.prototype, "isPrototypeOf" ) ) {
					return false;
				}
			} catch ( e ) {
				return false;
			}

			// If the function hasn't returned already, we're confident that
			// |obj| is a plain object, created by {} or constructed with new Object
			return true;
		}
	});

	function isArraylike( obj ) {
		var length = obj.length,
			type = hyperaudio.type( obj );

		if ( hyperaudio.isWindow( obj ) ) {
			return false;
		}

		if ( obj.nodeType === 1 && length ) {
			return true;
		}

		return type === "array" || type !== "function" &&
			( length === 0 ||
			typeof length === "number" && length > 0 && ( length - 1 ) in obj );
	}
	// [End jQuery code]

	// [Adapted from] jQuery 2.0.3 (c) 2013 http://jquery.com/
	// - each() : removed args parameter (was for use internal to jQuery)

	hyperaudio.extend({
		each: function( obj, callback ) {
			var value,
				i = 0,
				length = obj.length,
				isArray = isArraylike( obj );

			if ( isArray ) {
				for ( ; i < length; i++ ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			} else {
				for ( i in obj ) {
					value = callback.call( obj[ i ], i, obj[ i ] );

					if ( value === false ) {
						break;
					}
				}
			}

			return obj;
		}
	});
	// [End jQuery code]

	hyperaudio.extend({
		event: {
			ready: 'ha:ready',
			load: 'ha:load',
			save: 'ha:save',
			change: 'ha:change',
			// login: 'ha:login', // No DOM element relating to a login. It is handled by the api.signin when the stage fails to authenticate.
			unauthenticated: 'ha:unauthenticated',
			userplay: 'ha:userplay',
			userpause: 'ha:userpause',
			usercurrenttime: 'ha:usercurrenttime',
			userplayword: 'ha:userplayword',
			error: 'ha:error'
		},
		_commonMethods: {
			options: {
				DEBUG: false,
				entity: 'core'
			},
			_trigger: function(eventType, eventData) {
				var eventObject = hyperaudio.extend(true, {options: this.options}, eventData),
					event = new CustomEvent(eventType, {
						detail: eventObject,
						bubbles: true,
						cancelable: true
					});
				hyperaudio.gaEvent({
					type: this.options.entity,
					action: eventType + ' event: ' + (eventObject.msg ? eventObject.msg : '')
				});
				this.target.dispatchEvent(event);
			},
			_error: function(msg) {
				var data = {msg: this.options.entity + ' Error : ' + msg};
				this._trigger(hyperaudio.event.error, data);
			},
			_debug: function() {
				var self = this;
				hyperaudio.each(hyperaudio.event, function(eventName, eventType) {
					self.target.addEventListener(eventType, function(event) {
						console.log(self.options.entity + ' ' + eventType + ' event : %o', event);
					}, false);
				});
			}
		},
		register: function(name, module) {
			if(typeof name === 'string') {
				if(typeof module === 'function') {
					module.prototype = hyperaudio.extend({}, this._commonMethods, module.prototype);
					this[name] = function(options) {
						return new module(options);
					};
				} else if(typeof module === 'object') {
					module = hyperaudio.extend({}, this._commonMethods, module);
					this[name] = module;
				}
			}
		},
		utility: function(name, utility) {
			if(typeof name === 'string') {
				this[name] = utility;
			}
		},

		// http://stackoverflow.com/questions/1403888/get-url-parameter-with-javascript-or-jquery
		getURLParameter: function(name) {
			// return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;

			// Now looks at top window (frame).
			var win = window.top;

			// See if security allowed via same domain policy.
			try {
				win.document.createElement('div');
			} catch(error) {
				win = window;
			}

			return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(win.location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
		},

		gaEvent: function(detail) {
			// detail: {origin, type, action}

			if(typeof detail !== 'object') {
				if(typeof detail === 'string') {
					detail = {
						type: 'message',
						action: detail
					};
				} else {
					detail = {};
				}
			}

			detail.origin = detail.origin ? detail.origin : 'Hyperaudio Lib';
			detail.type = detail.type ? detail.type : 'no type';
			detail.action = detail.action ? detail.action : 'no action';

			var event = new CustomEvent("ga", {
				detail: detail,
				bubbles: true,
				cancelable: true
			});
			document.dispatchEvent(event);
		},

		hasClass: function(e, c) {
			if ( !e ) return false;

			var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
			return re.test(e.className);
		},
		addClass: function(e, c) {
			if ( this.hasClass(e, c) ) {
				return;
			}

			e.className += ' ' + c;
		},
		removeClass: function (e, c) {
			if ( !this.hasClass(e, c) ) {
				return;
			}

			var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
			e.className = e.className.replace(re, ' ').replace(/\s{2,}/g, ' ');
		},
		toggleClass: function (e, c) {
			if ( this.hasClass(e, c) ) {
				this.removeClass(e, c);
			} else {
				this.addClass(e, c);
			}
		},
		empty: function(el) {
			// Empties the element... Possibly better than el.innerHTML = '';
			while(el && el.firstChild) {
				el.removeChild(el.firstChild);
			}
		}

	});

	return hyperaudio;
}());

var DragDrop = (function (window, document, hyperaudio) {

	function DragDrop (options) {

		this.options = {
			handle: null,
			dropArea: null,

			init: true,
			touch: true,
			mouse: true,
			timeout: 500,
			html: '',
			draggableClass: '',
			containerTag: 'article',
			blockTag: 'section'
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.dropArea = typeof this.options.dropArea == 'string' ? document.querySelector(this.options.dropArea) : this.options.dropArea;

		// Create the list and the placeholder
		this.list = this.dropArea.querySelector(this.options.containerTag);
		if ( !this.list ) {
			this.list = document.createElement(this.options.containerTag);
			this.dropArea.appendChild(this.list);
		}
		this.placeholder = document.createElement(this.options.blockTag);
		this.placeholder.className = 'placeholder';

		if ( this.options.init ) {
			this.handle = typeof this.options.handle == 'string' ? document.querySelector(this.options.handle) : this.options.handle;
			this.handleClassName = this.handle.className;

			// Are we reordering the list?
			this.reordering = this.handle.parentNode == this.list;

			if ( this.options.touch ) {
				this.handle.addEventListener('touchstart', this, false);
			}

			if ( this.options.mouse ) {
				this.handle.addEventListener('mousedown', this, false);
			}
		}
	}

	DragDrop.prototype.handleEvent = function (e) {
		// jshint -W086
		switch (e.type) {
			case 'mousedown':
				if ( e.which !== 1 ) {
					break;
				}
			case 'touchstart':
				this.start(e);
				break;
			case 'touchmove':
			case 'mousemove':
				this.move(e);
				break;
			case 'touchend':
			case 'mouseup':
				this.end(e);
				break;
		}
		// jshint +W086
	};

	DragDrop.prototype.start = function (e) {
		var point = e.touches ? e.touches[0] : e,
			target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		if ( /INPUT/.test(target.tagName) ) {
			return;
		}

		e.preventDefault();

		if ( this.options.touch ) {
			document.addEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			document.addEventListener('mouseup', this, false);
		}

		clearTimeout(this.dragTimeout);
		this.initiated = false;
		this.lastTarget = null;

		this.dragTimeout = setTimeout(this.init.bind(this, this.options.html || this.handle.innerHTML, e), this.options.timeout);
	};

	DragDrop.prototype.init = function (html, e) {
		if ( !this.options.init ) {
			if ( this.options.touch ) {
				document.addEventListener('touchend', this, false);
			}

			if ( this.options.mouse ) {
				document.addEventListener('mouseup', this, false);
			}
		}

		// Create draggable
		this.draggable = document.createElement('div');
		this.draggable.className = 'draggable' + ' ' + this.options.draggableClass;
		this.draggableStyle = this.draggable.style;
		this.draggableStyle.cssText = 'position:absolute;z-index:1000;pointer-events:none;left:-99999px';
		this.draggable.innerHTML = html;

		document.body.appendChild(this.draggable);

		this.draggableCenterX = Math.round(this.draggable.offsetWidth / 2);
		this.draggableCenterY = Math.round(this.draggable.offsetHeight / 2);

		this.position(e);

		if ( this.options.touch ) {
			document.addEventListener('touchmove', this, false);
		}

		if ( this.options.mouse ) {
			document.addEventListener('mousemove', this, false);
		}

		this.initiated = true;

		// If we are reordering the list, hide the current element
		if ( this.reordering ) {
			this.handle.style.display = 'none';
		}

		this.move(e);

		if ( this.options.onDragStart ) {
			this.options.onDragStart.call(this);
		}
	};

	DragDrop.prototype.position = function (e) {
		var point = e.changedTouches ? e.changedTouches[0] : e;

		this.draggableStyle.left = point.pageX - this.draggableCenterX + 'px';
		this.draggableStyle.top = point.pageY - this.draggableCenterY + 'px';
	};

	DragDrop.prototype.move = function (e) {
		e.preventDefault();
		e.stopPropagation();

		var point = e.changedTouches ? e.changedTouches[0] : e;
		var target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		this.position(e);

		if ( target == this.lastTarget || target == this.placeholder || target == this.list ) {
			return;
		}

		this.lastTarget = target;

		if ( target == this.dropArea ) {
			this.list.appendChild(this.placeholder);
			return;
		}

		if ( hyperaudio.hasClass(target, 'item') ) {
			var items = this.list.querySelectorAll('.item'),
				i = 0, l = items.length;

			for ( ; i < l; i++ ) {
				if ( target == items[i] ) {
					this.list.insertBefore(this.placeholder, items[i]);
					break;
				}
			}

			return;
		}

		if ( this.list.querySelector('.placeholder') ) {
			this.placeholder.parentNode.removeChild(this.placeholder);
		}
	};

	DragDrop.prototype.end = function (e) {
		clearTimeout(this.dragTimeout);

		document.removeEventListener('touchend', this, false);
		document.removeEventListener('mouseup', this, false);

		if ( !this.initiated ) {
			return;
		}

		document.removeEventListener('touchmove', this, false);
		document.removeEventListener('mousemove', this, false);

		var point = e.changedTouches ? e.changedTouches[0] : e;
		var target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target;

		var html = this.options.html ? this.handle.innerHTML : this.draggable.innerHTML;
		this.draggable.parentNode.removeChild(this.draggable);
		this.draggable = null;

		// we dropped outside of the draggable area
		if ( !this.list.querySelector('.placeholder') ) {

			if ( this.reordering ) {
				this.handle.parentNode.removeChild(this.handle);
			}

			if ( this.options.onDrop ) {
				this.options.onDrop.call(this, null);
			}

			return;
		}

		var el;

		// if we are reordering, reuse the original element
		if ( this.reordering ) {
			el = this.handle;
			this.handle.style.display = '';
		} else {
			el = document.createElement(this.options.blockTag);
			el.className = this.handleClassName || 'item';
			el.innerHTML = html;
		}

		this.list.insertBefore(el, this.placeholder);
		this.placeholder.parentNode.removeChild(this.placeholder);

		if ( this.options.onDrop ) {
			this.options.onDrop.call(this, el);
		}
	};

	DragDrop.prototype.destroy = function () {
		document.removeEventListener('touchstart', this, false);
		document.removeEventListener('touchmove', this, false);
		document.removeEventListener('touchend', this, false);

		document.removeEventListener('mousedown', this, false);
		document.removeEventListener('mousemove', this, false);
		document.removeEventListener('mouseup', this, false);
	};

	return DragDrop;
})(window, document, hyperaudio);

var EditBlock = (function (document) {

	function EditBlock (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;
		this.stage = this.options.stage || {dropped:function(){}};
		this.words = this.el.querySelectorAll('a');

		this.el.className += ' edit';
		this.el._tap = new Tap({el: this.el});
		this.el.addEventListener('tap', this, false);

		document.addEventListener('touchend', this, false);
		document.addEventListener('mouseup', this, false);
	}

	EditBlock.prototype.handleEvent = function (e) {
		switch (e.type) {
			case 'touchend':
			case 'mouseup':
				this.cancel(e);
				break;
			case 'tap':
				this.edit(e);
				break;
		}
	};

	EditBlock.prototype.cancel = function (e) {
		var target = e.target;

		if ( target == this.el || target.parentNode == this.el || target.parentNode.parentNode == this.el ) {
			return;
		}

		hyperaudio.gaEvent({
			type: 'EDITBLOCK',
			action: 'canceledit: Cancelled editing.'
		});

		this.destroy();
	};

	EditBlock.prototype.edit = function (e) {
		e.stopPropagation();

		var theCut = e.target;
		var cutPointReached;
		var wordCount = this.words.length;

		if ( theCut.tagName != 'A' || theCut == this.words[wordCount-1] ) {
			return;
		}

		// Create a new block
		//var newBlock = document.createElement('section');
		var newBlock = this.el.cloneNode(false);
		var newParagraph, prevContainer;
		
		newBlock.className = newBlock.className.replace(/(^|\s)edit(\s|$)/g, ' ');

		//newBlock.className = 'item';

		for ( var i = 0; i < wordCount; i++ ) {
			if ( this.words[i].parentNode != prevContainer ) {
				if ( newParagraph && cutPointReached && newParagraph.querySelector('a') ) {
					newBlock.appendChild(newParagraph);
				}

				newParagraph = document.createElement('p');
				prevContainer = this.words[i].parentNode;
			}

			if ( cutPointReached ) {
				newParagraph.appendChild(this.words[i]);

				if ( !prevContainer.querySelector('a') ) {
					prevContainer.parentNode.removeChild(prevContainer);
				}
			}

			if ( !cutPointReached && this.words[i] == theCut ) {
				cutPointReached = true;
			}
		}

		newBlock.appendChild(newParagraph);

		var action = document.createElement('div');
		action.className = 'actions';
		newBlock.appendChild(action);

		this.el.parentNode.insertBefore(newBlock, this.el.nextSibling);
		this.el.handleHTML = this.el.innerHTML;

		this.stage.dropped(newBlock);

		hyperaudio.gaEvent({
			type: 'EDITBLOCK',
			action: 'edit: Editted section.'
		});

		this.destroy();
	};

	EditBlock.prototype.destroy = function () {
		// Remove edit status
		this.el.className = this.el.className.replace(/(^|\s)edit(\s|$)/g, ' ');

		document.removeEventListener('touchend', this, false);
		document.removeEventListener('mouseup', this, false);

		this.el.removeEventListener('tap', this, false);
		this.el._editBlock = null;

		this.el._tap.destroy();
		this.el._tap = null;
	};

	return EditBlock;
})(document);

var fadeFX = (function (window, document) {
	var _elementStyle = document.createElement('div').style;

	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransition';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	var transition = _prefixStyle('transition');
	var transform = _prefixStyle('transform');

	_elementStyle = null; // free mem ???

	var fxInstance;

	function fade (options) {
		// if ( !fxInstance ) {
			var opt = {
				time: 2000,
				background: '#000000', // fade
				color: '#ffffff', // title
				text: '',
				fadeOut: false,
				fadeIn: false,
				outFirst: true // not implemented
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			fxInstance = new TransitionFade(opt);
		// }

		return fxInstance;
	}

	function TransitionFade (options) {
		this.options = options;

		this.servo = document.getElementById('fxHelper');

		this.servo.querySelector('div').innerHTML = this.options.text ? this.options.text : '';

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.left = '0px';
		this.servo.style.backgroundColor = this.options.background;
		this.servo.style.color = this.options.color;


		if ( this.options.fadeOut ) {
			this.servo.style.opacity = '0';
			this.fadeOut();
		} else if ( this.options.fadeIn ) {
			this.servo.style.opacity = '1';
			this.fadeIn();
		}
	}

	TransitionFade.prototype.handleEvent = function (e) {
		switch ( e.type ) {
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this.transitionEnd(e);
				break;
//			case 'canplay':
		}
	};

	TransitionFade.prototype.fadeOut = function () {
		this.phase = 'fadeOut';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		var trick = this.servo.offsetHeight;	// force refresh. Mandatory on FF

		this.servo.style[transition] = 'opacity ' + this.options.time + 'ms';

		var that = this;
		setTimeout(function () {
			that.servo.style.opacity = '1';
		}, 0);
	};

	TransitionFade.prototype.transitionEnd = function (e) {
		e.stopPropagation();

		this.servo.removeEventListener('transitionend', this, false);
		this.servo.removeEventListener('webkitTransitionEnd', this, false);
		this.servo.removeEventListener('oTransitionEnd', this, false);
		this.servo.removeEventListener('MSTransitionEnd', this, false);

		if ( this.phase == 'fadeOut' ) {
			if ( this.options.onFadeOutEnd ) {
				this.options.onFadeOutEnd.call(this);
			}
		} else if ( this.phase == 'fadeIn' ) {
			if ( this.options.onFadeInEnd ) {
				this.options.onFadeInEnd.call(this);
			}

			// Race conditions are a bitch, so taking this out for time being.
			// this.destroy();
		}
	};

	TransitionFade.prototype.fadeIn = function () {
		this.phase = 'fadeIn';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		var trick = this.servo.offsetHeight;	// force refresh. Mandatory on FF

		this.servo.style[transition] = 'opacity ' + this.options.time + 'ms';

		var that = this;
		setTimeout(function () {
			that.servo.style.opacity = '0';
		}, 0);
	};

	TransitionFade.prototype.destroy = function () {
		this.servo.removeEventListener('transitionend', this, false);
		this.servo.removeEventListener('webkitTransitionEnd', this, false);
		this.servo.removeEventListener('oTransitionEnd', this, false);
		this.servo.removeEventListener('MSTransitionEnd', this, false);

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.opacity = '0';
		this.servo.style.left = '-9999px';

		fxInstance = null;
	};

	return fade;
})(window, document);

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

var Tap = (function (window, document, hyperaudio) {

	function Tap (options) {
		this.options = {};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		this.el.addEventListener('touchstart', this, false);
		this.el.addEventListener('mousedown', this, false);
	}

	Tap.prototype = {
		handleEvent: function (e) {
			// jshint -W086
			switch (e.type) {
				case 'mousedown':
					if ( e.which !== 1 ) {
						break;
					}
				case 'touchstart':
					this._start(e);
					break;
				case 'touchmove':
				case 'mousemove':
					this._move(e);
					break;
				case 'touchend':
				case 'mouseup':
				case 'touchcancel':
				case 'mousecancel':
					this._end(e);
					break;
			}
			// jshint +W086
		},

		_start: function (e) {
			if ( e.touches && e.touches.length > 1 ) return;
			
			e.preventDefault();

			var point = e.touches ? e.touches[0] : e;
			
			this.moved = false;
			this.startX = point.pageX;
			this.startY = point.pageY;
			this.target = e.target;

			hyperaudio.addClass(this.target, 'tapPressed');

			this.el.addEventListener('touchmove', this, false);
			this.el.addEventListener('touchend', this, false);
			this.el.addEventListener('touchcancel', this, false);
			this.el.addEventListener('mousemove', this, false);
			this.el.addEventListener('mouseup', this, false);
			this.el.addEventListener('mousecancel', this, false);
		},

		_move: function (e) {
			var point = e.changedTouches ? e.changedTouches[0] : e,
				x = point.pageX,
				y = point.pageY;

			if ( Math.abs( x - this.startX ) > 10 || Math.abs( y - this.startY ) > 10 ) {
				hyperaudio.removeClass(this.target, 'tapPressed');
				this.moved = true;
			}
		},

		_end: function (e) {
			hyperaudio.removeClass(this.target, 'tapPressed');

			if ( !this.moved ) {
				var ev = document.createEvent('Event'),
					point = e.changedTouches ? e.changedTouches[0] : e;

				ev.initEvent('tap', true, true);
				ev.pageX = point.pageX;
				ev.pageY = point.pageY;
				this.target.dispatchEvent(ev);
			}

			this.el.removeEventListener('touchmove', this, false);
			this.el.removeEventListener('touchend', this, false);
			this.el.removeEventListener('touchcancel', this, false);
			this.el.removeEventListener('mousemove', this, false);
			this.el.removeEventListener('mouseup', this, false);
			this.el.removeEventListener('mousecancel', this, false);
		},
		
		destroy: function () {
			this.el.removeEventListener('touchstart', this, false);
			this.el.removeEventListener('touchmove', this, false);
			this.el.removeEventListener('touchend', this, false);
			this.el.removeEventListener('touchcancel', this, false);
			this.el.removeEventListener('mousedown', this, false);
			this.el.removeEventListener('mousemove', this, false);
			this.el.removeEventListener('mouseup', this, false);
			this.el.removeEventListener('mousecancel', this, false);
		}
	};
	
	return Tap;
})(window, document, hyperaudio);


var titleFX = (function (window, document) {
	var _elementStyle = document.createElement('div').style;

	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransform';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	var transition = _prefixStyle('transition');
	var transitionDuration = _prefixStyle('transitionDuration');
	var transform = _prefixStyle('transform');

	_elementStyle = null; // free mem ???

	var fxInstance;

	function title (options) {
		if ( !fxInstance ) {
			var opt = {
				el: null,
				text: '',
				speed: 600,
				duration: 3000,
				background: 'rgba(0,0,0,0.8)',
				color: '#ffffff'
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			fxInstance = new TitleEffect(opt);
		}

		return fxInstance;
	}

	function TitleEffect (options) {
		this.options = options;

		this.el = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		this.el.innerHTML = this.options.text;
		this.el.style.backgroundColor = this.options.background;
		this.el.style.color = this.options.color;
		this.el.style.left = '0px';
		this.el.style[transform] = 'translate(0, 100%) translateZ(0)';

		this.el.addEventListener('transitionend', this, false);
		this.el.addEventListener('webkitTransitionEnd', this, false);
		this.el.addEventListener('oTransitionEnd', this, false);
		this.el.addEventListener('MSTransitionEnd', this, false);

		this.start();
	}

	TitleEffect.prototype.handleEvent = function (e) {
		switch ( e.type ) {
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this.transitionEnd(e);
				break;
		}
	};

	TitleEffect.prototype.start = function () {
		this.phase = 'start';

		var trick = this.el.offsetHeight;	// force refresh. Mandatory on FF
		this.el.style[transitionDuration] = this.options.speed + 'ms';

		var that = this;
		setTimeout(function () {
			that.el.style[transform] = 'translate(0, 0) translateZ(0)';
		}, 0);
	};

	TitleEffect.prototype.transitionEnd = function (e) {
		e.stopPropagation();

		if ( this.phase == 'start' ) {
			this.phase = 'waiting';
			this.timeout = setTimeout(this.end.bind(this), this.options.duration);
			return;
		}

		if ( this.options.onEnd ) {
			this.options.onEnd.call(this);
		}

		this.destroy();
	};

	TitleEffect.prototype.end = function () {
		this.phase = 'end';
		this.el.style[transform] = 'translate(0, 100%) translateZ(0)';
	};

	TitleEffect.prototype.destroy = function () {
		clearTimeout(this.timeout);

		this.el.removeEventListener('transitionend', this, false);
		this.el.removeEventListener('webkitTransitionEnd', this, false);
		this.el.removeEventListener('oTransitionEnd', this, false);
		this.el.removeEventListener('MSTransitionEnd', this, false);

		this.el.style[transitionDuration] = '0s';
		this.el.style.left = '-9999px';

		fxInstance = null;
	};

	return title;
})(window, document);

var WordSelect = (function (window, document, hyperaudio) {

	// used just in dev environment
	function addTagHelpers (el) {
		var text = (el.innerText || el.textContent).split(' ');

		el.innerHTML = '<a>' + text.join(' </a><a>') + '</a>';
	}

	function WordSelect (options) {

		this.options = {
			el: null,
			addHelpers: false,
			touch: true,
			mouse: true,
			threshold: 10,
			timeout: 0 // 500
		};

		for ( var i in options ) {
			this.options[i] = options[i];
		}

		this.element = typeof this.options.el == 'string' ? document.querySelector(this.options.el) : this.options.el;

		if ( this.options.addHelpers ) {
			addTagHelpers(this.element);
		}

		this.words = this.element.querySelectorAll('a');
		this.wordsCount = this.words.length;

		if ( this.options.touch ) {
			this.element.addEventListener('touchstart', this, false);
		}

		if ( this.options.mouse ) {
			this.element.addEventListener('mousedown', this, false);
		}
	}

	WordSelect.prototype.handleEvent = function (e) {
		// jshint -W086
		switch (e.type) {
			case 'mousedown':
				if ( e.which !== 1 ) {
					break;
				}
			case 'touchstart':
				this.start(e);
				break;
			case 'touchmove':
			case 'mousemove':
				this.move(e);
				break;
			case 'touchend':
			case 'mouseup':
				this.end(e);
				break;
		}
		// jshint +W086
	};

	WordSelect.prototype.start = function (e) {
		e.preventDefault();

		var point = e.touches ? e.touches[0] : e;

		this.selectStarted = false;
		this.startX = e.pageX;
		this.startY = e.pageY;

		if ( this.options.mouse ) {
			this.element.addEventListener('mousemove', this, false);
			window.addEventListener('mouseup', this, false);
		}

		if ( this.options.touch ) {
			this.element.addEventListener('touchmove', this, false);
			window.addEventListener('touchend', this, false);
		}

		if ( hyperaudio.hasClass(e.target, 'selected') ) {
			this.dragTimeout = setTimeout(this.dragStart.bind(this, e), this.options.timeout);
		}
	};

	WordSelect.prototype.selectStart = function (e) {
		var target = e.target,
			tmp;

		if ( target == this.element || target.tagName != 'A' ) {
			return;
		}

		this.selectStarted = true;

		this.currentWord = target;

		// WIP - Commented out, since operation conflicts with zero grab time
		// hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		// hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

		if ( this.words[this.startPosition] === target ) {
			tmp = this.startPosition;
			this.startPosition = this.endPosition;
			this.endPosition = tmp;
			return;
		}

		if ( this.words[this.endPosition] === target ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				this.startPosition = i;
			}

			hyperaudio.removeClass(this.words[i], 'selected');
		}

		this.endPosition = this.startPosition;

		hyperaudio.addClass(target, 'selected');
	};

	WordSelect.prototype.move = function (e) {
		var point = e.changedTouches ? e.changedTouches[0] : e,
			target = e.touches ? document.elementFromPoint(point.pageX, point.pageY) : point.target,
			endPosition;

		if ( Math.abs(point.pageX - this.startX) < this.options.threshold &&
			Math.abs(point.pageY - this.startY) < this.options.threshold ) {
			return;
		}

		clearTimeout(this.dragTimeout);

		if ( !this.selectStarted ) {
			this.selectStart(e);
			return;
		}

		if ( target.tagName == 'P' ) {
			target = target.querySelector('a:last-child');
		}

		if ( target == this.element || target == this.currentWord || target.tagName != 'A' ) {
			return;
		}

		for ( var i = 0; i < this.wordsCount; i++ ) {
			if ( this.words[i] == target ) {
				endPosition = i;
			}

			if ( ( endPosition === undefined && i >= this.startPosition ) ||
				( endPosition !== undefined && i <= this.startPosition ) ||
				endPosition == i ) {
				hyperaudio.addClass(this.words[i], 'selected');
			} else {
				hyperaudio.removeClass(this.words[i], 'selected');
			}
		}

		this.currentWord = target;
		this.endPosition = endPosition;
	};

	WordSelect.prototype.end = function (e) {
		clearTimeout(this.dragTimeout);

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		if ( !this.selectStarted ) {
			if ( e.target == this.element ) {
				this.clearSelection();
			}

			return;
		}

		var start = Math.min(this.startPosition, this.endPosition),
			end = Math.max(this.startPosition, this.endPosition);

		// WIP - Commented out, since operation conflicts with zero grab time
		// hyperaudio.addClass(this.words[start], 'first');
		// hyperaudio.addClass(this.words[end], 'last');


		if ( this.options.onSelection ) {
			this.options.onSelection.call(this);
		}
	};

	WordSelect.prototype.clearSelection = function () {
		this.currentWord = null;
		this.startPosition = null;
		this.endPosition = null;

		// WIP - Commented out, since operation conflicts with zero grab time
		// hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		// hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		var selected = this.element.querySelectorAll('.selected');
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			hyperaudio.removeClass(selected[i], 'selected');
		}

		if ( this.options.onClear ) {
			this.options.onClear.call(this);
		}
	};

	WordSelect.prototype.getSelection = function () {
		var selected = this.element.querySelectorAll('.selected');
		var prevParent;
		var html = '';
		for ( var i = 0, l = selected.length; i < l; i++ ) {
			if ( selected[i].parentNode !== prevParent ) {
				prevParent = selected[i].parentNode;
				html += ( i === 0 ? '<p>' : '</p><p>' );
			}
			html += selected[i].outerHTML.replace(/ class="[\d\w\s\-]*\s?"/gi, ' ');
		}

		if ( html ) {
			html += '</p>';
		}

		return html;
	};

	WordSelect.prototype.dragStart = function (e) {
		e.stopPropagation();

		if ( this.options.touch ) {
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}

		if ( this.options.mouse ) {
			this.element.removeEventListener('mousemove', this, false);
			this.element.removeEventListener('mouseup', this, false);
		}

		var point = e.changedTouches ? e.changedTouches[0] : e;

		if ( this.options.onDragStart ) {
			this.options.onDragStart.call(this, e);
		}
	};

	WordSelect.prototype.destroy = function () {
		this.element.removeEventListener('touchstart', this, false);
		this.element.removeEventListener('touchmove', this, false);
		this.element.removeEventListener('touchend', this, false);

		this.element.removeEventListener('mousedown', this, false);
		this.element.removeEventListener('mousemove', this, false);
		this.element.removeEventListener('mouseup', this, false);
	};

	return WordSelect;

})(window, document, hyperaudio);

/* xhr
 *
 */

var xhr = (function(hyperaudio) {

	return function(options) {

		options = hyperaudio.extend({
			url: '',
			data: '', // Only valid for POST types
			type: 'GET',
			responseType: '',
			async: true,
			withCredentials: true, // Setting to true requires the CORS header Access-Control-Allow-Credentials on the server
			timeout: 0,
			cache: true

			// complete: function()
			// error: function()
		}, options);

		if(!options.cache) {
			options.url = options.url + ((/\?/).test(options.url) ? "&" : "?") + (new Date()).getTime();
		}

		var xhr = new XMLHttpRequest();

		xhr.addEventListener('load', function(event) {
			if(200 <= this.status && this.status < 300) {
				if(typeof options.complete === 'function') {
					options.complete.call(this, event);
				}
			} else {
				if(typeof options.error === 'function') {
					options.error.call(this, event);
				}
			}
		}, false);

		if(typeof options.error === 'function') {
			xhr.addEventListener('error', function(event) {
				options.error.call(this, event);
			}, false);
			xhr.addEventListener('abort', function(event) {
				options.error.call(this, event);
			}, false);
		}

		xhr.open(options.type, options.url, options.async);
		xhr.responseType = options.responseType;
		xhr.withCredentials = options.withCredentials;
		xhr.timeout = options.timeout;

		if(options.data) {
			xhr.setRequestHeader('content-type', 'application/json; charset=utf-8');
		}

		if (window.localStorage.getItem('token')) {
      xhr.setRequestHeader('Authorization', 'Bearer ' + window.localStorage.getItem('token'));
    }

		xhr.send(options.data);

		return xhr;
	};

}(hyperaudio));


/* api
 *
 */

var api = (function(hyperaudio) {

	return {
		init: function(options) {
			this.options = hyperaudio.extend({

				// Options used to build the API url. See _updateInternals() to see how the API url is built.
				protocol: 'http://',
				org: '', // The organisations namespace / sub-domain. EG. 'chattanooga'
				api: 'api.', // The sub-domain of the API
				domain: 'hyperaud.io', // The domain of the API
				version: '/v1/', // The version of the API.

				// Command syntax
				transcripts: 'transcripts/',
				transcripts_filter: '&type=html',
				mixes: 'mixes/',
				channels: 'channels/',
				signin: 'login/',
				whoami: 'whoami/',
				media: 'media/',
				// Specific user (bgm) for music
				bgm: 'bgm/media/'
			}, options);

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
			if(typeof options === 'string') { // Enable option to be set/get by name.
				if(typeof value !== 'undefined') {
					this.options[options] = value;
				} else {
					return this.options[options];
				}
			} else if(typeof options === 'object') { // Enable options to be set/get by object.
				hyperaudio.extend(this.options, options);
			} else {
				return hyperaudio.extend({}, this.options); // Return a copy of the options object.
			}
			this._updateInternals();
		},
		_updateInternals: function() {
			var namespace = this.options.org ? this.options.org + '.' : '';
			this.url = this.options.protocol + namespace + this.options.api + this.options.domain + this.options.version;
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
				url: this.url + this.options.signin,
				type: 'POST',
				data: JSON.stringify(auth),
				complete: function(event) {
					var json = JSON.parse(this.responseText);

					if (json.user) window.localStorage.setItem('user', json.user);
					if (json.token) window.localStorage.setItem('token', json.token);

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
					url: this.url + this.options.whoami,
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
		getChannels: function(options) {
			var self = this,
				getUsername, getUrl, getChannels;

			options = hyperaudio.extend({
				user: false, // When true, the api returns the current user's transcripts.
				callback: null
			}, options);

			getUsername = function() {
				self.getUsername(function(success) {
					if(success && !self.guest) {
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
				if(options.user) {
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

			if(options.user) {
				getUsername();
			} else {
				getChannels();
			}
		},
		getTranscripts: function(options) {
			var self = this,
				getUsername, getUrl, getTranscripts;

			options = hyperaudio.extend({
				user: false, // When true, the api returns the current user's transcripts.
				channel: '', // The channel name. Empty string disables feature. See 'nochannel' for media without any channel.
				callback: null
			}, options);

			getUsername = function() {
				self.getUsername(function(success) {
					if(success && !self.guest) {
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
				if(options.channel) {
					// url += self.options.channels + options.channel;
					url += 'channel=' + options.channel;
				}
				url += self.options.transcripts_filter;
				if(options.user) {
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

			if(options.user) {
				getUsername();
			} else {
				getTranscripts();
			}
		},
		getTranscriptsOLD: function(callback, force) {
			var self = this;
			if(!force && this.transcripts) {
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
			if(!force && this.transcript && this.transcript._id === id) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				// Do not need to get username for an ID specific request.
				this.getUsername(function(success) {
					if(success && id) {
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
			if(!force && this.mixes) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				// Do not need to get username for a general request.
				this.getUsername(function(success) {
					if(success) {
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
			if(!force && this.mix && this.mix._id === id) {
				setTimeout(function() {
					self.callback(callback, true);
				}, 0);
			} else {
				// Do not need to get username for an ID specific request.
				this.getUsername(function(success) {
					if(success && id) {
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

}(hyperaudio));


/* Clipboard
 *
 */

var Clipboard = (function(hyperaudio) {

	// Following the method used by Trello
	// http://stackoverflow.com/questions/17527870/how-does-trello-access-the-users-clipboard

	var DEBUG = false;

	return {
		init: function(options) {
			var self = this;

			this.options = hyperaudio.extend({
				target: 'body',
				id_container: 'clipboard-container',
				id_clipboard: 'clipboard'
			}, options);

			// Properties
			this.value = '';
			this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;

			if(this.target) {
				this.container = document.createElement('div');
				this.container.setAttribute('id', this.options.id_container);
				this.container.style.display = 'none';
				this.target.appendChild(this.container);
			}

			// See if security allowed via same domain policy.
			var rights = true;
			try {
				window.top.document.createElement('div');
			} catch(error) {
				rights = false;
			}

			if(rights) {
				// Handlers for top frame
				window.top.document.documentElement.addEventListener('keydown', function(event) {
					self.onKeyDown(event);
				}, false);
				window.top.document.documentElement.addEventListener('keyup', function(event) {
					self.onKeyUp(event);
				}, false);
			}

			// Handlers for this window
			document.documentElement.addEventListener('keydown', function(event) {
				self.onKeyDown(event);
			}, false);
			document.documentElement.addEventListener('keyup', function(event) {
				self.onKeyUp(event);
			}, false);

			this.enable();
		},
		enable: function(enabled) {
			enabled = typeof enabled === 'undefined' ? true : !!enabled;
			this.enabled = enabled;
		},
		disable: function(disable) {
			disable = typeof disable === 'undefined' ? true : !!disable;
			this.enable(!disable);
		},
		copy: function(value) {
			this.value = value;
		},
		clear: function() {
			this.value = '';
		},
		onKeyDown: function(event) {

			if(DEBUG) console.log('[onKeyDown] : Key pressed');

			if(!this.enabled || !this.value || !(event.ctrlKey || event.metaKey)) {
				if(DEBUG) console.log('[onKeyDown] : Exit | enabled = ' + this.enabled + ' | value = "' + this.value + '"');
				return;
			}

			// Used the activeElement code from jPlayer.

			var pageFocus = document.activeElement;
			var keyIgnoreElementNames = "A INPUT TEXTAREA SELECT BUTTON";
			var ignoreKey = false;

			if(typeof pageFocus !== 'undefined') {
				if(pageFocus !== null && pageFocus.nodeName.toUpperCase() !== "BODY") {
					ignoreKey = true;
					if(DEBUG) console.log('[onKeyDown] : Exit | pageFocus = %o' + pageFocus);
				}
			} else {
				// Fallback for no document.activeElement support.
				hyperaudio.each( keyIgnoreElementNames.split(/\s+/g), function(i, name) {
					// The strings should already be uppercase.
					if(event.target.nodeName.toUpperCase() === name.toUpperCase()) {
						ignoreKey = true;
						if(DEBUG) console.log('[onKeyDown] : Exit | nodeName = ' + name);
						return false; // exit each.
					}
				});
			}

			if(ignoreKey) {
				return;
			}

			if(DEBUG) console.log('[onKeyDown] : Textarea prepared for copy | value = "' + this.value + '"');

			// If we get this far, prepare the textarea ready for the copy.

			hyperaudio.empty(this.container);
			this.container.style.display = 'block';

			this.clipboard = document.createElement('textarea');
			this.clipboard.setAttribute('id', this.options.id_clipboard);
			this.clipboard.value = this.value;
			this.container.appendChild(this.clipboard);
			this.clipboard.focus();
			this.clipboard.select();
		},
		onKeyUp: function(event) {
			if(DEBUG) console.log('[onKeyUp] : Key released');
			if(event.target === this.clipboard) {
				hyperaudio.empty(this.container);
				this.container.style.display = 'none';
			}
		}
	};

}(hyperaudio));


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

			this.options = hyperaudio.extend({
				title: 'Hyperaudio Pad'
			}, options);

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
				if(window.top.document !== document) {
					this.status.iframe = true;
				}

			} catch(error) {
				this.status.iframe = true;
				this.status.remote = true;
			}

			// Pick which window to use.
			if(this.status.remote || !this.status.iframe) {
				this.win = window;
			} else {
				this.win = window.top;
			}

			if(this.win.history && this.win.history.replaceState) {
				this.status.support = true;
			}

			if(DEBUG) console.log('[History|init] status: { iframe: ' + this.status.iframe + ', remote: ' + this.status.remote + ', support: ' + this.status.support + ' }');

			this.enable();
		},
		enable: function() {
			if(this.status.support) {
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
			if(param_index >= 0) {
				base_url = url.slice(0, param_index);
				// Do we have any hash chars
				if(hash_index >= 0) {
					param_url = url.slice(param_index + 1, hash_index);
					hash_url = url.slice(hash_index + 1);
				} else {
					param_url = url.slice(param_index + 1);
				}
			} else {
				// Do we have any hash chars
				if(hash_index >= 0) {
					base_url = url.slice(0, hash_index);
					hash_url = url.slice(hash_index + 1);
				}
			}

			var value_pair = param_url.split('&');
			var pair;
			var param = {};

			for(var i = 0, iLen = value_pair.length; i < iLen; i++) {
				pair = value_pair[i].split('=');
				if(pair.length === 2) {
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
			for(var name in detail.param) {
				if(detail.param.hasOwnProperty(name)) {
					if(first) {
						first = false;
						href += '?';
					} else {
						href += '&';
					}
					href += name + '=' + detail.param[name];
				}
			}
			if(detail.hash) {
				href += '#' + detail.hash;
			}
			if(DEBUG) console.log('[History|buildUrl] href = "' + href + '"');
			return href;
		},
		setParam: function(name, value) {
			// The value should be a string. An undefined will remove the parameter.
			if(this.enabled) {
				var detail = this.getUrlDetail();
				var save = false;
				if(typeof value === 'string') {
					if(detail.param[name] !== value) {
						detail.param[name] = value;
						save = true;
						if(DEBUG) console.log('[History|setParam] NEW VALUE | "' + name + '" = "' + value + '"');
					}
				} else {
					if(typeof detail.param[name] !== 'undefined') {
						delete detail.param[name];
						save = true;
						if(DEBUG) console.log('[History|setParam] DELETE VALUE | "' + name + '" = "' + value + '"');
					}
				}
				if(save) {
					this.win.history.replaceState(null, this.options.title, this.buildUrl(detail));
				}
			}
		},
		getParam: function(name) {
			if(this.enabled) {
				var detail = this.getUrlDetail();
				return detail.param[name];
			}
		}
	};

}(hyperaudio));


/* Music
 * For playing background music
 */

var Music = (function(window, document, hyperaudio, Popcorn) {

	function Music(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'MUSIC', // Not really an option... More like a manifest

			target: '#music-player', // The selector of element where the audio is generated

			media: {
				mp3: '', // The URL of the mp3 audio.
				mp4: '', // The URL of the mp4 audio.
				ogg: '' // The URL of the ogg audio.
			},

			// Types valid in an audio element
			mediaType: {
				mp3: 'audio/mpeg', // The mp3 mime type.
				mp4: 'audio/mp4', // The mp4 mime type.
				ogg: 'audio/ogg' // The ogg mime type.
			},

			async: true // When true, some operations are delayed by a timeout.
		}, options);

		this.effect = {
			start: 0,
			duration: 6,
			volume: 1,
			fadeInDuration: 2,
			fadeOutDuration: 2,
			media: {}
		};

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.audioElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);

		// List of the media types, used to check for changes in media.
		this.mediaTypes = "mp3 mp4 ogg";

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.target) {
			this.create();
		}
	}

	Music.prototype = {
		create: function() {
			var self = this;

			if(this.target) {

				this.audioElem = document.createElement('audio');

				// this.audioElem.controls = true; // TMP during dev.

				// Add listeners to the audio element
				this.audioElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						self.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the audio
				this.empty(this.target);
				this.target.appendChild(this.audioElem);

				var manager = function(event) {
					// Passing the event context to manager
					self.manager(this, event);
				};

				this.audioElem.addEventListener('progress', manager);
				this.audioElem.addEventListener('timeupdate', manager);
				this.audioElem.addEventListener('play', manager);
				this.audioElem.addEventListener('pause', manager);
				this.audioElem.addEventListener('ended', manager);

				if(this.options.media.mp3 || this.options.media.mp4) { // Assumes we have the ogg
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},

		mediaDiff: function(media) {
			var self = this,
				diff = false;
			if(media) {
				hyperaudio.each(this.mediaTypes.split(/\s+/g), function() {
					if(self.options.media[this] !== media[this]) {
						diff = true;
						return false; // exit each
					}
				});
			} else {
				diff = true;
			}
			return diff;
		},

		load: function(media) {
			var self = this,
				newMedia = this.mediaDiff(media);

			if(media) {
				this.options.media = media;
			}

			if(this.target) {

				if(newMedia) {

					this.pause(); // Pause the player, otherwise switching solution may leave 1 playing while hidden.

					this.killPopcorn();

					// console.log('media: %o', this.options.media);

					this.empty(this.audioElem);

					// Setup to work with mp3, mp4 and ogg property names. See options.
					hyperaudio.each(this.options.media, function(format, url) {
						// Only create known formats, so we can add other info to the media object.
						if(self.options.mediaType[format] && url) {
							var source = document.createElement('source');
							source.setAttribute('type', self.options.mediaType[format]);
							source.setAttribute('src', url);
							self.audioElem.appendChild(source);
						}
					});

					this.audioElem.load();

					this.initPopcorn();
				}
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			this.popcorn = Popcorn(this.audioElem);
		},
		killPopcorn: function() {
			if(this.popcorn) {
				this.popcorn.destroy();
				delete this.popcorn;
			}
		},
		empty: function(el) {
			// Empties the element... Possibly better than el.innerHTML = '';
			while(el && el.firstChild) {
				el.removeChild(el.firstChild);
			}
		},
		play: function(time) {
			this.currentTime(time, true);
		},
		pause: function(time) {
			this.audioElem.pause();
			this.currentTime(time);
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.audioElem;

			clearTimeout(this.timeout.currentTime);

			if(typeof time === 'number' && !isNaN(time)) {

				// Attempt to play it, since iOS has been ignoring commands
				if(play && this.commandsIgnored) {
					media.play();
				}

				try {
					// !media.seekable is for old HTML5 browsers, like Firefox 3.6.
					// Checking seekable.length is important for iOS6 to work with currentTime changes immediately after changing media
					if(!media.seekable || typeof media.seekable === "object" && media.seekable.length > 0) {
						media.currentTime = time;
						if(play) {
							media.play();
						}
					} else {
						throw 1;
					}
				} catch(err) {
					this.timeout.currentTime = setTimeout(function() {
						self.currentTime(time, play);
					}, 250);
				}
			} else {
				if(play) {
					media.play();
				}
			}
		},
		manager: function(audioElem, event) {
			var self = this;

			this.paused = audioElem.paused;

			if(!this.paused) {

				var end = this.effect.start + this.effect.duration;

				// The fade in/out code is WIP

				// Fade In TimeZone
				var fadeIn = {
					start: this.effect.start,
					end: this.effect.start + this.effect.fadeInDuration
				};

				// Fade Out TimeZone
				var fadeOut = {
					start: end - this.effect.fadeOutDuration,
					end: end
				};

				if(audioElem.currentTime > end) {
					this.pause();
				}
			}
		},
		bgmFX: function(effect) {
			hyperaudio.extend(this.effect, effect);
			this.load(this.effect.media);
			this.audioElem.volume = this.effect.volume;
			this.play(this.effect.start);
		}
	};

	return Music;
}(window, document, hyperaudio, Popcorn));


/* Player
 *
 */

var Player = (function(window, document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			// Caching can cause problem in Chrome due to the bug:
			//   Issue 31014: Byte range cache is locked when attempting to open the same video twice
			//   https://code.google.com/p/chromium/issues/detail?id=31014
			cache: false,

			media: {
				youtube: '', // The URL of the Youtube video.
				mp4: '', // The URL of the mp4 video.
				webm: '', // The URL of the webm video.
				mpeg: '' // The URL of the mp3 audio.
			},

			// Types valid in a video element
			mediaType: {
				mp4: 'video/mp4', // The mp4 mime type.
				webm:'video/webm', // The webm mime type.
				mpeg:'audio/mpeg' // The mp3 mime type.
			},

			guiNative: false, // TMP during dev. Either we have a gui or we are chomeless.

			gui: false, // True to add a gui, or Object to pass GUI options.
			cssClass: 'hyperaudio-player', // Class added to the target for the GUI CSS. (passed to GUI and Projector)
			solutionClass: 'solution', // Class added to the solution that is active.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);

		// List of the media types, used to check for changes in media.
		this.mediaTypes = "youtube mp4 webm mpeg";

		this.youtube = false; // A flag to indicate if the YT player being used.

		// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
		this.ytFix = [];

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function() {
			var self = this;
			var tryLoad = false;

			if(this.target) {

				this.wrapper = {
					html: document.createElement('div'),
					youtube: document.createElement('div')
				};
				hyperaudio.addClass(this.wrapper.html, this.options.cssClass + '-video-wrapper');
				hyperaudio.addClass(this.wrapper.youtube, this.options.cssClass + '-youtube-wrapper');

				this.solution = {
					html: document.createElement('video'),
					youtube: Popcorn.HTMLYouTubeVideoElement(this.wrapper.youtube)
				};

				// Default to a video element to start with
				this.videoElem = this.solution.html;
				this.youtube = false;
				this.updateSolution();

				this.solution.html.controls = this.options.guiNative; // TMP during dev. Either we have a gui or we are chomeless.

				// Add listeners to the video element
				this.solution.html.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						self.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.empty(this.target);
				this.wrapper.html.appendChild(this.solution.html);
				// this.wrapper.youtube.appendChild(this.solution.youtube);
				this.target.appendChild(this.wrapper.html);
				this.target.appendChild(this.wrapper.youtube);

				if(this.options.gui) {

					var guiOptions = {
						player: this,

						navigation: false,		// next/prev buttons
						fullscreen: false,		// fullscreen button

						cssClass: this.options.cssClass // Pass in the option, so only have to define it in this class
					};

					if(typeof this.options.gui === 'object') {
						hyperaudio.extend(guiOptions, this.options.gui);
					}

					this.GUI = new hyperaudio.PlayerGUI(guiOptions);

					var handler = function(event) {
						var video = self.videoElem;
						self.GUI.setStatus({
							paused: video.paused,
							currentTime: video.currentTime,
							duration: video.duration
						});
					};

					this.addEventListener('progress', handler); // Important for YT player GUI to update on set/change
					this.addEventListener('timeupdate', handler);
					this.addEventListener('play', handler);
					this.addEventListener('pause', handler);
					this.addEventListener('ended', handler);
				}

				// See if the media object contains anything.
				hyperaudio.each(this.options.media, function(format, url) {
					if(url) {
						tryLoad = true;
						return false; // exit each
					}
				});

				// if(this.options.media.youtube || this.options.media.mp4) { // Assumes we have the webm
				if(tryLoad) { // We have something - try to load it.
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},

		mediaDiff: function(media) {
			var self = this,
				diff = false;
			if(media) {
				hyperaudio.each(this.mediaTypes.split(/\s+/g), function() {
					if(self.options.media[this] !== media[this]) {
						diff = true;
						return false; // exit each
					}
				});
			} else {
				diff = true;
			}
			return diff;
		},

		updateSolution: function() {
			var wrapper = this.wrapper,
				cssClass = this.options.solutionClass;

			if(this.youtube) {
				hyperaudio.removeClass(wrapper.html, cssClass);
				hyperaudio.addClass(wrapper.youtube, cssClass);
			} else {
				hyperaudio.removeClass(wrapper.youtube, cssClass);
				hyperaudio.addClass(wrapper.html, cssClass);
			}
		},

		show: function() {
			this.updateSolution();
		},
		hide: function() {
			var wrapper = this.wrapper,
				cssClass = this.options.solutionClass;

			hyperaudio.removeClass(wrapper.html, cssClass);
			hyperaudio.removeClass(wrapper.youtube, cssClass);
		},

		load: function(media) {
			var self = this,
				newMedia = this.mediaDiff(media);

			if(media) {
				this.options.media = media;
			}

			if(this.target) {

				if(newMedia) {

					this.pause(); // Pause the player, otherwise switching solution may leave 1 playing while hidden.

					this.killPopcorn();

					// console.log('media: %o', this.options.media);

					if(this.options.media.youtube) {

						// The YT element needs to be recreated while bugs in wrapper.
						// this.empty(this.wrapper.youtube);
						// this.solution.youtube = Popcorn.HTMLYouTubeVideoElement(this.wrapper.youtube);

						this.solution.youtube.src = this.options.media.youtube + '&html5=1';
						this.videoElem = this.solution.youtube;
						this.youtube = true;
						this.updateSolution();

						// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
						// this._ytFixListeners();
					} else {

						this.empty(this.solution.html);

						// Setup to work with mp4 and webm property names. See options.
						hyperaudio.each(this.options.media, function(format, url) {
							// Only create known formats, so we can add other info to the media object.
							if(self.options.mediaType[format] && url) {

								if(!self.options.cache) {
									url = url + ((/\?/).test(url) ? "&" : "?") + Math.floor(1e12 * Math.random());
								}

								var source = document.createElement('source');
								source.setAttribute('type', self.options.mediaType[format]);
								source.setAttribute('src', url); // Could use 'this' but less easy to read.
								self.solution.html.appendChild(source);
							}
						});

						this.solution.html.load();
						this.videoElem = this.solution.html;
						this.youtube = false;
						this.updateSolution();
					}

					this.initPopcorn();
				}
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		initPopcorn: function() {
			this.killPopcorn();
			this.popcorn = Popcorn(this.videoElem);
		},
		killPopcorn: function() {
			if(this.popcorn) {
				this.popcorn.destroy();
				delete this.popcorn;
			}
		},
		empty: function(el) {
			// Empties the element... Possibly better than el.innerHTML = '';
			while(el && el.firstChild) {
				el.removeChild(el.firstChild);
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
		play: function(time) {
			if(this.youtube) {
				this.popcorn.play(time);
			} else {
				this.currentTime(time, true);
			}
		},
		pause: function(time) {
			if(this.youtube) {
				this.popcorn.pause(time);
			} else {
				this.videoElem.pause();
				this.currentTime(time);
			}
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.videoElem;

			clearTimeout(this.timeout.currentTime);

			if(this.youtube) {
				this.popcorn.currentTime(time);
				return;
			}

			if(typeof time === 'number' && !isNaN(time)) {

				// Attempt to play it, since iOS has been ignoring commands
				if(play && this.commandsIgnored) {
					media.play();
				}

				try {
					// !media.seekable is for old HTML5 browsers, like Firefox 3.6.
					// Checking seekable.length is important for iOS6 to work with currentTime changes immediately after changing media
					if(!media.seekable || typeof media.seekable === "object" && media.seekable.length > 0) {
						media.currentTime = time;
						if(play) {
							media.play();
						}
					} else {
						throw 1;
					}
				} catch(err) {
					this.timeout.currentTime = setTimeout(function() {
						self.currentTime(time, play);
					}, 250);
				}
			} else {
				if(play) {
					media.play();
				}
			}
		},
		addEventListener: function(type, handler) {
			var self = this,
				handlers;

			if(this.solution && typeof type === 'string' && typeof handler === 'function') {
				handlers = {
					html: function(event) {
						if(!self.youtube) {
							handler.call(this, event);
						}
					},
					youtube: function(event) {
						if(self.youtube) {
							// Bugged YT wrapper context.
							// Reported https://bugzilla.mozilla.org/show_bug.cgi?id=946293
							// handler.call(this, event); // Bugged
							// this and event.target point at the document
							// event.detail.target points at the youtube target element
							handler.call(self.solution.youtube, event);
						}
					}
				};
				this.solution.html.addEventListener(type, handlers.html, false);
				this.solution.youtube.addEventListener(type, handlers.youtube, false);

				// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
				this.ytFix.push({
					type: type,
					handler: handlers.youtube
				});
			}

			return handlers;
		},
		removeEventListener: function(type, handlers) {
			if(this.solution && typeof type === 'string' && typeof handlers === 'object') {
				this.solution.html.removeEventListener(type, handlers.html, false);
				this.solution.youtube.removeEventListener(type, handlers.youtube, false);

				// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
				for(var i=0, l=this.ytFix.length; i<l; i++) {
					if(this.ytFix[i].type === type && this.ytFix[i].handler === handlers.youtube) {
						this.ytFix.splice(i, 1);
					}
				}
			}
		},
		// OBSOLETE Function due to Popcorn and YT Wrapper being fixed. ie., No more destroy and create... It persists!
		_ytFixListeners: function() {
			// Until the YouTube wrapper is fixed, we need to recreate it and the listeners when the YT media changes.
			for(var i=0, l=this.ytFix.length; i<l; i++) {
				this.solution.youtube.addEventListener(this.ytFix[i].type, this.ytFix[i].handler, false);
			}
		}
	};

	return Player;
}(window, document, hyperaudio, Popcorn));


/**
 *
 * Player GUI
 *
 */

var PlayerGUI = (function (window, document, hyperaudio) {

	function PlayerGUI (options) {
		this.options = hyperaudio.extend({}, {
			player:			null,	// mandatory instance to the player

			navigation:		true,	// whether or not to display the next/prev buttons
			fullscreen:		true,	// display the fullscreen button

			cssClass: 'hyperaudio-player' // Class added to the target for the GUI CSS. (should move to GUI)
		}, options);

		if ( !this.options.player ) {
			return false;
		}

		this.status = {
			paused: true,
			currentTime: 0,
			duration: 0
		};

		this.player = this.options.player;

		var buttonCount = 1;

		var cssClass = this.options.cssClass; // For mini opto

		this.wrapperElem = document.createElement('div');
		this.wrapperElem.className = cssClass + '-gui';
		this.controlsElem = document.createElement('ul');
		this.controlsElem.className = cssClass + '-controls';

		this.wrapperElem.appendChild(this.controlsElem);

		// PLAY button
		this.playButton = document.createElement('li');
		this.playButton.className = cssClass + '-play';
		this.controlsElem.appendChild(this.playButton);
		this.playButton.addEventListener('click', this.play.bind(this), false);

		// PREV/NEXT buttons
		if ( this.options.navigation ) {
			this.prevButton = document.createElement('li');
			this.prevButton.className = cssClass + '-prev';
			this.nextButton = document.createElement('li');
			this.nextButton.className = cssClass + '-next';

			this.controlsElem.appendChild(this.prevButton);
			this.controlsElem.appendChild(this.nextButton);

			//this.prevButton.addEventListener('click', this.prev.bind(this), false);
			//this.nextButton.addEventListener('click', this.next.bind(this), false);
			buttonCount += 2;
		}

		// PROGRESS BAR
		this.progressBarElem = document.createElement('li');
		this.progressBarElem.className = cssClass + '-bar';
		this.progressIndicator = document.createElement('div');
		this.progressIndicator.className = cssClass + '-progress';
		this.progressIndicator.style.width = '0%';

		this.progressBarElem.appendChild(this.progressIndicator);
		this.controlsElem.appendChild(this.progressBarElem);

		this.progressBarElem.addEventListener('mousedown', this.startSeeking.bind(this), false);
		this.progressBarElem.addEventListener('mousemove', this.seek.bind(this), false);
		document.addEventListener('mouseup', this.stopSeeking.bind(this), false);
		// this.player.videoElem.addEventListener('timeupdate', this.timeUpdate.bind(this), false);

		// FULLSCREEN Button
		if ( this.options.fullscreen ) {
			this.fullscreenButton = document.createElement('li');
			this.fullscreenButton.className = cssClass + '-fullscreen';
			this.controlsElem.appendChild(this.fullscreenButton);

			this.fullscreenButton.addEventListener('click', this.fullscreen.bind(this), false);

			buttonCount += 1;
		}

		// The time displays
		this.currentTimeElem = document.createElement('div');
		this.currentTimeElem.className = cssClass + '-current-time';
		this.durationElem = document.createElement('div');
		this.durationElem.className = cssClass + '-duration';
		this.progressBarElem.appendChild(this.currentTimeElem);
		this.progressBarElem.appendChild(this.durationElem);

		// Adjust sizes according to options
		this.progressBarElem.style.width = 100 - buttonCount*10 + '%';

		// No longer required since fixing fullscreen using: .hyperaudio-player-bar { position: relative; }
		// Now these are set to 100% width in the CSS.
		// this.currentTimeElem.style.width = 100 - buttonCount*10 + '%';
		// this.durationElem.style.width = 100 - buttonCount*10 + '%';

		// Add the GUI
		hyperaudio.addClass(this.player.target, cssClass);
		this.player.target.appendChild(this.wrapperElem);
	}

	PlayerGUI.prototype = {

		setStatus: function(status) {
			// Extending, since the new status might not hold all values.
			hyperaudio.extend(this.status, status);

			// console.log('paused:' + this.status.paused + ' | currentTime:' + this.status.currentTime + ' | duration:' + this.status.duration);

			this.timeUpdate();
			// could also update the play pause button?
			// - the playing to paused state is covered by timeUpdate()
		},

		play: function () {
			// if ( !this.player.videoElem.paused ) {
			if ( !this.status.paused ) {
				hyperaudio.removeClass(this.wrapperElem, 'playing');
				this.player.gui_pause();
				return;
			}

			hyperaudio.addClass(this.wrapperElem, 'playing');
			this.player.gui_play();
		},

		timeUpdate: function () {

			var percentage = 0;
			if(this.status.duration > 0) {
				percentage = Math.round(100 * this.status.currentTime / this.status.duration);	
			}

			this.progressIndicator.style.width = percentage + '%';

			this.currentTimeElem.innerHTML = time(this.status.currentTime);
			this.durationElem.innerHTML = time(this.status.duration);

			if ( this.status.paused ) {
				hyperaudio.removeClass(this.wrapperElem, 'playing');
			} else {
				hyperaudio.addClass(this.wrapperElem, 'playing');
			}
		},

		fullscreen: function () {
			if ( !this._isFullscreen() ) {
				this._requestFullScreen();
				return;
			}

			this._cancelFullScreen();
		},

		_requestFullScreen: function () {
			if (this.player.target.requestFullScreen) {
				this.player.target.requestFullScreen();
			} else if (this.player.target.mozRequestFullScreen) {
				this.player.target.mozRequestFullScreen();
			} else if (this.player.target.webkitRequestFullScreen) {
				this.player.target.webkitRequestFullScreen();
			}
		},

		_cancelFullScreen: function () {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			} else if (document.webkitCancelFullScreen) {
				document.webkitCancelFullScreen();	
			}
		},

		_isFullscreen: function () {
			return !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.msFullscreenElement || false);
		},

		startSeeking: function (e) {
			this.seeking = true;
			this.seek(e);
		},

		stopSeeking: function () {
			if ( !this.seeking ) {
				return;
			}

			this.seeking = false;
		},

		seek: function (e) {
			if ( !this.seeking ) {
				return;
			}

			var rect = this.progressBarElem.getBoundingClientRect();
			var width = rect.width;
			var x = e.pageX - rect.left;
			
			// var current = Math.round(this.player.videoElem.duration / width * x);
			// this.player.currentTime(current, !this.player.videoElem.paused);

			// var current = Math.round(this.status.duration / width * x);
			var current = Math.round(100 * this.status.duration * x / width) / 100;
			this.player.gui_currentTime(current);
		}
	};

	// Adapted this from jPlayer code
	function ConvertTime() {
		this.init();
	}
	ConvertTime.prototype = {
		init: function() {
			this.options = {
				timeFormat: {
					showHour: false,
					showMin: true,
					showSec: true,
					padHour: false,
					padMin: true,
					padSec: true,
					sepHour: ":",
					sepMin: ":",
					sepSec: ""
				}
			};
		},
		time: function(s) {
			s = (s && typeof s === 'number') ? s : 0;

			var myTime = new Date(s * 1000),
				hour = myTime.getUTCHours(),
				min = this.options.timeFormat.showHour ? myTime.getUTCMinutes() : myTime.getUTCMinutes() + hour * 60,
				sec = this.options.timeFormat.showMin ? myTime.getUTCSeconds() : myTime.getUTCSeconds() + min * 60,
				strHour = (this.options.timeFormat.padHour && hour < 10) ? "0" + hour : hour,
				strMin = (this.options.timeFormat.padMin && min < 10) ? "0" + min : min,
				strSec = (this.options.timeFormat.padSec && sec < 10) ? "0" + sec : sec,
				strTime = "";

			strTime += this.options.timeFormat.showHour ? strHour + this.options.timeFormat.sepHour : "";
			strTime += this.options.timeFormat.showMin ? strMin + this.options.timeFormat.sepMin : "";
			strTime += this.options.timeFormat.showSec ? strSec + this.options.timeFormat.sepSec : "";

			return strTime;
		}
	};
	var myConvertTime = new ConvertTime();
	function time(s) {
		return myConvertTime.time(s);
	}

	return PlayerGUI;

})(window, document, hyperaudio);


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

		// this.iScroll = new IScroll(this.target, { mouseWheel: true, click: true });
		this.iScrollOptions = {
			scrollbars: true,
			mouseWheel: true,
			interactiveScrollbars: true,

			// Options to disable grabbing the page and moving it.
			disableMouse: true,
			disablePointer: true,
			disableTouch: true
		};
		this.iScrollSpeed = 800; // ms
		this.iScrollOffsetY = -20; // pixels
		this.iScroll = new IScroll(this.target, this.iScrollOptions);

		// Setup Debug
		if(this.options.DEBUG) {
			this._debug();
		}

		// See if the media object contains anything.
		var tryLoad = false;
		hyperaudio.each(this.options.media, function(format, url) {
			if(url) {
				tryLoad = true;
				return false; // exit each
			}
		});

		// If we have the info, kick things off
		// if(this.options.id || this.options.media.youtube || this.options.media.mp4) {
		if(this.options.id || tryLoad) { // We have something - try to load it.
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
				setTimeout(function() {
					// Create a new instance, since the contents completely changed... That 1st child is not covered by .refresh()
					self.iScroll = new IScroll(self.target, self.iScrollOptions);
				}, 0);
			};

			if(this.target) {
				// Destroy iscroll, since is is useless after the contents of the wraper changes, changing that 1st child element.
				self.iScroll.destroy();

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
					self.iScroll.scrollToElement(parent, self.iScrollSpeed, null, self.iScrollOffsetY);
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
									}
									if(opts.media.webm) {
										el.setAttribute(opts.stage.options.webmAttr, opts.media.webm); // Pass the transcript webm url
									}
									if(opts.media.youtube) {
										el.setAttribute(opts.stage.options.ytAttr, opts.media.youtube); // Pass the transcript youtube url
									}
									if(opts.media.mpeg) {
										el.setAttribute(opts.stage.options.mpegAttr, opts.media.mpeg); // Pass the transcript mp3 url
									}
									el.setAttribute(opts.stage.options.unitAttr, opts.unit); // Pass the transcript Unit
									opts.stage.dropped(el);
								}
							});

							var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
							dragdrop.init(html, e);
						}
					},
					onSelection: function(e) {
						// Update the copy and paste.
						if(hyperaudio.Clipboard) {
							hyperaudio.Clipboard.copy(self.getSelection().text);
						}
					},
					onClear: function(e) {
						if(hyperaudio.Clipboard) {
							hyperaudio.Clipboard.clear();
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
					words, start, end, text;

				el.innerHTML = html;
				words = el.querySelectorAll(opts.word);

				if(words.length) {
					start = words[0].getAttribute(opts.timeAttr);
					end = words[words.length - 1].getAttribute(opts.timeAttr);
				}

				text = el.textContent;
				if(text.trim) {
					text = text.trim();
				}

				// The end time is the start of the last word, so needs padding.
				return {
					text: text,
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


/* Stage
 *
 */

var Stage = (function(document, hyperaudio) {

	function Stage(options) {

		var self = this;

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			id: '', // The ID of the saved mix.
			mix: {
				// title, desc, type,
				// url: [!content] The url of the mix
				// content: [!url] The actual mix HTML
			},

			title: 'Title not set',
			desc: 'Description not set',
			type: 'beta',

			editable: true, // Set false to disable the drag and drop. Used for viewer and does not disable drops from transcripts.

			idAttr: 'data-id', // Attribute name that holds the transcript ID.
			transAttr: 'data-trans', // Attribute name that holds the transcript URL. [optional if ID not present]
			mp4Attr: 'data-mp4', // Attribute name that holds the transcript mp4 URL.
			webmAttr: 'data-webm', // Attribute name that holds the transcript webm URL.
			ytAttr: 'data-yt', // Attribute name that holds the transcript youtube URL.
			mpegAttr: 'data-mpeg', // Attribute name that holds the transcript mpeg URL.
			unitAttr: 'data-unit', // Attribute name that holds the transcript Unit.

			word: 'a',
			section: 'section',
			// timeAttr: 'data-m', // Attribute name that holds the timing information.

			dragdropClass: 'dragdrop',
			async: true, // When true, some operations are delayed by a timeout.
			projector: null
		}, options);

		// State Flags.
		this.ready = false;
		this.enabled = true;

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.article = document.createElement('article');
		this.mix = {};

		// The following lines assume that we found a target.

		this.target.appendChild(this.article);

		// Detect when an effect value is changed
		this.target.addEventListener('change', function(e) {
			self.changed();
		}, false);

		// this.target._tap = new Tap({el: this.target});
		// this.target.addEventListener('tap', function(event) {
		this.target.addEventListener('click', function(event) {
			var section, word, search;
			// event.preventDefault(); // Removed since it breaks checkbox clicks in effects.
			if(event.target.nodeName.toLowerCase() === self.options.word) {
				word = event.target;
				search = word;

				// Search up the parent tree for the section.
				while(search) {
					if(search.nodeName.toLowerCase() === self.options.section) {
						section = search;
						break; // exit while loop
					}
					search = search.parentNode;
				}

				if(self.options.projector) {
					self.options.projector.playWord(section,word);
				}
			}
		}, false);

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.projector) {
			this.options.projector.setStage(this);
		}

		if(this.options.id || this.options.mix.url || this.options.mix.content) {
			this.load();
		}
	}

	Stage.prototype = {
		mixDetails: function(details) {
			// [SHOULD] only really used to set the label, desc and type of the mix being saved.
			hyperaudio.extend(this.options, details);
		},
		updateStage: function(content) {
			// Need to maintain the existing article in the stage - Important for dragdrop.
			var tmp = document.createElement('div'); // Temporary DOM element
			tmp.innerHTML = content; // Add the content to the DOM element
			var articleElem = tmp.querySelector('article'); // Find the article in the content.
			// Can now insert the contents of the returned mix article into the maintained article.
			this.article.innerHTML = articleElem.innerHTML;

			// TODO: Should also clear any existing attributes on the article.

			// Now copy over any attributes
			var attr = articleElem.attributes;
			for(var i=0, l=attr.length; i < l; i++ ) {
				this.article.setAttribute(attr[i].name, attr[i].value);
			}
		},
		load: function(id) {
			var self = this;

			if(typeof id !== 'undefined') {
				if(typeof id === 'string') {
					this.options.id = id;
					this.options.mix = {};
				} else if(typeof id === 'object') {
					this.options.id = '';
					this.options.mix = id;
				} else {
					this.options.id = '';
					this.options.mix = {};
				}
			}

			if(this.target) {

				if(this.options.id) {

					hyperaudio.api.getMix(id, function(success) {
						if(success) {
							self.mix = hyperaudio.extend({}, this.mix);
							self.mixDetails({
								title: self.mix.label,
								desc: self.mix.desc,
								type: self.mix.type
							});
							self.updateStage(self.mix.content);

							// Setup the dragdrop on the loaded mix sections.
							self.initDragDrop();
							self._trigger(hyperaudio.event.load, {msg: 'Loaded mix'});
						} else {
							self._error(this.status + ' ' + this.statusText + ' : "' + id + '"');
						}
					});
				} else {
					this.mixDetails({
						title: this.options.mix.title,
						desc: this.options.mix.desc,
						type: this.options.mix.type
					});
					if(this.options.mix.url) {
						hyperaudio.xhr({
							url: this.options.mix.url,
							complete: function(event) {
								self.updateStage(this.responseText);
								self.initDragDrop();
								self._trigger(hyperaudio.event.load, {msg: 'Loaded "' + self.options.mix.url + '"'});
							},
							error: function(event) {
								self.target.innerHTML = 'Problem with mix URL.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
								self._error(this.status + ' ' + this.statusText + ' : "' + self.options.mix.url + '"');
							}
						});
					} else if(this.options.mix.content) {
						this.updateStage(this.options.mix.content);
						this.initDragDrop();
						this._trigger(hyperaudio.event.load, {msg: 'Loaded given content'});
					} else {
						this.target.innerHTML = 'Problem with mix.'; // TMP - This sort of things should not be in the lib code, but acting off an error event hander.
						this._error('Stage : No ID, URL or Content');
					}
				}
			}
		},

		save: function(callback) {
			// Save the staged production

			var self = this;

			hyperaudio.extend(this.mix, {
				label: this.options.title,
				desc: this.options.desc,
				type: this.options.type,
				content: this.target.innerHTML
			});

			if(this.target) {

				hyperaudio.api.putMix(this.mix, function(success) {
					if(success) {
						if(success.saved) {
							self.mix = hyperaudio.extend({}, this.mix);
							hyperaudio.Address.setParam('m', self.mix._id);
							self._trigger(hyperaudio.event.save, {msg: 'Saved mix'});
						} else if(success.needLogin) {
							// We need to login
							self._trigger(hyperaudio.event.unauthenticated, {msg: 'Sign In required to save'});
						} else {
							self._error('Stage: Save: Error with API putMix() response');
						}
					} else {
						self._error('Stage: Save: Error with API putMix() request');
					}
					self.callback(callback, success);
				});
			}
		},

		callback: function(callback, success) {
			if(typeof callback === 'function') {
				callback.call(this, success);
			}
		},

		clear: function() {
			// TODO: Should also clear any existing attributes on the article.
			this.article.innerHTML = '';
			this.mix = {};
			this.options.id = '';
			this.changed(true);
			hyperaudio.Address.setParam('m');
		},

		parse: function() {
			var self = this,
				opts = this.options;

			// Will need the popcorn.transcript highlighting as per the source transcripts.
		},

		initDragDrop: function() {
			var self = this,
				i, l, sections, effectType, bgmTitle, dragHtml;

			var capitaliseFirstLetter = function(string) {
				return string.charAt(0).toUpperCase() + string.slice(1);
			};

			// We use the Stage in the viewer... So want to disable this feature there.
			if(this.options.editable) {

				if(this.target) {
					sections = this.target.getElementsByTagName('section');
					l = sections.length;
					for(i=0; i < l; i++) {

						dragHtml = '';

						// This code is to setup the drag-and-drop with a nice label. Otherwise the effects look bad after loading back in and dragged
						effectType = sections[i].getAttribute('data-effect');
						if(typeof effectType === 'string') {
							switch(effectType) {
								case 'fade':
								case 'trim':
								case 'title':
									dragHtml = capitaliseFirstLetter(effectType);
									break;
								case 'bgm':
									bgmTitleElem = sections[i].querySelector('.icon-music');
									if(bgmTitleElem) {
										dragHtml = bgmTitleElem.parentNode.innerHTML;
									} else {
										dragHtml = '<span class="icon-music">BGM</span>';
									}
									break;
							}
						}

						// And we finally setup the DragDrop
						self.dropped(sections[i], dragHtml);
					}
				}
			} else {
				this.changed();
			}
		},

		dropped: function(el, html) {
			var self = this;
			var actions;
			var draggableClass = '';

			var editBlock = function (e) {
				e.stopPropagation();
				this.parentNode._editBlock = new EditBlock({
					el: this.parentNode,
					stage: self
				});
			};

			if(this.target) {
				// hyperaudio.removeClass(this.target, this.options.dragdropClass);

				// add edit action if needed
				if ( !(/(^|\s)effect($|\s)/.test(el.className)) ) {
					actions = el.querySelector('.actions');
					if(actions) {
						actions._tap = new Tap({el: actions});
						actions.addEventListener('tap', editBlock, false);
					}
				} else {
					draggableClass = 'draggableEffect';
				}

				// Setup item for future dragdrop 
				el._dragInstance = new DragDrop({
					handle: el,
					dropArea: this.target,
					html: html ? html : el.innerHTML,
					draggableClass: draggableClass,
					onDragStart: function () {
						hyperaudio.addClass(self.target, self.options.dragdropClass);
					},
					onDrop: function () {
						hyperaudio.removeClass(self.target, self.options.dragdropClass);
						self.changed();
					}
				});

				this.changed();
			}
		},

		changed: function(reset) {
			// Tell the projector the content changed
			if(this.options.projector) {
				this.options.projector.requestUpdate(reset);
			}
			this._trigger(hyperaudio.event.change, {msg: 'The mix has changed'});
		},

		enable: function() {
			this.enabled = true;
		},
		disable: function() {
			this.enabled = false;
		}
	};

	return Stage;
}(document, hyperaudio));


/* Projector
 * Used to play the staged productions
 */

var Projector = (function(window, document, hyperaudio, Popcorn) {

	var DEBUG = false;

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

		this.iScrollOptions = {
			scrollbars: true,
			mouseWheel: true,
			interactiveScrollbars: true,

			// Options to disable grabbing the page and moving it.
			disableMouse: true,
			disablePointer: true,
			disableTouch: true
		};
		this.iScrollSpeed = 800; // ms
		this.iScrollOffsetY = -20; // pixels
		this.iScroll = null;

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
			this.iScroll = new IScroll(this.stage.target, this.iScrollOptions);
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
			var self = this;
			var elems, e, eLen;
			var onNewPara = function(parent) {
				self.iScroll.scrollToElement(parent, self.iScrollSpeed, null, self.iScrollOffsetY);
			};

			if(index < this.content.length && player < this.player.length) {

				// Reset the popcorn... Maybe want to only do this if necessary, ie., if any transcript plugins added.
				this.player[player].initPopcorn();
				if(DEBUG) console.log('[Projector|initPopcorn] player[%d].initPopcorn()', player);

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
				if(DEBUG) console.log('[Projector|load] player[%d].load() | initPopcorn()', this.activePlayer);
			}

			this.initPopcorn(index, this.activePlayer);

			for(var i=0; i < this.player.length; i++) {
				hyperaudio.removeClass(this.player[i].target, 'active');
			}
			hyperaudio.addClass(this.player[this.activePlayer].target, 'active');

			if(DEBUG) console.log('[Projector|load] contentIndex: %d | activePlayer: %d', this.contentIndex, this.activePlayer);
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

						if(DEBUG) console.log('[Projector|prepare] player[%d].load() | initPopcorn()', this.nextPlayer);
						if(DEBUG) console.log('[Projector|prepare] prepared=false | nextPlayer: %d | alignStart: %d', this.nextPlayer, alignStart);
					}
				} else {
					// Reset popcorn and move the video to the start time.
					if(prepared !== this.activePlayer) {
						this.player[prepared].initPopcorn();
						this.player[prepared].pause(alignStart);

						if(DEBUG) console.log('[Projector|prepare] player[%d].initPopcorn()', prepared);
						if(DEBUG) console.log('[Projector|prepare] prepared=' + prepared + ' | nextPlayer: %d | alignStart: %d', this.nextPlayer, alignStart);
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
			if(DEBUG) console.log('[Projector|which] media: %o | index: ' + index, media); // %d no good since index can be boolean.
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
					if(DEBUG) console.log('[Projector|cue] isReadyToPlay = ' + this.isReadyToPlay);

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

			if(arguments.length && typeof arguments[0] !== 'undefined') {
				if(typeof arguments[0] === 'object') {
					jumpTo = arguments[0];
					if(DEBUG) console.log('[Projector|play] jumpTo =  %o', jumpTo);
				}
			} else if(this.isReadyToPlay) {
				resume = true;
			}

			if(DEBUG) console.log('[Projector|play] resume = ' + resume + ' | content.length = %d | arguments = %o', this.content.length, arguments);

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
			if(DEBUG) console.log('[Projector|updateContent#1] isReadyToPlay = ' + this.isReadyToPlay);

			if(this.stage && this.stage.target) {

				// Refresh the iscroller since mix changed.
				this.iScroll.refresh();

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
					if(DEBUG) console.log('[Projector|updateContent#2] isReadyToPlay = ' + this.isReadyToPlay);
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

			var stageOptions = this.stage ? this.stage.options : {},
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
					youtube = el.getAttribute(stageOptions.ytAttr),
					mpeg = el.getAttribute(stageOptions.mpegAttr);

				if(mp4 || webm || youtube || mpeg) {
					section.media = {
						mp4: mp4,
						webm: webm,
						youtube: youtube,
						mpeg: mpeg
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
						if(DEBUG) console.log('[Projector|manager] isReadyToPlay = ' + this.isReadyToPlay);
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


hyperaudio.register('Music', Music);
hyperaudio.register('Player', Player);
hyperaudio.register('PlayerGUI', PlayerGUI);
hyperaudio.register('Transcript', Transcript);
hyperaudio.register('Stage', Stage);
hyperaudio.register('Projector', Projector);


hyperaudio.utility('Address', Address); // obj
hyperaudio.utility('api', api); // obj
hyperaudio.utility('Clipboard', Clipboard); // obj
hyperaudio.utility('DragDrop', DragDrop); // Class
hyperaudio.utility('EditBlock', EditBlock); // Class
hyperaudio.utility('fadeFX', fadeFX); // Class
hyperaudio.utility('SideMenu', SideMenu); // Class
hyperaudio.utility('Tap', Tap); // Class
hyperaudio.utility('titleFX', titleFX ); // Class
hyperaudio.utility('WordSelect', WordSelect); // Class
hyperaudio.utility('xhr', xhr); // fn


	return hyperaudio;
}(window, document));
