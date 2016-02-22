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
        baronbrew.selectedBrewometer(null);
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

    var CalPoint = function(sg, angle) {
        var self = this;
        self.sg = ko.observable(sg);
        self.angle = ko.observable(angle);
    }


    var Brewometer = function(device) {
        var self = this;
        self.rssi = ko.observable(device.rssi);
        self.device = device;
        self.color = ko.observable("");
        self.command = 1;
        self.selectedCalPointIndex = 0;

        self.coeffs = ko.observableArray([]);
        self.coeffsArray = new Uint16Array(5);

        self.calPoints = ko.observableArray([new CalPoint(1000, 64.5), new CalPoint(1014, 60.5), new CalPoint(1051, 46.3), new CalPoint(1097, 22.5), new CalPoint(1127, 13.3)]);
        self.name = ko.observable();

        self.angle = ko.observable();
        self.trueTemp = ko.observable(68);
        self.measuredTemp = ko.observable(68);

        self.availableColors = [{
            colorName: "Red",
            hexString: "bb10"
        }, {
            colorName: "Green",
            hexString: "bb20"
        }, {
            colorName: "Black",
            hexString: "bb30"
        }, {
            colorName: "Purple",
            hexString: "bb40"
        }, {
            colorName: "Orange",
            hexString: "bb50"
        }, {
            colorName: "Blue",
            hexString: "bb60"
        }, {
            colorName: "Yellow",
            hexString: "bb70"
        }, {
            colorName: "Pink",
            hexString: "bb80"
        }];

        self.brewColor = ko.observable(self.availableColors[0]);

        self.brewColorHexString = ko.computed(function() {
            return self.brewColor().hexString;        
        }); 

        self.brewColor.subscribe(function(newValue) {
            console.log('setColorString');
            self.color(newValue.hexString);            
        });

        self.computeCal = function() {

            var data_x = [];
            for (var i = 0; i < self.calPoints().length; i++) {
                data_x[i] = self.calPoints()[i].angle();
            }

            var data_y = [];
            for (var i = 0; i < self.calPoints().length; i++) {
                data_y[i] = self.calPoints()[i].sg();
            }
            console.log(data_x[0]);
            console.log(data_y[0]);

            var cubic = function(params, x) {
                return params[0] * x * x * x +
                    params[1] * x * x +
                    params[2] * x +
                    params[3];
            };

            var objective = function(params) {
                var total = 0.0;
                for (var i = 0; i < data_x.length; ++i) {
                    var resultThisDatum = cubic(params, data_x[i]);
                    var delta = resultThisDatum - data_y[i];
                    total += (delta * delta);
                }
                return total;
            };

            var initial = [1, 1, 1, 1];
            var minimiser = numeric.uncmin(objective, initial);

            console.log("initial:");
            for (var j = 0; j < initial.length; ++j) {
                console.log(initial[j]);
            }

            console.log("minimiser:");
            for (var j = 0; j < minimiser.solution.length; ++j) {
                console.log(minimiser.solution[j]);
            }
            coeffsArray = new Uint16Array(5)
                //multiply and offset
            coeffsArray[0] = minimiser.solution[0] * (-1000000);
            coeffsArray[1] = minimiser.solution[1] * (10000);
            coeffsArray[2] = minimiser.solution[2] * (-1000);
            coeffsArray[3] = minimiser.solution[3] * (10);
            coeffsArray[4] = (self.trueTemp() - self.measuredTemp() + 10) * 10;
            self.coeffs(coeffsArray);

        }

        self.readCoeffs = function() {
            self.command = 1;
            var commandArray = new Uint8Array([self.command]); //read calibration
            console.log('reading coeffs');

            self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
            });
        }

        self.writeCoeffs = function() {
            self.command = 2;
            var commandArray = new Uint8Array([self.command]); //write
            console.log("writing coeffs " + hexStringFromUint8Array(self.coeffs()));

            self.device.writeCharacteristic(getScratchCharacteristicUUID(5), self.coeffs(), function() {
                self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                    console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
                }, function(e) {
                    console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
                });
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(5) + ", " + e);
            });

        }

        self.readColor = function() {
            self.command = 3;
            var commandArray = new Uint8Array([self.command]); //read color
            console.log('reading color');

            self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
            });
        }

        self.writeColor = function() {
            self.command = 4;
            var commandArray = new Uint8Array([self.command]); //write color

            var colorArray = new Uint16Array([parseInt("0x" + self.color())]);
            console.log('writing color, colorArray[0] = ' + colorArray[0]);
            self.device.writeCharacteristic(getScratchCharacteristicUUID(5), colorArray, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(5) + ' with color: ' + self.color());
                self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                    console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
                }, function(e) {
                    console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
                });
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(5) + ", " + e);
            });
        }

        self.readAngle = function() {
            self.command = 6;
            var commandArray = new Uint8Array([self.command]); //read pitch
            console.log('reading angle');

            self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
            });
        }

        self.readTemp = function() {
            self.command = 7;
            var commandArray = new Uint8Array([self.command]); //read temp
            console.log('reading temp');

            self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
            });
        }

        self.measureAngle = function(calPoint) {            
            self.selectedCalPointIndex = self.calPoints().indexOf(calPoint);
            console.log('setting selectedCalPointIndex = ' + self.selectedCalPointIndex);
            self.readAngle();
        }


        self.saveConfig = function() {
            self.command = 5;
            var commandArray = new Uint8Array([self.command]); //write config to persistent memory
            console.log('writing config to persistent memory');
            self.device.writeCharacteristic(getScratchCharacteristicUUID(4), commandArray, function() {
                console.log('wrote ' + getScratchCharacteristicUUID(4) + ' with command: ' + self.command);
            }, function(e) {
                console.log('failed to write to ' + getScratchCharacteristicUUID(4) + ", " + e);
            });
        }


        self.parseResponse = function(data) {
            console.log('BLE characteristic data: ' + hexStringFromUint8Array(new Uint8Array(data)));
            switch (self.command) {
                case 1:
                    //coeffs
                    console.log("read coeffs " + hexStringFromUint8Array(data));
                    self.coeffs(new Uint16Array(data));
                    break;

                case 3:
                    //beaconId
                    console.log("read beaconId " + hexStringFromUint8Array(new Uint8Array(data)));
                    self.color(hexStringFromUint8Array(new Uint8Array(data)));
                    break;

                case 6:
                    //angle
                    console.log("reading angle " + hexStringFromUint8Array(new Uint8Array(data)));
                    var angle = Math.round((new Float32Array(data))[0]*1000)/1000.0; //round to 3 decimal places
                    self.calPoints()[self.selectedCalPointIndex].angle(angle);
                    break;

                case 7:
                    //temp
                    console.log("reading temp " + hexStringFromUint8Array(new Uint8Array(data)));
                    self.measuredTemp((new Float32Array(data))[0]);
                    break;
            }

        }



        self.connect = function() {

            function onConnectSuccess(device) {
                function onServiceSuccess(device) {
                    console.log('enabling notifications');
                    self.device.enableNotification(
                        getScratchCharacteristicUUID(5),
                        function(data) {
                            console.log('notification ' + getScratchCharacteristicUUID(5));
                            self.parseResponse(data);
                        },
                        function() {
                            console.log('BLE startNotification error');
                        });

                    self.readColor();

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
            hexString += evothings.util.toHexString(data[i], 1);
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

    baronbrew.stopScan = function() {
        evothings.easyble.stopScan();
    };

    baronbrew.disconnect = function() {
        evothings.easyble.closeConnectedDevices();
    };

    baronbrew.cleanUp = function() {
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