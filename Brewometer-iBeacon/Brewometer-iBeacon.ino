void setup() {
  Bean.enableConfigSave(false);
//  Serial.begin(57600);
}

int16_t getAvgTemperature(int count) {
  long temperatureBuffer = 0;
  for (int i = 0; i < count; i++) {
    temperatureBuffer += Bean.getTemperature();
  }
  float temperatureFahrenheit = (((float)temperatureBuffer / count) * 1.8) + 32;

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

volatile double avgPitchPrev;

void loop() {
  int16_t temperatureBufferAverage;
  temperatureBufferAverage = getAvgTemperature(8);
  double avgPitch = getAvgPitch(16);
  double avgPitchDiff = avgPitchPrev - avgPitch;
  
//  Serial.println(avgPitchDiff);
//  Serial.println(avgPitchPrev);
//  Serial.println(avgPitch);
  if (abs(avgPitchDiff) < .126) {
    avgPitchPrev = avgPitch;
    Bean.sleep(20000);
    //check if I should sleep more
    if (abs(avgPitch) > 70) {
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
  if (abs(avgPitch) < 70) {
    if (!Bean.getAdvertisingState()) {
      Bean.enableAdvertising(true);
    }
  }

  avgPitchPrev = avgPitch;
  double sG = -.0013790 * avgPitch * avgPitch * avgPitch + .14444 * avgPitch * avgPitch - 6.6003 * avgPitch + 1176.0 + .5;
  int16_t sG16;
  sG16 = (int16_t) sG;
  avgPitch *= 100;
  int16_t avgPitch16;
  avgPitch16 = (int16_t) avgPitch;

//  Serial.println(sG);
//  Serial.println(sG16);
  Bean.setBeaconParameters(0xBB30, temperatureBufferAverage, sG16);
  Bean.setBeaconEnable(true);
  Bean.sleep(8000);
}
