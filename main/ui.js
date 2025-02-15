'use strict'

const { BrowserWindow, app, screen } = require('electron')
const { ipcMain } = require('electron/main')
const { ipcMainEvents } = require('./ipc')
const path = require('path')
const {
  getTrayOperationExplained,
  setTrayOperationExplained,
  getOnboardingCompleted
} = require('./station-config')
const { showDialogSync } = require('./dialog')

/**
 * @param {import('./typings').Context} ctx
 * @returns {Promise<BrowserWindow>}
 */
module.exports = async function (ctx) {
  // Show docks only when UI is visible
  if (app.dock) app.dock.hide()

  const dimensions = screen.getPrimaryDisplay().size
  const ui = new BrowserWindow({
    title: 'Filecoin Station',
    show: false, // we show it via ready-to-show
    width: Math.min(dimensions.width, 1440),
    height: Math.min(dimensions.height, 900),
    minWidth: 1080,
    minHeight: 740,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  /** @type {import('vite').ViteDevServer} */
  let devServer

  if (app.isPackaged || process.env.NODE_ENV !== 'development') {
    ctx.loadWebUIFromDist(ui)
  } else {
    console.log('Starting Vite DEV server')
    const { createServer } = require('vite')
    devServer = await createServer({
      configFile: require.resolve('../vite.config.js'),
      server: {
        port: 3000
      }
    })
    await devServer.listen()

    console.log('Installing React developer tools')
    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS
    } = require('electron-devtools-installer')
    await installExtension(REACT_DEVELOPER_TOOLS).then(
      name => console.log('Added extension:', name),
      error => console.error('Cannot install React developer tools:', error)
    )

    console.log('Opening DevTools')
    ui.webContents.openDevTools()

    console.log('Loading the WebUI')
    ui.loadURL('http://localhost:3000/')
  }

  // UX trick to avoid jittery UI while browser initializes chrome
  ctx.showUI = () => {
    if (app.dock) app.dock.show()
    ui.show()
  }
  // We want the Station to start hidden in the tray.
  // However, when the user did not complete the onboarding flow,
  // we need to show the app to ask them to finish the setup process
  if (!getOnboardingCompleted()) {
    ui.once('ready-to-show', ctx.showUI)
  }

  const stopIpcEventForwarding = setupIpcEventForwarding(ui)

  // Don't exit when window is closed (Quit only via Tray icon menu)
  ui.on('close', (event) => {
    event.preventDefault()
    if (!getTrayOperationExplained()) {
      showDialogSync({
        title: 'Closing Filecoin Station',
        message: 'Station will continue running in the background.'
      })
      setTrayOperationExplained()
    }
    // Hide the window instead of closing it, so that the UI lives on and
    // Plausible doesn't think the app was exited.
    ui.hide()
    if (app.dock) app.dock.hide()
  })

  // When true quit is triggered we need to remove listeners
  // that were added to keep app running when the UI is closed.
  // (Without this, the app would run forever and/or fail to update)
  app.on('before-quit', () => {
    stopIpcEventForwarding()
    ui.removeAllListeners('close')
    devServer?.close()
  })

  return ui
}

/**
 * @param {BrowserWindow} ui
 */
function setupIpcEventForwarding (ui) {
  const onNewActivity = (/** @type {unknown[]} */ ...args) => {
    ui.webContents.send(ipcMainEvents.ACTIVITY_LOGGED, ...args)
  }
  ipcMain.on(ipcMainEvents.ACTIVITY_LOGGED, onNewActivity)

  const onJobStatsUpdated = (/** @type {unknown[]} */ ...args) => {
    ui.webContents.send(ipcMainEvents.JOB_STATS_UPDATED, ...args)
  }
  ipcMain.on(ipcMainEvents.JOB_STATS_UPDATED, onJobStatsUpdated)

  const onUpdateAvailable = (/** @type {unknown[]} */ ...args) => {
    ui.webContents.send(ipcMainEvents.UPDATE_AVAILABLE, ...args)
  }
  ipcMain.on(ipcMainEvents.UPDATE_AVAILABLE, onUpdateAvailable)

  const onTransactionUpdate = (/** @type {unknown[]} */ ...args) => {
    ui.webContents.send(ipcMainEvents.TRANSACTION_UPDATE, ...args)
  }
  ipcMain.on(ipcMainEvents.TRANSACTION_UPDATE, onTransactionUpdate)

  const onBalanceUpdate = (/** @type {unknown[]} */ ...args) => {
    ui.webContents.send(ipcMainEvents.BALANCE_UPDATE, ...args)
  }
  ipcMain.on(ipcMainEvents.BALANCE_UPDATE, onBalanceUpdate)

  return function stopIpcEventForwarding () {
    ipcMain.removeListener(ipcMainEvents.ACTIVITY_LOGGED, onNewActivity)
    ipcMain.removeListener(ipcMainEvents.JOB_STATS_UPDATED, onJobStatsUpdated)
    ipcMain.removeListener(ipcMainEvents.UPDATE_AVAILABLE, onUpdateAvailable)
    ipcMain.removeListener(
      ipcMainEvents.TRANSACTION_UPDATE,
      onTransactionUpdate
    )
    ipcMain.removeListener(ipcMainEvents.BALANCE_UPDATE, onBalanceUpdate)
  }
}
