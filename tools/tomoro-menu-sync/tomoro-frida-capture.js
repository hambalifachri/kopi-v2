"use strict";

const API_HOST = "api-service.tomoro-coffee.id";

function sendJson(value) {
  send(JSON.stringify(value));
}

Java.perform(function () {
  try {
    const CallServerInterceptor = Java.use("okhttp3.internal.http.b");
    const originalIntercept = CallServerInterceptor.intercept.overload("okhttp3.c0$a");
    originalIntercept.implementation = function (chain) {
      const response = originalIntercept.call(this, chain);
      try {
        const request = response.M0();
        const url = request.t().toString();
        if (url.indexOf(API_HOST) >= 0 && /getStoreList\/v3|getMenuList/.test(url)) {
          sendJson({
            kind: "response",
            method: request.n(),
            url: url,
            status: response.T(),
            body: response.y0(2 * 1024 * 1024).string(),
          });
        }
      } catch (error) {
        sendJson({ kind: "capture-error", error: String(error) });
      }
      return response;
    };
    sendJson({ kind: "ready", hook: "okhttp3.internal.http.b.intercept" });
  } catch (error) {
    sendJson({ kind: "hook-error", hook: "CallServerInterceptor", error: String(error) });
  }
});
