const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const canvas2 = document.getElementById('canvas2')
const ctx2 = canvas2.getContext('2d');

const CANVAS_WIDTH = canvas.width / 2;
const CANVAS_HEIGTH = canvas.height / 2;

const win = document.getElementById('win');

const points = [];
const rawData = data[0].columns;

for (let i = 1; i < rawData[0].length; i++) {
    points.push([rawData[0][i], rawData[1][i]]);
}

console.log(points)

let startX = 0;
let currentTransform = 0;
let transform = 0;
let winWidth = win.clientWidth;

const countVisiblePoint = Math.round(points.length * winWidth / CANVAS_WIDTH);
let visibleStartPoint = 0;
let visibleEndPoint = countVisiblePoint;

win.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
});

win.addEventListener('touchmove', e => {
    let x = e.changedTouches[0].clientX;
    const diffX = x - startX;
    transform = Math.max(0, currentTransform + diffX);
    transform = Math.min(transform, canvas.width / 2 - winWidth);

    win.style.transform = `translateX(${transform}px)`

    visibleStartPoint = Math.round(points.length * transform / CANVAS_WIDTH);
    visibleEndPoint = visibleStartPoint + countVisiblePoint;
});

win.addEventListener('touchend', e => {
    currentTransform = transform;
});

let i = 0;

render();

const values = points.map(x => x[1]);
const maxValue = Math.max.apply(null, values);
const minValue = Math.min.apply(null, values);

const diffValue = maxValue - minValue;
drawWinPlot(ctx2, points, maxValue, diffValue);

var prevAxis;
var animationStartTime = performance.now();
var maxAnimationTime = 200;
var isAnimate = false;

var animState = {
    startMin: 0,
    endMin: 0,
    startMax: 0,
    endMax: 0
};

function render() {
    const visiblePoints = points.slice(visibleStartPoint, visibleEndPoint);

    const values = visiblePoints.map(x => x[1]);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let axis = calcYAxes(values);
    let { min, max } = axis;

    if (!prevAxis) prevAxis = axis;

    // console.log(prevAxis.min !== axis.min, prevAxis.max !== axis.max, !isAnimate)
    // Should animate
    if ((prevAxis.min !== axis.min || prevAxis.max !== axis.max) && !isAnimate) {
        console.log('should animate')
        animState = {
            startMin: prevAxis.min,
            startMax: prevAxis.max,
            endMin: axis.min,
            endMax: axis.max
        };
        animationStartTime = performance.now();
        prevAxis = axis;
        isAnimate = true;
    }

    if (isAnimate) {
        const diffTime = performance.now() - animationStartTime;
        const delta = Math.min(diffTime / maxAnimationTime, 1)
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
                endMax: axis.max
            };
            animationStartTime = performance.now();
            prevAxis = axis;
            isAnimate = true;
        }

        console.log('animate');
    }

    // drawYAxis(values, axis);
    drawPlot(ctx, visiblePoints, min, max);
    requestAnimationFrame(render)
}

canvas.addEventListener('touchstart', () => {
    prevAxis.steps = prevAxis.steps === 4 ? 5 : 4;
    render();
});

function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

function reverseLerp(a, b, t) {
    return (t - a) / (b - a);
}

function drawYAxis(values, axis) {

    ctx.lineWidth = 1;
    const step = canvas.height / axis.steps;
    for (let i = 0; i < axis.steps; i++) {
        const yCoord = step * i;
        ctx.beginPath();
        ctx.moveTo(0, yCoord);
        ctx.lineTo(canvas.width, yCoord);
        ctx.stroke();
    }
}

function drawPlot(ctx, points, min, max) {
    i += 0.02;
    const canvas = ctx.canvas;

    const horizontalStep = canvas.width / (points.length - 1);
    const maxHeight = canvas.height;

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(0, 0);
    ctx.strokeStyle = '#8f7fff';
    points.forEach((point, i) => {
        // const yCoord = ((maxValue - point[1]) / diffValue) * maxHeight + verticalOffset;
        const yCoord = maxHeight - reverseLerp(min, max, point[1]) * maxHeight;
        const xCoord = i * horizontalStep;
        // console.log(min, max, point[1])
        ctx.lineTo(xCoord, yCoord);
    });
    ctx.stroke();
}

function drawWinPlot(ctx, points, maxValue, diffValue) {
    // i += 0.02;
    const canvas = ctx.canvas;
    // const verticalScale = 100 * (Math.sin(i) + 1) / 2;
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
        // console.log(xCoord, yCoord, (maxValue - point[1]) / diffValue)
        ctx.lineTo(xCoord, yCoord);
    });
    ctx.stroke();
}

function calcYAxes(valuesArray) {
    var calculateOrderOfMagnitude = function(val) {
            return Math.floor(Math.log(val) / Math.LN10);
        },
        maxSteps = 5,
        maxValue = Math.max.apply(Math, valuesArray),
        minValue = Math.min.apply(Math, valuesArray),

        valueRange = Math.abs(maxValue - minValue),
        rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange),

        // eslint-disable-next-line max-len
        graphMax = Math.ceil(maxValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude),
        // eslint-disable-next-line max-len
        graphMin = Math.floor(minValue / (Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude),
        graphRange = graphMax - graphMin,
        stepValue = Math.pow(10, rangeOrderOfMagnitude),
        numberOfSteps = Math.round(graphRange / stepValue);

    // Подбираем оптимальную величину шага
    while ((numberOfSteps > maxSteps || (numberOfSteps * 2) < maxSteps)) {
        if (numberOfSteps > maxSteps) {
            stepValue *= 2;
            numberOfSteps = Math.round(graphRange / stepValue);
        } else {
            stepValue /= 2;
            numberOfSteps = Math.round(graphRange / stepValue);
        }
    }

    // Если величина шага недостаточна, то увеличиваем кол-во шагов
    while (graphMin + (numberOfSteps * stepValue) < graphMax) {
        numberOfSteps++;
    }

    return {
        steps: numberOfSteps,
        stepValue: stepValue,
        min: graphMin,
        max: graphMin + (numberOfSteps * stepValue)
    };
}
