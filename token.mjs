import { AccessToken } from 'livekit-server-sdk';

const apiKey = 'alverium_live_key';
const apiSecret = 'AlveriumSuperSecretKey2026';

const createToken = async () => {
  const roomName = 'test-room';
 const participantName = 'phone';

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  });

  at.addGrant({ roomJoin: true, room: roomName });

  console.log('\n--- СКОПИРУЙ СТРОКУ НИЖЕ (БЕЗ ПРОБЕЛОВ) ---');
  console.log(await at.toJwt());
  console.log('-------------------------------------------\n');
}

createToken();