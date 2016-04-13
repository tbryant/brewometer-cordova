BT_RADIOCONFIG_T radioConfig;
int command = 0;
int counter = 0;

ScratchData inputScratchData;

uint8_t local_name[20];
uint16_t ibeacon_uuid;

int i;

uint8_t tempOffset = 10;
uint8_t sgOffset = 20;
uint16_t batteryVoltage = 0;
float factoryTempOffset = 0;
float cal[4];
double avgPitchPrev;

const int versionNumber = 1;
const uint8_t ledScratch = 1;
const uint8_t temperatureScratch = 2;
const uint8_t sgScratch = 3;
const uint8_t commandScratch = 4;
const uint8_t inputOutputScratch = 5;

int16_t getAvgTemperature(int count) {
  long temperatureBuffer = 0;
  for (int i = 0; i < count; i++) {
    temperatureBuffer += Bean.getTemperature();
  }
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32 + factoryTempOffset + (tempOffset - 10);

  return int16_t(temperatureFahrenheit);
}

float getAvgTemperatureNoCalibration(int count) {
  long temperatureBuffer = 0;
  for (int i = 0; i < count; i++) {
    temperatureBuffer += Bean.getTemperature();
  }
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32.0;

  return temperatureFahrenheit;
}

double getAvgPitch(int count) {
  AccelerationReading accel = {0, 0, 0};
  double x = 0;
  double y = 0;
  double z = 0;
  for (int i = 0; i < count; i++) {
    accel = Bean.getAcceleration();
    x += accel.xAxis;
    y += accel.yAxis;
    z += accel.zAxis;
  }

  double pitch = atan(y / sqrt(x * x + z * z)) *  57.3;
  return pitch;
}

double convertPitch(double avgPitch) {
  double sG  = cal[0] * avgPitch * avgPitch * avgPitch + cal[1] * avgPitch * avgPitch + cal[2] * avgPitch + cal[3] + sgOffset - 20;
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
  local_name[0] = 'B';
  local_name[1] = 'r';
  local_name[2] = 'e';
  local_name[3] = 'w';
  //multiply by appropriate factor per cal coeff
  cal[0] = -0.000001 * (float)(((uint16_t *)(&(local_name[4])))[0]);
  cal[1] = 0.0001 * (float)(((uint16_t *)(&(local_name[4])))[1]);
  cal[2] = -0.001 * (float)(((uint16_t *)(&(local_name[4])))[2]);
  cal[3] = 0.1 * (float)(((uint16_t *)(&(local_name[4])))[3]);
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
    double avgPitchCal = getAvgPitch(16);
    //switch to units "gravity points plus 20" so always positive
    double spGrCal = convertPitch(avgPitchCal) - 980;
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
          local_name[i+4] = inputScratchData.data[i];
        }
        //multiply by appropriate factor per cal coeff
        cal[0] = -0.000001 * (float)(((uint16_t *)(&(local_name[4])))[0]);
        cal[1] = 0.0001 * (float)(((uint16_t *)(&(local_name[4])))[1]);
        cal[2] = -0.001 * (float)(((uint16_t *)(&(local_name[4])))[2]);
        cal[3] = 0.1 * (float)(((uint16_t *)(&(local_name[4])))[3]);
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
        for(i = 0; i<4 ; i++){
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
        for(i = 0; i<4 ; i++){
          tempByteArray[i] = ((uint8_t *)&temp)[i];
        }
        Bean.setScratchData(inputOutputScratch, tempByteArray, 4);
        endCommand();
        break;
      case 8:
        //Version
        Bean.setScratchNumber(inputOutputScratch, versionNumber);
        endCommand();
        break;  
      default:
        Bean.sleep(500);
        break;
    }
  }
  else {
    Bean.setLed(0, 0, 0);
    int16_t temperatureBufferAverage;
    temperatureBufferAverage = getAvgTemperature(8);
    double avgPitch = getAvgPitch(16);
    double avgPitchDiff = avgPitchPrev - avgPitch;
    batteryVoltage = Bean.getBatteryVoltage();

    uint16_t temperatureAndBattery = 1000*(batteryVoltage/10) + temperatureBufferAverage; 

    if (abs(avgPitchDiff) < .25) {
      avgPitchPrev = avgPitch;
      Bean.sleep(20000);
      //check if I should sleep more
      if (abs(avgPitch) > 75) {
        if (Bean.getAdvertisingState()) {
          Bean.enableAdvertising(false);
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
    double spGr = convertPitch(avgPitch);
    int16_t sG16;
    sG16 = (int16_t) (spGr + 0.5);
    //for factory calibrating
    avgPitch *= 100;
    int16_t avgPitch16;
    avgPitch16 = (int16_t) avgPitch;

    updateBeaconParameters(temperatureAndBattery, sG16);
    Bean.sleep(10000);
  }
}





