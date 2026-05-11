import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, update, remove, push, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- QUẢN LÝ ĐĂNG XUẤT ---
window.logout = () => signOut(auth);

let allLeads = [];
let allUsers = {}; 

// --- KIỂM TRA QUYỀN TRUY CẬP KHI VÀO DASHBOARD ---
onAuthStateChanged(auth, async (user) => {
    if (!user) { 
        location.href = "adminlogin.html"; 
        return; 
    }
    
    try {
        const snapshot = await get(ref(db, `COMPANIES/homestech/users/${user.uid}`));
        if (!snapshot.exists() || snapshot.val().role !== "admin") {
            alert("Bạn không có quyền truy cập trang quản trị!");
            await signOut(auth);
            location.href = "adminlogin.html";
            return;
        }
        initAdminSystem();
    } catch (e) {
        console.error("Lỗi xác thực Admin:", e);
    }
});

// --- KHỞI TẠO DỮ LIỆU HỆ THỐNG ---
function initAdminSystem() {
    const usersRef = ref(db, "COMPANIES/homestech/users");
    onValue(usersRef, (snap) => {
        allUsers = snap.val() || {};
        
        // Cập nhật các bảng hiển thị
        renderCTVFilter(allUsers);   
        renderCTVTable(allUsers);    
        renderAccountTable(allUsers);

        // Tải dữ liệu khách hàng sau khi đã có danh sách User
        const leadRef = ref(db, "COMPANIES/homestech/leads");
        onValue(leadRef, (leadSnap) => {
            const data = leadSnap.val() || {};
            allLeads = Object.entries(data).reverse();
            window.applyFilters(); 
        });
    });
}

// --- TAB 1: DASHBOARD (QUẢN LÝ KHÁCH HÀNG) ---
window.applyFilters = () => {
    const searchName = document.getElementById("searchName").value.toLowerCase();
    const filterCTV = document.getElementById("filterCTV").value;
    
    let html = "";
    let s = { total: 0, pending: 0, done: 0, money: 0 };

    allLeads.forEach(([key, l]) => {
        const u = allUsers[l.sourceCTV];
        const ctvName = u ? (u.fullName || u.name || u.email) : "Trực tiếp";
        const matchName = (l.name || "").toLowerCase().includes(searchName) || (l.phone || "").includes(searchName);
        const matchCTV = !filterCTV || l.sourceCTV === filterCTV;

        if (matchName && matchCTV) {
            s.total++;
            const step = parseInt(l.step) || 1;
            if (step >= 2 && step <= 3) s.pending++;
            if (step >= 4) s.done++;
            s.money += parseInt(l.commission || 0);

            const labels = ["", "Mới tiếp nhận", "Đang khảo sát", "Đã báo giá", "Đã chốt đơn", "Tất toán thưởng"];
            
            html += `
                <tr>
                    <td class="ps-4">
                        <div class="fw-800 text-dark">${l.name || 'N/A'}</div>
                        <div class="small text-muted">${l.phone || ''}</div>
                    </td>
                    <td><div class="ctv-tag" style="background:#f0fdf4; color:#16a34a; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; display:inline-block;">${ctvName}</div></td>
                    <td><div class="small fw-700 text-primary">${l.project || 'N/A'}</div></td>
                    <td><span class="step-pill step-${step}">${labels[step]}</span></td>
                    <td><div class="fw-700 text-dark">${parseInt(l.commission || 0).toLocaleString()}đ</div></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-success btn-sm rounded-3" onclick="window.openUpdateModal('${key}', ${step}, ${l.commission || 0})">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                    </td>
                </tr>`;
        }
    });

    document.getElementById("leadTableBody").innerHTML = html || '<tr><td colspan="6" class="text-center py-4">Không có khách hàng</td></tr>';
    document.getElementById("statTotalLeads").innerText = s.total;
    document.getElementById("statPendingLeads").innerText = s.pending;
    document.getElementById("statDoneLeads").innerText = s.done;
    document.getElementById("statTotalMoney").innerText = s.money.toLocaleString() + 'đ';
};

