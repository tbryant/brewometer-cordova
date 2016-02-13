baronbrew = function() {
    var baronbrew = {};
    baronbrew.discoveredDevices = {};
    baronbrew.connectedDevices = {};

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


    // Class to represent a row in the seat reservations grid
    function Device(name, rssi) {
        var self = this;
        self.name = name;
        self.rssi = rssi;
    }

    // Overall viewmodel for this screen, along with initial state
    ViewModel = function() {
        var self = this;  

        // Editable data
        self.devices = ko.observableArray([
            new Device("Steve", -72),
            new Device("Bert", -73)
        ]);
        
        // Operations
        self.addDevice = function(name,rssi) {
            self.devices.push(new Device(name, rssi));
        }

    }

    baronbrew.viewModel = new ViewModel();




    var Brewometer = function(device) {
        var self = this;

        self.name = device.name;
        self.device = device;
        self.temperature = {
            value: null,
            timestamp: null
        };
        self.temperatureCallback = null;

        self.accelerometer = {
            x: null,
            y: null,
            z: null,
            pitch: null,
            pitchMean: null,
            pitchArray: new Array(16),
            timestamp: null
        };
        self.accelerometerCallback = null;

        self.messageCount = 0;


        self.connect = function(resolve, reject) {
            console.log('reject', reject)
            console.log('connect ', self)
            ble.connect(self.device.id, function(peripheral) {
                    console.log('connected to ' + self.name);
                    console.log('enabling notifications on beanAppMessageCharacteristicUUID');
                    ble.startNotification(peripheral.id, beanAppMessageServiceUUID, beanAppMessageCharacteristicUUID,
                        function(data) {
                            console.log('notification ' + beanAppMessageCharacteristicUUID);
                            self.parseBeanResponse(peripheral, data);
                            console.log(data);
                        },
                        function(errorcode) {
                            console.log('BLE startNotification error: ' + errorCode);
                        });

                    resolve(self);
                },
                function(error) {
                    console.log('failed to connect to ' + self.device.name);
                    reject(error);
                });
        }
        self.disconnect = function(resolve, reject) {
            ble.disconnect(self.device.id, resolve, reject);
        }

        self.getTemperature = function(resolve) {
            self.sendBeanAppMessage(0x20, 0x11, new Uint8Array(0));
            self.temperatureCallback = resolve;
        }

        self.getAccelerometer = function(resolve) {
            self.sendBeanAppMessage(0x20, 0x10, new Uint8Array(0));
            self.accelerometerCallback = resolve;
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

        self.parseBeanResponse = function(peripheral, data) {
            dataArray = new Uint8Array(data);

            console.log(hexStringFromUint8Array(dataArray));

            var major = dataArray[3];
            var minor = dataArray[4];

            console.log('major:' + utils.toHexString(major) + ', minor:' + utils.toHexString(minor));

            switch (major) {
                case 0x20:
                    if (minor == 0x90) {
                        var dv = new DataView(data, 5);
                        var sensitivity = dataArray[11];
                        self.accelerometer.x = dv.getInt16(0, true);
                        self.accelerometer.y = dv.getInt16(2, true);
                        self.accelerometer.z = dv.getInt16(4, true);
                        self.accelerometer.timestamp = Date.now();

                        self.accelerometer.pitch = -Math.atan(-self.accelerometer.y / Math.sqrt(self.accelerometer.x * self.accelerometer.x + self.accelerometer.z * self.accelerometer.z)) * 180 / Math.PI;

                        self.accelerometer.pitchArray.push(self.accelerometer.pitch);
                        self.accelerometer.pitchArray.shift();
                        self.accelerometer.pitchMean = utils.mean(self.accelerometer.pitchArray);


                        console.log('acc read: ' + self.accelerometer.x + ',' + self.accelerometer.y + ',' + self.accelerometer.z);
                        console.log('sensitivity: ' + sensitivity);
                        self.accelerometerCallback(self.accelerometer)

                    } else {
                        if (minor == 0x91) {

                            var dv = new DataView(data, 5);
                            self.temperature.value = dv.getInt8(0, true);
                            self.temperature.timestamp = Date.now();

                            console.log('temp read:', self.temperature);
                            self.temperatureCallback(self.temperature);
                        }
                    }
                    break;
                default:
                    break;
            }
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

        displayStatus('Scanning...');

        evothings.easyble.startScan(callbackFun,onScanFailure);
    };

    function onScanFailure(errorCode)
    {
        // Show an error message to the user
        app.showInfo('Error: ' + errorCode);
        evothings.easyble.stopScan();
    }


    // Called when Start Scan button is selected.
    baronbrew.scan = function() {
        baronbrew.discoveredDevices = {};
        startScan(deviceFound);
    };

    // Called when a device is found.
    deviceFound = function(device, errorCode) {
        console.log('deviceFound:', device);
        if (device) {
            // Set timestamp for device (this is used to remove
            // inactive devices).
            device.timeStamp = Date.now();

            //filter on names starting with B
            if ((device.name != null) && (device.name.substr(0, 1) == 'B')) {
                console.log(device.name + ' added to discovered devices');
                // Insert the device into table of found devices.
                baronbrew.discoveredDevices[device.id] = new Brewometer(device);
                baronbrew.viewModel.devices.push(new Device(device.name,device.rssi));
            }
        } else if (errorCode) {
            displayStatus('Scan Error: ' + errorCode);
        }
    };


    crcTable = [0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef, 0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4, 0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823, 0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5, 0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49, 0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067, 0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1, 0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d, 0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e, 0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3, 0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a, 0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92, 0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74, 0x2e93, 0x3eb2, 0x0ed1, 0x1ef0];

    if (typeof Int32Array !== 'undefined') {
        crcTable = new Int32Array(crcTable);
    }

    ccitt = function(buf) {
        var byte, crc, i, len;

        crc = 0xffff;
        for (i = 0, len = buf.length; i < len; i++) {
            byte = buf[i];
            crc = (crcTable[((crc >> 8) ^ byte) & 0xff] ^ (crc << 8)) & 0xffff;
        }
        ccitt_16Array = new Uint16Array(1);
        ccitt_16Array[0] = crc;
        ccitt_8Array = new Uint8Array(ccitt_16Array.buffer);

        return ccitt_8Array;
    };

    delay = function(time) {
        return new Promise(function(fulfill) {
            setTimeout(fulfill, time);
        });
    }

    baronbrew.takeSample = function(name, updateCallback) {
        console.log('takeSample');
        var timeout = 1000;
        var address = addressFromName(name);
        if (address in baronbrew.discoveredDevices) {
            var brewometer = baronbrew.discoveredDevices[address];
            var data = {};
            //TODO named promise functions, or promise factory + execute sequentially
            var promise = new Promise(brewometer.connect).then(function() {
                return new Promise(brewometer.getTemperature)
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                return Promise.race([new Promise(brewometer.getAccelerometer), delay(timeout).then(function(resolve) {
                    resolve('getAccelerometer timed out');
                })])
            }).then(function() {
                var sg = -0.002315 * brewometer.accelerometer.pitchMean + 1.1529;
                var sensorReading = {
                    date: new Date(Date.now()),
                    pitch: brewometer.accelerometer.pitchMean,
                    sg: sg,
                    temperature: brewometer.temperature.value * 9.0 / 5.0 + 32.0,
                    battery: 0,
                    RSSI: 0,
                    sensorId: brewometer.name
                };

                Meteor.call('sensorReading', sensorReading);

                data = {
                    sample: {
                        pitch: brewometer.accelerometer.pitchMean,
                        sg: sg,
                        temperature: brewometer.temperature.value * 9.0 / 5.0 + 32.0,
                        timestamp: brewometer.accelerometer.timestamp
                    }
                };
                updateCallback(data);
                return new Promise(brewometer.disconnect)
            }).catch(function(err) {
                //TODO fix disconnect on catch
                brewometer.disconnect();
                console.log(err)
            });
        } else {
            console.log(address + ' no longer in discoveredDevices');
            baronbrew.scan();
        }
    }

    addressFromName = function(name) {
        for (address in baronbrew.discoveredDevices) {
            if (name == baronbrew.discoveredDevices[address].name)
                return address;
        }
        return;
    }


    setBeanLed = function(device, r, g, b) {
        var payload = new Uint8Array(3);
        payload[0] = r;
        payload[1] = g;
        payload[2] = b;

        sendBeanAppMessage(device, 0x20, 0x01, payload);
    };

    // Display a status message
    displayStatus = function(message) {
        console.log(message)
    };



    return baronbrew;
}();



