window.oncontextmenu = function() {
    return false;
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const canvas2 = document.getElementById('canvas2')
const ctx2 = canvas2.getContext('2d');

const CANVAS_WIDTH = canvas.width / 2;
const CANVAS_HEIGTH = canvas.height / 2;

const win = document.getElementById('win');
const winRightButton = document.getElementById('win__right');
const winLeftButton = document.getElementById('win__left');

const points = [];
const rawData = data[0].columns;

for (let i = 1; i < rawData[2].length; i++) {
    points.push([rawData[0][i], rawData[1][i]]);
}

console.log(points)

let startX = 0;
let currentTransform = 0;
let winTransform = 0;
let winWidth = win.clientWidth;
const minWinWidth = 20;
const maxWinWidth = canvas.width / 2;

let transform = 0;

win.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
});

win.addEventListener('touchmove', e => {
    let x = e.changedTouches[0].clientX;
    const diffX = x - startX;
    transform = Math.max(0, currentTransform + diffX);
    transform = Math.min(transform, canvas.width / 2 - winWidth);

    win.style.transform = `translateX(${transform}px)`

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
    win.style.width = newWidth + 'px';
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

    win.style.width = newWidth + 'px';
    win.style.transform = `translateX(${newTransform}px)`
    transform = newTransform;
    winWidth = newWidth;
});

winLeftButton.addEventListener('touchend', e => {
    currentTransform = transform;
});

const values = points.map(x => x[1]);
const maxValue = Math.max.apply(null, values);
const minValue = Math.min.apply(null, values);

const diffValue = maxValue - minValue;
drawWinPlot(ctx2, points, maxValue, diffValue);

var prevAxis;
var animationStartTime = performance.now();
var maxAnimationTime = 400;
var isAnimate = false;

var animState;

function render() {
    const visibleStart = points.length * transform / CANVAS_WIDTH;
    const visibleStartPoint = Math.max(Math.floor(visibleStart), 0);
    const horizontalOffset = visibleStart % 1;

    const visibleEnd = points.length * winWidth / CANVAS_WIDTH;
    const visibleEndPoint = Math.min(visibleStartPoint + Math.ceil(visibleEnd), points.length);
    const horizontalStepMultiplier = visibleEnd >= points.length ? 1 : visibleEnd % 1;

    const visiblePoints = points.slice(visibleStartPoint, visibleEndPoint);

    const values = visiblePoints.map(x => x[1]);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let axis = calcYAxes(values);
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

    // TODO: разбить рендер цифер и линий
    drawYAxis(values, animState, delta);
    drawPlot(ctx, visiblePoints, min, max, horizontalOffset, horizontalStepMultiplier);
    requestAnimationFrame(render);
}

function drawPlot(ctx, points, min, max, horizontalOffset, horizontalStepMultiplier) {
    const canvas = ctx.canvas;

    // TODO решить проблему отступа и последней точки
    const horizontalPrevStep = (canvas.width) / (points.length - 3);
    const horizontalNextStep = (canvas.width) / (points.length - 2);
    const horizontalStep = lerp(horizontalPrevStep, horizontalNextStep, horizontalStepMultiplier)

    const maxHeight = canvas.height;

    const startX = horizontalStep * horizontalOffset * -1;
    const startY = maxHeight - reverseLerp(min, max, points[0][1]) * maxHeight;

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(startX, startY);

    ctx.strokeStyle = '#8f7fff';

    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        if (point[0] === 0) continue;
        const yCoord = maxHeight - reverseLerp(min, max, point[1]) * maxHeight;
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

function remap(a, b, c, d, val) {
    return (d - c) * val / (b - a);
}

function clamp(min, max, value) {
    return Math.min(Math.max(value, min), max);
}

function drawYAxis(values, animState, delta) {
    ctx.lineWidth = 1;
    ctx.font = "24px sans-serif";
    const { currentAxis, preventAxis } = animState;
    const step = canvas.height / currentAxis.steps;

    // Render new
    ctx.strokeStyle = `rgba(215,215,219, ${delta})`;
    ctx.fillStyle = `rgba(148,148,152, ${delta})`;
    let stepMultiplier = (animState.endMax - animState.endMin) / (animState.startMax - animState.startMin);
    stepMultiplier = lerp(stepMultiplier, 1, delta);

    for (let i = 0; i < currentAxis.steps; i++) {
        let yCoord = canvas.height - step * i * stepMultiplier;

        ctx.beginPath();
        ctx.moveTo(0, yCoord);
        ctx.fillText(currentAxis.min + currentAxis.stepValue * i, 20, yCoord - 10);
        ctx.lineTo(canvas.width, yCoord);
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
        let yCoord = canvas.height - step * i * reversedStepMultiplier;

        ctx.beginPath();
        ctx.moveTo(0, yCoord);
        ctx.fillText(preventAxis.min + preventAxis.stepValue * i, 20, yCoord - 10);
        ctx.lineTo(canvas.width, yCoord);
        ctx.stroke();
    }
}

function drawWinPlot(ctx, points, maxValue, diffValue) {
    const canvas = ctx.canvas;
    const verticalScale = 50;

    const horizontalStep = canvas.width / (points.length - 1);
    const maxHeight = canvas.height - verticalScale;
    const verticalOffset = (canvas.height - maxHeight) / 2;

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(0, 0);
    ctx.strokeStyle = '#8f7fff';
    points.forEach((point, i) => {
        const yCoord = ((maxValue - point[1]) / diffValue) * maxHeight + verticalOffset;
        const xCoord = i * horizontalStep;
        ctx.lineTo(xCoord, yCoord);
    });
    ctx.stroke();
}

function calcYAxes(valuesArray) {
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

render();
