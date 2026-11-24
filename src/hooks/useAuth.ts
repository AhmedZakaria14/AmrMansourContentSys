import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type AuthError,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase-config';
import { ADMIN_AUTH_EMAIL, resolveUsernameToEmail } from '../utils/contentUtils';

export interface AuthUser {
  uid: string;
  username: string;
  email: string;
  isDemoSession: boolean;
}

const DEMO_SESSION_KEY = 'amro_mansour_demo_auth_user';

function translateAuthError(error: unknown): string {
  const code = (error as AuthError)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'صيغة اسم المستخدم غير صحيحة.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة المؤسسة.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد محاولات الدخول المسموح بها. يرجى المحاولة لاحقاً.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بكلمة المرور غير مفعّل بعد في Firebase Authentication. يرجى تفعيل Email/Password وإضافة حساب admin@amromansour-law.eg من لوحة Firebase.';
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
      const activeAuth = auth;
      const unsubscribe = onAuthStateChanged(activeAuth, (firebaseUser) => {
        // Enforce single password-authenticated admin account on client as well
        const email = (firebaseUser?.email ?? '').toLowerCase();
        const hasPasswordProvider = firebaseUser?.providerData?.some(
          (p) => p.providerId === 'password'
        );

        if (firebaseUser && email === ADMIN_AUTH_EMAIL && hasPasswordProvider) {
          setUser({
            uid: firebaseUser.uid,
            username: 'admin',
            email,
            isDemoSession: false,
          });
        } else {
          if (firebaseUser) {
            void firebaseSignOut(activeAuth);
          }
          setUser(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    }

    // Preview mode only when Firebase config placeholders have not been filled
    try {
      const params = new URLSearchParams(window.location.search);
      const savedUser = window.sessionStorage.getItem(DEMO_SESSION_KEY);
      if (savedUser) {
        setUser({
          uid: 'demo-user',
          username: savedUser,
          email: resolveUsernameToEmail(savedUser),
          isDemoSession: true,
        });
      } else if (params.get('autostart') === '1') {
        window.sessionStorage.setItem(DEMO_SESSION_KEY, 'admin');
        setUser({
          uid: 'demo-user',
          username: 'admin',
          email: ADMIN_AUTH_EMAIL,
          isDemoSession: true,
        });
      }
    } catch {
      // Ignore storage access restrictions
    }
    setAuthLoading(false);
  }, [configured]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setAuthError(null);
      setSubmitting(true);

      try {
        const resolvedEmail = resolveUsernameToEmail(username);

        if (configured && auth) {
          if (resolvedEmail !== ADMIN_AUTH_EMAIL) {
            setAuthError('اسم المستخدم أو كلمة المرور غير صحيحة.');
            return false;
          }
          await signInWithEmailAndPassword(auth, resolvedEmail, password);
          return true;
        }

        const normalizedUser = username.trim().toLowerCase();
        try {
          window.sessionStorage.setItem(DEMO_SESSION_KEY, normalizedUser);
        } catch {
          // Ignore storage error
        }
        setUser({
          uid: 'demo-user',
          username: normalizedUser,
          email: resolvedEmail,
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

  const signInDemoPreview = useCallback(() => {
    if (configured) return;
    setAuthError(null);
    try {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, 'admin');
    } catch {
      // Ignore storage error
    }
    setUser({
      uid: 'demo-user',
      username: 'admin',
      email: ADMIN_AUTH_EMAIL,
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
    signInDemoPreview,
    signOut,
    clearAuthError,
  };
}
