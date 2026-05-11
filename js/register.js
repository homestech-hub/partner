// register.js

import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    ref,
    set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// =============================
// REGISTER FORM
// =============================
document
.getElementById("fullRegisterForm")
.addEventListener("submit", async (e) => {

    e.preventDefault();

    // ===== GET DATA =====
    const emailInput =
        document.getElementById("email").value.trim();

    const pass =
        document.getElementById("pass").value;

    const fullName =
        document.getElementById("fullName").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const area =
        document.getElementById("area").value.trim();

    const bankInfo =
        document.getElementById("bankInfo").value.trim();


    // ===== AUTO EMAIL DOMAIN =====
    const finalEmail =
        emailInput.includes("@")
        ? emailInput
        : `${emailInput}@homestech.com`;


    // ===== VALIDATE =====
    if (pass.length < 6) {
        alert("Mật khẩu phải ≥ 6 ký tự");
        return;
    }

    try {

        // =============================
        // 1. CREATE AUTH ACCOUNT
        // =============================
        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                finalEmail,
                pass
            );

        console.log("Auth created:", userCredential.user.uid);


        // =============================
        // 2. WAIT AUTH READY
        // =============================
        onAuthStateChanged(auth, async (user) => {

            if (!user) return;

            console.log("Auth Ready:", user.uid);

            // =============================
            // 3. SAVE PROFILE DATABASE
            // =============================
            await set(
                ref(db, `COMPANIES/homestech/users/${user.uid}`),
                {
                    uid: user.uid,
                    email: finalEmail,
                    fullName: fullName,
                    phone: phone,
                    area: area,
                    bankInfo: bankInfo,

                    status: "active",
                    role: "partner", // dashboard filter

                    createdAt: Date.now()
                }
            );

            console.log("User profile saved");

            alert("🎉 Đăng ký CTV thành công!");

            window.location.href = "ctv.html";
        });

    } catch (error) {

        console.error("Register Error:", error);

        let errorMsg = error.message;

        if (error.code === "auth/email-already-in-use")
            errorMsg = "Email / Username đã tồn tại";

        if (error.code === "auth/invalid-email")
            errorMsg = "Email không hợp lệ";

        if (error.code === "auth/weak-password")
            errorMsg = "Mật khẩu quá yếu";

        alert(errorMsg);
    }
});