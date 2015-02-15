function getUrlVars() {
	var vars = {};
	var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
		vars[key] = decodeURIComponent(value).trim();
	});
	return vars;
}

// Determine if this is a new game or should be resumed
var gid = null;
if(getUrlVars()['rid'] != ''){
    gid = getUrlVars()['rid'];
    $(".game .game-id").html(gid);
    $(".game #debug-gid").html(gid);

    // Connect the websocket
    var ws = new WebSocket("ws://" + window.config.apiUrl + "/ws?id=" + gid);

    // Update URL with game ID
    history.replaceState("game.html?rid=" + gid);
} else {
    var ws = new WebSocket("ws://" + window.config.apiUrl + "/ws");
}

var players = [];
var myid = null;

// cache the last location
var lastLocation = null;

// message handler
ws.onmessage = function (event) {
    var j = JSON.parse(event.data);
    console.log(j);
    
    var e = j.event;
    if(e == "dopong") {
        // Do Thing
        myid = j.data.youid;
        players = j.data.players;
        gid = j.data.gameid;

        // Update the history
        history.replaceState("game.html?rid=" + gid);

        // update game id
        $(".game .game-id").html(gid);
        $(".game #debug-gid").html(gid);

        // update list
        updatePlayerList();       
    } else if(e == "playerjoin") {
        players.push(j.data);

        // update list
        updatePlayerList();
    }
}

/**
 * Update the player list
 */
function updatePlayerList() {
    // clear list
    $(".game .players").html("");

    // render all players
    for(i = 0; i < players.length; i++) {
        var player = players[i];

        // calculate the distance from us pls
        var distances = findDistance(player.lat, player.lon, 
            lastLocation.coords.latitude, lastLocation.coords.longitude);

        // render differently if this is the current player or nah
        if(i == myid) {
            var s = '<li class="list-group-item" data-pid="' + player.pid + '">';
            s += '<span class="badge">' + distances.km * 1000 + 'm</span>';
            s += '<span style="color:' + player.color + '">' + player.name+' (you)</span></li>';
        } else {
            var s = '<li class="list-group-item" data-pid="' + player.pid + '">';
            s += '<span class="badge">' + distances.km * 1000 + 'm</span>';
            s += '<span style="color:' + player.color + '">' + player.name+'</span></li>';
        }
        
        // append to list
        $(".game .players").append(s);
    }
}

// various location stuff
var watchID = null;

// Sign up for location updates
$(document).ready(function() {
    watchID = navigator.geolocation.watchPosition(locationUpdated, locationError, 
        { timeout: 15000, enableHighAccuracy: true });
});

// Stop location updates when the page is unloaded
$(document).unload(function() {
    navigator.geolocation.clearWatch(watchID);
});

// The location has updated
function locationUpdated(position) {
    console.log(position);

    // Send our location
    ws.send(JSON.stringify({
        event: "updateloc",
        data: {
            lon: position.coords.longitude,
            lat: position.coords.latitude,
            alt: position.coords.altitude,
            accuracy: position.coords.accuracy,
            pid: myid,

            device: {
                uuid: device.uuid,

                name: device.model,
                platform: device.platform,
                version: device.version
            }
        }, 
        gid: gid
    }));

    // cache the location
    lastLocation = position;

    // Update the debug information
    $(".game #debug-pos").html("(" + position.coords.latitude + ", " + position.coords.longitude + ")");
    $(".game #debug-altitude").html(position.coords.altitude + " m");
    $(".game #debug-accuracy").html(position.coords.accuracy + " m");

    // hide the alert, if it's visible
    $(".game .alert-location-invalid").fadeOut(window.config.fadeLength);
    $(".game .alert-location-error").fadeOut(window.config.fadeLength);
}

// An error occurred while getting the location.
function locationError(error) {
    console.error(error);

    // handle the error
    if(error.code == PositionError.PERMISSION_DENIED) {
        alert("To use Ping, you need to allow the application to use your location.");
        navigator.geolocation.clearWatch(watchID);
    } else if(error.code == PositionError.POSITION_UNAVAILABLE) {
        // Show an UI indicator
        $(".game .alert-location-invalid").fadeIn(window.config.fadeLength);
    } else {
        $(".game .alert-location-error p:first-child").html(error.message);
        $(".game .alert-location-error").fadeIn(window.config.fadeLength);
    }

    // Update debug
    $(".game #debug-error").html(error.message + "(" + error.code + ")");
}

function ping(){
    ws.send(JSON.stringify({"event":"doping", "data":{"pid":myid}, "gid":gid}))   
}