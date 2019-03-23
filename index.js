window.oncontextmenu = function() {
    return false;
};

const canvas = document.querySelector('.chart__main-canvas');
const ctx = canvas.getContext('2d');

const navCanvas = document.querySelector('.chart__navigation-canvas');
const navCtx = navCanvas.getContext('2d');

let CANVAS_WIDTH = canvas.width / 2;
const plotHeight = canvas.height - 60;

const chart = document.querySelector('.chart');
const win = document.querySelector('.chart__navigation-window');
const winRightButton = document.querySelector('.chart__navigation-control_right');
const winLeftButton = document.querySelector('.chart__navigation-control_left');
const winFillerLeft = document.querySelector('.chart__navigation-filler_left');
const winFillerRight = document.querySelector('.chart__navigation-filler_right');

let isNightTheme = false;
const switcher = document.querySelector('.chart__switcher');
switcher.addEventListener('click', e => {
    e.preventDefault();
    chart.classList.toggle('chart_theme_night');
    isNightTheme = !isNightTheme;
});

const getLineColor = (opacity) => isNightTheme ?
                                  `rgba(65, 86, 106, ${opacity})` :
                                  `rgba(148,148,152, ${opacity})`;

let chartData = prepareData(data, 0);

function prepareData(data, index) {
    const rawData = data[index];

    const xPoints = rawData.columns[0].slice(1);
    const yData = [];

    for (let i = 1; i < rawData.columns.length; i++) {
        const id = rawData.columns[i][0];
        const yPoints = rawData.columns[i].slice(1);
        const color = rawData.colors[id];
        const name = rawData.names[id];
        yData.push({ yPoints, color, name, isVisible: true })
    }

    return {
        x: xPoints,
        y: yData
    }
}

const select = document.querySelector('.chart__select');
select.addEventListener('change', e => {
    chartData = prepareData(data, e.target.value);
    createControls(chartData);
});

function createControls(chartData) {
    const controls = document.querySelector('.chart__controls');
    const icon = document.querySelector('.icon-storage').innerHTML;
    let html = '';
    for (let i = 0; i < chartData.y.length; i++) {
        const name = chartData.y[i].name;
        const color = chartData.y[i].color;
        html += `<label class="chart__controls-button">
            <input class="chart__controls-checkbox" type="checkbox" data-index="${i}" checked hidden>
            <div class="chart__controls-icon" style="fill:${color};color: ${color}">${icon}</div>${name}</label>
        `;
    }
    controls.innerHTML = html;
}

createControls(chartData);

const controls = document.querySelector('.chart__controls');
controls.addEventListener('change', e => {
    const visibleChartCount = chartData.y.reduce((acc, cur) => cur.isVisible ? acc + 1 : acc, 0);
    const shouldVisible = e.target.checked;

    // Disable chart toggle if it last visible chart
    if (visibleChartCount < 2 && !shouldVisible) {
        e.preventDefault();
        e.target.checked = !shouldVisible;
        return;
    }

    const index = e.target.dataset.index;
    chartData.y[index].isVisible = shouldVisible;
});

let startX = 0;
let currentTransform = 0;
let winTransform = 0;
let winWidth = win.clientWidth;
const minWinWidth = 30;
let maxWinWidth = canvas.width / 2;

let transform = 0;

function updateFillers(transform, winWidth) {
    winFillerLeft.style.width = `${Math.ceil(transform)}px`;
    winFillerRight.style.width = `${Math.ceil(CANVAS_WIDTH - winWidth - transform)}px`;
}

win.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
});

win.addEventListener('touchmove', e => {
    let x = e.changedTouches[0].clientX;
    const diffX = x - startX;
    transform = Math.max(0, currentTransform + diffX);
    transform = Math.min(transform, canvas.width / 2 - winWidth);

    win.style.transform = `translateX(${transform}px)`;
    updateFillers(transform, winWidth);

    winTransform = transform
});

win.addEventListener('touchend', e => {
    currentTransform = transform;
});

let startButtonX = 0;
let prevWinWidth = winWidth;
const onTouchStart = e => {
    startButtonX = e.changedTouches[0].clientX;
    prevWinWidth = winWidth;
};
winRightButton.addEventListener('touchstart', onTouchStart);
winLeftButton.addEventListener('touchstart', onTouchStart);
winRightButton.addEventListener('touchmove', e => {
    e.stopPropagation();
    let x = e.changedTouches[0].clientX;
    const diffX = x - startButtonX;
    const newWidth = clamp(minWinWidth, maxWinWidth - transform, prevWinWidth + diffX);
    win.style.width = Math.ceil(newWidth) + 'px';
    updateFillers(transform, winWidth);
    winWidth = newWidth;
});

