import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, Scale, AlertCircle } from 'lucide-react';
import { FIRM_NAME } from '../types/content';
import { validateLoginForm } from '../utils/contentUtils';

interface LoginScreenProps {
  isFirebaseConfigured: boolean;
  authError: string | null;
  submitting: boolean;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onGoogleSignIn: () => Promise<boolean>;
  onDemoPreview: () => void;
  onClearError: () => void;
}

export function LoginScreen({
  isFirebaseConfigured,
  authError,
  submitting,
  onSignIn,
  onGoogleSignIn,
  onDemoPreview,
  onClearError,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    onClearError();

    const validation = validateLoginForm(email, password);
    setEmailError(validation.emailError);
    setPasswordError(validation.passwordError);

    if (!validation.valid) {
      return;
    }

    await onSignIn(email, password);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col lg:flex-row">
      {/* Institutional Navy Panel */}
      <aside className="lg:w-[44%] bg-[#0B192C] text-white px-6 py-10 sm:px-10 lg:px-14 lg:py-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-l border-[#C9A45C]/30">
        <div>
          <div className="inline-flex items-center gap-3 mb-8">
            <span
              className="w-12 h-12 rounded-xl bg-[#132944] border border-[#C9A45C]/50 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Scale className="w-6 h-6 text-[#C9A45C]" />
            </span>
            <span className="text-sm font-medium text-[#E7C986]">
              لوحة إدارة المحتوى القانوني اليومي
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-snug text-white mb-5">
            {FIRM_NAME}
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md">
            منصة داخلية مخصصة لفريق العمل لمراجعة الأخبار المصرية ذات البعد القانوني، واعتماد
            بوستات فيسبوك الجاهزة وسكربتات الفيديو القصيرة، ومتابعة حالة النشر اليومية والأرشيف.
          </p>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-right">
          <div>
            <p className="text-xs text-[#E7C986] font-semibold">المواضيع</p>
            <p className="text-xs text-slate-300 mt-1">متابعة يومية للزاوية القانونية</p>
          </div>
          <div>
            <p className="text-xs text-[#E7C986] font-semibold">البوستات</p>
            <p className="text-xs text-slate-300 mt-1">نسخ مباشر واعتماد للنشر</p>
          </div>
          <div>
            <p className="text-xs text-[#E7C986] font-semibold">السكربتات</p>
            <p className="text-xs text-slate-300 mt-1">نصوص فيديو جاهزة بالمدة</p>
          </div>
        </div>
      </aside>

      {/* Login Form Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#0B192C]">تسجيل الدخول</h2>
            <p className="text-sm text-[#475569] mt-1.5">
              أدخل البريد الإلكتروني وكلمة المرور للوصول إلى لوحة المحتوى القانوني.
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="mb-6 p-3.5 rounded-lg bg-[#FBF8F1] border border-[#E5D3AE] text-xs leading-relaxed text-[#7A581B]">
              <p className="font-semibold mb-1">وضع المعاينة التجريبية نشط</p>
              <p>
                لم يتم ربط إعدادات مشروع Firebase بعد في الملف{' '}
                <code
                  dir="ltr"
                  className="font-mono text-[#0B192C] bg-[#F3E9D2]/70 px-1.5 py-0.5 rounded whitespace-nowrap inline-block"
                >
                  src/firebase-config.ts
                </code>
                . يمكنك تسجيل الدخول بأي بريد وكلمة مرور صحيحة أو استخدام زر المعاينة أدناه لاستعراض
                الواجهة بالبيانات التجريبية.
              </p>
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-[#1E293B] mb-1.5"
              >
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(undefined);
                    if (authError) onClearError();
                  }}
                  placeholder="name@amromansour-law.eg"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'login-email-error' : undefined}
                  className={`w-full pr-10 pl-3.5 py-2.5 min-h-[44px] text-sm text-left bg-white border rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0B192C]/20 focus:border-[#0B192C] ${
                    emailError ? 'border-[#DC2626]' : 'border-[#CBD5E1]'
                  }`}
                />
              </div>
              {emailError && (
                <p id="login-email-error" className="mt-1.5 text-xs text-[#DC2626]">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[#1E293B] mb-1.5"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(undefined);
                    if (authError) onClearError();
                  }}
                  placeholder="••••••••"
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? 'login-password-error' : undefined}
                  className={`w-full pr-10 pl-11 py-2.5 min-h-[44px] text-sm text-left bg-white border rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0B192C]/20 focus:border-[#0B192C] ${
                    passwordError ? 'border-[#DC2626]' : 'border-[#CBD5E1]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0B192C] rounded focus-visible:outline-2 focus-visible:outline-[#0B192C]"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p id="login-password-error" className="mt-1.5 text-xs text-[#DC2626]">
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C] disabled:opacity-60"
            >
              {submitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>

          {isFirebaseConfigured ? (
            <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onGoogleSignIn()}
                className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 min-h-[44px] bg-white hover:bg-[#F8FAFC] text-[#0B192C] border border-[#CBD5E1] text-sm font-semibold rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C] disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>تسجيل الدخول بحساب Google</span>
              </button>
            </div>
          ) : (
            <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={onDemoPreview}
                className="w-full py-2.5 px-4 min-h-[44px] bg-[#FBF8F1] hover:bg-[#F3E9D2] text-[#7A581B] border border-[#D4B475] text-sm font-semibold rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8924A]"
              >
                الدخول للمعاينة ببيانات تجريبية
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[#64748B]">
            الوصول مقتصر على أعضاء فريق {FIRM_NAME} المصرح لهم.
          </p>
        </div>
      </main>
    </div>
  );
}
