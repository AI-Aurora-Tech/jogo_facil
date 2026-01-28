
import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

// Using React.Component explicitly to ensure standard inheritance of props and state
class ErrorBoundary extends React.Component<Props, State> {
  // Explicitly defining the constructor ensures props are correctly bound
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#022c22] flex items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-[#022c22] italic uppercase mb-2">Ops! Ocorreu um erro</h2>
            <p className="text-gray-500 text-sm font-medium mb-8">Algo impediu o carregamento. Vamos tentar resetar sua sessão.</p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-[#022c22] text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform"
              >
                Tentar Novamente
              </button>
              <button 
                onClick={this.handleReset}
                className="w-full bg-red-50 text-red-600 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-widest"
              >
                Limpar Dados e Sair
              </button>
            </div>
          </div>
        </div>
      );
    }
    // Accessing children from props is now safe and correctly typed
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
