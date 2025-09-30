
export function register() {
  // This is the instrumentation hook.
  // We have removed Sentry, so this function is currently empty.
  // It is kept to satisfy the `instrumentationHook: true` setting in next.config.js.
  console.log("Instrumentation hook registered (no services initialized).");
}
