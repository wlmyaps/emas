// script.js - VERSI FINAL SUDAH DIPERBAIKI
const csvUrl = 'https://raw.githubusercontent.com/wlmyaps/kurs/main/Data%20Historis%20GAU_IDR.csv';
let masterData = [];
let priceChart = null; // DEKLARASI GLOBAL

// ==================== LOAD DATA ====================
function loadData() {
    console.log("Mencoba memuat data dari:", csvUrl);
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        delimiter: ',',
        skipEmptyLines: true,
        complete: function(results) {
            console.log('Data berhasil dimuat, jumlah baris:', results.data.length);
            masterData = results.data.map(row => {
                if (!row.Tanggal) return null;
                const dateParts = row.Tanggal.split('/');
                const formattedDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
                if (isNaN(formattedDate)) return null;
                const cleanNumber = (str) => {
                    if (!str || str === '') return NaN;
                    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
                };
                return {
                    ...row,
                    TanggalObj: formattedDate,
                    Tanggal: row.Tanggal,
                    Terakhir: cleanNumber(row.Terakhir),
                    Pembukaan: cleanNumber(row.Pembukaan),
                    Tertinggi: cleanNumber(row.Tertinggi),
                    Terendah: cleanNumber(row.Terendah),
                    Perubahan: cleanNumber(row['Perubahan%'])
                };
            }).filter(row => row && !isNaN(row.Terakhir) && !isNaN(row.TanggalObj));
            
            console.log('Data siap:', masterData.length, 'entri');
            if (masterData.length > 0) {
                // Set default range 60 HARI TERAKHIR
                const lastDate = masterData[0].TanggalObj;
                const firstDate = masterData[masterData.length-1].TanggalObj;
                const defaultStart = new Date(lastDate);
                defaultStart.setDate(defaultStart.getDate() - 60);
                const startDateForInput = defaultStart > firstDate ? defaultStart : firstDate;
                document.getElementById('startDate').value = startDateForInput.toISOString().split('T')[0];
                document.getElementById('endDate').value = lastDate.toISOString().split('T')[0];
                analyzeData();
            } else {
                alert('Data CSV kosong atau tidak valid!');
            }
        },
        error: function(error) {
            console.error('Gagal memuat CSV:', error);
            alert('Gagal memuat data CSV.\nError: ' + (error.message || 'Unknown error'));
        }
    });
}

// ==================== FILTER TANGGAL ====================
function getDataByDateRange(startDateStr, endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return masterData.filter(row => row.TanggalObj >= start && row.TanggalObj <= end);
}

// ==================== 1. STREAK ====================
function displayStreakMetrics(data) {
    let longestCloseDown = 0, currentCloseDown = 0;
    let longestCloseUp = 0, currentCloseUp = 0;
    let longestOpenDown = 0, currentOpenDown = 0;
    let longestOpenUp = 0, currentOpenUp = 0;
    let sumDailyChanges = 0, changeCount = 0;

    for (let i = 0; i < data.length; i++) {
        const close = data[i].Terakhir;
        const open = data[i].Pembukaan;
        if (i > 0) {
            const prevClose = data[i-1].Terakhir;
            const dailyChange = ((close - prevClose) / prevClose) * 100;
            sumDailyChanges += dailyChange;
            changeCount++;
            if (close < prevClose) { currentCloseDown++; currentCloseUp = 0; }
            else if (close > prevClose) { currentCloseUp++; currentCloseDown = 0; }
            else { currentCloseDown = 0; currentCloseUp = 0; }
            longestCloseDown = Math.max(longestCloseDown, currentCloseDown);
            longestCloseUp = Math.max(longestCloseUp, currentCloseUp);
            
            if (open < prevClose) { currentOpenDown++; currentOpenUp = 0; }
            else if (open > prevClose) { currentOpenUp++; currentOpenDown = 0; }
            else { currentOpenDown = 0; currentOpenUp = 0; }
            longestOpenDown = Math.max(longestOpenDown, currentOpenDown);
            longestOpenUp = Math.max(longestOpenUp, currentOpenUp);
        }
    }
    const avgChange = changeCount > 0 ? (sumDailyChanges / changeCount).toFixed(2) : 0;
    document.getElementById('streak-metrics').innerHTML = `
        <div class="metric-value"><span class="badge">📉</span> Close Turun Terlama: <strong>${longestCloseDown} hari</strong> beruntun</div>
        <div class="metric-value"><span class="badge">📈</span> Close Naik Terlama: <strong>${longestCloseUp} hari</strong> beruntun</div>
        <div class="metric-value"><span class="badge">🔽</span> Open Turun Terlama: <strong>${longestOpenDown} hari</strong> beruntun</div>
        <div class="metric-value"><span class="badge">🔼</span> Open Naik Terlama: <strong>${longestOpenUp} hari</strong> beruntun</div>
        <div class="metric-value"><span class="badge">📊</span> Rata-rata Perubahan (AvgØ): <strong>${avgChange}%</strong></div>
    `;
}

