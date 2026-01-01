#!/usr/bin/env node

/**
 * Test script to verify serial port connection
 * This mimics what the Python backend was doing
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const SUPPORTED_DEVICES = [
  { vid: 0x1A86, pid: 0x7523, name: 'CH340' },
  { vid: 0x1A86, pid: 0x8040, name: 'CH340K' },
  { vid: 0x04D8, pid: 0xFD92, name: 'EiBotBoard' },
];

async function listPorts() {
  console.log('[Test] Listing available ports...');
  const ports = await SerialPort.list();

  console.log('\nAvailable ports:');
  ports.forEach(port => {
    const isCompatible = SUPPORTED_DEVICES.some(
      dev => port.vendorId === dev.vid.toString(16).toUpperCase().padStart(4, '0') &&
             port.productId === dev.pid.toString(16).toUpperCase().padStart(4, '0')
    );
    console.log(`  ${port.path}`);
    console.log(`    VID: ${port.vendorId}, PID: ${port.productId}`);
    console.log(`    Compatible: ${isCompatible ? 'YES' : 'NO'}`);
    console.log(`    Description: ${port.manufacturer || 'Unknown'}`);
  });

  return ports;
}

async function testConnection(portPath) {
  console.log(`\n[Test] Attempting to connect to ${portPath}...`);

  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: portPath,
      baudRate: 115200,
      autoOpen: false
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('error', (err) => {
      console.error('[Test] Serial port error:', err.message);
      reject(err);
    });

    port.on('open', () => {
      console.log('[Test] Port opened successfully!');

      // Listen for data
      parser.on('data', (data) => {
        console.log('[Test] Received:', data.trim());
      });

      // Wait a bit for device to be ready
      setTimeout(() => {
        console.log('[Test] Sending status query (?)...');
        port.write('?', (err) => {
          if (err) {
            console.error('[Test] Write error:', err);
          }
        });

        // Wait for response
        setTimeout(() => {
          console.log('[Test] Test complete, closing port...');
          port.close(() => {
            console.log('[Test] Port closed');
            resolve(true);
          });
        }, 2000);
      }, 1000);
    });

    port.open((err) => {
      if (err) {
        console.error('[Test] Failed to open port:', err.message);
        reject(err);
      }
    });
  });
}

async function main() {
  try {
    // List all ports
    const ports = await listPorts();

    // Find cu.usbmodem port
    const plotterPort = ports.find(p =>
      p.path.includes('cu.usbmodem') ||
      p.path.includes('tty.usbmodem')
    );

    if (!plotterPort) {
      console.error('\n[Test] ERROR: No plotter port found!');
      process.exit(1);
    }

    console.log(`\n[Test] Found plotter at: ${plotterPort.path}`);

    // Test connection
    await testConnection(plotterPort.path);

    console.log('\n[Test] ✓ All tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n[Test] ✗ Test failed:', error);
    process.exit(1);
  }
}

main();
