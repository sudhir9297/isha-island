import { createContext, useContext } from 'react';
export const WindContext = createContext(null);
export function useWindField() { return useContext(WindContext); }
