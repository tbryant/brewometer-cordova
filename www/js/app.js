// Dom7
var $$ = Dom7;

// Framework7 App main instance
var app  = new Framework7({
  root: '#app', // App root element
  id: 'com.baronbrew.tilthydrometer', // App bundle ID
  name: 'Tilt Hydrometer', // App name
  theme: 'auto', // Automatic theme detection
  statusbar: {
      iosOverlaysWebView: true,
      enabled: true,

  },
  // App root data
  data: function () {
    return {
      user: {
        firstName: 'John',
        lastName: 'Doe',
      },
    };
  },
  // App root methods
  methods: {
    helloWorld: function () {
      app.dialog.alert('Hello World!');
    },
  },
  // App routes
  routes: routes,
});

// Init/Create main view
var mainView = app.views.create('.view-main', {
  url: '/'
});

var displayTemplate = $$('#displaytemplate').html();
var compileddisplayTemplate = Template7.compile(displayTemplate);

//Permissions
var permissions;

// Handle Cordova Device Ready Event
$$(document).on('deviceready', function() {
  console.log("Device is ready!");
          // Specify a shortcut for the location manager holding the iBeacon functions.
          window.locationManager = cordova.plugins.locationManager;

          // Start tracking beacons
          initScan();
  
          // Display refresh timer.
          updateTimer = setInterval(updateBeacons, 500);
  
          console.log(device);
  
          permissions = cordova.plugins.permissions;
  
          permissions.checkPermission(permissions.BLUETOOTH, checkBluetoothPermissionCallback, null);
          permissions.checkPermission(permissions.ACCESS_COARSE_LOCATION, checkCoarseLocationPermissionCallback, null);
});

  // Specify your beacon 128bit UUIDs here.
  var regions = [
      { uuid: 'A495BB10-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB20-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB30-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB40-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB50-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB60-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB70-C5B1-4B44-B512-1370F02D74DE' },
      { uuid: 'A495BB80-C5B1-4B44-B512-1370F02D74DE' }

  ];

  // Dictionary of beacons.
  var beacons = {};

  // Timer that displays list of beacons.
  var updateTimer = null;

  function checkBluetoothPermissionCallback(status) {
      if (!status.hasPermission) {
          var errorCallback = function () {
              console.warn('BLUETOOTH permission is not turned on');
          }

          permissions.requestPermission(
              permissions.BLUETOOTH,
              function (status) {
                  if (!status.hasPermission) errorCallback();
              },
              errorCallback);
      }
  }

  function checkCoarseLocationPermissionCallback(status) {
      if (!status.hasPermission) {
          var errorCallback = function () {
              console.warn('ACCESS_COARSE_LOCATION permission is not turned on');
          }

          permissions.requestPermission(
              permissions.ACCESS_COARSE_LOCATION,
              function (status) {
                  if (!status.hasPermission) errorCallback();
              },
              errorCallback);
      }
  }
  //beacon delegate
  var delegate = null;

  function toggleBluetooth() {
      console.log('toggleBluetooth');
      // if(device.version)  don't toggle if android and 4
      if ((device.platform == "Android") && (device.version.startsWith("4"))) {
          console.log("skipping toggle, Android 4.x");
      }
      else {
          locationManager.disableBluetooth();
          //wait 5s then enable
          locationManager.enableBluetooth();
      }
  }


  function stopScan() {
      console.log("stopScan");
      // Start ranging beacons.
          locationManager.stopRangingBeaconsInRegion(beaconRegion);
  }

  function startScan() {
      console.log("startScan");
      // Start ranging beacons.
      for (var i in regions) {
          var beaconRegion = new locationManager.BeaconRegion(
              i + 1,
              regions[i].uuid);

          // Start ranging.
          locationManager.startRangingBeaconsInRegion(beaconRegion);
      }

  }

  function toggleUnits(beacon) {
    var displaytempunits = localStorage.getItem('displayTempunits-' + beacon.Color)||"°F";
    if (displaytempunits == "°F") {
        localStorage.setItem('displayTempunits-' + beacon.Color,"°C");
    }
    if (displaytempunits == "°C") {
        localStorage.setItem('displayTempunits-' + beacon.Color,"°F");
    }
  }
    