// --- QUẢN LÝ MODAL CẬP NHẬT TRẠNG THÁI KHÁCH HÀNG ---
window.openUpdateModal = (key, step, commission) => {
    // Phải dùng đúng ID 'currentLeadId' có trong dashboard.html
    const idField = document.getElementById("currentLeadId");
    const stepField = document.getElementById("statusSelect");
    const commField = document.getElementById("commissionValue");

    if (idField && stepField && commField) {
        idField.value = key;
        stepField.value = step;
        commField.value = commission;
        
        // Mở đúng Modal 'updateStatusModal'
        bootstrap.Modal.getOrCreateInstance(document.getElementById('updateStatusModal')).show();
    } else {
        console.error("Không tìm thấy các thẻ input trong Modal cập nhật!");
    }
};
window.confirmUpdate = async () => {
    const key = document.getElementById("currentLeadId").value;
    const step = document.getElementById("statusSelect").value;
    const commission = document.getElementById("commissionValue").value;

    try {
        await update(ref(db, `COMPANIES/homestech/leads/${key}`), {
            step: parseInt(step),
            commission: parseInt(commission),
            updatedAt: Date.now()
        });
        
        // Đóng đúng Modal updateStatusModal
        bootstrap.Modal.getInstance(document.getElementById('updateStatusModal')).hide();
        alert("Cập nhật trạng thái khách hàng thành công!");
    } catch (e) { 
        alert("Lỗi: " + e.message); 
    }
};