// ==================== 2. VOLATILITAS ====================
function displayVolatilityMetrics(data) {
    let totalSpike = 0, maxSpike = 0, maxSpikeDate = '';
    for (const row of data) {
        const spike = row.Tertinggi - row.Terendah;
        totalSpike += spike;
        if (spike > maxSpike) { maxSpike = spike; maxSpikeDate = row.Tanggal; }
    }
    const avgSpike = data.length > 0 ? totalSpike / data.length : 0;
    document.getElementById('volatility-metrics').innerHTML = `
        <div class="metric-value"><span class="badge">⚡</span> Rata-rata Gejolak Harian: <strong>Rp ${avgSpike.toLocaleString('id-ID')}</strong> / gram</div>
        <div class="metric-value"><span class="badge">🌋</span> Hari Paling Liar (Max Spike): <strong>${maxSpikeDate}</strong> (Selisih Rp ${maxSpike.toLocaleString('id-ID')})</div>
    `;
}

// ==================== 3. PERILAKU HARI ====================
function displayDayBehaviorMetrics(data) {
    const dayStats = {
        'Senin': { up: 0, total: 0 }, 'Selasa': { up: 0, total: 0 },
        'Rabu': { up: 0, total: 0 }, 'Kamis': { up: 0, total: 0 }, 'Jumat': { up: 0, total: 0 }
    };
    for (const row of data) {
        const dayName = row.TanggalObj.toLocaleDateString('id-ID', { weekday: 'long' });
        if (dayStats[dayName]) {
            dayStats[dayName].total++;
            if (row.Perubahan > 0) dayStats[dayName].up++;
        }
    }
    let maxUpDay = { name: '', percentage: 0 };
    let maxDownDay = { name: '', percentage: 0 };
    for (const [day, stats] of Object.entries(dayStats)) {
        if (stats.total > 0) {
            const upPercentage = (stats.up / stats.total) * 100;
            const downPercentage = ((stats.total - stats.up) / stats.total) * 100;
            if (upPercentage > maxUpDay.percentage) maxUpDay = { name: day, percentage: upPercentage };
            if (downPercentage > maxDownDay.percentage) maxDownDay = { name: day, percentage: downPercentage };
        }
    }
    document.getElementById('day-behavior-metrics').innerHTML = `
        <div class="metric-value"><span class="badge">📈</span> Hari dengan Kecenderungan Naik: <strong>${maxUpDay.name}</strong> (${maxUpDay.percentage.toFixed(1)}% dari total hari ${maxUpDay.name})</div>
        <div class="metric-value"><span class="badge">📉</span> Hari dengan Kecenderungan Turun: <strong>${maxDownDay.name}</strong> (${maxDownDay.percentage.toFixed(1)}% dari total hari ${maxDownDay.name})</div>
        <div class="metric-value"><span class="badge">💡</span> <small>Data dihitung berdasarkan persentase perubahan harga harian (Close vs Close sebelumnya).</small></div>
    `;
}

// ==================== 4. GAP ====================
function displayGapMetrics(data) {
    let totalGap = 0, gapCount = 0;
    for (let i = 1; i < data.length; i++) {
        totalGap += data[i].Pembukaan - data[i-1].Terakhir;
        gapCount++;
    }
    const avgGap = gapCount > 0 ? totalGap / gapCount : 0;
    document.getElementById('gap-metrics').innerHTML = `
        <div class="metric-value"><span class="badge">🏃</span> Rata-rata Lompatan Pagi (Open vs Close kemarin): <strong>Rp ${avgGap.toLocaleString('id-ID')}</strong></div>
        <div class="metric-value"><span class="badge">📝</span> <small>Nilai positif berarti harga pembukaan lebih tinggi dari penutupan sebelumnya (Gap Up), negatif sebaliknya (Gap Down).</small></div>
    `;
}

