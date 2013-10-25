/*! hyperaudio v0.1.3 ~ (c) 2012-2013 Hyperaudio Inc. <hello@hyperaud.io> (http://hyperaud.io) ~ Built: 25th October 2013 03:19:31 */
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
      Object.getOwnPropertyNames( dictionary ).forEach(function( key ) {
        this[ key ] = dictionary[ key ];
      }, this);
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

      Object.defineProperty( this, "error", {
        get: function() {

          return self.media.error;
        }
      });

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

    Object.defineProperty( this, "count", {
      get: function() {
        return this.byStart.length;
      }
    });
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

		var pParent;

		return {		
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

			// The popcorn docs appears to have renamed 'options' with 'track', but its operation seems the same.
			// Believe that this is to identify the parameter as the track object, rather than 'options', which is probably used all over the place.

			_setup: function( options ) {

				var parent, iAmNewPara;

				// if a target is specified and is a string, use that - Requires every word <span> to have a unique ID.
				// else if target is specified and is an object, use object as DOM reference
				// else Throw an error.
				if ( options.target && typeof options.target === "string" && options.target !== 'Transcript-container' ) {
					options.container = document.getElementById( options.target );
				} else if ( options.target && typeof options.target === "object" ) {
					options.container = options.target;
				} else {
					throw "Popcorn.transcript: target property must be an ID string or a pointer to the DOM of the transcript word.";
				}

				options.start = 0;
				options.end = options.time;

				if(!options.futureClass) {
					options.futureClass = "transcript-future";
				}

				parent = options.target.parentNode;
				if(parent !== pParent) {
					iAmNewPara = true;
					pParent = parent;
				}

				options.transcriptRead = function() {
					if( options.container.classList ) {
						options.container.classList.remove(options.futureClass);
					} else {
						options.container.className = "";
					}
					if(iAmNewPara && typeof options.onNewPara === 'function') {
						options.onNewPara(options.target.parentNode);
					}
				};

				options.transcriptFuture = function() {
					if( options.container.classList ) {
						options.container.classList.add(options.futureClass);
					} else {
						options.container.className = options.futureClass;
					}
				};

				// Note: end times close to zero can have issues. (Firefox 4.0 worked with 100ms. Chrome needed 200ms. iOS needed 500ms)
				if(options.end > options.start) {
					options.transcriptFuture();
				}

			},

			_update: function( options ) {
				// update code, fire on update/modification of a plugin created track event.
			},

			_teardown: function( options ) {
				// teardown code, fire on removal of plugin or destruction of instance
			},

			/**
			 * @member transcript 
			 * The start function will be executed when the currentTime 
			 * of the video reaches the start time provided by the 
			 * options variable
			 */
			start: function( event, options ) {
				options.transcriptFuture();
			},

			/**
			 * @member transcript 
			 * The end function will be executed when the currentTime 
			 * of the video reaches the end time provided by the 
			 * options variable
			 */
			end: function( event, options ) {
				options.transcriptRead();
			}
		};
	})());
})( Popcorn );


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
			error: 'ha:error'
		},
		_commonMethods: {
			options: {
				DEBUG: true,
				entity: 'core'
			},
			_trigger: function(eventType, eventData) {
				var eventObject = hyperaudio.extend(true, {options: this.options}, eventData),
					event = new CustomEvent(eventType, {
						detail: eventObject,
						bubbles: true,
						cancelable: true
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

		// TMP - This fn is WIP and left in as started making code for JSONP and then put it on hold.
		jsonp: function(url, scope, callback) {
			//
			var head = document.getElementsByTagName('head')[0];
			var script = document.createElement('script');
			script.type = 'text/javascript';

			var jsonp_i = 0; // TMP - would be in scope of core code as a static.

			// Need to make the callback run in the correct scope.
			callback[jsonp_i++] = function(json) {
				callback.call(scope, data);
			};

			script.src = url;

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
		var newBlock = document.createElement('section');
		var newParagraph, prevContainer;

		newBlock.className = 'item';

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

		APP.dropped(newBlock);

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
		if ( !fxInstance ) {
			var opt = {
				time: 2000,
				color: '#000000',
				autostart: true,
				crossFade: true,
				autoplay: true
			};

			for ( var i in options ) {
				opt[i] = options[i];
			}

			video = document.querySelector('#stage-videos .active');
			fxInstance = new TransitionFade(video, opt);
		}

		return fxInstance;
	}

	function TransitionFade (video, options) {
		this.options = options;

		this.video = video;
		this.videoIncoming = document.getElementById('stage-video-' + (video.id == 'stage-video-1' ? '2' : '1'));

		this.servo = document.getElementById('fxHelper');

		this.servo.style[transition] = 'opacity 0ms';
		this.servo.style.left = '0px';
		this.servo.style.opacity = '0';
		this.servo.style.backgroundColor = this.options.color;
//		this.servo.style.left = '-9999px';

		if ( this.options.autostart ) {
			this.start();
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

	TransitionFade.prototype.start = function () {
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

		this.video.pause();

		if ( this.phase == 'fadeOut' ) {
			if ( this.options.onFadeOutEnd ) {
				this.options.onFadeOutEnd.call(this);
			}

			if ( this.options.crossFade ) {
				this.phase = 'waiting';
				this.video.className = this.video.className.replace(/(^|\s)active($|\s)/, '');
				this.videoIncoming.className += ' active';
				this.fadeIn();
			}
		} else if ( this.phase == 'fadeIn' ) {
			if ( this.options.onFadeInEnd ) {
				this.options.onFadeInEnd.call(this);
			}

			this.destroy();
		}
	};

	TransitionFade.prototype.fadeIn = function () {
		this.phase = 'fadeIn';

		this.servo.addEventListener('transitionend', this, false);
		this.servo.addEventListener('webkitTransitionEnd', this, false);
		this.servo.addEventListener('oTransitionEnd', this, false);
		this.servo.addEventListener('MSTransitionEnd', this, false);

		if ( this.options.autoplay ) {
			this.videoIncoming.play();
		}

		this.servo.style.opacity = '0';
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

		hyperaudio.api.getTranscripts(function(success) {
			if(success) {
				var elem, trans;
				for(var i = 0, l = this.transcripts.length; i < l; i++) {
					trans = this.transcripts[i];
					elem = document.createElement('li');
					elem.setAttribute('data-id', trans._id);
					elem.innerHTML = trans.label;
					self.transcripts.appendChild(elem);
				}

				self.transcripts._tap = new Tap({el: self.transcripts});
				self.transcripts.addEventListener('tap', self.selectMedia.bind(self), false);
			}
		});
	};

	SideMenu.prototype.initMusic = function () {
		var stage = this.options.stage;

		function onDragStart (e) {
			hyperaudio.addClass(stage.target, 'dragdrop');
		}

		function onDrop (el) {
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
				items[i]._dragInstance = new DragDrop({
					handle: items[i],
					dropArea: stage.target,
					draggableClass: 'draggableEffect',
					onDragStart: onDragStart,
					onDrop: onDrop
				});
			}
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
		e.stopPropagation();	// just in case

		var starter = e.target;

		if ( hyperaudio.hasClass(e.target.parentNode, 'folder') ) {
			starter = e.target.parentNode;
		}

		if ( hyperaudio.hasClass(starter, 'folder') ) {
			hyperaudio.toggleClass(starter, 'open');
			return;
		}

		if ( !starter.getAttribute('data-id') || !this.mediaCallback ) {
			return;
		}

		this.mediaCallback(starter);
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
			threshold: 10
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
			this.dragTimeout = setTimeout(this.dragStart.bind(this, e), 500);
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

		hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

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

		hyperaudio.addClass(this.words[start], 'first');
		hyperaudio.addClass(this.words[end], 'last');
	};

	WordSelect.prototype.clearSelection = function () {
		this.currentWord = null;
		this.startPosition = null;
		this.endPosition = null;

		hyperaudio.removeClass(this.element.querySelector('.first'), 'first');
		hyperaudio.removeClass(this.element.querySelector('.last'), 'last');

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
			if(this.status === 200) {
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
				api: 'http://data.hyperaud.io/',
				transcripts: 'transcripts/',
				mixes: 'mixes/',
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
		},
		callback: function(callback, success) {
			if(typeof callback === 'function') {
				callback.call(this, success);
			}
		},
		getUsername: function(callback, force) {
			var self = this;
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
							self.username = json.user.username;
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
				this.getUsername(function(success) {
					if(success && id) {
						xhr({
							url: self.options.api + (self.guest ? '' : self.username + '/') + self.options.transcripts + id,
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

				if(this.mix && this.mix._id && this.mix._id === mix._id) {
					type = 'PUT';
					id = this.mix._id;
					// Check some stuff?
				} else {
					// Check some stuff?
				}

				this.getUsername(function(success) {
					if(success && !this.guest && this.username) {
						xhr({
							url: self.options.api + self.username + '/' + self.options.mixes + id,
							type: type,
							data: JSON.stringify(mix),
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
						self.callback(callback, false);
					}
				});
			} else {
				setTimeout(function() {
					self.callback(callback, false);
				}, 0);
			}
		}
	};

}(hyperaudio));


/* Player
 *
 */

var Player = (function(window, document, hyperaudio, Popcorn) {

	function Player(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PLAYER', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			media: {
				mp4: '', // The URL of the mp4 video.
				webm:'' // The URL of the webm video.
			},
			mediaType: {
				mp4: 'video/mp4', // The mp4 mime type.
				webm:'video/webm' // The webm mime type.
			},

			guiNative: false, // TMP during dev. Either we have a gui or we are chomeless.

			gui: false, // True to add a gui
			cssClassPrefix: 'hyperaudio-player-', // Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.videoElem = null;
		this.sourceElem = null;
		this.timeout = {};
		this.commandsIgnored = /ipad|iphone|ipod|android/i.test(window.navigator.userAgent);
		this.gui = null;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

		if(this.target) {
			this.create();
		}
	}

	Player.prototype = {
		create: function() {
			var self = this;

			if(this.target) {
				this.videoElem = document.createElement('video');
				this.videoElem.controls = this.options.guiNative; // TMP during dev. Either we have a gui or we are chomeless.
/*
				this.sourceElem = {
					mp4: document.createElement('source'),
					webm: document.createElement('source')
				};
*/
				// Add listeners to the video element
				this.videoElem.addEventListener('progress', function(e) {
					if(this.readyState > 0) {
						this.commandsIgnored = false;
					}
				}, false);

				// Clear the target element and add the video
				this.target.innerHTML = '';
				// this.videoElem.appendChild(this.sourceElem.mp4);
				// this.videoElem.appendChild(this.sourceElem.webm);
				this.target.appendChild(this.videoElem);

				if(this.options.gui) {
					this.addGUI();
					this.addGUIListeners();
				}
				if(this.options.media.mp4) { // Assumes we have the webm
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUI: function() {
			var self = this;
			if(this.target) {
				this.gui = {
					container: this.target, // To add a class to the player target
					gui: document.createElement('div'),
					controls: document.createElement('div'),
					play: document.createElement('a'),
					pause: document.createElement('a')
				};

				// Add a class to each element
				hyperaudio.each(this.gui, function(name) {
					hyperaudio.addClass(this, self.options.cssClassPrefix + name);
				});

				// Add listeners to controls
				this.gui.play.addEventListener('click', function(e) {
					e.preventDefault();
					self.play();
				}, false);
				this.gui.pause.addEventListener('click', function(e) {
					e.preventDefault();
					self.pause();
				}, false);
/*
				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				}, false);
*/
				// Hide the pause button
				this.gui.pause.style.display = 'none';

				// Build the GUI structure
				this.gui.gui.appendChild(this.gui.controls);
				this.gui.controls.appendChild(this.gui.play);
				this.gui.controls.appendChild(this.gui.pause);
				this.target.appendChild(this.gui.gui);
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUIListeners: function() {
			var self = this;
			if(this.gui) {
				// Add listeners to the video element
				this.videoElem.addEventListener('ended', function(e) {
					self.gui.play.style.display = '';
					self.gui.pause.style.display = 'none';
				}, false);

			} else {
				this._error('GUI not used: gui = ' + this.options.gui);
			}
		},
		load: function(media) {
			var self = this;
			if(media) {
				this.options.media = media;
			}
			if(this.videoElem && typeof this.options.media === 'object') {
				this.killPopcorn();

				// Remove any old source elements
				this.sourceElem = {};
				while(this.videoElem.firstChild) {
					this.videoElem.removeChild(this.videoElem.firstChild);
				}

				// Setup to work with mp4 and webm property names. See options.
				hyperaudio.each(this.options.media, function(format, url) {
					var source = self.sourceElem[format] = document.createElement('source');
					source.setAttribute('type', self.options.mediaType[format]);
					source.setAttribute('src', url); // Could use 'this' but less easy to read.
					self.videoElem.appendChild(source);
				});

				this.videoElem.load();

				this.initPopcorn();
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
		play: function(time) {
			if(this.gui) {
				this.gui.play.style.display = 'none';
				this.gui.pause.style.display = '';
			}
			this.currentTime(time, true);
		},
		pause: function(time) {
			if(this.gui) {
				this.gui.play.style.display = '';
				this.gui.pause.style.display = 'none';
			}
			this.videoElem.pause();
			this.currentTime(time);
		},
		currentTime: function(time, play) {
			var self = this,
				media = this.videoElem;

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
		}
	};

	return Player;
}(window, document, hyperaudio, Popcorn));


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

			media: {},

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
		if(this.options.id) {
			this.load();
		}
	}

	Transcript.prototype = {
		// load: function(transcript) {
		load: function(id) {
			var self = this;

			this.ready = false;

			if(id) {
				this.options.id = id;
			}
/*
			if(transcript) {
				if(transcript.src) {
					this.options.src = transcript.src;
				}
				if(transcript.video) {
					this.options.video = transcript.video;
				}
			}
*/
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
/*
				xhr({
					url: this.options.src,
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
*/
			}
		},

		setVideo: function() {
			var self = this;

			// Setup the player
			if(this.options.player && hyperaudio.api.transcript) {
				var hapi = hyperaudio.api,
					path = hapi.options.api + hapi.transcript.media.owner + '/' + hapi.transcript.media.meta.filename;
				this.options.media = {
						mp4: path,
						webm: path.replace(/\.mp4$/, '.webm') // Huge assumption!
					};
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
						opts.player.currentTime(time);
					}
				}, false);
			}

			this.selectorize();
		},

		selectorize: function() {

			var self = this,
				opts = this.options;

			if(opts.stage) {

				// Destroy any existing WordSelect.
				this.deselectorize();

				this.textSelect = new WordSelect({
					el: opts.target,
					onDragStart: function(e) {
						hyperaudio.addClass(opts.stage.target, opts.stage.options.dragdropClass);
						var dragdrop = new DragDrop({
							dropArea: opts.stage.target,
							init: false,
							onDrop: function(el) {
								self.textSelect.clearSelection();
								this.destroy();

								if ( !el ) {
									return;
								}

								el.setAttribute(opts.stage.options.idAttr, opts.id); // Pass the transcript ID
								el.setAttribute(opts.stage.options.mp4Attr, opts.media.mp4); // Pass the transcript mp4 url
								el.setAttribute(opts.stage.options.webmAttr, opts.media.webm); // Pass the transcript webm url
								el.setAttribute(opts.stage.options.unitAttr, opts.unit); // Pass the transcript Unit
								opts.stage.dropped(el);
							}
						});

						var html = this.getSelection().replace(/ class="[\d\w\s\-]*\s?"/gi, '') + '<div class="actions"></div>';
						dragdrop.init(html, e);
					}
				});
				this.ready = true;
				this._trigger(hyperaudio.event.ready);
			}
		},

		deselectorize: function() {
			if(this.textSelect) {
				this.textSelect.destroy();
			}
			delete this.textSelect;
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

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'STAGE', // Not really an option... More like a manifest

			target: '#stage', // The selector of element for the staging area.

			id: '', // The ID of the saved mix.

			title: 'Test from hyperaudio.stage.js',
			desc: 'Testing initial save system',
			type: 'beta',

			idAttr: 'data-id', // Attribute name that holds the transcript ID.
			mp4Attr: 'data-mp4', // Attribute name that holds the transcript mp4 URL.
			webmAttr: 'data-webm', // Attribute name that holds the transcript webm URL.
			unitAttr: 'data-unit', // Attribute name that holds the transcript Unit.

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

		this.target.appendChild(this.article);

		if(this.options.DEBUG) {
			this._debug();
		}

		if(this.options.projector) {
			this.options.projector.setStage(this);
		}

		if(this.options.id) {
			this.load();
		}
	}

	Stage.prototype = {
		mixDetails: function(details) {
			// [SHOULD] only really used to set the lebel, desc and type of the mix being saved.
			hyperaudio.extend(this.options, details);
		},
		load: function(id) {
			var self = this;

			if(id) {
				this.options.id = id;
			}

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				// hyperaudio.api.guest = false;
				// hyperaudio.api.username = 'tester';

				hyperaudio.api.getMix(id, function(success) {
					if(success) {
						self.mix = hyperaudio.extend({}, this.mix);

						// Need to maintain the existing article in the stage - Important for dragdrop.
						var tmp = document.createElement('div'); // Temporary DOM element
						tmp.innerHTML = self.mix.content; // Add the content to the DOM element
						var articleElem = tmp.querySelector('article'); // Find the article in the content.
						// Can now insert the contents of the returned mix article into the maintained article.
						self.article.innerHTML = articleElem.innerHTML;

						// TODO: Should also clear any existing attributes on the article.

						// Now copy over any attributes
						var attr = articleElem.attributes;
						for(var i=0, l=attr.length; i < l; i++ ) {
							self.article.setAttribute(attr[i].name, attr[i].value);
						}

						// Setup the dragdrop on the loaded mix sections.
						self.initDragDrop();
						self._trigger(hyperaudio.event.load, {msg: 'Loaded mix'});
					} else {
						self._error(this.status + ' ' + this.statusText + ' : "' + url + '"');
					}
				});
			}
			// Would then need to init the dragdrop ability on each item
		},

		save: function() {
			// Save the staged production

			var self = this;

			hyperaudio.extend(this.mix, {
				label: this.options.title,
				desc: this.options.desc,
				meta: {},
				sort: 999,
				type: this.options.type,
				content: this.target.innerHTML
			});

			if(this.target) {

				// Fudge the user system since getUsername nay works.
				// hyperaudio.api.guest = false;
				// hyperaudio.api.username = 'tester';

				hyperaudio.api.putMix(this.mix, function(success) {
					if(success) {
						self.mix = hyperaudio.extend({}, this.mix);
						self._trigger(hyperaudio.event.save, {msg: 'Saved mix'});
					} else {
						self._error(this.status + ' ' + this.statusText + ' : "' + url + '"');
					}
				});
			}
		},

		clear: function() {
			// TODO: Should also clear any existing attributes on the article.
			this.article.innerHTML = '';
			this.mix = {};
			this.options.id = '';
		},

		parse: function() {
			var self = this,
				opts = this.options;

			// Will need the popcorn.transcript highlighting as per the source transcripts.
		},

		initDragDrop: function() {
			var self = this,
				i, l, sections;
			if(this.target) {
				sections = this.target.getElementsByTagName('section');
				l = sections.length;
				for(i=0; i < l; i++) {
					self.dropped(sections[i]);
				}
			}
		},

		dropped: function(el, html) {
			var self = this;
			var actions;
			var draggableClass = '';

			var editBlock = function (e) {
				e.stopPropagation();
				this.parentNode._editBlock = new EditBlock({el: this.parentNode});
			};

			if(this.target) {
				hyperaudio.removeClass(this.target, this.options.dragdropClass);

				// add edit action if needed
				if ( !(/(^|\s)effect($|\s)/.test(el.className)) ) {
					actions = el.querySelector('.actions');
					actions._tap = new Tap({el: actions});
					actions.addEventListener('tap', editBlock, false);
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
					}
				});
			}
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

	function Projector(options) {

		this.options = hyperaudio.extend({}, this.options, {

			entity: 'PROJECTOR', // Not really an option... More like a manifest

			target: '#transcript-video', // The selector of element where the video is generated

			// media: {}, // The URL of the video.

			tPadding: 1, // (Seconds) Time added to end word timings.

			players: 1, // Number of Players to use. Mobile: 1, Desktop: 2.

			unit: 0.001, // Unit used if not given in section attr of stage.

			gui: true, // True to add a gui.
			cssClassPrefix: 'hyperaudio-player-', // (See Player.addGUI) Prefix of the class added to the GUI created.
			async: true // When true, some operations are delayed by a timeout.
		}, options);

		// Properties
		this.target = typeof this.options.target === 'string' ? document.querySelector(this.options.target) : this.options.target;
		this.stage = null;
		// this.timeout = {};

		this.player = [];
		this.media = [];
		this.current = {};
		this.gui = null;

		// State Flags
		this.paused = true;

		if(this.options.DEBUG) {
			this._debug();
		}

		// Probably want a media object, instead of a single SRC

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

				// Making it work with a single player. Will dev 2 later.

				var manager = function(event) {
					self.manager(event);
				};

				for(var i = 0; i < this.options.players; i++ ) {
					var player = document.createElement('div');
					this.player[i] = hyperaudio.Player({
						target: player
					});

					this.player[i].videoElem.addEventListener('timeupdate', manager, false);

					this.target.appendChild(player);
				}

				if(this.options.gui) {
					this.addGUI();
				}
				if(this.options.media) {
					this.load();
				}
			} else {
				this._error('Target not found : ' + this.options.target);
			}
		},
		addGUI: Player.prototype.addGUI,
		load: function(media) {
			var self = this;
			if(media) {
				this.options.media = media;
			}
			this.media[0] = this.options.media;

			if(this.player[0]) {
				this.player[0].load(this.media[0]);
			} else {
				this._error('Video player not created : ' + this.options.target);
			}
		},
		play: function() {

			// ATM, we always play fromm the start.

			if(this.stage && this.stage.target) {
				// Get the staged contents wrapper elem
				this.stageArticle = this.stage.target.getElementsByTagName('article')[0];

				// Get the sections
				this.current.sections = this.stageArticle.getElementsByTagName('section');

				this.setCurrent(0);

				this.paused = false;

				this.load(this.current.media);
				this._play(this.current.start);

			} else {
				this.paused = true;
			}
		},
		pause: function() {
			this.paused = true;
			this._pause();
		},
		_play: function(time) {
			if(this.gui) {
				this.gui.play.style.display = 'none';
				this.gui.pause.style.display = '';
			}
			this.player[0].play(time);
		},
		_pause: function(time) {
			if(this.gui) {
				this.gui.play.style.display = '';
				this.gui.pause.style.display = 'none';
			}
			this.player[0].pause(time);
		},
		currentTime: function(time, play) {
			this.player[0].currentTime(time, play);
		},
		setCurrent: function(index) {
			this.current.index = index;

			// Get the first section
			this.current.section = this.current.sections[this.current.index];

			// Get the ID
			this.current.id = this.current.section.getAttribute(this.stage.options.idAttr);

			// Get the media
			this.current.media = {
				mp4: this.current.section.getAttribute(this.stage.options.mp4Attr),
				webm: this.current.section.getAttribute(this.stage.options.webmAttr),
			};

			var unit = 1 * this.current.section.getAttribute(this.stage.options.unitAttr);
			this.current.unit = unit = unit > 0 ? unit : this.options.unit;

			// Still have attributes hard coded in here. Would need to pass from the transcript to stage and then to here.
			var words = this.current.section.getElementsByTagName('a');
			this.current.start = words[0].getAttribute('data-m') * unit;
			this.current.end = words[words.length-1].getAttribute('data-m') * unit;
		},
		manager: function(event) {
			var self = this;

			if(!this.paused) {
				if(this.player[0].videoElem.currentTime > this.current.end + this.options.tPadding) {
					// Goto the next section

					if(++this.current.index < this.current.sections.length) {
						this.setCurrent(this.current.index);

						this.load(this.current.media);
						this._play(this.current.start);
					} else {
						this.current.index = 0;

						this.paused = true;
						this._pause();
					}
				}
			}
		}
	};

	return Projector;
}(window, document, hyperaudio, Popcorn));


hyperaudio.register('Player', Player);
hyperaudio.register('Transcript', Transcript);
hyperaudio.register('Stage', Stage);
hyperaudio.register('Projector', Projector);


hyperaudio.utility('api', api); // obj
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
