baronbrew = function() {
    var baronbrew = {};
    baronbrew.discoveredDevices = ko.observableArray([]);
    baronbrew.selectedBrewometer = ko.observable();
    baronbrew.connectedDevices = {};

    baronbrew.selectBrewometer = function(brewometer) {
        console.log("selecting brewometer:" + brewometer.device.name);
        baronbrew.selectedBrewometer(brewometer);
        brewometer.connect();
    }

    baronbrew.deselectBrewometer = function() {
        console.log("deselecting brewometer");
        baronbrew.selectedBrewometer = ko.observable();
        baronbrew.disconnect();
        baronbrew.scan();
    }


    var UUID_BEANSERVICE = 'F000FFC0-0451-4000-B000-000000000000';
    var beanAppMessageServiceUUID = 'a495ff10-c5b1-4b44-b512-1370f02d74de';
    var beanAppMessageCharacteristicUUID = 'a495ff11-c5b1-4b44-b512-1370f02d74de';

    var UUID_SCRATCHSERVICE = 'a495ff20-c5b1-4b44-b512-1370f02d74de'.toUpperCase();
    getScratchCharacteristicUUID = function(scratchNumber) {
        return ['a495ff21-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
        'a495ff22-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
        'a495ff23-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
        'a495ff24-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
        'a495ff25-c5b1-4b44-b512-1370f02d74de'.toUpperCase()
        ][scratchNumber - 1];
    };


    var Brewometer = function(device) {
        var self = this;
        self.rssi = ko.observable(device.rssi);
        self.device = device;
        self.color = ko.observable("0xBB10");

        self.coeffs = ko.observableArray([1159 , 1341 , 6897 , 11977, 0]);

        self.readUuid = function() {
            var address = 1; //uuid
            //set address in scratch 2
            self.device.writeCharacteristic(getScratchCharacteristicUUID(2), address, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(2) + ' with address: ' + address);
                var command = 1; //read
                //set command to read
                self.device.writeCharacteristic(getScratchCharacteristicUUID(1), command, function() {
                }, function(e) {
                    console.log('failed to write to ' + getScratchCharacteristicUUID(1) + ", " + e);
                });


            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(2) + ", " + e);
            })

        }

        self.readCoeffs = function(){

        }

        self.writeCoeffs = function(){

        }

        self.readColor = function(){

        }

        self.writeColor = function(){

        }



        self.connect = function() {

            function onConnectSuccess(device) {
                function onServiceSuccess(device) {
                    console.log('enabling notifications')
                    self.device.enableNotification(getScratchCharacteristicUUID(1),
                        function(data) {
                            console.log('notification ' + getScratchCharacteristicUUID(1));
                            //self.parseCommandResponse(data);
                            console.log(data);
                        },
                        function() {
                            console.log('BLE startNotification error');
                        });

                }

                function onServiceFailure(errorCode) {
                    // Show an error message to the user
                    console.log('Error reading services: ' + errorCode);
                }

                // Connect to the appropriate BLE service
                device.readServices(
                    [UUID_SCRATCHSERVICE],
                    onServiceSuccess,
                    onServiceFailure);
            };

            function onConnectFailure(errorCode) {
                // Show an error message to the user
                console.log('Error ' + errorCode);
            }

            console.log('Connecting to device: ' + self.device.name);

            // Stop scanning
            evothings.easyble.stopScan();

            device.connect(onConnectSuccess, onConnectFailure);

        }

        self.parseCommandResponse = function(peripheral, data) {
            console.log(hexStringFromUint8Array(data));
        }
    }


    hexStringFromUint8Array = function(data) {
        var hexString = '';
        for (var i = 0; i < data.length; i++) {
            hexString += utils.toHexString(data[i], 1);
        }
        return hexString;
    }


    function onScanFailure(errorCode) {
        // Show an error message to the user
        console.log('Error: ' + errorCode);
        evothings.easyble.stopScan();
    }


    // Called when Start Scan button is selected.
    baronbrew.scan = function() {
        console.log('starting scan');
        baronbrew.discoveredDevices.removeAll();
        evothings.easyble.startScan(deviceFound, onScanFailure);
    };

    baronbrew.stopScan = function(){
        evothings.easyble.stopScan();
    };

    baronbrew.disconnect = function() {
        evothings.easyble.closeConnectedDevices();
    };

    baronbrew.cleanUp = function(){
        baronbrew.disconnect();
        baronbrew.stopScan();


    }

    // Called when a device is found.
    deviceFound = function(device, errorCode) {
        if (device) {
            // Set timestamp for device (this is used to remove
            // inactive devices).
            device.timeStamp = Date.now();

            //filter on names starting with B           
            if ((device.name != null) && (device.rssi != 127)) {

                var foundDevice = ko.utils.arrayFirst(baronbrew.discoveredDevices(), function(item) {
                    return item.device.address == device.address;
                }) || -1;

                if (foundDevice == -1) {
                    console.log(device.name + ' added to discovered devices');
                    // Insert the device into table of found devices.
                    //baronbrew.discoveredDevices[device.id] = new Brewometer(device);  
                    baronbrew.discoveredDevices.push(new Brewometer(device));
                } else {
                    foundDevice.rssi(device.rssi);
                    // console.log('foundDevice: ' + foundDevice.device.address);
                }
            }

        } else if (errorCode) {
            console.log('Scan Error: ' + errorCode);
        }
    };


    return baronbrew;
}();
