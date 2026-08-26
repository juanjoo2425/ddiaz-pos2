# D'DIAZ · Sistema de Ventas

Punto de venta con inventario, tickets, métricas y sincronización en
tiempo real entre varios dispositivos. Es una app web independiente
(no depende de Claude): la instalas en tu celular como cualquier otra
app, y funciona con tu propia base de datos gratuita en Firebase.

Esto no es opcional para que funcione: sin completar los pasos 1 y 2
de abajo, la app no tiene dónde guardar tus datos.

---

## 1. Crear tu base de datos gratis en Firebase (10 minutos)

1. Entra a **https://console.firebase.google.com** con tu cuenta de Google.
2. **Agregar proyecto** → ponle un nombre, por ejemplo `ddiaz-pos` → puedes desactivar Google Analytics (no lo necesitas) → **Crear proyecto**.
3. En el menú izquierdo: **Compilación → Firestore Database** → **Crear base de datos**.
   - Elige la ubicación del servidor: `southamerica-east1` (São Paulo) es la más cercana a Perú.
   - Modo: elige **Iniciar en modo de producción**.
4. Ve a la pestaña **Reglas** dentro de Firestore Database, borra lo que hay y pega el contenido del archivo `firestore.rules` (incluido en este proyecto) → **Publicar**.
5. Ve a **Configuración del proyecto** (ícono de engranaje, arriba a la izquierda) → pestaña **General** → baja hasta "Tus apps" → click en el ícono **</>** (Web) → dale un apodo (ej. "ddiaz-web") → **Registrar app**.
6. Firebase te muestra un bloque de código con `const firebaseConfig = { apiKey: "...", ... }`. Vas a necesitar esos 6 valores en el paso 2.

## 2. Configurar el proyecto con tus datos de Firebase

1. Dentro de la carpeta del proyecto, copia el archivo `.env.example` y renómbralo a `.env`.
2. Abre `.env` y pega cada valor que te dio Firebase en el paso anterior:

```
VITE_FIREBASE_API_KEY=el_apiKey_que_te_dio_firebase
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Este archivo `.env` **no se sube a internet** (está en `.gitignore`); es solo para probar la app en tu propia computadora.

## 3. Probar en tu computadora (opcional, antes de publicar)

```
npm install
npm run dev
```

Abre la URL que te muestra (normalmente `http://localhost:5173`). Si ves el catálogo de productos de ejemplo, ¡tu Firebase está bien conectado!

## 4. Publicar en Vercel para que funcione desde cualquier lugar

### Opción A — con GitHub (recomendada)

1. Crea un repositorio nuevo en **https://github.com/new** (puede ser privado).
2. Sube el código del proyecto a ese repositorio (arrastrando los archivos desde la web de GitHub, o con `git`):
   ```
   git init
   git add .
   git commit -m "Sistema de ventas D'DIAZ"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/ddiaz-pos.git
   git push -u origin main
   ```
3. Entra a **https://vercel.com**, inicia sesión con tu cuenta de GitHub.
4. **Add New… → Project** → elige el repositorio `ddiaz-pos` → **Import**.
5. Vercel detecta automáticamente que es un proyecto Vite. Antes de darle a "Deploy", abre **Environment Variables** y agrega las mismas 6 variables de tu archivo `.env` (una por una, con sus valores reales de Firebase).
6. Click en **Deploy**. En 1-2 minutos tendrás una URL como `https://ddiaz-pos.vercel.app`.

### Opción B — sin GitHub, con la Vercel CLI

```
npm install -g vercel
vercel login
vercel
```
Sigue las instrucciones en pantalla. Si no te pregunta por las variables de entorno, ve luego al dashboard de Vercel → tu proyecto → **Settings → Environment Variables** y agrégalas ahí, después ejecuta `vercel --prod` de nuevo.

## 5. Instalar la app en tu celular

1. Abre la URL de Vercel (`https://ddiaz-pos.vercel.app`) desde el navegador de tu celular (Chrome en Android, Safari en iPhone).
2. **Android (Chrome):** aparece un aviso "Agregar a pantalla de inicio", o desde el menú (⋮) → **Instalar aplicación**.
3. **iPhone (Safari):** botón compartir (□↑) → **Agregar a pantalla de inicio**.
4. Queda como un ícono más en tu celular, se abre a pantalla completa como cualquier app.

Repite este paso en el celular de cada vendedor — todos deben abrir la **misma URL** de Vercel para compartir el mismo inventario y las mismas ventas.

## 6. Uso diario

- La primera vez que alguien abre la app, el catálogo se llena con 12 productos de ejemplo. Ve a **Inventario** y edítalos/bórralos para poner tu catálogo real.
- Cada persona escribe su nombre una vez (queda guardado en su propio celular).
- Las ventas, el inventario y las métricas se sincronizan **al instante** entre todos los dispositivos conectados (no hay que esperar ni refrescar).
- La contraseña para ver **Métricas** es `clea25`.
- El botón "Imprimir" abre el diálogo de impresión del navegador — selecciona tu impresora térmica ahí, igual que imprimir cualquier página.

## Seguridad — qué es real y qué no

- Las reglas de Firestore que dejamos (`allow read, write: if true`) significan que cualquiera que **descubra las credenciales de tu proyecto de Firebase** (no la URL de tu app, sino la configuración del paso 1) podría leer o modificar tus datos directamente. Para un negocio pequeño con datos internos esto es un punto de partida razonable, igual que dejar la puerta de un local sin doble candado.
- La contraseña `clea25` de Métricas es una barrera a nivel de pantalla, no de servidor: alguien con conocimientos técnicos podría saltarla revisando el código. Protege de miradas casuales de tus vendedores, no de un ataque dirigido.
- Si más adelante quieres protección real (por ejemplo, que solo tú puedas ver Métricas incluso si alguien mira el código), el siguiente paso es agregar **Firebase Authentication** (inicio de sesión con correo y contraseña) y reglas de Firestore que exijan estar autenticado. Es una mejora clara pero requiere más configuración — avísame cuando quieras dar ese paso y te ayudo.

## Estructura del proyecto

```
src/
  App.jsx               Toda la interfaz (ventas, inventario, métricas, historial)
  lib/
    firebase.js          Conexión a tu proyecto de Firebase
    pos-data.js          Lectura/escritura en Firestore (tiempo real + transacciones)
firestore.rules          Reglas de seguridad para pegar en Firebase
.env.example              Plantilla de variables de entorno
```
