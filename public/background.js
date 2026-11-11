let isRunning = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_QUEUE") {
    if (isRunning) {
      sendResponse({ status: "already_running" });
      return;
    }
    isRunning = true;
    runQueue(request.data);
    sendResponse({ status: "started" });
  } else if (request.action === "STOP_QUEUE") {
    isRunning = false;
    sendResponse({ status: "stopped" });
  }
});

async function runQueue(data) {
  const { contacts, messageTemplate, media, delaySeconds } = data;

  let tab = await getOrCreateWhatsAppTab();

  for (let i = 0; i < contacts.length; i++) {
    if (!isRunning) break;

    const contact = contacts[i];

    // Limpiar y formatear número de teléfono
    let rawPhone = contact.phone ? contact.phone.toString() : "";
    let cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
      cleanPhone = "593" + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9 && !cleanPhone.startsWith("593")) {
      cleanPhone = "593" + cleanPhone;
    }

    // Personalizar mensaje con nombre
    let personalizedMessage = messageTemplate;
    if (contact.nombre) {
      personalizedMessage = personalizedMessage.replace(/{nombre}/gi, contact.nombre);
    }

    // Asegurarse de que la pestaña esté en WhatsApp Web principal
    if (!tab.url.includes("web.whatsapp.com")) {
      await chrome.tabs.update(tab.id, { url: "https://web.whatsapp.com" });
      await delay(6000);
    }

    // Enviar orden al content.js para que busque por interfaz y envíe
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: "SEND_VIA_UI",
        phone: cleanPhone,
        message: personalizedMessage,
        media: media
      });
    } catch (e) {
      console.log("Error comunicando con content.js:", e);
    }

    // Respetar el retraso configurado antes del siguiente contacto
    if (i < contacts.length - 1 && isRunning) {
      await delay(delaySeconds * 1000);
    }
  }

  isRunning = false;
  console.log("Cola de envíos finalizada.");
}

function getOrCreateWhatsAppTab() {
  return new Promise(async (resolve) => {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (tabs.length > 0) {
      resolve(tabs[0]);
    } else {
      const newTab = await chrome.tabs.create({ url: "https://web.whatsapp.com" });
      resolve(newTab);
    }
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}