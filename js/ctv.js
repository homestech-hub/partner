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
        const leadData = {
            name: document.getElementById("cName").value,
            phone: document.getElementById("cPhone").value,
            project: document.getElementById("cProject").value,
            address: document.getElementById("cAddress").value,
            note: document.getElementById("cNote").value || "", 
            images: imageArray,
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
function loadData(uid) {
    onValue(query(ref(db, "COMPANIES/homestech/leads"), orderByChild("sourceCTV"), equalTo(uid)), snap => {
        const data = snap.val() || {};
        let leadHtml = "";
        let stats = { money: 0, total: 0, pending: 0, success: 0 };
        const items = Object.entries(data).reverse();

        items.forEach(([key, item]) => {
            stats.total++;
            const step = parseInt(item.step) || 1;
            const commission = parseInt(item.commission) || 0;

            if (step >= 2 && step <= 3) stats.pending++;
            else if (step >= 4) {
                stats.success++;
                stats.money += commission;
            }

            const dateCreated = item.dateDisplay || new Date(item.createdAt).toLocaleDateString('vi-VN');

            leadHtml += `
                <div class="item-card shadow-sm border-0">
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
                        <div class="dropdown">
                            <button class="btn btn-link text-muted p-0 shadow-none" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical fs-5"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end border-0 shadow-sm rounded-4 p-2">
                                <li><a class="dropdown-item small fw-700 py-2" href="javascript:void(0)" 
                                    onclick="openEditLead('${key}', '${item.name}', '${item.phone}', '${item.project}', \`${item.note || ''}\`)">
                                    <i class="bi bi-pencil me-2 text-success"></i>CHỈNH SỬA</a>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item small fw-700 py-2 text-danger" href="javascript:void(0)" onclick="deleteLead('${key}')">
                                    <i class="bi bi-trash me-2"></i>XÓA HỒ SƠ</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                        <div class="small text-muted fw-600">
                            <i class="bi bi-briefcase me-1"></i>${item.project || 'Dự án'}
                        </div>
                        <div class="d-flex gap-2">
                            <a href="http://googleusercontent.com/maps.google.com/maps?q=${encodeURIComponent(item.address || 'Dalat')}" 
                               target="_blank" class="btn btn-light btn-sm rounded-pill px-3 border fw-700">VỊ TRÍ</a>
                            <button class="btn btn-success btn-sm rounded-pill px-3 fw-700 shadow-sm" onclick="viewLeadDetail('${key}')">CHI TIẾT</button>
                        </div>
                    </div>
                </div>`;
        });

        // CẬP NHẬT UI ĐỒNG BỘ: Sử dụng class thay vì ID để cập nhật cho tất cả các tab hiển thị
        const moneyFormatted = stats.money.toLocaleString('vi-VN') + 'đ';
        
        document.querySelectorAll(".statTotalMoney").forEach(el => el.innerText = moneyFormatted);
        document.querySelectorAll(".statTotalLeads").forEach(el => el.innerText = stats.total);
        document.querySelectorAll(".statPending").forEach(el => el.innerText = stats.pending);
        document.querySelectorAll(".statSuccess").forEach(el => el.innerText = stats.success);

        // Hiển thị danh sách khách hàng
        document.getElementById("customerStatusList").innerHTML = leadHtml || '<p class="text-center py-5 opacity-50">Chưa có khách hàng</p>';
    });
}

// --- 5. LOAD LỊCH SỬ THƯỞNG (TẤT TOÁN) ---
function loadPayoutHistory(uid) {
    const container = document.getElementById("payoutHistoryContainer");
    if (!container) return;

    onValue(ref(db, `COMPANIES/homestech/payouts/${uid}`), snap => {
        const data = snap.val();
        if (!data) {
            container.innerHTML = '<p class="text-center py-5 text-muted small">Chưa có lịch sử nhận thưởng.</p>';
            return;
        }

        let html = "";
        Object.values(data).reverse().forEach(p => {
            const date = new Date(p.createdAt).toLocaleDateString('vi-VN');
            html += `
                <div class="item-card border-0 shadow-sm mb-3" style="border-left: 4px solid #059669 !important;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="small text-muted mb-1">Xác nhận tất toán: ${date}</div>
                            <h6 class="fw-800 mb-0 text-success">+${parseInt(p.amount).toLocaleString()}đ</h6>
                        </div>
                        <span class="badge bg-success-subtle text-success rounded-pill px-3">HOÀN TẤT</span>
                    </div>
                    <div class="small text-muted mt-2 pt-2 border-top">${p.note || 'Tất toán hoa hồng hệ thống'}</div>
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
    document.getElementById("editKey").value = key;
    document.getElementById("editName").value = name;
    document.getElementById("editPhone").value = phone;
    document.getElementById("editProject").value = project;
    document.getElementById("editNote").value = (note === "undefined" || !note) ? "" : note;
    new bootstrap.Modal(document.getElementById('editLeadModal')).show();
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

// --- XỬ LÝ CHUYỂN TAB ---
document.querySelectorAll('.nav-item-binh').forEach(item => {
    item.addEventListener('click', function(e) {
        if (this.tagName.toLowerCase() === 'a') return;
        e.preventDefault();

        document.querySelectorAll('.nav-item-binh').forEach(i => i.classList.remove('active'));
        this.classList.add('active');

        const targetSelector = this.getAttribute('data-bs-target');
        const targetEl = document.querySelector(targetSelector);
        
        if (targetEl) {
            // Sử dụng cơ chế ẩn/hiện class trực tiếp để tránh lỗi Illegal invocation
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            targetEl.classList.add('show', 'active');
        }
    });
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