const API_KEY = "{{ api_key }}"; // Flask에서 렌더 시 전달 가능
let ai = null;
let searchType = "movie";
let selectedItem = null;

// DOM 요소
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const resultsGrid = document.getElementById("results-grid");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const placeholderEl = document.getElementById("placeholder");
const modal = document.getElementById("modal");
const modalClose = document.getElementById("modal-close");
const detailsLoading = document.getElementById("details-loading");
const detailsContent = document.getElementById("details-content");
const detailsTitle = document.getElementById("details-title");
const detailsMeta = document.getElementById("details-meta");
const detailsSynopsis = document.getElementById("details-synopsis");
const detailsReview = document.getElementById("details-review");
const detailsRecommendations = document.getElementById("details-recommendations");

// 검색 타입 버튼
document.querySelectorAll(".search-type-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".search-type-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        searchType = btn.dataset.type;
        searchInput.placeholder = searchType === "movie" ? "영화 제목을 검색하세요..." : "도서 제목을 검색하세요...";
    });
});

// 모달 닫기
modalClose.addEventListener("click", () => {
    modal.style.display = "none";
    selectedItem = null;
    detailsContent.style.display = "none";
});

// 검색 폼 제출
searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) {
        showError("검색어를 입력해주세요.");
        return;
    }

    resultsGrid.innerHTML = "";
    showLoading(true);
    showError(null);
    placeholderEl.style.display = "none";

    try {
        const typeKorean = searchType === "movie" ? "영화" : "도서";
        const prompt = `${query}와(과) 관련된 가상의 ${typeKorean} 5개의 제목을 알려주세요.`;

        // 예시: Flask 백엔드로 AI 요청 (실제 구현 필요)
        const res = await fetch("/generate_titles", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({prompt})
        });
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
            showError("결과를 찾을 수 없습니다. 다른 검색어를 시도해보세요.");
        }

        results.forEach(item => {
            const card = document.createElement("div");
            card.className = "result-card";
            card.innerHTML = `
                <div class="cover"></div>
                <div class="title">${item.title}</div>
            `;
            card.addEventListener("click", () => selectItem(item));
            resultsGrid.appendChild(card);
        });
    } catch (err) {
        showError("검색 중 오류가 발생했습니다.");
        console.error(err);
    } finally {
        showLoading(false);
    }
});

function showLoading(flag) {
    loadingEl.style.display = flag ? "block" : "none";
}

function showError(msg) {
    errorEl.style.display = msg ? "block" : "none";
    errorEl.textContent = msg || "";
}

async function selectItem(item) {
    selectedItem = item;
    modal.style.display = "flex";
    detailsLoading.style.display = "block";
    detailsContent.style.display = "none";

    try {
        const typeKorean = searchType === "movie" ? "영화" : "도서";
        const prompt = `가상의 ${typeKorean} "${item.title}"에 대한 상세 정보를 생성해주세요.`;

        const res = await fetch("/generate_details", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({prompt, type: searchType})
        });
        const details = await res.json();

        detailsTitle.textContent = item.title;
        detailsMeta.textContent = details.meta;
        detailsSynopsis.textContent = details.synopsis;
        detailsReview.textContent = details.review;

        detailsRecommendations.innerHTML = "";
        details.recommendations.forEach(rec => {
            const li = document.createElement("li");
            li.textContent = rec;
            detailsRecommendations.appendChild(li);
        });

        detailsLoading.style.display = "none";
        detailsContent.style.display = "block";
    } catch (err) {
        detailsLoading.style.display = "none";
        showError("상세 정보를 불러오는 중 오류가 발생했습니다.");
        console.error(err);
    }
}
