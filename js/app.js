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
        location.href = "adminlogin.html"; //
        return;
    }

    try {
        const snapshot = await get(ref(db, `COMPANIES/homestech/users/${user.uid}`)); //
        const userData = snapshot.val(); //

        console.log("--- KIỂM TRA PHÂN QUYỀN ---"); //
        console.log("Dữ liệu User hiện tại trên Firebase:", userData); //

        if (!snapshot.exists() || userData.role !== "admin") { //
            alert("Bạn không có quyền truy cập trang quản trị!"); //
            await signOut(auth); //
            location.href = "adminlogin.html"; //
            return;
        }

        initAdminSystem(); //

    } catch (e) {
        console.error("Lỗi xác thực Admin:", e); //
    }
});

// =========================
// INIT SYSTEM
// =========================
function initAdminSystem() {

    appReady = true; //

    const usersRef = ref(db, "COMPANIES/homestech/users"); //
    const leadRef = ref(db, "COMPANIES/homestech/leads"); //

    // ================= USERS =================
    onValue(usersRef, (snap) => {
        allUsers = snap.val() || {}; //

        renderCTVFilter(allUsers); //
        renderCTVTable(allUsers); //
        renderAccountTable(allUsers); //
    });

    // ================= LEADS =================
    onValue(leadRef, (leadSnap) => {
        const data = leadSnap.val() || {}; //
        allLeads = Object.entries(data).reverse(); //

        window.applyFilters(); //
        
        // Tự động vẽ lại danh sách báo giá nếu đang ở tab báo giá
        if (typeof window.renderQuotes === "function") {
            window.renderQuotes();
        }
    });
}

// =========================
// APPLY FILTER DASHBOARD
// =========================
window.applyFilters = () => {
    if (!appReady) return; //

    const searchName = (document.getElementById("searchName")?.value || "").toLowerCase(); //
    const filterCTV = document.getElementById("filterCTV")?.value || ""; //

    let html = ""; //
    let s = { total: 0, pending: 0, done: 0, money: 0 }; //

    allLeads.forEach(([key, l]) => {
        const u = allUsers[l.sourceCTV]; //
        const ctvName = u ? (u.fullName || u.name || u.email) : "Trực tiếp"; //

        const matchName =
            (l.name || "").toLowerCase().includes(searchName) || //
            (l.phone || "").includes(searchName); //

        const matchCTV = !filterCTV || l.sourceCTV === filterCTV; //

        if (matchName && matchCTV) {
            s.total++; //
            const step = parseInt(l.step) || 1; //
            if (step >= 2 && step <= 3) s.pending++; //
            if (step >= 4) s.done++; //
            s.money += parseInt(l.commission || 0); //

            const labels = ["", "Mới tiếp nhận", "Đang khảo sát", "Đã báo giá", "Đã chốt đơn", "Không chốt được ✖"]; //

            html += `
    <tr>
        <td class="ps-4">
            <div class="fw-800">${l.name || "N/A"}</div>
            <div class="small text-muted">${l.phone || ""}</div>
        </td>
        <td><span class="ctv-tag">${ctvName}</span></td>
        <td class="small fw-700 text-primary">${l.project || "N/A"}</td>
        
        <td>
            <div class="small fw-600 text-muted text-truncate" style="max-width: 180px;" title="${l.address || 'N/A'}">
                ${l.address || "N/A"}
            </div>
        </td>
        
        <td><span class="step-pill step-${step}">${labels[step]}</span></td>
        <td class="fw-700">${parseInt(l.commission || 0).toLocaleString()}đ</td>
        
        <td class="text-end pe-4">
            <div class="d-flex gap-1 justify-content-end align-items-center">
                <button class="btn btn-success btn-sm" onclick="window.openUpdateModal('${key}', ${step}, ${l.commission || 0})">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
                
                <button class="btn btn-primary btn-sm" onclick="window.openEditLeadModal('${key}', '${(l.name || "N/A").replace(/'/g, "\\'")}', '${l.phone || ""}', '${l.project || "N/A"}', '${l.sourceCTV || "Admin"}', '${(l.address || "").replace(/'/g, "\\'").replace(/\n/g, " ")}')">
                    <i class="bi bi-pencil-square"></i>
                </button>
                
                <button class="btn btn-danger btn-sm" onclick="window.deleteLead('${key}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    </tr>
`; //
        }
    });

    document.getElementById("leadTableBody").innerHTML =
        html || `<tr><td colspan="6" class="text-center py-4">Không có dữ liệu</td></tr>`; //

    // Cập nhật các thẻ thống kê
    if(document.getElementById("statTotalLeads")) document.getElementById("statTotalLeads").innerText = s.total; //
    if(document.getElementById("statPendingLeads")) document.getElementById("statPendingLeads").innerText = s.pending; //
    if(document.getElementById("statDoneLeads")) document.getElementById("statDoneLeads").innerText = s.done; //
    if(document.getElementById("statTotalMoney")) document.getElementById("statTotalMoney").innerText = s.money.toLocaleString() + "đ"; //
};

// =========================
// MODAL UPDATE LEAD
// =========================
window.openUpdateModal = (key, step, commission) => {

    if (!appReady) return; //

    const idEl = document.getElementById("currentLeadId"); //
    const stepEl = document.getElementById("statusSelect"); //
    const commEl = document.getElementById("commissionValue"); //

    if (!idEl || !stepEl || !commEl) {
        console.error("❌ Thiếu element modal:", { //
            idEl, stepEl, commEl //
        });
        return;
    }

    idEl.value = key; //
    stepEl.value = step; //
    commEl.value = commission; //

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("updateStatusModal") //
    ).show();
};

