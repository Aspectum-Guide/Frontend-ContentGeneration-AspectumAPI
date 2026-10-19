/* eslint-disable react-refresh/only-export-components -- provider and its theme hook are one public API */
import { createContext, useContext, useMemo } from 'react';

const UiThemeContext = createContext(null);

const EMPTY_THEME = Object.freeze({});
const toKebabCase = (value) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const toCssVariables = (prefix, values = {}) => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [`--aspectum-${prefix}-${toKebabCase(key)}`, value]),
);
const splitLayoutOverrides = (layout = {}) => {
  const {
    pageX,
    pageXLg,
    pageY,
    layoutGap,
    ...layoutSizes
  } = layout;

  return {
    spacing: {
      ...(pageX !== undefined && { pageX }),
      ...(pageXLg !== undefined && { pageXLg }),
      ...(pageY !== undefined && { pageY }),
      ...(layoutGap !== undefined && { layoutGap }),
    },
    layoutSizes,
  };
};

export default function UiProvider({ theme, children, className = '' }) {
  const resolvedTheme = theme || EMPTY_THEME;
  const style = useMemo(() => {
    const { spacing: legacySpacing, layoutSizes } = splitLayoutOverrides(resolvedTheme.layout);

    return {
      ...toCssVariables('color', resolvedTheme.colors),
      ...toCssVariables('radius', resolvedTheme.radius),
      ...toCssVariables('shadow', resolvedTheme.shadows),
      ...toCssVariables('space', legacySpacing),
      ...toCssVariables('space', resolvedTheme.spacing),
      ...toCssVariables('layout', layoutSizes),
    };
  }, [resolvedTheme]);

  return (
    <UiThemeContext.Provider value={resolvedTheme}>
      <div data-ui="provider" className={`contents ${className}`.trim()} style={style}>{children}</div>
    </UiThemeContext.Provider>
  );
}

export function useUiTheme() {
  return useContext(UiThemeContext);
}
