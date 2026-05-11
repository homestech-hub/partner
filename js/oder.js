import { db } from "./firebase.js";
import { push,ref } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function createOrder(lead,value,type){

 push(ref(db,
"COMPANIES/homestech/orders"),{

   lead,
   value,
   type,
   createdAt:Date.now()

 });

}