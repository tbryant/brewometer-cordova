baronbrew = function() {
    var baronbrew = {};
    baronbrew.discoveredDevices = ko.observableArray([]);
    baronbrew.selectedBrewometer = ko.observable();
    baronbrew.cloudUrl = ko.observable('https://script.google.com/macros/s/AKfycbyqztVynRkEa0XKZpsa_fZcrtbXrbvQA0vdMjYHAoX5fIQr8cfc/exec');
        //'https://script.googleusercontent.com/macros/echo?user_content_key=VjBuv7-OIeh0VYRauT9wCxSFV1jJm2u2h-2tF7mJhaZUk_fSePkKbqmy-0dZoBmdsZruB-x_AzpzZQ4ir3IPitU5j7QqrZY6m5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnDoDpoefBMFRFQCZyrN07Q_IoBoYKpVeedpHdRJcohMun1ZWMFj4e-Yzv88yNtMj6aBDjyR_X-nF&lib=MK7tboALFE_Ja-j0PFin833wQpTidpMma');
    baronbrew.connectedDevices = {};

    baronbrew.selectBrewometer = function(brewometer) {
        console.log("selecting brewometer:" + brewometer.device.name);
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
        self.id = ko.observable("");
        self.color = ko.observable("");
        self.command = 1;
        self.selectedCalPointIndex = 0;

        self.coeffs = ko.observableArray([]);
        self.coeffsArray = new Uint16Array(5);

        self.calPoints = ko.observableArray([new CalPoint(1000, 64.5), new CalPoint(1014, 60.5), new CalPoint(1061, 46.3), new CalPoint(1097, 22.5), new CalPoint(1127, 13.3)]);
        self.name = ko.observable();

        self.angleSampleCount = 0;
        self.angleCumulativeSum = 0;
        self.angle = ko.observable();

        self.tempSampleCount = 0;
        self.tempCumulativeSum = 0;
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

            //cal coefficients are based on multimap
            coeffsArray[0] = 0;
            coeffsArray[1] = 0;
            coeffsArray[2] = 0;
            coeffsArray[3] = 0;
            coeffsArray[4] = 0;
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

        self.measureTemp = function(calPoint) {
            self.tempSampleCount = 0;
            self.tempCumulativeSum = 0;
            self.readTemp();
        }

        self.measureAngle = function(calPoint) {
            self.angleSampleCount = 0;
            self.angleCumulativeSum = 0;
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
            self.postConfig();
        }

        self.postConfig = function() {
            // Sending and receiving data in JSON format using POST mothod
            //
            var data = {
                "id": self.id(),
                "color": self.color(),
                "angle0": self.calPoints()[0].angle(),
                "sg0": self.calPoints()[0].sg(),
                "angle1": self.calPoints()[1].angle(),
                "sg1": self.calPoints()[1].sg(),
                "angle2": self.calPoints()[2].angle(),
                "sg2": self.calPoints()[2].sg(),
                "angle3": self.calPoints()[3].angle(),
                "sg3": self.calPoints()[3].sg(),
                "angle4": self.calPoints()[4].angle(),
                "sg4": self.calPoints()[4].sg(),
                "trueTemp": self.trueTemp(),
                "measuredTemp": self.measuredTemp(),
                "cal0": self.coeffs()[0],
                "cal1": self.coeffs()[1],
                "cal2": self.coeffs()[2],
                "cal3": self.coeffs()[3],
                "calT": self.coeffs()[4]
            };

            var url = baronbrew.cloudUrl();

            //XHR wasn't redirecting as needed for google sheets app
            // xhr = new XMLHttpRequest();
            // xhr.open("POST", url, true);
            // xhr.setRequestHeader("Content-type", "application/json");
            // xhr.onreadystatechange = function() {
            //     if (xhr.readyState == 4 && xhr.status == 200) {
            //         console.log(xhr.responseText);
            //     }
            // }            
            // console.log("post: "+ JSON.stringify(data);
            // xhr.send(JSON.stringify(data);

            $.post(url, data);

        }

        self.parseResponse = function(data) {
            console.log('BLE characteristic data: ' + hexStringFromUint8Array(new Uint8Array(data)));
            switch (self.command) {
                case 1:
                    //coeffs
                    console.log("read coeffs " + hexStringFromUint8Array(new Uint8Array(data)));
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
                    self.angleCumulativeSum += (new Float32Array(data))[0];
                    self.angleSampleCount++;
                    //average many samples
                    if(self.angleSampleCount < 5){
                        self.readAngle();
                    }
                    var angle = Math.round((self.angleCumulativeSum / self.angleSampleCount)* 10) / 10.0;
                    self.calPoints()[self.selectedCalPointIndex].angle(angle);
                    
                    break;

                case 7:
                    //temp
                    self.tempCumulativeSum += (new Float32Array(data))[0];
                    self.tempSampleCount++;
                    console.log("reading temp " + hexStringFromUint8Array(new Uint8Array(data)));
                    //average many samples
                    if(self.tempSampleCount < 5){
                        self.readTemp();
                    }
                    var temperature = Math.round((self.tempCumulativeSum / self.tempSampleCount)* 10) / 10.0;                    
                    self.measuredTemp(temperature);
                    break;
            }

        }



        self.connect = function() {

            function onConnectSuccess(device) {
                function onServiceSuccess(device) {
                    baronbrew.selectedBrewometer(self);

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