chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SEND_VIA_UI") {
    processClipboardAutomation(request.phone, request.message, request.media)
      .then(() => sendResponse({ status: "success" }))
      .catch((err) => sendResponse({ status: "error", error: err.message }));
    return true;
  }
});

async function processClipboardAutomation(phone, message, media) {
  // 1. Ubicar la barra de búsqueda lateral de WhatsApp
  const searchBox = document.querySelector('div[contenteditable="true"][data-tab="3"]');
  if (!searchBox) {
    throw new Error("No se encontró la barra de búsqueda de WhatsApp.");
  }

  // Escribir el número utilizando eventos de teclado nativos de React
  searchBox.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, phone);
  await delay(2000);

  // 2. Presionar Enter para abrir el chat del contacto
  simulateKeyEvent(searchBox, 'Enter');
  await delay(2500); // Esperar a que el chat cargue en pantalla

  // 3. Si hay archivo multimedia (Imagen o PDF), lo inyectamos al portapapeles
  if (media && media.data) {
    try {
      await injectMediaFile(media);
      await delay(3000);
    } catch (e) {
      console.error("Error al inyectar multimedia:", e);
    }
  }

  // 4. Escribir el texto del mensaje personalizado
  const textBox = document.querySelector('div[contenteditable="true"][data-tab="1"]');
  if (!textBox) {
    throw new Error("No se encontró la caja de texto del chat.");
  }

  textBox.focus();
  document.execCommand('insertText', false, message);
  await delay(1000);

  // 5. Enviar el mensaje automáticamente presionando Enter
  simulateKeyEvent(textBox, 'Enter');
  await delay(2000);
}

async function injectMediaFile(media) {
  const blob = dataURItoBlob(media.data);
  const file = new File([blob], media.name, { type: media.type });

  // Ubicar la caja de texto del chat donde se pegará el archivo
  const textBox = document.querySelector('div[contenteditable="true"][data-tab="1"]');
  if (!textBox) return;

  textBox.focus();

  // Simular el portapapeles pegando el archivo directamente
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const pasteEvent = new ClipboardEvent('paste', {
    clipboardData: dataTransfer,
    bubbles: true,
    cancelable: true
  });

  textBox.dispatchEvent(pasteEvent);
  await delay(3000); // Esperar a que aparezca la ventana flotante de vista previa de WhatsApp

  // Hacer clic en el botón verde de enviar dentro de la ventana modal del archivo
  // Buscamos el botón de enviar en el modal flotante
  const sendIcon = document.querySelector('span[data-icon="send"], div[role="button"] span[data-icon="send"]');
  if (sendIcon) {
    const btn = sendIcon.closest('div[role="button"]') || sendIcon;
    btn.click();
  } else {
    // Si no lo encuentra por icono, simula Enter para confirmar el envío del archivo
    simulateKeyEvent(textBox, 'Enter');
  }
}

function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

function simulateKeyEvent(element, keyName) {
  const keyDown = new KeyboardEvent('keydown', { key: keyName, code: keyName, keyCode: 13, which: 13, bubbles: true });
  const keyPress = new KeyboardEvent('keypress', { key: keyName, code: keyName, keyCode: 13, which: 13, bubbles: true });
  const keyUp = new KeyboardEvent('keyup', { key: keyName, code: keyName, keyCode: 13, which: 13, bubbles: true });
  
  element.dispatchEvent(keyDown);
  element.dispatchEvent(keyPress);
  element.dispatchEvent(keyUp);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}