// --- TAB 2: QUẢN LÝ CTV (CHỈ HIỂN THỊ PARTNER) ---
function renderCTVTable(users) {
    const container = document.getElementById("ctvTableBody");
    if (!container) return;
    let html = "";
    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") {
            html += `
                <tr>
                    <td class="ps-4">
                        <div class="fw-800 text-dark">${u.fullName || u.name || "N/A"}</div>
                        <div class="small text-muted" style="font-size:0.7rem">ID: ${uid.substring(0,8)}...</div>
                    </td>
                    <td>
                        <div class="small fw-600">${u.email || 'N/A'}</div>
                        <div class="small text-success fw-700">${u.phone || 'N/A'}</div>
                    </td>
                    <td><span class="small fw-600">${u.area || 'N/A'}</span></td>
                    <td><div class="small text-muted">${u.bankInfo || 'N/A'}</div></td>
                    <td class="text-end pe-4">
                        <div class="d-flex gap-1 justify-content-end">
                            <button class="btn btn-sm btn-light border" onclick="window.openEditCTVModal('${uid}')">
                                <i class="bi bi-pencil-square text-primary"></i>
                            </button>
                            <button class="btn btn-sm btn-light border" onclick="window.deleteUser('${uid}')">
                                <i class="bi bi-trash text-danger"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }
    });
    container.innerHTML = html || '<tr><td colspan="5" class="text-center py-3">Chưa có cộng tác viên</td></tr>';
}

// --- QUẢN LÝ MODAL CTV ---
window.openAddCTVModal = () => {
    document.getElementById("addCTVName").value = "";
    document.getElementById("addCTVEmail").value = "";
    document.getElementById("addCTVPhone").value = "";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addCTVModal')).show();
};

window.confirmAddCTV = async () => {
    const name = document.getElementById("addCTVName").value.trim();
    const phone = document.getElementById("addCTVPhone").value.trim();
    const username = document.getElementById("addCTVEmail").value.trim(); // Bây giờ đóng vai trò là Username
    const password = "123456"; // Mật khẩu mặc định bạn cấp cho CTV

    if (!name || !username) return alert("Vui lòng nhập Tên và Tên đăng nhập!");

    // Tự động chuyển Username thành email giả: ví dụ 'tiendalat' -> 'tiendalat@homestech.vn'
    const emailAccount = username.includes("@") ? username : `${username}@homestech.vn`;

    try {
        // Tạo một ID tạm thời hoặc dùng chính username làm ID
        const newUserRef = push(ref(db, "COMPANIES/homestech/users"));
        const uid = newUserRef.key;

        await set(newUserRef, {
            fullName: name,
            email: emailAccount,
            phone: phone,
            role: "partner",
            status: "active", // Trạng thái hoạt động
            createdAt: Date.now()
        });

        // THÔNG BÁO QUAN TRỌNG:
        // Vì Firebase Client SDK không cho phép Admin tạo Auth cho người khác khi đang login,
        // Bạn nên sử dụng Firebase Admin SDK (Cloud Functions) để tự động hóa 100%.
        // Nếu chưa có Cloud Functions, bạn chỉ cần thực hiện 1 bước duy nhất trong Console Auth 
        // là copy cái Email giả này dán vào mục Add User.
        
        alert(`✅ Đã lưu CTV: ${name}\n📧 Tài khoản: ${emailAccount}\n🔑 Mật khẩu: ${password}\n\nLưu ý: Hãy đảm bảo email này đã được thêm vào mục Authentication.`);
        
        bootstrap.Modal.getInstance(document.getElementById('addCTVModal')).hide();
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
};

window.openEditCTVModal = (uid) => {
    const u = allUsers[uid];
    if (!u) return;
    document.getElementById("editCTVId").value = uid;
    document.getElementById("editCTVName").value = u.fullName || u.name || "";
    document.getElementById("editCTVPhone").value = u.phone || "";
    document.getElementById("editCTVArea").value = u.area || "";
    document.getElementById("editCTVBank").value = u.bankInfo || "";
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editCTVModal')).show();
};

window.confirmEditCTV = async () => {
    const uid = document.getElementById("editCTVId").value;
    const updatedData = {
        fullName: document.getElementById("editCTVName").value.trim(),
        phone: document.getElementById("editCTVPhone").value.trim(),
        area: document.getElementById("editCTVArea").value.trim(),
        bankInfo: document.getElementById("editCTVBank").value.trim(),
        updatedAt: Date.now()
    };
    if (!updatedData.fullName) return alert("Họ tên không được để trống!");
    try {
        await update(ref(db, `COMPANIES/homestech/users/${uid}`), updatedData);
        bootstrap.Modal.getInstance(document.getElementById('editCTVModal')).hide();
        alert("Cập nhật CTV thành công!");
    } catch (e) { alert("Lỗi: " + e.message); }
};

// --- TAB 3: QUẢN LÝ TÀI KHOẢN ADMIN ---
function renderAccountTable(users) {
    const container = document.getElementById("accountTableBody");
    if (!container) return;
    let html = "";
    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "admin") {
            const isSuper = u.email === "homestech@gmail.com";
            html += `
                <tr>
                    <td class="ps-4">
                        <div class="fw-800 text-primary"><i class="bi bi-shield-check me-1"></i>${u.fullName || 'Admin'}</div>
                    </td>
                    <td><div class="small fw-600">${u.email}</div></td>
                    <td><span class="badge bg-primary-subtle text-primary rounded-pill px-3">Administrator</span></td>
                    <td class="text-end pe-4">
                        ${!isSuper ? `<button class="btn btn-sm btn-outline-danger border-0" onclick="window.changeUserRole('${uid}', 'partner')"><i class="bi bi-person-down"></i> Hạ quyền</button>` : '<small class="text-muted">Hệ thống</small>'}
                    </td>
                </tr>`;
        }
    });
    container.innerHTML = html;
}

window.changeUserRole = async (uid, newRole) => {
    if (!confirm(`Xác nhận đổi quyền tài khoản này?`)) return window.location.reload();
    try {
        await update(ref(db, `COMPANIES/homestech/users/${uid}`), { role: newRole });
        alert("Cập nhật quyền thành công!");
    } catch (e) { alert("Lỗi: " + e.message); }
};

window.deleteUser = (uid) => {
    if(confirm("Xác nhận xóa tài khoản này khỏi hệ thống?")) {
        remove(ref(db, `COMPANIES/homestech/users/${uid}`))
            .then(() => alert("Đã xóa thành công"))
            .catch(e => alert("Lỗi: " + e.message));
    }
};

// --- BỘ LỌC DASHBOARD ---
function renderCTVFilter(users) {
    const select = document.getElementById("filterCTV");
    if (!select) return;
    let html = '<option value="">Tất cả CTV</option>';
    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") {
            html += `<option value="${uid}">${u.fullName || u.name || u.email}</option>`;
        }
    });
    select.innerHTML = html;
}

// Ràng buộc sự kiện tìm kiếm
document.getElementById("searchName").addEventListener("input", window.applyFilters);
document.getElementById("filterCTV").addEventListener("change", window.applyFilters);