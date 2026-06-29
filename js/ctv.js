import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, push, onValue, query, orderByChild, equalTo, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
window.logout = () => signOut(auth);

// --- 1. LOGIC ĐỊNH VỊ GPS ---
window.getCurrentLocation = () => {
    const addrInput = document.getElementById("cAddress");
    if (navigator.geolocation) {
        addrInput.placeholder = "Hệ thống đang xác định vị trí...";
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            addrInput.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }, (err) => {
            alert("Không thể lấy vị trí. Vui lòng cấp quyền truy cập GPS.");
        });
    }
};

// --- 2. XỬ LÝ ẢNH ---
let imageArray = [];
window.handleImageStep = (step) => {
    if (step < 3) document.getElementById(`img-${step+1}`).classList.remove('d-none');
    
    const file = document.getElementById(`img-${step}`).files[0];
    const reader = new FileReader();
    
    reader.onload = e => {
        const base64 = e.target.result;
        imageArray.push(base64);
        const preview = document.getElementById("imagePreview");
        preview.innerHTML += `<img src="${base64}" class="rounded-3" style="width:70px;height:70px;object-fit:cover;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.1)">`;
    };
    reader.readAsDataURL(file);
};

// --- 3. GỬI DỮ LIỆU LÊN FIREBASE ---
// --- 3. GỬI DỮ LIỆU LÊN FIREBASE (ĐÃ CHUYỂN SANG DẠNG LINK ẢNH) ---
const leadForm = document.getElementById("addLeadForm");
if (leadForm) {
    leadForm.onsubmit = async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert("Vui lòng đăng nhập lại!");

        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerText = "ĐANG GỬI...";

        const now = new Date();
        
        // Đọc giá trị link hình ảnh từ ô input mới
        const imageLink = document.getElementById("cImageLink").value.trim();

        const leadData = {
            name: document.getElementById("cName").value,
            phone: document.getElementById("cPhone").value,
            project: document.getElementById("cProject").value,
            address: document.getElementById("cAddress").value,
            note: document.getElementById("cNote").value || "", 
            imageLink: imageLink, // 🌟 Thay đổi trường dữ liệu từ mảng images thành 1 chuỗi string link duy nhất
            sourceCTV: user.uid,
            status: "cho_duyet",
            step: 1,
            createdAt: Date.now(),
            dateDisplay: now.toLocaleDateString('vi-VN'),
            month: now.getMonth() + 1,
            year: now.getFullYear()
        };

        try {
            await push(ref(db, "COMPANIES/homestech/leads"), leadData);
            alert("Gửi yêu cầu hợp tác thành công!");
            location.reload();
        } catch (error) {
            alert("Lỗi: " + error.message);
            btnSubmit.disabled = false;
            btnSubmit.innerText = "GỬI YÊU CẦU HỢP TÁC";
        }
    };
}

