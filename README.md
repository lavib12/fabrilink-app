# FabriLink — Android app

The FabriLink marketplace as an Android app. It has the Buyer, Supplier and Admin portals and the product configurator pop-up, which lets you choose the section, colour and quality.

## 1. Run it on your phone (about 15 minutes the first time)

1. Install **Android Studio** (free) from https://developer.android.com/studio
2. Unzip this folder. In Android Studio choose **File → Open** and select the `FabriLink-Android` folder.
3. Wait while Android Studio downloads Gradle and the Android SDK. You need internet for this, and it only happens the first time. If it asks to "trust the project", say yes.
4. On your phone, turn on Developer options and USB debugging:
   - Go to **Settings → About phone** and tap **Build number** 7 times.
   - Go to **Settings → Developer options** and turn on **USB debugging**.
5. Connect the phone with a USB cable, pick it in the device list at the top, and press the green **Run ▶** button.

## 2. Make an APK file to share

**Build → Build App Bundle(s) / APK(s) → Build APK(s)**, then click **locate**.
The file is `app/build/outputs/apk/debug/app-debug.apk`. Send it to any Android phone and open it to install. The phone has to allow "Install unknown apps".

For the **Google Play Store**, use **Build → Generate Signed App Bundle / APK** instead. It creates a signing key; keep that key safe, because you need it for every update.

## 3. Demo mode vs live mode

- **Demo mode (default):** each phone keeps its own data. This is good for showing the app to someone.
- **Live mode:** every phone shares the same data. A supplier's new product appears for buyers, a buyer's RFQ reaches suppliers, and so on. To turn it on:
  1. Create a free project at https://console.firebase.google.com
  2. Go to **Build → Firestore Database → Create database** (start in *test mode* while developing).
  3. Go to **Project settings → Your apps → Web app (</>)** and copy the `firebaseConfig` values.
  4. Paste them into `app/src/main/assets/www/config.js`, replacing `firebase: null`, then press Run again.
  5. On first launch the app fills the database with the starter companies, fabrics, RFQs and orders.

> Test-mode Firestore rules are open to anyone and expire after 30 days. Before real users join, add Firebase Authentication (proper logins) and lock down the rules.

## 4. Changing the app

All the screens are in `app/src/main/assets/www/index.html`. The native Android part is just `MainActivity.java`, which shows that page, handles the back button and keeps the app clear of the status bar.

| What | Where |
|---|---|
| App name | `app/src/main/res/values/strings.xml` |
| App icon | `app/src/main/res/mipmap-*/ic_launcher*.png` |
| Package ID (Play Store) | `applicationId` in `app/build.gradle` |
| Version for updates | `versionCode` / `versionName` in `app/build.gradle` |

## Notes

- Login is a portal and company picker. There are no passwords yet.
- Payments are simulated. No money moves.
- The app needs Android 7.0 or newer.
- An iPhone version needs a Mac with Xcode. The same `www` folder can be wrapped there.
