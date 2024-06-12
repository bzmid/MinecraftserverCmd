const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn } = require('child_process');
const iconv = require('iconv-lite');
const AnsiToHtml = require('ansi-to-html');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let cmdOutput = '';
const ansiToHtml = new AnsiToHtml({
  newline: true,
  escapeXML: true
});

let mcServerProcess;
let isMcServerRunning = false;

const startMCServer = () => {
  if (mcServerProcess) {
    mcServerProcess.kill();
  }
  mcServerProcess = spawn('C:\\Java17\\jdk-17\\bin\\java.exe', ['-jar', 'CatServer-1.18.2-edda1229-server.jar'], {
    cwd: 'C:\\server',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcServerProcess.stdout.on('data', (data) => {
    const output = iconv.decode(data, 'gbk');
    const htmlOutput = ansiToHtml.toHtml(output);
    cmdOutput += htmlOutput;
    io.emit('cmdOutput', htmlOutput);
  });

  mcServerProcess.stderr.on('data', (data) => {
    const output = iconv.decode(data, 'gbk');
    const htmlOutput = ansiToHtml.toHtml(output);
    cmdOutput += htmlOutput;
    io.emit('cmdOutput', htmlOutput);
  });

  mcServerProcess.on('close', (code) => {
    const output = `MC server exited with code ${code}\n`;
    const htmlOutput = ansiToHtml.toHtml(output);
    cmdOutput += htmlOutput;
    io.emit('cmdOutput', htmlOutput);
    isMcServerRunning = false;
    io.emit('mcServerStatus', 'stopped');
  });

  isMcServerRunning = true;
  io.emit('mcServerStatus', 'running');
};

const sendCommand = (command) => {
  if (isMcServerRunning) {
    sendMCCommand(command);
  } else {
    if (cmdProcess) {
      cmdProcess.stdin.write(iconv.encode(command + '\n', 'gbk'));
    }
  }
};

const sendMCCommand = (command) => {
  if (mcServerProcess) {
    mcServerProcess.stdin.write(iconv.encode(command + '\n', 'gbk'));
  }
};

let cmdProcess;

const startCmdProcess = () => {
  cmdProcess = spawn('cmd.exe', [], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  cmdProcess.stdout.on('data', (data) => {
    const output = iconv.decode(data, 'gbk');
    const htmlOutput = ansiToHtml.toHtml(output);
    cmdOutput += htmlOutput;
    io.emit('cmdOutput', htmlOutput);
  });

  cmdProcess.stderr.on('data', (data) => {
    const output = iconv.decode(data, 'gbk');
    const htmlOutput = ansiToHtml.toHtml(output);
    cmdOutput += htmlOutput;
    io.emit('cmdOutput', htmlOutput);
  });
};

// Start CMD process
startCmdProcess();
startMCServer();

io.on('connection', (socket) => {
  console.log('New client connected');

  // Send the existing CMD output to the new client
  socket.emit('cmdOutput', cmdOutput);

  // Send the MC server status to the new client
  socket.emit('mcServerStatus', isMcServerRunning ? 'running' : 'stopped');

  socket.on('executeCommand', (command) => {
    console.log(`Received command: ${command}`);
    sendCommand(command);
  });

  socket.on('startMCServer', () => {
    if (!isMcServerRunning) {
      console.log('Starting MC server');
      startMCServer();
    }
  });

  socket.on('restartMCServer', () => {
    if (isMcServerRunning) {
      console.log('Restarting MC server');
      sendMCCommand('reload');
    }
  });

  socket.on('stopMCServer', () => {
    if (isMcServerRunning) {
      console.log('Stopping MC server');
      sendMCCommand('stop');
      mcServerProcess.on('close', () => {
        mcServerProcess = null;
        isMcServerRunning = false;
        io.emit('mcServerStatus', 'stopped');
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
