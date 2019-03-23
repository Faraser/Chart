window.oncontextmenu = function() {
    return false;
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const canvas2 = document.getElementById('canvas2')
const ctx2 = canvas2.getContext('2d');

const CANVAS_WIDTH = canvas.width / 2;
const CANVAS_HEIGTH = canvas.height / 2;
const plotHeight = canvas.height - 60;

const win = document.getElementById('win');
const winRightButton = document.getElementById('win__right');
const winLeftButton = document.getElementById('win__left');
const winFillerLeft = document.getElementById('win__filler-left');
const winFillerRight = document.getElementById('win__filler-right');

const chartData = prepareData(data);

function prepareData(data) {
    const rawData = data[0];

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

const controls = document.querySelector('.controls');
controls.addEventListener('change', e => {
    console.log(e.target.dataset.index, e.target.checked);
    const index = e.target.dataset.index;
    chartData.y[index].isVisible = e.target.checked;
    drawWin(chartData);
});


let startX = 0;
let currentTransform = 0;
let winTransform = 0;
let winWidth = win.clientWidth;
const minWinWidth = 30;
const maxWinWidth = canvas.width / 2;

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
        console.log(newTransform, newWidth)
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

function drawWin(chartData) {
    const yPointsGroup = chartData.y
        .filter(yData => yData.isVisible)
        .map(yData => yData.yPoints);

    const { min, max } = calcYAxes(yPointsGroup);

    ctx2.clearRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
    for (let i = 0; i < yPointsGroup.length; i++) {
        drawWinPlot(ctx2, yPointsGroup[i], max, max - min, chartData.y[i].color);
    }
}

drawWin(chartData);

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
    const visibleYValuesGroup = chartData.y
        .filter(yData => yData.isVisible)
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
        console.log('should animate');
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

        // console.log('animate');
    }

    // console.log(visiblePoints.length)
    // TODO: разбить рендер цифер и линий
    drawYAxis(animState, delta);

    for (let i = 0; i < visibleYValuesGroup.length; i++) {
        const visibleYValue = visibleYValuesGroup[i];
        const color = chartData.y[i].color;
        drawPlot(ctx, visibleXValues, visibleYValue, min, max, horizontalOffset, horizontalStepMultiplier, color);
    }

    drawXAxis(ctx, points, visibleStartPoint, visibleEndPoint, visibleStart, visibleEnd);
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

    for (let i = 0; i <= steps * 2; i++) {
        const index = start + pointsPerStep * i;
        if (index > points.length - 1) continue;
        const date = new Date(points[index]);
        const text = monthNames[date.getMonth()] + ' ' + date.getDate();
        const opacity = i % 2 === 1 ? 1 - changeScaleProgress : 1;
        ctx.fillStyle = `rgba(148,148,152, ${opacity})`;

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

    // TODO решить проблему отступа и последней точки
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

function roundByModuleUp(val, mod) {
    const tmp = val % mod;
    return tmp === 0 ? val : (val - tmp + mod)
}

function roundByModuleDown(val, mod) {
    const tmp = val % mod;
    return tmp === 0 ? val : (val - tmp)
}

function clamp(min, max, value) {
    return Math.min(Math.max(value, min), max);
}

function nearestDegreeOf2(val) {
    return Math.floor(Math.log(val) / Math.log(2));
}

function drawYAxis(animState, delta) {
    ctx.lineWidth = 1;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    const { currentAxis, preventAxis } = animState;
    const step = plotHeight / currentAxis.steps;
    const xPadding = 24;

    // Render new
    ctx.strokeStyle = `rgba(215,215,219, ${delta})`;
    ctx.fillStyle = `rgba(148,148,152, ${delta})`;
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
    ctx.strokeStyle = `rgba(215,215,219, ${reverseDelta})`;
    ctx.fillStyle = `rgba(148,148,152, ${reverseDelta})`;

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

function drawWinPlot(ctx, points, maxValue, diffValue, color) {
    const canvas = ctx.canvas;
    const verticalPadding = 10;

    const horizontalStep = canvas.width / (points.length - 1);
    const maxHeight = canvas.height - verticalPadding;
    const verticalOffset = (canvas.height - maxHeight) / 2;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.moveTo(0, 0);
    ctx.strokeStyle = color;
    points.forEach((point, i) => {
        const yCoord = ((maxValue - point) / diffValue) * maxHeight + verticalOffset;
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

    var calculateOrderOfMagnitude = function(val) {
            return Math.floor(Math.log(val) / Math.LN10);
        },
        maxSteps = 6,
        maxValue = Math.max.apply(Math, valuesArray),
        minValue = Math.min.apply(Math, valuesArray),

        valueRange = Math.abs(maxValue - minValue),
        rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange),

        graphMax = Math.ceil(maxValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude),
        graphMin = Math.floor(minValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude),
        graphRange = graphMax - graphMin,
        stepValue = Math.round(graphRange / maxSteps);

    return {
        steps: maxSteps,
        stepValue: stepValue,
        min: graphMin,
        max: graphMin + (maxSteps * stepValue)
    };
}

transform = CANVAS_WIDTH - winWidth;
winTransform = transform;
currentTransform = transform;
win.style.transform = `translateX(${transform}px)`;

render();
