BT_RADIOCONFIG_T radioConfig;
int command = 0;
int counter = 0;

ScratchData inputScratchData;

uint8_t local_name[20];
uint16_t ibeacon_uuid;

int i;

uint8_t sgOffset = 20;
float factoryTempOffset = 0;
float cal[4];
float calTemperature = 72.0; //temperature of final solution for temp cal
int calTemperatureIntervals = 30; //number of 10 second intervals to wait
float calRangesHigh[4] = {75.0, 55.0, 20.0, 20.0};  //upper bounds for angle at cal set points
float calPreviousPitch = 0.0; 
float calRangesLow[4] = {55.0, 20.0, 5.0, 5.0}; //lower bounds for angle at cal set points
float calSetPoints[4] = {1.000, 1.061, 1.110, 1.127}; //cal SG set points
float standardCurve[4] = { -0.001467, 0.18647, -8.80063, 1195.27 }; //coefficients for 3rd order polynomial
float avgPitchPrev;
uint8_t calibrationState = 0;
uint8_t tareCalibrationState = 0;
uint8_t tareStabilityCount = 0;
float tareValue = 1.000;
int tareCalibrationIntervals = 30; //number of 10 second intervals to wait
int currentCalPoint = 3;
uint32_t tempCalSampleCount = 0;

const uint8_t temperatureScratch = 2;
const uint8_t sgScratch = 3;
const uint8_t commandScratch = 4;
const uint8_t inputOutputScratch = 5;

float FmultiMap(float value, float * in, float * out, uint8_t size)
{
  // search right intervalue
  uint8_t i = 1;
  while ((value > in[i]) && (i < size - 1)) i++;

  // interpolate in the right segment for the rest
  return (value - in[i - 1]) * (out[i] - out[i - 1]) / (in[i] - in[i - 1]) + out[i - 1];
}

float applyFactoryTemperatureCal(float temperature) {
  return temperature + factoryTempOffset;
}

float getAvgTemperature(int count) {
  long temperatureBuffer = 0;
  for (int i = 0; i < count; i++) {
    temperatureBuffer += Bean.getTemperature();
  }
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32;

  return temperatureFahrenheit;
}

float getAvgTemperatureNoCalibration(int count) {
  long temperatureBuffer = 0;
  for (int i = 0; i < count; i++) {
    temperatureBuffer += Bean.getTemperature();
  }
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32.0;

  return temperatureFahrenheit;
}

float getAvgPitch(int count) {
  AccelerationReading accel = {0, 0, 0};
  float x = 0;
  float y = 0;
  float z = 0;
  for (int i = 0; i < count; i++) {
    accel = Bean.getAcceleration();
    x += accel.xAxis;
    y += accel.yAxis;
    z += accel.zAxis;
  }

  float pitch = atan(y / sqrt(x * x + z * z)) *  57.3;
  return pitch;
}

float applyFactoryCal(float sgInput) {
  return 1000 * FmultiMap(0.001 * sgInput, cal, calSetPoints, 4);
}

float applyTareCalibration(float sgInput) {
  float tarePoints[2];
  float tareSetPoints[2];
  tarePoints[0] = tareValue;
  tarePoints[1] = 1.500;
  tareSetPoints[0] = 1.000;
  tareSetPoints[1] = tarePoints[1];

  return 1000 * FmultiMap(0.001 * sgInput, tarePoints, tareSetPoints, 2);
}

float convertPitch(float avgPitch) {
  //polynomial curve
  float sG  = standardCurve[0] * avgPitch * avgPitch * avgPitch + standardCurve[1] * avgPitch * avgPitch + standardCurve[2] * avgPitch + standardCurve[3];
  return sG;
}

void setup() {
  Bean.enableWakeOnConnect(true);
  Bean.setBeaconEnable(true);
  //read name (cal coefficients) from persistent memory
  Bean.getRadioConfig(&radioConfig);
  for ( i = 0 ; i < 20 ; i++) {
    local_name[i] = radioConfig.local_name[i];
  }
  local_name[0] = 'T';
  local_name[1] = 'i';
  local_name[2] = 'l';
  local_name[3] = 't';
  //multiply by appropriate factor per cal coeff
  cal[0] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[0]);
  cal[1] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[1]);
  cal[2] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[2]);
  cal[3] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[3]);

  //temperature offset by 10
  factoryTempOffset = (0.1 * ((uint16_t *)(&(local_name[4])))[4]) - 10;

  ibeacon_uuid = radioConfig.ibeacon_uuid;
}

void resetRadioConfig() {
  radioConfig.adv_int = 500;
  radioConfig.conn_int = 20;
  radioConfig.power = 3;
  radioConfig.adv_mode = 1;
  radioConfig.ibeacon_uuid = ibeacon_uuid;
  radioConfig.ibeacon_major = 0;
  radioConfig.ibeacon_minor = 0;
  for ( i = 0 ; i < 20 ; i++) {
    radioConfig.local_name[i] = local_name[i];
  }
  radioConfig.local_name_size = 20;
}

