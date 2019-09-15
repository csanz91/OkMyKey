const serialport = require('serialport')
const Delimiter = require('@serialport/parser-delimiter')
const { dialog } = require('electron').remote
var fs = require('fs');

const PRESS_MODE = "1";
const PRINT_MODE = "2";
const keyPrefix = "S";
const settingsHeader = "button settings: ";
const infoHeader = "Info: ";

var portSelected = "";
var selectedKey;
var settingsAction = "";
var port;
var buttonsSettings = {};

var deviceInfo = {
  buttonsNum: 0,
  version: "undefined",
  commandMaxLenght: 0,
  maxCommandsNum: 0,
};


const keysMap = {
  0x80: 'Ctrl',
  0x82: 'Alt',
  0x81: 'Shift',
  0xB3: 'Tab',
  0x83: 'Win',
  0xB2: 'Backspace',
  0xDA: 'Up',
  0xD9: 'Down',
  0xD8: 'Left',
  0xD7: 'Right',
  0xC2: 'F1',
  0xC3: 'F2',
  0xC4: 'F3',
  0xC5: 'F4',
  0xC6: 'F5',
  0xC7: 'F6',
  0xC8: 'F7',
  0xC9: 'F8',
  0xCA: 'F9',
  0xCB: 'F10',
  0xCC: 'F11',
  0xCD: 'F12'
}

// Gets the character representation.
function getKeyName(key) {
  var keyCode = key.charCodeAt(0); // charCodeAt is needed because the keysMap uses the hex representation for more clarity
  var keyName = keysMap[keyCode];
  if (keyName === undefined) return key;
  return keyName;
}

// Gets the character code from its representation form
function getKeyCode(keyName) {
  for (var keyCode in keysMap) {
    if (keysMap[keyCode] == keyName)
      return String.fromCharCode(keyCode); // fromCharCode is needed becausebecause the keysMap uses the hex representation for more clarity
  }
  return keyName;
}

function exportSettings() {
  // You can obviously give a direct path without use the dialog (C:/Program Files/path/myfileexample.txt)
  dialog.showSaveDialog((fileName) => {
    if (fileName === undefined) {
      console.log("You didn't save the file");
      return;
    }

    var settings = "";
    for (let i = 0; i < deviceInfo.buttonsNum; i++) {
      settings += `${buttonsSettings[i].toRaw()}\n`;
    }

    // fileName is a string that contains the path and filename created in the save file dialog.  
    fs.writeFile(fileName, settings, (err) => {
      if (err) {
        alert("An error ocurred creating the file " + err.message)
      }
    });
  });
}

function importSettings() {
  dialog.showOpenDialog((fileNames) => {
    // fileNames is an array that contains all the selected files
    if (fileNames === undefined) {
      console.log("No file selected");
      return;
    }

    fs.readFile(fileNames[0], 'utf-8', (err, data) => {
      if (err) {
        alert("An error ocurred reading the file :" + err.message);
        return;
      }

      var lines = data.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        decodeButtonSettings(lines[i]);
        if (selectedKey)
          loadButtonSettings();
      }
    });
  });
}

class ButtonSetting {
  constructor(rawSettings) {

    var settingsList = rawSettings.split("|");

    // Gets and validates the button number
    var buttonNumber = settingsList.shift();
    if (buttonNumber < 0 || buttonNumber >= deviceInfo.buttonsNum)
      throw `${buttonNumber} is not a valid button number`;
    this.buttonNumber = buttonNumber;

    // Gets and validates the button mode  
    var mode = settingsList.shift();
    if (mode != PRESS_MODE && mode != PRINT_MODE)
      throw `${mode} is not a valid mode`;
    this.mode = mode;

    // Get the commands
    this.commands = settingsList.map(getKeyName);
  }

  // Generates a raw string for the device
  toRaw() {
    var rawSettings = `${this.buttonNumber}|${this.mode}|${this.commands.map(getKeyCode).join("|")}`;
    return rawSettings;
  }
}

function requestDeviceInfo() {
  port.write(`info\n`);
}

function requestDeviceSettings() {
  for (let i = 0; i < deviceInfo.buttonsNum; i++) {
    port.write(`getSettings ${i}\n`);
  }
}

function saveDeviceSettings() {
  for (let i = 0; i < deviceInfo.buttonsNum; i++) {
    port.write(`${buttonsSettings[i].toRaw()}\n`);
  }
}

function decodeDeviceInfo(deviceInfoRaw) {
  // Remove the header from the data
  deviceInfoRaw = deviceInfoRaw.replace(infoHeader, "");

  var deviceInfoList = deviceInfoRaw.split(" ");
  if (deviceInfoList.length != 4) {
    console.log(`Unexpected device info received: ${deviceInfoRaw}. Expected 4 values, received: ${deviceInfoList.length}.`);
    return false;
  }

  deviceInfo.buttonsNum = deviceInfoList[0];
  deviceInfo.version = deviceInfoList[1];
  deviceInfo.commandMaxLenght = deviceInfoList[2];
  deviceInfo.maxCommandsNum = deviceInfoList[3];

  return true;
}

