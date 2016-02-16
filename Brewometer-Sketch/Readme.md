Brewometer-Sketch

The Brewometer uses a simple protocol for reading and writing memory on the Brewometer using Bean Scratches

When connected to a host, the Brewometer is reading the command register in a loop, if there is a non-zero value in the command Scratch, the operation is performed and the scratches will change. The command scratch will return to zero.  The host app should prepare Scratch 5 before setting the command to non-zero.

## commands

| Command | Scratch 4 (command id) | Scratch 5 (input/output) | Comments|
| -------------| -------------| -------------| -------------|
| No operation | 0 | | |
| Read Calibration | 1 | current value| |
| Write Calibration | 2 | value to write | |
| Save Calibration| 3 | |overwrites factory cal|
| Read Pitch | 4 | pitch in degrees| |  |


## calibration structure in char[20] local_name

| Field | Bytes | Type | Comment |
| -------------| -------------| -------------| -------------|
| Name | 0-3 | char[4]| Bluetooth name|
| cal0 cubic  | 4-7 | float | calibration coeff cal[0]|
| cal1 square  | 8-11 | float | calibration coeff cal[1]|
| cal2 linear  | 12-15 | float | calibration coeff cal[2]|
| cal3 constant  | 16-19 | float | calibration coeff cal[3]|
