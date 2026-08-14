import { handleProviderRequest } from "../../providers/runtime.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ message: "method not allowed" }), {
      status: 405,
      headers: {
        allow: "GET",
        "content-type": "application/json; charset=utf-8",
      },
    });
  }

  return handleProviderRequest(context.request);
}
