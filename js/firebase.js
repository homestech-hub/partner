import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getDatabase }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6_DjiEdhP4uAsSyeYNsijt-Ha6d_kY-0",
  authDomain: "ctv-homestech.firebaseapp.com",
  databaseURL: "https://ctv-homestech-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ctv-homestech",
  storageBucket: "ctv-homestech.firebasestorage.app",
  messagingSenderId: "497129792242",
  appId: "1:497129792242:web:5d49277ae7e6f3ae82666b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);