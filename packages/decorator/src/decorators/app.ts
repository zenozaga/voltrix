import { SYMBOLS } from '../__internal/symbols.constant';
import MetadataStore from '../__internal/stores/metadata.store';
import { ApplicationConfig } from './types';

export const Application = (options: ApplicationConfig) => {
  return (Target: any) => {
    MetadataStore.merge(SYMBOLS.APPLICATION, options, { target: Target });
  };
};
