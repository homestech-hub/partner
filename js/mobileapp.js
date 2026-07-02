import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, update, remove, push, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

window.logout = () => signOut(auth);

let allLeads = [];
let allUsers = {};
let appReady = false;

// ==========================================
// 1. AUTH XÁC THỰC ADMIN TRÊN ĐIỆN THOẠI
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        location.href = "adminlogin.html"; //
        return;
    }
    try {
        const snapshot = await get(ref(db, `COMPANIES/homestech/users/${user.uid}`)); //
        const userData = snapshot.val(); //

        if (!snapshot.exists() || userData.role !== "admin") { //
            alert("Bạn không có quyền truy cập quản trị hệ thống!"); //
            await signOut(auth); //
            location.href = "adminlogin.html"; //
            return;
        }
        initMobileAdmin();
    } catch (e) {
        console.error(e);
    }
});

// ==========================================
// 2. LẮNG NGHE DỮ LIỆU THỜI GIAN THỰC
// ==========================================
function initMobileAdmin() {
    appReady = true;

    // Lắng nghe người dùng/CTV
    onValue(ref(db, "COMPANIES/homestech/users"), (snap) => {
        allUsers = snap.val() || {}; //
        renderCTVFilter(allUsers);
        renderCTVList(allUsers);
    });

    // Lắng nghe phễu Leads khách hàng
    onValue(ref(db, "COMPANIES/homestech/leads"), (snap) => {
        const data = snap.val() || {}; //
        allLeads = Object.entries(data).reverse(); //
        applyMobileFilters();
    });

    // Tự động lắng nghe danh sách báo giá CRM
    window.renderQuotes();
}

