/**
 * DoorExpert 뉴스 크롤러
 * 네이버 뉴스에서 현관문/도어 관련 뉴스를 수집합니다.
 * 실행: node news-crawler.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    searchKeywords: ['현관문', '도어 인테리어', '스마트도어락', '방화문', '단열문', '현관중문', '인테리어중문', '3연동중문', '슬라이드중문', '자동중문'],
    maxArticles: 50,
    displayCount: 9,
    outputFile: 'news-data.json',
    defaultThumbnail: 'https://via.placeholder.com/400x300/496039/ffffff?text=DoorExpert+News'
};

async function crawlNews() {
    console.log('🚀 뉴스 크롤링 시작...');

    const browser = await chromium.launch({
        headless: true,
        args: ['--lang=ko-KR']
    });

    const context = await browser.newContext({
        locale: 'ko-KR',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    const allArticles = [];

    for (const keyword of CONFIG.searchKeywords) {
        console.log(`📰 "${keyword}" 검색 중...`);

        try {
            // 네이버 뉴스 검색 (최신순)
            const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(keyword)}&sort=1&sm=tab_smr`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);

            // 새로운 네이버 뉴스 검색 결과 구조에서 기사 추출
            const articles = await page.evaluate(() => {
                const results = [];
                const seenUrls = new Set();

                // 모든 링크에서 뉴스 기사 링크 찾기
                document.querySelectorAll('a').forEach(a => {
                    const href = a.getAttribute('href') || '';
                    const text = a.textContent.trim();

                    // 뉴스 기사 링크 패턴 (외부 언론사 링크)
                    const isNewsLink = href.startsWith('http') &&
                        !href.includes('search.naver.com') &&
                        !href.includes('help.naver.com') &&
                        !href.includes('nid.naver.com') &&
                        !href.includes('mkt.naver.com') &&
                        !href.includes('navercorp.com') &&
                        !href.includes('news.naver.com/main/static') &&
                        !href.includes('channelPromotion') &&
                        text.length > 20 &&
                        !text.includes('언론사 선정') &&
                        !text.includes('언론사가 선정한');

                    if (isNewsLink && !seenUrls.has(href)) {
                        seenUrls.add(href);

                        // 부모 요소에서 추가 정보 찾기
                        let parent = a.parentElement;
                        let description = '';
                        let thumbnail = '';
                        let source = '';
                        let date = '';

                        // 위로 올라가며 컨테이너에서 정보 찾기
                        for (let i = 0; i < 8 && parent; i++) {
                            // 설명 찾기
                            if (!description) {
                                const dscEl = parent.querySelector('.dsc, [class*="dsc"], [class*="desc"]');
                                if (dscEl) {
                                    const dscText = dscEl.textContent.trim();
                                    if (dscText.length > 30 && dscText !== text) {
                                        description = dscText;
                                    }
                                }
                            }

                            // 이미지 찾기
                            if (!thumbnail) {
                                const img = parent.querySelector('img');
                                if (img) {
                                    const src = img.getAttribute('data-lazysrc') || img.getAttribute('src') || '';
                                    if (src && !src.includes('data:image') && !src.includes('blank') && src.startsWith('http')) {
                                        thumbnail = src;
                                    }
                                }
                            }

                            // 언론사 찾기
                            if (!source) {
                                const pressEl = parent.querySelector('.press, [class*="press"], [class*="source"]');
                                if (pressEl) {
                                    source = pressEl.textContent.trim();
                                }
                            }

                            // 날짜 찾기
                            if (!date) {
                                const infoEls = parent.querySelectorAll('[class*="info"], [class*="date"], [class*="time"]');
                                infoEls.forEach(el => {
                                    const t = el.textContent.trim();
                                    if (t.includes('전') || t.includes('일') || t.match(/\d{4}\./)) {
                                        date = t;
                                    }
                                });
                            }

                            parent = parent.parentElement;
                        }

                        // 언론사명 정제 (날짜와 기타 정보 제거)
                        if (source) {
                            // "머니투데이1시간 전네이버뉴스" -> "머니투데이"
                            source = source.replace(/\d+시간\s*전/g, '')
                                          .replace(/\d+분\s*전/g, '')
                                          .replace(/\d+일\s*전/g, '')
                                          .replace(/네이버뉴스/g, '')
                                          .replace(/\s+/g, ' ')
                                          .trim();
                        }

                        // 언론사명 추출 (URL에서)
                        if (!source) {
                            try {
                                const urlObj = new URL(href);
                                const hostname = urlObj.hostname.replace('www.', '').replace('view.', '');
                                const domainParts = hostname.split('.');
                                source = domainParts[0];
                            } catch (e) {
                                source = '뉴스';
                            }
                        }

                        // 날짜 정제
                        if (date) {
                            // "1시간 전", "2일 전" 등만 추출
                            const dateMatch = date.match(/(\d+시간\s*전|\d+분\s*전|\d+일\s*전|\d+주\s*전)/);
                            if (dateMatch) {
                                date = dateMatch[1];
                            }
                        }

                        results.push({
                            title: text.slice(0, 150),
                            url: href,
                            description: description.slice(0, 300),
                            source: source,
                            date: date || '최근',
                            thumbnail: thumbnail
                        });
                    }
                });

                return results;
            });

            // 중복 제거 (제목 기준)
            const uniqueArticles = [];
            const seenTitles = new Set();
            articles.forEach(article => {
                const titleKey = article.title.slice(0, 30);
                if (!seenTitles.has(titleKey) && article.title.length > 20) {
                    seenTitles.add(titleKey);
                    uniqueArticles.push(article);
                }
            });

            // 각 기사의 본문 이미지 가져오기 (최대 5개까지만)
            for (let i = 0; i < Math.min(uniqueArticles.length, 5); i++) {
                const article = uniqueArticles[i];

                // 본문 페이지에서 메인 이미지 추출
                if (article.url && !article.thumbnail) {
                    try {
                        await page.goto(article.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await page.waitForTimeout(1500);

                        const mainImage = await page.evaluate(() => {
                            // 다양한 뉴스 사이트의 이미지 선택자들
                            const selectors = [
                                'article img',
                                '.article_view img',
                                '.article-body img',
                                '.news_body img',
                                '.article_body img',
                                '#articleBody img',
                                '.view_con img',
                                '.article-view img',
                                'figure img',
                                '.photo img',
                                '.image img',
                                'img[src*="image"]',
                                'img[src*="photo"]'
                            ];

                            for (const selector of selectors) {
                                const img = document.querySelector(selector);
                                if (img) {
                                    const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
                                    if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && !src.includes('blank')) {
                                        return src;
                                    }
                                }
                            }
                            return null;
                        });

                        if (mainImage) {
                            article.thumbnail = mainImage;
                            console.log(`   ✅ 이미지 수집: ${article.title.slice(0, 30)}...`);
                        }
                    } catch (e) {
                        console.log(`   ⚠️ 이미지 수집 실패: ${article.title.slice(0, 20)}...`);
                    }
                }
            }

            uniqueArticles.forEach(article => {
                article.keyword = keyword;
                // 썸네일이 없거나 유효하지 않으면 기본 이미지 사용
                if (!article.thumbnail ||
                    article.thumbnail.includes('data:image') ||
                    article.thumbnail.includes('blank')) {
                    article.thumbnail = CONFIG.defaultThumbnail;
                }
            });

            allArticles.push(...uniqueArticles);
            console.log(`   📊 ${uniqueArticles.length}개 기사 수집 완료`);

        } catch (error) {
            console.error(`   ❌ "${keyword}" 검색 실패:`, error.message);
        }

        await page.waitForTimeout(1500);
    }

    await browser.close();

    // 중복 제거 (URL 기준)
    const uniqueArticles = [];
    const seenUrls = new Set();

    for (const article of allArticles) {
        if (!seenUrls.has(article.url) && article.url) {
            seenUrls.add(article.url);
            uniqueArticles.push(article);
        }
    }

    // 최대 개수 제한
    const finalArticles = uniqueArticles.slice(0, CONFIG.maxArticles);

    // JSON 파일 저장 (UTF-8 인코딩)
    const outputData = {
        lastUpdated: new Date().toISOString(),
        lastUpdatedKST: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        totalCount: finalArticles.length,
        displayCount: CONFIG.displayCount,
        articles: finalArticles
    };

    const outputPath = path.join(__dirname, CONFIG.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), { encoding: 'utf8' });

    console.log(`\n✅ 크롤링 완료!`);
    console.log(`   - 총 ${finalArticles.length}개 기사 저장`);
    console.log(`   - 파일: ${outputPath}`);
    console.log(`   - 업데이트: ${outputData.lastUpdatedKST}`);

    return outputData;
}

// 스케줄러 모드로 실행 (1시간마다)
async function runScheduler() {
    console.log('⏰ 스케줄러 모드 시작 (1시간 간격)');

    // 즉시 1회 실행
    await crawlNews();

    // 1시간마다 반복
    setInterval(async () => {
        console.log('\n' + '='.repeat(50));
        await crawlNews();
    }, 60 * 60 * 1000); // 1시간
}

// 명령줄 인자 확인
const args = process.argv.slice(2);
if (args.includes('--schedule')) {
    runScheduler();
} else {
    crawlNews().then(() => process.exit(0)).catch(err => {
        console.error('크롤링 오류:', err);
        process.exit(1);
    });
}

module.exports = { crawlNews };
