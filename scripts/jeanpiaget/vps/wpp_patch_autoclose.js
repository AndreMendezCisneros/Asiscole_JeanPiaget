
const fs = require('fs');
const cfg = '/usr/src/wpp-server/node_modules/@wppconnect-team/wppconnect/dist/config/create-config.js';
let s = fs.readFileSync(cfg, 'utf8');
s = s.replace(/autoClose:\s*\d+/, 'autoClose: 0');
s = s.replace(/deviceSyncTimeout:\s*\d+/, 'deviceSyncTimeout: 0');
s = s.replace(/whatsappVersion:\s*'[^']+'/, "whatsappVersion: undefined");
fs.writeFileSync(cfg, s);
console.log('create-config patched');
const c = '/usr/src/wpp-server/dist/config.js';
let t = fs.readFileSync(c, 'utf8');
if (!t.includes('deviceSyncTimeout')) {
  t = t.replace('autoClose: 0,', 'autoClose: 0,\n        deviceSyncTimeout: 0,');
  fs.writeFileSync(c, t);
  console.log('config.js deviceSyncTimeout added');
} else {
  console.log('config.js already has deviceSyncTimeout');
}