// ==================== 5. GRAFIK (CLOSE + OPEN) ====================
function displayPriceChart(data) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    const labels = data.map(row => row.Tanggal);
    const pricesClose = data.map(row => row.Terakhir);
    const pricesOpen = data.map(row => row.Pembukaan);
    const changes = data.map(row => row.Perubahan);
    
    if (priceChart) priceChart.destroy();
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Harga Penutupan (Close)', data: pricesClose, borderColor: 'rgb(44, 62, 102)', backgroundColor: 'rgba(44, 62, 102, 0.05)', tension: 0.3, fill: false },
                { label: 'Harga Pembukaan (Open)', data: pricesOpen, borderColor: 'rgb(220, 120, 60)', backgroundColor: 'rgba(220, 120, 60, 0.05)', tension: 0.3, fill: false, borderDash: [5, 5] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: true, interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: Rp ${context.raw.toLocaleString('id-ID')}` } } }
        }
    });
    
    document.getElementById('viewPriceBtn').onclick = () => {
        if (priceChart) {
            priceChart.data.datasets = [
                { label: 'Harga Penutupan (Close)', data: pricesClose, borderColor: 'rgb(44, 62, 102)', tension: 0.3, fill: false },
                { label: 'Harga Pembukaan (Open)', data: pricesOpen, borderColor: 'rgb(220, 120, 60)', tension: 0.3, fill: false, borderDash: [5, 5] }
            ];
            priceChart.options.plugins.tooltip.callbacks.label = (context) => `${context.dataset.label}: Rp ${context.raw.toLocaleString('id-ID')}`;
            priceChart.update();
        }
    };
    document.getElementById('viewChangeBtn').onclick = () => {
        if (priceChart) {
            priceChart.data.datasets = [{
                label: 'Perubahan Harian (%)', data: changes, borderColor: 'rgb(220, 38, 38)', backgroundColor: 'rgba(220, 38, 38, 0.05)', tension: 0.3, fill: false
            }];
            priceChart.options.plugins.tooltip.callbacks.label = (context) => `${context.raw.toFixed(2)}%`;
            priceChart.update();
        }
    };
}

// ==================== 6. DISTRIBUSI HARGA ====================
function displayDistributionMetrics(data) {
    const prices = data.map(row => row.Terakhir);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const binCount = 10;
    const binSize = (maxPrice - minPrice) / binCount;
    const bins = Array(binCount).fill().map((_, i) => ({ min: minPrice + i * binSize, max: minPrice + (i + 1) * binSize, count: 0 }));
    for (const price of prices) {
        for (const bin of bins) { if (price >= bin.min && price <= bin.max) { bin.count++; break; } }
    }
    let maxBin = bins.reduce((max, bin) => bin.count > max.count ? bin : max, { count: 0 });
    let html = '<ul style="margin:0; padding-left:1.2rem;">';
    for (const bin of bins) {
        if (bin.count > 0) {
            html += `<li>Rp ${bin.min.toLocaleString('id-ID', {maximumFractionDigits:0})} - Rp ${bin.max.toLocaleString('id-ID', {maximumFractionDigits:0})}: <strong>${bin.count} hari</strong>${bin === maxBin ? ' (Zona Konsolidasi Terkuat)' : ''}</li>`;
        }
    }
    html += '</ul>';
    document.getElementById('distribution-metrics').innerHTML = html;
}

// ==================== 7. EKSTREM ====================
function displayExtremeValues(data) {
    let maxPrice = -Infinity, maxDate = '';
    let minPrice = Infinity, minDate = '';
    for (const row of data) {
        if (row.Terakhir > maxPrice) { maxPrice = row.Terakhir; maxDate = row.Tanggal; }
        if (row.Terakhir < minPrice) { minPrice = row.Terakhir; minDate = row.Tanggal; }
    }
    document.getElementById('extreme-values').innerHTML = `
        <div class="metric-value"><span class="badge">🏔️</span> Harga Termahal (Peak): <strong>Rp ${maxPrice.toLocaleString('id-ID')}</strong><br><small>Terjadi pada: ${maxDate}</small></div>
        <div class="metric-value"><span class="badge">🌊</span> Harga Termurah (Bottom): <strong>Rp ${minPrice.toLocaleString('id-ID')}</strong><br><small>Terjadi pada: ${minDate}</small></div>
    `;
}

// ==================== 8. GEJOLAK SEARAH ====================
function displayDirectionalVolatility(data) {
    let upDaySpikes = 0, upDayCount = 0;
    let downDaySpikes = 0, downDayCount = 0;
    for (const row of data) {
        const spike = row.Tertinggi - row.Terendah;
        if (row.Perubahan > 0) { upDaySpikes += spike; upDayCount++; }
        else if (row.Perubahan < 0) { downDaySpikes += spike; downDayCount++; }
    }
    const avgUpVol = upDayCount > 0 ? upDaySpikes / upDayCount : 0;
    const avgDownVol = downDayCount > 0 ? downDaySpikes / downDayCount : 0;
    document.getElementById('direction-volatility').innerHTML = `
        <div class="metric-value"><span class="badge">📗</span> Rata-rata gejolak saat Bursa HIJAU (Naik): <strong>Rp ${avgUpVol.toLocaleString('id-ID')}</strong> / hari</div>
        <div class="metric-value"><span class="badge">📕</span> Rata-rata gejolak saat Bursa MERAH (Turun): <strong>Rp ${avgDownVol.toLocaleString('id-ID')}</strong> / hari</div>
        <div class="metric-value"><span class="badge">🧠</span> Analisis: ${avgDownVol > avgUpVol ? 'Gejolak saat MERAH lebih besar → Indikasi potensi kepanikan pasar (panic selling) saat harga turun.' : 'Gejolak lebih tinggi saat pasar HIJAU, menunjukkan antusiasme pembeli yang fluktuatif.'}</div>
    `;
}

// ==================== 9. TABEL DATA ====================
function displayDataTable(data) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rowsToShow = data.slice(0, 500);
    for (const row of rowsToShow) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="padding: 6px 8px;">${row.Tanggal}</td>
            <td style="padding: 6px 8px; text-align: right;">${row.Terakhir.toLocaleString('id-ID')}</td>
            <td style="padding: 6px 8px; text-align: right;">${row.Pembukaan.toLocaleString('id-ID')}</td>
            <td style="padding: 6px 8px; text-align: right;">${row.Tertinggi.toLocaleString('id-ID')}</td>
            <td style="padding: 6px 8px; text-align: right;">${row.Terendah.toLocaleString('id-ID')}</td>
            <td style="padding: 6px 8px; text-align: right; color: ${row.Perubahan >= 0 ? 'green' : 'red'}">${row.Perubahan.toFixed(2)}%</td>
        `;
        tbody.appendChild(tr);
    }
    if (data.length > 500) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="padding: 8px; text-align: center;">... dan ${data.length - 500} baris lainnya (hanya 500 pertama ditampilkan)</td>`;
        tbody.appendChild(tr);
    }
}

// ==================== ANALISIS UTAMA ====================
function analyzeData() {
    let startDate = document.getElementById('startDate').value;
    let endDate = document.getElementById('endDate').value;
    if (new Date(startDate) > new Date(endDate)) {
        alert('Tanggal “Dari” harus lebih awal dari “Sampai”! Otomatis dibalik.');
        [startDate, endDate] = [endDate, startDate];
        document.getElementById('startDate').value = startDate;
        document.getElementById('endDate').value = endDate;
    }
    const filteredData = getDataByDateRange(startDate, endDate);
    if (filteredData.length === 0) {
        alert('Tidak ada data dalam rentang tanggal yang dipilih.');
        return;
    }
    console.log(`Menganalisis ${filteredData.length} data dari ${startDate} sampai ${endDate}`);
    displayStreakMetrics(filteredData);
    displayVolatilityMetrics(filteredData);
    displayDayBehaviorMetrics(filteredData);
    displayGapMetrics(filteredData);
    displayPriceChart(filteredData);
    displayDistributionMetrics(filteredData);
    displayExtremeValues(filteredData);
    displayDirectionalVolatility(filteredData);
    displayDataTable(filteredData); // <-- PANGGIL TABEL
}

// ==================== START ====================
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    document.getElementById('analyzeBtn').addEventListener('click', analyzeData);
});