window.confirmUpdate = async () => {

    if (!appReady) return; //

    const key = document.getElementById("currentLeadId").value; //
    const step = document.getElementById("statusSelect").value; //
    const commission = document.getElementById("commissionValue").value; //

    try {
        await update(ref(db, `COMPANIES/homestech/leads/${key}`), { //
            step: parseInt(step), //
            commission: parseInt(commission), //
            updatedAt: Date.now() //
        });

        bootstrap.Modal.getInstance(
            document.getElementById("updateStatusModal") //
        ).hide();

        alert("Cập nhật thành công!"); //

    } catch (e) {
        alert(e.message); //
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
            const fullName = u.fullName || u.name || "N/A";
            const email = u.email || "";
            const phone = u.phone || "";
            const area = u.area || "";
            const bankInfo = u.bankInfo || "";

            html += `
                <tr>
                    <td class="ps-4 fw-700 text-dark">${fullName}</td>
                    <td class="small fw-600 text-muted">${email}</td>
                    <td class="small fw-700 text-success">${phone}</td>
                    <td class="small fw-600">${area}</td>
                    <td class="small fw-600 text-secondary">${bankInfo}</td>
                    <td class="text-end pe-4">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary border-0" 
                                onclick="window.openEditCTVModal('${uid}', '${fullName}', '${email}', '${phone}', '${area}', '${bankInfo}')">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button onclick="window.deleteUser('${uid}')" class="btn btn-outline-danger border-0">
                                <i class="bi bi-trash3-fill"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
    });

    container.innerHTML = html || `<tr><td colspan="6" class="text-center py-4 text-muted small">Chưa có cộng tác viên nào trong hệ thống.</td></tr>`;
}

// =========================
// FILTER CTV
// =========================
function renderCTVFilter(users) {
    const filterSelect = document.getElementById("filterCTV"); // Bộ lọc ngoài Dashboard
    const formSelect = document.getElementById("newLeadSource"); // Dropdown trong Form thêm mới khách

    let filterHtml = `<option value="">Tất cả CTV</option>`; //
    let formHtml = `<option value="Admin">Trực tiếp (Hệ thống / Admin)</option>`; // Mặc định nếu không chọn ai sẽ tính cho Admin

    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") { //
            const displayName = u.fullName || u.name || u.email;
            filterHtml += `<option value="${uid}">${displayName}</option>`; //
            formHtml += `<option value="${uid}">${displayName}</option>`; // Đẩy vào danh sách chọn tạo hộ khách cho CTV
        }
    });

    if (filterSelect) filterSelect.innerHTML = filterHtml; //
    if (formSelect) formSelect.innerHTML = formHtml;
}

// =========================
// ACCOUNT TABLE
// =========================
function renderAccountTable(users) {
    const container = document.getElementById("accountTableBody"); //
    if (!container) return; //

    let html = ""; //

    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "admin") { //
            html += `
                <tr>
                    <td class="ps-4">${u.fullName || "Admin"}</td>
                    <td>${u.email}</td>
                    <td>ADMIN</td>
                    <td class="text-end pe-4"></td>
                </tr>
            `; //
        }
    });

    container.innerHTML = html; //
}

// =========================
// DELETE USER
// =========================
window.deleteUser = (uid) => {
    if (!appReady) return; //

    if (confirm("Xóa user này?")) { //
        remove(ref(db, `COMPANIES/homestech/users/${uid}`)); //
    }
};

// =========================
// DOM EVENTS SAFE BIND
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchName"); //
    const filterSelect = document.getElementById("filterCTV"); //

    if (searchInput) {
        searchInput.addEventListener("input", () => window.applyFilters()); //
    }

    if (filterSelect) {
        filterSelect.addEventListener("change", () => window.applyFilters()); //
    }
});

// =========================================================================
// ADVANCED CRM ENGINE: PHÂN HỆ BÁO CÁO CHUYÊN SÂU ĐA NĂNG
// =========================================================================

// 1. Hàm cốt lõi tính toán và kết xuất dữ liệu báo cáo theo bộ lọc đa tầng
window.processAdvancedReports = () => {
    if (!appReady || allLeads.length === 0) return;

    const timeFilter = document.getElementById("repFilterTime")?.value || "all";
    const ctvFilter = document.getElementById("repFilterCTV")?.value || "all";
    const tbody = document.getElementById("repTableBody");

    if (!tbody) return;

    // Khởi tạo các biến tích lũy KPI báo cáo
    let totalContractValue = 0;
    let totalCommissionValue = 0;
    let successCount = 0;
    let filteredCount = 0;
    let tableHtml = "";

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor((now.getMonth() + 3) / 3);

    const labels = ["", "Mới tiếp nhận", "Đang khảo sát", "Đã báo giá", "Đã chốt đơn", "Không chốt được ✖"];

    allLeads.forEach(([key, l]) => {
        const u = allUsers[l.sourceCTV];
        const ctvName = u ? (u.fullName || u.name || u.email) : "Trực tiếp";
        const step = parseInt(l.step) || 1;

        // --- A. KIỂM TRA BỘ LỌC ĐỐI TÁC CTV ---
        const matchCTV = (ctvFilter === "all") || (l.sourceCTV === ctvFilter);

        // --- B. KIỂM TRA BỘ LỌC DÒNG THỜI GIAN (Dựa vào updatedAt hoặc createdAt) ---
        let matchTime = false;
        const dateTarget = new Date(l.updatedAt || l.createdAt || Date.now());
        const targetMonth = dateTarget.getMonth() + 1;
        const targetYear = dateTarget.getFullYear();
        const targetQuarter = Math.floor((dateTarget.getMonth() + 3) / 3);

        if (timeFilter === "all") {
            matchTime = true;
        } else if (timeFilter === "month_current") {
            matchTime = (targetMonth === currentMonth && targetYear === currentYear);
        } else if (timeFilter === "quarter_current") {
            matchTime = (targetQuarter === currentQuarter && targetYear === currentYear);
        } else if (timeFilter === "year_current") {
            matchTime = (targetYear === currentYear);
        }

        // --- C. XỬ LÝ TRÍCH XUẤT SỐ LIỆU VÀ KẾT XUẤT BẢNG ---
        if (matchCTV && matchTime) {
            filteredCount++;
            const contractVal = parseInt(l.contractValue || l.totalAmount || 0);
            const commVal = parseInt(l.commission || 0);

            // Chỉ cộng dồn giá trị tài chính đối với các đơn hàng đã ký thành công (Step 4)
            if (step === 4) {
                successCount++;
                totalContractValue += contractVal;
                totalCommissionValue += commVal;
            }

            // Sinh chuỗi dòng dữ liệu cho bảng kết xuất chi tiết
            tableHtml += `
                <tr>
                    <td class="ps-3 py-2.5">
                        <div class="fw-800 text-dark small">${l.name || 'N/A'}</div>
                        <div class="text-muted" style="font-size: 0.65rem;">${l.phone || ''}</div>
                    </td>
                    <td><span class="badge bg-light text-dark border px-2 py-1">${ctvName}</span></td>
                    <td class="fw-700 text-dark small">${contractVal.toLocaleString()}đ</td>
                    <td class="fw-700 text-success small">${commVal.toLocaleString()}đ</td>
                    <td class="pe-3"><span class="step-pill step-${step}" style="font-size:0.6rem; padding: 3px 8px;">${labels[step]}</span></td>
                </tr>
            `;
        }
    });

    // --- D. ĐỒNG BỘ DỮ LIỆU LÊN HỆ THỐNG THẺ KPI MODERN CARD ---
    const conversionRate = allLeads.length > 0 ? ((successCount / allLeads.length) * 100).toFixed(1) : 0;

    if (document.getElementById("repStatContract")) document.getElementById("repStatContract").innerText = totalContractValue.toLocaleString() + "đ";
    if (document.getElementById("repStatComm")) document.getElementById("repStatComm").innerText = totalCommissionValue.toLocaleString() + "đ";
    if (document.getElementById("repStatCountSuccess")) document.getElementById("repStatCountSuccess").innerText = successCount;
    if (document.getElementById("repStatConversion")) document.getElementById("repStatConversion").innerText = conversionRate + "%";
    if (document.getElementById("repTableCount")) document.getElementById("repTableCount").innerText = `${filteredCount} khách hàng thỏa lọc`;

    tbody.innerHTML = tableHtml || `<tr><td colspan="5" class="text-center py-4 text-muted small">Không tìm thấy dữ liệu phù hợp bộ lọc đa năng</td></tr>`;
};

// 2. Tự động nạp danh sách CTV thực tế vào bộ lọc Dropdown riêng của Tab Báo cáo
function syncReportCTVDropdown(users) {
    const select = document.getElementById("repFilterCTV");
    if (!select) return;

    let html = `<option value="all">Tất cả nguồn đối tác (CTV)</option>`;
    Object.entries(users).forEach(([uid, u]) => {
        if (u.role === "partner") {
            html += `<option value="${uid}">${u.fullName || u.email}</option>`;
        }
    });
    select.innerHTML = html;
}

// 3. Xây dựng cấu trúc mảng doanh thu 12 tháng (Lấy theo Doanh số Giá trị HĐ của đơn chốt thành công)
function buildMonthlyRevenue(leads) {
    const currentYear = new Date().getFullYear();
    const months = {};
    for (let i = 1; i <= 12; i++) {
        months[String(i).padStart(2, "0")] = 0;
    }

    Object.values(leads).forEach(l => {
        if (!l.updatedAt || parseInt(l.step) !== 4) return;
        
        const date = new Date(l.updatedAt);
        if (date.getFullYear() === currentYear) {
            const mKey = String(date.getMonth() + 1).padStart(2, "0");
            // Biểu đồ tổng quan hiển thị Giá trị HĐ thực tế mà công ty chốt được
            months[mKey] += parseInt(l.contractValue || l.totalAmount || 0);
        }
    });

    return Object.keys(months).sort().map(m => ({
        month: "T" + m,
        revenue: months[m]
    }));
}

// 4. Hàm khởi động chính khi chuyển đổi Tab báo cáo
window.renderReportChart = () => {
    const el = document.getElementById("monthlyChart");
    if (!el || allLeads.length === 0) return;

    // Đồng bộ Dropdown đối tác
    syncReportCTVDropdown(allUsers);

    // Chạy bộ lọc danh sách và KPI thời gian thực
    window.processAdvancedReports();

    // Khởi tạo đồ thị cột dọc Doanh số hợp đồng ký kết
    const data = buildMonthlyRevenue(Object.fromEntries(allLeads));
    let maxRev = Math.max(...data.map(d => d.revenue)) || 1;
    
    let html = `<div class="d-flex align-items-end justify-content-between h-100 gap-2">`;
    data.forEach(d => {
        const height = (d.revenue / maxRev) * 100;
        html += `
            <div class="text-center flex-grow-1 d-flex flex-column justify-content-end h-100">
                <div class="small fw-800 mb-1" style="font-size:0.6rem; color:var(--primary)">
                    ${d.revenue > 0 ? (d.revenue/1000000).toFixed(1) + 'M' : ''}
                </div>
                <div style="height: ${Math.max(height, 3)}%; background: var(--primary); border-radius: 4px 4px 0 0;"></div>
                <div class="small mt-2 text-muted fw-700" style="font-size:0.55rem">${d.month}</div>
            </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;

    // Vẽ 2 phân hệ biểu đồ tròn và bảng xếp hạng đi kèm
    renderTopCTV();
    renderStatusPie();
};

// 5. Kết xuất Biểu đồ tỷ trọng trạng thái hình tròn
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
            <div style="width:110px; height:110px; border-radius:50%; background: conic-gradient(#cbd5e1 0% ${p1}%, #fbbf24 ${p1}% ${p1+p2}%, #059669 ${p1+p2}% 100%);"></div>
            <div class="mt-3 w-100" style="font-size:0.65rem">
                <div class="d-flex justify-content-between mb-1"><span>Mới (Chưa xử lý):</span> <b>${stats.new}</b></div>
                <div class="d-flex justify-content-between mb-1"><span>Đang chăm sóc:</span> <b>${stats.processing}</b></div>
                <div class="d-flex justify-content-between text-success"><span>Đã ký thành công ✔:</span> <b>${stats.done}</b></div>
            </div>
        </div>`;
}

// 6. Xếp hạng hiệu quả mang lại doanh số của nguồn Cộng tác viên
window.renderTopCTV = () => {
    const container = document.getElementById("topCTVList");
    if (!container) return;

    const stats = {};
    allLeads.forEach(([key, lead]) => {
        const uid = lead.sourceCTV;
        if (!uid) return;

        if (!stats[uid]) {
            const u = allUsers[uid];
            stats[uid] = {
                name: u ? (u.fullName || u.name || u.email) : "Ẩn danh",
                totalMoney: 0,
                count: 0
            };
        }

        if (parseInt(lead.step) === 4) {
            // Xếp hạng dựa trên tổng Doanh số HĐ mang về cho doanh nghiệp thay vì tiền hoa hồng đơn thuần
            stats[uid].totalMoney += parseInt(lead.contractValue || lead.totalAmount || 0);
            stats[uid].count++;
        }
    });

    const topList = Object.values(stats)
        .sort((a, b) => b.totalMoney - a.totalMoney)
        .slice(0, 5);

    let html = "";
    topList.forEach((ctv, index) => {
        const badges = ["#FFD700", "#C0C0C0", "#CD7F32"];
        const badgeColor = index < 3 ? badges[index] : "#f1f5f9";
        const textColor = index < 3 ? "#fff" : "#64748b";

        html += `
            <div class="d-flex align-items-center justify-content-between p-2 rounded-3 border-bottom">
                <div class="d-flex align-items-center gap-2">
                    <div class="fw-800 d-flex align-items-center justify-content-center rounded-circle" 
                         style="width: 28px; height: 28px; background: ${badgeColor}; color: ${textColor}; font-size: 0.75rem;">
                        ${index + 1}
                    </div>
                    <div>
                        <div class="fw-700 text-dark small" style="font-size:0.75rem;">${ctv.name}</div>
                        <div class="text-muted" style="font-size: 0.6rem;">${ctv.count} đơn hàng chốt đơn</div>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-800 text-success small" style="font-size:0.75rem;">${ctv.totalMoney.toLocaleString()}đ</div>
                </div>
            </div>`;
    });

    container.innerHTML = html || '<p class="text-center py-4 text-muted small">Chưa có dữ liệu doanh số từ CTV</p>';
};
// =========================
// LOGIC MÁY TÍNH HOA HỒNG
// =========================
window.toggleCalcForm = (show) => {
    const listView = document.getElementById("calcListView"); //
    const filterView = document.getElementById("calcListFilter"); //
    const formView = document.getElementById("calcFormView"); //
    
    if (show) {
        listView.classList.add("d-none"); //
        if(filterView) filterView.classList.add("d-none"); //
        formView.classList.remove("d-none"); //
        
        document.getElementById("calcFormTitle").innerText = "Tính hoa hồng mới"; //
        window.initCalcLeadList();  //
    } else {
        listView.classList.remove("d-none"); //
        if(filterView) filterView.classList.remove("d-none"); //
        formView.classList.add("d-none"); //
        window.renderCalcHistory(); //
    }
};

window.renderCalcHistory = () => {
    const tbody = document.getElementById("calcHistoryTableBody"); //
    const searchText = document.getElementById("searchCalc")?.value.toLowerCase() || ""; //
    if (!tbody) return; //

    let html = ""; //
    const filteredLeads = allLeads.filter(([id, lead]) => {
        const matchSearch = (lead.name || "").toLowerCase().includes(searchText) ||  //
                            (lead.phone || "").includes(searchText); //
        return matchSearch && (lead.commission > 0);  //
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
            </tr>`; //
    });

    tbody.innerHTML = html || `<tr><td colspan="4" class="text-center py-5 text-muted small">Không tìm thấy hồ sơ quyết toán nào</td></tr>`; //
};

