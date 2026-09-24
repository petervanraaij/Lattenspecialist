import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const task = {dev: 'assembleDebug', bundle: 'bundleRelease'}[process.argv[2]];
if (!task) throw new Error('Kies dev of bundle.');
const windows = process.platform === 'win32';
function run(command, args, cwd) {
  const result = spawnSync(command, args, {cwd, stdio:'inherit', shell:windows});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('npm', ['run', 'sync'], root);
run('npm', ['run', 'prepare:assets'], root);
run(windows ? 'gradlew.bat' : './gradlew', [task], resolve(root, 'android'));
