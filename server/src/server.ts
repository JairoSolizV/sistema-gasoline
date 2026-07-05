import 'dotenv/config';
import { crearApp } from './app.js';

const puerto = Number(process.env.PORT ?? 3001);

// En ejecución real la auth es obligatoria (login del admin con JWT).
// 0.0.0.0: las demás máquinas del taller acceden por la IP local del equipo servidor.
crearApp({ authObligatoria: true }).listen(puerto, '0.0.0.0', () => {
  console.log(`API del taller escuchando en http://localhost:${puerto}/api/v1`);
});
