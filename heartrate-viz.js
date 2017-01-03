// --- Initial settings --- //
var config = require('./config.js');
var c8y_user = config.id;
var c8y_password = config.password;
var c8y_device_id = config.deviceid;
var c8y_url = "http://" + config.tenant + ".cumulocity.com/measurement/measurements/";

// --- Node.js libraries --- //
var noble = require('noble');
var Client = require('node-rest-client').Client;
var options_auth = { user: c8y_user, password: c8y_password };
var client = new Client(options_auth);

// --- BLE handling using noble --- //
console.log("Scanning BLE devices...");
noble
  .on('stateChange', function(state) {
    if (state === 'poweredOn') { 
      // Scan for peripherals broadcasting the heart rate service and use the first one discovered
      noble.startScanning(["180d"]);
    } else {
      noble.stopScanning();
    }
  })
  .on('discover', function(peripheral) {
    // Stop scanning once a peripheral is discovered
    noble.stopScanning();
    console.log("DISCOVERED: " + peripheral);

    // connect to the peripherals
    peripheral.connect(function(error) {
      var serviceUUID = ["180d"];
      var characteristicUUID = ["2a37"];
      console.log("CONNECTED: " + peripheral);

      peripheral.discoverSomeServicesAndCharacteristics(serviceUUID, characteristicUUID, function(error, services, characteristics){
        characteristics[0].notify(true, function(error){
          characteristics[0].on('data', function(data, isNotification){
            // parsing RRIs
            rri1 = (data[3] << 8) + data[2];
            rri2 = (data[5] << 8) + data[4];
            console.log('Flag: ' + data[0] + '  HBR:' + data[1] + '  RRI1:' + rri1 + '  RRI2:' + rri2);
            var formatted = new Date().toISOString();
            var args = {
              data: '{"c8y_TemperatureMeasurement":{"T":{"value":' + data[1] + ',"unit":"C"}},"time":"' + formatted + '","source":{"id": "' + c8y_device_id + '"},"type":"c8y_PTCMeasurement"}'
            }

            client.post(c8y_url, args, function (body, response) {
                console.log(body);      // parsed response body as js object 
                console.log(response);  // raw response 
            });
            rri1 = 0;
            rri2 = 0;
          });
        });
      });
    });

    peripheral.on('disconnect', function() {
      console.log("DISCONNECTED: " + peripheral);
      noble.startScanning(["180d"]);
//      process.exit(0);
    });
  });








