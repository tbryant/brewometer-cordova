void setup() {
Bean.enableConfigSave(false);
//Serial.begin(57600);
}
int getAvgAccel(){
    AccelerationReading accel = {0, 0, 0};
    accel = Bean.getAcceleration();
    double x = accel.xAxis;
        x *= 3.914;
    double y = accel.yAxis;
        y *= 3.914;
    double z = accel.zAxis;
        z *= 3.914;
        double pitch = abs(atan(y/sqrt(x * x + z * z)) * 57.3);
        return pitch;
        }

volatile double avgPitchPrev;

void loop() {
    double temperatureBuffer;
	temperatureBuffer = Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    temperatureBuffer += Bean.getTemperature();
    double temperatureBufferAverage =(temperatureBuffer / 8) * 1.8 + 32 + .5;// + tempCal;
    int16_t temperatureBufferAverage16;
    temperatureBufferAverage16 = int16_t(temperatureBufferAverage);
    double avgPitch = getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch += getAvgAccel();
avgPitch /= 16;
double avgPitchDiff = abs(avgPitchPrev - avgPitch);
//Serial.println(avgPitchDiff);
//Serial.println(avgPitchPrev);
//Serial.println(avgPitch);
if (avgPitchDiff < .126){
        avgPitchPrev = avgPitch;
        Bean.sleep(20000);
        //check if I should sleep more
        if (avgPitch > 70) {
            
       if (Bean.getAdvertisingState()) {
         Bean.enableAdvertising(false);
                }
            Bean.sleep(30000);
            return;
            }
        else {
     if  (Bean.getAdvertisingState()) {
                return;
                }
            else {
      Bean.enableAdvertising(true);
                return;
                }
            }
        return;   
}
avgPitchPrev = avgPitch;
double sG = -.0013790 * avgPitch * avgPitch * avgPitch + .14444 * avgPitch * avgPitch - 6.6003 * avgPitch + 1176.0 + .5;
    int16_t sG16;
sG16 = (int16_t) sG;
avgPitch *= 100;
int16_t avgPitch16;
avgPitch16 = (int16_t) avgPitch;
   
//Serial.println(sG);
//Serial.println(sG16);
Bean.setBeaconParameters(0xBB30,temperatureBufferAverage16,sG16);
Bean.setBeaconEnable(true);
Bean.sleep(8000);
}