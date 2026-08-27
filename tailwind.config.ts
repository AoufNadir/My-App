import type { Config } from 'tailwindcss';

const cssVar = (name: string) => `var(${name})`;

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: cssVar('--color-primary'),
          light: cssVar('--color-primary-light'),
          dark: cssVar('--color-primary-dark'),
        },
        secondary: {
          DEFAULT: cssVar('--color-secondary'),
          light: cssVar('--color-secondary-light'),
          dark: cssVar('--color-secondary-dark'),
        },
        app: {
          bg: cssVar('--color-app-bg'),
        },
        surface: {
          DEFAULT: cssVar('--color-surface'),
          muted: cssVar('--color-surface-muted'),
          raised: cssVar('--color-surface-raised'),
        },
        border: {
          DEFAULT: cssVar('--color-border'),
          strong: cssVar('--color-border-strong'),
        },
        success: {
          DEFAULT: cssVar('--color-success'),
          light: cssVar('--color-success-light'),
          bg: cssVar('--color-success-bg'),
        },
        danger: {
          DEFAULT: cssVar('--color-danger'),
          light: cssVar('--color-danger-light'),
          bg: cssVar('--color-danger-bg'),
        },
        warning: {
          DEFAULT: cssVar('--color-warning'),
          light: cssVar('--color-warning-light'),
          bg: cssVar('--color-warning-bg'),
        },
        info: {
          DEFAULT: cssVar('--color-info'),
          bg: cssVar('--color-info-bg'),
        },
        financial: {
          profit: cssVar('--color-financial-profit'),
          'profit-bg': cssVar('--color-financial-profit-bg'),
          loss: cssVar('--color-financial-loss'),
          'loss-bg': cssVar('--color-financial-loss-bg'),
          debt: cssVar('--color-financial-debt'),
          'debt-bg': cssVar('--color-financial-debt-bg'),
          asset: cssVar('--color-financial-asset'),
          'asset-bg': cssVar('--color-financial-asset-bg'),
          eur: cssVar('--color-financial-eur'),
          usd: cssVar('--color-financial-usd'),
          dzd: cssVar('--color-financial-dzd'),
        },
        action: {
          buy: cssVar('--color-action-buy'),
          'buy-hover': cssVar('--color-action-buy-hover'),
          sell: cssVar('--color-action-sell'),
          'sell-hover': cssVar('--color-action-sell-hover'),
        },
      },
      fontFamily: {
        arabic: [cssVar('--font-arabic')],
        latin: [cssVar('--font-latin')],
      },
      spacing: {
        touch: cssVar('--spacing-touch'),
        'touch-lg': cssVar('--spacing-touch-lg'),
        'button-sm': cssVar('--spacing-button-sm'),
        'button-md': cssVar('--spacing-button-md'),
        'button-lg': cssVar('--spacing-button-lg'),
        'icon-button': cssVar('--spacing-icon-button'),
        input: cssVar('--spacing-input'),
        'page-x': cssVar('--spacing-page-x'),
        'page-y': cssVar('--spacing-page-y'),
        card: cssVar('--spacing-card'),
        section: cssVar('--spacing-section'),
      },
      borderRadius: {
        button: cssVar('--radius-button'),
        card: cssVar('--radius-card'),
      },
      fontSize: {
        'mobile-page-title': cssVar('--text-mobile-page-title'),
        'mobile-section-title': cssVar('--text-mobile-section-title'),
        'mobile-body': cssVar('--text-mobile-body'),
        'mobile-small': cssVar('--text-mobile-small'),
        'mobile-kpi': cssVar('--text-mobile-kpi'),
      },
      boxShadow: {
        card: cssVar('--shadow-card'),
        'card-hover': cssVar('--shadow-card-hover'),
        dialog: cssVar('--shadow-dialog'),
      },
    },
  },
};

export default config;
