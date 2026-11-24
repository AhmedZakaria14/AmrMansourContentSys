import { useCallback, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type AuthError,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase-config';

export interface AuthUser {
  uid: string;
  email: string;
  isDemoSession: boolean;
}

const DEMO_SESSION_KEY = 'amro_mansour_demo_auth_email';

function translateAuthError(error: unknown): string {
  const code = (error as AuthError)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة المؤسسة.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد محاولات الدخول المسموح بها. يرجى المحاولة لاحقاً.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد الإلكتروني غير مفعّل بعد في Firebase Authentication. يمكنك الدخول بحساب Google أو تفعيل Email/Password من لوحة Firebase.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إلغاء نافذة تسجيل الدخول بحساب Google.';
    case 'auth/popup-blocked':
      return 'تم حظر النافذة المنبثقة من المتصفح. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
    default:
      return 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.';
  }
}

export function useAuth() {
  const configured = isFirebaseConfigured() && auth !== null;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (configured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? 'عضو المؤسسة',
            isDemoSession: false,
          });
        } else {
          setUser(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    }

    // Preview mode when Firebase credentials haven't been configured yet
    try {
      const params = new URLSearchParams(window.location.search);
      const savedEmail = window.sessionStorage.getItem(DEMO_SESSION_KEY);
      if (savedEmail) {
        setUser({
          uid: 'demo-user',
          email: savedEmail,
          isDemoSession: true,
        });
      } else if (params.get('autostart') === '1') {
        const previewEmail = 'office@amromansour-law.eg';
        window.sessionStorage.setItem(DEMO_SESSION_KEY, previewEmail);
        setUser({
          uid: 'demo-user',
          email: previewEmail,
          isDemoSession: true,
        });
      }
    } catch {
      // Ignore storage access restrictions
    }
    setAuthLoading(false);
  }, [configured]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthError(null);
      setSubmitting(true);

      try {
        if (configured && auth) {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          return true;
        }

        const normalizedEmail = email.trim();
        try {
          window.sessionStorage.setItem(DEMO_SESSION_KEY, normalizedEmail);
        } catch {
          // Ignore storage error
        }
        setUser({
          uid: 'demo-user',
          email: normalizedEmail,
          isDemoSession: true,
        });
        return true;
      } catch (err) {
        setAuthError(translateAuthError(err));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [configured]
  );

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    if (!configured || !auth) return false;
    setAuthError(null);
    setSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return true;
    } catch (err) {
      setAuthError(translateAuthError(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [configured]);

  const signInDemoPreview = useCallback(() => {
    if (configured) return;
    setAuthError(null);
    const previewEmail = 'office@amromansour-law.eg';
    try {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, previewEmail);
    } catch {
      // Ignore storage error
    }
    setUser({
      uid: 'demo-user',
      email: previewEmail,
      isDemoSession: true,
    });
  }, [configured]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    if (configured && auth) {
      await firebaseSignOut(auth);
      return;
    }
    try {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      // Ignore storage error
    }
    setUser(null);
  }, [configured]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return {
    user,
    authLoading,
    authError,
    submitting,
    isFirebaseConfigured: configured,
    signIn,
    signInWithGoogle,
    signInDemoPreview,
    signOut,
    clearAuthError,
  };
}