winLeftButton.addEventListener('touchmove', e => {
    e.stopPropagation();
    let x = e.changedTouches[0].clientX;
    const diffX = startButtonX - x;

    let newWidth = prevWinWidth + diffX;
    let newTransform = currentTransform - diffX;

    // Если упираемся в правую плашку
    if (newWidth <= minWinWidth) {
        newWidth = minWinWidth;
        newTransform = Math.min(CANVAS_WIDTH - minWinWidth, newTransform)
    }

    // Если упираемся в левый угол
    if (newTransform < 0) {
        newWidth += newTransform;
        newTransform = 0;
    }

    win.style.width = Math.ceil(newWidth) + 'px';
    win.style.transform = `translateX(${Math.ceil(newTransform)}px)`;
    updateFillers(transform, winWidth);

    transform = newTransform;
    winWidth = newWidth;
});

winLeftButton.addEventListener('touchend', e => {
    currentTransform = transform;
});

var prevMin, prevMax, prevVisibleChartCount, isNavigationAnimate;

function drawWin(chartData, delta) {
    const yDataGroup = chartData.y
        .filter(yData => yData.isVisible);

    // Avoid unnecessary repaints
    if (prevVisibleChartCount === yDataGroup.length && !isNavigationAnimate) return;

    prevVisibleChartCount = yDataGroup.length;

    let { min, max } = calcYAxes(yDataGroup.map(yData => yData.yPoints));

    if (prevMin === undefined) {
        prevMin = min;
        prevMax = max;
        prevVisibleChartCount = yDataGroup.length;
    }

    if (!isNavigationAnimate && (prevMin !== min || prevMax !== max)) {
        isNavigationAnimate = true;
    }

    if (isNavigationAnimate) {
        min = lerp(prevMin, min, delta);
        max = lerp(prevMax, max, delta);

    }

    if (isNavigationAnimate && delta >= 1) {
        prevMin = min;
        prevMax = max;
        isNavigationAnimate = false;
    }

    navCtx.clearRect(0, 0, navCtx.canvas.width, navCtx.canvas.height);
    for (let i = 0; i < yDataGroup.length; i++) {
        const yData = yDataGroup[i];
        drawWinPlot(navCtx, yData.yPoints, max, min, yData.color);
    }
}

var prevAxis;
var animationStartTime = performance.now();
var maxAnimationTime = 300;
var isAnimate = false;

var animState;

function render() {
    const points = chartData.x;
    const visibleStart = points.length * transform / CANVAS_WIDTH;
    const visibleStartPoint = Math.max(Math.floor(visibleStart), 0);
    const horizontalOffset = visibleStart % 1;

    const visibleEnd = points.length * winWidth / CANVAS_WIDTH;
    const visibleEndPoint = Math.min(visibleStartPoint + Math.ceil(visibleEnd), points.length);
    const horizontalStepMultiplier = visibleEnd >= points.length ? 1 : visibleEnd % 1;

    const visibleXValues = points.slice(visibleStartPoint, visibleEndPoint);
    const visibleYGroup = chartData.y.filter(yData => yData.isVisible);
    const visibleYValuesGroup = visibleYGroup
        .map(yData => yData.yPoints.slice(visibleStartPoint, visibleEndPoint));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let axis = calcYAxes(visibleYValuesGroup);
    let { min, max } = axis;

    if (!animState) {
        animState = {
            startMin: axis.min,
            startMax: axis.max,
            endMin: axis.min,
            endMax: axis.max,
            currentAxis: axis,
            preventAxis: axis,
        }
    }

    if (!prevAxis) prevAxis = axis;

    // Should animate
    if ((prevAxis.min !== axis.min || prevAxis.max !== axis.max) && !isAnimate) {
        animState = {
            startMin: prevAxis.min,
            startMax: prevAxis.max,
            endMin: axis.min,
            endMax: axis.max,
            currentAxis: axis,
            preventAxis: prevAxis,
        };
        animationStartTime = performance.now();
        prevAxis = axis;
        isAnimate = true;
    }

    let delta = 1;
    if (isAnimate) {
        const diffTime = performance.now() - animationStartTime;
        delta = Math.min(diffTime / maxAnimationTime, 1);
        if (delta >= 1) {
            isAnimate = false;
        }

        min = lerp(animState.startMin, animState.endMin, delta);
        max = lerp(animState.startMax, animState.endMax, delta);

        if (prevAxis.min !== axis.min || prevAxis.max !== axis.max) {
            animState = {
                startMin: min,
                startMax: max,
                endMin: axis.min,
                endMax: axis.max,
                currentAxis: axis,
                preventAxis: prevAxis,
            };
            animationStartTime = performance.now();
            prevAxis = axis;
            isAnimate = true;
        }
    }

    // TODO: divide render by numbers and lines
    drawYAxis(animState, delta);

    for (let i = 0; i < visibleYValuesGroup.length; i++) {
        const visibleYValue = visibleYValuesGroup[i];
        const color = visibleYGroup[i].color;
        drawPlot(ctx, visibleXValues, visibleYValue, min, max, horizontalOffset, horizontalStepMultiplier, color);
    }

    drawXAxis(ctx, points, visibleStartPoint, visibleEndPoint, visibleStart, visibleEnd);

    drawWin(chartData, delta);
    requestAnimationFrame(render);
}

