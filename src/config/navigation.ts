export type AppViewTarget =
  | 'statistiques'
  | 'tresorerie'
  | 'expenses'
  | 'orders'
  | 'services'
  | 'investors'
  | 'analytics'
  | 'insights';

export type NavigationSectionId = 'finance' | 'management' | 'analytics' | 'settings';

export type NavigationItemConfig = {
  target: AppViewTarget;
  labelKey: string;
};

export type NavigationSectionConfig = {
  id: NavigationSectionId;
  labelKey: string;
  items: NavigationItemConfig[];
};

export const MORE_NAVIGATION_SECTIONS: NavigationSectionConfig[] = [
  {
    id: 'finance',
    labelKey: 'nav.financeSection',
    items: [
      { target: 'statistiques', labelKey: 'nav.portfolio' },
      { target: 'tresorerie', labelKey: 'nav.treasury' },
      { target: 'expenses', labelKey: 'nav.expenses' },
    ],
  },
  {
    id: 'management',
    labelKey: 'nav.managementSection',
    items: [
      { target: 'orders', labelKey: 'nav.orders' },
      { target: 'services', labelKey: 'nav.services' },
      { target: 'investors', labelKey: 'nav.investors' },
    ],
  },
  {
    id: 'analytics',
    labelKey: 'nav.analyticsSection',
    items: [
      { target: 'analytics', labelKey: 'nav.analytics' },
      { target: 'insights', labelKey: 'nav.insights' },
    ],
  },
  {
    id: 'settings',
    labelKey: 'nav.settingsSection',
    items: [],
  },
];

export const SECONDARY_VIEWS = MORE_NAVIGATION_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.target),
);
