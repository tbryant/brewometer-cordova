BT_RADIOCONFIG_T radioConfig;

void setup() {
  Bean.enableConfigSave(false);
  Bean.setBeaconEnable(true);
  Bean.setBeanName("Brew");
  Bean.getRadioConfig(&radioConfig);
  Serial.begin(9600);
  printRadioConfig();

}

int counter = 0;

void printRadioConfig() {
  Bean.getRadioConfig(&radioConfig);
  Serial.print("adv_int: ");
  Serial.println(radioConfig.adv_int);
  Serial.print("conn_int: ");
  Serial.println(radioConfig.conn_int);
  Serial.print("power: ");
  Serial.println(radioConfig.power);
  Serial.print("adv_mode: ");
  Serial.println(radioConfig.adv_mode);
  Serial.print("ibeacon_uuid: ");
  Serial.println(radioConfig.ibeacon_uuid);
  Serial.print("ibeacon_major: ");
  Serial.println(radioConfig.ibeacon_major);
  Serial.print("ibeacon_minor: ");
  Serial.println(radioConfig.ibeacon_minor);
  Serial.print("local_name: ");
  Serial.println(radioConfig.local_name[0]);
  Serial.print("local_name_size: ");
  Serial.println(radioConfig.local_name_size);
}

void loop() {
  if (counter % 1000 == 1) {    
    printRadioConfig();
  }
  //Bean.setBeaconParameters(0xBB30, counter, radioConfig.adv_mode);
  Bean.setBrewometerParameters(radioConfig, 0xBB30, counter, radioConfig.adv_mode);

  counter++;
}