function calcXScale(pointsCount, maxSteps) {
    let scale = 1;
    while (scale < Math.floor(pointsCount / maxSteps)) {
        scale = scale * 2;
    }

    if (scale > 1) {
        scale = scale / 2;
    }

    return scale
}

function drawXAxis(ctx, points, start, end, visibleStart, visibleLen) {
    const prevStart = start;
    const steps = 6;
    const visibleCount = end - start;

    const pointsPerStep = Math.max(calcXScale(visibleCount, steps), 2);

    const currentScaleThreshold = steps * (pointsPerStep + 1);
    const nextScaleThreshold = steps * (pointsPerStep * 2 + 1);
    let changeScaleProgress = reverseLerp(currentScaleThreshold, nextScaleThreshold, visibleLen);

    start = start - start % (pointsPerStep * 2);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startX = (start - prevStart) * gHorizontalStep + gStartX;

    ctx.textAlign = 'center';
    ctx.font = "24px sans-serif";

    for (let i = 0; i <= steps * 2 + 1; i++) {
        const index = start + pointsPerStep * i;
        if (index > points.length - 1) continue;
        const date = new Date(points[index]);
        const text = monthNames[date.getMonth()] + ' ' + date.getDate();
        const opacity = i % 2 === 1 ? 1 - changeScaleProgress : 1;
        ctx.fillStyle = getLineColor(opacity);

        const xCoord = startX + i * pointsPerStep * gHorizontalStep;
        ctx.fillText(text, xCoord, canvas.height - 10);
    }
}

var gHorizontalStep;
var gStartX;

function drawPlot(ctx,
                  visibleXPoints, visibleYValues,
                  min, max,
                  horizontalOffset, horizontalStepMultiplier,
                  color) {
    const canvas = ctx.canvas;

    const horizontalPrevStep = (canvas.width) / (visibleXPoints.length - 3);
    const horizontalNextStep = (canvas.width) / (visibleXPoints.length - 2);
    const horizontalStep = lerp(horizontalPrevStep, horizontalNextStep, horizontalStepMultiplier);

    const maxHeight = plotHeight;

    const startX = horizontalStep * horizontalOffset * -1;
    const startY = maxHeight - reverseLerp(min, max, visibleYValues[0]) * maxHeight;

    gHorizontalStep = horizontalStep;
    gStartX = startX;

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(startX, startY);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;

    for (let i = 1; i < visibleXPoints.length; i++) {
        const xValue = visibleXPoints[i];
        const yValue = visibleYValues[i];

        if (xValue === 0) continue;

        const yCoord = maxHeight - reverseLerp(min, max, yValue) * maxHeight;
        const xCoord = startX + i * horizontalStep;
        ctx.lineTo(xCoord, yCoord);

        // Debugging output
        // ctx.fillStyle = 'red';
        // ctx.fillText(String(new Date(point[0]).getDate()), xCoord, yCoord - 20)
        // i % 16 === 0 && ctx.fillText(String(new Date(point[0]).getDate()), xCoord, maxHeight)
    }

    ctx.stroke();
}

function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

function reverseLerp(a, b, t) {
    return (t - a) / (b - a);
}

