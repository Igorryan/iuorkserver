### Destravando “Loading from Metro…” no iOS (Expo/React Native)

Este guia resume os comandos para resolver lentidão/travamento ao abrir o app no iOS com a mensagem “Loading from Metro…”. Execute na raiz do projeto do app (`pro-app`).

### 1) Reinstalar dependências (opcional, mas recomendado)

```bash
cd /Users/igorryan/Desktop/Projetos/iUork/pro-app
rm -rf node_modules
yarn install --immutable
```

### 2) Limpar caches do Metro, Expo e Watchman

```bash
# Metro/Expo caches
rm -rf ~/.expo
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-* $TMPDIR/react-* 2>/dev/null || true

# Resetar Watchman
watchman watch-del-all 2>/dev/null || true

# Se aparecer aviso de "recrawl" do Watchman
watchman watch-del '/Users/igorryan/Desktop/Projetos/iUork/pro-app' ; watchman watch-project '/Users/igorryan/Desktop/Projetos/iUork/pro-app'
```

### 3) Limpar artefatos de build do iOS

```bash
rm -rf ios/build ios/DerivedData 2>/dev/null || true
```

### 4) Reinstalar Pods do iOS

```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

### 5) Rebuild iOS com Expo (gera binário limpo e reinicia o Metro)

```bash
EXPO_NO_TELEMETRY=1 EXPO_USE_METRO_WORKER=1 RCT_NO_LAUNCH_PACKAGER=true npx expo run:ios --no-install
```

### Dicas rápidas

- **Reiniciar TS Server** após mudar `tsconfig.json`: Command Palette → “TypeScript: Restart TS server”.
- Evite ter **dois Metros** rodando ao mesmo tempo (porte 8081). Feche terminais duplicados.
- Em rede lenta, prefira testar no **simulador** em vez de dispositivo físico.

### Script único (opcional)

Para automatizar, crie um script e rode tudo de uma vez:

```bash
#!/usr/bin/env bash
set -e
cd /Users/igorryan/Desktop/Projetos/iUork/app

echo "[1/5] Dependências"
rm -rf node_modules
yarn install --immutable

echo "[2/5] Caches Metro/Expo/Watchman"
rm -rf ~/.expo
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-* $TMPDIR/react-* 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true

echo "[3/5] Limpeza build iOS"
rm -rf ios/build ios/DerivedData 2>/dev/null || true

echo "[4/5] Pods iOS"
cd ios && pod deintegrate && pod install --repo-update && cd ..

echo "[5/5] Rebuild iOS"
EXPO_NO_TELEMETRY=1 EXPO_USE_METRO_WORKER=1 RCT_NO_LAUNCH_PACKAGER=true npx expo run:ios --no-install
```

### INSTALAR NO DISPOSITIVO ESPECIFICO
EXPO_NO_TELEMETRY=1 npx expo run:ios --no-install --device "iPhone 16 Pro"