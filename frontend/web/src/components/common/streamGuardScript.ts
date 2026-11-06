/**
 * Inline pre-hydration script to suppress benign stream teardown rejections in Chromium.
 *
 * When Next.js cancels/aborts an in-flight streaming fetch (such as a 307 redirect
 * during navigation or prefetch), Chromium throws:
 * - `TypeError: Cannot write to a CLOSED writable stream`
 * - `TypeError: Cannot close a CLOSED writable stream`
 *
 * This script runs synchronously before any dev client scripts or React runtime,
 * capturing the unhandled rejections and suppressing console.error forwarding.
 */
export const streamGuardScript = `(function(){
  if (typeof window === 'undefined') return;

  function isClosedStreamError(err) {
    if (!err) return false;
    var msg = (err && (err.message || err.stack)) || (typeof err === 'string' ? err : String(err || ''));
    return (
      msg.indexOf('CLOSED writable stream') !== -1 ||
      msg.indexOf('closed writable stream') !== -1 ||
      msg.indexOf('WritableStreamDefaultWriter') !== -1 ||
      msg.indexOf('Cannot close a CLOSED') !== -1 ||
      msg.indexOf('Cannot write to a CLOSED') !== -1 ||
      msg.indexOf('closed or errored') !== -1
    );
  }

  // Capture unhandled promise rejections in the capture phase
  window.addEventListener('unhandledrejection', function(event) {
    if (isClosedStreamError(event && event.reason)) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);

  // Capture window errors in the capture phase
  window.addEventListener('error', function(event) {
    if (isClosedStreamError(event && (event.error || event.message))) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    }
  }, true);

  // Intercept console.error so Turbopack dev client doesn't relay to terminal
  if (typeof console !== 'undefined' && console.error) {
    var origConsoleError = console.error;
    console.error = function() {
      for (var i = 0; i < arguments.length; i++) {
        if (isClosedStreamError(arguments[i])) {
          return;
        }
      }
      return origConsoleError.apply(console, arguments);
    };
  }
})();`;
