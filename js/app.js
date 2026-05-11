import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, update, remove, push, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// =========================
// GLOBAL STATE
// =========================
window.logout = () => signOut(auth);

let appReady = false;   // ⭐ FIX QUAN TRỌNG NHẤT
let allLeads = [];
let allUsers = {};

// =========================
// AUTH CHECK
// =========================
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

// =========================
// INIT SYSTEM
// =========================
function initAdminSystem() {

    appReady = true;

    const usersRef = ref(db, "COMPANIES/homestech/users");
    const leadRef = ref(db, "COMPANIES/homestech/leads");

    // ================= USERS =================
    onValue(usersRef, (snap) => {
        allUsers = snap.val() || {};

        renderCTVFilter(allUsers);
        renderCTVTable(allUsers);
        renderAccountTable(allUsers);
    });

    // ================= LEADS =================
    onValue(leadRef, (leadSnap) => {
        const data = leadSnap.val() || {};
        allLeads = Object.entries(data).reverse();

        window.applyFilters();
    });
}

// =========================
// APPLY FILTER DASHBOARD
// =========================
//
window.applyFilters = () => {
    if (!appReady) return;

    const searchName = (document.getElementById("searchName")?.value || "").toLowerCase();
    const filterCTV = document.getElementById("filterCTV")?.value || "";

    let html = "";
    let s = { total: 0, pending: 0, done: 0, money: 0 };

    allLeads.forEach(([key, l]) => {
        const u = allUsers[l.sourceCTV];
        const ctvName = u ? (u.fullName || u.name || u.email) : "Trực tiếp";

        const matchName =
            (l.name || "").toLowerCase().includes(searchName) ||
            (l.phone || "").includes(searchName);

        const matchCTV = !filterCTV || l.sourceCTV === filterCTV;

        if (matchName && matchCTV) {
            s.total++;
            const step = parseInt(l.step) || 1;
            if (step >= 2 && step <= 3) s.pending++;
            if (step >= 4) s.done++;
            s.money += parseInt(l.commission || 0);

            const labels = ["", "Mới tiếp nhận", "Đang khảo sát", "Đã báo giá", "Đã chốt đơn", "Tất toán"];

            html += `
    <tr>
        <td class="ps-4">
            <div class="fw-800">${l.name || "N/A"}</div>
            <div class="small text-muted">${l.phone || ""}</div>
        </td>
        <td><span class="ctv-tag">${ctvName}</span></td>
        <td class="small fw-700 text-primary">${l.project || "N/A"}</td>
        <td><span class="step-pill step-${step}">${labels[step]}</span></td>
        <td class="fw-700">${parseInt(l.commission || 0).toLocaleString()}đ</td>
        
        <td class="text-end pe-4">
            <div class="d-flex gap-1 justify-content-end align-items-center">
                <button class="btn btn-success btn-sm" onclick="window.openUpdateModal('${key}', ${step}, ${l.commission || 0})">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="window.openEditLeadModal('${key}', '${l.name}', '${l.phone}', '${l.project}')">
                    <i class="bi bi-pencil-square"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteLead('${key}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    </tr>
`;
        }
    });

    document.getElementById("leadTableBody").innerHTML =
        html || `<tr><td colspan="6" class="text-center py-4">Không có dữ liệu</td></tr>`;

    // Cập nhật các thẻ thống kê
    if(document.getElementById("statTotalLeads")) document.getElementById("statTotalLeads").innerText = s.total;
    if(document.getElementById("statPendingLeads")) document.getElementById("statPendingLeads").innerText = s.pending;
    if(document.getElementById("statDoneLeads")) document.getElementById("statDoneLeads").innerText = s.done;
    if(document.getElementById("statTotalMoney")) document.getElementById("statTotalMoney").innerText = s.money.toLocaleString() + "đ";
};
// =========================
// MODAL UPDATE LEAD
// =========================
window.openUpdateModal = (key, step, commission) => {

    if (!appReady) return;

    const idEl = document.getElementById("currentLeadId");
    const stepEl = document.getElementById("statusSelect");
    const commEl = document.getElementById("commissionValue");

    if (!idEl || !stepEl || !commEl) {
        console.error("❌ Thiếu element modal:", {
            idEl, stepEl, commEl
        });
        return;
    }

    idEl.value = key;
    stepEl.value = step;
    commEl.value = commission;

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("updateStatusModal")
    ).show();
};

