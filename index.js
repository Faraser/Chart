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
const navWindow = document.querySelector('.chart__navigation-window');
const navWindowRightControl = document.querySelector('.chart__navigation-control_right');
const navWindowLeftControl = document.querySelector('.chart__navigation-control_left');
const navWindowLeftFiller = document.querySelector('.chart__navigation-filler_left');
const navWindowRightFiller = document.querySelector('.chart__navigation-filler_right');

let isNightTheme = false;
const switcher = document.querySelector('.chart__switcher');
switcher.addEventListener('click', e => {
    e.preventDefault();
    chart.classList.toggle('chart_theme_night');
    isNightTheme = !isNightTheme;
});

const getTextColor = (opacity) => isNightTheme ?
                                  `rgba(65, 86, 106, ${opacity})` :
                                  `rgba(148,148,152, ${opacity})`;
const getLineColor = (opacity) => isNightTheme ?
                                  `rgba(42, 54, 68, ${opacity})` :
                                  `rgba(242, 244, 245, ${opacity})`;

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
    drawNavigation(chartData, 1, true);
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

const minNavWindowWidth = 30;
let maxNavWindowWidth = canvas.width / 2;

let navWindowWidth = navWindow.clientWidth;
let transform = 0;

let startX = 0;
let beforeDragTransform = 0;

// Handle nav window drag
navWindow.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
});

navWindow.addEventListener('touchmove', e => {
    let x = e.changedTouches[0].clientX;
    const diffX = x - startX;
    transform = clamp(0, CANVAS_WIDTH - navWindowWidth, beforeDragTransform + diffX);

    navWindow.style.transform = `translateX(${transform}px)`;
    updateFillers(transform, navWindowWidth);
});

navWindow.addEventListener('touchend', e => {
    beforeDragTransform = transform;
});

function updateFillers(transform, navWindowWidth) {
    navWindowLeftFiller.style.width = `${Math.ceil(transform)}px`;
    navWindowRightFiller.style.width = `${Math.ceil(CANVAS_WIDTH - navWindowWidth - transform)}px`;
}

// Handle nav controls drag
let startControlX = 0;
let beforeDragNavWindowWidth = navWindowWidth;

const onTouchStart = e => {
    startControlX = e.changedTouches[0].clientX;
    beforeDragNavWindowWidth = navWindowWidth;
};
navWindowRightControl.addEventListener('touchstart', onTouchStart);
navWindowLeftControl.addEventListener('touchstart', onTouchStart);
navWindowRightControl.addEventListener('touchmove', e => {
    e.stopPropagation();
    let x = e.changedTouches[0].clientX;
    const diffX = x - startControlX;
    const newWidth = clamp(minNavWindowWidth, maxNavWindowWidth - transform, beforeDragNavWindowWidth + diffX);
    navWindow.style.width = Math.ceil(newWidth) + 'px';
    updateFillers(transform, navWindowWidth);
    navWindowWidth = newWidth;
});

navWindowLeftControl.addEventListener('touchmove', e => {
    e.stopPropagation();
    let x = e.changedTouches[0].clientX;
    const diffX = startControlX - x;

    let newWidth = beforeDragNavWindowWidth + diffX;
    let newTransform = beforeDragTransform - diffX;

    // if сrossed right side
    if (newWidth <= minNavWindowWidth) {
        newWidth = minNavWindowWidth;
        newTransform = Math.min(CANVAS_WIDTH - minNavWindowWidth, newTransform)
    }

    // if crossed left side
    if (newTransform < 0) {
        newWidth += newTransform;
        newTransform = 0;
    }

    navWindow.style.width = Math.ceil(newWidth) + 'px';
    navWindow.style.transform = `translateX(${Math.ceil(newTransform)}px)`;
    updateFillers(transform, navWindowWidth);

    transform = newTransform;
    navWindowWidth = newWidth;
});

navWindowLeftControl.addEventListener('touchend', e => {
    beforeDragTransform = transform;
});

