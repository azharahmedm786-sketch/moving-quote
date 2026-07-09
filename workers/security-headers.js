export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);

    // Clone the response so that it's no longer immutable
    const newResponse = new Response(response.body, response);

    newResponse.headers.set("X-Frame-Options", "DENY");
    newResponse.headers.set("X-Content-Type-Options", "nosniff");
    newResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    newResponse.headers.set("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
    newResponse.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://checkout.razorpay.com https://www.gstatic.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://*.railway.app https://api.emailjs.com; img-src 'self' data: https://*.googleapis.com https://*.ggpht.com https://maps.gstatic.com; frame-src https://checkout.razorpay.com; object-src 'none'; base-uri 'self'; form-action 'self';";

    newResponse.headers.set("Content-Security-Policy", csp);

    return newResponse;
  },
};