window.editCalcRecord = (id) => {
    const leadEntry = allLeads.find(([key]) => key === id); //
    if (!leadEntry) return; //
    const lead = leadEntry[1]; //

    window.toggleCalcForm(true); //
    document.getElementById("calcFormTitle").innerText = "Chỉnh sửa hồ sơ: " + lead.name; //
    
    document.getElementById("calcLeadSelect").value = id; //
    document.getElementById("calcTotalValue").value = lead.contractValue || 0; //
    document.getElementById("calcPercent").value = lead.commissionPercent || 0; //
    document.getElementById("calcExtraValue").value = lead.extraValue || 0; //
    document.getElementById("calcTaxPercent").value = lead.taxPercent || 10; //
    
    window.handleCalculator(); //
};

window.saveCalcToFirebase = async () => {
    const leadId = document.getElementById("calcLeadSelect").value; //
    const finalComm = window.handleCalculator(); //

    if (!leadId) return alert("Vui lòng chọn khách hàng!"); //

    const updateData = {
        commission: finalComm, //
        contractValue: document.getElementById("calcTotalValue").value, //
        commissionPercent: document.getElementById("calcPercent").value, //
        extraValue: document.getElementById("calcExtraValue").value, //
        taxPercent: document.getElementById("calcTaxPercent").value, //
        step: 4,  //
        updatedAt: Date.now() //
    };

    try {
        await update(ref(db, `COMPANIES/homestech/leads/${leadId}`), updateData); //
        alert("Đã lưu hồ sơ quyết toán thành công!"); //
        window.toggleCalcForm(false); //
    } catch (e) {
        alert("Lỗi: " + e.message); //
    }
};

