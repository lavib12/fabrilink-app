/*
  FabriLink app settings
  ----------------------
  firebase: null  -> DEMO MODE. Data is saved on each phone only.

  To make the app LIVE (buyers, suppliers and admin on different phones see the same data):
  1. Create a free project at https://console.firebase.google.com
  2. Build > Firestore Database > Create database
  3. Project settings > Your apps > Add app > Web (</>), then copy the firebaseConfig values below.
  On first launch the app loads the starter data into your database automatically.
*/
window.FABRILINK_CONFIG = {
  app: true,
  firebase: null
  // firebase: {
  //   apiKey: "PASTE_HERE",
  //   authDomain: "your-project.firebaseapp.com",
  //   projectId: "your-project",
  //   storageBucket: "your-project.appspot.com",
  //   messagingSenderId: "000000000000",
  //   appId: "1:000000000000:web:xxxxxxxxxxxx"
  // }
};
