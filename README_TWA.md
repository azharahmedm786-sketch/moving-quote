# PackZen Trusted Web Activity (TWA)

This repository includes the setup for a Trusted Web Activity (TWA) for the PackZen PWA.

## Build Instructions

1.  Make sure you have JDK 17 and Android SDK installed.
2.  Navigate to the `twa` directory.
3.  Install Bubblewrap CLI: `npm install -g @bubblewrap/cli`
4.  Run `bubblewrap build`.
5.  When prompted for the keystore and key password, enter the keystore password.

## Output

-   `app-release-bundle.aab`: Android App Bundle for Play Store submission.
-   `app-release-signed.apk`: Signed APK for direct installation.

## Digital Asset Links

The `assetlinks.json` file is located in the `.well-known` directory. This needs to be deployed to `https://packzen.in/.well-known/assetlinks.json` to enable the TWA to remove the browser address bar.
