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
        self.beaconUuid = ko.observable(0xBB30);

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
                    app.showInfo('Error reading services: ' + errorCode);
                }

                // Connect to the appropriate BLE service
                device.readServices(
                    [UUID_SCRATCHSERVICE],
                    onServiceSuccess,
                    onServiceFailure);
            };

            function onConnectFailure(errorCode) {
                // Show an error message to the user
                app.showInfo('Error ' + errorCode);
            }

            console.log('Connecting to device: ' + self.device.name);

            // Stop scanning
            evothings.easyble.stopScan();

            device.connect(onConnectSuccess, onConnectFailure);

        }
        self.disconnect = function() {
            evothings.easyble.closeConnectedDevices();
        }

        self.parseCommandResponse = function(peripheral, data) {
            console.log(hexStringFromUint8Array(data));
        }


        self.constructBeanMessage = function getpitchArray(cmdBuffer, payloadBuffer) {

            //size buffer contains size of(cmdBuffer, and payloadBuffer) and a reserved byte set to 0
            var sizeBuffer = new Uint8Array(2);
            sizeBuffer[0] = cmdBuffer.length + payloadBuffer.length;

            //GST (Gatt Serial Transport) contains sizeBuffer, cmdBuffer, and payloadBuffer
            var gstBuffer = new Uint8Array(sizeBuffer.length + cmdBuffer.length + payloadBuffer.length);
            gstBuffer.set(sizeBuffer, 0);
            gstBuffer.set(cmdBuffer, sizeBuffer.length);
            gstBuffer.set(payloadBuffer, sizeBuffer.length + cmdBuffer.length);

            var crc16Buffer = ccitt(gstBuffer);

            console.log('crc16Buffer ' + hexStringFromUint8Array(crc16Buffer));

            //GATT contains sequence header, gstBuffer and crc166
            var gattBuffer = new Uint8Array(1 + gstBuffer.length + crc16Buffer.length);

            var header = (((self.messageCount++ * 0x20) | 0x80) & 0xff);
            gattBuffer[0] = header; //one packet

            gattBuffer.set(gstBuffer, 1); //copy gstBuffer into gatt shifted right 1

            //add crc to end of gatt
            gattBuffer[gattBuffer.length - 2] = crc16Buffer[0];
            gattBuffer[gattBuffer.length - 1] = crc16Buffer[1];

            console.log(gattBuffer);

            return gattBuffer;
        }
        self.sendBeanAppMessage = function(major, minor, payload) {

            var cmdBuffer = new Uint8Array(2);
            cmdBuffer[0] = major;
            cmdBuffer[1] = minor;

            var data = self.constructBeanMessage(cmdBuffer, payload);

            ble.writeWithoutResponse(self.device.id, beanAppMessageServiceUUID, beanAppMessageCharacteristicUUID, data.buffer, function() {
                console.log('wrote ' + beanAppMessageCharacteristicUUID + ' with data: ' + hexStringFromUint8Array(data));
            }, function(e) {
                console.log('failed to write to ' + beanAppMessageCharacteristicUUID + ", " + e);
            })

        }
    }


    hexStringFromUint8Array = function(data) {
        var hexString = '';
        for (var i = 0; i < data.length; i++) {
            hexString += utils.toHexString(data[i], 1);
        }
        return hexString;
    }

    startScan = function(callbackFun) {
        console.log('startScan');
        evothings.easyble.startScan(callbackFun, onScanFailure);
    };

    function onScanFailure(errorCode) {
        // Show an error message to the user
        app.showInfo('Error: ' + errorCode);
        evothings.easyble.stopScan();
    }


    // Called when Start Scan button is selected.
    baronbrew.scan = function() {
        baronbrew.discoveredDevices.removeAll();
        startScan(deviceFound);
    };

    // Called when a device is found.
    deviceFound = function(device, errorCode) {
        if (device) {
            // Set timestamp for device (this is used to remove
            // inactive devices).
            device.timeStamp = Date.now();

            //filter on names starting with B           
            if ((device.name != null) && (device.rssi != 127)) {

                var foundDevice = ko.utils.arrayFirst(baronbrew.discoveredDevices(), function(item) {
                    return item.device.id == device.id;
                }) || -1;

                if (foundDevice == -1) {
                    console.log(device.name + ' added to discovered devices');
                    // Insert the device into table of found devices.
                    //baronbrew.discoveredDevices[device.id] = new Brewometer(device);  
                    baronbrew.discoveredDevices.push(new Brewometer(device));
                } else {
                    foundDevice.rssi(device.rssi);
                }
            }

        } else if (errorCode) {
            console.log('Scan Error: ' + errorCode);
        }
    };


    return baronbrew;
}();
