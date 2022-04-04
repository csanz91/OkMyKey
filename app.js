const { app, BrowserWindow } = require('electron')
const path = require('path')
const url = require('url')
//require('electron-reload')(__dirname);

let window = null

// Wait until the app is ready
app.once('ready', () => {
  // Create a new window
  window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true, // to allow require
      contextIsolation: false, // allow use with Electron 12+
      enableRemoteModule: true, // allow use with Electron 12+
    },
    
    // Set the initial width to 800px
    width: 450,
    // Set the initial height to 600px
    height: 560,
    // Set the default background color of the window to match the CSS
    // background color of the page, this prevents any white flickering
    backgroundColor: "#D6D8DC",
    // Don't show the window until it's ready, this prevents any white flickering
    show: false,
    // Dont allow the window to be resizable
    //resizable: false
  })
  //window.webContents.openDevTools();
  require('@electron/remote/main').initialize()
  require("@electron/remote/main").enable(window.webContents)

  // Don't show the menu
  window.setMenu(null);

  // Load a URL in the window to the local index.html path
  window.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Show window when page is ready
  window.once('ready-to-show', () => {
    window.show()
  })
})

app.on('window-all-closed', () => {
  app.quit();
});
