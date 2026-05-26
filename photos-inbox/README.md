# Inbox de fotos (FTP)

Coloque aqui as fotos `.jpg`, `.jpeg`, `.png` ou `.webp` capturadas nas
atrações. O sistema lê esta pasta quando o operador clica em
**"Importar pasta FTP"** na tela de Galeria (ou quando você roda o script
de polling automático descrito no `LOCAL_SETUP.md`).

- Cada arquivo importado é movido para `processed/`
- Cada arquivo com erro é movido para `failed/`
- Você pode mudar a pasta definindo a variável `PHOTOS_INBOX_DIR`
- Preço padrão pode ser ajustado com `PHOTOS_DEFAULT_PRICE` (default 15)