function decodeButtonSettings(buttonSettingsRaw) {
  // Remove the header from the data
  buttonSettingsRaw = buttonSettingsRaw.replace(settingsHeader, "");

  // Try to decode the data
  try {
    var buttonSettings = new ButtonSetting(buttonSettingsRaw);
  } catch (err) {
    console.log(`Failed to decode the button settings. Raw settings: ${buttonSettingsRaw}. Error: ${err.message}`);
    return false;
  }
  // Save the decoded data
  buttonsSettings[buttonSettings.buttonNumber] = buttonSettings;
  return true
}

function onPortOpened(portName) {
  $('#ports-error').html("");
  $('#ports-selection').text(portName);
  $('#ports-hint').hide();
  $('#ports-hint-icon').hide();
  $('#button-selection-container').show();
  $('#device-data-transfer').show();
}

function onPortClosed() {
  $('#ports-error').html("");
  $('#ports-selection').text("Serial Ports");
  $('#ports-hint').show();
  $('#ports-hint-icon').show();
  $('#button-selection-container').hide();
  $('#settings-area').hide();
  $('#settings-area-mode').hide();
  $('#device-data-controls').hide();
  $('#device-data-controls-confirmation').hide();
  $('#device-data-transfer').hide();
}

function populateButtons() {
  return;
  // Populate the list of ports
  $('#keyboard').html("");
  for (let i = 0; i < deviceInfo.buttonsNum; i++) {
    $('#keyboard').append(`<li class="letter">${keyPrefix}${i}</li>`);
  }
}

function loadButtonSettings() {
  // Get the button settings
  buttonSetting = buttonsSettings[selectedKey];
  // Abort if the settings are not available
  if (!buttonSetting) return;

  if (buttonSetting.mode === PRESS_MODE) {
    $('#press-mode').click();
    $('#press-mode-input').val(buttonSetting.commands.map(getKeyName).join('+'));
    $('#text-input').val("");
  } else if (buttonSetting.mode === PRINT_MODE) {
    $('#print-mode').click();
    $('#text-input').val(buttonSetting.commands.join(''));
    $('#press-mode-input').val("");
  }
  $('#press-mode-input').removeClass("is-invalid");
  $('#text-input').removeClass("is-invalid");
  $('#device-data-controls-confirmation').hide();
}

function setInputTextMaxLenght() {
  $("#text-input").attr('maxlength', deviceInfo.commandMaxLenght);
}

function getSerialPorts() {
  serialport.list((err, ports) => {
    // Check for errors
    if (err) {
      $('#ports-error').html(err.message);
      return
    } else {
      $('#ports-error').html('');
    }

    // No ports available error
    if (ports.length === 0) {
      $('#ports-error').html('No ports discovered');
    }

    // Populate the list of ports
    $('#ports-selection-list').html("");
    for (portIdx in ports) {
      var portData = ports[portIdx];
      if (!portData.comName || !portData.serialNumber) continue;
      $('#ports-selection-list').append(`<a class="dropdown-item" name="port-selection" href="#">${portData.comName}</a>`)
    }

    // Initial sequence:
    // 1. A port is selected
    // 2. Try to connect to the serial port
    // 3. Request device info
    // 4. Receive, decode and save the device info. Show the key selection
    // 5. Request buttons configuration
    // 6. Receive, decode, save the buttons config.

    // When a port is selected
    $("a[name$='port-selection']").click(async function () {
      // If the port is already selected, abort
      //if ($(this).text() === portSelected) return;

      if (port && port.isOpen) {
        await port.close();
      }

      portSelected = $(this).text();
      // Open the selected port
      port = new serialport(portSelected, function (err) {
        if (err) {
          onPortClosed();
          $('#ports-error').html(err.message);
          return console.log('Error: ', err.message)
        }
        const parser = port.pipe(new Delimiter({ delimiter: '\n' }));

        // Receive data from the serial port
        parser.on('data', function (data) {
          // Parse an array of dec chars into an string
          var buttonSettingsRaw = String.fromCharCode(...data);

          // Decode the received data
          if (buttonSettingsRaw.includes(settingsHeader)) {
            if (decodeButtonSettings(buttonSettingsRaw)) {
              // Load the received data for the selected key into the settings
              populateButtons();
              if (selectedKey)
                loadButtonSettings();
            }
          } else if (buttonSettingsRaw.includes(infoHeader)) {
            if (decodeDeviceInfo(buttonSettingsRaw)) {
              requestDeviceSettings();
              setInputTextMaxLenght();
              onPortOpened(portSelected);
            }
          }
        })

        port.on('close', err => {
          onPortClosed();
          getSerialPorts();
          console.log('Closed', err)
        })
        requestDeviceInfo();
      })
    })
  })
}

