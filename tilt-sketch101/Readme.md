Brewometer-Sketch

The Brewometer uses a simple protocol for reading and writing memory on the Brewometer using Bean Scratches

When connected to a host, the Brewometer is reading the command register in a loop, if there is a non-zero value in the command Scratch, the operation is performed and the scratches will change. The command scratch will return to zero.  The host app should prepare Scratch 5 before setting the command to non-zero.

## commands

| Command | Scratch 4 (command id) | Scratch 5 (input/output) | Comments|
| -------------| -------------| -------------| -------------|
| No operation | 0 | | |
| Read Calibration | 1 | current value| |
| Write Calibration | 2 | value to write | |
| Read BeaconId | 3 | | |
| Write BeaconId | 4 | value to write | |
| Save Config | 5 | |overwrites factory cal|
| Read Pitch | 6 | pitch in degrees| |
| Read Temperature | 7 | Temperature in Fahrenheit| |  |


## calibration structure in char[20] local_name

| Field | Bytes | Type | Comment |
| -------------| -------------| -------------| -------------|
| Name | 0-3 | char[4]| Bluetooth name|
| cal0 cubic  | 4,5 | uint16 | calibration coeff cal[0]|
| cal1 square  | 6,7 | uint16 | calibration coeff cal[1]|
| cal2 linear  | 8,9 | uint16 | calibration coeff cal[2]|
| cal3 constant  | 10,11 | uint16 | calibration coeff cal[3]|
| tempcal   | 12,13 | uint16 | temp cal|
