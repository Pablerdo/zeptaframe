const ngrok = require('ngrok');
const fs = require('fs');
require('dotenv').config();

(async function() {
  try {
    console.log('Starting ngrok tunnel...');
    
    // Use the auth token from your .env file
    const url = await ngrok.connect({
      addr: 3000,
      authtoken: process.env.NGROK_AUTH_TOKEN
    });
    
    console.log(`✅ Ngrok tunnel started!`);
    console.log(`🔗 Public URL: ${url}`);
    console.log(`🪝 Webhook URL: ${url}/api/comfydeploy/webhook-video`);
    
    // Save the webhook URL to .env.local for your application to use
    fs.writeFileSync(
      '.env.local', 
      `NEXT_PUBLIC_WEBHOOK_URL_NGROK=${url}/api/comfydeploy/webhook-video\n`, 
      { flag: 'a' }
    );
    
    console.log('💾 Webhook URL saved to .env.local');
  } catch (error) {
    console.error('❌ Error starting ngrok:', error);
  }
})(); 