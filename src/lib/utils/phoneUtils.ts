/** Solo dígitos del teléfono */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formato chatId de WhatsApp (OpenWA / whatsapp-web.js).
 * Perú: 9 dígitos que empiezan en 9 → antepone 51.
 */
export function toWhatsAppChatId(phone: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;

  if (digits.length === 9 && digits.startsWith('9')) {
    return `51${digits}@c.us`;
  }
  if (digits.length === 11 && digits.startsWith('51')) {
    return `${digits}@c.us`;
  }
  if (digits.length >= 10) {
    return `${digits}@c.us`;
  }
  return null;
}

/** Teléfono E.164 sin sufijo (@c.us) — formato WPPConnect send-message */
export function toWhatsAppPhone(phone: string): string | null {
  const chatId = toWhatsAppChatId(phone);
  if (!chatId) return null;
  return chatId.replace(/@c\.us$/, '');
}
