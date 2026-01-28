document.getElementById('searchBtn').addEventListener('click', performSearch);
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) return;

    const resultsList = document.getElementById('resultsList');
    const loading = document.getElementById('loading');

    resultsList.innerHTML = '';
    loading.classList.remove('hidden');

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
        const data = await response.json();
        loading.classList.add('hidden');

        if (!data || data.length === 0) {
            resultsList.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:5rem; opacity:0.5">未找到资源</div>';
            return;
        }

        data.forEach(item => {
            const el = createMovieItem(item);
            resultsList.appendChild(el);
        });
    } catch (error) {
        loading.classList.add('hidden');
    }
}

function createMovieItem(item) {
    const div = document.createElement('div');
    div.className = 'movie-item';
    
    // 获取默认播放的第一集 (通常排序后取第一集)
    const sortedEps = [...item.episodes].sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/) || 0);
        const numB = parseInt(b.name.match(/\d+/) || 0);
        return numA - numB;
    });
    
    const defaultEp = sortedEps[0];
    const defaultUrl = defaultEp ? defaultEp.url : '';
    
    div.onclick = () => {
        if (!defaultUrl) {
            alert('抱歉大人，该资源暂无有效播放线路');
            return;
        }
        const playUrl = `/play?id=${item.id}&src=${encodeURIComponent(item.source_name)}&url=${encodeURIComponent(defaultUrl)}`;
        window.location.href = playUrl;
    };
    
    div.innerHTML = `
        <div class="poster-con">
            <img class="movie-poster" src="${item.poster}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Poster'">
            <div class="movie-badge">${item.source_tip}</div>
        </div>
        <div class="movie-name">${item.title}</div>
    `;
    return div;
}

function showDetail(item) {
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const meta = document.getElementById('modalMeta');
    const epsCon = document.getElementById('modalEps');

    title.innerText = item.title;
    meta.innerText = `${item.category} | 来源: ${item.source_name}`;
    
    epsCon.innerHTML = '';
    
    // 排序
    const sortedEps = [...item.episodes].sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/) || 0);
        const numB = parseInt(b.name.match(/\d+/) || 0);
        return numA - numB;
    });

    sortedEps.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = 'ep-btn';
        btn.innerText = ep.name;
        btn.onclick = () => {
            const playUrl = `/play?id=${item.id}&src=${encodeURIComponent(item.source_name)}&url=${encodeURIComponent(ep.url)}`;
            window.location.href = playUrl;
        };
        epsCon.appendChild(btn);
    });

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('链接已复制');
    });
}
