// DoorExpert 뉴스 로더
(function() {
    const NEWS_JSON_PATH = 'news-data.json';
    const DISPLAY_COUNT = 9;
    const REFRESH_INTERVAL = 60 * 60 * 1000; // 1시간

    // 뉴스 카드 HTML 생성
    function createNewsCard(article) {
        const thumbnail = article.thumbnail || 'https://via.placeholder.com/400x300/496039/ffffff?text=News';
        const title = escapeHtml(article.title);
        const description = escapeHtml(article.description).slice(0, 100) + '...';
        const source = escapeHtml(article.source);
        const date = escapeHtml(article.date);
        const url = article.url;

        return `
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="group block overflow-hidden rounded-2xl bg-white shadow-sm border border-[#edefeb] hover:shadow-xl transition-all duration-300 dark:bg-stone-900 dark:border-stone-800">
                <div class="relative overflow-hidden aspect-[16/10]">
                    <img
                        src="${thumbnail}"
                        alt="${title}"
                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onerror="this.src='https://via.placeholder.com/400x300/496039/ffffff?text=DoorExpert'"
                        loading="lazy"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div class="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span class="inline-flex items-center gap-1 text-white text-xs font-medium">
                            <span class="material-symbols-outlined text-sm">open_in_new</span>
                            기사 보기
                        </span>
                    </div>
                </div>
                <div class="p-5">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">${source}</span>
                        <span class="text-[11px] text-[#717e67]">${date}</span>
                    </div>
                    <h3 class="text-base font-bold leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">${title}</h3>
                    <p class="text-sm text-[#717e67] line-clamp-2">${description}</p>
                </div>
            </a>
        `;
    }

    // HTML 이스케이프
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 뉴스 데이터 로드 및 렌더링
    async function loadNews() {
        const container = document.getElementById('news-container');
        const updateTimeEl = document.getElementById('news-update-time');

        if (!container) return;

        try {
            // 캐시 방지를 위한 타임스탬프 추가
            const response = await fetch(`${NEWS_JSON_PATH}?t=${Date.now()}`);

            if (!response.ok) {
                throw new Error('뉴스 데이터를 불러올 수 없습니다.');
            }

            const data = await response.json();
            const articles = data.articles.slice(0, DISPLAY_COUNT);

            if (articles.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12 text-[#717e67]">
                        <span class="material-symbols-outlined text-4xl mb-4 block">newspaper</span>
                        <p>뉴스를 불러오는 중입니다.</p>
                    </div>
                `;
                return;
            }

            // 뉴스 카드 렌더링
            container.innerHTML = articles.map(createNewsCard).join('');

            // 업데이트 시간 표시
            if (updateTimeEl && data.lastUpdatedKST) {
                updateTimeEl.textContent = `최종 업데이트: ${data.lastUpdatedKST}`;
            }

        } catch (error) {
            console.error('뉴스 로드 오류:', error);
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-[#717e67]">
                    <span class="material-symbols-outlined text-4xl mb-4 block">cloud_off</span>
                    <p>뉴스를 불러오는 데 실패했습니다.</p>
                    <button onclick="window.loadNews()" class="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-opacity-90 transition-all">
                        다시 시도
                    </button>
                </div>
            `;
        }
    }

    // 전역으로 노출 (재시도 버튼용)
    window.loadNews = loadNews;

    // CSS 스타일 추가 (line-clamp)
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .line-clamp-2 {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            #news-container a:focus {
                outline: 2px solid #496039;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    // 초기화
    function init() {
        addStyles();
        loadNews();

        // 1시간마다 자동 새로고침 (페이지가 열려있는 동안)
        setInterval(loadNews, REFRESH_INTERVAL);
    }

    // DOM 로드 후 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