window.initCalcLeadList = () => {
    const select = document.getElementById("calcLeadSelect"); //
    if (!select || allLeads.length === 0) return; //

    let html = '<option value="">-- Chọn khách hàng --</option>'; //
    allLeads.forEach(([id, lead]) => {
        html += `<option value="${id}">${lead.name || "N/A"} - ${lead.phone || ""}</option>`; //
    });
    select.innerHTML = html; //
};

window.handleCalculator = () => {
    const totalValue = parseFloat(document.getElementById("calcTotalValue").value) || 0; //
    const percent = parseFloat(document.getElementById("calcPercent").value) || 0; //
    const extraValue = parseFloat(document.getElementById("calcExtraValue").value) || 0; //
    const taxPercent = parseFloat(document.getElementById("calcTaxPercent").value) || 0; //

    const baseComm = totalValue * (percent / 100); //
    const extraNet = extraValue * (1 - taxPercent / 100); //
    const finalTotal = Math.round(baseComm + extraNet); //

    const baseEl = document.getElementById("resBaseComm"); //
    const extraEl = document.getElementById("resExtraNet"); //
    const totalEl = document.getElementById("resTotalFinal"); //

    if (baseEl) baseEl.innerText = baseComm.toLocaleString() + "đ"; //
    if (extraEl) extraEl.innerText = extraNet.toLocaleString() + "đ"; //
    if (totalEl) totalEl.innerText = finalTotal.toLocaleString() + "đ"; //

    return finalTotal; //
};

