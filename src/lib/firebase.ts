import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { doc, getDocFromServer, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import defaultFirebaseConfig from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  defaultFirebaseConfig.firestoreDatabaseId;

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-south1");
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getFriendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  let msg = raw;
  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (parsed.error) msg = parsed.error;
  } catch {
    // Plain error message
  }

  if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
    return "Permission denied by security rules. Make sure you are signed in to your own account and are not editing a locked move-in record.";
  }
  if (msg.includes("auth/operation-not-allowed")) {
    return "Email/Password sign-in is not yet enabled in the Firebase Console. You can sign in immediately with Google, or enable Email/Password in Firebase Auth.";
  }
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
    return "Incorrect email or password. Please check and try again.";
  }
  if (msg.includes("auth/email-already-in-use")) {
    return "An account with this email already exists. Switch to Log in instead.";
  }
  if (msg.includes("auth/popup-closed-by-user")) {
    return "Sign-in popup was closed before completing. Please try again.";
  }
  if (msg.includes("storage/unauthorized")) {
    return "Photo upload was blocked by Storage rules. Ensure the file is an image under 5 MB and storage.rules is deployed.";
  }
  if (msg.includes("Quota exceeded")) {
    return "Daily Firestore quota exceeded. Quota resets tomorrow.";
  }
  if (msg.includes("offline") || msg.includes("network") || msg.includes("Failed to fetch")) {
    return "Connection lost or server unreachable. Check your internet connection and retry.";
  }
  return msg || "Something went wrong. Please try again.";
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

void testConnection();
