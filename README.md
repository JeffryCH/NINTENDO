# Nintendo Inventory Expo App

Aplicación móvil Expo + TypeScript para administrar inventario de tiendas Nintendo: registra tiendas, categorías, productos, precios, ofertas y stock con persistencia local.

## Requisitos

- Node.js 18 o superior
- npm (incluido con Node.js)
- Expo CLI (opcional, pero recomendado para usar comandos globales)

Instala Expo CLI de manera global:

```powershell
npm install -g expo-cli
```

## Instalación

1. Instala las dependencias del proyecto:

```powershell
npm install
```

1. Inicia el servidor de desarrollo con recarga en caliente:

```powershell
npm start
```

El comando abrirá Expo Dev Tools en tu navegador y mostrará un código QR. Con la app **Expo Go** en Android o iOS puedes escanearlo para probar la aplicación en tiempo real. También puedes ejecutar `npm run android` o `npm run ios` si tienes configurados los emuladores nativos.

## Scripts disponibles

- `npm start`: arranca Expo y habilita Metro bundler.
- `npm run android`: compila y lanza la app en un dispositivo o emulador Android.
- `npm run ios`: compila y lanza la app en un emulador iOS (macOS).
- `npm run web`: abre la app en el navegador usando el bundler clásico.
- `npm run web:vite`: abre la app web con Vite (soluciona errores de `import.meta` y habilita HTTPS).
- `npm test`: ejecuta las pruebas con Jest y React Testing Library.

### Icono de la aplicación (Base64)

La configuración de Expo se gestiona ahora mediante `app.config.js`. Allí se genera el archivo `assets/app-icon.png` cada vez que se detecta la variable de entorno `APP_ICON_BASE64`.

1. Obtén tu icono en formato PNG (1024×1024 recomendado) y conviértelo a Base64. Puedes usar `Convertio`, `base64.guru`, o el siguiente comando en PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes(".\mi-icono.png")) > icono.b64.txt
   ```

2. Exporta la variable al iniciar Expo/EAS:

   ```powershell
   $env:APP_ICON_BASE64 = Get-Content .\icono.b64.txt -Raw
   npm run start
   ```

   Para compilaciones EAS puedes definir `APP_ICON_BASE64` en `eas.json` o en los secretos del proyecto.

3. Si la variable no está definida, se usará un icono transparente de 1×1 píxel como marcador de posición. El icono se guarda en `assets/app-icon.png` dentro del proyecto (se sobrescribe cada vez que cambias la variable).

### Versionado de la app

- `version` (semántica) vive en `app.config.js` y `app.json` para mantener sincronía con los servicios de Expo.
- `android.versionCode` también se actualiza allí; súbelo en cada release para que Google Play acepte el binario.
- Si en el futuro agregas soporte para iOS, define `ios.buildNumber` en el mismo archivo.

### Acceso remoto en desarrollo

Para compartir tu app de desarrollo fuera de tu red local:

1. Instala la CLI de Microsoft Dev Tunnels y autentícate (una sola vez):

   ```powershell
   npm install -g devtunnel
   devtunnel login
   ```

2. Crea un túnel persistente y expón el puerto de Expo (8081) y, si usas la versión web con Vite, el 8080:

   ```powershell
   devtunnel create nintendo --allow-anonymous --protocol https
   devtunnel port create nintendo --port 8081 --protocol https
   devtunnel port create nintendo --port 8080 --protocol https
   ```

3. Arranca el bundler:

   ```powershell
   npm run start -- --tunnel          # móvil (Expo Go)
   npm run web:vite -- --https        # web
   ```

4. Inicia el túnel cuando necesites compartirlo:

   ```powershell
   devtunnel host nintendo
   ```

Se generará una URL `https://nintendo-xxxxx.devtunnels.ms:PORT` que podrás abrir desde cualquier dispositivo. Mantén la terminal del túnel y la de Expo abiertas mientras quieras que la app sea accesible.

### Disponibilidad permanente (producción)

Para que la app esté disponible sin depender del bundler local, usa las opciones de publicación de Expo:

- **Expo Go / actualizaciones OTA**: inicia sesión con `npx expo login`, ejecuta `npx expo publish` o `npx expo update`. Los usuarios podrán abrir la app desde Expo Go con el enlace publicado permanentemente.
- **Build nativo**: crea binarios con `npx expo run:android --variant release` o configura `eas build` para generar APK/AAB e IPA distribuidos en tiendas.
- **Web estática**: exporta el bundle con `npx expo export --platform web` (o `npx expo export:web`), publica la carpeta `dist/` en Vercel, Netlify, Azure Static Web Apps, etc.

Consulta [la guía oficial de actualización de Expo](https://docs.expo.dev/workflow/expo-publish/) y [Expo Application Services](https://docs.expo.dev/eas/) para automatizar despliegues continuos y mantener la app accesible 24/7.

### APK universal para pruebas rápidas

Si solo necesitas un instalador Android para compartir fuera de la tienda:

1. Instala la CLI de EAS y autentícate (una vez):

   ```powershell
   npm install -g eas-cli
   eas login
   ```

2. Lanza el build con el perfil `preview`, que genera un APK universal usando la configuración de `eas.json`:

   ```powershell
   eas build --platform android --profile preview
   ```

   La CLI mostrará una URL desde la cual podrás descargar el APK terminado. Puedes compartir ese archivo directamente e instalarlo activando "Fuentes desconocidas" en el dispositivo.

3. Opcionalmente, para construir sin EAS (local), ejecuta:

   ```powershell
   npm run android -- --variant release
   ```

   Este comando usa Gradle para generar un APK en `android/app/build/outputs/apk/release/`, pero requiere que previamente hayas configurado una **keystore** manualmente.

## Funcionalidades clave

- **Lista de tiendas** con métricas de stock, valor de inventario y alertas de bajo stock.
- **Detalle de tienda** con agrupación por categorías, control de stock por producto y ofertas rápidas.
- **Creación de tiendas** desde un modal con foto, descripción y ubicación.
- **Registro de productos** con creación automática de categorías, precio, stock, imagen y oferta opcional.
- **Persistencia local** mediante AsyncStorage y Zustand para reabrir la app sin perder datos.

## Estructura de carpetas

- `app/`: rutas y pantallas gestionadas mediante Expo Router.
- `src/components/`: componentes reutilizables como tarjetas y formularios modales.
- `src/stores/`: lógica de estado global con Zustand.
- `src/types/`: tipos y declaraciones auxiliares.
- `src/utils/`: funciones de utilidad (formato de moneda, generador de IDs, etc.).

## Próximos pasos sugeridos

- Crear autenticación básica para proteger la información.
- Integrar sincronización remota o exportación del inventario.
- Agregar filtros avanzados (por oferta, stock o categoría) y estadísticas históricas.

## Recursos útiles

- [Documentación de Expo](https://docs.expo.dev/)
- [Guía de Expo Router](https://expo.github.io/router/docs)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
