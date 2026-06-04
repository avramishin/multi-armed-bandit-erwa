const form = document.getElementById('simulation-form');
const summaryCards = document.getElementById('summary-cards');
const runsTableBody = document.getElementById('runs-table-body');
const statusBadge = document.getElementById('status-badge');
const runMeta = document.getElementById('run-meta');
const chartWrap = document.querySelector('.chart-wrap');
const chartCanvas = document.getElementById('pnl-chart');
const chartContext = chartCanvas.getContext('2d');
const chartTooltip = document.getElementById('chart-tooltip');
const ACTION_COLORS = {
  BUY: '#0b7a53',
  SELL: '#b3452f',
  IDLE: '#d39218',
};
let currentChartPoints = [];
let chartMetrics = null;

function setStatus(mode, text) {
  statusBadge.className = `status ${mode}`;
  statusBadge.textContent = text;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatCandleTime(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function getUtcDayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function getUtcWeekday(timestamp) {
  return new Date(timestamp).getUTCDay();
}

function isWeekendUtc(timestamp) {
  const weekday = getUtcWeekday(timestamp);
  return weekday === 0 || weekday === 6;
}

function getPointX(index, length, left, right) {
  return left + (index / Math.max(length - 1, 1)) * (right - left);
}

function getPointY(value, min, max, top, bottom) {
  const range = max - min || 1;
  return bottom - ((value - min) / range) * (bottom - top);
}

function hideTooltip() {
  chartTooltip.classList.add('hidden');
}

function showTooltip(point, x, y) {
  const actionColor = ACTION_COLORS[point.action] || '#fff8ec';
  chartTooltip.innerHTML = `
    <div class="tooltip-title">
      <span>Step ${point.index + 1}</span>
      <span class="tooltip-action" style="color: ${actionColor};">${point.action}</span>
    </div>
    <div class="tooltip-row"><span>Свеча</span><span>${formatCandleTime(point.timestamp)}</span></div>
    <div class="tooltip-row"><span>Price</span><span>${formatMoney(point.close)}</span></div>
    <div class="tooltip-row"><span>Reward</span><span>${formatNumber(point.reward)}</span></div>
    <div class="tooltip-row"><span>Step PNL</span><span>${formatMoney(point.stepPnl)}</span></div>
    <div class="tooltip-row"><span>Cumulative PNL</span><span>${formatMoney(point.cumulativePnl)}</span></div>
  `;

  chartTooltip.classList.remove('hidden');
  const tooltipWidth = chartTooltip.offsetWidth;
  const tooltipHeight = chartTooltip.offsetHeight;
  const wrapWidth = chartWrap.clientWidth;
  const wrapHeight = chartWrap.clientHeight;
  const padding = 12;

  const clampedX = Math.min(
    Math.max(x, tooltipWidth / 2 + padding),
    wrapWidth - tooltipWidth / 2 - padding,
  );
  const clampedY = Math.min(
    Math.max(y, tooltipHeight + 24),
    wrapHeight - padding,
  );

  chartTooltip.style.left = `${clampedX}px`;
  chartTooltip.style.top = `${clampedY}px`;
}

function renderSummary(summary, id) {
  const cards = [
    ['Run ID', `#${id}`],
    ['Final Balance', formatMoney(summary.finalBalance)],
    ['Total PNL', formatMoney(summary.totalPnl)],
    ['Fees', formatMoney(summary.totalFees)],
    ['Инвестиции', formatMoney(summary.tradeSizeUsd)],
    ['Плечо', `${formatNumber(summary.leverage)}x`],
    ['Комиссия', `${formatNumber(summary.commissionPercent)}%`],
  ];

  summaryCards.innerHTML = cards
    .map(([label, value]) => {
      const signed = label === 'Total PNL';
      const numeric = signed ? Number(summary.totalPnl) : 0;
      const tone = signed ? (numeric >= 0 ? 'positive' : 'negative') : '';
      return `
        <article class="summary-card">
          <span class="label">${label}</span>
          <span class="value ${tone}">${value}</span>
        </article>
      `;
    })
    .join('');

  runMeta.textContent = `${summary.symbol} • ${summary.candleInterval} • ${summary.candlesCount} candles • ${formatMoney(summary.tradeSizeUsd)} • ${formatNumber(summary.leverage)}x • fee ${formatNumber(summary.commissionPercent)}% • learn ${summary.learningRate.toFixed(2)} • curiosity ${summary.epsilon.toFixed(2)}`;
}

function renderRunsTable(runs) {
  if (!runs.length) {
    runsTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">История пока пуста</td></tr>';
    return;
  }

  runsTableBody.innerHTML = runs
    .map((run) => {
      const pnlClass = Number(run.totalPnl) >= 0 ? 'positive' : 'negative';
      return `
        <tr data-run-id="${run.id}">
          <td>#${run.id}</td>
          <td>${run.symbol}</td>
          <td>${run.candleInterval || '1h'}</td>
          <td class="${pnlClass}">${formatMoney(run.totalPnl)}</td>
          <td>${formatMoney(run.finalBalance)}</td>
          <td>${formatNumber(run.learningRate)}</td>
          <td>${formatNumber(run.epsilon)}</td>
          <td>${new Date(run.createdAt).toLocaleString()}</td>
        </tr>
      `;
    })
    .join('');

}

function resizeChartCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const wrapStyles = window.getComputedStyle(chartWrap);
  const horizontalPadding =
    Number.parseFloat(wrapStyles.paddingLeft) +
    Number.parseFloat(wrapStyles.paddingRight);
  const verticalPadding =
    Number.parseFloat(wrapStyles.paddingTop) +
    Number.parseFloat(wrapStyles.paddingBottom);
  const width = Math.max(320, Math.floor(chartWrap.clientWidth - horizontalPadding));
  const height = Math.max(240, Math.floor(chartWrap.clientHeight - verticalPadding));

  chartCanvas.width = Math.floor(width * dpr);
  chartCanvas.height = Math.floor(height * dpr);
  chartCanvas.style.width = `${width}px`;
  chartCanvas.style.height = `${height}px`;
  chartContext.setTransform(1, 0, 0, 1, 0, 0);
  chartContext.scale(dpr, dpr);
}

function drawChart(points) {
  currentChartPoints = points;
  resizeChartCanvas();
  const width = chartCanvas.clientWidth;
  const height = chartCanvas.clientHeight;
  const topPadding = 36;
  const sidePadding = 30;
  const bottomPadding = 78;
  const chartBottom = height - bottomPadding;
  const actionLaneTop = height - 42;
  const actionLaneHeight = 14;
  chartMetrics = {
    width,
    height,
    topPadding,
    sidePadding,
    chartBottom,
  };

  chartContext.clearRect(0, 0, width, height);

  if (!points.length) {
    hideTooltip();
    chartContext.fillStyle = '#6d604f';
    chartContext.font = '16px Manrope';
    chartContext.fillText('Нет данных для графика', sidePadding, height / 2);
    return;
  }

  const values = points.map((point) => point.cumulativePnl);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);

  chartContext.strokeStyle = 'rgba(60, 43, 17, 0.12)';
  chartContext.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = topPadding + ((chartBottom - topPadding) / 3) * i;
    chartContext.beginPath();
    chartContext.moveTo(sidePadding, y);
    chartContext.lineTo(width - sidePadding, y);
    chartContext.stroke();
  }

  const daySegments = [];
  let segmentStartIndex = 0;

  for (let index = 1; index <= points.length; index += 1) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];
    const isBoundary =
      index === points.length ||
      getUtcDayKey(previousPoint.timestamp) !== getUtcDayKey(currentPoint.timestamp);

    if (isBoundary) {
      daySegments.push({
        startIndex: segmentStartIndex,
        endIndex: index - 1,
        timestamp: previousPoint.timestamp,
      });
      segmentStartIndex = index;
    }
  }

  daySegments.forEach((segment) => {
    const startX = getPointX(
      segment.startIndex,
      points.length,
      sidePadding,
      width - sidePadding,
    );
    const endX = getPointX(
      Math.min(segment.endIndex + 1, points.length - 1),
      points.length,
      sidePadding,
      width - sidePadding,
    );

    if (isWeekendUtc(segment.timestamp)) {
      chartContext.fillStyle = 'rgba(211, 146, 24, 0.08)';
      chartContext.fillRect(
        startX,
        topPadding,
        Math.max(2, endX - startX),
        chartBottom - topPadding,
      );
    }

    if (getUtcWeekday(segment.timestamp) === 1) {
      chartContext.save();
      chartContext.setLineDash([4, 6]);
      chartContext.strokeStyle = 'rgba(60, 43, 17, 0.22)';
      chartContext.lineWidth = 1;
      chartContext.beginPath();
      chartContext.moveTo(startX, topPadding);
      chartContext.lineTo(startX, chartBottom);
      chartContext.stroke();
      chartContext.restore();
    }
  });

  const baselineY = getPointY(0, min, max, topPadding, chartBottom);
  chartContext.save();
  chartContext.setLineDash([6, 6]);
  chartContext.strokeStyle = 'rgba(211, 146, 24, 0.9)';
  chartContext.lineWidth = 1.5;
  chartContext.beginPath();
  chartContext.moveTo(sidePadding, baselineY);
  chartContext.lineTo(width - sidePadding, baselineY);
  chartContext.stroke();
  chartContext.restore();

  chartContext.strokeStyle = values[values.length - 1] >= 0 ? '#0b7a53' : '#b3452f';
  chartContext.lineWidth = 3;
  chartContext.beginPath();

  points.forEach((point, index) => {
    const x = getPointX(index, points.length, sidePadding, width - sidePadding);
    const y = getPointY(point.cumulativePnl, min, max, topPadding, chartBottom);

    if (index === 0) {
      chartContext.moveTo(x, y);
    } else {
      chartContext.lineTo(x, y);
    }
  });

  chartContext.stroke();

  points.forEach((point, index) => {
    const x = getPointX(index, points.length, sidePadding, width - sidePadding);
    const y = getPointY(point.cumulativePnl, min, max, topPadding, chartBottom);

    chartContext.fillStyle = ACTION_COLORS[point.action] || '#1d150b';
    chartContext.beginPath();
    chartContext.arc(x, y, 2.75, 0, Math.PI * 2);
    chartContext.fill();
  });

  chartContext.fillStyle = 'rgba(60, 43, 17, 0.08)';
  chartContext.fillRect(sidePadding, actionLaneTop, width - sidePadding * 2, actionLaneHeight);

  points.forEach((point, index) => {
    const x = getPointX(index, points.length, sidePadding, width - sidePadding);
    const nextX = getPointX(index + 1, points.length, sidePadding, width - sidePadding);
    const barWidth = Math.max(2, nextX - x);

    chartContext.fillStyle = ACTION_COLORS[point.action] || '#1d150b';
    chartContext.fillRect(x, actionLaneTop, barWidth, actionLaneHeight);
  });

  chartContext.fillStyle = '#6d604f';
  chartContext.font = '12px Manrope';
  chartContext.fillText(`max ${formatMoney(max)}`, sidePadding, topPadding - 12);
  chartContext.fillText(`min ${formatMoney(min)}`, sidePadding, actionLaneTop - 10);
  chartContext.fillText('Базовый депозит', sidePadding, baselineY - 8);
  chartContext.fillText('UTC: weekend shading, week separators', width - 250, topPadding - 12);
  chartContext.fillText('Actions', sidePadding, actionLaneTop - 28);

  const legend = [
    ['BUY', ACTION_COLORS.BUY],
    ['SELL', ACTION_COLORS.SELL],
    ['IDLE', ACTION_COLORS.IDLE],
  ];

  legend.forEach(([label, color], index) => {
    const x = sidePadding + index * 92;
    const y = height - 14;

    chartContext.fillStyle = color;
    chartContext.fillRect(x, y - 10, 16, 8);
    chartContext.fillStyle = '#6d604f';
    chartContext.fillText(label, x + 22, y - 2);
  });
}

