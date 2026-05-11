import { db } from "./firebase.js";
import { ref, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

window.submitLead = function() {
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    
    if(!name || !phone) return alert("Vui lòng nhập đủ thông tin");

    const refCTV = localStorage.getItem("refCTV") || "direct";

    push(ref(db, "COMPANIES/homestech/leads"), {
        name,
        phone,
        sourceCTV: refCTV,
        status: "new",
        createdAt: Date.now()
    }).then(() => {
        alert("Đăng ký tư vấn thành công! Homestech sẽ liên hệ bạn sớm.");
        document.getElementById("name").value = "";
        document.getElementById("phone").value = "";
    });
}