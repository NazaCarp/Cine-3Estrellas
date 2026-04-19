import crypto from 'crypto';

interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_ID = '-1002047149201';

/**
 * Verifies the data received from the Telegram Login Widget
 */
export function verifyTelegramHash(data: TelegramUserData): boolean {
  if (!BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not defined');
    return false;
  }

  const { hash, ...rest } = data;
  
  // 1. Create data-check-string
  const sortedKeys = Object.keys(rest).sort();
  const dataCheckString = sortedKeys
    .map(key => `${key}=${(rest as any)[key]}`)
    .join('\n');

  // 2. Create secret key
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  // 3. Compute hash
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}

/**
 * Checks if a user is a member of the required group
 */
export async function checkGroupMembership(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${GROUP_ID}&user_id=${userId}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram API error:', result.description);
      return false;
    }

    const status = result.result.status;
    // Status can be: creator, administrator, member, restricted, left, kicked
    return ['creator', 'administrator', 'member', 'restricted'].includes(status);
  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
}

/**
 * Sends a welcome message to the user
 */
export async function sendWelcomeMessage(userId: number, firstName: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  const text = `¡Bienvenido a Cine 3 Estrellas, ${firstName}! Ya puedes disfrutar de todo nuestro catálogo.`;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: text,
      }),
    });
    
    const result = await response.json();
    return result.ok;
  } catch (error) {
    console.error('Error sending welcome message:', error);
    return false;
  }
}
