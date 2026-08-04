// Configuración de PM2. Se levanta con:  pm2 start ecosystem.config.js && pm2 save
//
// Apunta al binario de Next en vez de a "npm run start" para que PM2 supervise
// directamente el proceso de node: así los reinicios y las señales de apagado llegan a
// quien corresponde, sin un npm intermedio.
//
// No define PRINTED_* ni PORT a propósito: esas viven en el .env del servidor, que Next
// carga al arrancar. Duplicarlas acá crearía una segunda fuente de verdad.
module.exports = {
    apps: [
        {
            name: 'search-printed-cronos',
            cwd: __dirname,
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