function syncSliderOutputs() {
  document.querySelectorAll('[data-output-for]').forEach((output) => {
    const input = form.elements.namedItem(output.dataset.outputFor);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    output.textContent = Number(input.value).toFixed(2);
  });
}

function findClosestPoint(clientX) {
  if (!currentChartPoints.length || !chartMetrics) {
    return null;
  }

  const rect = chartCanvas.getBoundingClientRect();
  const xInCanvas = ((clientX - rect.left) / rect.width) * chartMetrics.width;
  const { sidePadding, width } = chartMetrics;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  currentChartPoints.forEach((_, index) => {
    const pointX = getPointX(index, currentChartPoints.length, sidePadding, width - sidePadding);
    const distance = Math.abs(pointX - xInCanvas);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return { point: currentChartPoints[closestIndex], index: closestIndex };
}

chartCanvas.addEventListener('mousemove', (event) => {
  const match = findClosestPoint(event.clientX);
  if (!match) {
    hideTooltip();
    return;
  }

  const values = currentChartPoints.map((point) => point.cumulativePnl);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pointX = getPointX(
    match.index,
    currentChartPoints.length,
    chartMetrics.sidePadding,
    chartMetrics.width - chartMetrics.sidePadding,
  );
  const pointY = getPointY(
    match.point.cumulativePnl,
    min,
    max,
    chartMetrics.topPadding,
    chartMetrics.chartBottom,
  );
  showTooltip(match.point, pointX + 18, pointY + 18);
});

chartCanvas.addEventListener('mouseleave', () => {
  hideTooltip();
});

async function loadRuns() {
  const response = await fetch('/api/simulation/runs');
  if (!response.ok) {
    throw new Error('Failed to load runs');
  }

  const runs = await response.json();
  renderRunsTable(runs);
}

async function loadRun(id) {
  const response = await fetch(`/api/simulation/runs/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load run ${id}`);
  }

  const run = await response.json();
  renderSummary(run, run.id);
  drawChart(run.points);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('running', 'Running');

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch('/api/simulation/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        symbol: payload.symbol,
        candleInterval: payload.candleInterval,
        historySize: Number(payload.historySize),
        initialDeposit: Number(payload.initialDeposit),
        tradeSizeUsd: Number(payload.tradeSizeUsd),
        leverage: Number(payload.leverage),
        commissionPercent: Number(payload.commissionPercent),
        learningRate: Number(payload.learningRate),
        epsilon: Number(payload.epsilon),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Simulation failed');
    }

    const result = await response.json();
    renderSummary(result, result.id);
    drawChart(result.points);
    await loadRuns();
    setStatus('idle', 'Idle');
  } catch (error) {
    setStatus('error', 'Error');
    runMeta.textContent = error.message;
  }
});

runsTableBody.addEventListener('click', async (event) => {
  const row = event.target.closest('[data-run-id]');
  if (!row) {
    return;
  }

  try {
    setStatus('running', 'Loading');
    await loadRun(row.dataset.runId);
    setStatus('idle', 'Idle');
  } catch (error) {
    setStatus('error', 'Error');
    runMeta.textContent = error.message;
  }
});

form.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'range') {
    syncSliderOutputs();
  }
});

window.addEventListener('resize', () => {
  drawChart(currentChartPoints);
});

setStatus('idle', 'Idle');
syncSliderOutputs();
drawChart([]);
loadRuns().catch((error) => {
  setStatus('error', 'Error');
  runMeta.textContent = error.message;
});
