import { useContext } from 'react';
import { LayoutActionsContext } from './LayoutActionsContext';

export function useLayoutActions() {
  return useContext(LayoutActionsContext);
}