$(() => {

  ////////////////////////
  // Ports
  ////////////////////////
  getSerialPorts();

  $('#refresh-ports').click(function () {
    getSerialPorts();
  })

  ////////////////////////
  // Key selection
  ////////////////////////

  $("input[name$='letter']").click(function () {
    $(this).button('toggle');
  })

  $('#keyboard li').click(function () {
    var $this = $(this),
      key = $this.html(); // If it's a lowercase letter, nothing happens to this variable

    selectedKey = parseInt(key.replace(keyPrefix, ""), 10) - 1;

    // Load the button settings into the input fields
    loadButtonSettings();

    // Mark the button as selected
    $(".letter").removeClass('selected')
    $(this).addClass('selected');

    $('#settings-area').show();
    $('#settings-area-mode').show();
    $('#device-data-controls').show();
  });

  ////////////////////////
  // Key Mode
  ////////////////////////

  // Change the mode settings view
  $("input[name$='button-modes']").change(function () {
    if (this.value == 'press-mode') {
      $('#press-mode-settings').show();
      $('#print-mode-settings').hide();
    }
    else if (this.value == 'print-mode') {
      $('#press-mode-settings').hide();
      $('#print-mode-settings').show();
    }
  })

  ////////////////////////
  // Keys capture
  ////////////////////////

  // An special button key has been pressed
  $("a[name$='press-mode-special-key']").click(function () {
    var currentText = $('#press-mode-input').val();
    if (currentText) {
      currentText += "+"
    }
    $('#press-mode-input').val(currentText + $(this).text());
  })


  ////////////////////////
  // Device data actions
  ////////////////////////
  $('#save-settings').click(function () {
    settingsAction = "save";
    $('#device-data-controls-confirmation').show();
  });

  $('#upload-settings').click(function () {
    settingsAction = "upload";
    $('#device-data-controls-confirmation').show();
  });

  $('#cancel-settings').click(function () {
    settingsAction = "";
    $('#device-data-controls-confirmation').hide();
  });

  $('#confirm-settings').click(function () {
    if (settingsAction === "save")
      saveDeviceSettings();
    else if (settingsAction === "upload")
      requestDeviceSettings();

    $('#device-data-controls-confirmation').hide();
  });

  $('#import-settings').click(function () {
    importSettings();
  });

  $('#export-settings').click(function () {
    exportSettings();
  });

  ////////////////////////
  // Settings changed
  ////////////////////////

  // Text input has changed
  $('#text-input').on('propertychange change keyup paste input', function () {
    var inputText = $(this).val();
    // Check the maximum lenght
    if (inputText.length > deviceInfo.commandMaxLenght) {
      $('#text-input').addClass("is-invalid");
      return;
    };

    if (inputText.includes('|')) {
      console.log("Forbidden character");
      $('#text-input').addClass("is-invalid");
      return;
    }

    var buttonsSetting = buttonsSettings[selectedKey];
    buttonsSetting.mode = PRINT_MODE;
    buttonsSetting.commands = [inputText];

    $('#text-input').removeClass("is-invalid");
  })


  // Key commands input has changed
  $('#press-mode-input').on('propertychange change keyup paste input', function () {
    console.log("changed: ", selectedKey);

    // Check the lenght of the commands combined. The '+' char is equivalent to the '|' so leave it
    var commands = $(this).val();
    if (commands.length > deviceInfo.commandMaxLenght) {
      console.log("Too long");
      $('#press-mode-input').addClass("is-invalid");
      return;
    }

    if (commands.includes('|')) {
      console.log("Forbidden character");
      $('#press-mode-input').addClass("is-invalid");
      return;
    }

    // Check the number of commands
    var commandsList = commands.split("+");
    if (commandsList.length > deviceInfo.maxCommandsNum) {
      console.log("Too many commands");
      $('#press-mode-input').addClass("is-invalid");
      return;
    }

    // Check that the commands are valid
    var specialKeysRepresentation = Object.values(keysMap);
    for (commandIdx in commandsList) {
      var command = commandsList[commandIdx];
      if (command.length == 1 || specialKeysRepresentation.includes(command)) {
        continue;
      } else {
        console.log(`Command: '${command}' malformed`);
        $('#press-mode-input').addClass("is-invalid");
        return;
      }
    }

    var buttonsSetting = buttonsSettings[selectedKey];
    buttonsSetting.mode = PRESS_MODE;
    buttonsSetting.commands = commandsList.map(getKeyCode);

    $('#press-mode-input').removeClass("is-invalid");
  })
})