function remap(a, b, c, d, val) {
    return (d - c) * val / (b - a);
}

function clamp(min, max, value) {
    return Math.min(Math.max(value, min), max);
}

function drawYAxis(animState, delta) {
    ctx.lineWidth = 1;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    const { currentAxis, preventAxis } = animState;
    const step = plotHeight / currentAxis.steps;
    const xPadding = 24;

    // Render new
    const color = getLineColor(delta)
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    let stepMultiplier = (animState.endMax - animState.endMin) / (animState.startMax - animState.startMin);
    stepMultiplier = lerp(stepMultiplier, 1, delta);

    for (let i = 0; i < currentAxis.steps; i++) {
        let yCoord = plotHeight - step * i * stepMultiplier;

        ctx.beginPath();
        ctx.moveTo(xPadding, yCoord);
        ctx.fillText(currentAxis.min + currentAxis.stepValue * i, 20, yCoord - 10);
        ctx.lineTo(canvas.width - xPadding, yCoord);
        ctx.stroke();
    }

    // Render prev
    let reverseDelta = 1 - delta;
    const reverseColor = getLineColor(reverseDelta);
    ctx.strokeStyle = reverseColor;
    ctx.fillStyle = reverseColor;

    // TODO эта штука должна сжиматься, а сейчас поднимается вверх
    let reversedStepMultiplier = (animState.startMax - animState.startMin) / (animState.endMax - animState.endMin);
    reversedStepMultiplier = lerp(1, reversedStepMultiplier, delta);

    for (let i = 0; i < preventAxis.steps; i++) {
        let yCoord = plotHeight - step * i * reversedStepMultiplier;

        ctx.beginPath();
        ctx.moveTo(xPadding, yCoord);
        ctx.fillText(preventAxis.min + preventAxis.stepValue * i, 20, yCoord - 10);
        ctx.lineTo(canvas.width - xPadding, yCoord);
        ctx.stroke();
    }
}

function drawWinPlot(ctx, points, maxValue, minValue, color) {
    const canvas = ctx.canvas;
    const verticalPadding = 10;

    const horizontalStep = canvas.width / (points.length - 1);
    const maxHeight = canvas.height - verticalPadding;
    const verticalOffset = (canvas.height - maxHeight) / 2;

    const startY = ((maxValue - points[0]) / (maxValue - minValue)) * maxHeight + verticalOffset;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.moveTo(0, startY);
    ctx.strokeStyle = color;
    points.forEach((point, i) => {
        const yCoord = ((maxValue - point) / (maxValue - minValue)) * maxHeight + verticalOffset;
        const xCoord = i * horizontalStep;
        ctx.lineTo(xCoord, yCoord);
    });
    ctx.stroke();
}

function calcYAxes(visibleYValuesGroup) {
    const valuesArray = [];
    for (let i = 0; i < visibleYValuesGroup.length; i++) {
        const arr = visibleYValuesGroup[i];
        for (let j = 0; j < arr.length; j++) {
            valuesArray.push(arr[j]);
        }
    }

    const calculateOrderOfMagnitude = val => Math.floor(Math.log(val) / Math.LN10);

    const maxSteps = 6;
    const maxValue = Math.max.apply(Math, valuesArray);
    const minValue = Math.min.apply(Math, valuesArray);

    const valueRange = Math.abs(maxValue - minValue);
    const rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange);

    const graphMax = Math.ceil(maxValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude);
    const graphMin = Math.floor(minValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude);
    const graphRange = graphMax - graphMin;
    const stepValue = Math.round(graphRange / maxSteps);

    return {
        steps: maxSteps,
        stepValue: stepValue,
        min: graphMin,
        max: graphMin + (maxSteps * stepValue)
    };
}

function resizeCanvas(canvas) {
    const newWidth = window.innerWidth;

    canvas.width = newWidth * 2;
    canvas.style.width = newWidth + 'px';
}

function resize() {
    resizeCanvas(canvas);
    resizeCanvas(navCanvas);

    CANVAS_WIDTH = canvas.width / 2;
    maxWinWidth = CANVAS_WIDTH;
    transform = CANVAS_WIDTH - winWidth;
    winTransform = transform;
    currentTransform = transform;
    win.style.transform = `translateX(${transform}px)`;
    updateFillers(transform, winWidth);
    isNavigationAnimate = true;
}

window.addEventListener('resize', resize);

resize();

render();
