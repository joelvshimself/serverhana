import { exec } from 'child_process';
import { mkdirSync, existsSync, createWriteStream } from 'fs';
import { join } from 'path';

// Configura carpeta de logs
const logDir = './logs/test-runs';
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

// Timestamp único para diferenciar cada corrida
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonFile = join(logDir, `test-report-${timestamp}.json`);
const logFile = join(logDir, `test-log-${timestamp}.log`);

// Comando Jest con cobertura y salida JSON
const cmd = `npx jest --coverage --json --outputFile=${jsonFile}`;
console.log(`🧪 Ejecutando pruebas Jest...\n📦 JSON: ${jsonFile}\n📜 LOG: ${logFile}`);

// Crea stream para guardar el log
const stream = createWriteStream(logFile);

// Ejecuta Jest y redirige salida y errores al log
const child = exec(cmd, (error, stdout, stderr) => {
  // También mostrar salida en consola
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  if (error) console.error(`Error: ${error.message}`);
});

// Redirige stdout y stderr al archivo log
child.stdout.pipe(stream);
child.stderr.pipe(stream);

// Cuando termina, informa por consola
child.on('exit', code => {
  console.log(`✅ Pruebas finalizadas con código: ${code}`);
});
