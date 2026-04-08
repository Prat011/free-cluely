// Launcher script that ensures ELECTRON_RUN_AS_NODE is not set
// This is needed because ELECTRON_RUN_AS_NODE=1 in the system environment
// forces Electron to run as Node.js instead of the browser process
delete process.env.ELECTRON_RUN_AS_NODE;

const proc = require('child_process');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = proc.spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: env
});

child.on('close', (code) => process.exit(code || 0));
child.on('error', (err) => {
    console.error('Failed to start electron:', err);
    process.exit(1);
});
