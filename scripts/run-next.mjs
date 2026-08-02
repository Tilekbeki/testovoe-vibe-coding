import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

const [command = 'dev', ...args] = process.argv.slice(2);
const nextBin = path.resolve(process.cwd(), 'node_modules/next/dist/bin/next');
const projectDir = path.resolve(process.cwd(), 'frontend');
const env = {
  ...process.env,
  ...readEnvFile(path.resolve(process.cwd(), '.env'))
};

const child = spawn(process.execPath, [nextBin, command, projectDir, ...args], {
  env,
  stdio: 'inherit',
  windowsHide: false
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
