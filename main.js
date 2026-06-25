const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // Check if we are running in dev or prod
  if (app.isPackaged) {
    // Packaged app uses static export (Next.js out folder)
    win.loadFile(path.join(__dirname, 'out', 'index.html'));
  } else {
    // For development, load the Next.js dev server
    win.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
