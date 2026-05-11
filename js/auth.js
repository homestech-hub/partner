import { auth } from "./firebase.js";

import {
 signInWithEmailAndPassword,
 onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

window.login = async function(){

 const email = document.getElementById("email").value;
 const pass = document.getElementById("pass").value;

 await signInWithEmailAndPassword(auth,email,pass);

 location.href="ctv.html";
}

onAuthStateChanged(auth,(user)=>{
 if(user && location.pathname.includes("login"))
   location.href="ctv.html";
});