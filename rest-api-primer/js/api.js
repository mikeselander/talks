/*
 *	Start off with our call.
 *
 * We're going to make our js call and if it works, clean out the data, fill
 * in the slides HTML using Underscores, and then loop through all of our <code>
 * tags and call for an API response to fill in JSON responses.
 *
 * After all of that, we activate Reveal to work its magic.
 */
get( 'http://mikeselander.com/wp-json/wp/v2/slides?per_page=100&filter[orderby]=menu_order&filter[order]=ASC' ).then(function( result ) {

	// Clean out unneeded JSON data
	cleanJson = cleanData( JSON.parse( result ) );

	// Make our HTML with Underscores
    handleTemplate( cleanJson );

    // Loop through all the <code> tags and try to get data
    loop_code_calls();

}).then(function() {

	// Run Reveal
	triggerReveal();

});


/*
 *	Make a call to the WP REST API for our posts & return the data as a Promise object
 *
 * string url
 */
function get(url) {
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url);

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.response);
      }
      else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(Error(req.statusText));
      }
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    };

    // Make the request
    req.send();
  });

}


/*
 * Loop through our data and clean/append to it.
 *
 * Remove unnecessary data from each JSON return. Then, check to see if it has
 * a parent ID. If it does, assign it as a subslide object to the parent and
 * assign a flag so that Underscores doesn't make a main slide.
 */
function cleanData( json ){

	// Get the length once
	arrayLength = json.length;

	for (var i = 0; i < arrayLength; i++){

		// Remove unnecessary data
		delete json[i]['date'];
		delete json[i]['date_gmt'];
		delete json[i]['guid'];
		delete json[i]['modified'];
		delete json[i]['modified_gmt'];
		delete json[i]['link'];
		delete json[i]['slug'];
		delete json[i]['type'];
		delete json[i]['_links'];

		// If it doesn't already have subslides, assign a value for the flag
		if ( json[i]['subslidesExist'] != true ){
			json[i]['subslidesExist'] = false;
		}

		// If we have a parent ID, assign as a subslide to the parent.
		if ( json[i]['parent'] != '0' ){

			var parentArrayId = findParentObject( json, json[i]['parent'] );
			json[parentArrayId]['subslidesExist'] = true;

			// Check to see if we're dealing with an existing array
			if ( json[parentArrayId]['subslides'] != undefined ){

				// Find the current place in the array so we can add the next value
				var count = Object.keys( json[parentArrayId]['subslides'] ).length;

				// Add our item in the proper place
				json[parentArrayId]['subslides'][count] = json[i];

			} else {

				json[parentArrayId]['subslides'] = new Object();
				json[parentArrayId]['subslides'][0] = json[i];

			}

			// Set a flag that this particular item is to be skipped
			json[i]['Exists'] = false;

		} else {

			json[i]['Exists'] = true;

		}

		// Log the data if someone decides to check out the source
		console.log( json[i] );

	}

	return json;

}


/*
 * Get the array index of the parent slide and return.
 */
function findParentObject( json, parent ){

	arrayLength = json.length;

	for (var i = 0; i < arrayLength; i++){

		if ( json[i]['id'] == parent ){
			var parentArrayId = i;
			break;
		}

	}

	return parentArrayId;

}


/*
 * Run through the Underscores template functions and trigger __.
 */
function handleTemplate( json ){

	// Fetch our template
	var templateHtml = document.getElementById('slides_template');

	if ( templateHtml != undefined ){

		// Start our template
		var template = _.template(
			templateHtml.innerHTML
		);

		// Log the slide data for anyone peeking
		var slides = json;
		console.log( slides );

		// Build the HTML using __
		document.getElementById('slides').innerHTML = template( { 'slides' : slides } );

	}

}


/*
 * Initialize and register Reveal.js.
 */
function triggerReveal(){

	// Full list of configuration options available at:
	// https://github.com/hakimel/reveal.js#configuration
	Reveal.initialize({
		controls: true,
		progress: true,
		history: true,
		center: true,

		transition: 'slide', // none/fade/slide/convex/concave/zoom

		// Optional reveal.js plugins
		dependencies: [
			{ src: 'lib/js/classList.js', condition: function() { return !document.body.classList; } },
			{ src: 'plugin/highlight/highlight.js', async: true, condition: function() { return !!document.querySelector( 'pre code' ); }, callback: function() { hljs.initHighlightingOnLoad(); } },
			{ src: 'plugin/zoom-js/zoom.js', async: true },
		]
	});

	// On a slide being changed, modify the API output on the bottom of the set
	Reveal.addEventListener( 'slidechanged', function( event ) {

	    var current = document.getElementsByClassName( 'present' );
		var pid = event.currentSlide.attributes['data-id'].nodeValue;

		// If we're on the first slide, show the set call
		if ( pid != 429 ){
			document.getElementById( 'call' ).innerHTML = 'wp-json/wp/v2/slides/' + pid;

		// Else, if we're on another slide, show an individual call
		} else {
			//document.getElementById( 'call' ).innerHTML = 'wp-json/wp/v2/slides?filter[orderby]=menu_order&filter[order]=ASC';
			document.getElementById( 'call' ).innerHTML = 'wp-json/wp/v2/slides/?orderby=menu_order&order=ASC';
		}

	} );

	// Trigger a resize to fix random initial load sizing bug
	Reveal.addEventListener( 'ready', function( event ) {
		window.dispatchEvent(new Event('resize'));
	});

}


/*
 * Try to fetch the data form the contents of <code> tag and if it works, print the JSON output.
 */
function fill_in_code_calls( value ){

	// Get the HTML
	var thisItem = value,
		call = thisItem.innerHTML;

	// Trim the <code> tags
	call = call.replace(/<code>/i, '').replace(/<\/code>/i, '');

	// Print the JSON result if it works.
	get( call ).then(function(result){
		thisItem.innerHTML += '<code>' + syntaxHighlight(result) + '</code>';
	});

}


/*
 * Loop through all of the <pre> tags in the document & call our data function.
 */
function loop_code_calls(){

	// Find all instaces of <code>
	var blocks	= document.getElementsByTagName("pre");

	arrayLength = blocks.length;

	// Loop and try to fetch the data
	for (var i = 0; i < arrayLength; i++){
		fill_in_code_calls( blocks[i] );
	}

}


/*
 * Apply tabbing & newlines to JSON.
 *
 * from http://stackoverflow.com/questions/4810841/how-can-i-pretty-print-json-using-javascript
 */
function syntaxHighlight(json) {
    if (typeof json == 'string') {
         json = JSON.stringify(JSON.parse(json), undefined, 2);
    } else {
	    json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return match;
    });
}