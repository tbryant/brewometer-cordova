var app = (function()
{
	// Application object.
	var app = {};

	// Specify your beacon 128bit UUIDs here.
	var regions =
	[
		{uuid:'A495BB10-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB20-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB30-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB40-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB50-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB60-C5B1-4B44-B512-1370F02D74DE'}

	];

	// Dictionary of beacons.
	var beacons = {};

	// Timer that displays list of beacons.
	var updateTimer = null;

	app.initialize = function()
	{
		document.addEventListener('deviceready', onDeviceReady, false);
	};

	function onDeviceReady()
	{
		// Specify a shortcut for the location manager holding the iBeacon functions.
		window.locationManager = cordova.plugins.locationManager;

		// Start tracking beacons!
		startScan();

		// Display refresh timer.
		updateTimer = setInterval(displayBeaconList, 500);
	}

	function startScan()
	{
		// The delegate object holds the iBeacon callback functions
		// specified below.
		var delegate = new locationManager.Delegate();

		// Called continuously when ranging beacons.
		delegate.didRangeBeaconsInRegion = function(pluginResult)
		{
			//console.log('didRangeBeaconsInRegion: ' + JSON.stringify(pluginResult))
			for (var i in pluginResult.beacons)
			{
				// Insert beacon into table of found beacons.
				var beacon = pluginResult.beacons[i];
				beacon.timeStamp = Date.now();
				var key = beacon.uuid; //+ ':' + beacon.major + ':' + beacon.minor;
				beacons[key] = beacon;

			}
		};

		// Called when starting to monitor a region.
		// (Not used in this example, included as a reference.)
		delegate.didStartMonitoringForRegion = function(pluginResult)
		{
			//console.log('didStartMonitoringForRegion:' + JSON.stringify(pluginResult))
		};

		// Called when monitoring and the state of a region changes.
		// (Not used in this example, included as a reference.)
		delegate.didDetermineStateForRegion = function(pluginResult)
		{
			//console.log('didDetermineStateForRegion: ' + JSON.stringify(pluginResult))
		};

		// Set the delegate object to use.
		locationManager.setDelegate(delegate);

		// Request permission from user to access location info.
		// This is needed on iOS 8.
		locationManager.requestAlwaysAuthorization();

		// Start monitoring and ranging beacons.
		for (var i in regions)
		{
			var beaconRegion = new locationManager.BeaconRegion(
				i + 1,
				regions[i].uuid);

			// Start ranging.
			locationManager.startRangingBeaconsInRegion(beaconRegion)
				.fail(console.error)
				.done();

			// Start monitoring.
			// (Not used in this example, included as a reference.)
			locationManager.startMonitoringForRegion(beaconRegion)
				.fail(console.error)
				.done();
		}
	}
	function displayBeaconList()
	{
		// Clear beacon list.
		$('#found-beacons').empty();

		var timeNow = Date.now();

		// Update beacon list.
		$.each(beacons, function(key, beacon)
		{
			// Only show beacons that are updated during the last 60 seconds.
			if (beacon.timeStamp + 60000 > timeNow)
			{
				// Map the RSSI value to a width in percent for the indicator.
				var rssiWidth = 1; // Used when RSSI is zero or greater.
				if (beacon.rssi < -100) { rssiWidth = 100; }
				else if (beacon.rssi < 0) { rssiWidth = 100 + beacon.rssi; }
				
				var date = new Date(beacon.timeStamp);

				// Map the temperature to a width in percent for the indicator.
				var tempWidth = beacon.major/185*100;


				// Convert SG units and map the specific gravity to a width in percent for the indicator.
				var sgStandardUnits = beacon.minor/1000;
				var sgFix3 = sgStandardUnits.toFixed(3);
				
                var sgWidth = 1; // Used when SG is less than 990.
				if (beacon.minor > 1120) { sgWidth = 100; }
				else if (beacon.minor < 990) { sgWidth = 1; }
				else { sgWidth = (beacon.minor-990)/130*100; }
				
				//corrected SG calc (divide by 7 to compensate for expansion of brewtainer)
				var sgCorrection = (-0.000000006130*beacon.major*beacon.major*beacon.major + 0.000002934888*beacon.major*beacon.major - 0.000199630555*beacon.major + 0.002825186384) / 7;
				var sgCorrection3 = sgCorrection.toFixed(3);
				var sgCorrected = Number(sgCorrection3) + Number(sgFix3);
				var sgCorrected3 = sgCorrected.toFixed(3);

				var sgCorrWidth = sgCorrection3*100+1;

				var brewUUID = beacon.uuid;
				var brewArray = 
				["A495BB10-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb10-c5b1-4b44-b512-1370f02d74de",
				 "A495BB20-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb20-c5b1-4b44-b512-1370f02d74de",
				 "A495BB30-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb30-c5b1-4b44-b512-1370f02d74de",
				 "A495BB40-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb40-c5b1-4b44-b512-1370f02d74de",
				 "A495BB50-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb50-c5b1-4b44-b512-1370f02d74de",
				 "A495BB60-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb60-c5b1-4b44-b512-1370f02d74de"];
				 var brewVariety = ["RED","RED", "GREEN","GREEN", "BLACK","BLACK", "PURPLE", "PURPLE", "ORANGE", "ORANGE", "BLUE", "BLUE"];

				 for(var i=0; i<brewArray.length; i++) {
                 if (brewUUID == brewArray[i]){
                 var brewVarietyValue = brewVariety[i];
				 }
			    }
				// Create tag to display beacon data.
				var element = $(
					'<li>'
					//+	'<strong>UUID: ' + beacon.uuid + '</strong><br />'
					+	'<strong>BREWOMETER | ' + brewVarietyValue + '</strong><br />'//<br />'
					+ 	'<div style="background:' + brewVarietyValue + ';height:40px;width:'
					+ 		100 + '%;"></div>'
					+	'Specific Gravity (cal. @68°F):<br /><h1>' + sgCorrected3 + '</h1>'
					+ 	'<div style="background:' + brewVarietyValue + ';height:10px;width:'
					+ 		sgWidth + '%;"></div>'
					+	'Temperature:<br /><h1>' + beacon.major + '°F</h1>'
					+ 	'<div style="background:' + brewVarietyValue + ';height:10px;width:'
					+ 		tempWidth + '%;"></div>'
		            +	'Signal Strength:<br /><h1>' + rssiWidth + '%</h1>'
					+ 	'<div style="background:' + brewVarietyValue + ';height:10px;width:'
					+ 		rssiWidth + '%;"></div>'
					+	'<h4>' + date + '</h4>'
					//+	'Proximity: ' + beacon.proximity + '<br />'
					+ '</li>'
				);

				$('#warning').remove();
				$('#found-beacons').append(element);
			    
                //post to google docs every 100
                var t = timeNow.toString();
                var res = t.substr(t.length-6,3);
                console.log(res);
                if (res == "999") {
                $.post( "https://script.google.com/macros/s/AKfycbwBf_VQ5_J1bYYr9XBAtoTBZ3O6bZ2KtSkXh9Kxyl5MIpsadvQ/exec", { SG: sgCorrected3, Temp: beacon.major, Color: brewVarietyValue, Name: "beer name" } );

               }

                
			}
		});
	}

	return app;
})();

app.initialize();