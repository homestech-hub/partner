import { db, auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, push, update, remove, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let productCount = 0;
let localQuotesCache = [];

// ĐỒNG BỘ AUTHENTICATION
onAuthStateChanged(auth, (user) => {
    if (!user) {
        location.href = "adminlogin.html";
        return;
    }
    initBaoGiaSystem();
});

function initBaoGiaSystem() {
    onValue(ref(db, "COMPANIES/homestech/quotes"), (snapshot) => {
        const quotesData = snapshot.val() || {};
        localQuotesCache = Object.entries(quotesData).reverse();
        renderMobileQuotesList();
    });

    document.addEventListener("click", (e) => {
        if (!e.target.classList.contains('pName')) {
            document.querySelectorAll('.suggestion-list').forEach(el => el.style.display = 'none');
        }
    });

    document.getElementById("btnHeaderBack").onclick = () => window.location.href = 'mobiledash.html';
    document.getElementById("btnOpenCreate").onclick = () => openCreateForm();
    document.getElementById("btnAddNewProduct").onclick = () => addNewProductItem();
    document.getElementById("btnCancelForm").onclick = () => closeFormView();
    document.getElementById("btnSaveSubmit").onclick = () => saveQuoteToFirebaseAndDownloadPDF();
    document.getElementById("switchVAT").onchange = () => calculateGrandTotal();
    document.getElementById("mSearchQuoteInput").oninput = () => renderMobileQuotesList();
}

function getSavedProducts() {
    return JSON.parse(localStorage.getItem("HOMESTECH_SAVED_PRODUCTS")) || {};
}

// RENDER DANH SÁCH BÊN NGOÀI MOBILE KÈM DANH MỤC THIẾT BỊ HIỂN THỊ TRỰC QUAN
function renderMobileQuotesList() {
    const container = document.getElementById("mQuoteListContainer");
    if (!container) return;

    const keyword = (document.getElementById("mSearchQuoteInput")?.value || "").toLowerCase().trim();
    const labels = { da_gui: "Đã gửi", da_chot: "Đã chốt ✔", khong_chot: "Không chốt ✖" };

    let html = "";
    localQuotesCache.forEach(([id, q]) => {
        const customerName = q.customerName || "Khách hàng ẩn danh";
        if (keyword && !customerName.toLowerCase().includes(keyword)) return;

        const date = q.dateDisplay || new Date(q.createdAt).toLocaleDateString('vi-VN');
        const total = parseInt(q.totalAmount || 0).toLocaleString('vi-VN');
        const profit = parseInt(q.profitAmount || 0).toLocaleString('vi-VN');
        const statusClass = q.status === "da_chot" ? "q-da_chot" : (q.status === "khong_chot" ? "q-khong_chot" : "q-da_gui");

        let productsSummaryText = "";
        if (q.items && q.items.length > 0) {
            productsSummaryText = q.items.map(item => `• <b>${item.name}</b> x${item.qty} ${item.unit ? item.unit : 'Cái'}`).join("<br>");
        } else {
            productsSummaryText = `<span class="text-muted italic">Không có chi tiết vật tư</span>`;
        }

        html += `
            <div class="m-item-card border">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <b class="text-dark fs-6 text-uppercase" style="font-weight:800;">${customerName}</b>
                        <div class="text-muted small mt-1"><i class="bi bi-calendar3 me-1"></i>Ngày lập: ${date}</div>
                    </div>
                    <span class="quote-badge ${statusClass}">${labels[q.status] || "Đã gửi"}</span>
                </div>
                
                <div class="bg-light p-2 rounded-3 my-2 border-start border-primary border-3" style="font-size: 0.75rem; line-height:1.5;">
                    <div class="fw-700 text-secondary mb-1"><i class="bi bi-box-seam me-1"></i>Chi tiết thiết bị:</div>
                    <div class="text-dark fw-600">${productsSummaryText}</div>
                </div>

                <div class="d-flex justify-content-between align-items-center pt-2 border-top small fw-700">
                    <div>Giá bán: <span class="text-success">${total}đ</span></div>
                    <div class="text-primary">Lợi nhuận: ${profit}đ</div>
                </div>
                <div class="d-flex justify-content-end gap-2 mt-3 pt-2 border-top">
                    <button class="btn btn-sm btn-light border fw-600 rounded-pill px-3" id="btn-edit-${id}"><i class="bi bi-pencil-square me-1"></i>Sửa</button>
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" id="btn-del-${id}"><i class="bi bi-trash"></i> Xóa</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || `<div class="text-center text-muted py-5 small">Chưa có bảng báo giá nào phù hợp.</div>`;

    localQuotesCache.forEach(([id, q]) => {
        const btnEdit = document.getElementById(`btn-edit-${id}`);
        const btnDel = document.getElementById(`btn-del-${id}`);
        if(btnEdit) btnEdit.onclick = () => openEditQuoteForm(id);
        if(btnDel) btnDel.onclick = () => deleteMobileQuote(id);
    });
}

function openCreateForm() {
    document.getElementById("mQuoteListView").classList.add("d-none");
    document.getElementById("mQuoteFormView").classList.remove("d-none");
    document.getElementById("mHeaderTitle").innerText = "TẠO BÁO GIÁ MỚI";
    document.getElementById("btnHeaderBack").onclick = () => closeFormView();

    document.getElementById("submitQuoteId").value = "";
    document.getElementById("custName").value = "";
    document.getElementById("custPhone").value = "";
    document.getElementById("custAddress").value = "";
    document.getElementById("switchVAT").checked = false;
    document.getElementById("products-list-container").innerHTML = "";
    productCount = 0;
    addNewProductItem();
}

function closeFormView() {
    document.getElementById("mQuoteFormView").classList.add("d-none");
    document.getElementById("mQuoteListView").classList.remove("d-none");
    document.getElementById("mHeaderTitle").innerText = "QUẢN LÝ BÁO GIÁ CRM";
    document.getElementById("btnHeaderBack").onclick = () => window.location.href = 'mobiledash.html';
}

function addNewProductItem() {
    productCount++;
    const container = document.getElementById("products-list-container");
    
    const itemHtml = `
        <div class="product-item-box shadow-sm" id="prod-item-${productCount}">
            <button type="button" class="remove-item-btn" id="btn-remove-box-${productCount}"><i class="bi bi-x-circle-fill"></i></button>
            <div class="row g-2">
                <div class="col-12 mb-1" style="position:relative;">
                    <label class="small fw-700 text-muted mb-1"><i class="bi bi-tag-fill text-success me-1"></i>Tên thiết bị chính</label>
                    <input type="text" class="form-control input-m pName" id="pName-${productCount}" placeholder="Nhập tên sản phẩm chính...">
                    <ul class="suggestion-list" id="suggest-${productCount}"></ul>
                </div>
                <div class="col-12 mb-1">
                    <label class="small fw-700 text-muted mb-1"><i class="bi bi-list-stars text-primary me-1"></i>Thông số kỹ thuật / Tính năng chi tiết</label>
                    <textarea class="form-control input-m pDetails" id="pDetails-${productCount}" rows="3" placeholder="Gõ các tính năng chi tiết, xuống dòng để gạch đầu dòng..."></textarea>
                </div>
                
                <!-- 🌟 BỔ SUNG CỘT ĐƠN VỊ VÀ GHI CHÚ TRÊN GIAO DIỆN -->
                <div class="col-6 mb-1">
                    <label class="small fw-700 text-muted mb-1">Đơn vị</label>
                    <input type="text" class="form-control input-m pUnit" id="pUnit-${productCount}" value="Cái" placeholder="Bộ, Cái, Mét...">
                </div>
                <div class="col-6 mb-1">
                    <label class="small fw-700 text-muted mb-1">Ghi chú sản phẩm</label>
                    <input type="text" class="form-control input-m pItemNote" id="pItemNote-${productCount}" placeholder="Bảo hành, quà tặng...">
                </div>

                <div class="col-4"><label class="small fw-700 text-muted mb-1">Số lượng</label><input type="number" class="form-control input-m pQty" value="1"></div>
                <div class="col-4"><label class="small fw-700 text-muted mb-1">Giá bán lẻ (đ)</label><input type="number" class="form-control input-m pPrice"></div>
                <div class="col-4"><label class="small fw-700 text-muted mb-1">Giá vốn gốc (đ)</label><input type="number" class="form-control input-m pCost"></div>
                <div class="col-12 mt-2">
                    <label class="small text-muted fw-700 mb-1 d-block"><i class="bi bi-link-45deg me-1"></i>Đường link URL hình ảnh</label>
                    <input type="url" class="form-control input-m pImageLink" placeholder="Dán link ảnh...">
                    <div class="text-center mt-2 d-none img-container-${productCount}">
                        <img id="thumb-preview-${productCount}" class="img-preview-thumb" style="width:65px; height:65px;">
                    </div>
                </div>
            </div>
        </div>`;
        
    container.insertAdjacentHTML('beforeend', itemHtml);

    const box = document.getElementById(`prod-item-${productCount}`);
    box.querySelector(".pName").oninput = (e) => handleProductSearch(e.target, productCount);
    box.querySelector(".pQty").oninput = () => calculateGrandTotal();
    box.querySelector(".pPrice").oninput = () => calculateGrandTotal();
    box.querySelector(".pCost").oninput = () => calculateGrandTotal();
    box.querySelector(".pImageLink").oninput = (e) => previewMImageLink(e.target, productCount);
    document.getElementById(`btn-remove-box-${productCount}`).onclick = () => removeProductItem(productCount);
}

function removeProductItem(id) {
    const item = document.getElementById(`prod-item-${id}`);
    if (item) { item.remove(); calculateGrandTotal(); }
}

function previewMImageLink(input, id) {
    const url = input.value.trim();
    const preview = document.getElementById(`thumb-preview-${id}`);
    const container = document.querySelector(`.img-container-${id}`);
    if (url && preview && container) {
        preview.src = url;
        container.classList.remove("d-none");
    } else if (container) {
        container.classList.add("d-none");
    }
}

function handleProductSearch(input, id) {
    const keyword = input.value.toLowerCase().trim();
    const listEl = document.getElementById(`suggest-${id}`);
    if (!keyword) { listEl.style.display = 'none'; return; }

    const savedProducts = getSavedProducts();
    let html = "";
    
    Object.keys(savedProducts).forEach(name => {
        if (name.toLowerCase().includes(keyword)) {
            const item = savedProducts[name];
            html += `<li class="suggestion-item" data-name="${name}" data-price="${item.price}" data-cost="${item.cost}" data-link="${item.imgLink}" data-details="${item.details || ''}" data-unit="${item.unit || 'Cái'}">
                <span class="fw-700 text-dark">${name}</span>
                <span class="text-muted small">${item.price.toLocaleString()}đ</span>
            </li>`;
        }
    });

    if (html) {
        listEl.innerHTML = html;
        listEl.style.display = 'block';
        
        listEl.querySelectorAll('.suggestion-item').forEach(li => {
            li.onclick = function() {
                selectProductSuggestion(
                    id, 
                    this.getAttribute('data-name'), 
                    parseFloat(this.getAttribute('data-price')), 
                    parseFloat(this.getAttribute('data-cost')), 
                    this.getAttribute('data-link'),
                    this.getAttribute('data-details'),
                    this.getAttribute('data-unit')
                );
            };
        });
    } else {
        listEl.style.display = 'none';
    }
}

function selectProductSuggestion(id, name, price, cost, imgLink, details, unit) {
    const box = document.getElementById(`prod-item-${id}`);
    box.querySelector(".pName").value = name;
    box.querySelector(".pPrice").value = price;
    box.querySelector(".pCost").value = cost || 0;
    box.querySelector(".pImageLink").value = imgLink || "";
    box.querySelector(".pDetails").value = details || "";
    box.querySelector(".pUnit").value = unit || "Cái";
    
    document.getElementById(`suggest-${id}`).style.display = 'none';
    previewMImageLink(box.querySelector(".pImageLink"), id);
    calculateGrandTotal();
}

function calculateGrandTotal() {
    let subTotal = 0;
    let totalCost = 0;
    const boxes = document.querySelectorAll(".product-item-box");

    boxes.forEach(box => {
        const qty = parseFloat(box.querySelector(".pQty").value) || 0;
        const price = parseFloat(box.querySelector(".pPrice").value) || 0;
        const cost = parseFloat(box.querySelector(".pCost").value) || 0;
        
        subTotal += (qty * price);
        totalCost += (qty * cost);
    });

    const isVAT = document.getElementById("switchVAT").checked;
    const vatTotal = isVAT ? Math.round(subTotal * 0.08) : 0;
    const grandTotal = subTotal + vatTotal;
    
    const profitGrop = subTotal - totalCost;
    const profitMarginPercent = subTotal > 0 ? ((profitGrop / subTotal) * 100).toFixed(1) : 0;

    document.getElementById("lblSubTotal").innerText = subTotal.toLocaleString('vi-VN') + "đ";
    document.getElementById("lblTotalCost").innerText = totalCost.toLocaleString('vi-VN') + "đ";
    document.getElementById("lblVAT").innerText = vatTotal.toLocaleString('vi-VN') + "đ";
    document.getElementById("lblGrandTotal").innerText = grandTotal.toLocaleString('vi-VN') + "đ";
    
    const profitEl = document.getElementById("lblProfit");
    profitEl.innerText = `${profitGrop.toLocaleString('vi-VN')}đ (${profitMarginPercent}%)`;
    profitEl.className = profitGrop >= 0 ? "text-success fw-800" : "text-danger fw-800";

    return { subTotal, vatTotal, grandTotal };
}

function openEditQuoteForm(id) {
    get(ref(db, `COMPANIES/homestech/quotes/${id}`)).then((snapshot) => {
        const q = snapshot.val();
        if (!q) return alert("Không tìm thấy báo giá!");

        document.getElementById("mQuoteListView").classList.add("d-none");
        document.getElementById("mQuoteFormView").classList.remove("d-none");
        document.getElementById("mHeaderTitle").innerText = "CHỈNH SỬA BÁO GIÁ";
        document.getElementById("btnHeaderBack").onclick = () => closeFormView();

        document.getElementById("submitQuoteId").value = id;
        document.getElementById("custName").value = q.customerName || "";
        document.getElementById("custPhone").value = q.pdfCustPhone || "";
        document.getElementById("custAddress").value = q.pdfCustAddress || "";
        document.getElementById("switchVAT").checked = q.statusVAT === 8;

        const listContainer = document.getElementById("products-list-container");
        listContainer.innerHTML = "";
        productCount = 0;

        if (q.items && q.items.length > 0) {
            q.items.forEach(item => {
                productCount++;
                const itemHtml = `
                    <div class="product-item-box shadow-sm" id="prod-item-${productCount}">
                        <button type="button" class="remove-item-btn" id="btn-remove-box-${productCount}"><i class="bi bi-x-circle-fill"></i></button>
                        <div class="row g-2">
                            <div class="col-12 mb-1" style="position:relative;">
                                <label class="small fw-700 text-muted mb-1">Tên thiết bị chính</label>
                                <input type="text" class="form-control input-m pName" value="${item.name}">
                                <ul class="suggestion-list" id="suggest-${productCount}"></ul>
                            </div>
                            <div class="col-12 mb-1">
                                <label class="small fw-700 text-muted mb-1">Thông số kỹ thuật / Tính năng chi tiết</label>
                                <textarea class="form-control input-m pDetails" rows="3">${item.details || ''}</textarea>
                            </div>
                            <div class="col-6 mb-1">
                                <label class="small fw-700 text-muted mb-1">Đơn vị</label>
                                <input type="text" class="form-control input-m pUnit" value="${item.unit || 'Cái'}">
                            </div>
                            <div class="col-6 mb-1">
                                <label class="small fw-700 text-muted mb-1">Ghi chú sản phẩm</label>
                                <input type="text" class="form-control input-m pItemNote" value="${item.itemNote || ''}">
                            </div>
                            <div class="col-4"><label class="small fw-700 text-muted mb-1">Số lượng</label><input type="number" class="form-control input-m pQty" value="${item.qty}"></div>
                            <div class="col-4"><label class="small fw-700 text-muted mb-1">Giá bán lẻ (đ)</label><input type="number" class="form-control input-m pPrice" value="${item.price}"></div>
                            <div class="col-4"><label class="small fw-700 text-muted mb-1">Giá vốn gốc (đ)</label><input type="number" class="form-control input-m pCost" value="${item.cost || 0}"></div>
                            <div class="col-12 mt-2">
                                <label class="small text-muted fw-700 mb-1 d-block"><i class="bi bi-link-45deg me-1"></i>Đường link URL hình ảnh</label>
                                <input type="url" class="form-control input-m pImageLink" value="${item.imgLink || ''}">
                                <div class="text-center mt-2 ${item.imgLink ? '' : 'd-none'} img-container-${productCount}">
                                    <img id="thumb-preview-${productCount}" src="${item.imgLink || ''}" class="img-preview-thumb" style="width:65px; height:65px;">
                                </div>
                            </div>
                        </div>
                    </div>`;
                listContainer.insertAdjacentHTML('beforeend', itemHtml);
                
                const box = document.getElementById(`prod-item-${productCount}`);
                box.querySelector(".pName").oninput = (e) => handleProductSearch(e.target, productCount);
                box.querySelector(".pQty").oninput = () => calculateGrandTotal();
                box.querySelector(".pPrice").oninput = () => calculateGrandTotal();
                box.querySelector(".pCost").oninput = () => calculateGrandTotal();
                box.querySelector(".pImageLink").oninput = (e) => previewMImageLink(e.target, productCount);
                document.getElementById(`btn-remove-box-${productCount}`).onclick = () => removeProductItem(productCount);
            });
        } else {
            addNewProductItem();
        }
        calculateGrandTotal();
    });
}

function deleteMobileQuote(id) {
    if (confirm("Bạn chắc chắn muốn xóa vĩnh viễn bảng báo giá này khỏi hệ thống Firebase?")) {
        remove(ref(db, `COMPANIES/homestech/quotes/${id}`))
            .then(() => alert("Đã xóa báo giá thành công!"))
            .catch(err => alert("Lỗi xóa: " + err.message));
    }
}

async function saveQuoteToFirebaseAndDownloadPDF() {
    const custName = document.getElementById("custName").value.trim();
    if (!custName) return alert("Vui lòng gõ tên khách hàng!");

    const quoteId = document.getElementById("submitQuoteId").value;
    const boxes = document.querySelectorAll(".product-item-box");
    
    const itemsArray = [];
    let subTotal = 0;
    let totalCost = 0;

    const savedProducts = getSavedProducts();

    boxes.forEach(box => {
        const name = box.querySelector(".pName").value.trim();
        const details = box.querySelector(".pDetails").value.trim();
        const unit = box.querySelector(".pUnit") ? box.querySelector(".pUnit").value.trim() : "Cái";
        const itemNote = box.querySelector(".pItemNote") ? box.querySelector(".pItemNote").value.trim() : "";
        const qty = parseFloat(box.querySelector(".pQty").value) || 0;
        const price = parseFloat(box.querySelector(".pPrice").value) || 0;
        const cost = parseFloat(box.querySelector(".pCost").value) || 0;
        const imgLink = box.querySelector(".pImageLink").value.trim();

        if (name) {
            itemsArray.push({ name, details, unit, itemNote, qty, price, cost, imgLink });
            subTotal += (qty * price);
            totalCost += (qty * cost);

            if(price > 0) {
                savedProducts[name] = { price: price, cost: cost, imgLink: imgLink, details: details, unit: unit, savedAt: Date.now() };
            }
        }
    });

    if (itemsArray.length === 0) {
        return alert("Vui lòng thêm ít nhất một sản phẩm trước khi xuất!");
    }

    localStorage.setItem("HOMESTECH_SAVED_PRODUCTS", JSON.stringify(savedProducts));

    const isVAT = document.getElementById("switchVAT").checked;
    const vatTotal = isVAT ? Math.round(subTotal * 0.08) : 0;
    const grandTotal = subTotal + vatTotal;
    const profitAmount = subTotal - totalCost;

    const quoteNodeData = {
        customerName: custName,
        pdfCustPhone: document.getElementById("custPhone").value || "-",
        pdfCustAddress: document.getElementById("custAddress").value || "Đà Lạt, Lâm Đồng",
        status: isVAT ? "da_gui" : "da_chot",
        statusVAT: isVAT ? 8 : 0,
        totalAmount: grandTotal,
        costAmount: totalCost,
        profitAmount: profitAmount,
        items: itemsArray,
        note: `Báo giá lập tự động trên Mobile`,
        updatedAt: Date.now()
    };

    try {
        if (quoteId) {
            await update(ref(db, `COMPANIES/homestech/quotes/${quoteId}`), quoteNodeData);
        } else {
            quoteNodeData.createdAt = Date.now();
            quoteNodeData.dateDisplay = new Date().toLocaleDateString('vi-VN');
            await push(ref(db, "COMPANIES/homestech/quotes"), quoteNodeData);
        }

        document.getElementById("pdfCustName").innerText = custName;
        document.getElementById("pdfCustPhone").innerText = quoteNodeData.pdfCustPhone;
        document.getElementById("pdfCustAddress").innerText = quoteNodeData.pdfCustAddress;
        document.getElementById("pdfDate").innerText = new Date().toLocaleDateString('vi-VN');

        let tableBodyHtml = "";
        itemsArray.forEach((item, index) => {
            const proxyImgUrl = item.imgLink ? `https://images.weserv.nl/?url=${encodeURIComponent(item.imgLink)}&w=200&h=200&fit=cover` : '';
            const imgTag = item.imgLink ? `<img src="${proxyImgUrl}" crossorigin="anonymous" style="width:55px; height:55px; object-fit:cover; border-radius:6px; display:inline-block;">` : `<span class="text-muted small" style="font-size:11px;">Không ảnh</span>`;
            
            let formattedDescription = `<b style="font-size:14px; color:#0f172a; display:block; margin-bottom:4px;">${item.name}</b>`;
            if (item.details) {
                const lines = item.details.split('\n');
                formattedDescription += `<div style="font-size:12px; color:#475569; line-height:1.5; padding-left:2px;">`;
                lines.forEach(line => {
                    if (line.trim() !== "") {
                        let cleanLine = line.replace(/^[\s\-\–\•\*]+/g, "").trim();
                        formattedDescription += `<div style="margin-bottom:1px;">– ${cleanLine}</div>`;
                    }
                });
                formattedDescription += `</div>`;
            }

            // 🌟 HIỂN THỊ GHI CHÚ NHỎ Ở CUỐI PHẦN MÔ TẢ TRONG PDF (NẾU CÓ)
            if (item.itemNote) {
                formattedDescription += `<div class="mt-1 text-success italic" style="font-size:11px; font-weight:600;"><i class="bi bi-info-circle me-1"></i>Ghi chú: ${item.itemNote}</div>`;
            }

            tableBodyHtml += `
                <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td style="text-align:center; padding: 4px;">${imgTag}</td>
                    <td style="text-align:left; vertical-align:top;">${formattedDescription}</td>
                    <td style="text-align:center; font-weight:600;">${item.unit ? item.unit : 'Cái'}</td>
                    <td style="text-align:center;">${item.qty}</td>
                    <td style="text-align:right;">${item.price.toLocaleString('vi-VN')}</td>
                    <td style="text-align:right; font-weight:800; color:#065f46;">${(item.qty * item.price).toLocaleString('vi-VN')}</td>
                </tr>`;
        });
        
        document.getElementById("pdfTableBody").innerHTML = tableBodyHtml;
        document.getElementById("pdfSubTotal").innerText = subTotal.toLocaleString('vi-VN');
        document.getElementById("pdfVAT").innerText = vatTotal.toLocaleString('vi-VN');
        document.getElementById("pdfGrandTotal").innerText = grandTotal.toLocaleString('vi-VN');

        const element = document.getElementById("pdf-template");
        element.style.display = "block";
        element.style.position = "static"; 
        
        const allPdfImages = element.querySelectorAll("img");
        const imageLoadPromises = [];

        allPdfImages.forEach((img) => {
            if (!img.complete) {
                imageLoadPromises.push(new Promise((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); 
                }));
            }
        });

        await Promise.all(imageLoadPromises);

        setTimeout(async () => {
            try {
                const opt = {
                    margin: 12,
                    filename: `BaoGia_Homestech_${custName.replace(/\s+/g, '_')}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2, 
                        useCORS: true,      
                        allowTaint: false,  
                        logging: false, 
                        width: 800,
                        scrollY: 0,
                        scrollX: 0
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                await html2pdf().set(opt).from(element).save();
                
                element.style.display = "none";
                element.style.position = "absolute";
                
                alert("Đã lưu đồng bộ lên Firebase và tải file PDF kèm hình ảnh thành công!");
                closeFormView();
            } catch (pdfErr) {
                element.style.display = "none";
                element.style.position = "absolute";
                alert("Lỗi tạo PDF: " + pdfErr.message);
            }
        }, 600);

    } catch (err) {
        alert("Lỗi kết nối Firebase: " + err.message);
    }
}
