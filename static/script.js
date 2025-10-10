$(document).ready(function () {
    // --- API CONFIG (외부 API) ---
    const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
    const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
    const TMDB_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2YjA3MGM5ODk0MTY0MTFhNTEzYzRjNmM3OGFmMDc2OSIsIm5iZiI6MTc0NzIxODk4NS44Miwic3ViIjoiNjgyNDcyMjk0OTMzZmUxNDU1MzMzZjM4Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.rBrd8bY3jM-JG5YfEsj_A6ApxP3KpzZQpw9yyGnRuUw';

    const KAKAO_API_BASE_URL = 'https://dapi.kakao.com/v3/search/book';
    const KAKAO_API_KEY = '41fc150e1acbe4e67e080a6c497099b2';

    const tmdbAxios = axios.create({
      baseURL: TMDB_API_BASE_URL,
      headers: { Authorization: `Bearer ${TMDB_BEARER_TOKEN}`, Accept: 'application/json' }
    });
    const kakaoAxios = axios.create({
      baseURL: KAKAO_API_BASE_URL,
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` }
    });

    // --- 내부(Flask) 댓글 API 헬퍼 ---
    // GET /reply/<post_id>
    async function apiFetchReplies(postId) {
      const res = await axios.get(`/reply/${postId}`);
      // 응답이 배열([])이거나 {items:[...]} 둘 다 허용
      //return Array.isArray(res.data) ? res.data : (res.data?.items || []);
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        console.log('[reply:list]', data); // ★ 서버가 내려주는 키 확인용
        return data;
    }
    // POST /reply
    async function apiCreateReply(data) {
      // data: { post_id, rating, text, is_spoiler, username, source }
      const res = await axios.post('/reply', data, {
        headers: { 'Content-Type': 'application/json' }
      });
      return res.data;
    }

    // --- STATE ---
    let searchType = 'movie'; // 'movie' | 'book'
    let currentPage = 1;
    let currentQuery = '';
    let comments = [];
    let revealedSpoilers = new Set();
    let commentSort = 'likes';
    let showSpoilers = false;
    let newUserRating = 0;
    let isLoading = false;

    // 현재 상세 컨텍스트 (댓글 API에 필요)
    let currentDetail = {
      postId: null,       // TMDB id or ISBN13
      source: null,       // 'movie' | 'book'
      title: null
    };

    // --- DOM ---
    const $searchPage = $('#search-page'),
      $detailsPage = $('#details-page'),
      $searchInput = $searchPage.find('.search-bar input'),
      $searchButton = $searchPage.find('.search-bar button'),
      $placeholder = $('.placeholder'),
      $resultsGrid = $('.results-grid'),
      $pagination = $('.pagination'),
      $detailsContent = $('#details-page .details-content');

    // --- Icons ---
    const StarIcon = (size = 24, fill = "none", stroke = "currentColor") =>
      `<svg height="${size}" width="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="1.5"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
    const ThumbsUpIcon = (size = 16) =>
      `<svg height="${size}" width="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M18 10V5c0-1.1-.9-2-2-2s-2 .9-2 2v5h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4.5"/></svg>`;
    const ThumbsDownIcon = (size = 16) =>
      `<svg height="${size}" width="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14V2"/><path d="M18 14v5c0 1.1-.9-2-2-2s-2-.9-2-2v-5h3a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4.5"/></svg>`;

    const createStarRatingHTML = (rating, size = 24) => {
      let starsHTML = '';
      for (let i = 1; i <= 5; i++) {
        const fillPercent = i - rating <= 0 ? 100 : (i - rating < 1 ? (1 - (i - rating)) * 100 : 0);
        starsHTML += `
          <div style="position:relative;display:inline-block;">
            ${StarIcon(size, 'var(--surface-color)', 'var(--primary-color)')}
            <div style="position:absolute;top:0;left:0;width:${fillPercent}%;height:100%;overflow:hidden;">
              ${StarIcon(size, 'var(--primary-color)', 'var(--primary-color)')}
            </div>
          </div>`;
      }
      return `<div class="star-rating-display">${starsHTML}</div>`;
    };

    // --- UI helpers ---
    const showStatus = (page, message, isError = false) => {
      const $status = page === 'search' ? $searchPage.find('.status-message') : $detailsPage.find('.status-message');
      $status.text(message).toggleClass('error', isError).show();
      if (page === 'search') $placeholder.hide();
    };
    const hideStatus = (page) => {
      const $status = page === 'search' ? $searchPage.find('.status-message') : $detailsPage.find('.status-message');
      $status.hide();
    };
    const setLoading = (page, loading) => {
      isLoading = loading;
      $searchButton.prop('disabled', loading);
      if (loading) {
        showStatus(page, '데이터를 불러오는 중입니다...');
        if (page === 'search') { $resultsGrid.empty(); $pagination.empty(); }
      } else {
        hideStatus(page);
      }
    };

    // --- Results renderers ---
    const renderMovieResults = (movies) => {
      movies.forEach(item => {
        const posterStyle = item.poster_path ? `style="background-image:url(${TMDB_IMAGE_BASE_URL}${item.poster_path})"` : '';
        const coverContent = item.poster_path ? '' : '<span class="cover-placeholder">포스터 없음</span>';
        const card = $(`
          <div class="result-card" data-type="movie" data-id="${item.id}">
            <div class="cover" ${posterStyle}>${coverContent}</div>
            <div class="title">${item.title} (${(item.release_date || '').substring(0, 4)})</div>
          </div>`);
        $resultsGrid.append(card);
      });
    };

    const renderBookResults = (books) => {
      books.forEach(book => {
        const posterStyle = book.thumbnail ? `style="background-image:url(${book.thumbnail})"` : '';
        const coverContent = book.thumbnail ? '' : '<span class="cover-placeholder">표지 없음</span>';
        // Kakao isbn은 "ISBN10 ISBN13" 형식일 수 있음 → 뒤쪽을 사용
        const isbn = (book.isbn || '').split(' ').pop();
        const card = $(`
          <div class="result-card" data-type="book" data-id="${isbn}">
            <div class="cover" ${posterStyle}>${coverContent}</div>
            <div class="title">${book.title} - ${book.authors.join(', ')}</div>
          </div>`);
        $resultsGrid.append(card);
      });
    };

    const updatePagination = (meta, type) => {
      $pagination.empty();
      const totalPages = type === 'movie' ? meta.total_pages : Math.ceil((meta.pageable_count || 0) / 20);
      if (totalPages <= 1) return;

      const createPageItem = (pageNumber, text, isDisabled = false, isActive = false) => {
        const $li = $('<li>').addClass('page-item');
        if (isDisabled) $li.addClass('disabled');
        if (isActive) $li.addClass('active');
        const $a = $('<a>').addClass('page-link').text(text || pageNumber).on('click', (e) => {
          e.preventDefault();
          if (!isDisabled) handleSearch(null, pageNumber);
        });
        return $li.append($a);
      };

      $pagination.append(createPageItem(currentPage - 1, '이전', currentPage === 1));

      for (let i = 1; i <= Math.min(totalPages, 500); i++) { // TMDB max 500
        if (i === currentPage) $pagination.append(createPageItem(i, null, false, true));
        else if (i >= currentPage - 2 && i <= currentPage + 2) $pagination.append(createPageItem(i));
      }

      $pagination.append(createPageItem(currentPage + 1, '다음', currentPage >= totalPages));
    };

    // --- Details renderers ---
    const renderMovieDetailsPage = (details) => {
      comments = [];
      revealedSpoilers.clear();
      const ratingOutOf5 = details.vote_average / 2;
      const posterUrl = details.poster_path ? `${TMDB_IMAGE_BASE_URL}${details.poster_path}` : '';
      const detailsHTML = `
        <div class="details-container">
          <div class="details-poster">
            ${posterUrl ? `<img src="${posterUrl}" alt="${details.title} poster">` : `<div class="cover"><span class="cover-placeholder">포스터 없음</span></div>`}
          </div>
          <div class="details-main-content">
            <h2>${details.title}</h2>
            <p class="meta">${details.release_date} • ${details.genres.map(g => g.name).join(', ')}</p>
            <div class="rating-wrapper">
              ${createStarRatingHTML(ratingOutOf5, 32)}
              <span class="rating-text">${ratingOutOf5.toFixed(1)} / 5.0 (${details.vote_count} votes)</span>
            </div>
            <div class="details-info">
              <h3>개요</h3>
              <p>${details.overview || '제공된 개요 정보가 없습니다.'}</p>
            </div>

            <div class="comments-section">
              <h3 id="comment-count">댓글 (0)</h3>
              <form class="comment-form" id="comment-form">
                <div class="comment-form-header">
                  <p>감상평</p>
                  <span>별점을 선택해주세요.</span>
                </div>
                <div class="star-rating-input">
                  ${[...Array(5)].map((_, i) => `<span data-rating="${i + 1}">${StarIcon(32, 'none', 'var(--primary-color)')}</span>`).join('')}
                </div>
                <div class="comment-input-container">
                  <textarea placeholder="감상평을 작성해주세요." class="comment-textarea" rows="3"></textarea>
                  <button type="submit">등록</button>
                </div>
                <div class="comment-form-options">
                  <label class="spoiler-toggle">
                    <input type="checkbox" class="new-comment-spoiler" />
                    <span class="slider"></span>
                    <span class="label-text">스포일러 포함</span>
                  </label>
                </div>
              </form>

              <div class="comment-controls">
                <div class="sort-options">

                </div>
                <label class="spoiler-toggle">
                  <input type="checkbox" class="show-spoilers-toggle" ${showSpoilers ? 'checked' : ''}/>
                  <span class="slider"></span>
                  <span class="label-text">스포일러 포함</span>
                </label>
              </div>
              <div class="comment-list"></div>
            </div>
          </div>
        </div>`;
      $detailsContent.html(detailsHTML);

      // 현재 상세 컨텍스트 기록 (댓글 API용)
      currentDetail = { postId: String(details.id), source: 'movie', title: details.title };

      // 서버에서 댓글 불러오기
      loadCommentsFromServer();
    };

    const renderBookDetailsPage = (book) => {
      comments = [];
      revealedSpoilers.clear();
      const posterUrl = book.thumbnail || '';
      const detailsHTML = `
        <div class="details-container">
          <div class="details-poster">
            ${posterUrl ? `<img src="${posterUrl}" alt="${book.title} cover">` : `<div class="cover"><span class="cover-placeholder">표지 없음</span></div>`}
          </div>
          <div class="details-main-content">
            <h2>${book.title}</h2>
            <p class="meta">${book.authors.join(', ')} • ${book.publisher} (${book.datetime.substring(0,10)})</p>

            <div class="details-info book">
              <h3>소개</h3>
              <p>${book.contents || '제공된 소개 정보가 없습니다.'}</p>
            </div>

            <div class="comments-section">
              <h3 id="comment-count">댓글 (0)</h3>
              <form class="comment-form" id="comment-form">
                <div class="comment-form-header">
                  <p>감상평</p>
                  <span>별점을 선택해주세요.</span>
                </div>
                <div class="star-rating-input">
                  ${[...Array(5)].map((_, i) => `<span data-rating="${i + 1}">${StarIcon(32, 'none', 'var(--primary-color)')}</span>`).join('')}
                </div>
                <div class="comment-input-container">
                  <textarea placeholder="감상평을 작성해주세요." class="comment-textarea" rows="3"></textarea>
                  <button type="submit">등록</button>
                </div>
                <div class="comment-form-options">
                  <label class="spoiler-toggle">
                    <input type="checkbox" class="new-comment-spoiler" />
                    <span class="slider"></span>
                    <span class="label-text">스포일러 포함</span>
                  </label>
                </div>
              </form>

              <div class="comment-controls">
                <div class="sort-options">
            
                </div>
                <label class="spoiler-toggle">
                  <input type="checkbox" class="show-spoilers-toggle"/>
                  <span class="slider"></span>
                  <span class="label-text">스포일러 포함</span>
                </label>
              </div>
              <div class="comment-list"></div>
            </div>
          </div>
        </div>`;
      $detailsContent.html(detailsHTML);

      // 현재 상세 컨텍스트 기록 (댓글 API용)
      const isbn13 = (book.isbn || '').split(' ').pop();
      currentDetail = { postId: String(isbn13), source: 'book', title: book.title };

      // 서버에서 댓글 불러오기
      loadCommentsFromServer();
    };

    // 서버에서 댓글 불러오기 + 렌더
    async function loadCommentsFromServer() {
      if (!currentDetail.postId) return;
      try {
        const list = await apiFetchReplies(currentDetail.postId);
        // 서버 응답을 내부 모델로 매핑
       
        comments = list.map((c) => ({
          username:  'anonymous',
          text: c.text ?? c[2] ?? '',
          rating: Number(c[3] ?? c.score ?? 0),
          isSpoiler: Boolean(c[4] ?? c.isSpoiler ?? false),
          timestamp: c[5] || c.timestamp || ''
        }));
        renderComments();
        $('#comment-count').text(`댓글 (${comments.length})`);
      } catch (e) {
        showStatus('details', `댓글을 불러오는 중 오류가 발생했습니다: ${e?.response?.data?.message || e.message}`, true);
      }
    }

    const renderComments = () => {
      const sorted = [...comments];
      

      const $commentList = $detailsPage.find('.comment-list');
      $commentList.empty();

      if (sorted.length === 0) {
        $commentList.html('<p class="no-comments">아직 댓글이 없습니다. 첫 감상평을 남겨보세요!</p>');
        return;
      }

      sorted.forEach((comment) => {
        const originalIndex = comments.indexOf(comment);
        const isSpoilerHidden = comment.isSpoiler && !showSpoilers && !revealedSpoilers.has(originalIndex);
        const commentHTML = `
          <div class="comment-item" data-original-index="${originalIndex}">
            <div class="comment-header">
              ${createStarRatingHTML(comment.rating, 16)}
              <span class="comment-rating-value">${Number(comment.rating || 0).toFixed(1)}</span>
            </div>
            ${isSpoilerHidden
              ? `<div class="spoiler-warning"><p>스포일러가 포함된 감상평입니다.</p><button class="reveal-spoiler-btn">감상평보기</button></div>`
              : `<p class="comment-text">${escapeHtml(comment.text || '')}</p>`
            }
            <div class="comment-meta">
              <span>${escapeHtml(comment.username || 'anonymous')}</span> •
              <span>${escapeHtml(comment.timestamp || '')}</span> •
              <a href="#" class="report-btn">신고</a>
            </div>
            <div class="comment-actions">
             
            </div>
          </div>`;
        $commentList.append(commentHTML);
      });
    };

    // XSS 방지용 간단 escape
    function escapeHtml(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    // --- External search calls ---
    const searchMovies = async (query, page) => {
      const response = await tmdbAxios.get('/search/movie', {
        params: { query, include_adult: false, language: 'ko-KR', page }
      });
      renderMovieResults(response.data.results);
      updatePagination(response.data, 'movie');
    };

    const searchBooks = async (query, page) => {
      const response = await kakaoAxios.get('', {
        params: { query, target: 'title', page, size: 20 }
      });
      renderBookResults(response.data.documents);
      updatePagination(response.data.meta, 'book');
    };

    const handleSearch = async (e, page = 1) => {
      if (e) e.preventDefault();
      const query = $searchInput.val().trim();
      if (!query && !currentQuery) { showStatus('search', "검색어를 입력해주세요.", true); return; }
      currentPage = page;
      currentQuery = query || currentQuery;
      setLoading('search', true);
      try {
        if (searchType === 'movie') await searchMovies(currentQuery, currentPage);
        else await searchBooks(currentQuery, currentPage);
        $placeholder.hide();
      } catch (err) {
        const message = err.response?.data?.message || err.message;
        showStatus('search', `검색 중 오류가 발생했습니다: ${message}`, true);
      } finally {
        setLoading('search', false);
      }
    };

    const fetchMovieDetails = async (movieId) => {
      setLoading('details', true);
      $detailsContent.empty();
      try {
        const response = await tmdbAxios.get(`/movie/${movieId}`, { params: { language: 'ko-KR' } });
        renderMovieDetailsPage(response.data);
      } catch (err) {
        showStatus('details', `상세 정보를 불러오는 중 오류가 발생했습니다: ${err.message}`, true);
      } finally {
        setLoading('details', false);
      }
    };

    const fetchBookDetails = async (isbn) => {
        console.log("불러옴")
      setLoading('details', true);
      $detailsContent.empty();
      try {
        const response = await kakaoAxios.get('', { params: { query: isbn, target: 'isbn', size: 1 } });
        if (response.data.documents.length > 0) renderBookDetailsPage(response.data.documents[0]);
        else showStatus('details', '해당 ISBN의 책을 찾을 수 없습니다.', true);
      } catch (err) {
        showStatus('details', `상세 정보를 불러오는 중 오류가 발생했습니다: ${err.message}`, true);
      } finally {
        setLoading('details', false);
      }
    };

    // --- Event listeners (검색/토글/카드 클릭) ---
    $('.search-form').on('submit', handleSearch);
    $('.search-type-toggle').on('click', 'button', function () {
      const $btn = $(this);
      searchType = $btn.data('type');
      $('.search-type-toggle button').removeClass('active');
      $btn.addClass('active');
      $searchInput.attr('placeholder', searchType === 'movie' ? '영화 제목을 검색하세요...' : '도서 제목을 검색하세요...');
    });
    $resultsGrid.on('click', '.result-card', function () {
      const type = $(this).data('type');
      const id = $(this).data('id');
      window.location.hash = `details/${type}/${id}`;
    });
    $('.back-button').on('click', () => { window.location.hash = ''; });

    // --- 댓글 상호작용 (상세 내부 위임) ---
    $detailsContent
      // 별점 hover/선택
      .on('mouseenter', '.star-rating-input span', function () {
        const rating = $(this).data('rating');
        $('.star-rating-input span').each(function () {
          $(this).find('svg').attr('fill', $(this).data('rating') <= rating ? 'var(--primary-color)' : 'none');
        });
      })
      .on('mouseleave', '.star-rating-input', function () {
        $('.star-rating-input span').each(function () {
          $(this).find('svg').attr('fill', $(this).data('rating') <= newUserRating ? 'var(--primary-color)' : 'none');
        });
      })
      .on('click', '.star-rating-input span', function () {
        newUserRating = $(this).data('rating');
      })

      // 댓글 등록 → 서버 저장
      .on('submit', '#comment-form', async function (e) {
        e.preventDefault();
        const text = ($('.comment-textarea').val() || '').trim();
        const isSpoiler = $('.new-comment-spoiler').is(':checked');
        if (!text || newUserRating === 0) {
          alert('별점과 감상평을 모두 입력해주세요.');
          return;
        }
        try {
          await apiCreateReply({
            post_id: currentDetail.postId,
            rating: newUserRating,
            text,
            is_spoiler: isSpoiler,
            // 임시 사용자명(로그인 안 썼을 때), 필요 없다면 서버에서 무시
            username: `user${Math.floor(Math.random() * 9000) + 1000}`,
            source: currentDetail.source
          });
          // 입력 초기화
          this.reset();
          newUserRating = 0;
          $('.star-rating-input span svg').attr('fill', 'none');
          // 목록 새로고침
          await loadCommentsFromServer();
          $('#comment-count').text(`댓글 (${comments.length})`);
        } catch (err) {
          const msg = err?.response?.data?.message || err.message;
          alert('댓글 저장 중 오류가 발생했습니다: ' + msg);
        }
      })

      // 정렬/스포일러 토글
      .on('click', '.sort-btn', function () {
        commentSort = $(this).data('sort');
        $('.sort-btn').removeClass('active');
        $(this).addClass('active');
        renderComments();
      })
      .on('change', '.show-spoilers-toggle', function () {
        showSpoilers = $(this).is(':checked');
        if (!showSpoilers) revealedSpoilers.clear();
        renderComments();
      })
      .on('click', '.reveal-spoiler-btn', function () {
        const originalIndex = $(this).closest('.comment-item').data('original-index');
        revealedSpoilers.add(originalIndex);
        renderComments();
      })
      // 공감/비공감(클라이언트 내 가짜 증가만)
      .on('click', '.like-btn, .dislike-btn', function () {
        const $item = $(this).closest('.comment-item');
        const idx = $item.data('original-index');
        const action = $(this).hasClass('like-btn') ? 'likes' : 'dislikes';
        const alreadyVoted = $item.data(`voted-${action}`);
        if (!alreadyVoted) {
          comments[idx][action] = (comments[idx][action] || 0) + 1;
          $item.data(`voted-${action}`, true);
          renderComments();
        }
      })
      .on('click', '.report-btn', (e) => { e.preventDefault(); alert('신고 기능은 구현되지 않았습니다.'); });

    // --- Routing ---
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('details/')) {
        const [, type, id] = hash.split('/');
        $searchPage.hide();
        $detailsPage.show();
        if (type === 'movie') fetchMovieDetails(id);
        else if (type === 'book') fetchBookDetails(id);
      } else {
        $detailsPage.hide();
        $searchPage.show();
        $detailsContent.empty();
        comments = [];
        newUserRating = 0;
        currentDetail = { postId: null, source: null, title: null };
      }
    };

    $(window).on('hashchange', handleHashChange);
    handleHashChange(); // initial
  });