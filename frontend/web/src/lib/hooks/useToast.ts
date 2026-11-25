'use client';

import { useState } from 'react';

export interface ToastState {
  text: string;
  type: 'success' | 'error';
}

export type showToastFn = (text: string, type?: 'success' | 'error') => void;

export function useToast() {
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);

  const showToast: showToastFn = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  return { toastMessage, showToast };
}
