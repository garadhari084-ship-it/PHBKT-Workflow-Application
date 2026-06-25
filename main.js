const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let nextProcess;

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
    // Packaged app uses standalone Next.js server
    const serverPath = path.join(__dirname, '.next', 'standalone', 'server.js');
    
    // Choose a free port or default to 3000
    const port = 3000;
    
    // Set ELECTRON_RUN_AS_NODE to run the electron executable as a Node.js instance
    nextProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: port,
        HOSTNAME: '127.0.0.1',
      }
    });

    nextProcess.stdout.on('data', (data) => console.log(`Next.js: ${data}`));
    nextProcess.stderr.on('data', (data) => console.error(`Next.js Error: ${data}`));

    // Wait for the Next.js server to start
    const checkServer = () => {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          win.loadURL(`http://127.0.0.1:${port}`);
        } else {
          setTimeout(checkServer, 200);
        }
      });
      req.on('error', () => {
        setTimeout(checkServer, 200);
      });
    };
    
    // Initial delay to let Node start
    setTimeout(checkServer, 500);
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

app.on('quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});