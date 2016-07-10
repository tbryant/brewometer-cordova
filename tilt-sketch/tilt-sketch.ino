BT_RADIOCONFIG_T radioConfig;
int command = 0;
int counter = 0;

ScratchData inputScratchData;

uint8_t local_name[20];
uint16_t ibeacon_uuid;

int i;

uint8_t tempOffset = 10;
uint8_t sgOffset = 20;
float factoryTempOffset = 0;
float cal[4];
float calTemperature = 75.0; //temperature of final solution for temp cal
int calTemperatureIntervals = 4; //number of 10 second intervals to wait
float calRangesHigh[3] = {75.0, 55.0, 30.0};  //upper bounds for angle at cal set points
float calRangesLow[3] = {55.0, 30.0, 10.0}; //lower bounds for angle at cal set points
float calSetPoints[3] = {1.000, 1.061, 1.127}; //cal SG set points
float standardCurve[4] = { -0.001691, 0.1837, -8.018, 1204.6}; //coefficients for 3rd order polynomial
float avgPitchPrev;
uint8_t calibrationState = 0;
int currentCalPoint = 2;
uint32_t tempCalSampleCount = 0;

const uint8_t ledScratch = 1;
const uint8_t temperatureScratch = 2;
const uint8_t sgScratch = 3;
const uint8_t commandScratch = 4;
const uint8_t inputOutputScratch = 5;

float FmultiMap(float value, float * in, float * out, uint8_t size)
{
  // search right intervalue
  uint8_t i = 1;
  while ((value > in[i]) && (i < size-1)) i++;

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
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32 + (tempOffset - 10);

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
  return 1000*FmultiMap(0.001*sgInput, cal, calSetPoints, 3);
}

float convertPitch(float avgPitch) {
  //polynomial curve
  float sG  = standardCurve[0] * avgPitch * avgPitch * avgPitch + standardCurve[1] * avgPitch * avgPitch + standardCurve[2] * avgPitch + standardCurve[3] + sgOffset - 20;
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

  //reset user calibration
  uint8_t userCal[2];
  userCal[0] = tempOffset;
  userCal[1] = sgOffset;
  Bean.setScratchData(ledScratch, userCal, 2);
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
    // Write current temperature to a scratch data area.
    uint8_t temperatureBuffer[1];
    temperatureBuffer[0] = getAvgTemperature(8);
    float avgPitchCal = getAvgPitch(16);
    //switch to units "gravity points plus 20" so always positive
    float spGrCal = convertPitch(avgPitchCal) - 980;
    uint8_t sGCal8[1];
    sGCal8[0] = (uint8_t) spGrCal;
    Bean.setScratchData(temperatureScratch, temperatureBuffer, 1);
    Bean.setScratchData(sgScratch, sGCal8, 1);
    // Update LEDs
    ScratchData receivedData = Bean.readScratchData(ledScratch);

    tempOffset = receivedData.data[0];
    sgOffset = receivedData.data[1];

    avgPitchPrev = 0;
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
      if(calibrationState == 0){
        //lower power as long as not calibrating
        Bean.sleep(20000);
      }
      //check if I should sleep more
      if (abs(avgPitch) > 75) {
        if (Bean.getAdvertisingState()) {
          Bean.enableAdvertising(false);
          calibrationState = 0;
        }
        Bean.sleep(30000);
        return;
      }
      else {
        if  (Bean.getAdvertisingState()) {
          //return without updating Beacon Parameters
          return;
        }
        else {
          Bean.enableAdvertising(true);
          return;
        }
      }
      return;
    }
    if (abs(avgPitch) < 75) {
      if (!Bean.getAdvertisingState()) {
        Bean.enableAdvertising(true);
      }
    }

    avgPitchPrev = avgPitch;
    float spGr = convertPitch(avgPitch);

    if (factoryTempOffset == -10.0) {
      //calibration routine
      //starts because temp cal hasn't been set     
      switch (calibrationState) {
        case 0:
          //entering calibration mode
          for (int i = 0; i < 5; i++) {
            delay(200);
            Bean.setLed(255, 255, 0);
            Bean.setLed(0, 0, 0);
          }
          currentCalPoint = 2;  //start with high gravity and end in temp-controlled water
          calibrationState++;
          break;         
        case 1:
          //look for calibration solution
          if ((abs(avgPitchDiff) < .5) && ((avgPitch < calRangesHigh[currentCalPoint]) && (avgPitch > calRangesLow[currentCalPoint]))) {
            avgPitch = 0;
            for (int i = 0; i < 5; i++) {
              avgPitch += 0.2 * getAvgPitch(16);
              delay(200);
              Bean.setLed(0, 0, 255);
              Bean.setLed(0, 0, 0);
            }
            spGr = convertPitch(avgPitch);
            ((uint16_t *)(&(local_name[4])))[currentCalPoint] = (uint16_t) (spGr + 0.5);
            cal[currentCalPoint] = 0.001 * (float)(((uint16_t *)(&(local_name[4])))[currentCalPoint]);
            
            currentCalPoint--;
            if(currentCalPoint<0){
              //move on to temp cal
              tempCalSampleCount = 0;
              calibrationState++;
            }
          }
          //blink green when done with current temperature
          if (currentCalPoint<2){
            if((abs(avgPitchDiff) < 2) && ((avgPitch < calRangesHigh[currentCalPoint+1]) && (avgPitch > calRangesLow[currentCalPoint+1]))) {
               Bean.setLed(0, 255, 0);
               Bean.setLed(0, 0, 0);
            }
          }
          break;
        case 2:
          //temperature
          tempCalSampleCount++;
          if (tempCalSampleCount > calTemperatureIntervals) {
                       
            ((uint16_t *)(&(local_name[4])))[4] = (uint16_t) (calTemperature - temperatureBufferAverage + 10)*10.0;

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
    }
    //keep blinking when calibration is complete until put to sleep
    if(calibrationState==3){
          Bean.setLed(0, 255, 0);
          Bean.setLed(0, 0, 0);     
    }

    int16_t sG16 = (int16_t) (spGr + 0.5);
    int16_t temperatureInt16 = (int16_t)temperatureBufferAverage;

    updateBeaconParameters(temperatureInt16, sG16);
    Bean.sleep(10000);
  }
}