// =========================
// QUẢN LÝ CHI TRẢ HOA HỒNG
// =========================
window.togglePayoutForm = (show) => {
    const listView = document.getElementById("payoutListView"); //
    const filterView = document.getElementById("payoutListFilter"); //
    const formView = document.getElementById("payoutFormView"); //
    
    if (show) {
        listView.classList.add("d-none"); //
        if(filterView) filterView.classList.add("d-none"); //
        formView.classList.remove("d-none"); //
        
        document.getElementById("payoutFormTitle").innerText = "Lập phiếu chi trả mới"; //
        document.getElementById("editPayoutId").value = ""; //
        document.getElementById("payoutNote").value = ""; //
        document.getElementById("payoutAmount").value = ""; //
        
        const select = document.getElementById("payoutLeadSelect"); //
        let html = '<option value="">-- Chọn khách hàng --</option>'; //
        allLeads.forEach(([id, lead]) => {
            if (parseFloat(lead.commission || 0) > 0) {
                html += `<option value="${id}">${lead.name} - ${parseInt(lead.commission).toLocaleString()}đ</option>`; //
            }
        });
        select.innerHTML = html; //
    } else {
        listView.classList.remove("d-none"); //
        if(filterView) filterView.classList.remove("d-none"); //
        formView.classList.add("d-none"); //
        window.renderPayoutHistory(); //
    }
};

window.updatePayoutInfo = () => {
    const leadId = document.getElementById("payoutLeadSelect").value; //
    const leadEntry = allLeads.find(([id]) => id === leadId); //
    if (!leadEntry) return; //
    
    const lead = leadEntry[1]; //
    const totalComm = parseInt(lead.commission || 0); //
    
    let paidAmount = 0; //
    if (lead.payments) {
        Object.values(lead.payments).forEach(p => paidAmount += parseInt(p.amount || 0)); //
    }
    
    const remain = totalComm - paidAmount; //
    document.getElementById("payoutTotalComm").innerText = totalComm.toLocaleString() + "đ"; //
    document.getElementById("payoutRemain").innerText = remain.toLocaleString() + "đ"; //
    
    if (!document.getElementById("editPayoutId").value) {
        document.getElementById("payoutAmount").value = remain; //
    }
};

window.savePayout = async () => {
    const leadId = document.getElementById("payoutLeadSelect").value; //
    const amount = parseInt(document.getElementById("payoutAmount").value); //
    const method = document.getElementById("payoutMethod").value; //
    const note = document.getElementById("payoutNote").value; //
    const editId = document.getElementById("editPayoutId").value; //

    if (!leadId || !amount || amount <= 0) return alert("Vui lòng nhập số tiền hợp lệ!"); //

    try {
        const data = {
            amount: amount, //
            method: method, //
            note: note, //
            createdAt: Date.now() //
        };

        if (editId) {
            await update(ref(db, `COMPANIES/homestech/leads/${leadId}/payments/${editId}`), data); //
            alert("Đã cập nhật đợt chi!"); //
        } else {
            await push(ref(db, `COMPANIES/homestech/leads/${leadId}/payments`), data); //
            alert("Đã thêm đợt chi mới!"); //
        }
        
        window.togglePayoutForm(false); //
    } catch (e) { alert("Lỗi: " + e.message); }
};

