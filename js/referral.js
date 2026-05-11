import { db } from "./firebase.js";
import { ref,set,push }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export function createCTV(name){

 const id=push(ref(db,"temp")).key;

 const code="CTV"+id.slice(-5);

 set(ref(db,
`COMPANIES/homestech/ctv/${id}`),{
   name,
   code,
   level:"silver",
   createdAt:Date.now()
 });

 return code;
}