// --- 4. LOAD DANH SÁCH KHÁCH HÀNG ---
// --- 4. LOAD DANH SÁCH KHÁCH HÀNG (CẬP NHẬT TRẠNG THÁI & LÀM MỜ) ---
// --- 4. LOAD DANH SÁCH KHÁCH HÀNG (CẬP NHẬT MINH BẠCH GIÁ TRỊ BÁO GIÁ) ---
function loadData(uid) {
    const listContainer = document.getElementById("customerStatusList");
    if (listContainer) listContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success"></div></div>';

    const searchInput = document.getElementById("searchCTVLeads");
    const searchKeyword = searchInput ? searchInput.value.toLowerCase().trim() : "";

    onValue(query(ref(db, "COMPANIES/homestech/leads"), orderByChild("sourceCTV"), equalTo(uid)), snap => {
        const data = snap.val() || {};
        
        let totalCommission = 0;
        let totalPaid = 0;
        let stats = { total: 0, pending: 0, success: 0 };
        let leadHtml = "";
        const items = Object.entries(data).reverse();

        const statusLabels = ["", "Mới tiếp nhận", "Đang khảo sát", "Đã báo giá", "Đã chốt đơn", "Không chốt được khách"];
        const rawLeadsForReport = [];

        items.forEach(([key, item]) => {
            // Chuyển chữ về viết thường để so sánh đa năng
            const nameMatch = (item.name || "").toLowerCase().includes(searchKeyword);
            const phoneMatch = (item.phone || "").includes(searchKeyword);
            const projectMatch = (item.project || "").toLowerCase().includes(searchKeyword);

            // Nếu có từ khóa tìm kiếm mà không khớp bất cứ trường nào thì bỏ qua
            if (searchKeyword && !nameMatch && !phoneMatch && !projectMatch) return;

            stats.total++;
            const step = parseInt(item.step) || 1;
            const commission = parseInt(item.commission) || 0;

            if (step >= 2 && step <= 3) {
                stats.pending++;
            } else if (step >= 4) {
                stats.success++;
                totalCommission += commission;
                rawLeadsForReport.push(item);
            }

            if (item.payments) {
                Object.values(item.payments).forEach(p => {
                    totalPaid += parseInt(p.amount || 0);
                });
            }

            const dateCreated = item.dateDisplay || new Date(item.createdAt).toLocaleDateString('vi-VN');
            const validAddress = (item.address && item.address !== "0" && item.address !== "undefined") ? item.address : "Dalat";
            const mapLink = `http://maps.google.com/?q=${encodeURIComponent(validAddress)}`;
            const archiveClass = (step >= 4) ? "lead-archived" : "";

            // Tính toán an toàn giá trị hợp đồng/báo giá được đồng bộ từ Admin
const contractValue = parseInt(item.contractValue || item.totalAmount || 0);

// Tính toán tỷ lệ phần trăm hoa hồng thực tế để hiển thị minh bạch
let commPercentText = "";
if (contractValue > 0 && commission > 0) {
    const percent = (commission / contractValue) * 100;
    commPercentText = ` (${percent.toFixed(1)}%)`;
}

leadHtml += `
    <div class="item-card shadow-sm ${archiveClass}">
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
                <h6 class="fw-800 m-0 text-dark text-uppercase">${item.name}</h6>
                <div class="small text-muted mb-1" style="font-size: 0.7rem;">
                    <i class="bi bi-calendar3 me-1"></i>Ngày tạo: ${dateCreated}
                </div>
                <div class="small fw-700 text-success mt-1">
                    <i class="bi bi-telephone-fill me-1"></i>${item.phone}
                </div>
            </div>
            <div class="text-end">
                <span class="step-badge step-${step} d-inline-block mb-1">${statusLabels[step] || "Đang xử lý"}</span>
            </div>
        </div>

        <div class="p-3 my-3 border border-success border-opacity-10 shadow-sm" style="background-color: #f8fafc; border-radius: 14px;">
            <div class="d-flex justify-content-between align-items-center pb-2 mb-2" style="font-size: 0.75rem; border-bottom: 1px dashed #cbd5e1;">
                <span class="text-muted fw-600"><i class="bi bi-file-earmark-spreadsheet me-1.5 text-secondary"></i>Giá trị báo giá</span>
                <span class="text-dark fw-800">${contractValue > 0 ? contractValue.toLocaleString('vi-VN') + 'đ' : '<span class="text-muted fw-600 italic">Đang tính toán...</span>'}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center" style="font-size: 0.75rem;">
                <span class="text-muted fw-600"><i class="bi bi-gift-fill me-1.5 text-success"></i>Hoa hồng của bạn${commPercentText}</span>
                <b class="${commission > 0 ? 'text-success' : 'text-muted'} fw-800" style="font-size: 0.85rem;">
                    ${commission > 0 ? '+' + commission.toLocaleString('vi-VN') + 'đ' : '0đ'}
                </b>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-2 pt-2">
            <div class="small text-muted fw-600"><i class="bi bi-briefcase me-1"></i>${item.project || 'Dự án'}</div>
            <div class="d-flex gap-2">
                <div class="dropdown d-inline-block">
                    <button class="btn btn-light btn-sm rounded-pill px-2 border" data-bs-toggle="dropdown"><i class="bi bi-three-dots"></i></button>
                    <ul class="dropdown-menu dropdown-menu-end border-0 shadow-sm rounded-4 p-2">
                        <li><a class="dropdown-item small fw-700 py-2" href="javascript:void(0)" onclick="openEditLead('${key}', '${item.name}', '${item.phone}', '${item.project}', \`${item.note || ''}\`)"><i class="bi bi-pencil me-2 text-success"></i>CHỈNH SỬA</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item small fw-700 py-2 text-danger" href="javascript:void(0)" onclick="deleteLead('${key}')"><i class="bi bi-trash me-2"></i>XÓA HỒ SƠ</a></li>
                    </ul>
                </div>
                <a href="${mapLink}" target="_blank" class="btn btn-light btn-sm rounded-pill px-3 border fw-700">VỊ TRÍ</a>
                <button class="btn btn-success btn-sm rounded-pill px-3 fw-700 shadow-sm" onclick="viewLeadDetail('${key}')">CHI TIẾT</button>
            </div>
        </div>
    </div>`;
        });

        const currentBalance = totalCommission - totalPaid;
        document.querySelectorAll(".statTotalMoney").forEach(el => el.innerText = Math.max(0, currentBalance).toLocaleString('vi-VN') + 'đ');
        document.querySelectorAll(".statTotalLeads").forEach(el => el.innerText = stats.total);
        document.querySelectorAll(".statPending").forEach(el => el.innerText = stats.pending);
        document.querySelectorAll(".statSuccess").forEach(el => el.innerText = stats.success);
        
        if (listContainer) listContainer.innerHTML = leadHtml || '<p class="text-center py-5 opacity-50">Không tìm thấy khách hàng phù hợp</p>';
        
        calculateCTVReports(rawLeadsForReport);
    });
}
// Ràng buộc sự kiện gõ phím tìm kiếm thời gian thực
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchCTVLeads");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const user = auth.currentUser;
            if (user) loadData(user.uid); // Gọi lại hàm load dữ liệu kèm bộ lọc
        });
    }
});
// --- 5. LOAD LỊCH SỬ THƯỞNG (TẤT TOÁN) ---
// --- 5. LOAD LỊCH SỬ THƯỞNG (QUÉT TỪ PAYMENTS TRONG LEADS) ---
function loadPayoutHistory(uid) {
    const container = document.getElementById("payoutHistoryContainer");
    if (!container) return;

    // Hiển thị trạng thái đang tải
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success spinner-border-sm"></div></div>';

    // Tìm tất cả khách hàng của CTV này
    const q = query(ref(db, "COMPANIES/homestech/leads"), orderByChild("sourceCTV"), equalTo(uid));

    onValue(q, (snap) => {
        const data = snap.val() || {};
        const allPayments = [];

        // Gom tất cả các đợt chi trả từ bên trong các Lead
        Object.entries(data).forEach(([leadId, lead]) => {
            if (lead.payments) {
                Object.entries(lead.payments).forEach(([pId, p]) => {
                    allPayments.push({
                        ...p,
                        customerName: lead.name || "Khách hàng",
                        totalCommission: parseInt(lead.commission || 0)
                    });
                });
            }
        });

        if (allPayments.length === 0) {
            container.innerHTML = '<p class="text-center py-5 text-muted small">Chưa có lịch sử nhận thưởng.</p>';
            return;
        }

        // Sắp xếp mới nhất lên đầu
        allPayments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        let html = "";
        allPayments.forEach(p => {
            const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : "-";
            html += `
                <div class="item-card border-0 shadow-sm mb-3" style="border-left: 4px solid #059669 !important;">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <div class="small text-muted mb-1" style="font-size: 0.65rem;">Ngày chi: ${date}</div>
                            <h6 class="fw-800 mb-0 text-success">+${parseInt(p.amount).toLocaleString()}đ</h6>
                        </div>
                        <span class="badge bg-success-subtle text-success rounded-pill px-2" style="font-size: 0.6rem;">HOÀN TẤT</span>
                    </div>
                    <div class="mt-2 pt-2 border-top small">
                        <div class="d-flex justify-content-between mb-1"><span>Khách hàng:</span><b>${p.customerName}</b></div>
                        <div class="d-flex justify-content-between"><span>Tổng hoa hồng hồ sơ:</span><b>${p.totalCommission.toLocaleString()}đ</b></div>
                        <div class="text-muted mt-2 p-2 bg-light rounded-2 italic" style="font-size:0.7rem">${p.note || 'Tất toán hệ thống'}</div>
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    });
}

// --- 6. HÀM QUẢN LÝ (XÓA/SỬA/CHI TIẾT) ---
window.deleteLead = (key) => {
    if(confirm("Bạn có chắc chắn muốn xóa hồ sơ này?")) {
        remove(ref(db, `COMPANIES/homestech/leads/${key}`))
            .then(() => alert("Đã xóa thành công!"))
            .catch(err => alert("Lỗi: " + err.message));
    }
};

window.openEditLead = (key, name, phone, project, note) => {
    // Tìm các phần tử HTML theo ID đã tạo ở Bước 1
    const elKey = document.getElementById("editKey");
    const elName = document.getElementById("editName");
    const elPhone = document.getElementById("editPhone");
    const elProject = document.getElementById("editProject");
    const elNote = document.getElementById("editNote");

    // Kiểm tra xem Modal có tồn tại trong HTML không
    const modalEl = document.getElementById('editLeadModal');

    if (modalEl && elKey && elName) {
        // Gán giá trị vào các ô input
        elKey.value = key;
        elName.value = name || "";
        elPhone.value = phone || "";
        elProject.value = project || "Khác";
        elNote.value = (note === "undefined" || !note) ? "" : note;

        // Mở Modal (Sử dụng API của Bootstrap 5)
        const editModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        editModal.show();
    } else {
        console.error("Lỗi: Thiếu Modal hoặc ID trong file HTML.");
        alert("Hệ thống đang cập nhật giao diện, vui lòng thử lại sau!");
    }
};

const editForm = document.getElementById("editLeadForm");
if (editForm) {
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        const key = document.getElementById("editKey").value;
        const updates = {
            name: document.getElementById("editName").value,
            phone: document.getElementById("editPhone").value,
            project: document.getElementById("editProject").value,
            note: document.getElementById("editNote").value,
            updatedAt: Date.now()
        };
        try {
            await update(ref(db, `COMPANIES/homestech/leads/${key}`), updates);
            bootstrap.Modal.getInstance(document.getElementById('editLeadModal')).hide();
            alert("Đã cập nhật thông tin khách hàng!");
        } catch (error) {
            alert("Lỗi cập nhật: " + error.message);
        }
    };
}

window.viewLeadDetail = (id) => {
    onValue(ref(db, `COMPANIES/homestech/leads/${id}`), (snap) => {
        const l = snap.val();
        if(!l) return;
        const imgs = l.images ? l.images.map(img => `<img src="${img}" class="rounded-3 w-100 mb-2 border shadow-sm">`).join('') : '<p class="small opacity-50">Không có ảnh</p>';
        const fullDate = new Date(l.createdAt).toLocaleString('vi-VN');

        document.getElementById("leadDetailBody").innerHTML = `
            <div class="text-center mb-4"><h5 class="fw-800 m-0 text-success text-uppercase">Chi Tiết Hồ Sơ</h5></div>
            <div class="row g-3">
                <div class="col-12 text-center mb-2"><span class="badge bg-light text-muted border py-2 px-3 rounded-pill" style="font-size: 0.75rem;"><i class="bi bi-clock me-1"></i> Khởi tạo: ${fullDate}</span></div>
                <div class="col-6"><label class="small text-muted fw-bold">KHÁCH HÀNG</label><p class="fw-700 text-dark mb-0">${l.name}</p></div>
                <div class="col-6 text-end"><label class="small text-muted fw-bold">SĐT</label><p class="fw-700 text-success mb-0">${l.phone}</p></div>
                <div class="col-12 border-top pt-2"><label class="small text-muted fw-bold">DỰ ÁN / NHU CẦU</label><p class="fw-600 mb-0">${l.project || 'N/A'}</p></div>
                <div class="col-12 border-top pt-2"><label class="small text-muted fw-bold">ĐỊA CHỈ / VỊ TRÍ</label><p class="small fw-600 text-primary mb-0">${l.address || 'N/A'}</p></div>
                <div class="col-12 border-top pt-2"><label class="small text-muted fw-bold">NỘI DUNG GHI CHÚ</label><p class="small p-2 bg-light rounded-3 border mb-0" style="white-space: pre-line;">${l.note || 'Không có ghi chú thêm.'}</p></div>
                <div class="col-12 border-top pt-2"><label class="small text-muted fw-bold mb-2">ẢNH HIỆN TRƯỜNG</label><div>${imgs}</div></div>
            </div>
            <button class="btn btn-success w-100 mt-4 rounded-pill fw-700 py-3 shadow" data-bs-dismiss="modal">ĐÓNG HỒ SƠ</button>`;
        new bootstrap.Modal(document.getElementById('leadDetailModal')).show();
    }, { onlyOnce: true });
};

// --- 7. KIỂM TRA ĐĂNG NHẬP & HIỂN THỊ PROFILE ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = ref(db, `COMPANIES/homestech/users/${user.uid}`);
        
        // Cập nhật lastLogin và đồng thời lấy Profile
        onValue(userRef, (snap) => {
            const u = snap.val();
            if (u) {
                if(document.getElementById("profileName")) document.getElementById("profileName").innerText = u.fullName || u.name || "N/A";
                if(document.getElementById("profileEmail")) document.getElementById("profileEmail").innerText = u.email || "N/A";
                if(document.getElementById("profilePhone")) document.getElementById("profilePhone").innerText = u.phone || "N/A";
                if(document.getElementById("profileArea")) document.getElementById("profileArea").innerText = u.area || "N/A";
                if(document.getElementById("profileBank")) document.getElementById("profileBank").innerText = u.bankInfo || "Chưa cập nhật";
            }
        });

        try { await update(userRef, { lastLogin: Date.now() }); } catch (e) {}

        loadData(user.uid);
        loadPayoutHistory(user.uid);
    } else {
        location.href = "login.html";
    }
});

// Thay thế đoạn xử lý chuyển Tab cũ bằng đoạn này
// --- XỬ LÝ CHUYỂN TAB AN TOÀN ---
document.querySelectorAll('.nav-item-binh').forEach(item => {
    item.onclick = function(e) {
        if (this.tagName.toLowerCase() === 'a') return; //[cite: 4]
        
        e.preventDefault();

        const targetSelector = this.getAttribute('data-bs-target'); //[cite: 4]
        if (!targetSelector) return; //[cite: 4]

        document.querySelectorAll('.nav-item-binh').forEach(nav => nav.classList.remove('active')); //[cite: 4]
        this.classList.add('active'); //[cite: 4]

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('show', 'active'); //[cite: 4]
        });

        const targetPane = document.querySelector(targetSelector); //[cite: 4]
        if (targetPane) {
            targetPane.classList.add('show', 'active'); //[cite: 4]
        }

        // TỰ ĐỘNG NẠP LẠI DỮ LIỆU AN TOÀN
        const user = auth.currentUser;
        if (user) {
            const targetId = targetSelector.replace('#', '');
            
            if (targetId === "tab-done") {
                loadPayoutHistory(user.uid); //[cite: 4]
            } 
            else if (targetId === "tab-leads") {
                // 🌟 FIX LỖI TRẮNG TRANG: Đảm bảo ô tìm kiếm được reset hoặc nhận diện đúng chuỗi rỗng
                const searchInput = document.getElementById("searchCTVLeads");
                if (searchInput) {
                    searchInput.value = ""; // Xóa bộ lọc cũ để tránh bị nghẽn danh sách khi đổi tab
                }
                loadData(user.uid); // Gọi nạp lại danh sách khách hàng[cite: 4]
            } 
            else if (targetId === "tab-ctv-reports") {
                loadData(user.uid); // Nạp dữ liệu mới nhất để chạy báo cáo
            }
        }
    };
});
// --- 8. LOGIC CHỈNH SỬA HỒ SƠ ---

// Hàm mở Modal và điền dữ liệu hiện tại vào Form
window.openEditProfileModal = () => {
    // Lấy dữ liệu từ các thẻ đang hiển thị để đưa vào ô input
    document.getElementById("editProfilePhone").value = document.getElementById("displayProfilePhone").innerText;
    document.getElementById("editProfileArea").value = document.getElementById("displayProfileArea").innerText;
    document.getElementById("editProfileBank").value = document.getElementById("displayProfileBank").innerText;
    
    new bootstrap.Modal(document.getElementById('editProfileModal')).show();
};

// Xử lý lưu thông tin từ Modal
const profileForm = document.getElementById("updateProfileForm");
if (profileForm) {
    profileForm.onsubmit = async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert("Hết phiên làm việc!");

        const btn = document.getElementById("btnUpdateProfile");
        btn.disabled = true;
        btn.innerText = "ĐANG LƯU...";

        const updates = {
            phone: document.getElementById("editProfilePhone").value.trim(),
            area: document.getElementById("editProfileArea").value.trim(),
            bankInfo: document.getElementById("editProfileBank").value.trim(),
            updatedAt: Date.now()
        };

        try {
            await update(ref(db, `COMPANIES/homestech/users/${user.uid}`), updates);
            // Đóng modal sau khi thành công
            bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();
            alert("Đã cập nhật hồ sơ cá nhân!");
        } catch (error) {
            alert("Lỗi: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "LƯU THAY ĐỔI";
        }
    };
}

// Cập nhật lại phần hiển thị trong onAuthStateChanged
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = ref(db, `COMPANIES/homestech/users/${user.uid}`);
        onValue(userRef, (snap) => {
            const u = snap.val();
            if (u) {
                if(document.getElementById("profileName")) document.getElementById("profileName").innerText = u.fullName || u.name || "N/A";
                if(document.getElementById("profileEmail")) document.getElementById("profileEmail").innerText = u.email || "N/A";
                
                // Hiển thị ra màn hình Profile
                if(document.getElementById("displayProfilePhone")) document.getElementById("displayProfilePhone").innerText = u.phone || "Chưa có";
                if(document.getElementById("displayProfileArea")) document.getElementById("displayProfileArea").innerText = u.area || "Chưa có";
                if(document.getElementById("displayProfileBank")) document.getElementById("displayProfileBank").innerText = u.bankInfo || "Chưa có";
            }
        });
        loadData(user.uid);
        loadPayoutHistory(user.uid);
    } else {
        location.href = "login.html";
    }
});

// --- LOGIC THÔNG BÁO ---
window.showNotifications = () => {
    // Sau này bạn có thể mở một Modal danh sách thông báo tại đây
    alert("Tính năng thông báo từ Quản trị đang được cập nhật!");
    
    // Tạm thời ẩn chấm đỏ sau khi người dùng nhấn vào xem
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
};

// Hàm mô phỏng việc nhận thông báo mới từ Firebase
function triggerNotification() {
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'block';
}

//
// --- 9. HÀM TÍNH TOÁN BÁO CÁO THU NHẬP ĐA GIAI ĐOẠN ---
function calculateCTVReports(successLeads) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor((now.getMonth() + 3) / 3);

    let mTotal = 0;
    let qTotal = 0;
    let yTotal = 0;

    // Khởi tạo mảng gom nhóm chi tiết theo từng tháng của năm nay
    const monthlyBreakdown = Array(13).fill(0); 

    successLeads.forEach(l => {
        const d = new Date(l.updatedAt || l.createdAt);
        const lMonth = d.getMonth() + 1;
        const lYear = d.getFullYear();
        const lQuarter = Math.floor((d.getMonth() + 3) / 3);
        const comm = parseInt(l.commission || 0);

        // Chỉ tính dữ liệu trong năm nay
        if (lYear === currentYear) {
            yTotal += comm;
            monthlyBreakdown[lMonth] += comm; // Gom tiền vào tháng tương ứng

            if (lQuarter === currentQuarter) qTotal += comm;
            if (lMonth === currentMonth) mTotal += comm;
        }
    });

    // Cập nhật 3 ô tổng quan
    if(document.getElementById("repMonth")) document.getElementById("repMonth").innerText = mTotal.toLocaleString('vi-VN') + "đ";
    if(document.getElementById("repQuarter")) document.getElementById("repQuarter").innerText = qTotal.toLocaleString('vi-VN') + "đ";
    if(document.getElementById("repYear")) document.getElementById("repYear").innerText = yTotal.toLocaleString('vi-VN') + "đ";

    // Tạo danh sách timeline chi tiết
    let timelineHtml = "";
    for (let m = 12; m >= 1; m--) {
        if (monthlyBreakdown[m] > 0 || m <= currentMonth) {
            const isCurrent = m === currentMonth ? '<span class="badge bg-success-subtle text-success ms-2" style="font-size:0.55rem">Tháng hiện tại</span>' : '';
            timelineHtml += `
                <div class="d-flex justify-content-between align-items-center p-2.5 bg-light rounded-3 mb-1">
                    <div class="fw-700 small text-dark"><i class="bi bi-calendar-check me-2 text-muted"></i>Tháng ${m}/${currentYear} ${isCurrent}</div>
                    <div class="fw-800 text-success" style="font-size:0.85rem;">+${monthlyBreakdown[m].toLocaleString('vi-VN')}đ</div>
                </div>`;
        }
    }
    
    const container = document.getElementById("reportTimelineContainer");
    if (container) container.innerHTML = timelineHtml;
}