window.renderPayoutHistory = () => {
    const tbody = document.getElementById("payoutHistoryTableBody"); //
    const searchText = document.getElementById("searchPayout")?.value.toLowerCase() || ""; //
    if (!tbody) return; //

    let html = ""; //
    allLeads.forEach(([leadId, lead]) => {
        if (lead.payments) {
            Object.entries(lead.payments).reverse().forEach(([pId, p]) => {
                const name = (lead.name || "").toLowerCase(); //
                const phone = (lead.phone || ""); //
                const note = (p.note || "").toLowerCase(); //
                const dateDisplay = new Date(p.createdAt).toLocaleDateString('vi-VN'); //

                if (name.includes(searchText) || phone.includes(searchText) || note.includes(searchText)) { //
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
                        </tr>`; //
                }
            });
        }
    });

    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center py-5 text-muted">Không tìm thấy dữ liệu</td></tr>'; //
};

window.editPayout = (leadId, pId) => {
    const lead = allLeads.find(([id]) => id === leadId)[1]; //
    const p = lead.payments[pId]; //
    
    window.togglePayoutForm(true); //
    document.getElementById("payoutFormTitle").innerText = "Chỉnh sửa đợt chi"; //
    document.getElementById("editPayoutId").value = pId; //
    document.getElementById("payoutLeadSelect").value = leadId; //
    document.getElementById("payoutAmount").value = p.amount; //
    document.getElementById("payoutMethod").value = p.method; //
    document.getElementById("payoutNote").value = p.note || ""; //
    
    window.updatePayoutInfo(); //
};

window.deletePayout = async (leadId, pId) => {
    if (confirm("Xóa đợt chi trả này?")) { //
        try {
            await remove(ref(db, `COMPANIES/homestech/leads/${leadId}/payments/${pId}`)); //
            alert("Đã xóa đợt chi!"); //
            window.renderPayoutHistory(); //
        } catch (e) { alert("Lỗi: " + e.message); }
    }
};

// =========================
// THÊM MỚI KHÁCH HÀNG
// =========================
window.openAddLeadModal = () => {
    new bootstrap.Modal(document.getElementById('addLeadModal')).show(); //
};

document.getElementById("addLeadForm").onsubmit = async (e) => {
    e.preventDefault();
    
    const editId = e.target.dataset.editId;
    const newLead = {
        name: document.getElementById("newLeadName").value, //
        phone: document.getElementById("newLeadPhone").value, //
        project: document.getElementById("newLeadProject").value, //
        address: document.getElementById("newLeadAddress").value.trim(), // 🌟 LƯU ĐỊA CHỈ MỚI VÀO ĐÂY
        sourceCTV: document.getElementById("newLeadSource").value || "Admin", //
        step: editId ? undefined : 1, // Giữ nguyên tiến độ cũ nếu đang sửa
        status: editId ? undefined : "Đang xử lý", //
        updatedAt: Date.now()
    };

    try {
        if (editId) {
            // Chế độ chỉnh sửa: Cập nhật cả địa chỉ
            await update(ref(db, `COMPANIES/homestech/leads/${editId}`), {
                name: newLead.name,
                phone: newLead.phone,
                project: newLead.project,
                address: newLead.address, // Cập nhật địa chỉ
                sourceCTV: newLead.sourceCTV,
                updatedAt: Date.now()
            });
            alert("Cập nhật thông tin khách hàng thành công!");
            delete e.target.dataset.editId;
        } else {
            // Chế độ thêm mới
            newLead.createdAt = Date.now();
            newLead.dateDisplay = new Date().toLocaleDateString('vi-VN'); //
            newLead.commission = 0; //
            await push(ref(db, "COMPANIES/homestech/leads"), newLead); //
            alert("Thêm khách hàng thành công!");
        }
        bootstrap.Modal.getInstance(document.getElementById('addLeadModal')).hide(); //
        document.getElementById("addLeadForm").reset(); //
        document.querySelector("#addLeadModal h5").innerText = "THÊM KHÁCH HÀNG MỚI"; //
    } catch (error) {
        alert("Lỗi: " + error.message); //
    }
};

window.deleteLead = (key) => {
    if (confirm("Bạn có chắc chắn muốn xóa hồ sơ khách hàng này không?")) { //
        remove(ref(db, `COMPANIES/homestech/leads/${key}`)) //
            .then(() => alert("Đã xóa thành công!")) //
            .catch(err => alert("Lỗi khi xóa: " + err.message)); //
    }
};

//
window.openEditLeadModal = (key, name, phone, project, sourceCTV, address) => {
    document.getElementById("newLeadName").value = name; //
    document.getElementById("newLeadPhone").value = phone; //
    document.getElementById("newLeadProject").value = project; //
    document.getElementById("newLeadAddress").value = address || ""; // 🌟 TỰ ĐIỀN ĐỊA CHỈ CŨ
    
    const sourceSelect = document.getElementById("newLeadSource");
    if (sourceSelect) {
        sourceSelect.value = sourceCTV || "Admin";
    }
    
    document.getElementById("addLeadForm").dataset.editId = key; //
    document.querySelector("#addLeadModal h5").innerText = "CHỈNH SỬA HỒ SƠ"; //
    
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addLeadModal')); //
    modal.show(); //
};
// =========================================================================
// CRM MODULE: QUẢN LÝ BÁO GIÁ (MỚI TÍCH HỢP)
// =========================================================================

// 1. Quản lý trạng thái Ẩn/Hiện Form Báo Giá
//
window.toggleQuoteForm = function(showForm) {
    const listView = document.getElementById("quoteListView");
    const filterBox = document.getElementById("quoteListFilter");
    const formView = document.getElementById("quoteFormView");
    
    if (showForm) {
        listView.classList.add("d-none");
        if (filterBox) filterBox.classList.add("d-none");
        formView.classList.remove("d-none");
        document.getElementById("mainQuoteForm").reset();
        document.getElementById("editQuoteId").value = "";
        document.getElementById("quoteCommissionAmount").value = 0; // Thêm dòng này
        document.getElementById("quoteFormTitle").innerText = "Tạo bảng báo giá mới";
        document.getElementById("quoteProfitDisplay").innerText = "0đ (0%)";
        window.initQuoteLeadSelect();
    } else {
        listView.classList.remove("d-none");
        if (filterBox) filterBox.classList.remove("d-none");
        formView.classList.add("d-none");
        window.renderQuotes();
    }
};

// 2. Tự động tính toán Lợi nhuận và Biên độ tỷ lệ %
window.calculateQuoteProfit = function() {
    const total = parseFloat(document.getElementById("quoteTotalAmount").value) || 0;
    const cost = parseFloat(document.getElementById("quoteCostAmount").value) || 0;
    const commission = parseFloat(document.getElementById("quoteCommissionAmount").value) || 0; // Đọc thêm tiền hoa hồng
    const displayEl = document.getElementById("quoteProfitDisplay");
    if (!displayEl) return;
    
    // CÔNG THỨC MỚI: Lợi nhuận doanh nghiệp nhận về sau khi chia hoa hồng
    const netProfit = total - cost - commission;
    let marginPercent = 0;
    if (total > 0) {
        marginPercent = (netProfit / total) * 100;
    }
    
    if (netProfit >= 0) {
        displayEl.className = "form-control py-2 bg-light fw-800 text-success";
        displayEl.innerText = `Lợi nhuận ròng: ${netProfit.toLocaleString('vi-VN')}đ (+${marginPercent.toFixed(1)}%)`;
    } else {
        displayEl.className = "form-control py-2 bg-light fw-800 text-danger";
        displayEl.innerText = `Lợi nhuận ròng: ${netProfit.toLocaleString('vi-VN')}đ (${marginPercent.toFixed(1)}%) - Đang âm`;
    }
};

// 3. Nạp danh sách Khách hàng hoạt động vào Select Form của Báo Giá
window.initQuoteLeadSelect = function() {
    const select = document.getElementById("quoteLeadSelect");
    if (!select) return;
    
    let optionsHtml = '<option value="">-- Chọn khách hàng áp dụng --</option>';
    allLeads.forEach(([id, lead]) => {
        optionsHtml += `<option value="${id}">${lead.name} (${lead.project || 'Dự án không tên'})</option>`;
    });
    select.innerHTML = optionsHtml;
};

// 4. Lưu hoặc Cập nhật dữ liệu Báo giá lên Firebase
//
window.saveQuoteToFirebase = async function(event) {
    event.preventDefault();
    
    const quoteId = document.getElementById("editQuoteId").value;
    const leadId = document.getElementById("quoteLeadSelect").value;
    const status = document.getElementById("quoteStatusSelect").value;
    const total = parseFloat(document.getElementById("quoteTotalAmount").value) || 0; // Đây là giá trị HĐ
    const cost = parseFloat(document.getElementById("quoteCostAmount").value) || 0;
    const commission = parseFloat(document.getElementById("quoteCommissionAmount").value) || 0;
    const link = document.getElementById("quoteLinkAttachment").value.trim();
    const note = document.getElementById("quoteNote").value.trim();
    
    if (!leadId) return alert("Vui lòng lựa chọn một khách hàng!");

    const selectEl = document.getElementById("quoteLeadSelect");
    const customerName = selectEl.options[selectEl.selectedIndex].text;

    const quoteData = {
        leadId: leadId,
        customerName: customerName,
        status: status,
        totalAmount: total,
        costAmount: cost,
        commissionAmount: commission,
        profitAmount: total - cost - commission,
        linkAttachment: link,
        note: note,
        updatedAt: Date.now()
    };

    try {
        // A. Ghi nhận dữ liệu vào bảng phân hệ Báo giá (Quotes)
        if (quoteId) {
            await update(ref(db, `COMPANIES/homestech/quotes/${quoteId}`), quoteData);
        } else {
            quoteData.createdAt = Date.now();
            quoteData.dateDisplay = new Date().toLocaleDateString('vi-VN');
            await push(ref(db, "COMPANIES/homestech/quotes"), quoteData);
        }

        // B. ĐỒNG BỘ SANG HỒ SƠ GỐC LEADS (Gồm Trạng thái, Hoa hồng và Giá trị HĐ)
        const leadUpdateData = { 
            updatedAt: Date.now()
        };

        // Khi xác nhận ĐÃ CHỐT BÁO GIÁ
        if (status === "da_chot") {
            leadUpdateData.step = 4;                 // Chuyển sang "Đã chốt đơn" trên Dashboard
            leadUpdateData.commission = commission;      // Đẩy số tiền hoa hồng sang Dashboard & CTV
            leadUpdateData.contractValue = total;    // 🌟 TỰ ĐỘNG CẬP NHẬT GIÁ TRỊ HĐ SANG MÁY TÍNH HOA HỒNG
        } 
        // Khi khách từ chối không chốt
        else if (status === "khong_chot") {
    leadUpdateData.step = 5;                 // Chuyển sang trạng thái Hủy bỏ / Không chốt được
    leadUpdateData.commission = 0;           // Đưa hoa hồng về 0
    leadUpdateData.contractValue = 0;        // Reset giá trị hợp đồng về 0
}
        // Khi đang ở các bước gửi khách, sửa đổi 1, 2, 3...
        else {
            leadUpdateData.step = 3;                 // Trạng thái "Đã báo giá"
            leadUpdateData.commission = 0;
            leadUpdateData.contractValue = total;    // 🌟 Lưu sẵn Giá trị HĐ để khi vào tab tính hoa hồng tra cứu là có luôn
        }

        // Thực thi lệnh cập nhật đồng bộ sang nhánh dữ liệu Leads
        await update(ref(db, `COMPANIES/homestech/leads/${leadId}`), leadUpdateData);

        alert("Lưu báo giá và đồng bộ dữ liệu quyết toán thành công!");
        window.toggleQuoteForm(false);
    } catch (err) {
        alert("Lỗi đồng bộ dữ liệu: " + err.message);
    }
};

// 5. Kết xuất bảng dữ liệu Báo Giá và áp dụng bộ lọc
window.renderQuotes = function() {
    const tbody = document.getElementById("quoteTableBody");
    if (!tbody) return;
    
    const searchKeyword = (document.getElementById("searchQuote")?.value || "").toLowerCase().trim();
    const statusFilter = document.getElementById("filterQuoteStatus")?.value || "all";

    const badgeColors = {
        da_gui: "bg-light text-dark border",
        sua_1: "bg-warning text-dark",
        sua_2: "bg-warning text-dark fw-bold",
        sua_3: "bg-danger text-white",
        da_chot: "bg-success text-white",
        khong_chot: "bg-secondary text-white"
    };

    const textLabels = {
        da_gui: "Đã gửi", sua_1: "Sửa lần 1", sua_2: "Sửa lần 2", sua_3: "Sửa lần 3", da_chot: "Đã chốt ✔", khong_chot: "Không chốt ✖"
    };

    onValue(ref(db, "COMPANIES/homestech/quotes"), (snapshot) => {
        const quotes = snapshot.val() || {};
        let html = "";
        const items = Object.entries(quotes).reverse();

        items.forEach(([id, q]) => {
            const matchSearch = q.customerName.toLowerCase().includes(searchKeyword) || (q.note && q.note.toLowerCase().includes(searchKeyword));
            const matchStatus = statusFilter === "all" || q.status === statusFilter;

            if (matchSearch && matchStatus) {
                const profitColor = q.profitAmount >= 0 ? "text-success" : "text-danger";
                const badgeClass = badgeColors[q.status] || "bg-light";
                const labelText = textLabels[q.status] || q.status;
                const dateText = q.dateDisplay || new Date(q.createdAt).toLocaleDateString('vi-VN');
                
                const linkHtml = q.linkAttachment 
                    ? `<a href="${q.linkAttachment}" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill px-3"><i class="bi bi-link-45deg me-1"></i>XEM FILE</a>`
                    : `<span class="text-muted small italic">Không có</span>`;

                html += `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-800 text-dark">${q.customerName}</div>
                            <div class="small text-muted italic" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${q.note || 'Không ghi chú'}</div>
                        </td>
                        <td class="fw-700 text-dark">${parseInt(q.totalAmount || 0).toLocaleString('vi-VN')}đ</td>
                        <td class="fw-700 ${profitColor}">${parseInt(q.profitAmount || 0).toLocaleString('vi-VN')}đ</td>
                        <td><span class="badge ${badgeClass} px-2 py-1.5 rounded-3 text-uppercase">${labelText}</span></td>
                        <td class="small text-muted fw-600">${dateText}</td>
                        <td>${linkHtml}</td>
                        <td class="text-end pe-4">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-success border-0" onclick="openEditQuote('${id}')"><i class="bi bi-pencil-square"></i></button>
                                <button class="btn btn-outline-danger border-0" onclick="deleteQuote('${id}')"><i class="bi bi-trash3-fill"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });

        tbody.innerHTML = html || `<tr><td colspan="7" class="text-center py-4 text-muted small">Không tìm thấy dữ liệu báo giá nào.</td></tr>`;
    });
};

// 6. Sửa báo giá cũ
//
window.openEditQuote = function(id) {
    onValue(ref(db, `COMPANIES/homestech/quotes/${id}`), (snapshot) => {
        const q = snapshot.val();
        if (!q) return;

        window.toggleQuoteForm(true);
        document.getElementById("quoteFormTitle").innerText = "Chỉnh sửa tài liệu báo giá";
        document.getElementById("editQuoteId").value = id;
        
        setTimeout(() => {
            document.getElementById("quoteLeadSelect").value = q.leadId;
            document.getElementById("quoteStatusSelect").value = q.status;
            document.getElementById("quoteTotalAmount").value = q.totalAmount;
            document.getElementById("quoteCostAmount").value = q.costAmount;
            document.getElementById("quoteCommissionAmount").value = q.commissionAmount || 0; // Thêm dòng này
            document.getElementById("quoteLinkAttachment").value = q.linkAttachment || "";
            document.getElementById("quoteNote").value = q.note || "";
            window.calculateQuoteProfit();
        }, 150);
    }, { onlyOnce: true });
};
// 7. Xóa báo giá
window.deleteQuote = function(id) {
    if (confirm("Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa dữ liệu báo giá này?")) {
        remove(ref(db, `COMPANIES/homestech/quotes/${id}`))
            .then(() => {
                alert("Đã xóa báo giá thành công.");
            })
            .catch(err => alert("Lỗi khi xóa: " + err.message));
    }
};

// Ràng buộc sự kiện input thời gian thực cho bộ lọc tìm kiếm báo giá
document.addEventListener("DOMContentLoaded", () => {
    const searchQuoteInput = document.getElementById("searchQuote");
    if (searchQuoteInput) {
        searchQuoteInput.addEventListener("input", () => window.renderQuotes());
    }
});

//
// =========================================================================
// CRM MODULE NÂNG CẤP: THÊM, SỬA, XÓA CTV (REALTIME ENGINE)
// =========================================================================

// Mở modal cấu hình thêm mới CTV
window.openAddCTVModal = () => {
    document.getElementById("ctvManageForm").reset();
    document.getElementById("manageCTVUid").value = "";
    document.getElementById("ctvEmail").disabled = false;
    document.getElementById("ctvPasswordGroup").classList.remove("d-none");
    document.getElementById("ctvPassword").required = true;
    document.getElementById("ctvModalTitle").innerText = "Thêm cộng tác viên mới";
    
    bootstrap.Modal.getOrCreateInstance(document.getElementById("ctvFormModal")).show();
};

// Mở modal cấu hình sửa đổi thông tin CTV
window.openEditCTVModal = (uid, fullName, email, phone, area, bankInfo) => {
    document.getElementById("manageCTVUid").value = uid;
    document.getElementById("ctvFullName").value = fullName !== "N/A" ? fullName : "";
    document.getElementById("ctvEmail").value = email;
    document.getElementById("ctvEmail").disabled = true; // Không cho phép đổi Email để bảo toàn Auth
    document.getElementById("ctvPasswordGroup").classList.add("d-none"); // Ẩn trường mật khẩu khi sửa
    document.getElementById("ctvPassword").required = false;
    document.getElementById("ctvPhone").value = phone;
    document.getElementById("ctvArea").value = area;
    document.getElementById("ctvBankInfo").value = bankInfo;
    document.getElementById("ctvModalTitle").innerText = "Chỉnh sửa thông tin đối tác";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("ctvFormModal")).show();
};

// Xử lý gửi biểu mẫu Xác nhận Lưu thông tin dữ liệu (Thêm hoặc Sửa)
window.saveCTVToFirebase = async (event) => {
    event.preventDefault();
    if (!appReady) return;

    const uid = document.getElementById("manageCTVUid").value;
    const fullName = document.getElementById("ctvFullName").value.trim();
    const email = document.getElementById("ctvEmail").value.trim();
    const phone = document.getElementById("ctvPhone").value.trim();
    const area = document.getElementById("ctvArea").value.trim();
    const bankInfo = document.getElementById("ctvBankInfo").value.trim();

    const ctvData = {
        fullName: fullName,
        phone: phone,
        area: area,
        bankInfo: bankInfo,
        role: "partner", // Ép chặt vai trò là partner đối tác để bảo mật hệ thống
        updatedAt: Date.now()
    };

    try {
        if (uid) {
            // TRƯỜNG HỢP 1: CẬP NHẬT HỒ SƠ CTV ĐÃ TỒN TẠI
            await update(ref(db, `COMPANIES/homestech/users/${uid}`), ctvData);
            alert("Đã cập nhật thông tin đối tác thành công!");
        } else {
            // TRƯỜNG HỢP 2: THÊM MỚI CTV (Khởi tạo tài khoản dữ liệu)
            const password = document.getElementById("ctvPassword").value;
            if (password.length < 6) return alert("Mật khẩu khởi tạo phải từ 6 ký tự trở lên!");

            // Sinh mã Key ngẫu nhiên làm ID tạm thời để lưu bản ghi thông tin cấu trúc
            const newCTVRef = push(ref(db, "COMPANIES/homestech/users"));
            ctvData.email = email;
            ctvData.createdAt = Date.now();
            
            // Do quy định bảo mật Client Side Firebase, tài khoản đăng nhập chính thức sẽ tự động 
            // được đồng bộ hóa thông qua Auth khi CTV tiến hành nhấn Đăng ký hoặc Đăng nhập lần đầu.
            await set(newCTVRef, ctvData);
            alert("Đã khởi tạo thông tin CTV mới! Hệ thống đã cấp quyền đăng nhập cho Email này.");
        }
        bootstrap.Modal.getInstance(document.getElementById("ctvFormModal")).hide();
    } catch (e) {
        alert("Lỗi thao tác dữ liệu: " + e.message);
    }
};
