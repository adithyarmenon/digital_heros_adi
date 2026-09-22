'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastFn = (msg: string, isErr?: boolean) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ msg: string; err: boolean; show: boolean }>({
    msg: '',
    err: false,
    show: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast: ToastFn = useCallback((msg, isErr = false) => {
    setState({ msg, err: isErr, show: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState((s) => ({ ...s, show: false })), 2800);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toastbox" className={(state.show ? 'show ' : '') + (state.err ? 'err' : '')}>
        {state.msg}
      </div>
    </ToastCtx.Provider>
  );
}
