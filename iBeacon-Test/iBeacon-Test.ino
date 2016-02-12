BT_RADIOCONFIG_T radioConfig;


void setup() {
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

void resetRadioConfig(){
  radioConfig.adv_int = 500;
  radioConfig.conn_int = 20;
  radioConfig.power = 3;
  radioConfig.adv_mode = 1;
  radioConfig.ibeacon_uuid = 0xBB30;
  radioConfig.ibeacon_major = 0;
  radioConfig.ibeacon_minor = 0;
  radioConfig.local_name[0] = 'B';  
  radioConfig.local_name[1] = 'r';  
  radioConfig.local_name[2] = 'e';  
  radioConfig.local_name[3] = 'w';
  radioConfig.local_name_size = 4;
}

void loop() {
  if (counter % 1000 == 1) {
    printRadioConfig();
  }
  
  resetRadioConfig();
  radioConfig.ibeacon_uuid = 0xBB30;
  radioConfig.ibeacon_major = counter;
  radioConfig.ibeacon_minor = counter;
  Bean.setRadioConfig(radioConfig);

  counter++;
}


