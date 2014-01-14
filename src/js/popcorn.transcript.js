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