window.confirmUpdate = async () => {

    if (!appReady) return;

    const key = document.getElementById("currentLeadId").value;
    const step = document.getElementById("statusSelect").value;
    const commission = document.getElementById("commissionValue").value;

    try {
        await update(ref(db, `COMPANIES/homestech/leads/${key}`), {
            step: parseInt(step),
            commission: parseInt(commission),
            updatedAt: Date.now()
        });

        bootstrap.Modal.getInstance(
            document.getElementById("updateStatusModal")
        ).hide();

        alert("Cập nhật thành công!");

    } catch (e) {
        alert(e.message);
    }
};

// =========================
// CTV TABLE
// =========================
function renderCTVTable(users) {

    const container = document.getElementById("ctvTableBody");
    if (!container) return;

    let html = "";

    Object.entries(users).forEach(([uid, u]) => {

        if (u.role === "partner") {

            html += `
                <tr>
                    <td class="ps-4 fw-700">${u.fullName || "N/A"}</td>
                    <td>${u.email || ""}</td>
                    <td>${u.phone || ""}</td>
                    <td>${u.area || ""}</td>
                    <td>${u.bankInfo || ""}</td>
                    <td class="text-end pe-4">
                        <button onclick="window.deleteUser('${uid}')"
                            class="btn btn-danger btn-sm">
                            Xóa
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    container.innerHTML = html || `<tr><td colspan="5" class="text-center">Trống</td></tr>`;
}

// =========================
// FILTER CTV
// =========================
function renderCTVFilter(users) {

    const select = document.getElementById("filterCTV");
    if (!select) return;

    let html = `<option value="">Tất cả CTV</option>`;

    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") {
            html += `<option value="${uid}">${u.fullName || u.email}</option>`;
        }
    });

    select.innerHTML = html;
}

// =========================
// ACCOUNT TABLE
// =========================
function renderAccountTable(users) {

    const container = document.getElementById("accountTableBody");
    if (!container) return;

    let html = "";

    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "admin") {

            html += `
                <tr>
                    <td class="ps-4">${u.fullName || "Admin"}</td>
                    <td>${u.email}</td>
                    <td>ADMIN</td>
                    <td class="text-end pe-4"></td>
                </tr>
            `;
        }
    });

    container.innerHTML = html;
}

// =========================
// DELETE USER
// =========================
window.deleteUser = (uid) => {

    if (!appReady) return;

    if (confirm("Xóa user này?")) {
        remove(ref(db, `COMPANIES/homestech/users/${uid}`));
    }
};

// =========================
// DOM EVENTS SAFE BIND
// =========================
document.addEventListener("DOMContentLoaded", () => {

    const searchInput = document.getElementById("searchName");
    const filterSelect = document.getElementById("filterCTV");

    if (searchInput) {
        searchInput.addEventListener("input", () => window.applyFilters());
    }

    if (filterSelect) {
        filterSelect.addEventListener("change", () => window.applyFilters());
    }
});
// báo cáo

// --- LOGIC BÁO CÁO ---

function buildMonthlyRevenue(leads) {
    // Khởi tạo 12 tháng cố định của năm hiện tại
    const currentYear = new Date().getFullYear();
    const months = {};
    for (let i = 1; i <= 12; i++) {
        months[String(i).padStart(2, "0")] = 0;
    }

    Object.values(leads).forEach(l => {
        if (!l.updatedAt || parseInt(l.step) < 4) return;
        
        const date = new Date(l.updatedAt);
        // Chỉ tính dữ liệu trong năm hiện tại
        if (date.getFullYear() === currentYear) {
            const mKey = String(date.getMonth() + 1).padStart(2, "0");
            months[mKey] += parseInt(l.commission || 0);
        }
    });

    return Object.keys(months).sort().map(m => ({
        month: "T" + m,
        revenue: months[m]
    }));
}
window.renderReportChart = () => {
    const el = document.getElementById("monthlyChart");
    if (!el || allLeads.length === 0) return;

    // 1. Vẽ biểu đồ doanh thu tháng
    const data = buildMonthlyRevenue(Object.fromEntries(allLeads));
    let maxRev = Math.max(...data.map(d => d.revenue)) || 1;
    
    let html = `<div class="d-flex align-items-end justify-content-between h-100 gap-2">`;
    data.forEach(d => {
        const height = (d.revenue / maxRev) * 100;
        html += `
            <div class="text-center flex-grow-1 d-flex flex-column justify-content-end h-100">
                <div class="small fw-800 mb-1" style="font-size:0.65rem; color:var(--primary)">
                    ${d.revenue > 0 ? (d.revenue/1000000).toFixed(1) + 'M' : ''}
                </div>
                <div style="height: ${Math.max(height, 2)}%; background: var(--primary); border-radius: 4px 4px 0 0;"></div>
                <div class="small mt-2 text-muted fw-700" style="font-size:0.6rem">${d.month}</div>
            </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    // 2. Vẽ danh sách Top CTV
    renderTopCTV();

    // 3. Vẽ biểu đồ trạng thái hồ sơ
    renderStatusPie();
};

function renderStatusPie() {
    const el = document.getElementById("statusChart");
    if (!el) return;
    
    let stats = { new: 0, processing: 0, done: 0 };
    allLeads.forEach(([k, l]) => {
        const s = parseInt(l.step);
        if (s <= 1) stats.new++;
        else if (s < 4) stats.processing++;
        else stats.done++;
    });

    const total = allLeads.length || 1;
    const p1 = (stats.new / total) * 100;
    const p2 = (stats.processing / total) * 100;

    el.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100">
            <div style="width:120px; height:120px; border-radius:50%; background: conic-gradient(#e2e8f0 0% ${p1}%, #fbbf24 ${p1}% ${p1+p2}%, #059669 ${p1+p2}% 100%);"></div>
            <div class="mt-3 w-100" style="font-size:0.7rem">
                <div class="d-flex justify-content-between mb-1"><span>Mới:</span> <b>${stats.new}</b></div>
                <div class="d-flex justify-content-between mb-1"><span>Xử lý:</span> <b>${stats.processing}</b></div>
                <div class="d-flex justify-content-between text-success"><span>Chốt:</span> <b>${stats.done}</b></div>
            </div>
        </div>`;
}
// --- HÀM XẾP HẠNG TOP CTV ---
// Hàm tính toán và hiển thị Top CTV
window.renderTopCTV = () => {
    const container = document.getElementById("topCTVList");
    if (!container) return;

    // 1. Gom nhóm doanh thu theo UID của CTV
    const stats = {};
    allLeads.forEach(([key, lead]) => {
        const uid = lead.sourceCTV;
        if (!uid) return;

        if (!stats[uid]) {
            const u = allUsers[uid];
            stats[uid] = {
                name: u ? (u.fullName || u.name || "N/A") : "Ẩn danh",
                totalMoney: 0,
                count: 0
            };
        }

        // Chỉ tính tiền cho các hồ sơ đã hoàn tất (step 4 hoặc 5)
        if (parseInt(lead.step) >= 4) {
            stats[uid].totalMoney += parseInt(lead.commission || 0);
            stats[uid].count++;
        }
    });

    // 2. Sắp xếp giảm dần theo doanh thu và lấy Top 5
    const topList = Object.values(stats)
        .sort((a, b) => b.totalMoney - a.totalMoney)
        .slice(0, 5);

    // 3. Render giao diện danh sách
    let html = "";
    topList.forEach((ctv, index) => {
        // Gán màu sắc huy chương cho 3 vị trí đầu
        const badges = ["#FFD700", "#C0C0C0", "#CD7F32"];
        const badgeColor = index < 3 ? badges[index] : "#f1f5f9";
        const textColor = index < 3 ? "#fff" : "#64748b";

        html += `
            <div class="d-flex align-items-center justify-content-between p-2 rounded-3 border-bottom last-child-border-0">
                <div class="d-flex align-items-center gap-3">
                    <div class="fw-800 d-flex align-items-center justify-content-center rounded-circle" 
                         style="width: 32px; height: 32px; background: ${badgeColor}; color: ${textColor}; font-size: 0.8rem;">
                        ${index + 1}
                    </div>
                    <div>
                        <div class="fw-700 text-dark small">${ctv.name}</div>
                        <div class="text-muted" style="font-size: 0.65rem;">${ctv.count} đơn hàng thành công</div>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-800 text-success small">${ctv.totalMoney.toLocaleString()}đ</div>
                </div>
            </div>`;
    });

    container.innerHTML = html || '<p class="text-center py-4 text-muted small">Chưa có dữ liệu chốt đơn</p>';
};

//tính hoa hồng 
// --- LOGIC MÁY TÍNH HOA HỒNG ---

// --- QUẢN LÝ TAB TÍNH TOÁN & TRA CỨU ---

// 1. Hàm ẩn hiện giữa Danh sách và Form
window.toggleCalcForm = (show) => {
    const listView = document.getElementById("calcListView");
    const filterView = document.getElementById("calcListFilter");
    const formView = document.getElementById("calcFormView");
    
    if (show) {
        listView.classList.add("d-none");
        if(filterView) filterView.classList.add("d-none");
        formView.classList.remove("d-none");
        
        // Reset tiêu đề và nạp khách hàng
        document.getElementById("calcFormTitle").innerText = "Tính hoa hồng mới";
        window.initCalcLeadList(); 
    } else {
        listView.classList.remove("d-none");
        if(filterView) filterView.classList.remove("d-none");
        formView.classList.add("d-none");
        window.renderCalcHistory(); // Quay lại bảng lịch sử
    }
};
// 2. Hàm hiển thị danh sách hồ sơ có lọc tra cứu nhanh
window.renderCalcHistory = () => {
    const tbody = document.getElementById("calcHistoryTableBody");
    const searchText = document.getElementById("searchCalc")?.value.toLowerCase() || "";
    if (!tbody) return;

    let html = "";
    // Lọc: Ưu tiên hồ sơ đã có tiền hoa hồng HOẶC khớp với từ khóa tìm kiếm
    const filteredLeads = allLeads.filter(([id, lead]) => {
        const matchSearch = (lead.name || "").toLowerCase().includes(searchText) || 
                            (lead.phone || "").includes(searchText);
        // Chỉ hiển thị trong danh sách nếu đã từng được tính hoa hồng (commission > 0)
        return matchSearch && (lead.commission > 0); 
    });

    filteredLeads.forEach(([id, lead]) => {
        html += `
            <tr>
                <td class="ps-4">
                    <div class="fw-800 text-dark">${lead.name}</div>
                    <div class="small text-muted" style="font-size: 0.75rem;">${lead.phone}</div>
                </td>
                <td class="small fw-600 text-muted">${parseInt(lead.contractValue || 0).toLocaleString()}đ</td>
                <td class="fw-800 text-success">${parseInt(lead.commission || 0).toLocaleString()}đ</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light border fw-700 px-3 rounded-pill shadow-sm" onclick="editCalcRecord('${id}')">
                        <i class="bi bi-pencil-square text-primary me-1"></i>Sửa
                    </button>
                </td>
            </tr>`;
    });

    tbody.innerHTML = html || `<tr><td colspan="4" class="text-center py-5 text-muted small">Không tìm thấy hồ sơ quyết toán nào</td></tr>`;
};

// 3. Hàm kích hoạt chỉnh sửa hồ sơ cũ
window.editCalcRecord = (id) => {
    const leadEntry = allLeads.find(([key]) => key === id);
    if (!leadEntry) return;
    const lead = leadEntry[1];

    window.toggleCalcForm(true);
    document.getElementById("calcFormTitle").innerText = "Chỉnh sửa hồ sơ: " + lead.name;
    
    // Đổ dữ liệu đã lưu trước đó vào lại form
    document.getElementById("calcLeadSelect").value = id;
    document.getElementById("calcTotalValue").value = lead.contractValue || 0;
    document.getElementById("calcPercent").value = lead.commissionPercent || 0;
    document.getElementById("calcExtraValue").value = lead.extraValue || 0;
    document.getElementById("calcTaxPercent").value = lead.taxPercent || 10;
    
    window.handleCalculator(); // Chạy hàm tính để hiện kết quả ngay lập tức
};

window.saveCalcToFirebase = async () => {
    const leadId = document.getElementById("calcLeadSelect").value;
    const finalComm = window.handleCalculator(); // Lấy con số mới nhất

    if (!leadId) return alert("Vui lòng chọn khách hàng!");

    const updateData = {
        commission: finalComm,
        contractValue: document.getElementById("calcTotalValue").value,
        commissionPercent: document.getElementById("calcPercent").value,
        extraValue: document.getElementById("calcExtraValue").value,
        taxPercent: document.getElementById("calcTaxPercent").value,
        step: 4, 
        updatedAt: Date.now()
    };

    try {
        await update(ref(db, `COMPANIES/homestech/leads/${leadId}`), updateData);
        alert("Đã lưu hồ sơ quyết toán thành công!");
        window.toggleCalcForm(false); // Quay lại danh sách
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
};
// =========================
// LOGIC MÁY TÍNH HOA HỒNG (FIX TỰ ĐỘNG NHẢY SỐ)
// =========================

// 1. Nạp danh sách khách hàng vào ô Select
window.initCalcLeadList = () => {
    const select = document.getElementById("calcLeadSelect");
    if (!select || allLeads.length === 0) return;

    let html = '<option value="">-- Chọn khách hàng --</option>';
    allLeads.forEach(([id, lead]) => {
        html += `<option value="${id}">${lead.name || "N/A"} - ${lead.phone || ""}</option>`;
    });
    select.innerHTML = html;
};

// 2. Hàm tính toán tự động (Nhảy số ngay khi nhập)
window.handleCalculator = () => {
    const totalValue = parseFloat(document.getElementById("calcTotalValue").value) || 0;
    const percent = parseFloat(document.getElementById("calcPercent").value) || 0;
    const extraValue = parseFloat(document.getElementById("calcExtraValue").value) || 0;
    const taxPercent = parseFloat(document.getElementById("calcTaxPercent").value) || 0;

    // Tính toán theo công thức
    const baseComm = totalValue * (percent / 100);
    const extraNet = extraValue * (1 - taxPercent / 100);
    const finalTotal = Math.round(baseComm + extraNet);

    // Cập nhật kết quả lên giao diện
    // Cập nhật các ô chi tiết nếu có (ID resBaseComm, resExtraNet)
    const baseEl = document.getElementById("resBaseComm");
    const extraEl = document.getElementById("resExtraNet");
    const totalEl = document.getElementById("resTotalFinal");

    if (baseEl) baseEl.innerText = baseComm.toLocaleString() + "đ";
    if (extraEl) extraEl.innerText = extraNet.toLocaleString() + "đ";
    if (totalEl) totalEl.innerText = finalTotal.toLocaleString() + "đ";

    return finalTotal;
};
// --- QUẢN LÝ CHI TRẢ HOA HỒNG (CẬP NHẬT: TÌM KIẾM, GHI CHÚ, SỬA/XÓA) ---

// 1. Hàm điều hướng giữa Danh sách và Form
window.togglePayoutForm = (show) => {
    const listView = document.getElementById("payoutListView");
    const filterView = document.getElementById("payoutListFilter");
    const formView = document.getElementById("payoutFormView");
    
    if (show) {
        listView.classList.add("d-none");
        if(filterView) filterView.classList.add("d-none");
        formView.classList.remove("d-none");
        
        // Reset Form về trạng thái thêm mới
        document.getElementById("payoutFormTitle").innerText = "Lập phiếu chi trả mới";
        document.getElementById("editPayoutId").value = "";
        document.getElementById("payoutNote").value = "";
        document.getElementById("payoutAmount").value = "";
        
        // Nạp danh sách khách hàng vào ô Select
        const select = document.getElementById("payoutLeadSelect");
        let html = '<option value="">-- Chọn khách hàng --</option>';
        allLeads.forEach(([id, lead]) => {
            if (parseFloat(lead.commission || 0) > 0) {
                html += `<option value="${id}">${lead.name} - ${parseInt(lead.commission).toLocaleString()}đ</option>`;
            }
        });
        select.innerHTML = html;
    } else {
        listView.classList.remove("d-none");
        if(filterView) filterView.classList.remove("d-none");
        formView.classList.add("d-none");
        window.renderPayoutHistory(); // Quay lại bảng lịch sử
    }
};

// 2. Cập nhật thông tin số dư (Tổng - Đã chi = Còn lại)
window.updatePayoutInfo = () => {
    const leadId = document.getElementById("payoutLeadSelect").value;
    const leadEntry = allLeads.find(([id]) => id === leadId);
    if (!leadEntry) return;
    
    const lead = leadEntry[1];
    const totalComm = parseInt(lead.commission || 0);
    
    let paidAmount = 0;
    if (lead.payments) {
        Object.values(lead.payments).forEach(p => paidAmount += parseInt(p.amount || 0));
    }
    
    const remain = totalComm - paidAmount;
    document.getElementById("payoutTotalComm").innerText = totalComm.toLocaleString() + "đ";
    document.getElementById("payoutRemain").innerText = remain.toLocaleString() + "đ";
    
    // Nếu đang thêm mới (không có editId), tự điền số dư còn lại
    if (!document.getElementById("editPayoutId").value) {
        document.getElementById("payoutAmount").value = remain;
    }
};

// 3. Lưu đợt chi (Hỗ trợ cả Thêm mới và Sửa)
window.savePayout = async () => {
    const leadId = document.getElementById("payoutLeadSelect").value;
    const amount = parseInt(document.getElementById("payoutAmount").value);
    const method = document.getElementById("payoutMethod").value;
    const note = document.getElementById("payoutNote").value;
    const editId = document.getElementById("editPayoutId").value;

    if (!leadId || !amount || amount <= 0) return alert("Vui lòng nhập số tiền hợp lệ!");

    try {
        const { ref, push, update } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
        const { db } = await import("./firebase.js");
        
        const data = {
            amount: amount,
            method: method,
            note: note,
            createdAt: Date.now()
        };

        if (editId) {
            // Sửa đợt chi hiện tại
            await update(ref(db, `COMPANIES/homestech/leads/${leadId}/payments/${editId}`), data);
            alert("Đã cập nhật đợt chi!");
        } else {
            // Thêm đợt chi mới
            await push(ref(db, `COMPANIES/homestech/leads/${leadId}/payments`), data);
            alert("Đã thêm đợt chi mới!");
        }
        
        window.togglePayoutForm(false);
    } catch (e) { alert("Lỗi: " + e.message); }
};

// 4. Render danh sách có Bộ lọc Tìm kiếm và Ngày chi
window.renderPayoutHistory = () => {
    const tbody = document.getElementById("payoutHistoryTableBody");
    const searchText = document.getElementById("searchPayout")?.value.toLowerCase() || "";
    if (!tbody) return;

    let html = "";
    allLeads.forEach(([leadId, lead]) => {
        if (lead.payments) {
            Object.entries(lead.payments).reverse().forEach(([pId, p]) => {
                const name = (lead.name || "").toLowerCase();
                const phone = (lead.phone || "");
                const note = (p.note || "").toLowerCase();
                const dateDisplay = new Date(p.createdAt).toLocaleDateString('vi-VN');

                // Lọc tra cứu nhanh
                if (name.includes(searchText) || phone.includes(searchText) || note.includes(searchText)) {
                    html += `
                        <tr>
                            <td class="ps-4">
                                <div class="fw-800 text-dark">${lead.name}</div>
                                <div class="small text-muted" style="font-size:0.75rem">${lead.phone}</div>
                            </td>
                            <td class="fw-800 text-success">${parseInt(p.amount).toLocaleString()}đ</td>
                            <td><span class="badge bg-light text-dark border fw-600">${p.method}</span></td>
                            <td class="small text-muted" style="max-width:180px">${p.note || "-"}</td>
                            <td class="small fw-600 text-muted">${dateDisplay}</td>
                            <td class="text-end pe-4">
                                <button class="btn btn-sm btn-light border me-1" onclick="editPayout('${leadId}', '${pId}')">
                                    <i class="bi bi-pencil text-primary"></i>
                                </button>
                                <button class="btn btn-sm btn-light border" onclick="deletePayout('${leadId}', '${pId}')">
                                    <i class="bi bi-trash text-danger"></i>
                                </button>
                            </td>
                        </tr>`;
                }
            });
        }
    });

    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center py-5 text-muted">Không tìm thấy dữ liệu</td></tr>';
};

// 5. Hàm Sửa & Xóa đợt chi
window.editPayout = (leadId, pId) => {
    const lead = allLeads.find(([id]) => id === leadId)[1];
    const p = lead.payments[pId];
    
    window.togglePayoutForm(true);
    document.getElementById("payoutFormTitle").innerText = "Chỉnh sửa đợt chi";
    document.getElementById("editPayoutId").value = pId;
    document.getElementById("payoutLeadSelect").value = leadId;
    document.getElementById("payoutAmount").value = p.amount;
    document.getElementById("payoutMethod").value = p.method;
    document.getElementById("payoutNote").value = p.note || "";
    
    window.updatePayoutInfo();
};

window.deletePayout = async (leadId, pId) => {
    if (confirm("Xóa đợt chi trả này?")) {
        try {
            const { ref, remove } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
            const { db } = await import("./firebase.js");
            await remove(ref(db, `COMPANIES/homestech/leads/${leadId}/payments/${pId}`));
            alert("Đã xóa đợt chi!");
            window.renderPayoutHistory();
        } catch (e) { alert("Lỗi: " + e.message); }
    }
};

//thêm mới KH
// Mở Modal
window.openAddLeadModal = () => {
    new bootstrap.Modal(document.getElementById('addLeadModal')).show();
};

// Lưu dữ liệu
document.getElementById("addLeadForm").onsubmit = async (e) => {
    e.preventDefault();
    
    const newLead = {
        name: document.getElementById("newLeadName").value,
        phone: document.getElementById("newLeadPhone").value,
        project: document.getElementById("newLeadProject").value,
        sourceCTV: document.getElementById("newLeadSource").value || "Admin",
        step: 1,
        status: "Đang xử lý",
        createdAt: new Date().toISOString(),
        dateDisplay: new Date().toLocaleDateString('vi-VN'),
        commission: 0
    };

    try {
        await push(ref(db, "COMPANIES/homestech/leads"), newLead);
        bootstrap.Modal.getInstance(document.getElementById('addLeadModal')).hide();
        document.getElementById("addLeadForm").reset();
        // table sẽ tự động cập nhật nếu bạn đang dùng onValue để lắng nghe
    } catch (error) {
        alert("Lỗi: " + error.message);
    }
};

//hàm sửa xoá khách hàng
// --- HÀM XÓA KHÁCH HÀNG ---
window.deleteLead = (key) => {
    if (confirm("Bạn có chắc chắn muốn xóa hồ sơ khách hàng này không?")) {
        remove(ref(db, `COMPANIES/homestech/leads/${key}`))
            .then(() => alert("Đã xóa thành công!"))
            .catch(err => alert("Lỗi khi xóa: " + err.message));
    }
};

// --- HÀM MỞ MODAL SỬA ---
window.openEditLeadModal = (key, name, phone, project, note) => {
    // 1. Gán dữ liệu cũ vào các ô Input (Sử dụng các ID đã có trong Modal addLeadModal)
    document.getElementById("newLeadName").value = name;
    document.getElementById("newLeadPhone").value = phone;
    document.getElementById("newLeadProject").value = project;
    
    // Lưu lại ID của khách hàng đang sửa vào Dataset của Form
    document.getElementById("addLeadForm").dataset.editId = key;
    
    // 2. Đổi tiêu đề Modal để người dùng biết đang ở chế độ chỉnh sửa
    document.querySelector("#addLeadModal h5").innerText = "CHỈNH SỬA HỒ SƠ";
    
    // 3. Hiện Modal
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addLeadModal'));
    modal.show();
};
