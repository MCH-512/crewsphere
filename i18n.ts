import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async () => {
  // For stability, we'll only support the 'en' locale for now.
  const locale = 'en';
 
  return {
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
