import { createContext } from 'react';

export type Notify = (message: string) => void;

export const ToastContext = createContext<Notify>(() => {});
