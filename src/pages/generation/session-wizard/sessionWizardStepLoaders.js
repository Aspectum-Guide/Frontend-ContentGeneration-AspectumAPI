export const sessionWizardStepLoaders = {
  attractions: () => import('./SessionWizardAttractionsStep'),
  interactiveLocations: () => import('./SessionWizardInteractiveLocationsStep'),
  city: () => import('./SessionWizardCityStep'),
  generateCityFull: () => import('./SessionWizardGenerateCityFull'),
  publish: () => import('./SessionWizardPublishStep'),
  tagsCatalog: () => import('./SessionWizardTagsCatalogStep'),
  cityTags: () => import('./SessionWizardCityTagsPicker'),
  cityInfo: () => import('./SessionWizardCityInfoStep'),
  attractionInfo: () => import('./SessionWizardAttractionInfoStep'),
  attractionFeed: () => import('./SessionWizardAttractionFeedStep.jsx'),
  attractionAudioGuides: () => import('./SessionWizardAttractionAudioGuidesBlock.jsx'),
};
