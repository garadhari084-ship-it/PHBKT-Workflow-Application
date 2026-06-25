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
    
    // Load .env
    const envPath = path.join(__dirname, '.next', 'standalone', '.env');
    let customEnv = {};
    const fs = require('fs');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let key = match[1];
          let value = match[2] || '';
          if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.replace(/(^"|"$)/g, '');
          }
          customEnv[key] = value;
        }
      });
    }

    // Choose a free port
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => {
        // Set ELECTRON_RUN_AS_NODE to run the electron executable as a Node.js instance
        nextProcess = spawn(process.execPath, [serverPath], {
          env: {
            ...process.env,
            ...customEnv,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_ENV: 'production',
            PORT: port.toString(),
            HOSTNAME: '127.0.0.1',
          }
        });

        nextProcess.stdout.on('data', (data) => console.log(`Next.js: ${data}`));
        nextProcess.stderr.on('data', (data) => {
          console.error(`Next.js Error: ${data}`);
        });
        
        nextProcess.on('exit', (code) => {
          console.error(`Next.js exited with code ${code}`);
          win.loadFile(path.join(__dirname, 'error.html')).catch(() => {
            win.loadURL(`data:text/html;charset=utf-8,<html><body><h1>Backend Server Crashed</h1><p>The Next.js server crashed. Please check the console logs.</p></body></html>`);
          });
        });

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
      });
    });
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