//adds color specific attributes
  function addtoScan(beacon){
    //add time since last update
    beacon.lastUpdate = localStorage.getItem('lastUpdate-' + beacon.Color)||beacon.timeStamp;
    //make sure tilt card is visible
    $$('#tiltcard-' + beacon.Color).show();
    var date = new Date(beacon.timeStamp);
    beacon.displaytimeStamp = date.toLocaleString();
    //handle bad RSSI values from iOS by using previous value if value is "0"
    if (beacon.rssi == 0){
        beacon.displayRSSI = localStorage.getItem('prevRSSI-' + beacon.Color)||""
    }else{
        beacon.displayRSSI = beacon.rssi + " dBm";
        localStorage.setItem('prevRSSI-' + beacon.Color,beacon.displayRSSI);
    }    
}

  function initScan() {
      // The delegate object holds the iBeacon callback functions
      // specified below.
      delegate = new locationManager.Delegate();

      console.log('initScan');

      locationManager.enableBluetooth();

      // Called continuously when ranging beacons.
      delegate.didRangeBeaconsInRegion = function (pluginResult) {
          if (pluginResult.beacons.length > 0) {
              //console.log('didRangeBeaconsInRegion: ' + JSON.stringify(pluginResult))
              for (var i in pluginResult.beacons) {
                  // Insert beacon into table of found beacons.
                  var beacon = pluginResult.beacons[i];
                  //add timestamp
                  beacon.timeStamp = Date.now();
                  //assign color by UUID
                  switch (beacon.uuid[6]) {
                         case "1" : beacon.Color = "RED";
                         addtoScan(beacon);
                         break;
                         case "2" : beacon.Color = "GREEN";
                         addtoScan(beacon);
                         break;
                         case "3" : beacon.Color = "BLACK";
                         addtoScan(beacon);
                         break;
                         case "4" : beacon.Color = "PURPLE";
                         addtoScan(beacon);
                         break;
                         case "5" : beacon.Color = "ORANGE";
                         addtoScan(beacon);
                         break;
                         case "6" : beacon.Color = "BLUE";
                         addtoScan(beacon);
                         break;
                         case "7" : beacon.Color = "YELLOW";
                         addtoScan(beacon);
                         break;
                         case "8" : beacon.Color = "PINK";
                         addtoScan(beacon);
                         break;
                  }
                if (beacon.minor > 2000){
                    beacon.uncalTemp = beacon.major / 10;
                    beacon.uncalSG = (beacon.minor / 10000).toFixed(4);;
                    beacon.hd = true;
                } else {
                  beacon.uncalTemp = beacon.major;
                  beacon.uncalSG = (beacon.minor / 1000).toFixed(3);
                  beacon.hd = false;
                }
                  //add display units
                  beacon.displayTempunits = localStorage.getItem('displayTempunits-' + beacon.Color)||"°F";
                  beacon.displayTemp = localStorage.getItem('displayTemp-' + beacon.Color)||beacon.uncalTemp;
                  beacon.uncalPlato = 1111.14 * beacon.uncalSG - 630.272 * beacon.uncalSG * beacon.uncalSG + 135.997 * beacon.uncalSG * beacon.uncalSG * beacon.uncalSG - 616.868;
                  //set key by UUID
                  var key = beacon.uuid;
                  beacons[key] = beacon;
                  //console.log(beacons);
              }
          }
      };

      // Set the delegate object to use.
      locationManager.setDelegate(delegate);

      // Request permission from user to access location info.
      // This is needed on iOS 8.
      locationManager.requestWhenInUseAuthorization();

      startScan();
  }
    
    //reset list of found beacons
    localStorage.setItem('foundbeacons','NONE');

    function updateBeacons() {
    for (var key in beacons) {
    var beacon = beacons[key];
    var currentTime = Date.now();
    //setup tilt cards (generate new card once for each Tilt found)
    var foundBeacons = localStorage.getItem('foundbeacons');
    var foundBeaconsArray = foundBeacons.split(",");
    if (foundBeaconsArray.indexOf(beacon.Color) < 0){
        foundBeaconsArray.push(beacon.Color);
        localStorage.setItem('foundbeacons',foundBeaconsArray);
        var displayhtml = compileddisplayTemplate(beacons);
        var tiltCard  = $$('#tiltCard').html(displayhtml);
        var foundBeaconsArraylength = foundBeaconsArray.length;
        for (var i = 0; i < foundBeaconsArraylength; i++) {
        //set up buttons
        $$('#unitstoggle' + foundBeaconsArray[i]).on('click', function (e) {
            console.log('clicked ');
            toggleUnits(foundBeaconsArray[i]);
          });
        }
    }
    
    //update timer for last scan recieved
    beacon.numberSecondsAgo = ((currentTime - beacon.lastUpdate) / 1000).toFixed(1);
    localStorage.setItem('lastUpdate-' + beacon.Color,beacon.timeStamp);
    //disconnect if no scans within 2 minutes
    if (Number(beacon.numberSecondsAgo) > 120){
        $$('#tiltcard-' + beacon.Color).hide();
    }
    //initialize display units
    //update data fields in Tilt card template
    $$('#uncalSG' + beacon.Color).html(beacon.uncalSG);
    $$('#uncalTemp' + beacon.Color).html(beacon.uncalTemp);
    $$('#displayTemp+displayTempunits' + beacon.Color).html(String(beacon.displayTemp) + beacon.displayTempunits);
    $$('#numberSecondsAgo' + beacon.Color).html(beacon.numberSecondsAgo);
    $$('#displayRSSI' + beacon.Color).html(beacon.displayRSSI);
    $$('#displaytimeStamp' + beacon.Color).html(beacon.displaytimeStamp);
    };
}

