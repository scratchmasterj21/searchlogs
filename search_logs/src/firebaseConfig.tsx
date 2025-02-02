// firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDartyiMXChZ3RVXPnxcPhynZ_BTEWc0jM",
    authDomain: "gfa-typing.firebaseapp.com",
    databaseURL: "https://gfa-typing-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gfa-typing",
    storageBucket: "gfa-typing.appspot.com",
    messagingSenderId: "462808707659",
    appId: "1:462808707659:web:7bb886979156c5d47653ce",
    measurementId: "G-950PGZTH9D"
  };  



const firebaseConfigLog = {
  apiKey: "AIzaSyA1NZmXtKZHO785eORJXrE3coHmvPJeHPU",
  authDomain: "englishconversationbot.firebaseapp.com",
  databaseURL: "https://englishconversationbot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "englishconversationbot",
  storageBucket: "englishconversationbot.appspot.com",
  messagingSenderId: "262725000841",
  appId: "1:262725000841:web:1f37ef24913d513a0fb058",
  measurementId: "G-X02DDLC8XT"
};  

// Initialize first app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

// Initialize second app with a unique name
const appLog = !getApps().find(app => app.name === 'appLog')
  ? initializeApp(firebaseConfigLog, 'appLog')
  : getApp('appLog');
const databaseLog = getDatabase(appLog);

export {app, database, databaseLog };