// ==========================================
// 3. XỬ LÝ QUẢN LÝ KHÁCH HÀNG (LEADS TAB)
// ==========================================
function applyMobileFilters() {
    if (!appReady) return;

    const searchKeyword = (document.getElementById("m-searchName")?.value || "").toLowerCase().trim();
    const filterCTV = document.getElementById("m-filterCTV")?.value || "";
    const container = document.getElementById("m-leadListContainer");
    if (!container) return;

    let html = "";
    let s = { total: 0, pending: 0, done: 0, money: 0 }; //
    const labels = ["", "Mới tiếp nhận", "Đang khảo sát", "Đã báo giá", "Đã chốt đơn", "Khách không chốt"]; //

    allLeads.forEach(([key, l]) => {
        const u = allUsers[l.sourceCTV]; //
        const ctvName = u ? (u.fullName || u.name || u.email) : "Trực tiếp"; //

        const matchSearch = (l.name || "").toLowerCase().includes(searchKeyword) || (l.phone || "").includes(searchKeyword);
        const matchCTV = !filterCTV || l.sourceCTV === filterCTV; //

        if (matchSearch && matchCTV) {
            s.total++; //
            const step = parseInt(l.step) || 1; //
            if (step >= 2 && step <= 3) s.pending++; //
            if (step >= 4) s.done++; //
            s.money += parseInt(l.commission || 0); //

            html += `
                <div class="m-item-card">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="ctv-badge mb-1 d-inline-block">${ctvName}</span>
                            <h6 class="fw-800 mb-0 text-dark text-uppercase">${l.name || 'N/A'}</h6>
                            <div class="small fw-700 text-success mt-1"><i class="bi bi-telephone-fill me-1"></i>${l.phone || ''}</div>
                        </div>
                        <span class="step-pill step-${step}">${labels[step]}</span>
                    </div>
                    <div class="small fw-600 text-muted mb-2"><i class="bi bi-briefcase me-1"></i>Dự án: ${l.project || 'N/A'}</div>
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                        <div class="small fw-800 text-danger">Hoa hồng: ${(parseInt(l.commission || 0)).toLocaleString()}đ</div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-success" onclick="openMUpdateModal('${key}', ${step}, ${l.commission || 0})"><i class="bi bi-arrow-repeat"></i> Tiến độ</button>
                            <button class="btn btn-sm btn-light border text-danger" onclick="deleteMLead('${key}')"><i class="bi bi-trash"></i> Xóa</button>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html || `<div class="text-center text-muted py-5 small">Không tìm thấy khách hàng nào.</div>`;

    // Cập nhật thẻ KPI số liệu
    if (document.getElementById("m-statTotalMoney")) document.getElementById("m-statTotalMoney").innerText = s.money.toLocaleString() + "đ"; //
    if (document.getElementById("m-statTotalLeads")) document.getElementById("m-statTotalLeads").innerText = s.total; //
    if (document.getElementById("m-statPendingLeads")) document.getElementById("m-statPendingLeads").innerText = s.pending; //
    if (document.getElementById("m-statDoneLeads")) document.getElementById("m-statDoneLeads").innerText = s.done; //
}

// Xử lý modal tiến độ nhanh trên Mobile
window.openMUpdateModal = (key, step, commission) => {
    document.getElementById("m-currentLeadId").value = key;
    document.getElementById("m-statusSelect").value = step;
    document.getElementById("m-commissionValue").value = commission;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("m-updateStatusModal")).show();
};

window.confirmMUpdate = async () => {
    const key = document.getElementById("m-currentLeadId").value;
    const step = document.getElementById("m-statusSelect").value;
    const commission = document.getElementById("m-commissionValue").value;
    try {
        await update(ref(db, `COMPANIES/homestech/leads/${key}`), { //
            step: parseInt(step), //
            commission: parseInt(commission), //
            updatedAt: Date.now() //
        });
        bootstrap.Modal.getInstance(document.getElementById("m-updateStatusModal")).hide();
        alert("Đã cập nhật tiến độ!");
    } catch (e) { alert(e.message); }
};

window.deleteMLead = (key) => {
    if(confirm("Bạn chắc chắn muốn xóa khách hàng này chứ?")) {
        remove(ref(db, `COMPANIES/homestech/leads/${key}`)).then(() => alert("Đã xóa!")); //
    }
};

// ==========================================
// 4. CRM MODULE: BÁO GIÁ CHO ADMIN MOBILE
// ==========================================
window.toggleMQuoteForm = function(showForm) {
    const listView = document.getElementById("m-quoteListView");
    const formView = document.getElementById("m-quoteFormView");
    if (showForm) {
        listView.classList.add("d-none");
        formView.classList.remove("d-none");
        document.getElementById("m-mainQuoteForm").reset();
        document.getElementById("m-editQuoteId").value = "";
        document.getElementById("m-quoteCommissionAmount").value = 0;
        document.getElementById("m-quoteFormTitle").innerText = "Tạo báo giá mới";
        document.getElementById("m-quoteProfitDisplay").innerText = "0đ (0%)";
        window.initMQuoteLeadSelect();
    } else {
        listView.classList.remove("d-none");
        formView.classList.add("d-none");
        window.renderQuotes();
    }
};

window.calculateMQuoteProfit = function() {
    const total = parseFloat(document.getElementById("m-quoteTotalAmount").value) || 0; //
    const cost = parseFloat(document.getElementById("m-quoteCostAmount").value) || 0; //
    const commission = parseFloat(document.getElementById("m-quoteCommissionAmount").value) || 0; //
    const displayEl = document.getElementById("m-quoteProfitDisplay");
    
    const netProfit = total - cost - commission; //
    let marginPercent = total > 0 ? (netProfit / total) * 100 : 0; //
    
    displayEl.className = netProfit >= 0 ? "fw-800 text-success fs-5" : "fw-800 text-danger fs-5";
    displayEl.innerText = `${netProfit.toLocaleString('vi-VN')}đ (${marginPercent.toFixed(1)}%)`;
};

window.initMQuoteLeadSelect = function() {
    const select = document.getElementById("m-quoteLeadSelect");
    if (!select) return;
    let html = '<option value="">-- Chọn khách hàng áp dụng --</option>'; //
    allLeads.forEach(([id, lead]) => {
        html += `<option value="${id}">${lead.name} (${lead.project || 'Dự án'})</option>`; //
    });
    select.innerHTML = html;
};

window.saveMQuoteToFirebase = async function(event) {
    event.preventDefault();
    const quoteId = document.getElementById("m-editQuoteId").value;
    const leadId = document.getElementById("m-quoteLeadSelect").value;
    const status = document.getElementById("m-quoteStatusSelect").value;
    const total = parseFloat(document.getElementById("m-quoteTotalAmount").value) || 0; //
    const cost = parseFloat(document.getElementById("m-quoteCostAmount").value) || 0; //
    const commission = parseFloat(document.getElementById("m-quoteCommissionAmount").value) || 0; //
    const link = document.getElementById("m-quoteLinkAttachment").value.trim(); //
    const note = document.getElementById("m-quoteNote").value.trim(); //

    if (!leadId) return alert("Vui lòng lựa chọn một khách hàng!");

    const selectEl = document.getElementById("m-quoteLeadSelect");
    const customerName = selectEl.options[selectEl.selectedIndex].text;

    const quoteData = { leadId, customerName, status, totalAmount: total, costAmount: cost, commissionAmount: commission, profitAmount: total - cost - commission, linkAttachment: link, note, updatedAt: Date.now() }; //

    try {
        if (quoteId) {
            await update(ref(db, `COMPANIES/homestech/quotes/${quoteId}`), quoteData); //
        } else {
            quoteData.createdAt = Date.now(); quoteData.dateDisplay = new Date().toLocaleDateString('vi-VN'); //
            await push(ref(db, "COMPANIES/homestech/quotes"), quoteData); //
        }

        const leadUpdateData = { updatedAt: Date.now() }; //
        if (status === "da_chot") {
            leadUpdateData.step = 4; leadUpdateData.commission = commission; leadUpdateData.contractValue = total; //
        } else if (status === "khong_chot") {
            leadUpdateData.step = 1; leadUpdateData.commission = 0; leadUpdateData.contractValue = 0; //
        } else {
            leadUpdateData.step = 3; leadUpdateData.commission = 0; leadUpdateData.contractValue = total; //
        }
        await update(ref(db, `COMPANIES/homestech/leads/${leadId}`), leadUpdateData); //

        alert("Lưu báo giá di động thành công!");
        window.toggleMQuoteForm(false);
    } catch (err) { alert(err.message); }
};

window.renderQuotes = function() {
    const container = document.getElementById("m-quoteListContainer");
    if (!container) return;

    const keyword = (document.getElementById("m-searchQuote")?.value || "").toLowerCase().trim();
    const labels = { da_gui: "Đã gửi", sua_1: "Sửa lần 1", sua_2: "Sửa lần 2", sua_3: "Sửa lần 3", da_chot: "Đã chốt ✔", khong_chot: "Không chốt ✖" }; //

    onValue(ref(db, "COMPANIES/homestech/quotes"), (snapshot) => {
        const quotes = snapshot.val() || {}; //
        let html = "";
        Object.entries(quotes).reverse().forEach(([id, q]) => {
            if (q.customerName.toLowerCase().includes(keyword)) {
                html += `
                    <div class="m-item-card border-start border-success border-4">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="fw-800 text-dark m-0 small">${q.customerName}</h6>
                            <span class="quote-badge q-${q.status}">${labels[q.status] || q.status}</span>
                        </div>
                        <div class="small italic text-muted text-truncate mb-2">${q.note || 'Không có ghi chú'}</div>
                        <div class="d-flex justify-content-between align-items-center pt-2 border-top" style="font-size: 0.75rem;">
                            <div class="fw-700">Giá HĐ: <span class="text-dark">${q.totalAmount.toLocaleString()}đ</span></div>
                            <div class="fw-700 text-success">LN: ${q.profitAmount.toLocaleString()}đ</div>
                        </div>
                        <div class="d-flex justify-content-end gap-2 mt-2 pt-1 border-top">
                            ${q.linkAttachment ? `<a href="${q.linkAttachment}" target="_blank" class="btn btn-xs btn-outline-primary px-2" style="font-size:0.65rem;"><i class="bi bi-link-45deg"></i> File</a>` : ''}
                            <button class="btn btn-xs btn-light border px-2" onclick="openMEditQuote('${id}')" style="font-size:0.65rem;"><i class="bi bi-pencil"></i> Sửa</button>
                            <button class="btn btn-xs btn-light text-danger border px-2" onclick="deleteMQuote('${id}')" style="font-size:0.65rem;"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                `;
            }
        });
        container.innerHTML = html || `<div class="text-center text-muted py-4 small">Chưa có bảng báo giá nào.</div>`; //
    });
};

window.openMEditQuote = function(id) {
    get(ref(db, `COMPANIES/homestech/quotes/${id}`)).then((snapshot) => {
        const q = snapshot.val(); if (!q) return;
        window.toggleMQuoteForm(true);
        document.getElementById("m-quoteFormTitle").innerText = "Chỉnh sửa báo giá";
        document.getElementById("m-editQuoteId").value = id;
        setTimeout(() => {
            document.getElementById("m-quoteLeadSelect").value = q.leadId;
            document.getElementById("m-quoteStatusSelect").value = q.status;
            document.getElementById("m-quoteTotalAmount").value = q.totalAmount;
            document.getElementById("m-quoteCostAmount").value = q.costAmount;
            document.getElementById("m-quoteCommissionAmount").value = q.commissionAmount || 0;
            document.getElementById("m-quoteLinkAttachment").value = q.linkAttachment || "";
            document.getElementById("m-quoteNote").value = q.note || "";
            window.calculateMQuoteProfit();
        }, 150);
    });
};

window.deleteMQuote = function(id) {
    if (confirm("Xóa vĩnh viễn báo giá này chứ?")) {
        remove(ref(db, `COMPANIES/homestech/quotes/${id}`)); //
    }
};

// ==========================================
// 5. HIỂN THỊ CTV TAB (ĐÃ NÂNG CẤP CHỨC NĂNG SỬA & XÓA)
// ==========================================
function renderCTVList(users) {
    const container = document.getElementById("m-ctvListContainer");
    if (!container) return;
    let html = "";
    
    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") {
            const fullName = u.fullName || u.name || "N/A";
            const email = u.email || "";
            const phone = u.phone || "";
            const area = u.area || "Chưa cập nhật";
            const bankInfo = u.bankInfo || "Chưa cập nhật";

            html += `
                <div class="m-item-card border p-3 mb-2 rounded-4 bg-white shadow-sm">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <b class="text-dark fs-6" style="font-weight: 800;">${fullName}</b>
                        <span class="badge bg-success bg-opacity-10 text-success rounded-3 px-2 py-1" style="font-size:0.65rem;">${area}</span>
                    </div>
                    <div class="small text-muted mb-1" style="font-size:0.75rem;"><i class="bi bi-envelope me-1.5"></i>${email}</div>
                    <div class="small text-muted mb-1" style="font-size:0.75rem;"><i class="bi bi-telephone me-1.5"></i>SĐT: ${phone}</div>
                    <div class="small text-muted mb-2" style="font-size:0.75rem;"><i class="bi bi-bank me-1.5"></i>${bankInfo}</div>
                    
                    <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                        <button class="btn btn-sm btn-light border fw-600 rounded-pill px-3" style="font-size: 0.7rem;"
                            onclick="window.openMEditCTVModal('${uid}', '${fullName.replace(/'/g, "\\'")}', '${email}', '${phone}', '${area.replace(/'/g, "\\'")}', '${bankInfo.replace(/'/g, "\\'")}')">
                            <i class="bi bi-pencil-square me-1"></i>Sửa
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" style="font-size: 0.7rem;" 
                            onclick="window.deleteMUser('${uid}')">
                            <i class="bi bi-trash3"></i> Xóa
                        </button>
                    </div>
                </div>
            `;
        }
    });
    container.innerHTML = html || `<div class="text-center text-muted py-5 small">Chưa có đối tác nào.</div>`;
}

function renderCTVFilter(users) {
    const select = document.getElementById("m-filterCTV"); //
    if (!select) return;
    let html = `<option value="">Tất cả nguồn khách CTV</option>`; //
    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") html += `<option value="${uid}">${u.fullName || u.email}</option>`; //
    });
    select.innerHTML = html;
}

// Ràng buộc sự kiện nhập input
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("m-searchName")?.addEventListener("input", applyMobileFilters);
    document.getElementById("m-filterCTV")?.addEventListener("change", applyMobileFilters);
    document.getElementById("m-searchQuote")?.addEventListener("input", window.renderQuotes);
});

// --- HÀM MỞ FORM THÊM CTV MỚI ---
window.openMAddCTVModal = () => {
    document.getElementById("m-ctvManageForm").reset();
    document.getElementById("m-manageCTVUid").value = "";
    document.getElementById("m-ctvEmail").disabled = false;
    document.getElementById("m-ctvPasswordGroup").classList.remove("d-none");
    document.getElementById("m-ctvPassword").required = true;
    document.getElementById("m-ctvModalTitle").innerText = "Thêm cộng tác viên mới";
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("m-ctvFormModal")).show();
};

// --- HÀM MỞ FORM ĐIỀN SẴN DỮ LIỆU CŨ ĐỂ SỬA CTV ---
window.openMEditCTVModal = (uid, fullName, email, phone, area, bankInfo) => {
    document.getElementById("m-manageCTVUid").value = uid;
    document.getElementById("m-ctvFullName").value = fullName !== "N/A" ? fullName : "";
    document.getElementById("m-ctvEmail").value = email;
    document.getElementById("m-ctvEmail").disabled = true; // Email cố định để bảo toàn Auth gốc
    document.getElementById("m-ctvPasswordGroup").classList.add("d-none"); // Ẩn trường mật khẩu khi sửa thông tin
    document.getElementById("m-ctvPassword").required = false;
    document.getElementById("m-ctvPhone").value = phone;
    document.getElementById("m-ctvArea").value = area !== "Chưa cập nhật" ? area : "";
    document.getElementById("m-ctvBankInfo").value = bankInfo !== "Chưa cập nhật" ? bankInfo : "";
    document.getElementById("m-ctvModalTitle").innerText = "Chỉnh sửa thông tin đối tác";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("m-ctvFormModal")).show();
};

// --- HÀM GỬI LƯU / CẬP NHẬT DỮ LIỆU ĐỐI TÁC CTV ---
window.saveMCTVToFirebase = async (event) => {
    event.preventDefault();
    
    const uid = document.getElementById("m-manageCTVUid").value;
    const fullName = document.getElementById("m-ctvFullName").value.trim();
    const email = document.getElementById("m-ctvEmail").value.trim();
    const phone = document.getElementById("m-ctvPhone").value.trim();
    const area = document.getElementById("m-ctvArea").value.trim();
    const bankInfo = document.getElementById("m-ctvBankInfo").value.trim();

    const ctvData = {
        fullName: fullName,
        phone: phone,
        area: area,
        bankInfo: bankInfo,
        role: "partner",
        updatedAt: Date.now()
    };

    try {
        if (uid) {
            // Thực hiện update bản ghi cũ
            await update(ref(db, `COMPANIES/homestech/users/${uid}`), ctvData);
            alert("Cập nhật thông tin CTV thành công!");
        } else {
            // Thực hiện thêm mới vào DB
            const password = document.getElementById("m-ctvPassword").value;
            if (password.length < 6) return alert("Mật khẩu khởi tạo phải từ 6 ký tự trở lên!");

            const newCTVRef = push(ref(db, "COMPANIES/homestech/users"));
            ctvData.email = email;
            ctvData.createdAt = Date.now();
            
            await set(newCTVRef, ctvData);
            alert("Khởi tạo thông tin dữ liệu CTV mới thành công!");
        }
        bootstrap.Modal.getInstance(document.getElementById("m-ctvFormModal")).hide();
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
};

// --- HÀM XÓA TÀI KHOẢN CTV VĨNH VIỄN ---
window.deleteMUser = (uid) => {
    if (confirm("Bạn có chắc chắn muốn xóa vĩnh viễn Cộng tác viên này khỏi hệ thống không?")) {
        remove(ref(db, `COMPANIES/homestech/users/${uid}`))
            .then(() => alert("Đã xóa dữ liệu CTV thành công!"))
            .catch(err => alert("Lỗi xóa: " + err.message));
    }
};