const drawNavigation = function() {
    let prevMin, prevMax, prevVisibleChartCount, isNavigationAnimate;

    return function drawNavigation(chartData, delta, forceRepaint) {
        const yDataGroup = chartData.y
            .filter(yData => yData.isVisible);

        // Avoid unnecessary repaints
        if (prevVisibleChartCount === yDataGroup.length && !isNavigationAnimate && !forceRepaint) return;

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
}();

const maxAnimationTime = 300;

const render = function() {
    let prevAxis;
    let animationStartTime = performance.now();
    let isAnimate = false;
    let animState;

    return function() {
        const points = chartData.x;
        const visibleStart = points.length * transform / CANVAS_WIDTH;
        const visibleStartPoint = Math.max(Math.floor(visibleStart), 0);
        const horizontalOffset = visibleStart % 1;

        const visibleEnd = points.length * navWindowWidth / CANVAS_WIDTH;
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

        const { startX, horizontalStep } = calcStartAndStep(ctx, visibleXValues, horizontalOffset, horizontalStepMultiplier);

        // TODO: divide render by numbers and lines
        drawYAxis(animState, delta);

        for (let i = 0; i < visibleYValuesGroup.length; i++) {
            const visibleYValue = visibleYValuesGroup[i];
            const color = visibleYGroup[i].color;
            drawPlot(ctx, visibleXValues, visibleYValue, min, max, startX, horizontalStep, color);
        }

        drawXAxis(ctx, points, visibleStartPoint, visibleEndPoint, visibleStart, visibleEnd, startX, horizontalStep);

        drawNavigation(chartData, delta);
        requestAnimationFrame(render);
    }
}();

function calcStartAndStep(ctx, visibleXPoints, horizontalOffset, horizontalStepMultiplier) {
    const canvas = ctx.canvas;
    const horizontalPrevStep = (canvas.width) / (visibleXPoints.length - 3);
    const horizontalNextStep = (canvas.width) / (visibleXPoints.length - 2);
    const horizontalStep = lerp(horizontalPrevStep, horizontalNextStep, horizontalStepMultiplier);

    const startX = horizontalStep * horizontalOffset * -1;

    return { startX, horizontalStep };
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

function drawXAxis(ctx, points, start, end, visibleStart, visibleLen, startHorizontal, horizontalStep) {
    const prevStart = start;
    const steps = 5;
    const visibleCount = end - start;

    const pointsPerStep = Math.max(calcXScale(visibleCount, steps), 2);

    const currentScaleThreshold = steps * (pointsPerStep + 1);
    const nextScaleThreshold = steps * (pointsPerStep * 2 + 1);
    let changeScaleProgress = reverseLerp(currentScaleThreshold, nextScaleThreshold, visibleLen);

    start = start - start % (pointsPerStep * 2);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startX = (start - prevStart) * horizontalStep + startHorizontal;

    ctx.textAlign = 'center';
    ctx.font = "24px sans-serif";

    for (let i = 0; i <= steps * 2 + 4; i++) {
        const index = start + pointsPerStep * i;
        if (index > points.length - 1) continue;
        const date = new Date(points[index]);
        const text = monthNames[date.getMonth()] + ' ' + date.getDate();
        const opacity = i % 2 === 1 ? 1 - changeScaleProgress : 1;
        ctx.fillStyle = getTextColor(opacity);

        const xCoord = startX + i * pointsPerStep * horizontalStep;
        ctx.fillText(text, xCoord, canvas.height - 10);
    }
}

function drawPlot(ctx,
                  visibleXPoints, visibleYValues,
                  min, max,
                  startX, horizontalStep,
                  color) {
    const maxHeight = plotHeight;
    const startY = maxHeight - reverseLerp(min, max, visibleYValues[0]) * maxHeight;

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
    }

    ctx.stroke();
}

function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

function reverseLerp(a, b, t) {
    return (t - a) / (b - a);
}

function clamp(min, max, value) {
    return Math.min(Math.max(value, min), max);
}

function drawYAxis(animState, delta) {
    ctx.lineWidth = 2;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    const { currentAxis, preventAxis } = animState;
    const step = plotHeight / currentAxis.steps;
    const xPadding = 24;

    // Render new
    ctx.strokeStyle = getLineColor(delta);
    ctx.fillStyle = getTextColor(delta);
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
    ctx.strokeStyle = getLineColor(reverseDelta);
    ctx.fillStyle = getTextColor(reverseDelta);

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
    maxNavWindowWidth = CANVAS_WIDTH;
    navWindowWidth = clamp(0, maxNavWindowWidth, navWindowWidth);
    transform = CANVAS_WIDTH - navWindowWidth;
    beforeDragTransform = transform;

    navWindow.style.transform = `translateX(${transform}px)`;
    navWindow.style.width = navWindowWidth + 'px';

    updateFillers(transform, navWindowWidth);
    drawNavigation(chartData, 1, true)
}

window.addEventListener('resize', resize);

resize();
render();