void updateBeaconParameters(uint16_t major, uint16_t minor) {
  resetRadioConfig();
  radioConfig.ibeacon_major = major;
  radioConfig.ibeacon_minor = minor;
  Bean.setRadioConfig(radioConfig, false);
}

void batteryCheck() {
  // Returns the voltage with conversion of 0.01 V/unit
  uint16_t batteryReading =  Bean.getBatteryVoltage();
  if (batteryReading > 280) {
    //blink green
    for (int i = 0; i < 3 ; i++) {
      delay(200);
      Bean.setLed(0, 255, 0);
      Bean.setLed(0, 0, 0);
    }
  }
  else {
    //blink red
    for (int i = 0; i < 3 ; i++) {
      delay(200);
      Bean.setLed(255, 0, 0);
      Bean.setLed(0, 0, 0);
    }
  }
}

void endCommand() {
  //set command back to 0 and turn off LED
  command = 0;
  Bean.setScratchNumber(commandScratch, command);
  Bean.setLed(0, 0, 0);
}

void loop()
{
  if ( Bean.getConnectionState() ) {
    //connected
    Bean.setLed(0, 0, 0);
    // Write current temperature and SG to a scratches
    uint8_t avgTemperature = getAvgTemperature(8);
    Bean.setScratchNumber(temperatureScratch, (uint32_t)applyFactoryTemperatureCal(avgTemperature));

    float avgPitch = getAvgPitch(16);
    Bean.setScratchNumber(sgScratch, (uint32_t)(applyTareCalibration(applyFactoryCal(convertPitch(avgPitch))) + 0.5));

    //blink green
    Bean.setLed(0, 255, 0);
    Bean.setLed(0, 0, 0);

    //look for command in Scratch 4
    bool newCommand = false;
    if (command != Bean.readScratchNumber(commandScratch)) {
      newCommand = true;
      command = Bean.readScratchNumber(commandScratch);
      Bean.setLed(0, 0, 255);
    }

    switch (command) {
      case 1:
        //Read Coeffs
        Bean.setScratchData(inputOutputScratch, &(local_name[4]), 10);
        endCommand();
        break;
      case 2:
        //Write Coeffs
        inputScratchData = Bean.readScratchData(inputOutputScratch);
        for (int i = 0; i < 16 ; i++) {
          local_name[i + 4] = inputScratchData.data[i];
        }
        //multiply by appropriate factor per cal coeff
        cal[0] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[0]);
        cal[1] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[1]);
        cal[2] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[2]);
        cal[3] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[3]);
        //temperature offset by 10
        factoryTempOffset = (0.1 * ((uint16_t *)(&(local_name[4])))[4]) - 10;

        endCommand();
        break;
      case 3:
        //Read
        //swap endian
        uint8_t uuid_swapped[2];
        uuid_swapped[0] = ((uint8_t *)&ibeacon_uuid)[1];
        uuid_swapped[1] = ((uint8_t *)&ibeacon_uuid)[0];
        Bean.setScratchData(inputOutputScratch, uuid_swapped, 2);
        endCommand();
        break;
      case 4:
        //Write
        inputScratchData = Bean.readScratchData(inputOutputScratch);
        ibeacon_uuid = ((uint16_t *)inputScratchData.data)[0];
        endCommand();
        break;
      case 5:
        //Save Calibration : Write Config with save
        resetRadioConfig();
        Bean.setRadioConfig(radioConfig, true);
        endCommand();
        break;
      case 6:
        //Measure Angle
        uint8_t angleByteArray[4];
        float angle;
        angle = (float)getAvgPitch(16);
        for (i = 0; i < 4 ; i++) {
          angleByteArray[i] = ((uint8_t *)&angle)[i];
        }
        Bean.setScratchData(inputOutputScratch, angleByteArray, 4);
        endCommand();
        break;
      case 7:
        //Measure Temp
        uint8_t tempByteArray[4];
        float temp;
        temp = getAvgTemperatureNoCalibration(16);
        for (i = 0; i < 4 ; i++) {
          tempByteArray[i] = ((uint8_t *)&temp)[i];
        }
        Bean.setScratchData(inputOutputScratch, tempByteArray, 4);
        endCommand();
        break;
      default:
        Bean.sleep(500);
        break;
    }
  }

  else {
    //normal operation
    Bean.setLed(0, 0, 0);
    float temperatureBufferAverage;
    temperatureBufferAverage = getAvgTemperature(8);
    float avgPitch = getAvgPitch(16);
    float avgPitchDiff = avgPitchPrev - avgPitch;

    if (abs(avgPitchDiff) < .25) {
      avgPitchPrev = avgPitch;
      if (calibrationState == 0) {
        //lower power as long as not calibrating
        Bean.sleep(20000);
      }
      //check if I should sleep more
      if (abs(avgPitch) > 75) {
        if (Bean.getAdvertisingState()) {
          Bean.enableAdvertising(false);
          calibrationState = 0;
          currentCalPoint = 3;
          calPreviousPitch = 0;
          //skip the user tare if it goes to sleep
          tareCalibrationState = 2;
        }
        Bean.sleep(30000);
        return;
      }
    }
    if (abs(avgPitch) < 75) {
      if (!Bean.getAdvertisingState()) {
        batteryCheck();  
        Bean.enableAdvertising(true);        
      }
    }

    avgPitchPrev = avgPitch;
    float spGr = convertPitch(avgPitch);

    if (factoryTempOffset == -10.0) {
      //calibration routine
      //starts because temp cal hasn't been set
      tareCalibrationState = 2; //don't tare after factory cal
      switch (calibrationState) {
        case 0:
          //entering calibration mode
          for (int i = 0; i < 5; i++) {
            delay(200);
            Bean.setLed(255, 255, 0);
            Bean.setLed(0, 0, 0);
          }
          currentCalPoint = 3;  //start with high gravity and end in temp-controlled water
          calibrationState++;
          break;
        case 1:
          //look for calibration solution (still, in angle range, and sufficient change from previous angle)
          if (((abs(avgPitchDiff) < .5) && (avgPitch > calPreviousPitch + 1)) && ((avgPitch < calRangesHigh[currentCalPoint]) && (avgPitch > calRangesLow[currentCalPoint]))) {
            avgPitch = 0;
            for (int i = 0; i < 5; i++) {
              avgPitch += 0.2 * getAvgPitch(16);
              delay(200);
              Bean.setLed(0, 0, 255);
              Bean.setLed(0, 0, 0);
            }
            calPreviousPitch = avgPitch; //store to ensure that overlapping ranges don't calibrate in the wrong solution
            spGr = convertPitch(avgPitch);
            ((uint16_t *)(&(local_name[4])))[currentCalPoint] = (uint16_t) (spGr + 0.5);
            cal[currentCalPoint] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[currentCalPoint]);

            currentCalPoint--;
            if (currentCalPoint < 0) {
              //move on to temp cal
              tempCalSampleCount = 0;
              calibrationState++;
            }
          }
          //blink green when done with current temperature
          if (currentCalPoint < 3) {
            if ((abs(avgPitchDiff) < 2) && ((avgPitch < calPreviousPitch + 0.5) && (avgPitch > calPreviousPitch - 0.5))) {
              Bean.setLed(0, 255, 0);
              Bean.setLed(0, 0, 0);
            }
          }
          break;
        case 2:
          //temperature
          tempCalSampleCount++;
          if (tempCalSampleCount > calTemperatureIntervals) {
            ((uint16_t *)(&(local_name[4])))[4] = (uint16_t) (calTemperature - temperatureBufferAverage + 10) * 10.0;

            //temperature offset by 10
            factoryTempOffset = (0.1 * ((uint16_t *)(&(local_name[4])))[4]) - 10;
            //save coeffs when complete
            resetRadioConfig();
            Bean.setRadioConfig(radioConfig, true);
            calibrationState++;
          }
          break;
      }
    }
    else {
      spGr = applyFactoryCal(spGr);
      temperatureBufferAverage = applyFactoryTemperatureCal(temperatureBufferAverage);

      //User Tare
      switch (tareCalibrationState) {
        case 0:
          //entering tare calibration mode
          for (int i = 0; i < 5; i++) {
            delay(200);
            Bean.setLed(255, 0, 255);
            Bean.setLed(0, 0, 0);
          }
          tareCalibrationState++;
          break;
        case 1:
          //look for stable in water solution
          if (((spGr < 1015) && (spGr > 985)) && (abs(avgPitchDiff) < .5)) {

            avgPitch = 0;
            for (int i = 0; i < 5; i++) {
              avgPitch += 0.2 * getAvgPitch(16);
              delay(200);
              Bean.setLed(0, 0, 255);
              Bean.setLed(0, 0, 0);
            }
            tareValue = 0.001 * applyFactoryCal(convertPitch(avgPitch));
            tareCalibrationState++;
          }
          if (tareCalibrationIntervals-- < 0) {
            //timeout
            tareCalibrationState++;
          }
          break;
      }
    }
    //keep blinking when calibration is complete until put to sleep
    if (calibrationState == 3) {
      Bean.setLed(0, 255, 0);
      Bean.setLed(0, 0, 0);
    }

    spGr = applyTareCalibration(spGr);

    int16_t sG16 = (int16_t) (spGr + 0.5);
    int16_t temperatureInt16 = (int16_t)temperatureBufferAverage;

    updateBeaconParameters(temperatureInt16, sG16);
    Bean.sleep(10000);
  }
}






