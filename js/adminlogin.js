import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const pass = document.getElementById("pass").value;
    const btn = e.target.querySelector("button");
    const err = document.getElementById("errMsg");

    btn.disabled = true;
    btn.innerText = "ĐANG KIỂM TRA...";
    err.innerText = "";

    try {
        // 1. Đăng nhập Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        // 2. Kiểm tra Role trong database (nhánh users)
        const userRef = ref(db, `COMPANIES/homestech/users/${user.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.role === "admin") {
                // Đúng quyền Admin -> Vào Dashboard
                location.href = "dashboard.html";
            } else {
                // Có tài khoản nhưng không phải Admin (ví dụ CTV nhầm trang)
                err.innerText = "Lỗi: Bạn không có quyền truy cập trang quản trị!";
                await auth.signOut();
            }
        } else {
            err.innerText = "Tài khoản chưa được phân quyền hệ thống!";
            await auth.signOut();
        }

    } catch (error) {
        console.error(error);
        err.innerText = "Email hoặc mật khẩu không chính xác!";
    } finally {
        btn.disabled = false;
        btn.innerText = "ĐĂNG NHẬP HỆ THỐNG";
    }
});