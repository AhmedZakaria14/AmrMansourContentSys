import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white border border-[#FECACA] rounded-xl p-8 text-center shadow-xs">
            <AlertCircle
              className="w-10 h-10 text-[#DC2626] mx-auto mb-3"
              aria-hidden="true"
            />
            <h1 className="text-lg font-bold text-[#0B192C] mb-2">
              حدث خطأ أثناء تشغيل اللوحة
            </h1>
            <p className="text-sm text-[#475569] mb-6">
              يرجى إعادة تحميل الصفحة أو التحقق من إعدادات الاتصال والصلاحيات.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#0B192C] hover:bg-[#132944] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
