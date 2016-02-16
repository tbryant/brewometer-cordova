BT_RADIOCONFIG_T radioConfig;
int command = 0;
int counter = 0;

ScratchData inputScratchData;

uint8_t local_name[20];
uint16_t ibeacon_uuid;

int i;

uint8_t tempOffset = 10;
uint8_t sgOffset = 20;
double avgPitchPrev;

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
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32 - 1 + tempOffset - 10;

  return int16_t(temperatureFahrenheit);
}

float cal(int index){
  return ((float *)local_name)[index+1];
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
  double sG  = cal(0) * avgPitch * avgPitch * avgPitch + cal(1) * avgPitch * avgPitch + cal(2) * avgPitch + cal(3) + .5 + sgOffset - 20;
  return sG;
}

void setup() {
  Bean.enableWakeOnConnect(true);
  //read name (cal coefficients) from persistent memory
  Bean.getRadioConfig(&radioConfig);
  for ( i = 0 ; i < 20 ; i++) {
    local_name[i] = radioConfig.local_name[i];
  }
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
  radioConfig.local_name_size = 4;
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
  updateBeaconParameters(counter, counter);
  counter++;
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

    //look for command in Scratch 4
    bool newCommand = false;
    if (command != Bean.readScratchNumber(commandScratch)) {
      newCommand = true;
      command = Bean.readScratchNumber(commandScratch);
      Bean.setLed(0, 0, 255);
    }

    switch (command) {
      case 1:
        //Read
        Bean.setScratchData(inputOutputScratch, local_name, 20);
        endCommand();
        break;
      case 2:
        //Write
        inputScratchData = Bean.readScratchData(inputOutputScratch);
        for (int i = 0; i < 20 ; i++) {
          local_name[i] = inputScratchData.data[i];
        }
        endCommand();
        break;
      case 3:
        //Read
        Bean.setScratchData(inputOutputScratch, (uint8_t *)&ibeacon_uuid, 2);
        endCommand();
        break;
      case 4:
        //Write
        inputScratchData = Bean.readScratchData(inputOutputScratch);
        for (int i = 0; i < 2 ; i++) {
          ((uint8_t *)ibeacon_uuid)[i] = inputScratchData.data[i];
        }
        endCommand();
        break;
      case 5:
        //Save Calibration : Write Config with save
        resetRadioConfig();
        Bean.setRadioConfig(radioConfig, true);
        endCommand();
        break;
      case 6:


        endCommand();
        break;
      default:
        //Bean.sleep(500);
        break;
    }
  }
  else {
    Bean.setLed(0, 0, 0);
    int16_t temperatureBufferAverage;
    temperatureBufferAverage = getAvgTemperature(8);
    double avgPitch = getAvgPitch(16);
    double avgPitchDiff = avgPitchPrev - avgPitch;

    if (abs(avgPitchDiff) < .34) {
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
    sG16 = (int16_t) spGr;
    //for factory calibrating
    avgPitch *= 100;
    int16_t avgPitch16;
    avgPitch16 = (int16_t) avgPitch;

    //  Serial.println(sG);
    //  Serial.println(sG16);
    updateBeaconParameters(temperatureBufferAverage, sG16);
    Bean.sleep(10000);
  }
}





