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
		{uuid:'A495BB60-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB70-C5B1-4B44-B512-1370F02D74DE'},
		{uuid:'A495BB80-C5B1-4B44-B512-1370F02D74DE'}

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
			// Only show beacons that are updated during the last 120 seconds.
			if (beacon.timeStamp + 120000 > timeNow)
			{
				// correct RSSI value when unknown.
				var rssiCorrected = -100; // Used when RSSI is zero or greater.
				if (beacon.rssi < -100) { rssiCorrected = -100; }
				else if (beacon.rssi < 0) { rssiCorrected = beacon.rssi; }
				
				var date = new Date(beacon.timeStamp);
				var dateFormatted = date.toLocaleString();

				// Map the temperature to a width in percent for the indicator.
				var tempWidth = beacon.major/185*100;
                //Convert to degrees celsius
				var TempC = (beacon.major - 32) * 5 / 9;
				var TempC1 = TempC.toFixed(1);


				// Convert SG units and map the specific gravity to a width in percent for the indicator.
				var sgStandardUnits = beacon.minor/1000;
				var sgFix3 = sgStandardUnits.toFixed(3);
				
                var sgWidth = 1; // Used when SG is less than 990.
				if (beacon.minor > 1120) { sgWidth = 100; }
				else if (beacon.minor < 990) { sgWidth = 1; }
				else { sgWidth = (beacon.minor-990)/130*100; }
				
				//corrected SG calc (divide by 7 to compensate for expansion of brewtainer)
				var sgCorrection = (-0.000000006130*beacon.major*beacon.major*beacon.major + 0.000002934888*beacon.major*beacon.major - 0.000199630555*beacon.major + 0.002825186384) / 20;
				var sgCorrection3 = sgCorrection.toFixed(3);
				var sgCorrected = Number(sgCorrection3) + Number(sgFix3);
				var sgCorrected3 = sgCorrected.toFixed(3);

				//convert sg to plato
				var degP = 259-(259/sgCorrected3);
				var degP1 = degP.toFixed(1);

                //time since last update
                var lastUpdated = (timeNow - beacon.timeStamp)/1000;
                var lastUpdated1 = lastUpdated.toFixed(1);

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
				 "a495bb60-c5b1-4b44-b512-1370f02d74de",
				 "A495BB70-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb70-c5b1-4b44-b512-1370f02d74de",
				 "A495BB80-C5B1-4B44-B512-1370F02D74DE",
				 "a495bb80-c5b1-4b44-b512-1370f02d74de"];
				 var brewVariety = ["RED","RED","GREEN","GREEN", "BLACK","BLACK","PURPLE","PURPLE","ORANGE","ORANGE","BLUE","BLUE","YELLOW","YELLOW","PINK","PINK"];

				 for(var i=0; i<brewArray.length; i++) {
                 if (brewUUID == brewArray[i]){
                 var brewVarietyValue = brewVariety[i];
				 }
			    }
				// Create tag to display beacon data.
				var element = $(
					'<li>'
					//+	'<strong>UUID: ' + beacon.uuid + '</strong><br />'
					+	'<strong>BREWOMETER | ' + brewVarietyValue + '</strong><br />'
					+ 	'<div style="background:' + brewVarietyValue + ';height:40px;width:'
					+ 		100 + '%;"></div>'
					+	'Specific Gravity:<br /><h1>' + sgCorrected3 + '</h1>'
					+ 	'<div style="background:' + brewVarietyValue + ';height:10px;width:'
					+ 		sgWidth + '%;"></div>'
					+	'Temperature:<br /><h1>' + beacon.major + '°F</h1><h7>' + TempC1 + '°C</h7>'
					+ 	'<div style="background:' + brewVarietyValue + ';height:10px;width:'
					+ 		tempWidth + '%;"></div>'
					+	'<h2>' + dateFormatted + '<br />' +'Received ' + lastUpdated1 +' seconds ago ' + rssiCorrected + ' dBm</h2>'
					//+	'Proximity: ' + beacon.proximity + '<br />'
					+ '</li>'
				);

				$('#warning').remove();
				$('#found-beacons').append(element);
			    
                //post to google docs every 1000 sec
                var tZoneDays = date.getTimezoneOffset()/60/24;
                var t = timeNow/1000/60/60/24 + 25569 - tZoneDays;
                //var res = t.substr(t.length-6,3);
                //var brewName = $('#' + brewVarietyValue).val();
                
                var brewURL = $('#cloudURL').val();
                var brewCheck = $('#checkCloud:checked').val();
                var n = $('#found-beacons').length;
                

                if (brewCheck) {
                if (timeNow - setTimer > 100) {
                $.post(brewURL, { SG: sgCorrected3, Temp: beacon.major, Color: brewVarietyValue, Timepoint: "=to_date(" + t + ")" } );
                displayRefresh++;
                console.log(displayRefresh);
                if (displayRefresh > n){
                setTimer += 900000;
                displayRefresh = 0;
                    }
                  }
                }
                else {setTimer = Date.now();}
                
			}
		});
	}

	var setTimer = Date.now();
    var displayRefresh = 0;

	return app;
})();

app.initialize();
