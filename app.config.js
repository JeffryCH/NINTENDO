const fs = require("fs");
const path = require("path");
const sizeOf = require("image-size");

const ICON_RELATIVE_PATH = "./assets/app-icon.png";
const DEFAULT_ICON_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YotZ4kAAAAASUVORK5CYII=";

const cleanBase64 = (value) =>
  value.replace(/^data:image\/[^;]+;base64,/, "").replace(/\s/g, "");

const validateIcon = (filePath) => {
  try {
    const { type, width, height } = sizeOf(filePath);
    const errors = [];

    if (type !== "png") {
      errors.push("el contenido debe ser un PNG válido");
    }
    if (width !== height) {
      errors.push(
        `la imagen debe ser cuadrada y actualmente mide ${width}x${height}`
      );
    }

    return { errors, meta: { width, height, type } };
  } catch (error) {
    return {
      errors: [
        "no se pudo leer la imagen generada. Verifica que la cadena Base64 sea válida.",
        error instanceof Error ? error.message : String(error),
      ],
      meta: null,
    };
  }
};

const ensureIconAsset = (base64) => {
  const iconOutputPath = path.resolve(__dirname, ICON_RELATIVE_PATH);
  const hasData = typeof base64 === "string" && base64.trim().length > 0;
  let usedDefault = false;

  fs.mkdirSync(path.dirname(iconOutputPath), { recursive: true });

  if (hasData) {
    try {
      const sanitized = cleanBase64(base64.trim());
      fs.writeFileSync(iconOutputPath, Buffer.from(sanitized, "base64"));
      const { errors } = validateIcon(iconOutputPath);

      if (errors.length > 0) {
        throw new Error(errors.join(". "));
      }
    } catch (error) {
      usedDefault = true;
      const reason =
        error instanceof Error ? error.message : "Formato de imagen inválido";
      console.warn(
        `[app.config] Icono personalizado inválido: ${reason}. Se usará un icono transparente de reserva (PNG cuadrado). Asegúrate de proveer un PNG cuadrado en formato Base64 en la variable APP_ICON_BASE64.`
      );
      fs.writeFileSync(
        iconOutputPath,
        Buffer.from(DEFAULT_ICON_BASE64, "base64")
      );
    }
  } else {
    if (!fs.existsSync(iconOutputPath)) {
      usedDefault = true;
      fs.writeFileSync(
        iconOutputPath,
        Buffer.from(DEFAULT_ICON_BASE64, "base64")
      );
    } else {
      const { errors } = validateIcon(iconOutputPath);
      if (errors.length > 0) {
        usedDefault = true;
        fs.writeFileSync(
          iconOutputPath,
          Buffer.from(DEFAULT_ICON_BASE64, "base64")
        );
      }
    }
  }

  const validation = validateIcon(iconOutputPath);

  if (validation.errors.length > 0) {
    throw new Error(
      `[app.config] El icono generado no es válido: ${validation.errors.join(
        ". "
      )}`
    );
  }

  if (usedDefault) {
    console.warn(
      "[app.config] Usando el icono de reserva (PNG transparente y cuadrado). Proporciona APP_ICON_BASE64 para personalizarlo."
    );
  }

  return ICON_RELATIVE_PATH;
};

module.exports = ({ config }) => {
  const iconPath = ensureIconAsset(process.env.APP_ICON_BASE64);

  return {
    ...config,
    name: "Nintendo Inventory",
    slug: "nintendo-inventory",
    scheme: "nintendo",
    version: "1.0.3",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    plugins: ["expo-router"],
    assetBundlePatterns: ["**/*"],
    jsEngine: "hermes",
    experiments: {
      typedRoutes: true,
    },
    icon: iconPath,
    android: {
      package: "com.nintendo.inventory",
      versionCode: 3,
      adaptiveIcon: {
        foregroundImage: ICON_RELATIVE_PATH,
        backgroundColor: "#080b16",
      },
    },
    extra: {
      router: {},
      eas: {
        projectId: "16120d61-0f20-475a-9a0e-36a0a483baaa",
      },
    },
  };
};
