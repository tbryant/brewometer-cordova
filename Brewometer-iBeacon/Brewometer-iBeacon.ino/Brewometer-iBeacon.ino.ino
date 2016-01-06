void setup() {
  Bean.setBeanName("Brew");
  Bean.enableConfigSave(false);
  Bean.enableWakeOnConnect(true);
//  Serial.begin(57600);
}
volatile uint8_t tempOffset = 10;
volatile uint8_t sgOffset = 20;
const uint8_t ledScratch = 1;
const uint8_t temperatureScratch = 2;
const uint8_t sgScratch = 3;

int16_t getAvgTemperature(int count) {
  long temperatureBuffer = 0;
  for (int i = 0; i < count; i++) {
    temperatureBuffer += Bean.getTemperature();
  }
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32 - 1 + tempOffset - 10;

  return int16_t(temperatureFahrenheit);
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
  
//  Serial.println(x);
//  Serial.println(y);
//  Serial.println(z);
  double pitch = atan(y/sqrt(x * x + z * z)) *  57.3;
  return pitch;
}

double convertPitch(double avgPitch){
double sG  = -.001174 * avgPitch * avgPitch * avgPitch + .1265 * avgPitch * avgPitch - 6.338 * avgPitch + 1194 + .5 + sgOffset - 20;
return sG;
    }

volatile double avgPitchPrev;
void loop() {
bool connected = Bean.getConnectionState();

  if(connected) {
  Bean.setLed(0, 127, 0);
  delay(500);
  Bean.setLed(0,0,0);
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
    uint8_t blueLed = receivedData.data[2];
        avgPitchPrev = 0;
  }
    else {
  int16_t temperatureBufferAverage;
  temperatureBufferAverage = getAvgTemperature(8);
  double avgPitch = getAvgPitch(16);
  double avgPitchDiff = avgPitchPrev - avgPitch;
  
//  Serial.println(avgPitchDiff);
//  Serial.println(avgPitchPrev);
//  Serial.println(avgPitch);
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
  Bean.setBeaconParameters(0xBB20, temperatureBufferAverage, sG16);
  Bean.setBeaconEnable(true);
  Bean.sleep(10000);
}
    }
