import { spawnSync } from 'node:child_process';

const [, , scriptPath, ...scriptArgs] = process.argv;

if (!scriptPath) {
  console.error('Usage: node electron/scripts/run-python.mjs <script> [args...]');
  process.exit(2);
}

const configuredPython = (() => {
  const root = process.env.pythonLocation;
  if (!root) {
    return null;
  }

  return process.platform === 'win32' ? `${root}\\python.exe` : `${root}/python`;
})();

const candidates = process.platform === 'win32'
  ? [
      ...(configuredPython ? [[configuredPython, []]] : []),
      ['python', []],
      ['python3', []],
      ['py', ['-3.11']],
      ['py', ['-3']],
    ]
  : [
      ...(configuredPython ? [[configuredPython, []]] : []),
      ['python3', []],
      ['python', []],
    ];

for (const [binary, prefixArgs] of candidates) {
  const result = spawnSync(binary, [...prefixArgs, scriptPath, ...scriptArgs], {
    stdio: 'inherit',
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      continue;
    }

    console.error(`Failed to run ${binary}: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

console.error('No Python interpreter found. Install Python 3 and retry.');
process.exit(1);
