import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts';
// Charger la clé de service Firebase (stockée dans une variable d'environnement)
function getFirebaseServiceAccount() {
  // const json = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  // if (!json) {
  //   throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON manquant')
  // }
  const json = {
    "type": "service_account",
    "project_id": "airhost-8948c",
    "private_key_id": "4640146c7b64fcf4f894f7376760b9672d3d2891",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCxoADXz5BjZmwF\nveggiJ39/01TAeKp3H++xst3ARCQjWhG7RW9BhOcpqbVujU1Ga3n18tQ8GL5uJZt\nQqUuEiGjHl8ErVY46b1tuXbGNhHiesk1MlHBnczWn2YQVRqVNCGjfeovyc70SXEx\n51gkvn2IbwUhjZ7MgnoQi45gf1qYzMDG/eVlH6YIGwQ3vK0MdBO07aMI1+jfg5HM\nUpfz3MZY9Qp5CuLvZweQt9+g3WD35pXYvTpw4ov+LNsEZDvNc3J/Zgs4uQMzMYOb\nRK8F0ngpB2NEjc1EZYtxRugDjb/vER0RjiQFN+EvbS6ZwbHSMnaja4tVeLtJN90G\nK14kkeT/AgMBAAECggEABe8KbYCJmkh5o1d3bF7OqFrhrRGLDjxHfYq2kVXVGn8e\n1Kpm54GkdhSQeONXk7E1QLbSG/TBLwZzlVgnRyVj6kcWytk04CyEH34/8YSCOcal\nohlO5zZA+Yp++7IGyU/h2ncCXnD8xjxjLlTuz4tti3k/T/ejLmx4F3ASDuHc7O3G\njG6YhsYAVZqzn6APnqHxt23Ywn1ra/lkXH/kdPH9lN07LK8htXmd7KyAgdSFr1oT\n1xjt01GrveKXuth5bOZj7fXPyoEA7/hhZdVYp+YHDhbqgM1ZY77pgROxkzvfkAnK\nPOD1+uDb6Z9QQ1pXS+0PghoFZpy2FRZsXLv22D1HgQKBgQDcBR8mrRawrdKxGcWB\n/ND5idVIMeNauvLTtPgwM+v5Rca+zAaRTegpuBaU3xFjfLh+c1if5HewklS5hKJW\nrig+b4cmdYc1bV0v5/Qb69L9fEXzWfUwwJ0U2VoYMEFz06A2LUNrVgovxGzob1N7\nCbHIdeLRcRYMM1bhAAYbXJjgFwKBgQDOrBCt4G5nDigQbavMHD0ZEoNJBuA4OxOq\nYbD6XFdnjqR4Cpp9XrCr2AjVFgW7jAu69iQbJKRXQ4DKLbnpe5zNRyuNGwiNvKH2\n/QzGj7TEF/IC0GvD/LtgdLSv1Xef1v7Sx4ruzY9uthVBzOS0pbGLqhTKCE8dQfEH\ngPZhyG0LWQKBgDpBAOZ0nbVZ0Jcjg6/PCGWJoPbkfpXfObvkBnJ8zNXLK7wIuRRv\n1DB3lUMFbM0ykIaqc6SiES6nD9euzmy03+LoFJiSNaJnumyctX1PCyYiaULtZoXp\n+a0zfy84V5wbRCgUA+2/ciMDlvJTx36kKnYxAEUD9Bp23WHlZ7iG49MxAoGAQRxW\nWOE3BwKfvqU+lZxj5008zTn8U9rQ1EHYxtdmtfpreGImz86QLGNwTOmWPsLdQzae\no2qE1/UtUwTa6GMIQGfmoZrdtAG0qSKJ7tiBY7IDjb1p5iHuSnIaJrdC67mJKJCz\nBY7/XCrDQaqydvMon06jJA9AFYCb1fhcJuxE5mkCgYA/lCi/LnmlKXvs1lmiDNVi\nJNTFPcmk/AvNzX0G6T9CMZHpF1y+1+tndAfIPZUtwHF3aJVQfoDniGaCzboPm7Yl\nXbgSc9Zv0K3sQUVKW6t8/d3vLiXxbSBqkbqdu6jehfhd+8K7KbPteho+Aipy5bXX\nKyLLN6Zahm2igj8cOCqgTw==\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@airhost-8948c.iam.gserviceaccount.com",
    "client_id": "110181023496659114885",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40airhost-8948c.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  };
  return json;
// return JSON.parse(json)
}
// Générer un jeton d'accès OAuth2 pour FCM HTTP v1
async function getAccessToken() {
  const serviceAccount = getFirebaseServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };
  // Signer le JWT avec la clé privée
  const privateKey = serviceAccount.private_key;
  const alg = 'RS256';
  const jwt = await new jose.SignJWT(payload).setProtectedHeader({
    alg,
    typ: 'JWT'
  }).sign(await jose.importPKCS8(privateKey, alg));
  // Échanger le JWT contre un access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!tokenRes.ok) {
    throw new Error(`Erreur OAuth2: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const data = await tokenRes.json();
  return data.access_token;
}
// Fonction pour récupérer la config Firebase publique
function getFirebasePublicConfig() {
  return {
    apiKey: Deno.env.get('FIREBASE_API_KEY') || 'AIzaSyDoOMmWKWVymgehWi6FLoNqlAxzY_5Beus',
    authDomain: `${Deno.env.get('FCM_PROJECT_ID') || "airhost-8948c"}.firebaseapp.com`,
    projectId: Deno.env.get('FCM_PROJECT_ID') || 'airhost-8948c',
    storageBucket: `${Deno.env.get('FCM_PROJECT_ID') || "airhost-8948c"}.appspot.com`,
    messagingSenderId: Deno.env.get('FCM_SENDER_ID') || '755275743688',
    appId: Deno.env.get('FIREBASE_APP_ID') || '1:755275743688:web:76e431cfa3065e645ec0fd'
  };
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, X-Supabase-Auth',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/config')) {
    const config = getFirebasePublicConfig();
    return new Response(JSON.stringify({
      config
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Méthode non autorisée'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifié');
    const token = authHeader.replace('Bearer ', '');
    const isServiceKey = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!isServiceKey) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) throw new Error('Token invalide');
    }
    const body = await req.json();
    const payload = body;
    // Handle both 'to' and 'fcmToken' field names for backward compatibility
    const fcmToken = payload.to || payload.fcmToken;
    // Handle test token
    if (fcmToken === 'test-fcm-token') {
      console.log('Token de test détecté, simulation de réponse réussie');
      return new Response(JSON.stringify({
        success: true,
        messageId: "test-message-id-" + Date.now()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Validate that we have a valid FCM token
    if (!fcmToken || fcmToken.trim() === '') {
      console.error('FCM Error: No FCM token provided in payload.to or payload.fcmToken');
      console.error('Payload received:', JSON.stringify(payload, null, 2));
      throw new Error('FCM token is required but not provided');
    }
    // Validate FCM token format (FCM tokens are typically 152+ characters long and contain specific patterns)
    const fcmTokenPattern = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;
    const isValidLength = fcmToken.length >= 140 // FCM tokens are usually 152+ chars
    ;
    const hasValidFormat = fcmTokenPattern.test(fcmToken) || fcmToken.startsWith('f') // New format or legacy format
    ;
    if (!isValidLength && fcmToken !== 'test-fcm-token') {
      console.error('FCM Error: Token appears to be too short:', fcmToken.length, 'characters');
      console.error('Token preview:', fcmToken.substring(0, 50) + '...');
      throw new Error(`Invalid FCM token format: token is too short (${fcmToken.length} chars, expected 140+)`);
    }
    console.log('FCM Token length:', fcmToken.length);
    console.log('FCM Token preview:', fcmToken.substring(0, 50) + '...');
    console.log('Full payload:', JSON.stringify(payload, null, 2));
    const accessToken = await getAccessToken();
    const projectId = getFirebaseServiceAccount().project_id;
    // Prepare notification object (remove unsupported fields like 'icon')
    const notification = {
      ...payload.notification
    };
    delete notification.icon // FCM v1 doesn't support icon in notification
    ;
    // Convert all data values to strings (FCM v1 requirement)
    const data = {};
    if (payload.data) {
      for (const [key, value] of Object.entries(payload.data)){
        data[key] = String(value);
      }
    }
    const fcmMessage = {
      message: {
        token: fcmToken,
        // Top-level data for all platforms to access programmatically
        data: data
      }
    };
    // const fcmMessage = {
    //   message: {
    //     token: fcmToken,
    //     notification,
    //     data,
    //     android: {
    //       notification: {
    //         icon: payload.notification?.icon || '/logo192.png',
    //         sound: 'default',
    //         channel_id: 'default-channel'
    //       }
    //     },
    //     apns: {
    //       payload: {
    //         aps: {
    //           sound: 'default',
    //           badge: 1
    //         }
    //       }
    //     }
    //   }
    // };
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(fcmMessage)
    });
    const resData = await res.json();
    if (!res.ok) {
      console.error('FCM API Error Response:', JSON.stringify(resData, null, 2));
      // Handle specific FCM errors with helpful messages
      if (resData.error?.message?.includes('not a valid FCM registration token')) {
        throw new Error(`Invalid FCM Token: The token "${fcmToken.substring(0, 20)}..." is not valid. This usually means:
1. The token has expired
2. The app was uninstalled/reinstalled  
3. The user needs to refresh their FCM token
4. The token format is incorrect
Please regenerate the FCM token.`);
      }
      if (resData.error?.message?.includes('Recipient of the message is not set')) {
        throw new Error('FCM Error: No recipient token provided. Please ensure fcmToken or to field is set.');
      }
      throw new Error(`FCM v1 Error: ${res.status} - ${JSON.stringify(resData)}`);
    }
    return new Response(JSON.stringify(resData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    console.error('Erreur:', err.message);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
