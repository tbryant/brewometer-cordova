BT_RADIOCONFIG_T radioConfig;
int command = 0;
int counter = 0;

ScratchData inputScratch;

uint8_t local_name[20];
uint16_t ibeacon_uuid;

int i;

void setup() {
  //read name (cal coefficients) from persistent memory
  Bean.getRadioConfig(&radioConfig);
  for ( i = 0 ; i < 20 ; i++) {
    local_name[i] = radioConfig.local_name[i];
  }
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
  Bean.setScratchNumber(4, command);
  Bean.setLed(0, 0, 0);
}

void loop()
{
  updateBeaconParameters(counter, counter);
  counter++;
  if ( Bean.getConnectionState() ) {
    //connected
    //look for command in Scratch 4
    bool newCommand = false;
    if (command != Bean.readScratchNumber(4)) {
      newCommand = true;
      command = Bean.readScratchNumber(4);
      Bean.setLed(0, 0, 255);
    }

    switch (command) {
      case 1:
        //Read
        Bean.setScratchData(5, local_name, 20);
        endCommand();
        break;
      case 2:
        //Write
        inputScratch = Bean.readScratchData(5);
        for (int i = 0; i < 20 ; i++) {
          local_name[i] = inputScratch.data[i];
        }

        endCommand();
        break;
      case 3:
        //Save Calibration : Write Config with save
        resetRadioConfig();
        Bean.setRadioConfig(radioConfig, true);
        endCommand();
        break;
      case 4:


        endCommand();
        break;
      default:
        Bean.sleep(500);
        break;
    }
  }
}





