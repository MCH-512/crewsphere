
import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async () => {
  // Provide a static locale, simplifying the configuration.
  // Messages can be defined here or in separate JSON files.
  return {
    locale: 'en',
    messages: (await import('../messages/en.json')).default
  };
});
