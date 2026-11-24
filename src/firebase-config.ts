// =============================================================================
// إعدادات مشروع Firebase — اختيارياً يمكنك لصق إعدادات مشروع آخر هنا لتجاوز
// الإعداد التلقائي المربوط من firebase-applet-config.json.
// Optional manual overrides — leave placeholders as-is to use the provisioned
// Firebase project in firebase-applet-config.json automatically.
// =============================================================================
export const FIREBASE_API_KEY = 'PASTE_YOUR_FIREBASE_API_KEY_HERE';
export const FIREBASE_AUTH_DOMAIN = 'PASTE_YOUR_PROJECT_ID.firebaseapp.com';
export const FIREBASE_PROJECT_ID = 'PASTE_YOUR_PROJECT_ID_HERE';
export const FIREBASE_STORAGE_BUCKET = 'PASTE_YOUR_PROJECT_ID.firebasestorage.app';
export const FIREBASE_MESSAGING_SENDER_ID = 'PASTE_YOUR_MESSAGING_SENDER_ID';
export const FIREBASE_APP_ID = 'PASTE_YOUR_FIREBASE_APP_ID_HERE';
export const FIREBASE_DATABASE_ID = '';

// اسم مجموعة Firestore التي يكتب فيها نظام التجميع الخارجي
export const FIRESTORE_COLLECTION_NAME = 'aggregator_content';

// =============================================================================
// التهيئة الآمنة لـ Firebase Web SDK (Modular v10+)
// =============================================================================
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import provisionedConfig from '../firebase-applet-config.json';

function isPlaceholder(value: string | undefined): boolean {
  const trimmed = (value ?? '').trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('PASTE_YOUR_') ||
    trimmed.includes('YOUR_PROJECT_ID') ||
    trimmed.includes('YOUR_API_KEY') ||
    trimmed === 'remixed-project-id'
  );
}

const hasManualOverride =
  !isPlaceholder(FIREBASE_API_KEY) &&
  !isPlaceholder(FIREBASE_AUTH_DOMAIN) &&
  !isPlaceholder(FIREBASE_PROJECT_ID) &&
  !isPlaceholder(FIREBASE_APP_ID);

export const firebaseConfig = hasManualOverride
  ? {
      apiKey: FIREBASE_API_KEY,
      authDomain: FIREBASE_AUTH_DOMAIN,
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
      messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
      appId: FIREBASE_APP_ID,
      firestoreDatabaseId: FIREBASE_DATABASE_ID || undefined,
    }
  : {
      apiKey: provisionedConfig.apiKey,
      authDomain: provisionedConfig.authDomain,
      projectId: provisionedConfig.projectId,
      storageBucket: provisionedConfig.storageBucket,
      messagingSenderId: provisionedConfig.messagingSenderId,
      appId: provisionedConfig.appId,
      firestoreDatabaseId: provisionedConfig.firestoreDatabaseId || undefined,
    };

/**
 * Returns true when valid Firebase credentials are available (from firebase-applet-config.json
 * or manual override constants above).
 */
export function isFirebaseConfigured(): boolean {
  return (
    !isPlaceholder(firebaseConfig.apiKey) &&
    !isPlaceholder(firebaseConfig.authDomain) &&
    !isPlaceholder(firebaseConfig.projectId) &&
    !isPlaceholder(firebaseConfig.appId)
  );
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    dbInstance = firebaseConfig.firestoreDatabaseId
      ? getFirestore(appInstance, firebaseConfig.firestoreDatabaseId)
      : getFirestore(appInstance);
  } catch (error) {
    console.error('تعذر تهيئة Firebase بالإعدادات الحالية:', error);
    appInstance = null;
    authInstance = null;
    dbInstance = null;
  }
}

export const firebaseApp = appInstance;
export const auth = authInstance;
export const db = dbInstance;

// Startup Firestore connectivity validation
async function testConnection() {
  if (!dbInstance) return;
  try {
    await getDocFromServer(doc(dbInstance, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined' && dbInstance) {
  void testConnection();
}
