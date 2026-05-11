import { db,auth } from "./firebase.js";
import { ref,get }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export async function getUserProfile(){

 const uid=auth.currentUser.uid;

 const snap=await get(ref(db,
   `COMPANIES/homestech/users/${uid}`
 ));

 return snap.val();
}