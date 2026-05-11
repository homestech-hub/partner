onValue(
 ref(db,"COMPANIES/homestech/commissions"),
 snap=>{
   renderMoney(snap.val());
});